import { expect, test } from '@playwright/test';

type CloudState = {
  funds: Array<{
    id: string;
    user_id: string;
    code: string;
    name: string;
    created_at: string;
  }>;
  transactions: Array<{
    id: string;
    user_id: string;
    fund_id: string;
    type: 'buy' | 'sell' | 'cash_dividend' | 'reinvest_dividend';
    trade_date: string;
    amount?: number | null;
    shares?: number | null;
    nav?: number | null;
    fee?: number | null;
    note?: string | null;
    created_at: string;
    updated_at: string;
  }>;
  sipPlans: Array<{
    id: string;
    user_id: string;
    fund_id: string;
    name?: string | null;
    amount: number;
    frequency: 'weekly' | 'biweekly' | 'monthly';
    start_date: string;
    end_date?: string | null;
    execution_time: string;
    execution_period: 'before_1500' | 'after_1500';
    status: 'active' | 'paused' | 'ended';
    last_executed_at?: string | null;
    next_execution_at?: string | null;
    created_at: string;
    updated_at: string;
  }>;
  sipExecutions: Array<{
    id: string;
    user_id: string;
    fund_id: string;
    plan_id: string;
    execution_date: string;
    status: 'pending' | 'generated' | 'skipped';
    transaction_id?: string | null;
    generated_at?: string | null;
    skipped_at?: string | null;
    skip_reason?: string | null;
    created_at: string;
    updated_at: string;
  }>;
};

const userId = 'user-1';
const userEmail = 'demo@example.com';
const authResponse = {
  access_token: 'access-token',
  refresh_token: 'refresh-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: 2082758400,
  user: {
    id: userId,
    email: userEmail,
  },
};

function createInitialCloudState(): CloudState {
  return {
    funds: [
      {
        id: 'fund-1',
        user_id: userId,
        code: '000001',
        name: '基金A',
        created_at: '2026-04-10T00:00:00.000Z',
      },
    ],
    transactions: [],
    sipPlans: [
      {
        id: 'plan-1',
        user_id: userId,
        fund_id: 'fund-1',
        amount: 100,
        frequency: 'monthly',
        start_date: '2024-01-10',
        end_date: '2024-01-10',
        execution_time: '10:00',
        execution_period: 'before_1500',
        status: 'active',
        next_execution_at: '2024-01-10T10:00:00.000Z',
        created_at: '2026-04-10T00:00:00.000Z',
        updated_at: '2026-04-10T00:00:00.000Z',
      },
    ],
    sipExecutions: [],
  };
}

test('authenticated cloud-backed SIP execution becomes skipped after delete and stays skipped after reload', async ({ page }) => {
  const cloudState = createInitialCloudState();

  await page.addInitScript(() => {
    if (window.name !== 'sf-e2e-cloud-seeded') {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.name = 'sf-e2e-cloud-seeded';
    }
  });

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

  await page.route('**/auth/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (url.pathname.endsWith('/token') && url.searchParams.get('grant_type') === 'password') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(authResponse),
      });
      return;
    }

    if (url.pathname.endsWith('/user')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(authResponse.user),
      });
      return;
    }

    if (url.pathname.endsWith('/logout')) {
      await route.fulfill({
        status: 204,
        body: '',
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    });
  });

  await page.route('**/rest/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const pathname = url.pathname;
    const method = request.method();
    const jsonHeaders = {
      'access-control-allow-origin': '*',
      'content-type': 'application/json',
    };

    const fulfillJson = async (body: unknown, status = 200) => {
      await route.fulfill({
        status,
        headers: jsonHeaders,
        body: JSON.stringify(body),
      });
    };

    if (method === 'GET' && pathname.endsWith('/watchlist_funds')) {
      await fulfillJson(cloudState.funds);
      return;
    }

    if (method === 'GET' && pathname.endsWith('/fund_transactions')) {
      await fulfillJson(cloudState.transactions);
      return;
    }

    if (method === 'GET' && pathname.endsWith('/fund_sip_plans')) {
      await fulfillJson(cloudState.sipPlans);
      return;
    }

    if (method === 'GET' && pathname.endsWith('/fund_sip_executions')) {
      await fulfillJson(cloudState.sipExecutions);
      return;
    }

    if (method === 'POST' && pathname.endsWith('/watchlist_funds')) {
      const payload = (request.postDataJSON() as Array<{ user_id: string; code: string; name: string }>) ?? [];

      cloudState.funds = payload.map((fund, index) => ({
        id: cloudState.funds[index]?.id ?? `fund-${index + 1}`,
        user_id: fund.user_id,
        code: fund.code,
        name: fund.name,
        created_at: cloudState.funds[index]?.created_at ?? '2026-04-10T00:00:00.000Z',
      }));

      await fulfillJson(cloudState.funds);
      return;
    }

    if (method === 'DELETE' && pathname.endsWith('/watchlist_funds')) {
      const codeFilter = url.searchParams.get('code');

      if (codeFilter?.startsWith('not.in.(')) {
        const rawCodes = codeFilter.slice('not.in.('.length, -1);
        const keepCodes = rawCodes
          .split(',')
          .map((code) => code.replaceAll('"', '').trim())
          .filter(Boolean);
        cloudState.funds = cloudState.funds.filter((fund) => keepCodes.includes(fund.code));
      } else {
        cloudState.funds = [];
      }

      await fulfillJson([]);
      return;
    }

    if (method === 'DELETE' && pathname.endsWith('/fund_transactions')) {
      cloudState.transactions = [];
      await fulfillJson([]);
      return;
    }

    if (method === 'POST' && pathname.endsWith('/fund_transactions')) {
      const payload =
        (request.postDataJSON() as Array<{
          id: string;
          user_id: string;
          fund_id: string;
          type: 'buy' | 'sell' | 'cash_dividend' | 'reinvest_dividend';
          trade_date: string;
          amount?: number | null;
          shares?: number | null;
          nav?: number | null;
          fee?: number | null;
          note?: string | null;
        }>) ?? [];

      cloudState.transactions = payload.map((transaction) => ({
        ...transaction,
        created_at: '2026-04-10T10:00:00.000Z',
        updated_at: '2026-04-10T10:00:00.000Z',
      }));

      await fulfillJson([]);
      return;
    }

    if (method === 'DELETE' && pathname.endsWith('/fund_sip_plans')) {
      cloudState.sipPlans = [];
      await fulfillJson([]);
      return;
    }

    if (method === 'POST' && pathname.endsWith('/fund_sip_plans')) {
      const payload =
        (request.postDataJSON() as Array<CloudState['sipPlans'][number]>) ?? [];

      cloudState.sipPlans = payload.map((plan) => ({
        ...plan,
        created_at: cloudState.sipPlans.find((currentPlan) => currentPlan.id === plan.id)?.created_at ?? '2026-04-10T00:00:00.000Z',
        updated_at: '2026-04-10T10:00:00.000Z',
      }));

      await fulfillJson([]);
      return;
    }

    if (method === 'DELETE' && pathname.endsWith('/fund_sip_executions')) {
      cloudState.sipExecutions = [];
      await fulfillJson([]);
      return;
    }

    if (method === 'POST' && pathname.endsWith('/fund_sip_executions')) {
      const payload =
        (request.postDataJSON() as Array<CloudState['sipExecutions'][number]>) ?? [];

      cloudState.sipExecutions = payload.map((execution) => ({
        ...execution,
        created_at:
          cloudState.sipExecutions.find((currentExecution) => currentExecution.id === execution.id)?.created_at ??
          '2026-04-10T10:00:00.000Z',
        updated_at: '2026-04-10T12:00:00.000Z',
      }));

      await fulfillJson([]);
      return;
    }

    await route.abort();
  });

  await page.goto('/');
  await page.getByRole('button', { name: '登录 / 注册' }).click();
  await page.getByLabel('邮箱').fill(userEmail);
  await page.getByLabel('密码').fill('correct-password');
  await page.getByRole('button', { name: '提交登录' }).click();

  await expect(page.getByText(userEmail)).toBeVisible();
  await expect(page.getByRole('link', { name: '基金A' })).toBeVisible();

  await page.goto('/fund/000001');
  await page.waitForLoadState('networkidle');

  await expect(page.getByText('最近一次已生成')).toBeVisible();
  await expect(page.getByText('来源：定投计划').first()).toBeVisible();
  await expect.poll(() => cloudState.transactions.length).toBe(1);
  await expect.poll(() => cloudState.sipExecutions.length).toBe(1);

  expect(cloudState.transactions).toEqual([
    expect.objectContaining({
      id: 'plan-1-2024-01-10',
      type: 'buy',
      trade_date: '2024-01-10',
      nav: 1.25,
    }),
  ]);
  expect(cloudState.sipExecutions).toEqual([
    expect.objectContaining({
      plan_id: 'plan-1',
      execution_date: '2024-01-10',
      status: 'generated',
      transaction_id: 'plan-1-2024-01-10',
    }),
  ]);

  page.on('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: '删除 2024-01-10 买入记录' }).click();

  await expect(page.getByText('本次已跳过，不会自动补回').first()).toBeVisible();
  await expect(page.getByText('还没有交易记录，请先添加第一笔记录。')).toBeVisible();
  await expect.poll(() => cloudState.sipExecutions[0]?.status ?? null).toBe('skipped');

  expect(cloudState.transactions).toEqual([]);
  expect(cloudState.sipExecutions).toEqual([
    expect.objectContaining({
      plan_id: 'plan-1',
      execution_date: '2024-01-10',
      status: 'skipped',
      transaction_id: null,
      skip_reason: 'deleted_generated_transaction',
    }),
  ]);

  await page.reload();
  await page.waitForLoadState('networkidle');

  await expect(page.getByText('本次已跳过，不会自动补回').first()).toBeVisible();
  await expect(page.getByText('还没有交易记录，请先添加第一笔记录。')).toBeVisible();
  await expect(page.getByText('来源：定投计划')).toHaveCount(0);

  expect(cloudState.transactions).toEqual([]);
  expect(cloudState.sipExecutions).toEqual([
    expect.objectContaining({
      plan_id: 'plan-1',
      execution_date: '2024-01-10',
      status: 'skipped',
      transaction_id: null,
    }),
  ]);
});
