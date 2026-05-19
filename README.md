<div align="center">

<img src="https://raw.githubusercontent.com/rabisnaqvi/doclume/main/packages/vscode/images/icon.png" alt="Doclume" width="120" />

# Doclume

**Five themes. Zero Comic Sans.**

*A markdown reader for the web and VS Code — with typography that respects your words.*

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/rabisnaqvi.doclume?label=VS%20Code%20Marketplace&logo=visualstudiocode&logoColor=white&color=007ACC&style=flat-square)](https://marketplace.visualstudio.com/items?itemName=rabisnaqvi.doclume)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/rabisnaqvi.doclume?label=installs&color=007ACC&style=flat-square)](https://marketplace.visualstudio.com/items?itemName=rabisnaqvi.doclume)
[![License: MIT](https://img.shields.io/github/license/rabisnaqvi/doclume?color=000&style=flat-square)](./LICENSE)

<br />

[**→ Open web app**](https://doclume.rabisnaqvi.workers.dev/) &nbsp;&nbsp;|&nbsp;&nbsp; [**→ Install for VS Code**](https://marketplace.visualstudio.com/items?itemName=rabisnaqvi.doclume)

</div>

---

<table>
  <tr>
    <td align="center" width="50%">
      <a href="https://raw.githubusercontent.com/rabisnaqvi/doclume/main/packages/vscode/images/theme-library.png"><img src="https://raw.githubusercontent.com/rabisnaqvi/doclume/main/packages/vscode/images/theme-library.png" alt="Library theme — serif, warm cream" /></a>
      <br /><b>Library</b> &nbsp;·&nbsp; Serif · light · warm cream
    </td>
    <td align="center" width="50%">
      <a href="https://raw.githubusercontent.com/rabisnaqvi/doclume/main/packages/vscode/images/theme-lamplight.png"><img src="https://raw.githubusercontent.com/rabisnaqvi/doclume/main/packages/vscode/images/theme-lamplight.png" alt="Lamplight theme — serif, amber on dark" /></a>
      <br /><b>Lamplight</b> &nbsp;·&nbsp; Serif · dark · amber
    </td>
  </tr>
  <tr>
    <td align="center" width="50%">
      <a href="https://raw.githubusercontent.com/rabisnaqvi/doclume/main/packages/vscode/images/theme-manual.png"><img src="https://raw.githubusercontent.com/rabisnaqvi/doclume/main/packages/vscode/images/theme-manual.png" alt="Manual theme — sans, clean white" /></a>
      <br /><b>Manual</b> &nbsp;·&nbsp; Sans · light · clean
    </td>
    <td align="center" width="50%">
      <a href="https://raw.githubusercontent.com/rabisnaqvi/doclume/main/packages/vscode/images/theme-console.png"><img src="https://raw.githubusercontent.com/rabisnaqvi/doclume/main/packages/vscode/images/theme-console.png" alt="Console theme — sans, dark IDE style" /></a>
      <br /><b>Console</b> &nbsp;·&nbsp; Sans · dark · IDE-style
    </td>
  </tr>
  <tr>
    <td align="center" colspan="2">
      <a href="https://raw.githubusercontent.com/rabisnaqvi/doclume/main/packages/vscode/images/theme-high-contrast.png"><img src="https://raw.githubusercontent.com/rabisnaqvi/doclume/main/packages/vscode/images/theme-high-contrast.png" alt="High Contrast theme — WCAG accessible" width="50%" /></a>
      <br /><b>High Contrast</b> &nbsp;·&nbsp; Sans · accessibility · WCAG
    </td>
  </tr>
</table>

---

## Why Doclume

The default markdown preview renders your file. Doclume *reads* it.

Serif fonts for long-form prose. Proper line lengths. Themes that don't feel like a homework assignment. Whether you're drafting a spec, writing a changelog, or reading someone else's docs — your words deserve better than a white void.

---

## Themes

| Theme | Mode | Best for |
|-------|------|----------|
| **Library** | Serif · light | Long reads, essays, changelogs |
| **Lamplight** | Serif · dark | Late-night reading, warm amber tones |
| **Manual** | Sans · light | Specs, READMEs, API docs |
| **Console** | Sans · dark | Technical docs, IDE-style |
| **High Contrast** | Sans | Accessibility, WCAG |

5 themes, 2 font families, both sides of dark/light. Auto mode picks based on your system preference.

---

## Markdown

Doclume reads markdown the way you meant it to look—**one experience in the browser and in VS Code**, so the preview beside your editor matches what you’d share from the web app.

- **Tables & tasks** — ship specs and changelogs without fighting the layout
- **Code blocks** — syntax-colored fences that stay readable on every theme
- **Diagrams** — Mermaid in the preview, no round-trip to another tool
- **Math** — crisp formulas with KaTeX
- **Notes & glossaries** — footnotes and definition lists when the doc calls for them

---

## Web app

Open markdown in any browser — no install, no account, no friction.

**[→ doclume.rabisnaqvi.workers.dev](https://doclume.rabisnaqvi.workers.dev/)**

- Paste markdown or open a local `.md`, `.prompt`, `.instructions`, `.chatagent`, or `.skill` file
- Pick a theme, read comfortably
- **Outline** (table of contents) and **in-document search** (`Ctrl+F` / `Cmd+F`)
- **Word count** and **estimated reading time** at a glance

---

## VS Code extension

Live preview beside your editor; updates as you type. **Same rendering as the web reader**—tables, diagrams, math, footnotes—so nothing surprises you at publish time. Fonts ship with the extension (no Google Fonts fetch in the webview).

**Install:**
```sh
code --install-extension rabisnaqvi.doclume
```
Or search `doclume` in the Extensions panel · [Marketplace page](https://marketplace.visualstudio.com/items?itemName=rabisnaqvi.doclume)

**Open preview:**

| OS | Shortcut |
|----|----------|
| Mac | `Cmd+K Cmd+Shift+L` |
| Windows / Linux | `Ctrl+K Ctrl+Shift+L` |

Also: `📖` icon in the editor toolbar · right-click file in Explorer · Command Palette → **Doclume: Open in Doclume**

**Switch themes:**
Command Palette → `Doclume: Select Doclume Theme…` · or `Doclume: Cycle Doclume Theme` to rotate

Auto mode tracks your VS Code color theme — light workspace gets Manual, dark gets Console.

**Configuration:**
```jsonc
{
  // auto | library | lamplight | manual | console | contrast
  "doclume.theme": "auto"
}
```

**Supported file types:** `.md` · `.prompt` · `.instructions` · `.chatagent` · `.skill`

---

## Testing

Run the local suite with:

- `pnpm test:core`
- `pnpm test:web`
- `pnpm test:vscode:smoke`
- `pnpm test:vscode:visual`
- `pnpm test:vscode`
- `pnpm test`
- `pnpm test:update-snapshots`

## Testing

For local test commands and snapshot maintenance notes, see [`tests/README.md`](./tests/README.md).

## License

MIT · [rabisnaqvi](https://github.com/rabisnaqvi)
