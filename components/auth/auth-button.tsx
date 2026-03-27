'use client';

import { useState } from 'react';

import { AuthDialog } from '@/components/auth/auth-dialog';
import type { AuthCredentials } from '@/lib/auth/types';

interface AuthButtonProps {
  isAuthenticated?: boolean;
  userEmail?: string;
  onLogin: (credentials: AuthCredentials) => Promise<void> | void;
  onRegister: (credentials: AuthCredentials) => Promise<void> | void;
  onLogout: () => Promise<void> | void;
}

export function AuthButton({
  isAuthenticated = false,
  userEmail,
  onLogin,
  onRegister,
  onLogout,
}: AuthButtonProps) {
  const [open, setOpen] = useState(false);

  if (isAuthenticated) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-600">{userEmail}</span>
        <button className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm" onClick={() => void onLogout()} type="button">
          退出登录
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-3">
      <button className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm" onClick={() => setOpen(true)} type="button">
        登录 / 注册
      </button>
      <AuthDialog open={open} onClose={() => setOpen(false)} onLogin={onLogin} onRegister={onRegister} />
    </div>
  );
}
