import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider, useAuthSession } from '@/lib/auth/auth-context';
import type { SupabaseAuthClientLike, SupabaseSessionLike } from '@/lib/auth/types';

const mockCreateSupabaseBrowserClient = vi.fn();
const mockCreateSupabaseCloudWatchlistClient = vi.fn();
const mockCreateSupabaseCloudAccuracyClient = vi.fn();
const mockCreateLocalAccuracyStore = vi.fn();
const mockCreateAuthenticatedAccuracyStore = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  createSupabaseBrowserClient: (...args: unknown[]) => mockCreateSupabaseBrowserClient(...args),
}));

vi.mock('@/lib/sync/cloud-watchlist', async () => {
  const actual = await vi.importActual('@/lib/sync/cloud-watchlist');
  return {
    ...actual,
    createSupabaseCloudWatchlistClient: (...args: unknown[]) =>
      mockCreateSupabaseCloudWatchlistClient(...args),
  };
});

vi.mock('@/lib/sync/cloud-accuracy', async () => {
  const actual = await vi.importActual('@/lib/sync/cloud-accuracy');
  return {
    ...actual,
    createSupabaseCloudAccuracyClient: (...args: unknown[]) => mockCreateSupabaseCloudAccuracyClient(...args),
  };
});

vi.mock('@/lib/accuracy/accuracy-store', async () => {
  const actual = await vi.importActual('@/lib/accuracy/accuracy-store');
  return {
    ...actual,
    createLocalAccuracyStore: (...args: unknown[]) => mockCreateLocalAccuracyStore(...args),
    createAuthenticatedAccuracyStore: (...args: unknown[]) => mockCreateAuthenticatedAccuracyStore(...args),
  };
});

function SessionProbe() {
  const session = useAuthSession();

  return (
    <div>
      <span data-testid="ready">{session.isReady ? 'ready' : 'loading'}</span>
      <span data-testid="user-id">{session.userId ?? 'none'}</span>
      <span data-testid="store-kind">{session.accuracyStore.kind}</span>
    </div>
  );
}

describe('AuthProvider accuracy store integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();

    mockCreateSupabaseBrowserClient.mockReturnValue({ auth: null });
    mockCreateSupabaseCloudWatchlistClient.mockReturnValue({ kind: 'watchlist-cloud' });
    mockCreateSupabaseCloudAccuracyClient.mockReturnValue({ kind: 'accuracy-cloud' });
    mockCreateLocalAccuracyStore.mockReturnValue({
      kind: 'local',
      initialize: vi.fn().mockResolvedValue(undefined),
      loadSnapshots: vi.fn(),
      saveSnapshots: vi.fn(),
      upsertSnapshots: vi.fn(),
      loadAdjustmentDecisions: vi.fn(),
      saveAdjustmentDecisions: vi.fn(),
      dryRunImport: vi.fn(),
      applyImport: vi.fn(),
    });
    mockCreateAuthenticatedAccuracyStore.mockReturnValue({
      kind: 'authenticated',
      initialize: vi.fn().mockResolvedValue(undefined),
      loadSnapshots: vi.fn(),
      saveSnapshots: vi.fn(),
      upsertSnapshots: vi.fn(),
      loadAdjustmentDecisions: vi.fn(),
      saveAdjustmentDecisions: vi.fn(),
      dryRunImport: vi.fn(),
      applyImport: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('creates and initializes an authenticated accuracy store when a session exists', async () => {
    const authClient: SupabaseAuthClientLike = {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: {
            user: { id: 'user-1', email: 'test@example.com' },
          } satisfies SupabaseSessionLike,
        },
        error: null,
      }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    };
    const browserClient = { auth: authClient };
    const authenticatedStore = {
      kind: 'authenticated',
      initialize: vi.fn().mockResolvedValue(undefined),
      loadSnapshots: vi.fn(),
      saveSnapshots: vi.fn(),
      upsertSnapshots: vi.fn(),
      loadAdjustmentDecisions: vi.fn(),
      saveAdjustmentDecisions: vi.fn(),
      dryRunImport: vi.fn(),
      applyImport: vi.fn(),
    };

    mockCreateSupabaseBrowserClient.mockReturnValue(browserClient);
    mockCreateAuthenticatedAccuracyStore.mockReturnValue(authenticatedStore);

    render(
      <AuthProvider authClient={authClient}>
        <SessionProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('ready').textContent).toBe('ready');
      expect(screen.getByTestId('user-id').textContent).toBe('user-1');
      expect(screen.getByTestId('store-kind').textContent).toBe('authenticated');
    });

    expect(mockCreateSupabaseCloudAccuracyClient).toHaveBeenCalledWith(browserClient);
    expect(mockCreateAuthenticatedAccuracyStore).toHaveBeenCalledWith({
      userId: 'user-1',
      cloudClient: { kind: 'accuracy-cloud' },
    });
    await waitFor(() => {
      expect(authenticatedStore.initialize).toHaveBeenCalled();
    });
  });

  it('falls back to the local accuracy store when there is no authenticated session', async () => {
    const authClient: SupabaseAuthClientLike = {
      getSession: vi.fn().mockResolvedValue({
        data: { session: null },
        error: null,
      }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
    };
    const localStore = {
      kind: 'local',
      initialize: vi.fn().mockResolvedValue(undefined),
      loadSnapshots: vi.fn(),
      saveSnapshots: vi.fn(),
      upsertSnapshots: vi.fn(),
      loadAdjustmentDecisions: vi.fn(),
      saveAdjustmentDecisions: vi.fn(),
      dryRunImport: vi.fn(),
      applyImport: vi.fn(),
    };

    mockCreateLocalAccuracyStore.mockReturnValue(localStore);

    render(
      <AuthProvider authClient={authClient}>
        <SessionProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('ready').textContent).toBe('ready');
      expect(screen.getByTestId('user-id').textContent).toBe('none');
      expect(screen.getByTestId('store-kind').textContent).toBe('local');
    });

    expect(mockCreateAuthenticatedAccuracyStore).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(localStore.initialize).toHaveBeenCalled();
    });
  });
});
