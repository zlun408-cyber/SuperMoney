export type FundCode = string;

export interface PositionInput {
  amount?: number;
  cost?: number;
  estimatedNav?: number;
  shares?: number;
}

export interface PositionSummary {
  isComputable: boolean;
  currentValue: number | null;
  profit: number | null;
}

export interface FundQuote {
  code: FundCode;
  name: string;
  estimatedNav: number;
  changeRate: number;
  updatedAt: string;
}

export interface FundSearchResult {
  code: FundCode;
  name: string;
  category: string;
  fundType: string;
}

export type FundTransactionType = 'buy' | 'sell' | 'cash_dividend' | 'reinvest_dividend';

export interface FundTransactionBase {
  id: string;
  type: FundTransactionType;
  tradeDate: string;
  note?: string;
  fee?: number;
}

export interface BuyTransaction extends FundTransactionBase {
  type: 'buy';
  amount: number;
  nav: number;
}

export interface SellTransaction extends FundTransactionBase {
  type: 'sell';
  shares: number;
  nav: number;
}

export interface CashDividendTransaction extends FundTransactionBase {
  type: 'cash_dividend';
  amount: number;
}

export interface ReinvestDividendTransaction extends FundTransactionBase {
  type: 'reinvest_dividend';
  amount: number;
  nav: number;
}

export type FundTransaction =
  | BuyTransaction
  | SellTransaction
  | CashDividendTransaction
  | ReinvestDividendTransaction;

export interface TransactionLedgerSummary {
  currentShares: number;
  currentCost: number;
  averageCost: number;
  realizedProfit: number;
  unrealizedProfit: number;
  totalDividends: number;
}
