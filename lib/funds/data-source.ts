import type { FundCode, FundQuote } from '@/lib/funds/types';

export type FetchFundQuotes = (codes: FundCode[]) => Promise<FundQuote[]>;

export const fetchFundQuotes: FetchFundQuotes = async (_codes) => {
  return [];
};
