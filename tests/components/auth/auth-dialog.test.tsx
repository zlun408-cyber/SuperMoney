import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AuthDialog } from '@/components/auth/auth-dialog';

describe('AuthDialog', () => {
  it('shows login error instead of throwing an unhandled rejection', async () => {
    const onLogin = vi.fn().mockRejectedValue(new Error('Invalid login credentials'));

    render(<AuthDialog open onClose={vi.fn()} onLogin={onLogin} onRegister={vi.fn()} />);

    fireEvent.change(screen.getByLabelText('邮箱'), {
      target: { value: 'demo@example.com' },
    });
    fireEvent.change(screen.getByLabelText('密码'), {
      target: { value: 'wrong-password' },
    });
    fireEvent.click(screen.getByRole('button', { name: '提交登录' }));

    await waitFor(() => {
      expect(onLogin).toHaveBeenCalledWith({
        email: 'demo@example.com',
        password: 'wrong-password',
      });
    });

    expect(await screen.findByText('Invalid login credentials')).toBeTruthy();
    expect(screen.getByText('登录后可同步数据')).toBeTruthy();
  });
});
