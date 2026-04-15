import type { NavCacheEntry, NavCacheSource } from '@/lib/funds/types';
import { fetchHistoricalNav } from '@/lib/funds/data-source';

const L1_CACHE_TTL_MS = 5 * 60 * 1000;
const L2_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const l1Cache = new Map<string, NavCacheEntry>();

function getCacheKey(fundCode: string, date: string): string {
  return `${fundCode}:${date}`;
}

function isL1Expired(entry: NavCacheEntry): boolean {
  const now = Date.now();
  const updatedAt = new Date(entry.updatedAt).getTime();
  return now - updatedAt > L1_CACHE_TTL_MS;
}

function getL1Cache(fundCode: string, date: string): NavCacheEntry | null {
  const key = getCacheKey(fundCode, date);
  const entry = l1Cache.get(key);
  if (!entry) return null;
  if (isL1Expired(entry)) {
    l1Cache.delete(key);
    return null;
  }
  return entry;
}

function setL1Cache(entry: NavCacheEntry): void {
  const key = getCacheKey(entry.fundCode, entry.date);
  l1Cache.set(key, entry);
}

function getL2CacheKey(fundCode: string, date: string): string {
  return `nav_cache:${fundCode}:${date}`;
}

function getL2Cache(fundCode: string, date: string): NavCacheEntry | null {
  if (typeof window === 'undefined') return null;
  const key = getL2CacheKey(fundCode, date);
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    const entry = JSON.parse(raw) as NavCacheEntry;
    const updatedAt = new Date(entry.updatedAt).getTime();
    const now = Date.now();
    if (now - updatedAt > L2_CACHE_TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return entry;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

function setL2Cache(entry: NavCacheEntry): void {
  if (typeof window === 'undefined') return;
  const key = getL2CacheKey(entry.fundCode, entry.date);
  localStorage.setItem(key, JSON.stringify(entry));
}

export async function fetchNavFromApi(fundCode: string, date: string): Promise<NavCacheEntry | null> {
  try {
    const nav = await fetchHistoricalNav(fundCode, date);
    
    if (nav === null) {
      return null;
    }
    
    const entry: NavCacheEntry = {
      fundCode,
      date,
      nav,
      updatedAt: new Date().toISOString(),
      source: 'api',
    };
    setL1Cache(entry);
    setL2Cache(entry);
    return entry;
  } catch {
    return null;
  }
}

export async function getNavWithCache(fundCode: string, date: string): Promise<NavCacheEntry | null> {
  const l1Entry = getL1Cache(fundCode, date);
  if (l1Entry) {
    return { ...l1Entry, source: 'cache' };
  }

  const l2Entry = getL2Cache(fundCode, date);
  if (l2Entry) {
    setL1Cache(l2Entry);
    return { ...l2Entry, source: 'cache' };
  }

  return fetchNavFromApi(fundCode, date);
}

export async function getBatchNavWithCache(requests: Array<{ fundCode: string; date: string }>): Promise<NavCacheEntry[]> {
  const results: NavCacheEntry[] = [];
  for (const req of requests) {
    const entry = await getNavWithCache(req.fundCode, req.date);
    if (entry) results.push(entry);
  }
  return results;
}

export function clearL1Cache(): void {
  l1Cache.clear();
}

export function clearL2Cache(): void {
  if (typeof window === 'undefined') return;
  const keys = Object.keys(localStorage).filter((k) => k.startsWith('nav_cache:'));
  keys.forEach((k) => localStorage.removeItem(k));
}

export function setManualNav(fundCode: string, date: string, nav: number): NavCacheEntry {
  const entry: NavCacheEntry = {
    fundCode,
    date,
    nav,
    updatedAt: new Date().toISOString(),
    source: 'manual',
  };
  setL1Cache(entry);
  setL2Cache(entry);
  return entry;
}