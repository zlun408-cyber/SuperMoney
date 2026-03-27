'use client';

import { AuthButton } from '@/components/auth/auth-button';
import { useAuthSession } from '@/lib/auth/auth-context';

export function AuthEntry() {
  const { isAuthenticated, userEmail, login, register, logout } = useAuthSession();

  return (
    <AuthButton
      isAuthenticated={isAuthenticated}
      userEmail={userEmail ?? undefined}
      onLogin={login}
      onRegister={register}
      onLogout={logout}
    />
  );
}
