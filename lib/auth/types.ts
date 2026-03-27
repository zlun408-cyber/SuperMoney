import type { CloudWatchlistClient } from '@/lib/sync/cloud-watchlist';

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface SupabaseUserLike {
  id: string;
  email?: string | null;
}

export interface SupabaseSessionLike {
  user: SupabaseUserLike;
}

export interface SupabaseAuthClientLike {
  getSession: () => Promise<{
    data: {
      session: SupabaseSessionLike | null;
    };
    error: Error | null;
  }>;
  onAuthStateChange: (
    callback: (event: string, session: SupabaseSessionLike | null) => void,
  ) => {
    data: {
      subscription: {
        unsubscribe: () => void;
      };
    };
  };
  signInWithPassword: (credentials: AuthCredentials) => Promise<{ error: Error | null }>;
  signUp: (credentials: AuthCredentials) => Promise<{ error: Error | null }>;
  signOut: () => Promise<{ error: Error | null }>;
}

export interface AuthSessionValue {
  isReady: boolean;
  isAuthenticated: boolean;
  userId: string | null;
  userEmail: string | null;
  cloudClient: CloudWatchlistClient | null;
  login: (credentials: AuthCredentials) => Promise<void>;
  register: (credentials: AuthCredentials) => Promise<void>;
  logout: () => Promise<void>;
}
