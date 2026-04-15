import { expect, test } from '@playwright/test';

const seededWatchlist = [
  {
    code: '000001',
    name: '基金A',
  },
];

test('allows manual nav entry when historical nav lookup fails', async ({ page }) => {
  await page.addInitScript((watchlist) => {
    if (!window.sessionStorage.getItem('nav-fallback-seeded')) {
      window.localStorage.setItem('super-finance-watchlist', JSON.stringify(watchlist));
      window.sessionStorage.setItem('nav-fallback-seeded', '1');
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

  await page.route('**/api/funds/nav**', async (route) => {
    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({
        success: false,
        error: {
          code: 'NAV_NOT_FOUND',
          message: '净值未找到，请手动输入',
        },
      }),
    });
  });

  await page.goto('/fund/000001');
  await page.waitForLoadState('networkidle');

  await page.getByRole('button', { name: '添加交易记录' }).click();
  await page.getByLabel('交易日期').fill('2026-04-08');

  await expect(page.getByText('净值未找到，请手动输入')).toBeVisible();

  await page.getByLabel('金额').fill('100');
  await page.getByLabel('净值').fill('1.2345');
  await page.getByRole('button', { name: '保存记录' }).click();

  await expect(page.getByText('来源：手动录入')).toBeVisible();
  await expect(page.getByText('下单：2026-04-08 · 15点前')).toBeVisible();
  await expect(page.getByText('生效：2026-04-08')).toBeVisible();
  await expect(page.getByText('金额 100')).toBeVisible();
});
