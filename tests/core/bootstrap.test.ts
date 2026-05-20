import { bootstrapRoot } from '@doclume/core';

describe('bootstrapRoot', () => {
  it('throws when #root is missing', () => {
    document.body.innerHTML = '<div id="app"></div>';

    expect(() => bootstrapRoot(() => {})).toThrow('Doclume root element not found');
  });

  it('passes the root element through', () => {
    document.body.innerHTML = '<div id="root"></div>';
    const render = vi.fn();

    bootstrapRoot(render);

    expect(render).toHaveBeenCalledTimes(1);
    expect(render).toHaveBeenCalledWith(document.getElementById('root'));
  });
});
