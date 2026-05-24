import { renderMarkdown, extractToc } from '@doclume/core';
import { fixtures } from '../fixtures';

describe('markdown rendering', () => {
  it('renders rich markdown with stable headings and table markup', () => {
    const html = renderMarkdown(fixtures.rich);

    expect(html).toContain('<h1 id="reading-confidence">Reading confidence</h1>');
    expect(html).toContain('<h2 id="first-section">First section</h2>');
    expect(html).toContain('<h3 id="nested-heading">Nested heading</h3>');
    expect(html).toContain('class="markdown-table-wrap"');
  });

  it('extracts the table of contents from the same source', () => {
    expect(extractToc(fixtures.rich)).toEqual([
      { id: 'reading-confidence', level: 1, text: 'Reading confidence' },
      { id: 'first-section', level: 2, text: 'First section' },
      { id: 'nested-heading', level: 3, text: 'Nested heading' },
    ]);
  });

  it('renders inline markdown inside definition lists', () => {
    const html = renderMarkdown(`Term with *emphasis* and [link](https://example.com)\n: Definition with \`code\``);

    expect(html).toContain('<dt>Term with <em>emphasis</em> and <a href="https://example.com">link</a></dt>');
    expect(html).toContain('<dd>Definition with <code>code</code></dd>');
  });

  it('renders supported GFM alert blockquotes as admonitions', () => {
    const html = renderMarkdown([
      '> [!NOTE]',
      '> Note body with **strong** text.',
      '',
      '> [!WARNING]',
      '> Warning body',
    ].join('\n'));

    expect(html).toContain('class="admonition admonition--note"');
    expect(html).toContain('class="admonition__title"');
    expect(html).toContain('NOTE');
    expect(html).toContain('<strong>strong</strong>');
    expect(html).toContain('class="admonition admonition--warning"');
  });

  it('keeps plain and unsupported alert blockquotes as blockquotes', () => {
    const html = renderMarkdown([
      '> Plain quote',
      '',
      '> [!CUSTOM]',
      '> Custom body',
    ].join('\n'));

    expect(html).toContain('<blockquote>');
    expect(html).toContain('<p>Plain quote</p>');
    expect(html).toContain('<p>[!CUSTOM]\nCustom body</p>');
    expect(html).not.toContain('admonition--custom');
  });

  it('renders mixed-case mermaid fences as diagrams', () => {
    for (const lang of ['Mermaid', 'MERMAID']) {
      const html = renderMarkdown(['```' + lang, 'flowchart TD', 'A-->B', '```'].join('\n'));

      expect(html).toContain('<div class="mermaid"');
      expect(html).not.toContain('<pre><code');
    }
  });

  it('omits unsafe language classes for unknown code fences', () => {
    const html = renderMarkdown('```foo" onmouseover="x\nalert(1)\n```');

    expect(html).toContain('<pre><code class="hljs">');
    expect(html).not.toContain('language-foo');
    expect(html).not.toContain('onmouseover');
  });
});
