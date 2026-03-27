import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { AuthEntry } from '@/components/auth/auth-entry';
import { AuthProvider } from '@/lib/auth/auth-context';

export const metadata: Metadata = {
  title: 'SuperFinance',
  description: '基金实时估值监控',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <AuthProvider>
          <div className="mx-auto flex w-full max-w-6xl justify-end px-6 pt-4">
            <AuthEntry />
          </div>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
