import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AccuracyDashboard } from '@/components/accuracy/accuracy-dashboard';
import type { EstimateAccuracySnapshot } from '@/lib/funds/types';

const mockLoadEstimateAccuracySnapshots = vi.fn<() => EstimateAccuracySnapshot[]>();
const mockUseAuthSession = vi.fn();
const mockSaveAdjustmentDecisions = vi.fn();

vi.mock('@/lib/storage/estimate-accuracy-storage', () => ({
  ESTIMATE_ACCURACY_STORAGE_KEY: 'super-finance-estimate-accuracy',
  ESTIMATE_ACCURACY_UPDATED_EVENT: 'super-finance-estimate-accuracy-updated',
  loadEstimateAccuracySnapshots: () => mockLoadEstimateAccuracySnapshots(),
}));

vi.mock('@/lib/auth/auth-context', () => ({
  useAuthSession: () => mockUseAuthSession(),
}));

describe('AccuracyDashboard', () => {
  beforeEach(() => {
    mockLoadEstimateAccuracySnapshots.mockReturnValue([]);
    window.localStorage.clear();
    mockSaveAdjustmentDecisions.mockImplementation((decisions: Record<string, unknown>) => {
      window.localStorage.setItem('super-finance-adjustment-fund-decisions', JSON.stringify(decisions));
      window.dispatchEvent(new CustomEvent('super-finance-adjustment-fund-decisions-updated'));
    });
    mockUseAuthSession.mockReturnValue({
      accuracyStore: {
        loadSnapshots: () => mockLoadEstimateAccuracySnapshots(),
        loadAdjustmentDecisions: () => {
          const raw = window.localStorage.getItem('super-finance-adjustment-fund-decisions');
          return raw ? JSON.parse(raw) : {};
        },
        saveAdjustmentDecisions: (decisions: Record<string, unknown>) =>
          mockSaveAdjustmentDecisions(decisions),
      },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('shows a loading state before the first local snapshot read completes', () => {
    mockLoadEstimateAccuracySnapshots.mockReturnValue([
      {
        id: 'loading-1',
        fundCode: '000001',
        fundName: '加载态基金',
        quoteUpdatedAt: '2026-04-10 14:30',
        tradingDate: '2026-04-10',
        estimatedNav: 1.01,
        finalNav: 1,
        absoluteErrorRate: 0.01,
        resolvedAt: '2026-04-10T15:30:00.000Z',
        createdAt: '2026-04-10T14:30:00.000Z',
        updatedAt: '2026-04-10T15:30:00.000Z',
      },
    ]);

    render(<AccuracyDashboard />);

    expect(screen.getAllByText('正在读取本地准确度样本…')).toHaveLength(2);
    expect(screen.getAllByText('正在读取诊断数据…')).toHaveLength(8);
    expect(screen.getAllByText('读取中')).toHaveLength(8);
    expect(screen.queryByText('暂无估值准确度样本')).toBeNull();
  });

  it('shows layered confidence rule explanations in the overview section', () => {
    render(<AccuracyDashboard />);

    expect(screen.getByText('估值可信度分层规则')).toBeTruthy();
    expect(screen.getByText('当前可信度会同时受交易日窗口、已收敛样本量与误差尾部分布约束。')).toBeTruthy();

    const ruleCards = screen.getAllByTestId('accuracy-confidence-rule-card');
    expect(ruleCards).toHaveLength(3);
    expect(screen.getByTestId('accuracy-confidence-rule-window')).toBeTruthy();
    expect(screen.getByTestId('accuracy-confidence-rule-sample')).toBeTruthy();
    expect(screen.getByTestId('accuracy-confidence-rule-distribution')).toBeTruthy();

    expect(screen.getByText('交易日覆盖')).toBeTruthy();
    expect(screen.getByText('已收敛样本量')).toBeTruthy();
    expect(screen.getByText('高误差样本占比')).toBeTruthy();
    expect(screen.getByText(/最终等级按三层门槛中的最弱项决定/)).toBeTruthy();
    expect(screen.getByText(/平均误差仍作为 high\/medium 的上限约束/)).toBeTruthy();
  });

  it('loads snapshots from storage, aggregates the overall summary, and sorts funds by average error descending', async () => {
    mockLoadEstimateAccuracySnapshots.mockReturnValue([
      {
        id: 'a-1',
        fundCode: '000001',
        fundName: '稳健成长',
        quoteUpdatedAt: '2026-04-10 10:30',
        tradingDate: '2026-04-10',
        estimatedNav: 1.01,
        finalNav: 1,
        absoluteErrorRate: 0.01,
        resolvedAt: '2026-04-10T15:30:00.000Z',
        createdAt: '2026-04-10T14:30:00.000Z',
        updatedAt: '2026-04-10T15:30:00.000Z',
      },
      {
        id: 'a-2',
        fundCode: '000001',
        fundName: '稳健成长',
        quoteUpdatedAt: '2026-04-11 13:30',
        tradingDate: '2026-04-11',
        estimatedNav: 1.02,
        finalNav: null,
        absoluteErrorRate: null,
        resolvedAt: null,
        createdAt: '2026-04-11T14:30:00.000Z',
        updatedAt: '2026-04-11T14:30:00.000Z',
      },
      {
        id: 'b-1',
        fundCode: '000002',
        fundName: '科技先锋',
        quoteUpdatedAt: '2026-04-10 14:45',
        tradingDate: '2026-04-10',
        estimatedNav: 1.03,
        finalNav: 1,
        absoluteErrorRate: 0.03,
        resolvedAt: '2026-04-10T15:30:00.000Z',
        createdAt: '2026-04-10T14:30:00.000Z',
        updatedAt: '2026-04-10T15:30:00.000Z',
      },
      {
        id: 'b-2',
        fundCode: '000002',
        fundName: '科技先锋',
        quoteUpdatedAt: '2026-04-11T08:05:00.000Z',
        tradingDate: '2026-04-11',
        estimatedNav: 1.01,
        finalNav: 1,
        absoluteErrorRate: 0.01,
        resolvedAt: '2026-04-11T15:30:00.000Z',
        createdAt: '2026-04-11T14:30:00.000Z',
        updatedAt: '2026-04-11T15:30:00.000Z',
      },
      {
        id: 'c-1',
        fundCode: '000003',
        fundName: '低波红利',
        quoteUpdatedAt: '2026-04-12 11:00',
        tradingDate: '2026-04-12',
        estimatedNav: 1,
        finalNav: null,
        absoluteErrorRate: null,
        resolvedAt: null,
        createdAt: '2026-04-12T14:30:00.000Z',
        updatedAt: '2026-04-12T14:30:00.000Z',
      },
    ]);

    render(<AccuracyDashboard />);

    await waitFor(() => {
      expect(screen.getByText('估值准确度看板')).toBeTruthy();
      const totalCard = screen.getByText('总样本').closest('article');
      const resolvedCard = screen.getByText('已收敛样本').closest('article');
      const averageCard = screen.getByTestId('accuracy-summary-average');
      expect(totalCard).not.toBeNull();
      expect(resolvedCard).not.toBeNull();
      expect(averageCard).not.toBeNull();
      expect(within(totalCard as HTMLElement).getByText('5')).toBeTruthy();
      expect(within(resolvedCard as HTMLElement).getByText('3')).toBeTruthy();
      expect(within(averageCard as HTMLElement).getByText('1.67%')).toBeTruthy();

      const unresolvedCard = screen.getByText('未收敛样本').closest('article');
      expect(unresolvedCard).not.toBeNull();
      expect(within(unresolvedCard as HTMLElement).getByText('2')).toBeTruthy();
    });

    const fundRows = screen.getAllByTestId('accuracy-fund-row');
    expect(fundRows).toHaveLength(3);

    expect(within(fundRows[0]).getByText('000002')).toBeTruthy();
    expect(within(fundRows[0]).getByText('科技先锋')).toBeTruthy();
    expect(within(fundRows[0]).getByText('2 / 2')).toBeTruthy();
    expect(within(fundRows[0]).getByText('2.00%')).toBeTruthy();

    expect(within(fundRows[1]).getByText('000001')).toBeTruthy();
    expect(within(fundRows[1]).getByText('稳健成长')).toBeTruthy();
    expect(within(fundRows[1]).getByText('1 / 2')).toBeTruthy();
    expect(within(fundRows[1]).getByText('1.00%')).toBeTruthy();

    expect(within(fundRows[2]).getByText('000003')).toBeTruthy();
    expect(within(fundRows[2]).getByText('低波红利')).toBeTruthy();
    expect(within(fundRows[2]).getByText('0 / 1')).toBeTruthy();
    expect(within(fundRows[2]).getByText('样本不足')).toBeTruthy();

    const highErrorRows = screen.getAllByTestId('accuracy-high-error-row');
    expect(highErrorRows).toHaveLength(2);
    expect(within(highErrorRows[0]).getByText(/000002/)).toBeTruthy();
    expect(within(highErrorRows[0]).getByText('2.00%')).toBeTruthy();
    expect(within(highErrorRows[1]).getByText(/000001/)).toBeTruthy();
    expect(within(highErrorRows[1]).getByText('1.00%')).toBeTruthy();

    const distributionRows = screen.getAllByTestId('accuracy-error-bucket');
    expect(distributionRows).toHaveLength(4);
    expect(within(distributionRows[0]).getByText('≤ 0.30%')).toBeTruthy();
    expect(within(distributionRows[0]).getByText('0')).toBeTruthy();
    expect(within(distributionRows[1]).getByText('0.30% - 1.00%')).toBeTruthy();
    expect(within(distributionRows[1]).getByText('2')).toBeTruthy();
    expect(within(distributionRows[2]).getByText('1.00% - 2.00%')).toBeTruthy();
    expect(within(distributionRows[2]).getByText('0')).toBeTruthy();
    expect(within(distributionRows[3]).getByText('> 2.00%')).toBeTruthy();
    expect(within(distributionRows[3]).getByText('1')).toBeTruthy();

    const unresolvedRows = screen.getAllByTestId('accuracy-unresolved-row');
    expect(unresolvedRows).toHaveLength(2);
    expect(screen.getByText('2 条未收敛样本，涉及 2 只基金。')).toBeTruthy();
    expect(within(unresolvedRows[0]).getByText('000003')).toBeTruthy();
    expect(within(unresolvedRows[1]).getByText('000001')).toBeTruthy();

    const abnormalRows = screen.getAllByTestId('accuracy-abnormal-row');
    expect(abnormalRows).toHaveLength(3);
    expect(within(abnormalRows[0]).getByText('000002')).toBeTruthy();
    expect(within(abnormalRows[0]).getByText('连续偏差')).toBeTruthy();
    expect(within(abnormalRows[0]).getByText('高误差')).toBeTruthy();
    expect(within(abnormalRows[1]).getByText('000001')).toBeTruthy();
    expect(within(abnormalRows[1]).getByText('未收敛')).toBeTruthy();
    expect(within(abnormalRows[2]).getByText('000003')).toBeTruthy();
    expect(within(abnormalRows[2]).getByText('未收敛')).toBeTruthy();

    const diagnosticRows = screen.getAllByTestId('accuracy-diagnostic-row');
    expect(diagnosticRows).toHaveLength(3);
    expect(within(diagnosticRows[0]).getByText(/000002/)).toBeTruthy();
    expect(within(diagnosticRows[0]).getByText('持续偏高')).toBeTruthy();
    expect(within(diagnosticRows[0]).getByText('最高优先')).toBeTruthy();
    expect(within(diagnosticRows[1]).getByText(/000001/)).toBeTruthy();
    expect(within(diagnosticRows[1]).getAllByText('样本不足').length).toBeGreaterThan(0);
    expect(within(diagnosticRows[2]).getByText(/000003/)).toBeTruthy();
    expect(within(diagnosticRows[2]).getAllByText('样本不足').length).toBeGreaterThan(0);

    const timeBucketRows = screen.getAllByTestId('accuracy-time-bucket-row');
    expect(timeBucketRows).toHaveLength(4);
    expect(within(timeBucketRows[0]).getByText('盘前 / 上午')).toBeTruthy();
    expect(within(timeBucketRows[0]).getByText('1')).toBeTruthy();
    expect(within(timeBucketRows[1]).getByText('午后')).toBeTruthy();
    expect(within(timeBucketRows[1]).getByText('0')).toBeTruthy();
    expect(within(timeBucketRows[2]).getByText('尾盘')).toBeTruthy();
    expect(within(timeBucketRows[2]).getByText('1')).toBeTruthy();
    expect(within(timeBucketRows[3]).getByText('收盘后')).toBeTruthy();
    expect(within(timeBucketRows[3]).getByText('1')).toBeTruthy();

    const trendRows = screen.getAllByTestId('accuracy-trend-row');
    expect(trendRows).toHaveLength(2);
    expect(within(trendRows[0]).getByText('2026-04-11')).toBeTruthy();
    expect(within(trendRows[0]).getAllByText('1').length).toBeGreaterThan(0);
    expect(within(trendRows[1]).getByText('2026-04-10')).toBeTruthy();
    expect(within(trendRows[1]).getByText('2.00%')).toBeTruthy();

    const recommendationRows = screen.getAllByTestId('accuracy-recommendation-row');
    expect(recommendationRows).toHaveLength(3);
    expect(within(recommendationRows[0]).getByText('000002')).toBeTruthy();
    expect(within(recommendationRows[0]).getByText('优先校正高估偏差')).toBeTruthy();
    expect(within(recommendationRows[1]).getByText('000001')).toBeTruthy();
    expect(within(recommendationRows[1]).getByText('先补充收敛样本')).toBeTruthy();

    const sourceCards = screen.getAllByTestId('accuracy-source-model-card');
    expect(sourceCards).toHaveLength(4);
    expect(within(sourceCards[0]).getByText('主导偏差类型')).toBeTruthy();
    expect(within(sourceCards[0]).getByText('持续偏高主导')).toBeTruthy();
    expect(within(sourceCards[1]).getByText('最高风险时段')).toBeTruthy();
    expect(within(sourceCards[1]).getByText('尾盘')).toBeTruthy();
    expect(within(sourceCards[2]).getByText('最高风险交易日')).toBeTruthy();
    expect(within(sourceCards[2]).getByText('2026-04-10')).toBeTruthy();
    expect(within(sourceCards[3]).getByText('收敛压力')).toBeTruthy();
    expect(within(sourceCards[3]).getByText('40%')).toBeTruthy();

    const strategyRows = screen.getAllByTestId('accuracy-strategy-row');
    expect(strategyRows).toHaveLength(3);
    expect(within(strategyRows[0]).getByText('先修系统性高估')).toBeTruthy();
    expect(within(strategyRows[1]).getByText('重点优化尾盘链路')).toBeTruthy();
    expect(within(strategyRows[2]).getByText('继续补齐收敛样本')).toBeTruthy();

    const adjustmentSummaryCards = screen.getAllByTestId('accuracy-adjustment-summary-card');
    expect(adjustmentSummaryCards).toHaveLength(4);
    expect(within(adjustmentSummaryCards[0]).getByText('修正前平均误差')).toBeTruthy();
    expect(within(adjustmentSummaryCards[0]).getByText('1.67%')).toBeTruthy();
    expect(within(adjustmentSummaryCards[1]).getByText('最佳实验方案')).toBeTruthy();
    expect(within(adjustmentSummaryCards[1]).getByText('尾盘 / 收盘后专用修正')).toBeTruthy();
    expect(within(adjustmentSummaryCards[2]).getByText('修正后平均误差')).toBeTruthy();
    expect(within(adjustmentSummaryCards[2]).getByText('0.33%')).toBeTruthy();
    expect(within(adjustmentSummaryCards[3]).getByText('相对改善')).toBeTruthy();
    expect(within(adjustmentSummaryCards[3]).getByText('80%')).toBeTruthy();

    const adjustmentRows = screen.getAllByTestId('accuracy-adjustment-row');
    expect(adjustmentRows).toHaveLength(3);
    expect(within(adjustmentRows[0]).getByText('全局签名修正')).toBeTruthy();
    expect(within(adjustmentRows[0]).getByText('0.87%')).toBeTruthy();
    expect(within(adjustmentRows[1]).getByText('尾盘 / 收盘后专用修正')).toBeTruthy();
    expect(within(adjustmentRows[1]).getByText('0.33%')).toBeTruthy();
    expect(within(adjustmentRows[2]).getByText('诊断 + 尾盘联动修正')).toBeTruthy();
    expect(within(adjustmentRows[2]).getByText('0.55%')).toBeTruthy();

    const adjustmentBucketRows = screen.getAllByTestId('accuracy-adjustment-bucket-row');
    expect(adjustmentBucketRows).toHaveLength(4);
    expect(within(adjustmentBucketRows[0]).getByText('盘前 / 上午')).toBeTruthy();
    expect(adjustmentBucketRows[0].textContent).toContain('全局签名修正');
    expect(within(adjustmentBucketRows[0]).getByText('1.00%')).toBeTruthy();
    expect(within(adjustmentBucketRows[0]).getByText('0.66%')).toBeTruthy();
    expect(within(adjustmentBucketRows[0]).getByText('34%')).toBeTruthy();
    expect(within(adjustmentBucketRows[1]).getByText('午后')).toBeTruthy();
    expect(within(adjustmentBucketRows[1]).getAllByText('样本不足').length).toBeGreaterThan(0);
    expect(within(adjustmentBucketRows[2]).getByText('尾盘')).toBeTruthy();
    expect(adjustmentBucketRows[2].textContent).toContain('尾盘 / 收盘后专用修正');
    expect(within(adjustmentBucketRows[2]).getByText('3.00%')).toBeTruthy();
    expect(within(adjustmentBucketRows[2]).getByText('0.00%')).toBeTruthy();
    expect(within(adjustmentBucketRows[2]).getByText('100%')).toBeTruthy();
    expect(within(adjustmentBucketRows[3]).getByText('收盘后')).toBeTruthy();
    expect(adjustmentBucketRows[3].textContent).toContain('尾盘 / 收盘后专用修正');
    expect(within(adjustmentBucketRows[3]).getByText('1.00%')).toBeTruthy();
    expect(within(adjustmentBucketRows[3]).getByText('0.00%')).toBeTruthy();
    expect(within(adjustmentBucketRows[3]).getByText('100%')).toBeTruthy();

    const adjustmentDiagnosisRows = screen.getAllByTestId('accuracy-adjustment-diagnosis-row');
    expect(adjustmentDiagnosisRows).toHaveLength(4);
    expect(within(adjustmentDiagnosisRows[0]).getByText('持续偏高')).toBeTruthy();
    expect(adjustmentDiagnosisRows[0].textContent).toContain('尾盘 / 收盘后专用修正');
    expect(within(adjustmentDiagnosisRows[0]).getByText('2.00%')).toBeTruthy();
    expect(within(adjustmentDiagnosisRows[0]).getByText('0.00%')).toBeTruthy();
    expect(within(adjustmentDiagnosisRows[0]).getByText('100%')).toBeTruthy();
    expect(within(adjustmentDiagnosisRows[1]).getByText('持续偏低')).toBeTruthy();
    expect(within(adjustmentDiagnosisRows[1]).getAllByText('样本不足').length).toBeGreaterThan(0);
    expect(within(adjustmentDiagnosisRows[2]).getByText('波动偏差')).toBeTruthy();
    expect(within(adjustmentDiagnosisRows[2]).getAllByText('样本不足').length).toBeGreaterThan(0);
    expect(within(adjustmentDiagnosisRows[3]).getByText('样本不足')).toBeTruthy();
    expect(adjustmentDiagnosisRows[3].textContent).toContain('全局签名修正');
    expect(within(adjustmentDiagnosisRows[3]).getByText('1.00%')).toBeTruthy();
    expect(within(adjustmentDiagnosisRows[3]).getByText('0.66%')).toBeTruthy();
    expect(within(adjustmentDiagnosisRows[3]).getByText('34%')).toBeTruthy();

    const adjustmentFundRows = screen.getAllByTestId('accuracy-adjustment-fund-row');
    expect(adjustmentFundRows).toHaveLength(2);
    expect(within(adjustmentFundRows[0]).getByText('科技先锋')).toBeTruthy();
    expect(within(adjustmentFundRows[0]).getByText('000002')).toBeTruthy();
    expect(within(adjustmentFundRows[0]).getByText('持续偏高')).toBeTruthy();
    expect(within(adjustmentFundRows[0]).getByText('优先验证')).toBeTruthy();
    expect(adjustmentFundRows[0].textContent).toContain('尾盘 / 收盘后专用修正');
    expect(within(adjustmentFundRows[0]).getByText('2.00%')).toBeTruthy();
    expect(within(adjustmentFundRows[0]).getByText('0.00%')).toBeTruthy();
    expect(within(adjustmentFundRows[0]).getByText('100%')).toBeTruthy();
    expect(within(adjustmentFundRows[1]).getByText('稳健成长')).toBeTruthy();
    expect(within(adjustmentFundRows[1]).getByText('000001')).toBeTruthy();
    expect(within(adjustmentFundRows[1]).getByText('样本不足')).toBeTruthy();
    expect(within(adjustmentFundRows[1]).getByText('继续收集样本')).toBeTruthy();
    expect(adjustmentFundRows[1].textContent).toContain('全局签名修正');
    expect(within(adjustmentFundRows[1]).getByText('1.00%')).toBeTruthy();
    expect(within(adjustmentFundRows[1]).getByText('0.66%')).toBeTruthy();
    expect(within(adjustmentFundRows[1]).getByText('34%')).toBeTruthy();

  });

  it('shows adjusted-vs-raw validation feedback for validated funds', async () => {
    mockLoadEstimateAccuracySnapshots.mockReturnValue([
      {
        id: 'a-1',
        fundCode: '000001',
        fundName: '偏高基金',
        quoteUpdatedAt: '2026-04-10 14:30',
        tradingDate: '2026-04-10',
        estimatedNav: 1.04,
        finalNav: 1,
        absoluteErrorRate: 0.04,
        resolvedAt: '2026-04-10T15:30:00.000Z',
        createdAt: '2026-04-10T14:30:00.000Z',
        updatedAt: '2026-04-10T15:30:00.000Z',
      },
      {
        id: 'a-2',
        fundCode: '000001',
        fundName: '偏高基金',
        quoteUpdatedAt: '2026-04-11 15:10',
        tradingDate: '2026-04-11',
        estimatedNav: 1.02,
        finalNav: 1,
        absoluteErrorRate: 0.02,
        resolvedAt: '2026-04-11T16:00:00.000Z',
        createdAt: '2026-04-11T15:10:00.000Z',
        updatedAt: '2026-04-11T16:00:00.000Z',
      },
      {
        id: 'b-1',
        fundCode: '000002',
        fundName: '观察基金',
        quoteUpdatedAt: '2026-04-10 10:30',
        tradingDate: '2026-04-10',
        estimatedNav: 1.01,
        finalNav: 1,
        absoluteErrorRate: 0.01,
        resolvedAt: '2026-04-10T15:30:00.000Z',
        createdAt: '2026-04-10T10:30:00.000Z',
        updatedAt: '2026-04-10T15:30:00.000Z',
      },
      {
        id: 'c-1',
        fundCode: '000003',
        fundName: '冷却基金',
        quoteUpdatedAt: '2026-04-10 15:05',
        tradingDate: '2026-04-10',
        estimatedNav: 0.98,
        finalNav: 1,
        absoluteErrorRate: 0.02,
        resolvedAt: '2026-04-10T16:00:00.000Z',
        createdAt: '2026-04-10T15:05:00.000Z',
        updatedAt: '2026-04-10T16:00:00.000Z',
      },
    ]);
    window.localStorage.setItem(
      'super-finance-adjustment-fund-decisions',
      JSON.stringify({
        '000001': {
          status: 'validated',
          updatedAt: '2026-04-14T09:00:00.000Z',
          history: [{ status: 'validated', updatedAt: '2026-04-14T09:00:00.000Z' }],
        },
        '000002': {
          status: 'watch',
          updatedAt: '2026-04-14T09:00:00.000Z',
          history: [{ status: 'watch', updatedAt: '2026-04-14T09:00:00.000Z' }],
        },
      }),
    );

    render(<AccuracyDashboard />);

    await waitFor(() => {
      expect(screen.getByText('修正效果回写验证')).toBeTruthy();
    });

    const validationCards = screen.getAllByTestId('accuracy-adjustment-validation-summary-card');
    expect(validationCards).toHaveLength(4);
    expect(within(validationCards[0]).getByText('已验证基金')).toBeTruthy();
    expect(within(validationCards[0]).getByText('1')).toBeTruthy();
    expect(within(validationCards[1]).getByText('回写样本')).toBeTruthy();
    expect(within(validationCards[1]).getByText('2')).toBeTruthy();
    expect(within(validationCards[2]).getByText('修正前 / 后')).toBeTruthy();
    expect(within(validationCards[2]).getByText('3.00% → 0.49%')).toBeTruthy();
    expect(within(validationCards[3]).getByText('净改善')).toBeTruthy();
    expect(within(validationCards[3]).getByText('84%')).toBeTruthy();

    const validationRows = screen.getAllByTestId('accuracy-adjustment-validation-fund-row');
    expect(validationRows).toHaveLength(1);
    expect(within(validationRows[0]).getByText('偏高基金')).toBeTruthy();
    expect(within(validationRows[0]).getByText('继续保持')).toBeTruthy();
    expect(within(validationRows[0]).getByText('2 / 2')).toBeTruthy();
    expect(within(validationRows[0]).getByText('3.00%')).toBeTruthy();
    expect(within(validationRows[0]).getByText('0.49%')).toBeTruthy();
  });

  it('refreshes when the estimate accuracy storage update event fires', async () => {
    let snapshots: EstimateAccuracySnapshot[] = [];
    mockLoadEstimateAccuracySnapshots.mockImplementation(() => snapshots);

    render(<AccuracyDashboard />);

    await waitFor(() => {
      expect(screen.getByText('暂无估值准确度样本')).toBeTruthy();
      const totalCard = screen.getByText('总样本').closest('article');
      const resolvedCard = screen.getByText('已收敛样本').closest('article');
      const unresolvedCard = screen.getByText('未收敛样本').closest('article');
      expect(totalCard).not.toBeNull();
      expect(resolvedCard).not.toBeNull();
      expect(unresolvedCard).not.toBeNull();
      expect(within(totalCard as HTMLElement).getByText('0')).toBeTruthy();
      expect(within(resolvedCard as HTMLElement).getByText('0')).toBeTruthy();
      expect(within(unresolvedCard as HTMLElement).getByText('0')).toBeTruthy();
    });

    snapshots = [
      {
        id: 'a-1',
        fundCode: '000001',
        fundName: '稳健成长',
        quoteUpdatedAt: '2026-04-10 14:30',
        tradingDate: '2026-04-10',
        estimatedNav: 1.005,
        finalNav: 1,
        absoluteErrorRate: 0.005,
        resolvedAt: '2026-04-10T15:30:00.000Z',
        createdAt: '2026-04-10T14:30:00.000Z',
        updatedAt: '2026-04-10T15:30:00.000Z',
      },
    ];

    window.dispatchEvent(new CustomEvent('super-finance-estimate-accuracy-updated'));

    await waitFor(() => {
      expect(screen.queryByText('暂无估值准确度样本')).toBeNull();
      expect(screen.getAllByText('0.50%')).toHaveLength(12);
      expect(screen.getAllByText('000001').length).toBeGreaterThan(0);
      expect(screen.getAllByTestId('accuracy-fund-row')).toHaveLength(1);
    });
  });

  it('shows an empty state when there are no abnormal funds to investigate', async () => {
    mockLoadEstimateAccuracySnapshots.mockReturnValue([
      {
        id: 'safe-1',
        fundCode: '000010',
        fundName: '正常基金',
        quoteUpdatedAt: '2026-04-10 10:30',
        tradingDate: '2026-04-10',
        estimatedNav: 1.004,
        finalNav: 1,
        absoluteErrorRate: 0.004,
        resolvedAt: '2026-04-10T15:30:00.000Z',
        createdAt: '2026-04-10T10:30:00.000Z',
        updatedAt: '2026-04-10T15:30:00.000Z',
      },
      {
        id: 'safe-2',
        fundCode: '000010',
        fundName: '正常基金',
        quoteUpdatedAt: '2026-04-11 10:30',
        tradingDate: '2026-04-11',
        estimatedNav: 0.996,
        finalNav: 1,
        absoluteErrorRate: 0.004,
        resolvedAt: '2026-04-11T15:30:00.000Z',
        createdAt: '2026-04-11T10:30:00.000Z',
        updatedAt: '2026-04-11T15:30:00.000Z',
      },
    ]);

    render(<AccuracyDashboard />);

    await waitFor(() => {
      expect(screen.getByText('暂无需要优先排查的异常基金')).toBeTruthy();
    });
  });

  it('refreshes from storage events and ignores unrelated storage keys', async () => {
    let snapshots: EstimateAccuracySnapshot[] = [];
    mockLoadEstimateAccuracySnapshots.mockImplementation(() => snapshots);

    render(<AccuracyDashboard />);

    await waitFor(() => {
      expect(screen.getByText('暂无估值准确度样本')).toBeTruthy();
    });

    snapshots = [
      {
        id: 'storage-1',
        fundCode: '000004',
        fundName: '跨标签基金',
        quoteUpdatedAt: '2026-04-10 14:30',
        tradingDate: '2026-04-10',
        estimatedNav: 1.01,
        finalNav: 1,
        absoluteErrorRate: 0.01,
        resolvedAt: '2026-04-10T15:30:00.000Z',
        createdAt: '2026-04-10T14:30:00.000Z',
        updatedAt: '2026-04-10T15:30:00.000Z',
      },
    ];

    window.dispatchEvent(new StorageEvent('storage', { key: 'other-key' }));
    expect(screen.queryByText('000004')).toBeNull();

    window.dispatchEvent(
      new StorageEvent('storage', { key: 'super-finance-estimate-accuracy' }),
    );

    await waitFor(() => {
      expect(screen.getAllByText('000004').length).toBeGreaterThan(0);
      expect(screen.getAllByText('1.00%')).toHaveLength(12);
    });
  });

  it('counts resolved final nav samples even when the error rate is not computable', async () => {
    mockLoadEstimateAccuracySnapshots.mockReturnValue([
      {
        id: 'zero-final-nav',
        fundCode: '000005',
        fundName: '零净值样本',
        quoteUpdatedAt: '2026-04-10 14:30',
        tradingDate: '2026-04-10',
        estimatedNav: 1.01,
        finalNav: 0,
        absoluteErrorRate: null,
        resolvedAt: '2026-04-10T15:30:00.000Z',
        createdAt: '2026-04-10T14:30:00.000Z',
        updatedAt: '2026-04-10T15:30:00.000Z',
      },
    ]);

    render(<AccuracyDashboard />);

    await waitFor(() => {
      const resolvedCard = screen.getByText('已收敛样本').closest('article');
      expect(resolvedCard).not.toBeNull();
      expect(within(resolvedCard as HTMLElement).getByText('1')).toBeTruthy();

      const unresolvedCard = screen.getByText('未收敛样本').closest('article');
      expect(unresolvedCard).not.toBeNull();
      expect(within(unresolvedCard as HTMLElement).getByText('0')).toBeTruthy();

      const row = screen.getByTestId('accuracy-fund-row');
      expect(within(row).getByText('1 / 1')).toBeTruthy();
      expect(within(row).getByText('样本不足')).toBeTruthy();

      expect(screen.getByText('暂无未收敛样本')).toBeTruthy();
    });
  });

  it('sorts equal-error funds by code and keeps unresolved funds last', async () => {
    mockLoadEstimateAccuracySnapshots.mockReturnValue([
      {
        id: 'tie-b',
        fundCode: '000003',
        fundName: '同误差B',
        quoteUpdatedAt: '2026-04-10 14:30',
        tradingDate: '2026-04-10',
        estimatedNav: 1.01,
        finalNav: 1,
        absoluteErrorRate: 0.01,
        resolvedAt: '2026-04-10T15:30:00.000Z',
        createdAt: '2026-04-10T14:30:00.000Z',
        updatedAt: '2026-04-10T15:30:00.000Z',
      },
      {
        id: 'unresolved',
        fundCode: '000002',
        fundName: '未收敛',
        quoteUpdatedAt: '2026-04-10 14:30',
        tradingDate: '2026-04-10',
        estimatedNav: 1.01,
        finalNav: null,
        absoluteErrorRate: null,
        resolvedAt: null,
        createdAt: '2026-04-10T14:30:00.000Z',
        updatedAt: '2026-04-10T14:30:00.000Z',
      },
      {
        id: 'tie-a',
        fundCode: '000001',
        fundName: '同误差A',
        quoteUpdatedAt: '2026-04-10 14:30',
        tradingDate: '2026-04-10',
        estimatedNav: 1.01,
        finalNav: 1,
        absoluteErrorRate: 0.01,
        resolvedAt: '2026-04-10T15:30:00.000Z',
        createdAt: '2026-04-10T14:30:00.000Z',
        updatedAt: '2026-04-10T15:30:00.000Z',
      },
    ]);

    render(<AccuracyDashboard />);

    await waitFor(() => {
      const rows = screen.getAllByTestId('accuracy-fund-row');
      expect(rows).toHaveLength(3);
      expect(within(rows[0]).getByText('000001')).toBeTruthy();
      expect(within(rows[1]).getByText('000003')).toBeTruthy();
      expect(within(rows[2]).getByText('000002')).toBeTruthy();
    });
  });

  it('places boundary error rates into the expected distribution buckets', async () => {
    mockLoadEstimateAccuracySnapshots.mockReturnValue([
      {
        id: 'bucket-low',
        fundCode: '000101',
        fundName: '低误差',
        quoteUpdatedAt: '2026-04-10 14:30',
        tradingDate: '2026-04-10',
        estimatedNav: 1.003,
        finalNav: 1,
        absoluteErrorRate: 0.003,
        resolvedAt: '2026-04-10T15:30:00.000Z',
        createdAt: '2026-04-10T14:30:00.000Z',
        updatedAt: '2026-04-10T15:30:00.000Z',
      },
      {
        id: 'bucket-mid',
        fundCode: '000102',
        fundName: '中误差',
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
        id: 'bucket-high',
        fundCode: '000103',
        fundName: '高误差',
        quoteUpdatedAt: '2026-04-12 14:30',
        tradingDate: '2026-04-12',
        estimatedNav: 1.02,
        finalNav: 1,
        absoluteErrorRate: 0.02,
        resolvedAt: '2026-04-12T15:30:00.000Z',
        createdAt: '2026-04-12T14:30:00.000Z',
        updatedAt: '2026-04-12T15:30:00.000Z',
      },
      {
        id: 'bucket-over',
        fundCode: '000104',
        fundName: '超高误差',
        quoteUpdatedAt: '2026-04-13 14:30',
        tradingDate: '2026-04-13',
        estimatedNav: 1.021,
        finalNav: 1,
        absoluteErrorRate: 0.021,
        resolvedAt: '2026-04-13T15:30:00.000Z',
        createdAt: '2026-04-13T14:30:00.000Z',
        updatedAt: '2026-04-13T15:30:00.000Z',
      },
    ]);

    render(<AccuracyDashboard />);

    await waitFor(() => {
      const distributionRows = screen.getAllByTestId('accuracy-error-bucket');
      expect(within(distributionRows[0]).getByText('1')).toBeTruthy();
      expect(within(distributionRows[1]).getByText('1')).toBeTruthy();
      expect(within(distributionRows[2]).getByText('1')).toBeTruthy();
      expect(within(distributionRows[3]).getByText('1')).toBeTruthy();
    });
  });

  it('shows fund-level adjustment drilldown details when a candidate is expanded', async () => {
    mockLoadEstimateAccuracySnapshots.mockReturnValue([
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
    ]);

    render(<AccuracyDashboard />);

    await waitFor(() => {
      expect(screen.getAllByTestId('accuracy-adjustment-fund-row')).toHaveLength(2);
    });

    fireEvent.click(screen.getByTestId('accuracy-adjustment-fund-toggle-000010'));

    const detail = screen.getByTestId('accuracy-adjustment-fund-detail-000010');
    expect(within(detail).getByText('建议依据')).toBeTruthy();
    expect(within(detail).getByText(/建议原因：模拟改善明显，适合优先进入基金级修正验证。/)).toBeTruthy();
    expect(within(detail).getByText('时段分布')).toBeTruthy();
    const bucketRows = within(detail).getAllByTestId('accuracy-adjustment-fund-bucket-row-000010');
    expect(bucketRows).toHaveLength(1);
    expect(within(bucketRows[0]).getByText('尾盘')).toBeTruthy();
    expect(within(detail).getByText('修正规则草案')).toBeTruthy();
    expect(within(detail).getByText('尾盘增强修正草案')).toBeTruthy();
    expect(within(detail).getByText(/仅对尾盘与收盘后估值启用附加修正/)).toBeTruthy();
    expect(within(detail).getByText('上线前验证清单')).toBeTruthy();
    expect(
      within(detail).getByText(/灰度验证尾盘 \/ 收盘后链路，确认盘末样本仍稳定优于基线。/),
    ).toBeTruthy();
    expect(within(detail).getByText('样本明细')).toBeTruthy();
    const sampleRows = within(detail).getAllByTestId('accuracy-adjustment-fund-sample-row-000010');
    expect(sampleRows).toHaveLength(2);
    expect(within(sampleRows[0]).getByText('2026-04-11')).toBeTruthy();
    expect(within(sampleRows[1]).getByText('2026-04-10')).toBeTruthy();

    fireEvent.click(screen.getByTestId('accuracy-adjustment-fund-toggle-000010'));
    expect(screen.queryByTestId('accuracy-adjustment-fund-detail-000010')).toBeNull();
  });

  it('persists manual adjustment decisions and shows them in the execution list', async () => {
    mockLoadEstimateAccuracySnapshots.mockReturnValue([
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
    ]);

    const view = render(<AccuracyDashboard />);

    await waitFor(() => {
      expect(screen.getAllByTestId('accuracy-adjustment-fund-row')).toHaveLength(1);
    });

    fireEvent.click(screen.getByTestId('accuracy-adjustment-fund-toggle-000010'));
    fireEvent.click(screen.getByTestId('accuracy-adjustment-decision-verification-000010'));

    const executionRows = screen.getAllByTestId('accuracy-adjustment-decision-row');
    expect(executionRows).toHaveLength(1);
    expect(within(executionRows[0]).getByText('优先修正基金')).toBeTruthy();
    expect(within(executionRows[0]).getAllByText('加入验证').length).toBeGreaterThan(0);

    view.unmount();
    render(<AccuracyDashboard />);

    await waitFor(() => {
      expect(screen.getAllByTestId('accuracy-adjustment-decision-row')).toHaveLength(1);
    });

    const persistedRows = screen.getAllByTestId('accuracy-adjustment-decision-row');
    expect(within(persistedRows[0]).getByText('优先修正基金')).toBeTruthy();
    expect(within(persistedRows[0]).getAllByText('加入验证').length).toBeGreaterThan(0);
  });

  it('writes manual adjustment decisions through the auth accuracy store', async () => {
    mockLoadEstimateAccuracySnapshots.mockReturnValue([
      {
        id: 'store-1',
        fundCode: '000010',
        fundName: '高偏差基金',
        quoteUpdatedAt: '2026-04-10 14:30',
        tradingDate: '2026-04-10',
        estimatedNav: 1.03,
        finalNav: 1,
        absoluteErrorRate: 0.03,
        resolvedAt: '2026-04-10T15:30:00.000Z',
        createdAt: '2026-04-10T14:30:00.000Z',
        updatedAt: '2026-04-10T15:30:00.000Z',
      },
      {
        id: 'store-2',
        fundCode: '000010',
        fundName: '高偏差基金',
        quoteUpdatedAt: '2026-04-11 14:30',
        tradingDate: '2026-04-11',
        estimatedNav: 1.02,
        finalNav: 1,
        absoluteErrorRate: 0.02,
        resolvedAt: '2026-04-11T15:30:00.000Z',
        createdAt: '2026-04-11T14:30:00.000Z',
        updatedAt: '2026-04-11T15:30:00.000Z',
      },
    ]);

    render(<AccuracyDashboard />);

    await waitFor(() => {
      expect(screen.getAllByTestId('accuracy-adjustment-fund-row')).toHaveLength(1);
    });

    fireEvent.click(screen.getByTestId('accuracy-adjustment-fund-toggle-000010'));
    fireEvent.click(screen.getByTestId('accuracy-adjustment-decision-watch-000010'));

    expect(mockSaveAdjustmentDecisions).toHaveBeenCalled();
  });

  it('filters execution items and jumps back to the related fund detail', async () => {
    mockLoadEstimateAccuracySnapshots.mockReturnValue([
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
    ]);

    window.localStorage.setItem(
      'super-finance-adjustment-fund-decisions',
      JSON.stringify({
        '000010': { status: 'verification', updatedAt: '2026-04-15T08:00:00.000Z' },
        '000020': { status: 'watch', updatedAt: '2026-04-15T09:00:00.000Z' },
      }),
    );

    render(<AccuracyDashboard />);

    await waitFor(() => {
      expect(screen.getAllByTestId('accuracy-adjustment-decision-row')).toHaveLength(2);
    });

    let executionRows = screen.getAllByTestId('accuracy-adjustment-decision-row');
    expect(within(executionRows[0]).getByText('优先修正基金')).toBeTruthy();
    expect(within(executionRows[0]).getAllByText('P0').length).toBeGreaterThan(0);
    expect(within(executionRows[0]).getByText('2026-04-15 16:00')).toBeTruthy();

    fireEvent.click(screen.getByTestId('accuracy-adjustment-execution-filter-watch'));

    executionRows = screen.getAllByTestId('accuracy-adjustment-decision-row');
    expect(executionRows).toHaveLength(1);
    expect(within(executionRows[0]).getByText('观察基金')).toBeTruthy();

    fireEvent.click(screen.getByTestId('accuracy-adjustment-execution-open-000020'));

    const detail = screen.getByTestId('accuracy-adjustment-fund-detail-000020');
    expect(within(detail).getByText('建议依据')).toBeTruthy();
    expect(within(detail).getByText(/建议动作：继续收集样本|建议动作：暂不建议修正|建议动作：优先验证/)).toBeTruthy();
  });

  it('closes execution items and records decision history', async () => {
    mockLoadEstimateAccuracySnapshots.mockReturnValue([
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
    ]);

    window.localStorage.setItem(
      'super-finance-adjustment-fund-decisions',
      JSON.stringify({
        '000010': { status: 'verification', updatedAt: '2024-04-15T08:00:00.000Z' },
      }),
    );

    render(<AccuracyDashboard />);

    await waitFor(() => {
      expect(screen.getAllByTestId('accuracy-adjustment-decision-row')).toHaveLength(1);
    });

    fireEvent.click(screen.getByTestId('accuracy-adjustment-execution-complete-000010'));

    expect(screen.queryByTestId('accuracy-adjustment-decision-row')).toBeNull();

    const historyRows = screen.getAllByTestId('accuracy-adjustment-history-row');
    expect(historyRows.length).toBeGreaterThan(0);
    expect(
      historyRows.some((row) => within(row).queryByText('优先修正基金') !== null),
    ).toBeTruthy();
    expect(
      historyRows.some((row) => within(row).queryAllByText('已验证通过').length > 0),
    ).toBeTruthy();
  });

  it('re-inserts validated funds into the execution list when validation feedback suggests downgrade', async () => {
    mockLoadEstimateAccuracySnapshots.mockReturnValue([
      {
        id: 'recheck-1',
        fundCode: '000050',
        fundName: '回写复核基金',
        quoteUpdatedAt: '2026-04-10 10:30',
        tradingDate: '2026-04-10',
        estimatedNav: 1.02,
        finalNav: 1,
        absoluteErrorRate: 0.02,
        resolvedAt: '2026-04-10T15:30:00.000Z',
        createdAt: '2026-04-10T10:30:00.000Z',
        updatedAt: '2026-04-10T15:30:00.000Z',
      },
      {
        id: 'recheck-2',
        fundCode: '000050',
        fundName: '回写复核基金',
        quoteUpdatedAt: '2026-04-11 10:30',
        tradingDate: '2026-04-11',
        estimatedNav: 1.02,
        finalNav: 1,
        absoluteErrorRate: 0.02,
        resolvedAt: '2026-04-11T15:30:00.000Z',
        createdAt: '2026-04-11T10:30:00.000Z',
        updatedAt: '2026-04-11T15:30:00.000Z',
      },
      {
        id: 'recheck-3',
        fundCode: '000050',
        fundName: '回写复核基金',
        quoteUpdatedAt: '2026-04-12 10:30',
        tradingDate: '2026-04-12',
        estimatedNav: 0.99,
        finalNav: 1,
        absoluteErrorRate: 0.01,
        resolvedAt: '2026-04-12T15:30:00.000Z',
        createdAt: '2026-04-12T10:30:00.000Z',
        updatedAt: '2026-04-12T15:30:00.000Z',
      },
      {
        id: 'recheck-4',
        fundCode: '000050',
        fundName: '回写复核基金',
        quoteUpdatedAt: '2026-04-13 10:30',
        tradingDate: '2026-04-13',
        estimatedNav: 0.99,
        finalNav: 1,
        absoluteErrorRate: 0.01,
        resolvedAt: '2026-04-13T15:30:00.000Z',
        createdAt: '2026-04-13T10:30:00.000Z',
        updatedAt: '2026-04-13T15:30:00.000Z',
      },
    ]);

    window.localStorage.setItem(
      'super-finance-adjustment-fund-decisions',
      JSON.stringify({
        '000050': {
          status: 'validated',
          updatedAt: '2026-04-14T09:00:00.000Z',
          history: [{ status: 'validated', updatedAt: '2026-04-14T09:00:00.000Z' }],
        },
      }),
    );

    render(<AccuracyDashboard />);

    await waitFor(() => {
      expect(screen.getAllByTestId('accuracy-adjustment-decision-row')).toHaveLength(1);
    });

    const executionRows = screen.getAllByTestId('accuracy-adjustment-decision-row');
    expect(within(executionRows[0]).getByText('回写复核基金')).toBeTruthy();
    expect(within(executionRows[0]).getByText('建议降级观察')).toBeTruthy();
    expect(within(executionRows[0]).getByText(/最近回写样本连续恶化/)).toBeTruthy();
    expect(within(executionRows[0]).getAllByText('P0').length).toBeGreaterThan(0);
  });

  it('re-inserts validated funds into the recheck queue when validation feedback suggests review', async () => {
    mockLoadEstimateAccuracySnapshots.mockReturnValue([
      {
        id: 'review-1',
        fundCode: '000051',
        fundName: '重点复核基金',
        quoteUpdatedAt: '2026-04-10 10:30',
        tradingDate: '2026-04-10',
        estimatedNav: 1.04,
        finalNav: 1,
        absoluteErrorRate: 0.04,
        resolvedAt: '2026-04-10T15:30:00.000Z',
        createdAt: '2026-04-10T10:30:00.000Z',
        updatedAt: '2026-04-10T15:30:00.000Z',
      },
      {
        id: 'review-2',
        fundCode: '000051',
        fundName: '重点复核基金',
        quoteUpdatedAt: '2026-04-11 10:30',
        tradingDate: '2026-04-11',
        estimatedNav: 1.02,
        finalNav: 1,
        absoluteErrorRate: 0.02,
        resolvedAt: '2026-04-11T15:30:00.000Z',
        createdAt: '2026-04-11T10:30:00.000Z',
        updatedAt: '2026-04-11T15:30:00.000Z',
      },
      {
        id: 'review-3',
        fundCode: '000051',
        fundName: '重点复核基金',
        quoteUpdatedAt: '2026-04-12 10:30',
        tradingDate: '2026-04-12',
        estimatedNav: 1.01,
        finalNav: 1,
        absoluteErrorRate: 0.01,
        resolvedAt: '2026-04-12T15:30:00.000Z',
        createdAt: '2026-04-12T10:30:00.000Z',
        updatedAt: '2026-04-12T15:30:00.000Z',
      },
    ]);

    window.localStorage.setItem(
      'super-finance-adjustment-fund-decisions',
      JSON.stringify({
        '000051': {
          status: 'validated',
          updatedAt: '2026-04-14T09:00:00.000Z',
          history: [{ status: 'validated', updatedAt: '2026-04-14T09:00:00.000Z' }],
        },
      }),
    );

    render(<AccuracyDashboard />);

    await waitFor(() => {
      expect(screen.getByTestId('accuracy-adjustment-execution-filter-recheck')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('accuracy-adjustment-execution-filter-recheck'));

    await waitFor(() => {
      expect(screen.getAllByTestId('accuracy-adjustment-decision-row')).toHaveLength(1);
    });

    const executionRows = screen.getAllByTestId('accuracy-adjustment-decision-row');
    expect(within(executionRows[0]).getByText('重点复核基金')).toBeTruthy();
    expect(within(executionRows[0]).getByText('建议重点复核')).toBeTruthy();
    expect(within(executionRows[0]).getByText(/修正仍有改善/)).toBeTruthy();
    expect(within(executionRows[0]).getAllByText('P1').length).toBeGreaterThan(0);
  });

  it('filters reopened validated funds into a dedicated recheck queue', async () => {
    mockLoadEstimateAccuracySnapshots.mockReturnValue([
      {
        id: 'verify-1',
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
        id: 'verify-2',
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
        id: 'recheck-1',
        fundCode: '000050',
        fundName: '回写复核基金',
        quoteUpdatedAt: '2026-04-10 10:30',
        tradingDate: '2026-04-10',
        estimatedNav: 1.02,
        finalNav: 1,
        absoluteErrorRate: 0.02,
        resolvedAt: '2026-04-10T15:30:00.000Z',
        createdAt: '2026-04-10T10:30:00.000Z',
        updatedAt: '2026-04-10T15:30:00.000Z',
      },
      {
        id: 'recheck-2',
        fundCode: '000050',
        fundName: '回写复核基金',
        quoteUpdatedAt: '2026-04-11 10:30',
        tradingDate: '2026-04-11',
        estimatedNav: 1.02,
        finalNav: 1,
        absoluteErrorRate: 0.02,
        resolvedAt: '2026-04-11T15:30:00.000Z',
        createdAt: '2026-04-11T10:30:00.000Z',
        updatedAt: '2026-04-11T15:30:00.000Z',
      },
      {
        id: 'recheck-3',
        fundCode: '000050',
        fundName: '回写复核基金',
        quoteUpdatedAt: '2026-04-12 10:30',
        tradingDate: '2026-04-12',
        estimatedNav: 0.99,
        finalNav: 1,
        absoluteErrorRate: 0.01,
        resolvedAt: '2026-04-12T15:30:00.000Z',
        createdAt: '2026-04-12T10:30:00.000Z',
        updatedAt: '2026-04-12T15:30:00.000Z',
      },
      {
        id: 'recheck-4',
        fundCode: '000050',
        fundName: '回写复核基金',
        quoteUpdatedAt: '2026-04-13 10:30',
        tradingDate: '2026-04-13',
        estimatedNav: 0.99,
        finalNav: 1,
        absoluteErrorRate: 0.01,
        resolvedAt: '2026-04-13T15:30:00.000Z',
        createdAt: '2026-04-13T10:30:00.000Z',
        updatedAt: '2026-04-13T15:30:00.000Z',
      },
    ]);

    window.localStorage.setItem(
      'super-finance-adjustment-fund-decisions',
      JSON.stringify({
        '000010': {
          status: 'verification',
          updatedAt: '2026-04-15T08:00:00.000Z',
          history: [{ status: 'verification', updatedAt: '2026-04-15T08:00:00.000Z' }],
        },
        '000050': {
          status: 'validated',
          updatedAt: '2026-04-14T09:00:00.000Z',
          history: [{ status: 'validated', updatedAt: '2026-04-14T09:00:00.000Z' }],
        },
      }),
    );

    render(<AccuracyDashboard />);

    await waitFor(() => {
      expect(screen.getAllByTestId('accuracy-adjustment-decision-row')).toHaveLength(2);
    });

    fireEvent.click(screen.getByTestId('accuracy-adjustment-execution-filter-recheck'));

    const executionRows = screen.getAllByTestId('accuracy-adjustment-decision-row');
    expect(executionRows).toHaveLength(1);
    expect(within(executionRows[0]).getByText('回写复核基金')).toBeTruthy();
    expect(within(executionRows[0]).getByText('建议降级观察')).toBeTruthy();
    expect(within(executionRows[0]).getByText('重新确认通过')).toBeTruthy();
    expect(within(executionRows[0]).getByText('重新标记失败')).toBeTruthy();
  });

  it('filters and sorts fund-level adjustment candidates', async () => {
    mockLoadEstimateAccuracySnapshots.mockReturnValue([
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
    ]);

    render(<AccuracyDashboard />);

    await waitFor(() => {
      expect(screen.getAllByTestId('accuracy-adjustment-fund-row')).toHaveLength(2);
    });

    let fundRows = screen.getAllByTestId('accuracy-adjustment-fund-row');
    expect(within(fundRows[0]).getByText('观察基金')).toBeTruthy();
    expect(within(fundRows[1]).getByText('优先修正基金')).toBeTruthy();

    fireEvent.click(screen.getByTestId('accuracy-adjustment-filter-priority'));

    fundRows = screen.getAllByTestId('accuracy-adjustment-fund-row');
    expect(fundRows).toHaveLength(1);
    expect(within(fundRows[0]).getByText('优先修正基金')).toBeTruthy();

    fireEvent.click(screen.getByTestId('accuracy-adjustment-filter-all'));
    fireEvent.click(screen.getByTestId('accuracy-adjustment-sort-baseline'));

    fundRows = screen.getAllByTestId('accuracy-adjustment-fund-row');
    expect(within(fundRows[0]).getByText('观察基金')).toBeTruthy();
    expect(within(fundRows[1]).getByText('优先修正基金')).toBeTruthy();
  });
});
