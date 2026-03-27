import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL_KEY = 'NEXT_PUBLIC_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'NEXT_PUBLIC_SUPABASE_ANON_KEY';

export interface SupabaseBrowserEnv {
  url: string;
  anonKey: string;
}

let browserClient: SupabaseClient | null | undefined;

export function getSupabaseBrowserEnv(
  env: Record<string, string | undefined> = process.env,
): SupabaseBrowserEnv | null {
  const url =
    env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    env[SUPABASE_URL_KEY];
  const anonKey =
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    env[SUPABASE_ANON_KEY];

  if (!url || !anonKey) {
    return null;
  }

  return {
    url,
    anonKey,
  };
}

export function hasSupabaseBrowserEnv(env: Record<string, string | undefined> = process.env): boolean {
  return getSupabaseBrowserEnv(env) !== null;
}

export function createSupabaseBrowserClient(
  env: Record<string, string | undefined> = process.env,
): SupabaseClient | null {
  if (browserClient !== undefined) {
    return browserClient;
  }

  const browserEnv = getSupabaseBrowserEnv(env);

  if (!browserEnv) {
    browserClient = null;
    return browserClient;
  }

  browserClient = createClient(browserEnv.url, browserEnv.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  });

  return browserClient;
}
