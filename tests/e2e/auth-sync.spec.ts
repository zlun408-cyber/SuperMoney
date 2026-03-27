import { expect, test } from '@playwright/test';

test('can login, keep watchlist after reload, and restore it after logout/login', async ({ page }) => {
  const email = process.env.E2E_SUPABASE_EMAIL;
  const password = process.env.E2E_SUPABASE_PASSWORD;
  const fundCode = `9${Date.now().toString().slice(-5)}`;
  const fundName = `E2E云同步测试基金${fundCode}`;

  test.skip(!email || !password, '需要提供 E2E_SUPABASE_EMAIL 和 E2E_SUPABASE_PASSWORD');

  await page.route('**/api/funds/search?**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        funds: [
          {
            code: fundCode,
            name: fundName,
            category: '基金',
            fundType: '指数型-股票',
          },
        ],
      }),
    });
  });

  await page.route('**/api/funds/quote?**', async (route) => {
    const url = new URL(route.request().url());
    const codes = (url.searchParams.get('codes') ?? '').split(',').filter(Boolean);

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        quotes: codes.map((code) => ({
          code,
          name: code === fundCode ? fundName : `基金${code}`,
          estimatedNav: 1.4234,
          changeRate: -1.45,
          updatedAt: '2026-03-27 15:00',
        })),
      }),
    });
  });

  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.clear();
  });
  await page.reload();

  await page.getByRole('button', { name: '登录 / 注册' }).click();
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await page.getByLabel('邮箱').fill(email);
  await page.getByLabel('密码').fill(password);
  await page.getByRole('button', { name: '提交登录' }).click();

  await expect(page.getByText(email)).toBeVisible({ timeout: 15000 });

  await page.getByRole('button', { name: '添加基金' }).click();
  await page.getByPlaceholder('输入基金代码或名称').fill(fundCode);
  await page.getByRole('button', { name: new RegExp(fundName) }).click();

  await expect(page.getByRole('link', { name: fundName })).toBeVisible();

  await page.reload();

  await expect(page.getByText(email)).toBeVisible();
  await expect(page.getByRole('link', { name: fundName })).toBeVisible();

  await page.getByRole('button', { name: '退出登录' }).click();
  await expect(page.getByRole('button', { name: '登录 / 注册' })).toBeVisible();

  await page.getByRole('button', { name: '登录 / 注册' }).click();
  await page.getByLabel('邮箱').fill(email);
  await page.getByLabel('密码').fill(password);
  await page.getByRole('button', { name: '提交登录' }).click();

  await expect(page.getByText(email)).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('link', { name: fundName })).toBeVisible();
});
