// ===== リスナー用UI制御 =====

import { state } from '../main.js';
import { connectWs, loadYP, refreshView } from '../websocket.js';
import { showMessage } from '../utils.js';
import { MESSAGES } from '../constants.js';

/**
 * リスナー用UI機能を初期化
 */
export function initViewerControls() {
  initYpButtons();
  initCustomIpButton();
  initOffsetSlider();
  initRefreshButton();
  window.addEventListener('otsumamiTabReady', initRefreshButton);
  
  console.log('[ViewerControls] Initialized');
}

/**
 * YP関連ボタン
 */
function initYpButtons() {
  const reloadYpBtn = document.getElementById('reloadYpBtn');
  const connectBtn = document.getElementById('connectBtn');
  
  if (reloadYpBtn) {
    reloadYpBtn.addEventListener('click', loadYP);
  }
  
  if (connectBtn) {
    connectBtn.addEventListener('click', () => connectWs());
  }
}

/**
 * カスタムIP接続ボタン
 */
function initCustomIpButton() {
  const customConnectBtn = document.getElementById('customConnectBtn');
  
  if (!customConnectBtn) return;
  
  customConnectBtn.addEventListener('click', () => {
    const customIpInput = document.getElementById('customIp');
    if (!customIpInput) return;
    
    const customIp = customIpInput.value.trim();
    if (!customIp) {
      showMessage(MESSAGES.IP_REQUIRED, 'warning');
      return;
    }
    connectWs(customIp);
  });
}

/**
 * ディレイスライダー
 */
function initOffsetSlider() {
  const offsetSlider = document.getElementById('offsetSlider');
  const offsetLabel = document.getElementById('offsetLabel');
  
  if (!offsetSlider || !offsetLabel) return;
  
  offsetSlider.addEventListener('input', () => {
    state.viewerOffsetSec = parseInt(offsetSlider.value, 10);
    offsetLabel.textContent = state.viewerOffsetSec + ' 秒';
  });
}

/**
 * リフレッシュボタン
 */
function initRefreshButton() {
  const refreshBtn = document.getElementById('refreshBtn');
  
  if (!refreshBtn || refreshBtn.dataset.refreshBound) return;
  refreshBtn.dataset.refreshBound = 'true';
  
  refreshBtn.addEventListener('click', refreshView);
}
