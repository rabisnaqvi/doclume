# On Reading Plainly

> "A good interface is like a good window — you don't see it. You see what's on the other side." — *paraphrased, from a notebook I lost in 2019*

There is a particular pleasure in reading something rendered well. Not flashy. Not skinned. Just **calm typography, generous margins**, and the quiet confidence that the page is on your side.

This document exists to test that confidence.

---

## What this viewer is for

A markdown viewer that gets out of the way. Open a file, paste a note, drag a `.md` onto the window — it renders. No login, no library, no folder tree, no comments thread. Reading first.

### Three small goals

1. **Be pretty by default.** No customization should be required to make it look nice.
2. **Respect the document.** Headings, lists, code, tables — render them like a typographer would, not like a wireframe.
3. **Disappear when asked.** Focus mode hides every pixel that isn't the document.

### Three small non-goals

- An editor. Use your editor.
- A workspace. Use your filesystem.
- A renderer for *every* dialect of markdown. Common ones, well.

## A few words on themes

Themes are not skins. Each theme is a **complete reading environment** — font, color, line height, spacing, code colors. You don't pick a font; you pick a mood, and the font comes with it.

The current presets:

| Theme         | Use case            | Body type        | Best for                |
|---------------|---------------------|------------------|-------------------------|
| Library       | Novel, light        | Source Serif     | Long-form prose         |
| Lamplight     | Novel, dark         | Source Serif     | Reading at night        |
| Manual        | Technical, light    | Inter            | Specs and references    |
| Console       | Technical, dark     | Inter            | Code-heavy docs         |
| High Contrast | Accessibility       | System sans      | Maximum legibility      |

## Code, briefly

A renderer that handles code well earns a lot of trust:

```js
// Render a heading and return a slug for the TOC.
function renderHeading(level, text) {
  const slug = text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');

  return `<h${level} id="${slug}">${text}</h${level}>`;
}
```

Inline code like `npm install marked` should sit comfortably in a sentence without breaking the line.

```python
def reading_time(words, wpm=220):
    """Estimate reading time in minutes."""
    return max(1, round(words / wpm))
```

## Lists, nested

- **Top-level** items breathe.
  - Second-level items align cleanly.
    - Third-level items don't get lost.
- Numbered lists, too:
  1. First, render the document.
  2. Then, build the table of contents.
  3. Finally, hook up search.

## Quotations

> Typography is the craft of endowing human language with a durable visual form.

> Some quotes are short. Some are longer, and wrap across multiple lines, and should still feel composed — not boxed-in, not crammed, just gently set apart from the body text by a quiet rule on the left.

## Images

Images fit the reading column. They never blow out the layout.

![A placeholder for an image of a desk with a notebook](https://images.unsplash.com/photo-1455390582262-044cdead277a?w=1200&auto=format&fit=crop&q=70)

## Links

The link to [the markdown spec](https://daringfireball.net/projects/markdown/) opens normally. So does [this one](https://commonmark.org/). Links inherit the theme accent — no underline-on-hover gymnastics.

---

## A closing note

If you are reading this on a phone, it should still feel like reading.
If you are reading this on a 32-inch monitor, the column should not stretch to infinity.
If you are reading this in the dark, it should not burn your eyes.

That's the whole pitch.
