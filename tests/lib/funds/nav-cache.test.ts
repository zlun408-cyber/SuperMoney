import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  getNavWithCache,
  clearL1Cache,
  setManualNav,
} from '@/lib/funds/nav-cache';

describe('nav-cache', () => {
  const originalLocalStorage = global.localStorage;
  const store: Record<string, string> = {};

  beforeEach(() => {
    clearL1Cache();
    Object.keys(store).forEach((k) => delete store[k]);
    
    const mockLocalStorage = {
      getItem: (key: string) => store[key] || null,
      setItem: (key: string, value: string) => { store[key] = value; },
      removeItem: (key: string) => { delete store[key]; },
      clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
      get length() { return Object.keys(store).length; },
      key: (i: number) => Object.keys(store)[i] || null,
    };
    
    vi.stubGlobal('localStorage', mockLocalStorage);
    vi.stubGlobal('window', { localStorage: mockLocalStorage });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('setManualNav', () => {
    it('should create entry with manual source', () => {
      const entry = setManualNav('000001', '2026-04-08', 2.5);
      expect(entry.source).toBe('manual');
      expect(entry.nav).toBe(2.5);
      expect(entry.fundCode).toBe('000001');
      expect(entry.date).toBe('2026-04-08');
    });

    it('should store entry in localStorage', () => {
      setManualNav('000001', '2026-04-08', 2.5);
      expect(localStorage.getItem('nav_cache:000001:2026-04-08')).not.toBeNull();
    });
  });

  describe('getNavWithCache with manual nav', () => {
    it('should retrieve manually set nav from cache', async () => {
      setManualNav('000001', '2026-04-08', 3.5);
      
      const entry = await getNavWithCache('000001', '2026-04-08');
      
      expect(entry).not.toBeNull();
      expect(entry?.nav).toBe(3.5);
      expect(entry?.source).toBe('cache');
    });
  });

  describe('clearL1Cache', () => {
    it('should clear in-memory cache but keep localStorage', async () => {
      setManualNav('000001', '2026-04-08', 4.5);
      clearL1Cache();
      
      const entry = await getNavWithCache('000001', '2026-04-08');
      
      expect(entry).not.toBeNull();
      expect(entry?.nav).toBe(4.5);
      expect(entry?.source).toBe('cache');
    });
  });

  describe('cache TTL', () => {
    it('should return null for expired L2 entry', async () => {
      const oldTimestamp = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
      
      localStorage.setItem(
        'nav_cache:000001:2026-04-08',
        JSON.stringify({
          fundCode: '000001',
          date: '2026-04-08',
          nav: 5.5,
          updatedAt: oldTimestamp,
          source: 'api',
        })
      );
      
      clearL1Cache();
      const entry = await getNavWithCache('000001', '2026-04-08');
      
      expect(entry).toBeNull();
    });
  });
});