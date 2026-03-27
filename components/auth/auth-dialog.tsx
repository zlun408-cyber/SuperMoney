'use client';

import { useState } from 'react';

import type { AuthCredentials } from '@/lib/auth/types';

interface AuthDialogProps {
  open: boolean;
  onClose: () => void;
  onLogin: (credentials: AuthCredentials) => Promise<void> | void;
  onRegister: (credentials: AuthCredentials) => Promise<void> | void;
}

type AuthMode = 'login' | 'register';

export function AuthDialog({ open, onClose, onLogin, onRegister }: AuthDialogProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (!open) {
    return null;
  }

  const submitLabel = mode === 'login' ? '登录' : '注册账号';
  const submitAriaLabel = mode === 'login' ? '提交登录' : '提交注册';

  const handleSubmit = async () => {
    const payload = {
      email: email.trim(),
      password,
    };

    if (mode === 'login') {
      await onLogin(payload);
    } else {
      await onRegister(payload);
    }

    setEmail('');
    setPassword('');
    setMode('login');
    onClose();
  };

  const handleClose = () => {
    setEmail('');
    setPassword('');
    setMode('login');
    onClose();
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">登录后可同步数据</h2>
          <p className="mt-1 text-sm text-slate-600">先做最小闭环：支持注册、登录和退出。</p>
        </div>
        <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" onClick={handleClose} type="button">
          关闭
        </button>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          aria-pressed={mode === 'login'}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          onClick={() => setMode('login')}
          type="button"
        >
          登录
        </button>
        <button
          aria-label="切换到注册"
          aria-pressed={mode === 'register'}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          onClick={() => setMode('register')}
          type="button"
        >
          注册
        </button>
      </div>

      <div className="mt-4 grid gap-3">
        <label className="grid gap-1 text-sm text-slate-700">
          <span>邮箱</span>
          <input
            className="rounded-lg border border-slate-300 px-3 py-2"
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            value={email}
          />
        </label>
        <label className="grid gap-1 text-sm text-slate-700">
          <span>密码</span>
          <input
            className="rounded-lg border border-slate-300 px-3 py-2"
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            value={password}
          />
        </label>
      </div>

      <div className="mt-4">
        <button
          aria-label={submitAriaLabel}
          className="rounded-xl bg-emerald-600 px-4 py-2 text-white"
          onClick={() => void handleSubmit()}
          type="button"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
