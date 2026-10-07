import type { NextFunction, Request, Response } from 'express';
import { createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose';
import type { User } from './engine/types';
import { AppError, USERS } from './service';

// Identity port. "demo" trusts an x-user-id header and is for local use only.
// "oidc" validates bearer tokens from any OpenID Connect provider: Microsoft
// Entra ID on Azure, Amazon Cognito on AWS, Google Identity Platform on GCP,
// or Okta / Keycloak anywhere. Platform roles come from a token claim.

export type Role = User['role'];

export interface Authenticator {
  mode: 'demo' | 'oidc';
  /** Public settings the browser needs to sign in. */
  clientConfig: Record<string, unknown>;
  authenticate(req: Request): Promise<User | null>;
}

export function demoAuth(): Authenticator {
  return {
    mode: 'demo',
    clientConfig: { mode: 'demo' },
    async authenticate(req) {
      const id = req.header('x-user-id');
      if (!id) return null;
      const u = USERS.find((x) => x.id === id);
      if (!u) throw new AppError(401, 'Unknown demo user');
      return u;
    },
  };
}

export interface OidcOptions {
  issuer: string;
  audience: string;
  clientId: string;
  scope: string;
  rolesClaim: string;
  /** Token role / group value -> platform role. */
  roleMap: Record<string, Role>;
  jwksUri?: string;
  /** Injected key source (tests); defaults to the issuer's JWKS. */
  keys?: JWTVerifyGetKey;
}

const PRIORITY: Role[] = ['approver', 'reviewer', 'auditor'];

export function oidcAuth(opts: OidcOptions): Authenticator {
  let keys = opts.keys;
  const getKeys = async (): Promise<JWTVerifyGetKey> => {
    if (keys) return keys;
    let uri = opts.jwksUri;
    if (!uri) {
      const res = await fetch(`${opts.issuer.replace(/\/$/, '')}/.well-known/openid-configuration`);
      if (!res.ok) throw new AppError(503, 'Identity provider discovery failed');
      uri = ((await res.json()) as { jwks_uri: string }).jwks_uri;
    }
    keys = createRemoteJWKSet(new URL(uri));
    return keys;
  };

  return {
    mode: 'oidc',
    clientConfig: { mode: 'oidc', authority: opts.issuer, clientId: opts.clientId, scope: opts.scope },
    async authenticate(req) {
      const header = req.header('authorization') ?? '';
      const token = header.startsWith('Bearer ') ? header.slice(7) : null;
      if (!token) throw new AppError(401, 'Sign-in required');
      let payload: JWTPayload;
      try {
        ({ payload } = await jwtVerify(token, await getKeys(), { issuer: opts.issuer, audience: opts.audience }));
      } catch {
        throw new AppError(401, 'Invalid or expired token');
      }
      const raw = payload[opts.rolesClaim];
      const values = Array.isArray(raw) ? raw.map(String) : typeof raw === 'string' ? raw.split(/[\s,]+/) : [];
      const roles = new Set(values.map((v) => opts.roleMap[v]).filter(Boolean));
      const role = PRIORITY.find((r) => roles.has(r));
      if (!role) throw new AppError(403, 'Signed in, but no audit platform role is assigned to this account');
      const id = String(payload.oid ?? payload.sub);
      const name = String(payload.name ?? payload.preferred_username ?? payload.email ?? id);
      return { id, name, role };
    },
  };
}

/** AUTH_MODE=demo (default) | oidc, with OIDC_* settings. */
export function createAuth(env: Record<string, string | undefined> = process.env): Authenticator {
  if ((env.AUTH_MODE ?? 'demo') === 'demo') return demoAuth();
  const need = (k: string) => {
    if (!env[k]) throw new Error(`${k} must be set when AUTH_MODE=oidc`);
    return env[k]!;
  };
  const roleMap = Object.fromEntries(
    (env.OIDC_ROLE_MAP ?? 'Audit.Auditor:auditor,Audit.Reviewer:reviewer,Audit.Approver:approver')
      .split(',')
      .map((p) => p.split(':').map((s) => s.trim()))
      .filter(([k, v]) => k && PRIORITY.includes(v as Role)),
  ) as Record<string, Role>;
  return oidcAuth({
    issuer: need('OIDC_ISSUER'),
    audience: need('OIDC_AUDIENCE'),
    clientId: need('OIDC_CLIENT_ID'),
    scope: env.OIDC_SCOPE ?? 'openid profile email',
    rolesClaim: env.OIDC_ROLES_CLAIM ?? 'roles',
    roleMap,
    jwksUri: env.OIDC_JWKS_URI,
  });
}

/** Resolves the caller on every /api request except the public probes and config. */
export function authMiddleware(auth: Authenticator) {
  const PUBLIC = new Set(['/api/healthz', '/api/readyz', '/api/config', '/api/health']);
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.path.startsWith('/api/') || PUBLIC.has(req.path)) return next();
    try {
      res.locals.user = await auth.authenticate(req);
      next();
    } catch (err) {
      next(err);
    }
  };
}
