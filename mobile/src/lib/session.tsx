import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { api, ApiError } from './api';
import { storage } from './storage';

const TOKEN_KEY = 'delta.token';

const store = {
  get: () => storage.get(TOKEN_KEY),
  set: (v: string) => storage.set(TOKEN_KEY, v),
  clear: () => storage.remove(TOKEN_KEY),
};

type Session = {
  token: string | null;
  ready: boolean;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const saved = await store.get();
      if (saved) {
        try {
          await api.me(saved);
          setToken(saved);
        } catch (e) {
          if (e instanceof ApiError && e.status === 401) await store.clear();
          else setToken(saved);
        }
      }
      setReady(true);
    })();
  }, []);

  const signIn = useCallback(async (t: string) => {
    await store.set(t);
    setToken(t);
  }, []);

  const signOut = useCallback(async () => {
    await store.clear();
    setToken(null);
  }, []);

  const value = useMemo(() => ({ token, ready, signIn, signOut }), [token, ready, signIn, signOut]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const s = useContext(SessionContext);
  if (!s) throw new Error('useSession must be used inside SessionProvider');
  return s;
}

export function useToken(): string {
  const { token } = useSession();
  if (!token) throw new Error('No session');
  return token;
}
