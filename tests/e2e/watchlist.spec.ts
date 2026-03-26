import { expect, test } from '@playwright/test';

test('can add a fund, keep it after reload, and open the detail page', async ({ page }) => {
  await page.route('**/api/funds/search?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        funds: [
          {
            code: '588350',
            name: '鹏扬中证科创创业50ETF',
            category: '基金',
            fundType: '指数型-股票',
          },
        ],
      }),
    });
  });

  await page.route('**/api/funds/quote?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        quotes: [
          {
            code: '588350',
            name: '鹏扬中证科创创业50ETF',
            estimatedNav: 1.4234,
            changeRate: -1.45,
            updatedAt: '2026-03-26 15:00',
          },
        ],
      }),
    });
  });

  await page.goto('/');

  await expect(page.getByText('还没有添加基金，请先添加一只基金开始监控。')).toBeVisible();

  await page.getByRole('button', { name: '添加基金' }).click();
  await page.getByPlaceholder('输入基金代码或名称').fill('588350');
  await page.getByRole('button', { name: /鹏扬中证科创创业50ETF/ }).click();

  await expect(page.getByRole('link', { name: '鹏扬中证科创创业50ETF' })).toBeVisible();
  await expect(page.getByText('588350')).toBeVisible();

  await page.reload();

  await expect(page.getByRole('link', { name: '鹏扬中证科创创业50ETF' })).toBeVisible();

  await page.getByRole('link', { name: '鹏扬中证科创创业50ETF' }).click();

  await expect(page).toHaveURL(/\/fund\/588350$/);
  await expect(page.getByText('基金代码：588350')).toBeVisible();
  await expect(page.getByText('当前估值')).toBeVisible();
});
