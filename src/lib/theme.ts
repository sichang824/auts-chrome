export type ThemeMode = 'system' | 'light' | 'dark';

function applyClass(isDark: boolean) {
  const root = document.documentElement;
  root.classList.toggle('dark', isDark);
}

export function computeSystemDark(): boolean {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function applyTheme(mode: ThemeMode) {
  if (mode === 'system') {
    applyClass(computeSystemDark());
    return;
  }
  applyClass(mode === 'dark');
}

export function watchSystemTheme(onChange: (isDark: boolean) => void): () => void {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  const listener = (e: MediaQueryListEvent) => onChange(e.matches);
  mq.addEventListener('change', listener);
  return () => mq.removeEventListener('change', listener);
}


