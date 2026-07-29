/**
 * 诗思工作台 - 主题管理
 * 浅色/深色模式切换，记忆用户选择
 */

const THEME_KEY = 'shisi-theme';

function getStoredTheme() {
  return localStorage.getItem(THEME_KEY) || 'auto';
}

function applyTheme(theme) {
  const html = document.documentElement;
  if (theme === 'dark') {
    html.setAttribute('data-theme', 'dark');
  } else if (theme === 'light') {
    html.setAttribute('data-theme', 'light');
  } else {
    // auto: 移除手动设置，跟随系统
    html.removeAttribute('data-theme');
  }
  // 更新 meta theme-color
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) {
    if (theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      metaTheme.setAttribute('content', '#0F0A1E');
    } else {
      metaTheme.setAttribute('content', '#C77DFF');
    }
  }
}

function toggleTheme() {
  const current = getStoredTheme();
  let next;
  if (current === 'light') {
    next = 'dark';
  } else if (current === 'dark') {
    next = 'auto';
  } else {
    next = 'light';
  }
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
  return next;
}

function initTheme() {
  const stored = getStoredTheme();
  applyTheme(stored);

  // 监听系统主题变化（仅在 auto 模式下生效）
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getStoredTheme() === 'auto') {
      applyTheme('auto');
    }
  });
}

export { initTheme, toggleTheme, getStoredTheme, applyTheme };
