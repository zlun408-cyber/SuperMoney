import { useState, useCallback } from 'react';
import type { NavCacheEntry } from '@/lib/funds/types';

interface AutoNavState {
  loading: boolean;
  error: string | null;
  nav: number | null;
  source: 'api' | 'cache' | 'manual' | null;
  effectiveDate: string | null;
}

interface AutoNavResult {
  state: AutoNavState;
  fetchNav: (fundCode: string, date: string, period: 'before_1500' | 'after_1500') => Promise<void>;
  reset: () => void;
}

export function resolveEffectiveDate(date: string, period: 'before_1500' | 'after_1500'): string {
  if (period === 'after_1500') {
    const d = new Date(date);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }
  return date;
}

export function useAutoNav(): AutoNavResult {
  const [state, setState] = useState<AutoNavState>({
    loading: false,
    error: null,
    nav: null,
    source: null,
    effectiveDate: null,
  });

  const fetchNav = useCallback(async (fundCode: string, date: string, period: 'before_1500' | 'after_1500') => {
    const effectiveDate = resolveEffectiveDate(date, period);

    setState({
      loading: true,
      error: null,
      nav: null,
      source: null,
      effectiveDate,
    });

    try {
      const response = await fetch(`/api/funds/nav?fundCode=${fundCode}&date=${effectiveDate}`);
      const result = await response.json();

      if (!result.success) {
        setState({
          loading: false,
          error: result.error?.message || '净值获取失败',
          nav: null,
          source: null,
          effectiveDate,
        });
        return;
      }

      const data: NavCacheEntry = result.data;
      setState({
        loading: false,
        error: null,
        nav: data.nav,
        source: data.source,
        effectiveDate: data.date,
      });
    } catch {
      setState({
        loading: false,
        error: '网络请求失败，请手动输入净值',
        nav: null,
        source: null,
        effectiveDate,
      });
    }
  }, []);

  const reset = useCallback(() => {
    setState({
      loading: false,
      error: null,
      nav: null,
      source: null,
      effectiveDate: null,
    });
  }, []);

  return { state, fetchNav, reset };
}