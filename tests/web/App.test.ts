import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../packages/web/src/App';

const { renderDocument, renderPending } = vi.hoisted(() => {
  const renderPending: { resolve?: (value: any) => void } = {};

  return {
    renderDocument: vi.fn(() => new Promise((resolve) => {
      renderPending.resolve = resolve;
    })),
    renderPending,
  };
});

vi.mock('@doclume/core', async () => {
  const actual = await vi.importActual<typeof import('@doclume/core')>('@doclume/core');
  return { ...actual, renderDocument };
});

describe('App', () => {
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

    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        matches: false,
        media: '',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
    Object.defineProperty(window, 'scrollTo', { writable: true, value: vi.fn() });
    Object.defineProperty(window, 'IntersectionObserver', {
      writable: true,
      value: class {
        observe() {}
        disconnect() {}
        unobserve() {}
      },
    });
    Object.defineProperty(globalThis, 'CSS', {
      writable: true,
      value: { escape: (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '\\$&') },
    });
    Object.defineProperty(window, 'localStorage', { configurable: true, writable: true, value: fakeStorage });
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, writable: true, value: fakeStorage });

    fakeStorage.setItem('doclume-prefs-v1', JSON.stringify({ theme: 'manual', sidebarCollapsed: false }));
    fakeStorage.setItem('doclume-last-doc-v1', JSON.stringify({ markdown: '# Hello World', name: 'hello.md' }));
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

    renderDocument.mockClear();
    document.body.innerHTML = '';
  });

  it('keeps stable loading shell while render pending', async () => {
    const host = document.createElement('div');
    document.body.append(host);

    await act(async () => {
      createRoot(host).render(React.createElement(App));
    });

    await vi.waitFor(() => expect(renderDocument).toHaveBeenCalledTimes(1));
    expect(host.querySelector('.sidebar--loading')).not.toBeNull();
    expect(host.querySelector('.reader__header__stats-row--loading')).not.toBeNull();
    expect(host.querySelector('.markdown-skeleton')).not.toBeNull();
    expect(host.querySelector('.empty')).toBeNull();

    renderPending.resolve?.({ html: '<h1 id="hello-world">Hello World</h1>', toc: [{ id: 'hello-world', level: 1, text: 'Hello World' }], stats: { words: 2, minutes: 1 } });
    await vi.waitFor(() => expect(host.querySelector('.sidebar--loading')).toBeNull());
    expect(host.querySelector('.toc__link')?.textContent).toBe('Hello World');
    expect(host.querySelector('.reader__header__stats-row')?.textContent).toContain('1 min read');
  });

  it('shows a global error workspace when renderDocument rejects', async () => {
    renderDocument.mockRejectedValueOnce(new Error('boom'));

    const host = document.createElement('div');
    document.body.append(host);

    await act(async () => {
      createRoot(host).render(React.createElement(App));
    });

    await vi.waitFor(() => expect(host.querySelector('.workspace-error')).not.toBeNull());
    expect(host.querySelector('.reader')).toBeNull();
    expect(host.querySelector('.reader__header__stats-row')).toBeNull();
    expect(host.textContent).toContain('Render failed');
    expect(host.textContent).toContain('Try again');
  });

  it('retries the current document from the global error workspace', async () => {
    renderDocument.mockRejectedValueOnce(new Error('boom'));

    const host = document.createElement('div');
    document.body.append(host);

    await act(async () => {
      createRoot(host).render(React.createElement(App));
    });

    await vi.waitFor(() => expect(host.querySelector('.workspace-error')).not.toBeNull());

    const retry = host.querySelector('.workspace-error__retry') as HTMLButtonElement | null;
    expect(retry).not.toBeNull();

    await act(async () => {
      retry!.click();
    });

    await vi.waitFor(() => expect(renderDocument).toHaveBeenCalledTimes(2));
    renderPending.resolve?.({
      html: '<h1 id="hello-world">Hello World</h1>',
      toc: [{ id: 'hello-world', level: 1, text: 'Hello World' }],
      stats: { words: 2, minutes: 1 },
    });

    await vi.waitFor(() => expect(host.querySelector('.workspace-error')).toBeNull());
    await vi.waitFor(() => expect(host.querySelector('.reader__header__stats-row')?.textContent).toContain('1 min read'));
  });

});
