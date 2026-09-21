// ===== UI制御（リファクタリング版） =====

import { initRoleSwitcher } from './ui/role-switcher.js';
import { initHostControls } from './ui/host-controls.js';
import { initViewerControls } from './ui/viewer-controls.js';
import { initButtons } from './ui/buttons.js';
import { initPlayerIfReady } from './player.js';

/**
 * UI機能を初期化
 */
function initUI() {
  console.log('[UI] Initializing...');
  
  // 各機能モジュールを初期化
  initRoleSwitcher();
  initHostControls();
  initViewerControls();
  initButtons();
  
  console.log('[UI] All modules initialized');
}
/**
 * viewer固定時のホストUI制御
 */
function applyViewerOnlyUI() {
  if (!window.OTSUNAMI_FORCE_VIEWER) return;

  console.log('[UI] Viewer固定モード → ホストUI無効化');

  // ホスト開始ボタン
  const startHostBtn = document.getElementById('startHostBtn');
  if (startHostBtn) {
    startHostBtn.disabled = true;
    startHostBtn.style.opacity = '0.4';
    startHostBtn.title = 'リスナー専用モードでは使用できません';
  }

  // 配信者用接続ライン（丸ごと）
  const hostLine = document.getElementById('hostConnectionLine');
  if (hostLine) {
    hostLine.style.opacity = '0.3';
    hostLine.style.pointerEvents = 'none';
  }

  // ロール切替ボタン（もし表示されていた場合）
  const hostBtn = document.getElementById('hostBtn');
  if (hostBtn) {
    hostBtn.disabled = true;
    hostBtn.style.opacity = '0.4';
  }
}
/**
 * プレイヤー初期化処理
 */
function initPlayer() {
  initPlayerIfReady();
}

// ページ読み込み時に初期化
window.addEventListener('load', () => {
  console.log('[UI] Page loaded');
  initUI();
  applyViewerOnlyUI();
  initPlayer();

  window.addEventListener('otsumamiTabReady', () => {
    initPlayerIfReady();
  });

  // ===== リスナー専用：自動接続 =====
  if (window.OTSUNAMI_FORCE_VIEWER) {
    setTimeout(async () => {
      try {
        // すでに接続済みなら何もしない
        if (window.state?.ws && window.state.ws.readyState === WebSocket.OPEN) {
          return;
        }

        const { connectWs } = await import('./websocket.js');
        connectWs(null);

        console.log('[AutoViewer] 接続ボタンを押したのと同等の処理を実行');
      } catch (e) {
        console.error('[AutoViewer] 自動接続に失敗:', e);
      }
    }, 300);
  }
});
