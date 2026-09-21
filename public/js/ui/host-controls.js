// ===== ホスト用UI制御 =====

import { state, logStatus, parseVideoId } from '../main.js';
import { hostLoadVideo } from '../player.js';
import { connectWs } from '../websocket.js';
import { showMessage } from '../utils.js';
import { MESSAGES } from '../constants.js';

/**
 * ホスト用UI機能を初期化
 */
export function initHostControls() {
  initHostStartButton();
  initLoadButton();
  initClipboardButton();
  initDragDrop();
  
  console.log('[HostControls] Initialized');
}

/**
 * ホスト開始/解除ボタン
 */
function initHostStartButton() {
  const startHostBtn = document.getElementById('startHostBtn');
  const hostUrlSection = document.getElementById('hostUrlSection');
  
  if (!startHostBtn) return;
  
  startHostBtn.addEventListener('click', () => {
  state.hosting = !state.hosting;
  
  if (state.hosting) {
    // ホスト開始
    startHostBtn.textContent = 'ホスト解除';
    startHostBtn.classList.remove('btn-primary');
    startHostBtn.classList.add('btn-danger');
    
    if (hostUrlSection) {
      hostUrlSection.classList.remove('disabled-overlay');
      hostUrlSection.querySelectorAll('input, button').forEach(el => el.disabled = false);
    }
    
    // ★ ホスト状態変更イベントを発火
    window.dispatchEvent(new CustomEvent('hostingStateChanged', { 
      detail: { hosting: true } 
    }));
    
    // WebSocket接続
    setTimeout(() => {
      connectWs();
    }, 200);
    
    // オーバーレイを自動で開く
    if (window.electronAPI?.openOverlay) {
      window.electronAPI.openOverlay();
    }
     } else {
    // ホスト解除
    startHostBtn.textContent = 'ホスト開始';
    startHostBtn.classList.add('btn-primary');
    startHostBtn.classList.remove('btn-danger');
    
    if (hostUrlSection) {
      hostUrlSection.classList.add('disabled-overlay');
      hostUrlSection.querySelectorAll('input, button').forEach(el => el.disabled = true);
    }
    
    // ★ ホスト状態変更イベントを発火
    window.dispatchEvent(new CustomEvent('hostingStateChanged', { 
      detail: { hosting: false } 
    }));
      
      // WebSocket切断
      if (state.ws) {
        state.ws.close();
        state.ws = null;
      }
      logStatus('ホスト解除');
    }
  });
}

/**
 * 動画読み込みボタン
 */
function initLoadButton() {
  const loadBtn = document.getElementById('loadBtn');
  
  if (!loadBtn) return;
  
  loadBtn.addEventListener('click', hostLoadVideo);
}

/**
 * クリップボードから読み込みボタン
 */
function initClipboardButton() {
  const clipboardBtn = document.getElementById('clipboardBtn');
  
  if (!clipboardBtn) return;
  
  clipboardBtn.addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      const vid = parseVideoId(text);
      
      if (!vid) {
        showMessage(MESSAGES.CLIPBOARD_INVALID, 'warning');
        return;
      }
      
      // URL入力欄に反映
      const ytUrlInput = document.getElementById('ytUrl');
      if (ytUrlInput) {
        ytUrlInput.value = text;
      }
      
      // 読み込み
      if (state.role === 'host' && state.hosting && state.player) {
        state.player.loadVideoById(vid);

        if (state.ws && state.ws.readyState === WebSocket.OPEN) {
          state.ws.send(JSON.stringify({
            type: 'sync',
            roomId: state.FIXED_ROOM_ID,
            payload: {
              action: 'load',
              videoId: vid
            }
          }));
        }

        logStatus('動画を読み込みました: ' + vid);
      }
    } catch (e) {
      showMessage(MESSAGES.CLIPBOARD_ERROR, 'error');
      console.error(e);
    }
  });
}

/**
 * ドラッグ&ドロップ機能
 */
function initDragDrop() {
  const dropZone = document.getElementById('dropZone');
  
  if (!dropZone) return;
  
  // ドラッグオーバー時のスタイル変更
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

  // ドロップ時の処理
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropZone.style.borderColor = '#c0c0c0';
    dropZone.style.background = '#fafafa';

    // ドロップされたデータを取得
    const url = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text/uri-list');

    if (!url) {
      showMessage(MESSAGES.URL_ERROR, 'warning');
      return;
    }

    // YouTube URLかチェック
    const vid = parseVideoId(url);
    if (!vid) {
      showMessage(MESSAGES.NOT_YOUTUBE_URL, 'warning');
      return;
    }

    // URL入力欄に反映
    const ytUrlInput = document.getElementById('ytUrl');
    if (ytUrlInput) {
      ytUrlInput.value = url;
    }

    // 自動読み込み
    if (state.role === 'host' && state.hosting && state.player) {
      state.player.loadVideoById(vid);

      if (state.ws && state.ws.readyState === WebSocket.OPEN) {
        state.ws.send(JSON.stringify({
          type: 'sync',
          roomId: state.FIXED_ROOM_ID,
          payload: {
            action: 'load',
            videoId: vid
          }
        }));
      }

      logStatus('動画を読み込みました: ' + vid);
    }
  });
}
