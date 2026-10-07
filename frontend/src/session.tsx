import { UserManager, WebStorageStateStore } from 'oidc-client-ts';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, setApiUser, setTokenProvider } from './api';
import type { User } from './types';

type AuthConfig = { mode: 'demo' } | { mode: 'oidc'; authority: string; clientId: string; scope: string };
type ModelInfo = { id: string; model: string };

interface Session {
  mode: 'demo' | 'oidc' | null;
  users: User[];
  user: User | null;
  setUserId: (id: string) => void;
  signOut: () => void;
  provider: ModelInfo | null;
  error: string | null;
}

const Ctx = createContext<Session>({ mode: null, users: [], user: null, setUserId: () => {}, signOut: () => {}, provider: null, error: null });

function storedUser(): string {
  try {
    return localStorage.getItem('audit-user') ?? 'auditor';
  } catch {
    return 'auditor';
  }
}

/** OpenID Connect sign-in (authorization code + PKCE) against Entra ID, Cognito, Google or any OIDC provider. */
async function startOidc(cfg: Extract<AuthConfig, { mode: 'oidc' }>): Promise<UserManager | null> {
  const mgr = new UserManager({
    authority: cfg.authority,
    client_id: cfg.clientId,
    redirect_uri: `${window.location.origin}/`,
    post_logout_redirect_uri: `${window.location.origin}/`,
    response_type: 'code',
    scope: cfg.scope,
    automaticSilentRenew: true,
    userStore: new WebStorageStateStore({ store: window.sessionStorage }),
  });
  const params = new URLSearchParams(window.location.search);
  if (params.has('code') && params.has('state')) {
    const signedIn = await mgr.signinRedirectCallback();
    const returnTo = typeof signedIn.state === 'string' ? signedIn.state : '/';
    window.history.replaceState({}, '', returnTo);
  }
  const existing = await mgr.getUser();
  if (!existing || existing.expired) {
    await mgr.signinRedirect({ state: window.location.pathname + window.location.search });
    return null;
  }
  setTokenProvider(async () => (await mgr.getUser())?.access_token ?? null);
  return mgr;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Session['mode']>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [me, setMe] = useState<User | null>(null);
  const [userId, setUserIdState] = useState(storedUser);
  const [provider, setProvider] = useState<ModelInfo | null>(null);
  const [manager, setManager] = useState<UserManager | null>(null);
  const [error, setError] = useState<string | null>(null);
  if (mode === 'demo') setApiUser(userId);

  useEffect(() => {
    (async () => {
      try {
        const { auth } = await api<{ auth: AuthConfig }>('/config');
        api<{ provider: ModelInfo }>('/health').then((h) => setProvider(h.provider));
        if (auth.mode === 'oidc') {
          const mgr = await startOidc(auth);
          if (!mgr) return; // redirecting to the identity provider
          setManager(mgr);
          setMe(await api<User>('/me'));
          setMode('oidc');
        } else {
          setApiUser(storedUser());
          setUsers(await api<User[]>('/users'));
          setMode('demo');
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  const setUserId = (id: string) => {
    setApiUser(id);
    setUserIdState(id);
    try {
      localStorage.setItem('audit-user', id);
    } catch {
      /* storage unavailable */
    }
  };

  const user = mode === 'oidc' ? me : users.find((u) => u.id === userId) ?? null;
  const signOut = () => manager?.signoutRedirect();

  return (
    <Ctx.Provider value={{ mode, users: mode === 'oidc' && me ? [me] : users, user, setUserId, signOut, provider, error }}>
      {error ? <div style={{ padding: 40, fontFamily: 'system-ui' }}>Could not start the session: {error}</div> : mode ? children : null}
    </Ctx.Provider>
  );
}

export const useSession = () => useContext(Ctx);
