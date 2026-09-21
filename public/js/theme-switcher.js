// ===== テーマ切り替え v2（4モード対応） =====

const THEMES = ['light', 'dark', 'glitch', 'vivid'];
let currentThemeIndex = 0;

// ローカルストレージから設定を読み込み
function loadTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  currentThemeIndex = THEMES.indexOf(savedTheme);
  if (currentThemeIndex === -1) currentThemeIndex = 0;
  
  applyTheme(THEMES[currentThemeIndex]);
}

// テーマを適用
function applyTheme(theme) {
  // 全テーマクラスを削除
  document.body.classList.remove('dark-mode', 'theme-glitch', 'theme-vivid');
  
  // 新しいテーマを適用
  if (theme === 'dark') {
    document.body.classList.add('dark-mode');
  } else if (theme === 'glitch') {
    document.body.classList.add('theme-glitch');
  } else if (theme === 'vivid') {
    document.body.classList.add('theme-vivid');
  }
  
  // ローカルストレージに保存
  localStorage.setItem('theme', theme);
  
  // ロゴを更新
  updateLogo(theme);

// ★ ここでインジケーター/オーバーレイへ現在テーマを通知
  if (window.electronAPI && typeof window.electronAPI.featureToggled === 'function') {
    window.electronAPI.featureToggled('theme', theme);
  }
  
  console.log('Theme:', theme);
}

// 次のテーマに切り替え
function nextTheme() {
  currentThemeIndex = (currentThemeIndex + 1) % THEMES.length;
  applyTheme(THEMES[currentThemeIndex]);
}

// ロゴ画像を切り替え
function updateLogo(theme) {
  const logoImg = document.querySelector('.custom-titlebar .title-logo img');
  
  if (logoImg) {
    // ダーク系テーマは白ロゴ、それ以外は黒ロゴ
    const useDarkLogo = (theme === 'dark' || theme === 'glitch' || theme === 'vivid');
    logoImg.src = useDarkLogo ? '/assets/title-dark.png' : '/assets/title.png';
  }
}

// ページ読み込み時に適用
window.addEventListener('DOMContentLoaded', () => {
  loadTheme();
  console.log('Theme system initialized');
});

// グローバル関数として公開（後方互換性）
window.toggleDarkMode = nextTheme;
window.nextTheme = nextTheme;

console.log('Theme switcher v2 loaded (4 themes)');
