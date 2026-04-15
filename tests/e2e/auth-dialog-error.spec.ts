import { expect, test } from '@playwright/test';

test('shows login error inline instead of breaking the page', async ({ page }) => {
  const pageErrors: string[] = [];

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  await page.goto('/');
  await page.getByRole('button', { name: '登录 / 注册' }).click();
  await page.getByLabel('邮箱').fill('demo@example.com');
  await page.getByLabel('密码').fill('wrong-password');
  await page.getByRole('button', { name: '提交登录' }).click();

  await expect(page.locator('[role="alert"]').filter({ hasText: 'Invalid login credentials' })).toContainText(
    'Invalid login credentials',
  );
  expect(pageErrors).toEqual([]);
});
