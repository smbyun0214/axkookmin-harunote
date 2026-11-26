// =========================================================
// 배경 설정: 자동(기기 설정 따라감) → 흰색 → 검은색 순서로 바뀝니다.
// 고른 값은 브라우저에 저장되어 새로고침해도 유지됩니다.
// =========================================================
import { toast } from './ui.js';

const KEY = 'harunote-theme';
const ORDER = ['auto', 'light', 'dark'];
const LABEL = { auto: '자동', light: '흰색', dark: '검은색' };
const ICON = {
  auto: '<circle cx="12" cy="12" r="8"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/>',
  light: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M5.6 5.6L7 7M17 17l1.4 1.4M3 12h2M19 12h2M5.6 18.4L7 17M17 7l1.4-1.4"/>',
  dark: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
};

export function getTheme() {
  try {
    const t = localStorage.getItem(KEY);
    return ORDER.includes(t) ? t : 'auto';
  } catch {
    return 'auto';
  }
}

export function applyTheme(theme) {
  if (theme === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = theme;
  const label = document.querySelector('.theme-label');
  const iconEl = document.querySelector('.theme-icon');
  if (label) label.textContent = LABEL[theme];
  if (iconEl) iconEl.innerHTML = ICON[theme];
  const btn = document.querySelector('[data-action="theme"]');
  if (btn) btn.title = `배경: ${LABEL[theme]} (눌러서 바꾸기)`;
}

export function cycleTheme() {
  const next = ORDER[(ORDER.indexOf(getTheme()) + 1) % ORDER.length];
  try {
    localStorage.setItem(KEY, next);
  } catch {
    /* 저장이 안 되면 이번 화면에만 적용 */
  }
  applyTheme(next);
  toast(`배경: ${LABEL[next]}${next === 'auto' ? ' (기기 설정을 따라가요)' : ''}`);
}
