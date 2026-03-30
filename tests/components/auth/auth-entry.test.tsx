import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthEntry } from '@/components/auth/auth-entry';
import { AuthProvider } from '@/lib/auth/auth-context';
import type { SupabaseAuthClientLike, SupabaseSessionLike } from '@/lib/auth/types';

afterEach(() => {
  cleanup();
});

class FakeSupabaseAuthClient implements SupabaseAuthClientLike {
  session: SupabaseSessionLike | null;
  getSessionError: Error | null = null;
  signInWithPassword = vi.fn().mockResolvedValue({ error: null });
  signUp = vi.fn().mockResolvedValue({ error: null });
  signOut = vi.fn().mockResolvedValue({ error: null });
  private listener: ((event: string, session: SupabaseSessionLike | null) => void) | null = null;

  constructor(session: SupabaseSessionLike | null = null) {
    this.session = session;
  }

  async getSession() {
    if (this.getSessionError) {
      throw this.getSessionError;
    }

    return {
      data: {
        session: this.session,
      },
      error: null,
    };
  }

  onAuthStateChange(callback: (event: string, session: SupabaseSessionLike | null) => void) {
    this.listener = callback;

    return {
      data: {
        subscription: {
          unsubscribe: () => {
            this.listener = null;
          },
        },
      },
    };
  }

  emit(event: string, session: SupabaseSessionLike | null) {
    this.session = session;
    this.listener?.(event, session);
  }
}

describe('AuthEntry', () => {
  it('submits login with real auth client methods', async () => {
    const user = userEvent.setup();
    const authClient = new FakeSupabaseAuthClient();

    render(
      <AuthProvider authClient={authClient}>
        <AuthEntry />
      </AuthProvider>,
    );

    await user.click(await screen.findByRole('button', { name: '登录 / 注册' }));
    await user.type(screen.getByLabelText('邮箱'), 'demo@example.com');
    await user.type(screen.getByLabelText('密码'), '123456');
    await user.click(screen.getByRole('button', { name: '提交登录' }));

    await waitFor(() => {
      expect(authClient.signInWithPassword).toHaveBeenCalledWith({
        email: 'demo@example.com',
        password: '123456',
      });
    });
  });

  it('renders authenticated state from session and supports logout', async () => {
    const user = userEvent.setup();
    const authClient = new FakeSupabaseAuthClient({
      user: {
        id: 'user-1',
        email: 'demo@example.com',
      },
    });

    render(
      <AuthProvider authClient={authClient}>
        <AuthEntry />
      </AuthProvider>,
    );

    expect(await screen.findByText('demo@example.com')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '退出登录' }));

    await waitFor(() => {
      expect(authClient.signOut).toHaveBeenCalledTimes(1);
    });
  });

  it('falls back to logged-out state when getSession rejects with an auth refresh error', async () => {
    const authClient = new FakeSupabaseAuthClient();
    authClient.getSessionError = new Error('Invalid Refresh Token: Refresh Token Not Found');

    render(
      <AuthProvider authClient={authClient}>
        <AuthEntry />
      </AuthProvider>,
    );

    expect(await screen.findByRole('button', { name: '登录 / 注册' })).toBeTruthy();
  });
});
