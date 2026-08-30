import type { AuthUser } from '@tarzan/types';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { ApiError, authApi } from '../lib/api';

type AuthStatus = 'authenticated' | 'loading' | 'unauthenticated';

interface AuthContextValue {
  login(input: { email: string; password: string }): Promise<void>;
  logout(): Promise<void>;
  register(input: {
    email: string;
    name: string;
    password: string;
  }): Promise<void>;
  status: AuthStatus;
  user: AuthUser | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    let active = true;

    void authApi
      .getSession()
      .then((session) => {
        if (active) {
          setUser(session.user);
          setStatus('authenticated');
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setUser(null);
          setStatus('unauthenticated');

          if (!(error instanceof ApiError) || error.status !== 401) {
            console.error('Unable to restore the session', error);
          }
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(
    async (input: { email: string; password: string }) => {
      const session = await authApi.login(input);
      setUser(session.user);
      setStatus('authenticated');
    },
    [],
  );

  const register = useCallback(
    async (input: { email: string; name: string; password: string }) => {
      const session = await authApi.register(input);
      setUser(session.user);
      setStatus('authenticated');
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      setStatus('unauthenticated');
    }
  }, []);

  const value = useMemo(
    () => ({ login, logout, register, status, user }),
    [login, logout, register, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);

  if (value === null) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return value;
}
