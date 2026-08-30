import '@testing-library/jest-dom/vitest';

// Node 22+'s experimental global `localStorage` shadows jsdom's real implementation and
// resolves to `undefined` unless `--localstorage-file` is passed. Give jsdom-environment
// tests a working in-memory Storage instead of requiring that flag everywhere tests run.
// See docs/TEST_DESIGN.md's "localStorage/sessionStorage in jsdom tests" note if this
// polyfill is ever removed or this file starts failing again.
if (typeof window !== 'undefined') {
  class MemoryStorage implements Storage {
    private store = new Map<string, string>();
    get length() {
      return this.store.size;
    }
    clear() {
      this.store.clear();
    }
    getItem(key: string) {
      return this.store.has(key) ? this.store.get(key)! : null;
    }
    key(index: number) {
      return Array.from(this.store.keys())[index] ?? null;
    }
    removeItem(key: string) {
      this.store.delete(key);
    }
    setItem(key: string, value: string) {
      this.store.set(key, String(value));
    }
  }

  Object.defineProperty(window, 'localStorage', { value: new MemoryStorage(), configurable: true });
}
