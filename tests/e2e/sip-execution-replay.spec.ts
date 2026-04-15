import { expect, test } from '@playwright/test';

const seededWatchlist = [
  {
    code: '000001',
    name: '基金A',
    sipPlans: [
      {
        id: 'plan-1',
        amount: 100,
        frequency: 'monthly',
        startDate: '2024-01-10',
        endDate: '2024-01-10',
        executionTime: '10:00',
        executionPeriod: 'before_1500',
        status: 'active',
        nextExecutionAt: '2024-01-10T10:00:00.000Z',
      },
    ],
  },
];

test('auto-generated SIP transaction becomes skipped after delete and is not replayed on reload', async ({ page }) => {
  await page.addInitScript((watchlist) => {
    if (!window.sessionStorage.getItem('sip-e2e-seeded')) {
      window.localStorage.setItem('super-finance-watchlist', JSON.stringify(watchlist));
      window.sessionStorage.setItem('sip-e2e-seeded', '1');
    }
  }, seededWatchlist);

  await page.route('**/api/funds/quote?codes=000001', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        quotes: [
          {
            code: '000001',
            name: '基金A',
            estimatedNav: 1.25,
            changeRate: 0.88,
            updatedAt: '2026-04-10 14:30',
          },
        ],
      }),
    });
  });

  await page.goto('/fund/000001');
  await page.waitForLoadState('networkidle');

  await expect(page.getByText('最近一次已生成')).toBeVisible();
  await expect(page.getByText('来源：定投计划').first()).toBeVisible();

  page.on('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '删除 2024-01-10 买入记录' }).click();

  await expect(page.getByText('本次已跳过，不会自动补回').first()).toBeVisible();
  await expect(page.getByText('还没有交易记录，请先添加第一笔记录。')).toBeVisible();

  await page.reload();
  await page.waitForLoadState('networkidle');

  await expect(page.getByText('本次已跳过，不会自动补回').first()).toBeVisible();
  await expect(page.getByText('还没有交易记录，请先添加第一笔记录。')).toBeVisible();
  await expect(page.getByText('来源：定投计划')).toHaveCount(0);
});
