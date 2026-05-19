import { stripFrontMatter } from '@doclume/core';

describe('stripFrontMatter', () => {
  it('removes valid YAML front matter', () => {
    const markdown = `---
title: Doc
---

# Heading`;

    expect(stripFrontMatter(markdown)).toBe(`
# Heading`);
  });

  it('keeps a document that starts with a horizontal rule', () => {
    const markdown = `---

Intro paragraph.

---

# Heading`;

    expect(stripFrontMatter(markdown)).toBe(markdown);
  });

  it('keeps content with an opening fence but no YAML-like keys', () => {
    const markdown = `---
This is not front matter.
---

# Heading`;

    expect(stripFrontMatter(markdown)).toBe(markdown);
  });

  it('removes front matter with empty values', () => {
    const markdown = `---
title:
---

# Heading`;

    expect(stripFrontMatter(markdown)).toBe(`
# Heading`);
  });

  it('keeps content without a closing fence', () => {
    const markdown = `---
title: Doc

# Heading`;

    expect(stripFrontMatter(markdown)).toBe(markdown);
  });
});
