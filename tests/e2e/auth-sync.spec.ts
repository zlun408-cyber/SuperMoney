import { expect, test, type Page } from '@playwright/test';

interface MockUser {
  id: string;
  email: string;
}

interface MockSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: 'bearer';
  user: MockUser;
}

interface MockFundRow {
  id: string;
  user_id: string;
  code: string;
  name: string;
  created_at: string;
}

interface MockTransactionRow {
  id: string;
  user_id: string;
  fund_id: string;
  type: string;
  trade_date: string;
  amount: number | null;
  shares: number | null;
  nav: number | null;
  fee: number | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

async function installSupabaseMocks(page: Page) {
  const accounts = new Map<string, { password: string; user: MockUser; session: MockSession }>();
  const sessionsByToken = new Map<string, MockSession>();
  const funds: MockFundRow[] = [];
  const transactions: MockTransactionRow[] = [];

  const createSession = (email: string, password: string) => {
    const existing = accounts.get(email);

    if (existing) {
      if (existing.password !== password) {
        throw new Error('invalid credentials');
      }

      return existing.session;
    }

    const user: MockUser = {
      id: `user-${Math.random().toString(36).slice(2, 10)}`,
      email,
    };
    const session: MockSession = {
      access_token: `access-${user.id}`,
      refresh_token: `refresh-${user.id}`,
      expires_in: 3600,
      token_type: 'bearer',
      user,
    };

    accounts.set(email, { password, user, session });
    sessionsByToken.set(session.access_token, session);

    return session;
  };

  await page.route('**/auth/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (url.pathname.endsWith('/signup') && method === 'POST') {
      const body = request.postDataJSON() as { email: string; password: string };
      const session = createSession(body.email, body.password);

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_in: session.expires_in,
          token_type: session.token_type,
          user: session.user,
        }),
      });
      return;
    }

    if (url.pathname.endsWith('/token') && url.searchParams.get('grant_type') === 'password' && method === 'POST') {
      const body = request.postDataJSON() as { email: string; password: string };

      try {
        const session = createSession(body.email, body.password);

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(session),
        });
      } catch {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials' }),
        });
      }
      return;
    }

    if (url.pathname.endsWith('/user') && method === 'GET') {
      const token = request.headers()['authorization']?.replace(/^Bearer\s+/i, '');
      const session = token ? sessionsByToken.get(token) : null;

      await route.fulfill({
        status: session ? 200 : 401,
        contentType: 'application/json',
        body: JSON.stringify(session ? session.user : { error: 'Unauthorized' }),
      });
      return;
    }

    if (url.pathname.endsWith('/logout') && method === 'POST') {
      await route.fulfill({
        status: 204,
        body: '',
      });
      return;
    }

    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  await page.route('**/rest/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const pathname = url.pathname;

    if (pathname.endsWith('/watchlist_funds')) {
      if (method === 'GET') {
        const userId = (url.searchParams.get('user_id') ?? '').replace('eq.', '');
        const rows = funds
          .filter((row) => row.user_id === userId)
          .sort((a, b) => a.created_at.localeCompare(b.created_at));

        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
        return;
      }

      if (method === 'POST') {
        const payload = request.postDataJSON() as Array<{ user_id: string; code: string; name: string }>;
        const savedRows: MockFundRow[] = [];

        for (const item of payload) {
          const existing = funds.find((row) => row.user_id === item.user_id && row.code === item.code);

          if (existing) {
            existing.name = item.name;
            savedRows.push(existing);
            continue;
          }

          const row: MockFundRow = {
            id: `fund-${Math.random().toString(36).slice(2, 10)}`,
            user_id: item.user_id,
            code: item.code,
            name: item.name,
            created_at: new Date().toISOString(),
          };
          funds.push(row);
          savedRows.push(row);
        }

        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(savedRows) });
        return;
      }

      if (method === 'DELETE') {
        const userId = (url.searchParams.get('user_id') ?? '').replace('eq.', '');
        const excludedCodesRaw = url.searchParams.get('code');

        if (!excludedCodesRaw) {
          for (let index = funds.length - 1; index >= 0; index -= 1) {
            if (funds[index].user_id === userId) {
              funds.splice(index, 1);
            }
          }
        } else {
          const excludedCodes = excludedCodesRaw
            .replace('not.in.(', '')
            .replace(/\)$/u, '')
            .split(',')
            .map((item) => item.replaceAll('"', ''))
            .filter(Boolean);

          for (let index = funds.length - 1; index >= 0; index -= 1) {
            if (funds[index].user_id === userId && !excludedCodes.includes(funds[index].code)) {
              funds.splice(index, 1);
            }
          }
        }

        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
        return;
      }
    }

    if (pathname.endsWith('/fund_transactions')) {
      if (method === 'GET') {
        const userId = (url.searchParams.get('user_id') ?? '').replace('eq.', '');
        const rows = transactions
          .filter((row) => row.user_id === userId)
          .sort((a, b) => a.trade_date.localeCompare(b.trade_date) || a.created_at.localeCompare(b.created_at));

        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) });
        return;
      }

      if (method === 'DELETE') {
        const userId = (url.searchParams.get('user_id') ?? '').replace('eq.', '');

        for (let index = transactions.length - 1; index >= 0; index -= 1) {
          if (transactions[index].user_id === userId) {
            transactions.splice(index, 1);
          }
        }

        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
        return;
      }

      if (method === 'POST') {
        const payload = request.postDataJSON() as Array<{
          id: string;
          user_id: string;
          fund_id: string;
          type: string;
          trade_date: string;
          amount?: number | null;
          shares?: number | null;
          nav?: number | null;
          fee?: number | null;
          note?: string | null;
        }>;

        for (const item of payload) {
          transactions.push({
            id: item.id,
            user_id: item.user_id,
            fund_id: item.fund_id,
            type: item.type,
            trade_date: item.trade_date,
            amount: item.amount ?? null,
            shares: item.shares ?? null,
            nav: item.nav ?? null,
            fee: item.fee ?? null,
            note: item.note ?? null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
        }

        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(payload) });
        return;
      }
    }

    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
  });
}

async function registerAndLogin(page: Page) {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = 'E2ePass123!';

  await page.getByRole('button', { name: '登录 / 注册' }).click();
  await page.getByRole('button', { name: '切换到注册' }).click();
  await page.getByLabel('邮箱').fill(email);
  await page.getByLabel('密码').fill(password);
  await page.getByRole('button', { name: '提交注册' }).click();
  await expect(page.getByText(email)).toBeVisible({ timeout: 15000 });

  return { email, password };
}

test('can login, keep watchlist after reload, and restore it after logout/login', async ({ page }) => {
  const fundCode = `9${Date.now().toString().slice(-5)}`;
  const fundName = `E2E云同步测试基金${fundCode}`;

  await installSupabaseMocks(page);

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

  const { email, password } = await registerAndLogin(page);

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

test('shows conflict dialog on login when both local and cloud data exist, and can choose cloud data', async ({ page }) => {
  const cloudFundCode = `8${Date.now().toString().slice(-5)}`;
  const cloudFundName = `E2E云端冲突基金${cloudFundCode}`;
  const localFundCode = `7${Date.now().toString().slice(-5)}`;
  const localFundName = `E2E本地冲突基金${localFundCode}`;

  await installSupabaseMocks(page);

  await page.route('**/api/funds/search?**', async (route) => {
    const url = new URL(route.request().url());
    const query = url.searchParams.get('query') ?? '';
    const funds = [];

    if (query.includes(cloudFundCode) || query.includes(cloudFundName)) {
      funds.push({
        code: cloudFundCode,
        name: cloudFundName,
        category: '基金',
        fundType: '指数型-股票',
      });
    }

    if (query.includes(localFundCode) || query.includes(localFundName)) {
      funds.push({
        code: localFundCode,
        name: localFundName,
        category: '基金',
        fundType: '指数型-股票',
      });
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ funds }),
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
          name:
            code === cloudFundCode ? cloudFundName : code === localFundCode ? localFundName : `基金${code}`,
          estimatedNav: 1.2345,
          changeRate: 0.88,
          updatedAt: '2026-03-28 15:00',
        })),
      }),
    });
  });

  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.clear();
  });
  await page.reload();

  const { email, password } = await registerAndLogin(page);

  await page.getByRole('button', { name: '添加基金' }).click();
  await page.getByPlaceholder('输入基金代码或名称').fill(cloudFundCode);
  await page.getByRole('button', { name: new RegExp(cloudFundName) }).click();
  await expect(page.getByRole('link', { name: cloudFundName })).toBeVisible();

  await page.getByRole('button', { name: '退出登录' }).click();
  await expect(page.getByRole('button', { name: '登录 / 注册' })).toBeVisible();

  await page.evaluate(
    ({ localFundCode, localFundName }) => {
      window.localStorage.setItem(
        'super-finance-watchlist',
        JSON.stringify([
          {
            code: localFundCode,
            name: localFundName,
          },
        ]),
      );
    },
    { localFundCode, localFundName },
  );

  await page.getByRole('button', { name: '登录 / 注册' }).click();
  await page.getByLabel('邮箱').fill(email);
  await page.getByLabel('密码').fill(password);
  await page.getByRole('button', { name: '提交登录' }).click();

  await expect(page.getByText('发现本地和云端都有数据')).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('button', { name: '使用云端数据' })).toBeVisible();
  await expect(page.getByRole('button', { name: '使用本地数据' })).toBeVisible();

  await page.getByRole('button', { name: '使用云端数据' }).click();

  await expect(page.getByRole('link', { name: cloudFundName })).toBeVisible();
  await expect(page.getByText('发现本地和云端都有数据')).toBeHidden();
  await expect(page.getByRole('link', { name: localFundName })).toHaveCount(0);
});
