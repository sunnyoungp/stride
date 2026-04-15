import { THEMES, type ThemeId } from './themes';

export function applyTheme(id: ThemeId) {
  const theme = THEMES.find(t => t.id === id);
  if (!theme) return;
  const root = document.documentElement;
  root.classList.remove('dark', 'light');
  root.classList.add(theme.type === 'dark' ? 'dark' : 'light');
  Object.entries(theme).forEach(([key, val]) => {
    if (key.startsWith('--')) root.style.setProperty(key, val as string);
  });
}

export function getThemeById(id: string): ThemeId {
  // Legacy value migration
  if (id === 'dark') return 'warm-dark';
  if (id === 'light') return 'neutral-light';
  if (id === 'system') return 'neutral-light';
  const found = THEMES.find(t => t.id === id);
  return found ? (id as ThemeId) : 'neutral-light';
}
