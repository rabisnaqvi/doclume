import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const script = readFileSync('packages/web/public/theme-preboot.js', 'utf8');

function runPreboot(): void {
  // eslint-disable-next-line no-new-func
  new Function(script)();
}

describe('theme preboot', () => {
  let storage: Record<string, string>;

  beforeEach(() => {
    storage = {};
    const fakeStorage = {
      getItem: (key: string) => (key in storage ? storage[key] : null),
      setItem: (key: string, value: string) => { storage[key] = String(value); },
      removeItem: (key: string) => { delete storage[key]; },
      clear: () => { storage = {}; },
    };

    document.documentElement.dataset.theme = 'library';
    Object.defineProperty(window, 'localStorage', { writable: true, value: fakeStorage });
    Object.defineProperty(globalThis, 'localStorage', { writable: true, value: fakeStorage });
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
