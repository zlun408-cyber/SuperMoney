import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SyncConflictDialog } from '@/components/auth/sync-conflict-dialog';

afterEach(() => {
  cleanup();
});

describe('SyncConflictDialog', () => {
  it('shows two clear choices when local and cloud data both exist', async () => {
    const user = userEvent.setup();
    const onChooseCloud = vi.fn();
    const onChooseLocal = vi.fn();

    render(
      <SyncConflictDialog
        open
        onChooseCloud={onChooseCloud}
        onChooseLocal={onChooseLocal}
      />,
    );

    expect(screen.getByRole('heading', { name: '发现本地和云端都有数据' })).toBeTruthy();
    expect(screen.getByText('请选择要保留哪一份数据，本阶段不会自动合并。')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: '使用云端数据' }));
    expect(onChooseCloud).toHaveBeenCalledTimes(1);
    expect(onChooseLocal).not.toHaveBeenCalled();
  });

  it('lets the user choose local data to overwrite cloud', async () => {
    const user = userEvent.setup();
    const onChooseCloud = vi.fn();
    const onChooseLocal = vi.fn();

    render(
      <SyncConflictDialog
        open
        onChooseCloud={onChooseCloud}
        onChooseLocal={onChooseLocal}
      />,
    );

    await user.click(screen.getByRole('button', { name: '使用本地数据' }));

    expect(onChooseLocal).toHaveBeenCalledTimes(1);
    expect(onChooseCloud).not.toHaveBeenCalled();
  });
});
