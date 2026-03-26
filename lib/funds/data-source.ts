import type { FundCode, FundQuote } from '@/lib/funds/types';

export type FetchFundQuotes = (codes: FundCode[]) => Promise<FundQuote[]>;

export interface FundEstimatePayload {
  fundcode: string;
  name: string;
  jzrq: string;
  dwjz: string;
  gsz: string;
  gszzl: string;
  gztime: string;
}

export async function fetchFundQuotesFromSource(codes: FundCode[]): Promise<FundQuote[]> {
  return await Promise.all(codes.map((code) => fetchSingleFundQuote(code)));
}

export async function fetchFundEstimateScript(code: string): Promise<string> {
  const url = `https://fundgz.1234567.com.cn/js/${code}.js`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch fund estimate script: ${code}`);
  }

  return await response.text();
}

export function extractEstimatePayload(script: string): FundEstimatePayload {
  const match = script.match(/^jsonpgz\(([\s\S]*)\);?$/);

  if (!match || !match[1]) {
    throw new Error('Failed to extract estimate payload');
  }

  try {
    return JSON.parse(match[1]) as FundEstimatePayload;
  } catch {
    throw new Error('Failed to extract estimate payload');
  }
}

export function mapEstimatePayloadToQuote(payload: FundEstimatePayload): FundQuote {
  const estimatedNav = Number(payload.gsz);
  const changeRate = Number(payload.gszzl);

  if (!payload.fundcode || !payload.name || !payload.gztime) {
    throw new Error('Failed to map estimate payload to quote');
  }

  if (!Number.isFinite(estimatedNav) || !Number.isFinite(changeRate)) {
    throw new Error('Failed to map estimate payload to quote');
  }

  return {
    code: payload.fundcode,
    name: payload.name,
    estimatedNav,
    changeRate,
    updatedAt: payload.gztime,
  };
}

export async function fetchSingleFundQuote(code: string): Promise<FundQuote> {
  const script = await fetchFundEstimateScript(code);
  const payload = extractEstimatePayload(script);

  return mapEstimatePayloadToQuote(payload);
}

export const fetchFundQuotes: FetchFundQuotes = async (codes) => {
  if (codes.length === 0) {
    return [];
  }

  const params = new URLSearchParams();
  params.set('codes', codes.join(','));

  const response = await fetch(`/api/funds/quote?${params.toString()}`);

  if (!response.ok) {
    throw new Error('Failed to fetch fund quotes');
  }

  const payload = (await response.json()) as { quotes?: FundQuote[] };

  if (!Array.isArray(payload.quotes)) {
    throw new Error('Failed to fetch fund quotes');
  }

  return payload.quotes;
};
