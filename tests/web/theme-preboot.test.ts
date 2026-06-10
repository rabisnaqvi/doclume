import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const script = readFileSync('packages/web/public/theme-preboot.js', 'utf8');

function runPreboot(): void {
  // eslint-disable-next-line no-new-func
  new Function(script)();
}

describe('theme preboot', () => {
  let storage: Record<string, string>;
  let originalWindowLocalStorage: PropertyDescriptor | undefined;
  let originalGlobalLocalStorage: PropertyDescriptor | undefined;

  beforeEach(() => {
    storage = {};
    const fakeStorage = {
      getItem: (key: string) => (key in storage ? storage[key] : null),
      setItem: (key: string, value: string) => { storage[key] = String(value); },
      removeItem: (key: string) => { delete storage[key]; },
      clear: () => { storage = {}; },
    };

    originalWindowLocalStorage = Object.getOwnPropertyDescriptor(window, 'localStorage');
    originalGlobalLocalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');

    document.documentElement.dataset.theme = 'library';
    Object.defineProperty(window, 'localStorage', { configurable: true, writable: true, value: fakeStorage });
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: fakeStorage });
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        media: '',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    if (originalWindowLocalStorage) {
      Object.defineProperty(window, 'localStorage', originalWindowLocalStorage);
    } else {
      Reflect.deleteProperty(window as typeof window & { localStorage?: Storage }, 'localStorage');
    }

    if (originalGlobalLocalStorage) {
      Object.defineProperty(globalThis, 'localStorage', originalGlobalLocalStorage);
    } else {
      Reflect.deleteProperty(globalThis as typeof globalThis & { localStorage?: Storage }, 'localStorage');
    }

    document.documentElement.dataset.theme = 'library';
  });

  it('applies saved theme before app boot', () => {
    window.localStorage.setItem('doclume-prefs-v1', JSON.stringify({ theme: 'lamplight' }));
    runPreboot();
    expect(document.documentElement.dataset.theme).toBe('lamplight');
  });

  it('falls back to browser color scheme', () => {
    window.localStorage.removeItem('doclume-prefs-v1');
    (window.matchMedia as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      matches: true,
      media: '',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    runPreboot();
    expect(document.documentElement.dataset.theme).toBe('lamplight');
  });

  it('rejects invalid stored theme ids', () => {
    window.localStorage.setItem('doclume-prefs-v1', JSON.stringify({ theme: 'bogus-theme' }));
    runPreboot();
    expect(document.documentElement.dataset.theme).toBe('library');
  });
});
