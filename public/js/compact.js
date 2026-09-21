// ===== compact.js 完全版 =====

console.log('Compact mode script loading...');

// ミニマムモード切り替え
function toggleMinimumMode() {
  document.body.classList.toggle('minimum-mode');
  
  const isMinimum = document.body.classList.contains('minimum-mode');
  console.log('Minimum mode:', isMinimum ? 'ON' : 'OFF');
  
  // YouTube風バーを作成（まだなければ）
  if (isMinimum && !document.getElementById('youtubeStyleBar')) {
    createYouTubeBar();
  }
}

// YouTube風バーを作成
function createYouTubeBar() {
  const bar = document.createElement('div');
  bar.id = 'youtubeStyleBar';
  bar.innerHTML = `
    <button class="yt-compact-btn" title="通常モードに戻る">📐</button>
    <div class="yt-drop-zone">📎 ドロップ</div>
    <input type="text" class="yt-url-input" id="ytUrlInput" placeholder="URL">
    <button class="yt-load-btn">読</button>
    <button class="yt-clipboard-btn">📋</button>
  `;
  
  document.body.appendChild(bar);
  
  console.log('YouTube style bar created');
  
  // イベントリスナー設定
  setupYouTubeBarEvents();
}

// YouTube風バーのイベント設定
function setupYouTubeBarEvents() {
  const bar = document.getElementById('youtubeStyleBar');
  if (!bar) return;
  
  // 📐ボタン（通常モードに戻る）
  bar.querySelector('.yt-compact-btn')?.addEventListener('click', () => {
    toggleMinimumMode();
  });
  
  // 読み込みボタン
  bar.querySelector('.yt-load-btn')?.addEventListener('click', () => {
    const input = document.getElementById('ytUrlInput');
    const url = input?.value.trim();
    
    if (!url) {
      if (window.alertWithFocus) {
        window.alertWithFocus('URLを入力してください');
      } else {
        alert('URLを入力してください');
      }
      return;
    }
    
    // 元のURL入力欄にも反映
    const mainUrlInput = document.getElementById('ytUrl');
    if (mainUrlInput) {
      mainUrlInput.value = url;
    }
    
    // 読み込みボタンをクリック
    const loadBtn = document.getElementById('loadBtn');
    if (loadBtn) {
      loadBtn.click();
    }
  });
  
  // クリップボードボタン
  bar.querySelector('.yt-clipboard-btn')?.addEventListener('click', () => {
    const clipboardBtn = document.getElementById('clipboardBtn');
    if (clipboardBtn) {
      clipboardBtn.click();
    }
  });
  
  // ドロップゾーン
  const dropZone = bar.querySelector('.yt-drop-zone');
  if (dropZone) {
    setupDropZone(dropZone);
  }
  
  console.log('YouTube bar events setup complete');
}

// ドロップゾーンのイベント設定
function setupDropZone(dropZone) {
  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.style.borderColor = '#0078d4';
    dropZone.style.background = '#e6f2ff';
  });
  
  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.style.borderColor = '#c0c0c0';
    dropZone.style.background = '#fafafa';
  });
  
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.style.borderColor = '#c0c0c0';
    dropZone.style.background = '#fafafa';
    
    const url = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text/uri-list');
    
    if (!url) {
      if (window.alertWithFocus) {
        window.alertWithFocus('URLが取得できませんでした');
      } else {
        alert('URLが取得できませんでした');
      }
      return;
    }
    
    // URL入力欄に反映
    const input = document.getElementById('ytUrlInput');
    if (input) {
      input.value = url;
    }
    
    // 元のURL入力欄にも反映
    const mainUrlInput = document.getElementById('ytUrl');
    if (mainUrlInput) {
      mainUrlInput.value = url;
    }
    
    // YouTubeのURLかチェック
    const vid = window.parseVideoId ? window.parseVideoId(url) : null;
    
    if (!vid) {
      if (window.alertWithFocus) {
        window.alertWithFocus('YouTube URLではありません');
      } else {
        alert('YouTube URLではありません');
      }
      return;
    }
    
    // 自動読み込み
    const loadBtn = document.getElementById('loadBtn');
    if (loadBtn && !loadBtn.disabled) {
      loadBtn.click();
    }
  });
}

// ページ読み込み時の初期化
window.addEventListener('DOMContentLoaded', () => {
  console.log('Compact mode initializing...');
  
  // 📐ボタン（通常モード）
  const minimumModeBtn = document.getElementById('minimumModeBtn');
  if (minimumModeBtn) {
    minimumModeBtn.addEventListener('click', () => {
      toggleMinimumMode();
    });
    console.log('Minimum mode button initialized');
  }
  
  // 初期状態でYouTube風バーを作成（非表示）
  if (!document.getElementById('youtubeStyleBar')) {
    createYouTubeBar();
  }
  
  console.log('Compact mode (YouTube bar) initialized');
});

console.log('Compact mode script loaded');

// グローバルに公開
window.toggleMinimumMode = toggleMinimumMode;
