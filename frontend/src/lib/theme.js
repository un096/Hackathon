export const PALETTES = [
  { id: 'sapphire', name: 'Corporate Sapphire', color: '#1d4ed8' },
  { id: 'ocean', name: 'Executive Ocean', color: '#0284c7' },
  { id: 'emerald', name: 'Fintech Emerald', color: '#059669' },
  { id: 'steel', name: 'Graphite Steel', color: '#475569' },
];

export function getPalette() {
  try {
    return localStorage.getItem('tb-palette') || 'sapphire';
  } catch {
    return 'sapphire';
  }
}

export function setPalette(paletteId) {
  document.documentElement.setAttribute('data-palette', paletteId);
  try {
    localStorage.setItem('tb-palette', paletteId);
  } catch {
    /* ignore */
  }
  return paletteId;
}

export function toggleTheme() {
  const dark = document.documentElement.classList.toggle('dark');
  try {
    localStorage.setItem('tb-theme', dark ? 'dark' : 'light');
  } catch {
    /* ignore */
  }
  return dark;
}

export const isDark = () => document.documentElement.classList.contains('dark');
