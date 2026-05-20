import DOMPurify, { type Config, type UponSanitizeAttributeHookEvent } from 'dompurify';

const EVENT_ATTR = /^on\w+/i;

const MERMAID_SVG_CONFIG: Config = {
  USE_PROFILES: { svg: true, svgFilters: true },
  // Labels must use SVG <text> (htmlLabels: false); foreignObject enables HTML injection.
  FORBID_TAGS: ['foreignObject', 'script', 'iframe', 'object', 'embed', 'audio', 'video'],
};

const MARKDOWN_HTML_CONFIG: Config = {
  USE_PROFILES: { html: true },
  ADD_ATTR: [
    'id',
    'data-src',
    'aria-hidden',
    'aria-label',
    'role',
    'colspan',
    'rowspan',
    'start',
    'align',
    'width',
    'height',
    'target',
    'rel',
    'loading',
    'decoding',
  ],
  ALLOW_DATA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
};

let hooksInstalled = false;

function installHooks(): void {
  if (hooksInstalled || typeof window === 'undefined') return;
  hooksInstalled = true;

  DOMPurify.addHook('uponSanitizeAttribute', (_node: Element, data: UponSanitizeAttributeHookEvent) => {
    if (EVENT_ATTR.test(data.attrName)) {
      data.keepAttr = false;
      return;
    }
    if (data.attrName === 'href' || data.attrName === 'src' || data.attrName === 'xlink:href') {
      const value = data.attrValue.trim();
      if (/^\s*(javascript|vbscript):/i.test(value)) {
        data.keepAttr = false;
      }
    }
  });
}

function sanitize(html: string, config: Config): string {
  if (!html) return html;
  if (typeof window === 'undefined') return html;
  installHooks();
  return String(DOMPurify.sanitize(html, config));
}

/** Strip active content from Mermaid SVG before DOM insertion. */
export function sanitizeMermaidSvg(svg: string): string {
  return sanitize(svg, MERMAID_SVG_CONFIG);
}

/** Defense-in-depth pass on rendered markdown HTML (browser/webview only). */
export function sanitizeMarkdownHtml(html: string): string {
  return sanitize(html, MARKDOWN_HTML_CONFIG);
}

const UNSAFE_LINK_URL_SCHEME = /^\s*(javascript|vbscript|data):/i;
const UNSAFE_IMAGE_URL_SCHEME = /^\s*(javascript|vbscript):/i;

/** Block dangerous URL schemes in markdown links. */
export function sanitizeMarkdownLinkUrl(url: string): string {
  return UNSAFE_LINK_URL_SCHEME.test(url) ? '#' : url;
}

/** Block dangerous URL schemes in markdown images while allowing data URIs. */
export function sanitizeMarkdownImageUrl(url: string): string {
  return UNSAFE_IMAGE_URL_SCHEME.test(url) ? '#' : url;
}
