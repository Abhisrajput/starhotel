import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from 'jose';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { createAuth, oidcAuth } from '../src/auth';
import { newService } from './helpers';

// Tokens are signed locally, standing in for Entra ID / Cognito / Google.
describe('OIDC sign-in', () => {
  const issuer = 'https://login.example.com/tenant/v2.0';
  const audience = 'api://audit-platform';
  let sign: (claims: Record<string, unknown>, opts?: { iss?: string; aud?: string; exp?: string }) => Promise<string>;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const jwk = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256' };
    sign = (claims, o = {}) =>
      new SignJWT(claims).setProtectedHeader({ alg: 'RS256', kid: 'k1' }).setIssuer(o.iss ?? issuer).setAudience(o.aud ?? audience).setIssuedAt().setExpirationTime(o.exp ?? '10m').sign(privateKey);
    const auth = oidcAuth({
      issuer, audience, clientId: 'spa', scope: 'openid', rolesClaim: 'roles',
      roleMap: { 'Audit.Auditor': 'auditor', 'Audit.Reviewer': 'reviewer', 'Audit.Approver': 'approver' },
      keys: createLocalJWKSet({ keys: [jwk] }),
    });
    app = createApp(newService(), auth);
  });

  const bearer = (t: string) => ({ authorization: `Bearer ${t}` });

  it('maps token roles to platform roles and identifies the user [REQ-15]', async () => {
    const t = await sign({ oid: 'u-123', name: 'Dana Lead', roles: ['Audit.Reviewer'] });
    const me = await request(app).get('/api/me').set(bearer(t)).expect(200);
    expect(me.body).toEqual({ id: 'u-123', name: 'Dana Lead', role: 'reviewer' });
    expect((await request(app).post('/api/engagements').set(bearer(t)).send({})).status).toBe(400);
  });

  it('rejects missing, forged, expired or wrong-audience tokens [REQ-15]', async () => {
    expect((await request(app).get('/api/engagements')).status).toBe(401);
    expect((await request(app).get('/api/engagements').set(bearer('not.a.jwt'))).status).toBe(401);
    expect((await request(app).get('/api/engagements').set(bearer(await sign({ sub: 'x', roles: ['Audit.Auditor'] }, { aud: 'other' })))).status).toBe(401);
    expect((await request(app).get('/api/engagements').set(bearer(await sign({ sub: 'x', roles: ['Audit.Auditor'] }, { iss: 'https://evil' })))).status).toBe(401);
    expect((await request(app).get('/api/engagements').set(bearer(await sign({ sub: 'x', roles: ['Audit.Auditor'] }, { exp: '-1m' })))).status).toBe(401);
  });

  it('refuses signed-in users without a platform role, and ignores x-user-id [REQ-15]', async () => {
    const t = await sign({ sub: 'x', roles: ['Something.Else'] });
    expect((await request(app).get('/api/engagements').set(bearer(t))).status).toBe(403);
    expect((await request(app).get('/api/engagements').set({ 'x-user-id': 'approver' })).status).toBe(401);
  });

  it('keeps probes and sign-in config public', async () => {
    await request(app).get('/api/healthz').expect(200);
    const cfg = await request(app).get('/api/config').expect(200);
    expect(cfg.body.auth).toEqual({ mode: 'oidc', authority: issuer, clientId: 'spa', scope: 'openid' });
  });

  it('requires complete settings when AUTH_MODE=oidc', () => {
    expect(() => createAuth({ AUTH_MODE: 'oidc' })).toThrow(/OIDC_ISSUER/);
    expect(createAuth({}).mode).toBe('demo');
  });
});
