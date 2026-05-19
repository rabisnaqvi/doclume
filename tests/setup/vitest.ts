import { afterEach, vi } from 'vitest';

afterEach(() => {
  document.body.innerHTML = '';
  document.documentElement.innerHTML = '<head></head><body></body>';
  vi.restoreAllMocks();
});
