import { expect, test } from '@playwright/test';

const seededAccuracySnapshots = [
  {
    id: '000001::2026-04-10 14:30',
    fundCode: '000001',
    fundName: '稳健成长',
    quoteUpdatedAt: '2026-04-10 14:30',
    tradingDate: '2026-04-10',
    estimatedNav: 1.02,
    finalNav: 1,
    absoluteErrorRate: 0.02,
    resolvedAt: '2026-04-10T15:30:00.000Z',
    createdAt: '2026-04-10T14:30:00.000Z',
    updatedAt: '2026-04-10T15:30:00.000Z',
  },
  {
    id: '000001::2026-04-11 14:30',
    fundCode: '000001',
    fundName: '稳健成长',
    quoteUpdatedAt: '2026-04-11 14:30',
    tradingDate: '2026-04-11',
    estimatedNav: 1.01,
    finalNav: 1,
    absoluteErrorRate: 0.01,
    resolvedAt: '2026-04-11T15:30:00.000Z',
    createdAt: '2026-04-11T14:30:00.000Z',
    updatedAt: '2026-04-11T15:30:00.000Z',
  },
  {
    id: '000002::2026-04-12 14:30',
    fundCode: '000002',
    fundName: '科技先锋',
    quoteUpdatedAt: '2026-04-12 14:30',
    tradingDate: '2026-04-12',
    estimatedNav: 1.08,
    finalNav: null,
    absoluteErrorRate: null,
    resolvedAt: null,
    createdAt: '2026-04-12T14:30:00.000Z',
    updatedAt: '2026-04-12T14:30:00.000Z',
  },
];

test('shows accuracy dashboard metrics and seeded fund rows from localStorage', async ({ page }) => {
  await page.addInitScript((snapshots) => {
    window.localStorage.setItem('super-finance-estimate-accuracy', JSON.stringify(snapshots));
  }, seededAccuracySnapshots);

  await page.goto('/accuracy');
  await page.waitForLoadState('networkidle');

  await expect(page.getByRole('heading', { name: '估值准确度看板' })).toBeVisible();
  const totalCard = page.getByTestId('accuracy-summary-total');
  const resolvedCard = page.getByTestId('accuracy-summary-resolved');
  const unresolvedCard = page.getByTestId('accuracy-summary-unresolved');
  const averageErrorCard = page.getByTestId('accuracy-summary-average');

  await expect(totalCard).toContainText('3');
  await expect(resolvedCard).toContainText('2');
  await expect(unresolvedCard).toContainText('1');
  await expect(averageErrorCard).toContainText('1.50%');

  const highErrorRows = page.getByTestId('accuracy-high-error-row');
  await expect(highErrorRows).toHaveCount(1);
  await expect(highErrorRows.nth(0)).toContainText('000001');
  await expect(highErrorRows.nth(0)).toContainText('1.50%');

  const distributionRows = page.getByTestId('accuracy-error-bucket');
  await expect(distributionRows).toHaveCount(4);
  await expect(distributionRows.nth(1)).toContainText('0.30% - 1.00%');
  await expect(distributionRows.nth(1)).toContainText('1');
  await expect(distributionRows.nth(2)).toContainText('1.00% - 2.00%');
  await expect(distributionRows.nth(2)).toContainText('1');

  const diagnosticRows = page.getByTestId('accuracy-diagnostic-row');
  await expect(diagnosticRows).toHaveCount(2);
  await expect(diagnosticRows.nth(0)).toContainText('000001');
  await expect(diagnosticRows.nth(0)).toContainText('持续偏高');
  await expect(diagnosticRows.nth(0)).toContainText('最高优先');
  await expect(diagnosticRows.nth(0)).toContainText('+1.50%');
  await expect(diagnosticRows.nth(1)).toContainText('000002');
  await expect(diagnosticRows.nth(1)).toContainText('样本不足');

  const timeBucketRows = page.getByTestId('accuracy-time-bucket-row');
  await expect(timeBucketRows).toHaveCount(4);
  await expect(timeBucketRows.nth(2)).toContainText('尾盘');
  await expect(timeBucketRows.nth(2)).toContainText('2');

  const trendRows = page.getByTestId('accuracy-trend-row');
  await expect(trendRows).toHaveCount(2);
  await expect(trendRows.nth(0)).toContainText('2026-04-11');
  await expect(trendRows.nth(1)).toContainText('2026-04-10');

  const recommendationRows = page.getByTestId('accuracy-recommendation-row');
  await expect(recommendationRows).toHaveCount(2);
  await expect(recommendationRows.nth(0)).toContainText('优先校正高估偏差');
  await expect(recommendationRows.nth(1)).toContainText('先补充收敛样本');

  const sourceModelCards = page.getByTestId('accuracy-source-model-card');
  await expect(sourceModelCards).toHaveCount(4);
  await expect(sourceModelCards.nth(0)).toContainText('持续偏高主导');
  await expect(sourceModelCards.nth(1)).toContainText('尾盘');

  const strategyRows = page.getByTestId('accuracy-strategy-row');
  await expect(strategyRows).toHaveCount(3);
  await expect(strategyRows.nth(0)).toContainText('先修系统性高估');
  await expect(strategyRows.nth(1)).toContainText('重点优化尾盘链路');

  const adjustmentSummaryCards = page.getByTestId('accuracy-adjustment-summary-card');
  await expect(adjustmentSummaryCards).toHaveCount(4);
  await expect(adjustmentSummaryCards.nth(0)).toContainText('修正前平均误差');
  await expect(adjustmentSummaryCards.nth(0)).toContainText('1.50%');
  await expect(adjustmentSummaryCards.nth(1)).toContainText('最佳实验方案');
  await expect(adjustmentSummaryCards.nth(1)).toContainText('全局签名修正');
  await expect(adjustmentSummaryCards.nth(2)).toContainText('修正后平均误差');
  await expect(adjustmentSummaryCards.nth(2)).toContainText('0.49%');
  await expect(adjustmentSummaryCards.nth(3)).toContainText('相对改善');
  await expect(adjustmentSummaryCards.nth(3)).toContainText('67%');

  const adjustmentRows = page.getByTestId('accuracy-adjustment-row');
  await expect(adjustmentRows).toHaveCount(3);
  await expect(adjustmentRows.nth(0)).toContainText('全局签名修正');
  await expect(adjustmentRows.nth(0)).toContainText('0.49%');
  await expect(adjustmentRows.nth(1)).toContainText('尾盘 / 收盘后专用修正');
  await expect(adjustmentRows.nth(1)).toContainText('0.49%');
  await expect(adjustmentRows.nth(2)).toContainText('诊断 + 尾盘联动修正');
  await expect(adjustmentRows.nth(2)).toContainText('0.49%');

  const adjustmentBucketRows = page.getByTestId('accuracy-adjustment-bucket-row');
  await expect(adjustmentBucketRows).toHaveCount(4);
  await expect(adjustmentBucketRows.nth(0)).toContainText('盘前 / 上午');
  await expect(adjustmentBucketRows.nth(0)).toContainText('暂无样本');
  await expect(adjustmentBucketRows.nth(2)).toContainText('尾盘');
  await expect(adjustmentBucketRows.nth(2)).toContainText('全局签名修正');
  await expect(adjustmentBucketRows.nth(2)).toContainText('1.50%');
  await expect(adjustmentBucketRows.nth(2)).toContainText('0.49%');
  await expect(adjustmentBucketRows.nth(2)).toContainText('67%');

  const adjustmentDiagnosisRows = page.getByTestId('accuracy-adjustment-diagnosis-row');
  await expect(adjustmentDiagnosisRows).toHaveCount(4);
  await expect(adjustmentDiagnosisRows.nth(0)).toContainText('持续偏高');
  await expect(adjustmentDiagnosisRows.nth(0)).toContainText('全局签名修正');
  await expect(adjustmentDiagnosisRows.nth(0)).toContainText('1.50%');
  await expect(adjustmentDiagnosisRows.nth(0)).toContainText('0.49%');
  await expect(adjustmentDiagnosisRows.nth(0)).toContainText('67%');
  await expect(adjustmentDiagnosisRows.nth(3)).toContainText('样本不足');
  await expect(adjustmentDiagnosisRows.nth(3)).toContainText('样本不足');

  const adjustmentFundRows = page.getByTestId('accuracy-adjustment-fund-row');
  await expect(adjustmentFundRows).toHaveCount(1);
  await expect(adjustmentFundRows.nth(0)).toContainText('稳健成长');
  await expect(adjustmentFundRows.nth(0)).toContainText('000001');
  await expect(adjustmentFundRows.nth(0)).toContainText('持续偏高');
  await expect(adjustmentFundRows.nth(0)).toContainText('优先验证');
  await expect(adjustmentFundRows.nth(0)).toContainText('全局签名修正');
  await expect(adjustmentFundRows.nth(0)).toContainText('1.50%');
  await expect(adjustmentFundRows.nth(0)).toContainText('0.49%');
  await expect(adjustmentFundRows.nth(0)).toContainText('67%');

  const unresolvedRows = page.getByTestId('accuracy-unresolved-row');
  await expect(unresolvedRows).toHaveCount(1);
  await expect(unresolvedRows.nth(0)).toContainText('000002');
  await expect(unresolvedRows.nth(0)).toContainText('2026-04-12');

  const fundRows = page.getByTestId('accuracy-fund-row');
  await expect(fundRows).toHaveCount(2);
  await expect(fundRows.nth(0)).toContainText('000001');
  await expect(fundRows.nth(0)).toContainText('稳健成长');
  await expect(fundRows.nth(0)).toContainText('2 / 2');
  await expect(fundRows.nth(0)).toContainText('1.50%');

  await expect(fundRows.nth(1)).toContainText('000002');
  await expect(fundRows.nth(1)).toContainText('科技先锋');
  await expect(fundRows.nth(1)).toContainText('0 / 1');
  await expect(fundRows.nth(1)).toContainText('样本不足');
});


test('filters fund-level adjustment candidates by recommendation status', async ({ page }) => {
  const filterSnapshots = [
    {
      id: 'priority-1',
      fundCode: '000010',
      fundName: '优先修正基金',
      quoteUpdatedAt: '2026-04-10 14:30',
      tradingDate: '2026-04-10',
      estimatedNav: 1.02,
      finalNav: 1,
      absoluteErrorRate: 0.02,
      resolvedAt: '2026-04-10T15:30:00.000Z',
      createdAt: '2026-04-10T14:30:00.000Z',
      updatedAt: '2026-04-10T15:30:00.000Z',
    },
    {
      id: 'priority-2',
      fundCode: '000010',
      fundName: '优先修正基金',
      quoteUpdatedAt: '2026-04-11 14:30',
      tradingDate: '2026-04-11',
      estimatedNav: 1.01,
      finalNav: 1,
      absoluteErrorRate: 0.01,
      resolvedAt: '2026-04-11T15:30:00.000Z',
      createdAt: '2026-04-11T14:30:00.000Z',
      updatedAt: '2026-04-11T15:30:00.000Z',
    },
    {
      id: 'watch-1',
      fundCode: '000020',
      fundName: '观察基金',
      quoteUpdatedAt: '2026-04-10 15:05',
      tradingDate: '2026-04-10',
      estimatedNav: 0.96,
      finalNav: 1,
      absoluteErrorRate: 0.04,
      resolvedAt: '2026-04-10T16:00:00.000Z',
      createdAt: '2026-04-10T15:05:00.000Z',
      updatedAt: '2026-04-10T16:00:00.000Z',
    },
  ];

  await page.addInitScript((snapshots) => {
    window.localStorage.setItem('super-finance-estimate-accuracy', JSON.stringify(snapshots));
  }, filterSnapshots);

  await page.goto('/accuracy');
  await page.waitForLoadState('networkidle');

  const adjustmentFundRows = page.getByTestId('accuracy-adjustment-fund-row');
  await expect(adjustmentFundRows).toHaveCount(2);
  await expect(adjustmentFundRows.nth(0)).toContainText('观察基金');
  await expect(adjustmentFundRows.nth(1)).toContainText('优先修正基金');

  await page.getByTestId('accuracy-adjustment-filter-priority').click();
  await expect(adjustmentFundRows).toHaveCount(1);
  await expect(adjustmentFundRows.nth(0)).toContainText('优先修正基金');

  await page.getByTestId('accuracy-adjustment-filter-all').click();
  await page.getByTestId('accuracy-adjustment-sort-baseline').click();
  await expect(adjustmentFundRows).toHaveCount(2);
  await expect(adjustmentFundRows.nth(0)).toContainText('观察基金');
  await expect(adjustmentFundRows.nth(1)).toContainText('优先修正基金');
});


test('expands fund-level adjustment drilldown details', async ({ page }) => {
  await page.addInitScript((snapshots) => {
    window.localStorage.setItem('super-finance-estimate-accuracy', JSON.stringify(snapshots));
  }, seededAccuracySnapshots);

  await page.goto('/accuracy');
  await page.waitForLoadState('networkidle');

  await page.getByTestId('accuracy-adjustment-fund-toggle-000001').click();

  const detail = page.getByTestId('accuracy-adjustment-fund-detail-000001');
  await expect(detail).toBeVisible();
  await expect(detail).toContainText('建议依据');
  await expect(detail).toContainText('建议动作：优先验证');
  await expect(detail).toContainText('修正规则草案');
  await expect(detail).toContainText('全局偏差平移草案');
  await expect(detail).toContainText('上线前验证清单');
  await expect(detail).toContainText('时段分布');
  await expect(detail).toContainText('样本明细');
  await expect(detail).toContainText('2026-04-11');
  await expect(detail).toContainText('2026-04-10');

  await page.getByTestId('accuracy-adjustment-fund-toggle-000001').click();
  await expect(detail).toHaveCount(0);
});

test('stores manual adjustment decisions and shows them in the execution list', async ({ page }) => {
  await page.addInitScript((snapshots) => {
    window.localStorage.setItem('super-finance-estimate-accuracy', JSON.stringify(snapshots));
  }, seededAccuracySnapshots);

  await page.goto('/accuracy');
  await page.waitForLoadState('networkidle');

  await page.getByTestId('accuracy-adjustment-fund-toggle-000001').click();
  await page.getByTestId('accuracy-adjustment-decision-verification-000001').click();

  const executionRows = page.getByTestId('accuracy-adjustment-decision-row');
  await expect(executionRows).toHaveCount(1);
  await expect(executionRows.nth(0)).toContainText('稳健成长');
  await expect(executionRows.nth(0)).toContainText('加入验证');

  await page.reload();
  await page.waitForLoadState('networkidle');

  await expect(executionRows).toHaveCount(1);
  await expect(executionRows.nth(0)).toContainText('稳健成长');
  await expect(executionRows.nth(0)).toContainText('加入验证');
});

test('filters execution items and jumps back to fund detail', async ({ page }) => {
  const filterSnapshots = [
    {
      id: 'priority-1',
      fundCode: '000010',
      fundName: '优先修正基金',
      quoteUpdatedAt: '2026-04-10 14:30',
      tradingDate: '2026-04-10',
      estimatedNav: 1.02,
      finalNav: 1,
      absoluteErrorRate: 0.02,
      resolvedAt: '2026-04-10T15:30:00.000Z',
      createdAt: '2026-04-10T14:30:00.000Z',
      updatedAt: '2026-04-10T15:30:00.000Z',
    },
    {
      id: 'priority-2',
      fundCode: '000010',
      fundName: '优先修正基金',
      quoteUpdatedAt: '2026-04-11 14:30',
      tradingDate: '2026-04-11',
      estimatedNav: 1.01,
      finalNav: 1,
      absoluteErrorRate: 0.01,
      resolvedAt: '2026-04-11T15:30:00.000Z',
      createdAt: '2026-04-11T14:30:00.000Z',
      updatedAt: '2026-04-11T15:30:00.000Z',
    },
    {
      id: 'watch-1',
      fundCode: '000020',
      fundName: '观察基金',
      quoteUpdatedAt: '2026-04-10 15:05',
      tradingDate: '2026-04-10',
      estimatedNav: 0.96,
      finalNav: 1,
      absoluteErrorRate: 0.04,
      resolvedAt: '2026-04-10T16:00:00.000Z',
      createdAt: '2026-04-10T15:05:00.000Z',
      updatedAt: '2026-04-10T16:00:00.000Z',
    },
  ];

  await page.addInitScript((snapshots) => {
    window.localStorage.setItem('super-finance-estimate-accuracy', JSON.stringify(snapshots));
    window.localStorage.setItem(
      'super-finance-adjustment-fund-decisions',
      JSON.stringify({
        '000010': { status: 'verification', updatedAt: '2026-04-15T08:00:00.000Z' },
        '000020': { status: 'watch', updatedAt: '2026-04-15T09:00:00.000Z' },
      }),
    );
  }, filterSnapshots);

  await page.goto('/accuracy');
  await page.waitForLoadState('networkidle');

  const executionRows = page.getByTestId('accuracy-adjustment-decision-row');
  await expect(executionRows).toHaveCount(2);
  await expect(executionRows.nth(0)).toContainText('P0');
  await expect(executionRows.nth(0)).toContainText('最近决策');

  await page.getByTestId('accuracy-adjustment-execution-filter-watch').click();
  await expect(executionRows).toHaveCount(1);
  await expect(executionRows.nth(0)).toContainText('观察基金');

  await page.getByTestId('accuracy-adjustment-execution-open-000020').click();
  await expect(page.getByTestId('accuracy-adjustment-fund-detail-000020')).toBeVisible();
});

test('completes execution items and writes them into history', async ({ page }) => {
  await page.addInitScript((snapshots) => {
    window.localStorage.setItem('super-finance-estimate-accuracy', JSON.stringify(snapshots));
    window.localStorage.setItem(
      'super-finance-adjustment-fund-decisions',
      JSON.stringify({
        '000001': { status: 'verification', updatedAt: '2024-04-15T08:00:00.000Z' },
      }),
    );
  }, seededAccuracySnapshots);

  await page.goto('/accuracy');
  await page.waitForLoadState('networkidle');

  await page.getByTestId('accuracy-adjustment-execution-complete-000001').click();

  await expect(page.getByTestId('accuracy-adjustment-decision-row')).toHaveCount(0);
  const historyRows = page.getByTestId('accuracy-adjustment-history-row');
  await expect(historyRows).toHaveCount(2);
  await expect(historyRows.first()).toContainText('稳健成长');
  await expect(historyRows.first()).toContainText('已验证通过');
});
