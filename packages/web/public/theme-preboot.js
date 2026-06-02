(() => {
  const migrate = {
    paper: 'library',
    ivory: 'manual',
    dusk: 'lamplight',
    carbon: 'console',
  };

  const fallback =
    typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'lamplight'
      : 'library';

  try {
    const raw = window.localStorage.getItem('doclume-prefs-v1');
    const prefs = raw ? JSON.parse(raw) : null;
    const theme = migrate[prefs?.theme] ?? prefs?.theme;
    const allowed = new Set(['library', 'lamplight', 'manual', 'console', 'contrast']);
    document.documentElement.dataset.theme = allowed.has(theme) ? theme : fallback;
  } catch {
    document.documentElement.dataset.theme = fallback;
  }
})();
