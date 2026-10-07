import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, setApiUser } from './api';
import type { User } from './types';

interface Session {
  users: User[];
  user: User | null;
  setUserId: (id: string) => void;
  provider: { id: string; model: string } | null;
}

const Ctx = createContext<Session>({ users: [], user: null, setUserId: () => {}, provider: null });

function storedUser(): string {
  try {
    return localStorage.getItem('audit-user') ?? 'auditor';
  } catch {
    return 'auditor';
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<User[]>([]);
  const [userId, setUserIdState] = useState(storedUser);
  const [provider, setProvider] = useState<Session['provider']>(null);
  setApiUser(userId);

  useEffect(() => {
    api<User[]>('/users').then(setUsers);
    api<{ provider: Session['provider'] }>('/health').then((h) => setProvider(h.provider));
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

  return <Ctx.Provider value={{ users, user: users.find((u) => u.id === userId) ?? null, setUserId, provider }}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);
