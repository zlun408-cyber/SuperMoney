import type { FundTransaction, TransactionLedgerSummary } from '@/lib/funds/types';

interface PositionLot {
  shares: number;
  unitCost: number;
}

function roundTo(value: number, digits = 2) {
  return Number(value.toFixed(digits));
}

export function sortTransactionsByDate(transactions: FundTransaction[]) {
  return [...transactions].sort((left, right) => {
    const byDate = left.tradeDate.localeCompare(right.tradeDate);

    if (byDate !== 0) {
      return byDate;
    }

    return left.id.localeCompare(right.id);
  });
}

export function calculateTransactionLedgerSummary(
  transactions: FundTransaction[],
  estimatedNav?: number,
): TransactionLedgerSummary {
  const sortedTransactions = sortTransactionsByDate(transactions);
  const lots: PositionLot[] = [];
  let realizedProfit = 0;
  let totalDividends = 0;

  for (const transaction of sortedTransactions) {
    if (transaction.type === 'buy') {
      const fee = transaction.fee ?? 0;
      const shares = transaction.amount / transaction.nav;
      const totalCost = transaction.amount + fee;

      lots.push({
        shares: roundTo(shares, 6),
        unitCost: totalCost / shares,
      });
      continue;
    }

    if (transaction.type === 'reinvest_dividend') {
      const shares = transaction.amount / transaction.nav;
      totalDividends = roundTo(totalDividends + transaction.amount);

      lots.push({
        shares: roundTo(shares, 6),
        unitCost: transaction.amount / shares,
      });
      continue;
    }

    if (transaction.type === 'cash_dividend') {
      totalDividends = roundTo(totalDividends + transaction.amount);
      realizedProfit = roundTo(realizedProfit + transaction.amount);
      continue;
    }

    let remainingSharesToSell = transaction.shares;
    let costBasis = 0;

    for (const lot of lots) {
      if (remainingSharesToSell <= 0) {
        break;
      }

      if (lot.shares <= 0) {
        continue;
      }

      const consumedShares = Math.min(lot.shares, remainingSharesToSell);
      costBasis += consumedShares * lot.unitCost;
      lot.shares = roundTo(lot.shares - consumedShares, 6);
      remainingSharesToSell = roundTo(remainingSharesToSell - consumedShares, 6);
    }

    if (remainingSharesToSell > 0) {
      throw new Error('卖出份额不能大于当前可用份额');
    }

    const fee = transaction.fee ?? 0;
    const proceeds = transaction.shares * transaction.nav - fee;
    realizedProfit = roundTo(realizedProfit + (proceeds - costBasis));
  }

  const currentShares = roundTo(
    lots.reduce((total, lot) => total + lot.shares, 0),
    6,
  );
  const currentCost = roundTo(
    lots.reduce((total, lot) => total + lot.shares * lot.unitCost, 0),
  );
  const averageCost = currentShares > 0 ? Number((currentCost / currentShares).toFixed(4)) : 0;
  const currentValue =
    typeof estimatedNav === 'number' ? roundTo(estimatedNav * currentShares) : currentCost;
  const unrealizedProfit =
    typeof estimatedNav === 'number' ? roundTo(currentValue - currentCost) : 0;

  return {
    currentShares,
    currentCost,
    averageCost,
    realizedProfit,
    unrealizedProfit,
    totalDividends,
  };
}
