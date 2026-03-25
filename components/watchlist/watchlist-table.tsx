import React from 'react';

import { calculatePositionSummary } from '@/lib/calculations/profit-loss';
import type { FundQuote } from '@/lib/funds/types';
import type { WatchlistFund } from '@/lib/storage/watchlist-storage';

interface WatchlistTableProps {
  funds: WatchlistFund[];
  quotesByCode: Record<string, FundQuote>;
  onEditPosition: (fund: WatchlistFund) => void;
  onRemoveFund: (code: string) => void;
}

function formatPercent(value: number | undefined) {
  return typeof value === 'number' ? `${value.toFixed(2)}%` : '--';
}

function formatNumber(value: number | null | undefined) {
  return typeof value === 'number' ? value.toFixed(2) : '--';
}

export function WatchlistTable({ funds, quotesByCode, onEditPosition, onRemoveFund }: WatchlistTableProps) {
  if (funds.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
        还没有添加基金，请先添加一只基金开始监控。
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-slate-600">
          <tr>
            <th className="px-4 py-3 font-medium">基金</th>
            <th className="px-4 py-3 font-medium">代码</th>
            <th className="px-4 py-3 font-medium">当前估值</th>
            <th className="px-4 py-3 font-medium">涨跌幅</th>
            <th className="px-4 py-3 font-medium">持仓</th>
            <th className="px-4 py-3 font-medium">估算盈亏</th>
            <th className="px-4 py-3 font-medium">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {funds.map((fund) => {
            const quote = quotesByCode[fund.code];
            const summary = calculatePositionSummary({
              cost: fund.position?.cost,
              estimatedNav: quote?.estimatedNav,
              shares: fund.position?.shares,
              amount: fund.position?.amount,
            });

            return (
              <tr key={fund.code}>
                <td className="px-4 py-3 font-medium text-slate-900">{fund.name}</td>
                <td className="px-4 py-3 text-slate-600">{fund.code}</td>
                <td className="px-4 py-3 text-slate-900">{formatNumber(quote?.estimatedNav)}</td>
                <td className="px-4 py-3 text-slate-900">{formatPercent(quote?.changeRate)}</td>
                <td className="px-4 py-3 text-slate-600">
                  {fund.position?.cost && fund.position?.shares
                    ? `成本 ${formatNumber(fund.position.cost)} / 份额 ${formatNumber(fund.position.shares)}`
                    : '待填写'}
                </td>
                <td className="px-4 py-3 text-slate-900">
                  {summary.isComputable ? formatNumber(summary.profit) : '待填写'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button className="rounded-lg border border-slate-300 px-3 py-1.5" onClick={() => onEditPosition(fund)}>
                      编辑持仓
                    </button>
                    <button className="rounded-lg border border-rose-200 px-3 py-1.5 text-rose-600" onClick={() => onRemoveFund(fund.code)}>
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
