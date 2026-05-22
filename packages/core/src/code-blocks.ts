const ENHANCED_CLASS = 'code-block--enhanced';
const OVERLAY_CLASS = 'code-block__overlay';
const COPY_CLASS = 'code-block__copy';
const LABEL_CLASS = 'code-block__label';
const COPY_TEXT = 'Copy';
const COPIED_TEXT = 'Copied ✓';
const RESET_DELAY_MS = 2000;

function getLanguageLabel(code: HTMLElement): string | null {
  for (const className of Array.from(code.classList)) {
    if (className.startsWith('language-') && className.length > 'language-'.length) {
      return className.slice('language-'.length);
    }
  }

  return null;
}

export function enhanceCodeBlocks(root: ParentNode | null | undefined): void {
  const blocks = Array.from(root?.querySelectorAll<HTMLElement>('pre > code.hljs') ?? []);

  for (const code of blocks) {
    const pre = code.parentElement;
    if (!pre || pre.classList.contains(ENHANCED_CLASS)) {
      continue;
    }

    const scroll = pre.ownerDocument.createElement('div');
    scroll.className = 'code-block__scroll';
    pre.insertBefore(scroll, code);
    scroll.append(code);

    const overlay = pre.ownerDocument.createElement('div');
    overlay.className = OVERLAY_CLASS;

    const language = getLanguageLabel(code);
    if (language) {
      const label = pre.ownerDocument.createElement('span');
      label.className = LABEL_CLASS;
      label.textContent = language;
      overlay.append(label);
    }

    const button = pre.ownerDocument.createElement('button');
    button.type = 'button';
    button.className = COPY_CLASS;
    button.textContent = COPY_TEXT;

    let resetHandle: ReturnType<typeof setTimeout> | undefined;

    button.addEventListener('click', async () => {
      try {
        const clipboard = pre.ownerDocument.defaultView?.navigator.clipboard;
        if (!clipboard) {
          return;
        }

        await clipboard.writeText(code.textContent ?? '');
        button.textContent = COPIED_TEXT;

        if (resetHandle) {
          clearTimeout(resetHandle);
        }

        resetHandle = setTimeout(() => {
          button.textContent = COPY_TEXT;
          resetHandle = undefined;
        }, RESET_DELAY_MS);
      } catch {
        button.textContent = COPY_TEXT;
      }
    });

    overlay.append(button);
    pre.prepend(overlay);
    pre.classList.add(ENHANCED_CLASS);
  }
}
