const ENHANCED_CLASS = 'code-block--enhanced';
const OVERLAY_CLASS = 'code-block__overlay';
const COPY_CLASS = 'code-block__copy';
const LABEL_CLASS = 'code-block__label';
const COPY_TEXT = 'Copy';
const COPIED_TEXT = 'Copied ✓';
const RESET_DELAY_MS = 2000;

const boundRoots = new WeakSet<EventTarget>();
const handledCopyClicks = new WeakSet<Event>();
const resetHandles = new WeakMap<HTMLButtonElement, ReturnType<typeof setTimeout>>();

function getLanguageLabel(code: HTMLElement): string | null {
  for (const className of Array.from(code.classList)) {
    if (className.startsWith('language-') && className.length > 'language-'.length) {
      return className.slice('language-'.length);
    }
  }

  return null;
}

function bindCopyHandler(root: ParentNode): void {
  const host = root as EventTarget;
  if (typeof host.addEventListener !== 'function' || boundRoots.has(host)) {
    return;
  }

  boundRoots.add(host);
  host.addEventListener('click', async (event) => {
    const target = event.target as Element | null;
    if (!target || typeof target.closest !== 'function') {
      return;
    }

    const button = target.closest(`button.${COPY_CLASS}`);
    if (!button || button.tagName !== 'BUTTON') {
      return;
    }
    const copyButton = button as HTMLButtonElement;

    const pre = copyButton.closest('pre');
    if (!pre || pre.tagName !== 'PRE') {
      return;
    }

    const copyLabel = copyButton.querySelector<HTMLSpanElement>(`.code-block__copy-label`);
    if (!copyLabel) {
      return;
    }

    try {
      if (handledCopyClicks.has(event)) {
        return;
      }
      handledCopyClicks.add(event);

      const clipboard = copyButton.ownerDocument.defaultView?.navigator.clipboard;
      if (!clipboard) {
        return;
      }

      const code = pre.querySelector<HTMLElement>('code.hljs');
      await clipboard.writeText(code?.textContent ?? '');
      copyLabel.textContent = COPIED_TEXT;

      const existingHandle = resetHandles.get(copyButton);
      if (existingHandle) {
        clearTimeout(existingHandle);
      }

      const resetHandle = setTimeout(() => {
        copyLabel.textContent = COPY_TEXT;
        resetHandles.delete(copyButton);
      }, RESET_DELAY_MS);

      resetHandles.set(copyButton, resetHandle);
    } catch {
      copyLabel.textContent = COPY_TEXT;
    }
  });
}

export function enhanceCodeBlocks(root: ParentNode | null | undefined): void {
  if (!root) {
    return;
  }

  bindCopyHandler(root);

  const blocks = Array.from(root.querySelectorAll<HTMLElement>('pre > code.hljs'));

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

    const icon = pre.ownerDocument.createElement('span');
    icon.className = 'code-block__copy-icon';
    icon.setAttribute('aria-hidden', 'true');

    const label = pre.ownerDocument.createElement('span');
    label.className = 'code-block__copy-label';
    label.textContent = COPY_TEXT;

    button.append(icon, label);

    overlay.append(button);
    pre.prepend(overlay);
    pre.classList.add(ENHANCED_CLASS);
  }
}
