class MockStorage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

const installStorage = (key: 'localStorage' | 'sessionStorage') => {
  const current = globalThis[key] as Partial<Storage> | undefined;
  if (
    current
    && typeof current.getItem === 'function'
    && typeof current.setItem === 'function'
    && typeof current.removeItem === 'function'
    && typeof current.clear === 'function'
  ) {
    return;
  }

  Object.defineProperty(globalThis, 'Storage', {
    configurable: true,
    value: MockStorage,
    writable: true,
  });

  const storage = new MockStorage();
  Object.defineProperty(globalThis, key, {
    configurable: true,
    value: storage,
    writable: true,
  });

  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'Storage', {
      configurable: true,
      value: MockStorage,
      writable: true,
    });
    Object.defineProperty(window, key, {
      configurable: true,
      value: storage,
      writable: true,
    });
  }
};

installStorage('localStorage');
installStorage('sessionStorage');
