import { afterEach, describe, expect, it, vi } from 'vitest';

import * as dataSource from '@/lib/funds/data-source';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('data-source', () => {
  describe('fetchFundEstimateScript', () => {
    it('fetches real-time estimate script for a single fund code', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          text: async () =>
            'jsonpgz({"fundcode":"588350","name":"测试基金","jzrq":"2026-03-25","dwjz":"1.4443","gsz":"1.4234","gszzl":"-1.45","gztime":"2026-03-26 15:00"});',
        }),
      );

      const script = await dataSource.fetchFundEstimateScript('588350');

      expect(script).toContain('jsonpgz');
      expect(script).toContain('"fundcode":"588350"');
    });

    it('throws when the estimate script request fails', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
        }),
      );

      await expect(dataSource.fetchFundEstimateScript('588350')).rejects.toThrow(
        'Failed to fetch fund estimate script: 588350',
      );
    });
  });

  describe('extractEstimatePayload', () => {
    it('extracts the json payload from jsonpgz callback text', () => {
      const script =
        'jsonpgz({"fundcode":"588350","name":"测试基金","jzrq":"2026-03-25","dwjz":"1.4443","gsz":"1.4234","gszzl":"-1.45","gztime":"2026-03-26 15:00"});';

      const payload = dataSource.extractEstimatePayload(script);

      expect(payload).toEqual({
        fundcode: '588350',
        name: '测试基金',
        jzrq: '2026-03-25',
        dwjz: '1.4443',
        gsz: '1.4234',
        gszzl: '-1.45',
        gztime: '2026-03-26 15:00',
      });
    });

    it('throws when jsonpgz payload is missing', () => {
      expect(() => dataSource.extractEstimatePayload('not-valid')).toThrow(
        'Failed to extract estimate payload',
      );
    });
  });

  describe('mapEstimatePayloadToQuote', () => {
    it('maps estimate payload to a fund quote', () => {
      const quote = dataSource.mapEstimatePayloadToQuote({
        fundcode: '588350',
        name: '测试基金',
        jzrq: '2026-03-25',
        dwjz: '1.4443',
        gsz: '1.4234',
        gszzl: '-1.45',
        gztime: '2026-03-26 15:00',
      });

      expect(quote).toEqual({
        code: '588350',
        name: '测试基金',
        estimatedNav: 1.4234,
        changeRate: -1.45,
        updatedAt: '2026-03-26 15:00',
      });
    });

    it('throws when estimate numbers are invalid', () => {
      expect(() =>
        dataSource.mapEstimatePayloadToQuote({
          fundcode: '588350',
          name: '测试基金',
          jzrq: '2026-03-25',
          dwjz: '1.4443',
          gsz: '--',
          gszzl: '-1.45',
          gztime: '2026-03-26 15:00',
        }),
      ).toThrow('Failed to map estimate payload to quote');
    });
  });

  describe('fetchSingleFundQuote', () => {
    it('builds a complete fund quote from the estimate script', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          text: async () =>
            'jsonpgz({"fundcode":"588350","name":"测试基金","jzrq":"2026-03-25","dwjz":"1.4443","gsz":"1.4234","gszzl":"-1.45","gztime":"2026-03-26 15:00"});',
        }),
      );

      const result = await dataSource.fetchSingleFundQuote('588350');

      expect(result).toEqual({
        code: '588350',
        name: '测试基金',
        estimatedNav: 1.4234,
        changeRate: -1.45,
        updatedAt: '2026-03-26 15:00',
      });
    });
  });

  describe('fetchFundQuotes', () => {
    it('fetches quotes for multiple fund codes', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: true,
          json: async () => ({
            quotes: [
              {
                code: '588350',
                name: '基金A',
                estimatedNav: 1.4234,
                changeRate: -1.45,
                updatedAt: '2026-03-26 15:00',
              },
              {
                code: '110022',
                name: '基金B',
                estimatedNav: 3.1073,
                changeRate: -1.29,
                updatedAt: '2026-03-26 15:00',
              },
            ],
          }),
        }),
      );

      const result = await dataSource.fetchFundQuotes(['588350', '110022']);

      expect(result).toEqual([
        {
          code: '588350',
          name: '基金A',
          estimatedNav: 1.4234,
          changeRate: -1.45,
          updatedAt: '2026-03-26 15:00',
        },
        {
          code: '110022',
          name: '基金B',
          estimatedNav: 3.1073,
          changeRate: -1.29,
          updatedAt: '2026-03-26 15:00',
        },
      ]);
    });

    it('throws when api response is not ok', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue({
          ok: false,
        }),
      );

      await expect(dataSource.fetchFundQuotes(['588350'])).rejects.toThrow(
        'Failed to fetch fund quotes',
      );
    });
  });
});
