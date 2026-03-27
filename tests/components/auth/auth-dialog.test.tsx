import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthButton } from '@/components/auth/auth-button';

afterEach(() => {
  cleanup();
});

describe('AuthButton', () => {
  it('opens the auth dialog and submits login credentials', async () => {
    const user = userEvent.setup();
    const onLogin = vi.fn().mockResolvedValue(undefined);
    const onRegister = vi.fn().mockResolvedValue(undefined);
    const onLogout = vi.fn();

    render(
      <AuthButton
        isAuthenticated={false}
        onLogin={onLogin}
        onRegister={onRegister}
        onLogout={onLogout}
      />,
    );

    await user.click(screen.getByRole('button', { name: '登录 / 注册' }));

    expect(screen.getByRole('heading', { name: '登录后可同步数据' })).toBeTruthy();

    await user.type(screen.getByLabelText('邮箱'), 'demo@example.com');
    await user.type(screen.getByLabelText('密码'), '123456');
    await user.click(screen.getByRole('button', { name: '提交登录' }));

    expect(onLogin).toHaveBeenCalledWith({
      email: 'demo@example.com',
      password: '123456',
    });
    expect(onRegister).not.toHaveBeenCalled();
  });

  it('switches to register mode and submits register credentials', async () => {
    const user = userEvent.setup();
    const onLogin = vi.fn().mockResolvedValue(undefined);
    const onRegister = vi.fn().mockResolvedValue(undefined);

    render(
      <AuthButton
        isAuthenticated={false}
        onLogin={onLogin}
        onRegister={onRegister}
        onLogout={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('button', { name: '登录 / 注册' }));
    await user.click(screen.getByRole('button', { name: '切换到注册' }));

    expect(screen.getByRole('button', { name: '切换到注册', pressed: true })).toBeTruthy();

    await user.type(screen.getByLabelText('邮箱'), 'new@example.com');
    await user.type(screen.getByLabelText('密码'), 'abc123');
    await user.click(screen.getByRole('button', { name: '提交注册' }));

    expect(onRegister).toHaveBeenCalledWith({
      email: 'new@example.com',
      password: 'abc123',
    });
    expect(onLogin).not.toHaveBeenCalled();
  });

  it('shows logout action for authenticated users', async () => {
    const user = userEvent.setup();
    const onLogout = vi.fn();

    render(
      <AuthButton
        isAuthenticated
        userEmail="demo@example.com"
        onLogin={vi.fn()}
        onRegister={vi.fn()}
        onLogout={onLogout}
      />,
    );

    expect(screen.getByText('demo@example.com')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '退出登录' }));

    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
