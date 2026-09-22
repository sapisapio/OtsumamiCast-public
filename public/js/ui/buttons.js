import { connectionUrl } from '../connection-target.js';
// ===== その他ボタン機能 =====

import { state, logStatus } from '../main.js';
import { openInBrowser, showMessage } from '../utils.js';
import { URLS, MESSAGES } from '../constants.js';

/**
 * その他ボタン機能を初期化
 */
export function initButtons() {
  initOpenBrowserButtons();
  initUpnpButton();
  initPortCheckButton();
  initVideoWindowButton();
  initServerPortSettings();
  
  console.log('[Buttons] Initialized');
}

/**
 * ブラウザで開くボタン（ホスト/リスナー両対応）
 */
function initOpenBrowserButtons() {
  const openBrowserBtnHost = document.getElementById('openBrowserBtnHost');
  const openBrowserBtnViewer = document.getElementById('openBrowserBtnViewer');

  const toHttpFromWs = (wsAddress) => {
    if (!wsAddress || typeof wsAddress !== 'string') return null;
    try {
      const wsUrl = new URL(wsAddress);
      const protocol = wsUrl.protocol === 'wss:' ? 'https:' : 'http:';
      return `${protocol}//${wsUrl.host}`;
    } catch (error) {
      return null;
    }
  };

  const normalizeViewerTarget = (rawTarget) => {
    if (!rawTarget || typeof rawTarget !== 'string') return null;
    const input = rawTarget.trim();
    if (!input) return null;
    try {
      return toHttpFromWs(connectionUrl(input));
    } catch (error) {
      return null;
    }
  };

  const resolveViewerOpenUrl = () => {
    const connectedUrl = toHttpFromWs(state.ws?.url);
    if (connectedUrl) return connectedUrl;

    const customIpInput = document.getElementById('customIp');
    const customValue = normalizeViewerTarget(customIpInput?.value || '');
    if (customValue) return customValue;

    const hostSelect = document.getElementById('hostSelect');
    const selectedValue = normalizeViewerTarget(hostSelect?.value || '');
    if (selectedValue) return selectedValue;

    return URLS.LOCAL_SERVER;
  };
  
  if (openBrowserBtnHost) {
    openBrowserBtnHost.addEventListener('click', async () => {
      await openInBrowser(URLS.LOCAL_SERVER);
    });
  }
  
  if (openBrowserBtnViewer) {
    openBrowserBtnViewer.addEventListener('click', async () => {
      await openInBrowser(resolveViewerOpenUrl());
    });
  }
}

/**
 * ポート自動解放ボタン
 */
function initUpnpButton() {
  const autoOpenPortBtn = document.getElementById('autoOpenPortBtn');
  
  if (!autoOpenPortBtn) return;
  
  autoOpenPortBtn.addEventListener('click', async () => {
    const originalText = autoOpenPortBtn.textContent;
    
    autoOpenPortBtn.textContent = '開放中...';
    autoOpenPortBtn.disabled = true;
    
    try {
      const response = await fetch(URLS.UPNP_OPEN, {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (data.success) {
        showMessage('? ' + data.message, 'success');
        logStatus('UPnP: ポート開放成功');
      } else {
        const reason = data.message || data.error || 'ポート自動開放に失敗しました';
        showMessage('?? ' + reason + '\n\n手動でルーターの設定を行ってください。', 'warning');
        logStatus('UPnP: ポート開放失敗');
      }
    } catch (e) {
      console.error('UPnPエラー:', e);
      showMessage('?? ポート自動開放に失敗しました。\n\nルーターがUPnPに対応していないか、無効になっている可能性があります。\n手動でルーターの設定を行ってください。', 'error');
      logStatus('UPnP: エラー');
    } finally {
      autoOpenPortBtn.textContent = originalText;
      autoOpenPortBtn.disabled = false;
    }
  });
}

/**
 * ポート開放確認ボタン
 */
function initPortCheckButton() {
  const checkPortBtn = document.getElementById('checkPortBtn');
  if (!checkPortBtn) return;

  checkPortBtn.addEventListener('click', async () => {
    await openInBrowser(URLS.PORT_CHECK);
  });
}

/**
 * 動画ウィンドウを開くボタン
 */
function initVideoWindowButton() {
  const openVideoWindowBtn = document.getElementById('openVideoWindowBtn');
  
  if (!openVideoWindowBtn) return;
  
  openVideoWindowBtn.addEventListener('click', () => {
    if (!window.electronAPI?.openVideoWindow) {
      showMessage(MESSAGES.ELECTRON_ONLY, 'warning');
      return;
    }
    
    // 現在再生中の動画情報を取得
    let currentVideoData = null;
    
    if (state.player) {
      try {
        const videoData = state.player.getVideoData();
        const currentTime = state.player.getCurrentTime();
        const playerState = state.player.getPlayerState();
        
        if (videoData && videoData.video_id) {
          currentVideoData = {
            action: 'load',
            videoId: videoData.video_id
          };
        }
      } catch (e) {
        console.error('動画情報取得エラー:', e);
      }
    }
    
    window.electronAPI.openVideoWindow(currentVideoData);
  });
}

async function initServerPortSettings() {
  if (!window.electronAPI?.getServerPort) return;
  const section = document.getElementById('serverPortSettings');
  const input = document.getElementById('serverPort');
  const status = document.getElementById('serverPortStatus');
  try {
    const { current, saved } = await window.electronAPI.getServerPort();
    section.hidden = false;
    input.value = saved;
    status.textContent = '使用中: ' + current;
    document.getElementById('saveServerPort').addEventListener('click', async () => {
      if (!input.reportValidity() || !input.value) return;
      try {
        await window.electronAPI.saveServerPort(input.value);
        status.textContent = '保存しました。アプリを再起動すると ' + input.value + ' 番で起動します。';
      } catch (error) { status.textContent = error.message; }
    });
  } catch (error) { console.error(error); }
}
