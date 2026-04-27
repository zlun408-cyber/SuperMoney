import type { FundCode, FundQuote } from '@/lib/funds/types';

export type FetchFundQuotes = (codes: FundCode[]) => Promise<FundQuote[]>;
export const DEFAULT_FUND_ESTIMATE_TIMEOUT_MS = 10_000;

export interface FetchFundEstimateOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface FundEstimatePayload {
  fundcode: string;
  name: string;
  jzrq: string;
  dwjz: string;
  gsz: string;
  gszzl: string;
  gztime: string;
}

export async function fetchFundQuotesFromSource(
  codes: FundCode[],
  options?: FetchFundEstimateOptions,
): Promise<FundQuote[]> {
  return await Promise.all(codes.map((code) => fetchSingleFundQuote(code, options)));
}

const createAbortError = (message: string): Error => {
  const error = new Error(message);
  error.name = 'AbortError';
  return error;
};

const createTimeoutSignal = (
  code: string,
  timeoutMs: number,
  externalSignal?: AbortSignal,
): { signal: AbortSignal; cleanup: () => void } => {
  const controller = new AbortController();
  const abort = (reason?: unknown) => {
    if (controller.signal.aborted) {
      return;
    }

    controller.abort(reason);
  };

  let handleExternalAbort: (() => void) | null = null;
  if (externalSignal) {
    if (externalSignal.aborted) {
      abort(externalSignal.reason);
    } else {
      handleExternalAbort = () => abort(externalSignal.reason);
      externalSignal.addEventListener('abort', handleExternalAbort, { once: true });
    }
  }

  const timeoutId = globalThis.setTimeout(() => {
    abort(createAbortError(`Fund estimate request timed out: ${code}`));
  }, timeoutMs);

  return {
    signal: controller.signal,
    cleanup: () => {
      globalThis.clearTimeout(timeoutId);
      if (externalSignal && handleExternalAbort) {
        externalSignal.removeEventListener('abort', handleExternalAbort);
      }
    },
  };
};

export async function fetchFundEstimateScript(
  code: string,
  options?: FetchFundEstimateOptions,
): Promise<string> {
  const url = `https://fundgz.1234567.com.cn/js/${code}.js`;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_FUND_ESTIMATE_TIMEOUT_MS;
  const { signal, cleanup } = createTimeoutSignal(code, timeoutMs, options?.signal);

  try {
    const response = await fetch(url, { signal });

    if (!response.ok) {
      throw new Error(`Failed to fetch fund estimate script: ${code}`);
    }

    return await response.text();
  } catch (error) {
    if (signal.aborted) {
      const reason = signal.reason;
      if (reason instanceof Error) {
        throw reason;
      }

      throw createAbortError(`Fund estimate request aborted: ${code}`);
    }

    throw error;
  } finally {
    cleanup();
  }
}

export interface FundHistoryNavPayload {
  fundCode: string;
  date: string;
  dwjz: string;
}

export async function fetchFundHistoryNavScript(code: string, startDate: string, endDate: string): Promise<string> {
  const url = `https://fund.eastmoney.com/f10/F10DataApi.aspx?type=lsjz&code=${code}&page=1&sdate=${startDate}&edate=${endDate}&per=20`;
  const response = await fetch(url, {
    headers: {
      Referer: `https://fundf10.eastmoney.com/jjjz_${code}.html`,
      'User-Agent': 'Mozilla/5.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch fund history nav script: ${code}`);
  }

  return await response.text();
}

export function extractHistoryNavPayload(script: string, targetDate: string): FundHistoryNavPayload | null {
  const dateRegex = new RegExp(`<td>${targetDate}</td>\\s*<td[^>]*>([^<]+)</td>`, 'i');
  const match = script.match(dateRegex);

  if (!match || !match[1]) {
    return null;
  }

  const navValue = match[1].trim();
  const nav = parseFloat(navValue);

  if (!Number.isFinite(nav)) {
    return null;
  }

  const codeMatch = script.match(/code:\s*['"](\d+)['"]/);
  const fundCode = codeMatch ? codeMatch[1] : '';

  return {
    fundCode,
    date: targetDate,
    dwjz: navValue,
  };
}

export async function fetchHistoricalNav(code: string, date: string): Promise<number | null> {
  const endDate = date;
  const startDate = date;
  
  try {
    const script = await fetchFundHistoryNavScript(code, startDate, endDate);
    const payload = extractHistoryNavPayload(script, date);
    
    if (!payload) {
      return null;
    }
    
    return parseFloat(payload.dwjz);
  } catch {
    return null;
  }
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

export async function fetchSingleFundQuote(
  code: string,
  options?: FetchFundEstimateOptions,
): Promise<FundQuote> {
  const script = await fetchFundEstimateScript(code, options);
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
