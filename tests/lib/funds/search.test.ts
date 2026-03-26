import { afterEach, describe, expect, it, vi } from 'vitest';

import * as search from '@/lib/funds/search';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fund search', () => {
  describe('mapSearchResponseToFunds', () => {
    it('keeps only fund results and maps code and name', () => {
      const results = search.mapSearchResponseToFunds({
        Datas: [
          {
            CODE: '161725',
            NAME: '招商中证白酒指数(LOF)A',
            CATEGORY: 700,
            CATEGORYDESC: '基金',
            FundBaseInfo: {
              FTYPE: '指数型-股票',
            },
          },
          {
            CODE: '399997',
            NAME: '中证白酒',
            CATEGORY: 600,
            CATEGORYDESC: '指数',
            FundBaseInfo: null,
          },
        ],
      });

      expect(results).toEqual([
        {
          code: '161725',
          name: '招商中证白酒指数(LOF)A',
          category: '基金',
          fundType: '指数型-股票',
        },
      ]);
    });
  });

  describe('fetchFundSearchResultsFromSource', () => {
    it('fetches search results from the live source format', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            Datas: [
              {
                CODE: '588350',
                NAME: '鹏扬中证科创创业50ETF',
                CATEGORY: 700,
                CATEGORYDESC: '基金',
                FundBaseInfo: {
                  FTYPE: '指数型-股票',
                },
              },
            ],
          }),
        }),
      );

      const results = await search.fetchFundSearchResultsFromSource('588350');

      expect(results).toEqual([
        {
          code: '588350',
          name: '鹏扬中证科创创业50ETF',
          category: '基金',
          fundType: '指数型-股票',
        },
      ]);
    });
  });

  describe('fetchFundSearchResults', () => {
    it('fetches search results from the local api route', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            funds: [
              {
                code: '588350',
                name: '鹏扬中证科创创业50ETF',
                category: '基金',
                fundType: '指数型-股票',
              },
            ],
          }),
        }),
      );

      const results = await search.fetchFundSearchResults('588350');

      expect(results).toEqual([
        {
          code: '588350',
          name: '鹏扬中证科创创业50ETF',
          category: '基金',
          fundType: '指数型-股票',
        },
      ]);
    });

    it('throws when the local api route fails', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
        }),
      );

      await expect(search.fetchFundSearchResults('白酒')).rejects.toThrow(
        'Failed to fetch fund search results',
      );
    });
  });
});
