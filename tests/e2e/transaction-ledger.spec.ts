import { expect, test } from '@playwright/test';

function summaryValueLocator(page: Parameters<typeof test>[0]['page'], label: string) {
  return page
    .locator('.rounded-xl', {
      has: page.locator('p', { hasText: label }),
    })
    .locator('p')
    .nth(1);
}

function transactionRow(page: Parameters<typeof test>[0]['page'], rowText: string | RegExp) {
  return page.locator('li').filter({ hasText: rowText });
}

test('can add buy and sell transactions, then see derived summaries on detail and homepage', async ({ page }) => {
  await page.route('**/api/funds/search?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        funds: [
          {
            code: '163406',
            name: '兴全合润混合',
            category: '基金',
            fundType: '混合型',
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
            code: '163406',
            name: '兴全合润混合',
            estimatedNav: 1.5,
            changeRate: 1.23,
            updatedAt: '2026-03-27 10:00',
          },
        ],
      }),
    });
  });

  await page.goto('/');

  await page.getByRole('button', { name: '添加基金' }).click();
  await page.getByPlaceholder('输入基金代码或名称').fill('163406');
  await page.getByRole('button', { name: /兴全合润混合/ }).click();

  await expect(page.getByRole('link', { name: '兴全合润混合' })).toBeVisible();

  await page.getByRole('link', { name: '兴全合润混合' }).click();
  await expect(page).toHaveURL(/\/fund\/163406$/);

  await page.getByRole('button', { name: '添加交易记录' }).click();
  await page.getByLabel('交易日期').fill('2026-03-20');
  await page.getByLabel('金额').fill('1000');
  await page.getByLabel('净值').fill('1');
  await page.getByRole('button', { name: '保存记录' }).click();

  const buyRow = transactionRow(page, /2026-03-20 · 金额 1000/);
  await expect(buyRow).toBeVisible();
  await expect(buyRow.locator('span', { hasText: '买入' })).toBeVisible();

  await page.getByRole('button', { name: '添加交易记录' }).click();
  await page.getByLabel('记录类型').selectOption('sell');
  await page.getByLabel('交易日期').fill('2026-03-22');
  await page.getByLabel('份额').fill('200');
  await page.getByLabel('净值').fill('1.2');
  await page.getByRole('button', { name: '保存记录' }).click();

  const sellRow = transactionRow(page, /2026-03-22 · 份额 200/);
  await expect(sellRow).toBeVisible();
  await expect(sellRow.locator('span', { hasText: '卖出' })).toBeVisible();
  await expect(page.getByText('持仓概览')).toBeVisible();
  await expect(page.getByText('当前成本', { exact: true })).toBeVisible();
  await expect(summaryValueLocator(page, '当前成本')).toHaveText('800.00');
  await expect(page.getByText('收益拆分')).toBeVisible();
  await expect(page.getByText('未实现收益', { exact: true })).toBeVisible();
  await expect(summaryValueLocator(page, '未实现收益')).toHaveText('400.00');
  await expect(page.getByText('已实现收益', { exact: true })).toBeVisible();
  await expect(summaryValueLocator(page, '已实现收益')).toHaveText('40.00');
  await expect(page.getByText('卖出后剩余 800.00 份 · 本次已实现收益 40.00')).toBeVisible();

  await page.getByRole('link', { name: '返回首页' }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText('成本 800.00 / 份额 800.00')).toBeVisible();
  await expect(page.getByText('400.00')).toBeVisible();
});
