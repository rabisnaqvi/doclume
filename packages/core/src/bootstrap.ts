export function bootstrapRoot(render: (root: HTMLElement) => void): void {
  const root = document.getElementById('root');
  if (!root) throw new Error('Doclume root element not found');
  render(root);
}
