import type { FundSearchResult } from '@/lib/funds/types';

interface FundSearchSourceItem {
  CODE?: string;
  NAME?: string;
  CATEGORY?: number;
  CATEGORYDESC?: string;
  FundBaseInfo?: {
    FTYPE?: string;
  } | null;
}

interface FundSearchSourceResponse {
  Datas?: FundSearchSourceItem[];
}

export function mapSearchResponseToFunds(response: FundSearchSourceResponse): FundSearchResult[] {
  const items = Array.isArray(response.Datas) ? response.Datas : [];

  return items
    .filter((item) => item.CATEGORY === 700 && item.CODE && item.NAME)
    .map((item) => ({
      code: item.CODE as string,
      name: item.NAME as string,
      category: item.CATEGORYDESC ?? '基金',
      fundType: item.FundBaseInfo?.FTYPE ?? '未知类型',
    }));
}

export async function fetchFundSearchResultsFromSource(query: string): Promise<FundSearchResult[]> {
  const url = `https://fundsuggest.eastmoney.com/FundSearch/api/FundSearchAPI.ashx?m=1&key=${encodeURIComponent(query)}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Failed to fetch fund search results from source');
  }

  const payload = (await response.json()) as FundSearchSourceResponse;
  return mapSearchResponseToFunds(payload);
}

export async function fetchFundSearchResults(query: string): Promise<FundSearchResult[]> {
  const params = new URLSearchParams();
  params.set('query', query);

  const response = await fetch(`/api/funds/search?${params.toString()}`);

  if (!response.ok) {
    throw new Error('Failed to fetch fund search results');
  }

  const payload = (await response.json()) as { funds?: FundSearchResult[] };

  if (!Array.isArray(payload.funds)) {
    throw new Error('Failed to fetch fund search results');
  }

  return payload.funds;
}
