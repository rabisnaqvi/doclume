import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

let renderMermaidDiagrams: typeof import('@doclume/core')['renderMermaidDiagrams'];

const mermaidModule = vi.hoisted(() => ({
  initialize: vi.fn(),
  parse: vi.fn(async () => undefined),
  render: vi.fn(async (_id: string, code: string) => ({
    svg: `<svg xmlns="http://www.w3.org/2000/svg"><text>${code}</text></svg>`,
  })),
}));

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  observed = new Set<Element>();
  constructor(private readonly callback: IntersectionObserverCallback) {
    FakeIntersectionObserver.instances.push(this);
  }
  observe = (el: Element) => { this.observed.add(el); };
  unobserve = (el: Element) => { this.observed.delete(el); };
  disconnect = () => { this.observed.clear(); };
  trigger(el: Element, isIntersecting: boolean) {
    this.callback([
      {
        target: el,
        isIntersecting,
        intersectionRatio: isIntersecting ? 1 : 0,
      } as IntersectionObserverEntry,
    ], this as unknown as IntersectionObserver);
  }
}

describe('renderMermaidDiagrams', () => {
  beforeEach(async () => {
    FakeIntersectionObserver.instances = [];
    mermaidModule.initialize.mockClear();
    mermaidModule.parse.mockClear();
    mermaidModule.render.mockClear();
    (globalThis as any).IntersectionObserver = FakeIntersectionObserver;
    ({ renderMermaidDiagrams } = await import('@doclume/core'));
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete (globalThis as any).IntersectionObserver;
  });

  it('renders visible nodes immediately', async () => {
    document.body.innerHTML = `
      <div id="root">
        <div class="mermaid" data-src="flowchart TD\nA-->B"></div>
      </div>
    `;

    const root = document.getElementById('root');
    const node = root?.querySelector('.mermaid') as HTMLElement;
    vi.spyOn(node, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, top: 0, left: 0, right: 10, bottom: 10,
      width: 10, height: 10, toJSON() {},
    });

    await renderMermaidDiagrams(root, 'manual', { runtime: mermaidModule });

    expect(mermaidModule.render).toHaveBeenCalledTimes(1);
    expect(node.innerHTML).toContain('<svg');
  });

  it('waits for intersection before rendering hidden nodes', async () => {
    document.body.innerHTML = `
      <div id="root">
        <div class="mermaid" data-src="flowchart TD\nA-->B"></div>
      </div>
    `;

    const root = document.getElementById('root');
    const node = root?.querySelector('.mermaid') as HTMLElement;
    const rectSpy = vi.spyOn(node, 'getBoundingClientRect');
    rectSpy.mockReturnValue({
      x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0,
      width: 0, height: 0, toJSON() {},
    });

    await renderMermaidDiagrams(root, 'manual', { runtime: mermaidModule });
    expect(mermaidModule.render).toHaveBeenCalledTimes(0);
    expect(FakeIntersectionObserver.instances[0]?.observed.has(node)).toBe(true);

    rectSpy.mockReturnValue({
      x: 0, y: 0, top: 0, left: 0, right: 10, bottom: 10,
      width: 10, height: 10, toJSON() {},
    });
    FakeIntersectionObserver.instances[0]?.trigger(node, true);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mermaidModule.render).toHaveBeenCalledTimes(1);
    expect(node.innerHTML).toContain('<svg');
  });

  it('stops on abort before intersection', async () => {
    document.body.innerHTML = `
      <div id="root">
        <div class="mermaid" data-src="flowchart TD\nA-->B"></div>
      </div>
    `;

    const root = document.getElementById('root');
    const node = root?.querySelector('.mermaid') as HTMLElement;
    vi.spyOn(node, 'getBoundingClientRect').mockReturnValue({
      x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0,
      width: 0, height: 0, toJSON() {},
    });

    const controller = new AbortController();
    const done = renderMermaidDiagrams(root, 'manual', { signal: controller.signal, runtime: mermaidModule });
    controller.abort();
    await done;

    FakeIntersectionObserver.instances[0]?.trigger(node, true);
    await Promise.resolve();

    expect(mermaidModule.render).toHaveBeenCalledTimes(0);
    expect(node.dataset.src).toContain('flowchart TD');
  });
});
