'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { createAuthenticatedAccuracyStore, createLocalAccuracyStore } from '@/lib/accuracy/accuracy-store';
import type { AuthCredentials, AuthSessionValue, SupabaseAuthClientLike, SupabaseSessionLike } from '@/lib/auth/types';
import { createSupabaseCloudAccuracyClient } from '@/lib/sync/cloud-accuracy';
import { createSupabaseCloudWatchlistClient } from '@/lib/sync/cloud-watchlist';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

const AuthSessionContext = createContext<AuthSessionValue | null>(null);

interface AuthProviderProps {
  children: ReactNode;
  authClient?: SupabaseAuthClientLike | null;
}

interface SessionState {
  isReady: boolean;
  session: SupabaseSessionLike | null;
}

export function AuthProvider({ children, authClient }: AuthProviderProps) {
  const browserClient = createSupabaseBrowserClient();
  const authApi = authClient ?? (browserClient ? browserClient.auth : null);
  const localAccuracyStore = useMemo(() => createLocalAccuracyStore(), []);
  const [sessionState, setSessionState] = useState<SessionState>({
    isReady: authApi === null,
    session: null,
  });

  useEffect(() => {
    if (!authApi) {
      setSessionState({
        isReady: true,
        session: null,
      });
      return;
    }

    const activeClient = authApi;

    let cancelled = false;

    async function resetToLoggedOutState() {
      try {
        await activeClient.signOut();
      } catch {
        // Ignore follow-up cleanup failures. The priority is to keep auth bootstrap stable.
      }

      if (!cancelled) {
        setSessionState({
          isReady: true,
          session: null,
        });
      }
    }

    async function loadSession() {
      try {
        const { data, error } = await activeClient.getSession();

        if (cancelled) {
          return;
        }

        if (error) {
          await resetToLoggedOutState();
          return;
        }

        setSessionState({
          isReady: true,
          session: data.session,
        });
      } catch {
        await resetToLoggedOutState();
      }
    }

    void loadSession();

    const { data } = activeClient.onAuthStateChange((_event, session) => {
      if (!cancelled) {
        setSessionState({
          isReady: true,
          session,
        });
      }
    });

    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, [authApi]);

  const cloudClient = useMemo(
    () => (browserClient ? createSupabaseCloudWatchlistClient(browserClient) : null),
    [browserClient],
  );
  const cloudAccuracyClient = useMemo(
    () => (browserClient ? createSupabaseCloudAccuracyClient(browserClient) : null),
    [browserClient],
  );
  const accuracyStore = useMemo(() => {
    const userId = sessionState.session?.user?.id;

    if (userId && cloudAccuracyClient) {
      return createAuthenticatedAccuracyStore({
        userId,
        cloudClient: cloudAccuracyClient,
      });
    }

    return localAccuracyStore;
  }, [cloudAccuracyClient, localAccuracyStore, sessionState.session]);

  useEffect(() => {
    if (!sessionState.isReady) {
      return;
    }

    void accuracyStore.initialize().catch(() => {
      // Ignore bootstrap failures to avoid blocking auth initialization.
    });
  }, [accuracyStore, sessionState.isReady]);

  const value = useMemo<AuthSessionValue>(() => {
    const session = sessionState.session;
    const user = session?.user ?? null;
    const isAuthenticated = Boolean(user?.id);

    return {
      isReady: sessionState.isReady,
      isAuthenticated,
      userId: user?.id ?? null,
      userEmail: user?.email ?? null,
      cloudClient,
      accuracyStore,
      login: async (credentials: AuthCredentials) => {
        if (!authApi) {
          throw new Error('Supabase 未配置，无法登录');
        }

        const { error } = await authApi.signInWithPassword(credentials);

        if (error) {
          throw error;
        }
      },
      register: async (credentials: AuthCredentials) => {
        if (!authApi) {
          throw new Error('Supabase 未配置，无法注册');
        }

        const { error } = await authApi.signUp(credentials);

        if (error) {
          throw error;
        }
      },
      logout: async () => {
        if (!authApi) {
          return;
        }

        const { error } = await authApi.signOut();

        if (error) {
          throw error;
        }
      },
    };
  }, [accuracyStore, authApi, cloudClient, sessionState.isReady, sessionState.session]);

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession(): AuthSessionValue {
  const context = useContext(AuthSessionContext);

  if (!context) {
    throw new Error('useAuthSession 必须在 AuthProvider 内使用');
  }

  return context;
}
