// ===== カスタムタイトルバー v5（テーマ切り替え対応） =====

// タイトルバーを作成
function createTitlebar() {
  // 既存のタイトルバーがあれば削除
  const existing = document.querySelector('.custom-titlebar');
  if (existing) {
    existing.remove();
  }
  
  // ダークモードの状態を確認
  const isDark = document.body.classList.contains('dark-mode');
  const logoSrc = isDark ? '/assets/title-dark.png' : '/assets/title.png';
  
  const titlebar = document.createElement('div');
  titlebar.className = 'custom-titlebar';
  titlebar.innerHTML = `
    <div class="title-left">
      <div class="title-logo">
        <img src="${logoSrc}" alt="おつまみキャスト">
      </div>
    </div>
    
    <div class="role-selector">
      <button class="role-btn active" data-role="viewer">リスナー</button>
      <button class="role-btn" data-role="host">配信者</button>
    </div>
    
    <div class="title-right">
      <button class="theme-toggle-btn" title="ライト/ダーク切り替え">🌓</button>
    </div>
    
    <div class="window-controls">
      <button class="minimize-btn" title="最小化">─</button>
      <button class="maximize-btn" title="最大化">□</button>
      <button class="close-btn" title="閉じる">×</button>
    </div>
  `;
  
  document.body.insertBefore(titlebar, document.body.firstChild);
  
  // イベントリスナー設定
  setupTitlebarEvents();
  
  console.log('Custom titlebar v5 (with theme toggle) created');
}

// タイトルバーのイベント設定
function setupTitlebarEvents() {
  // ロール切り替え
  const roleButtons = document.querySelectorAll('.custom-titlebar .role-btn');
  roleButtons.forEach(btn => {
btn.addEventListener('click', () => {
  const role = btn.dataset.role;
  
  // ★ 元のボタンをクリック（先に実行）
  const originalBtn = document.getElementById(role === 'viewer' ? 'viewerBtn' : 'hostBtn');
  if (originalBtn) {
    originalBtn.click();
  }
  
  // ★ 実際にロールが変更されたかを確認してから表示を更新
  // （role-switcher.jsのotsumamiRoleChangedイベントで自動更新される）
});
  });
  
  // テーマ切り替えボタン
  const themeToggle = document.querySelector('.theme-toggle-btn');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      if (window.toggleDarkMode) {
        window.toggleDarkMode();
      }
    });
  }
  
  // ウィンドウ制御
  if (window.electronAPI) {
    const minimizeBtn = document.querySelector('.minimize-btn');
    const maximizeBtn = document.querySelector('.maximize-btn');
    const closeBtn = document.querySelector('.close-btn');
    
    if (minimizeBtn) {
      minimizeBtn.addEventListener('click', () => {
        window.electronAPI.minimizeWindow();
      });
    }
    
    if (maximizeBtn) {
      maximizeBtn.addEventListener('click', () => {
        window.electronAPI.maximizeWindow();
      });
    }
    
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        window.electronAPI.closeWindow();
      });
    }
  }
}

// DOMContentLoaded時に作成
window.addEventListener('DOMContentLoaded', () => {
  createTitlebar();
  console.log('Custom titlebar v5 module initialized');
});

// ★ ロール変更イベントを受信してボタンを更新
window.addEventListener('otsumamiRoleChanged', (event) => {
  const newRole = event.detail?.role || window.otsumamiRole || 'viewer';
  
  const roleButtons = document.querySelectorAll('.custom-titlebar .role-btn');
  roleButtons.forEach(btn => {
    btn.classList.remove('active');
    if (btn.dataset.role === newRole) {
      btn.classList.add('active');
    }
  });
  
  console.log('[CustomTitlebar] ロール表示更新:', newRole);
});

console.log('Custom titlebar v5 script loaded');
