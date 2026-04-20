import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { IntradayStatusBadge } from '@/components/fund/intraday-status-badge';

afterEach(() => {
  cleanup();
});

describe('IntradayStatusBadge', () => {
  it('renders warning-toned badges', () => {
    render(<IntradayStatusBadge label="分时生成中" tone="warning" />);

    const badge = screen.getByText('分时生成中');
    expect(badge.className).toContain('bg-amber-50');
    expect(badge.className).toContain('text-amber-700');
  });

  it('renders muted badges', () => {
    render(<IntradayStatusBadge label="今日暂无分时" tone="muted" />);

    const badge = screen.getByText('今日暂无分时');
    expect(badge.className).toContain('bg-slate-100');
    expect(badge.className).toContain('text-slate-500');
  });

  it('renders info-toned badges', () => {
    render(<IntradayStatusBadge label="09:42 更新" tone="info" />);

    const badge = screen.getByText('09:42 更新');
    expect(badge.className).toContain('bg-sky-50');
    expect(badge.className).toContain('text-sky-700');
  });
});
