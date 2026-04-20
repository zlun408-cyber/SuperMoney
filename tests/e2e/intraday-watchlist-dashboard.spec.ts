import { expect, test } from '@playwright/test';

const watchlist = [
  {
    code: '000001',
    name: '测试基金',
    position: { cost: 1000, shares: 500 },
    transactions: [],
    sipPlans: [],
    sipExecutionRecords: [],
  },
];

const intraday = {
  '000001': [
    {
      fundCode: '000001',
      fundName: '测试基金',
      tradingDate: '2026-04-17',
      minuteKey: '2026-04-17 10:30',
      estimatedNav: 1,
      changeRate: 0,
      updatedAt: '2026-04-17 10:30',
      capturedAt: '2026-04-17T02:30:00.000Z',
    },
    {
      fundCode: '000001',
      fundName: '测试基金',
      tradingDate: '2026-04-17',
      minuteKey: '2026-04-17 10:31',
      estimatedNav: 1.01,
      changeRate: 0.8,
      updatedAt: '2026-04-17 10:31',
      capturedAt: '2026-04-17T02:31:00.000Z',
    },
  ],
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/funds/quote?**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        quotes: [
          {
            code: '000001',
            name: '测试基金',
            estimatedNav: 1.01,
            changeRate: 0.8,
            updatedAt: '2026-04-17 10:31',
          },
        ],
      }),
    });
  });
});

test('renders embedded intraday trend in watchlist and expanded chart on detail page', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(
    ({ watchlistValue, intradayValue }) => {
      window.localStorage.setItem('super-finance-watchlist', JSON.stringify(watchlistValue));
      window.localStorage.setItem('super-finance-estimate-intraday', JSON.stringify(intradayValue));
    },
    { watchlistValue: watchlist, intradayValue: intraday },
  );
  await page.reload();
  await page.waitForLoadState('networkidle');

  const row = page.getByRole('row').filter({ hasText: '测试基金' });
  await expect(row).toContainText('上行');
  await expect(row.getByTestId('fund-intraday-sparkline')).toBeVisible();
  await expect(row).toContainText('分时生成中');
  await expect(row).toContainText('置信度低');
  await expect(row).toContainText('2/240');

  await page.goto('/fund/000001');
  await page.waitForLoadState('networkidle');

  await expect(page.getByText('今日走势')).toBeVisible();
  await expect(page.getByTestId('fund-intraday-chart')).toBeVisible();
  await expect(page.getByText('分时生成中')).toBeVisible();
  await expect(page.getByText('置信度低')).toBeVisible();
  await expect(page.getByText('2/240')).toBeVisible();

  await page.reload();

  await expect(page.getByText('今日走势')).toBeVisible();
  await expect(page.getByTestId('fund-intraday-chart')).toBeVisible();
});
