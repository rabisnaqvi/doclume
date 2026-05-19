import { renderMarkdown } from '@doclume/core';
import { fixtures } from '../fixtures';

describe('markdown sanitization', () => {
  it('renders the sanitization fixture without javascript URLs', () => {
    const html = renderMarkdown(fixtures.sanitization);

    expect(html).not.toMatch(/javascript:/i);
    expect(html).not.toMatch(/onerror=/i);
    expect(html).toContain('href="#"');
    expect(html).toContain('<img>');
  });
});
