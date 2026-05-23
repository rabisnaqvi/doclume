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

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  observed = new Set<Element>();
  constructor(private readonly callback: ResizeObserverCallback) {
    FakeResizeObserver.instances.push(this);
  }
  observe = (el: Element) => { this.observed.add(el); };
  unobserve = (el: Element) => { this.observed.delete(el); };
  disconnect = () => { this.observed.clear(); };
  trigger(...elements: Element[]) {
    this.callback(
      elements.map((target) => ({ target } as ResizeObserverEntry)),
      this as unknown as ResizeObserver,
    );
  }
}

describe('renderMermaidDiagrams', () => {
  beforeEach(async () => {
    FakeIntersectionObserver.instances = [];
    FakeResizeObserver.instances = [];
    mermaidModule.initialize.mockClear();
    mermaidModule.parse.mockClear();
    mermaidModule.render.mockClear();
    (globalThis as any).IntersectionObserver = FakeIntersectionObserver;
    (globalThis as any).ResizeObserver = FakeResizeObserver;
    ({ renderMermaidDiagrams } = await import('@doclume/core'));
  });

  afterEach(() => {
    document.body.innerHTML = '';
    delete (globalThis as any).IntersectionObserver;
    delete (globalThis as any).ResizeObserver;
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

  it('renders the initial visible batch in parallel', async () => {
    document.body.innerHTML = `
      <div id="root">
        <div class="mermaid" data-src="flowchart TD\nA-->B"></div>
        <div class="mermaid" data-src="flowchart TD\nC-->D"></div>
      </div>
    `;

    const root = document.getElementById('root');
    const nodes = Array.from(root?.querySelectorAll<HTMLElement>('.mermaid') ?? []);
    for (const node of nodes) {
      vi.spyOn(node, 'getBoundingClientRect').mockReturnValue({
        x: 0, y: 0, top: 0, left: 0, right: 10, bottom: 10,
        width: 10, height: 10, toJSON() {},
      });
    }

    let releaseRender: (() => void) | undefined;
    const renderGate = new Promise<void>((resolve) => {
      releaseRender = resolve;
    });
    mermaidModule.render.mockImplementation(async (_id: string, code: string) => {
      await renderGate;
      return {
        svg: `<svg xmlns="http://www.w3.org/2000/svg"><text>${code}</text></svg>`,
      };
    });

    const done = renderMermaidDiagrams(root, 'manual', { runtime: mermaidModule });
    await vi.waitFor(() => expect(mermaidModule.render).toHaveBeenCalledTimes(2));
    releaseRender?.();
    await done;

    expect(nodes[0].innerHTML).toContain('<svg');
    expect(nodes[1].innerHTML).toContain('<svg');
  });

  it('removes Mermaid temp nodes after rendering', async () => {
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

    mermaidModule.render.mockImplementationOnce(async (id: string, code: string) => {
      const temp = document.createElement('div');
      temp.id = `d${id}`;
      temp.dataset.code = code;
      document.body.appendChild(temp);
      return {
        svg: `<svg xmlns="http://www.w3.org/2000/svg"><text>${code}</text></svg>`,
      };
    });

    await renderMermaidDiagrams(root, 'manual', { runtime: mermaidModule });

    const [renderId] = mermaidModule.render.mock.calls[0] ?? [];
    expect(renderId).toBeTypeOf('string');
    expect(node.innerHTML).toContain('<svg');
    expect(document.getElementById(`d${renderId}`)).toBeNull();
  });

  it('rechecks only resized nodes', async () => {
    document.body.innerHTML = `
      <div id="root">
        <div class="mermaid" data-src="flowchart TD\nA-->B"></div>
        <div class="mermaid" data-src="flowchart TD\nC-->D"></div>
      </div>
    `;

    const root = document.getElementById('root');
    const nodes = Array.from(root?.querySelectorAll<HTMLElement>('.mermaid') ?? []);
    const [first, second] = nodes;
    const firstRect = vi.spyOn(first, 'getBoundingClientRect');
    const secondRect = vi.spyOn(second, 'getBoundingClientRect');
    firstRect.mockReturnValue({
      x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0,
      width: 0, height: 0, toJSON() {},
    });
    secondRect.mockReturnValue({
      x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0,
      width: 0, height: 0, toJSON() {},
    });

    await renderMermaidDiagrams(root, 'manual', { runtime: mermaidModule });
    expect(mermaidModule.render).toHaveBeenCalledTimes(0);
    expect(FakeResizeObserver.instances[0]?.observed.has(first)).toBe(true);
    expect(FakeResizeObserver.instances[0]?.observed.has(second)).toBe(true);

    mermaidModule.render.mockClear();
    firstRect.mockClear();
    secondRect.mockClear();
    firstRect.mockReturnValue({
      x: 0, y: 0, top: 0, left: 0, right: 10, bottom: 10,
      width: 10, height: 10, toJSON() {},
    });

    FakeResizeObserver.instances[0]?.trigger(first);
    await vi.waitFor(() => expect(mermaidModule.render).toHaveBeenCalledTimes(1));

    expect(firstRect).toHaveBeenCalled();
    expect(secondRect).not.toHaveBeenCalled();
    expect(first.innerHTML).toContain('<svg');
    expect(second.innerHTML).toBe('');
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

  it('does not duplicate an in-flight render when rechecked', async () => {
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

    let releaseRender: (() => void) | undefined;
    const renderGate = new Promise<void>((resolve) => {
      releaseRender = resolve;
    });
    mermaidModule.render.mockImplementationOnce(async (_id: string, code: string) => {
      await renderGate;
      return {
        svg: `<svg xmlns="http://www.w3.org/2000/svg"><text>${code}</text></svg>`,
      };
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

    document.dispatchEvent(new Event('visibilitychange'));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mermaidModule.render).toHaveBeenCalledTimes(1);

    releaseRender?.();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(node.innerHTML).toContain('<svg');
  });

  it('retries deferred Mermaid nodes on visibilitychange', async () => {
    document.body.innerHTML = `
      <div id="root">
        <div class="mermaid" data-src="flowchart TD\nA-->B"></div>
        <div class="mermaid" data-src="flowchart TD\nB-->C"></div>
      </div>
    `;

    const root = document.getElementById('root');
    const nodes = Array.from(root?.querySelectorAll<HTMLElement>('.mermaid') ?? []);
    const hiddenRect = { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON() {} };
    const visibleRect = { x: 0, y: 0, top: 0, left: 0, right: 12, bottom: 12, width: 12, height: 12, toJSON() {} };
    const visible = new Set<HTMLElement>();

    nodes.forEach((node) => {
      vi.spyOn(node, 'getBoundingClientRect').mockImplementation(() => (visible.has(node) ? visibleRect : hiddenRect));
    });

    let rafCallback: FrameRequestCallback | undefined;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafCallback = cb;
      return 1;
    });

    await renderMermaidDiagrams(root, 'manual', { runtime: mermaidModule });
    expect(mermaidModule.render).toHaveBeenCalledTimes(0);
    expect(nodes.every((node) => FakeIntersectionObserver.instances[0]?.observed.has(node))).toBe(true);

    visible.add(nodes[0]);
    visible.add(nodes[1]);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(mermaidModule.render).toHaveBeenCalledTimes(0);

    rafCallback?.(0);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mermaidModule.render).toHaveBeenCalledTimes(2);
    nodes.forEach((node) => expect(node.innerHTML).toContain('<svg'));
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
