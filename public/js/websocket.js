import { scheduleQueueAutoplay, resetQueueAutoplay } from './queue-autoplay.js';
import { connectionUrl, resolveAsset } from './connection-target.js';
import { state, logStatus } from './main.js';

// ===== YP関連 =====
export async function loadYP() {
  const select = document.getElementById('hostSelect');
  const status = document.getElementById('ypStatus');
  
  status.textContent = '読み込み中...';
  select.innerHTML = '<option value="">読み込み中...</option>';
  
  try {
    const res = await fetch('/api/yp');
    const text = await res.text();
    
    const lines = text.trim().split('\n');
    const hosts = [];
    
    for (const line of lines) {
      const parts = line.split('<>');
      if (parts.length < 3) continue;
      
      const name = parts[0].trim();
      const ipPort = parts[2].trim();
      
      if (!name || !ipPort) continue;
      
      const ip = ipPort.split(':')[0];
      
      hosts.push({ name, ip });
    }
    
    select.innerHTML = '<option value="">-- 配信者を選択 --</option>';
    hosts.forEach(host => {
      const option = document.createElement('option');
      option.value = host.ip;
      option.textContent = host.name;
      select.appendChild(option);
    });
    
    status.textContent = `${hosts.length}件の配信者`;
    
  } catch (err) {
    console.error(err);
    select.innerHTML = '<option value="">読み込み失敗</option>';
    status.textContent = 'エラー: ' + err.message;
  }
}

// ===== WebSocket関連 =====
export function connectWs(customIp = null) {
  // 既存の接続があれば切断
  if (state.ws && state.ws.readyState !== WebSocket.CLOSED) {
    console.log('前の接続を切断します...');
    state.ws.close();
    state.ws = null;
    logStatus('前の接続を切断しました');
    
    setTimeout(() => connectWs(customIp), 300);
    return;
  }
  // ★ 追加：グローバルにロールを公開
  window.otsumamiRole = state.role;
  window.isHost = (state.role === 'host');
  
  let wsUrl;
  try {
    if (state.role === 'host') {
      if (!state.hosting) return;
      wsUrl = connectionUrl(window.location.origin);
    } else {
      const params = new URLSearchParams(window.location.search);
      const target = customIp || params.get('host') || params.get('ip') || params.get('target') ||
        document.getElementById('hostSelect')?.value ||
        (!window.electronAPI ? window.location.origin : '');
      if (!target) { alert('配信者のURLまたはIP:ポートを入力してください'); return; }
      wsUrl = connectionUrl(target);
    }
  } catch (error) { alert(error.message); return; }

  console.log('接続先:', wsUrl);

  resetQueueAutoplay();
  const socket = new WebSocket(wsUrl);
  state.ws = socket;
  window.otsumamiRemoteProfile = null;
  window.otsumamiRemoteStampConfig = null;
 // ★ 追加：スタンプ用に ws をグローバルへ
  window.otsumamiWs = state.ws;

  socket.onopen = () => {
    if (state.ws !== socket) return;
    state.ws.send(JSON.stringify({
      type: 'join',
      roomId: state.FIXED_ROOM_ID,
      role: state.role
    }));
    logStatus(`接続完了: ${state.role}`);
  };

  socket.onmessage = (event) => {
    if (state.ws !== socket) return;
    let data;
    try { data = JSON.parse(event.data); } catch { return; }
    if (data.type === 'profile-config-sync' || data.type === 'profile-config-updated') {
      window.otsumamiRemoteProfile = data.config;
    }
    if (data.type === 'stamp-config') window.otsumamiRemoteStampConfig = data.config;
    window.dispatchEvent(new CustomEvent('websocket-message', { detail: data }));

    const resolveStampAssetUrl = (url) => resolveAsset(url, socket);

    if (data.type === 'joined') {
      logStatus(`部屋 ${data.roomId} に ${data.role} として参加`);
    }

    if (data.type === 'banned') {
      if (window.showToast) {
        window.showToast('ホストによりBANされています', 'error');
      } else {
        alert('ホストによりBANされています');
      }
      logStatus('BAN: 接続拒否');
      if (state.ws) {
        state.ws.close();
      }
      return;
    }

    if (data.type === 'error') {
      resetQueueAutoplay();
      // ★ alertWithFocus を使用
      if (window.alertWithFocus) {
        window.alertWithFocus(data.message || 'エラーが発生しました');
      } else {
        alert(data.message || 'エラーが発生しました');
      }
      logStatus('エラー: ' + (data.message || '不明'));
      return;
    }

    if (data.type === 'roomClosed') {
      logStatus(`部屋クローズ(ホスト終了)`);

      if (state.role === 'viewer' && state.player && state.player.stopVideo) {
        try {
          state.player.stopVideo();
        } catch (e) { console.error(e); }
      }

      return;
    }
// ★ スタンプリスト更新（ホスト・リスナー共通）
    if (data.type === 'stamp-list') {
      if (data.categories && window.otsumamiStamp) {
        window.otsumamiStamp.updateCategories(data.categories);

      }
      if (
        window.otsumamiStamp &&
        typeof window.otsumamiStamp.updateStampListFromServer === 'function'
      ) {
        const stamps = (Array.isArray(data.stamps) ? data.stamps : []).map((stamp) => {
          if (!stamp || typeof stamp !== 'object') return stamp;
          return {
            ...stamp,
            url: resolveStampAssetUrl(stamp.url),
            thumbUrl: resolveStampAssetUrl(stamp.thumbUrl),
            staticThumbUrl: resolveStampAssetUrl(stamp.staticThumbUrl)
          };
        });
        window.otsumamiStamp.updateStampListFromServer(stamps);
      }
          return;
    }

    // 全スタンプリストを取り直さず、最近使った欄だけ同期する。
    if (data.type === 'stamp-used') {
      if (
        data.url &&
        window.otsumamiStamp &&
        typeof window.otsumamiStamp.applyStampUsage === 'function'
      ) {
        window.otsumamiStamp.applyStampUsage(
          resolveStampAssetUrl(data.url),
          data.lastUsedAt
        );
      }
      return;
    }

    if (data.type === 'stamp-thumb-regenerate-result') {
      const total = Number(data.total || 0);
      const successCount = Number(data.successCount || 0);
      const failCount = Number(data.failCount || 0);
      const scope = data.scope === 'selected' ? '選択スタンプ' : '全スタンプ';
      const message = `${scope}のサムネイル再生成完了: ${successCount}/${total}件成功` +
        (failCount > 0 ? `（失敗 ${failCount}件）` : '');

      if (window.showToast) {
        window.showToast(message, failCount > 0 ? 'error' : 'success');
      } else {
        alert(message);
      }
      return;
    }

    if (data.type === 'stamp-thumb-regenerate-progress') {
      if (
        window.otsumamiStamp &&
        typeof window.otsumamiStamp.updateThumbRegenerateProgress === 'function'
      ) {
        window.otsumamiStamp.updateThumbRegenerateProgress(data);
      }
      return;
    }

    // ★ 設定受信（接続時）
    if (data.type === 'stamp-config') {
      const config = data.config || {};

      if (
        window.otsumamiStamp &&
        typeof window.otsumamiStamp.applyStaticThumbnailPreviewSetting === 'function'
      ) {
        window.otsumamiStamp.applyStaticThumbnailPreviewSetting(!!config.staticThumbnailPreview);
        if (typeof window.otsumamiStamp.applyThumbnailHoverZoomSetting === 'function') {
          window.otsumamiStamp.applyThumbnailHoverZoomSetting(!!config.thumbnailHoverZoom);
        }
        window.otsumamiStamp.renderRecentStamps();
        window.otsumamiStamp.renderStampList();
      }

      if (
        window.electronAPI &&
        typeof window.electronAPI.sendToOverlay === 'function'
      ) {
        // 音量設定をオーバーレイに送信
        window.electronAPI.sendToOverlay('send-video-volume', {
          volume: config.videoVolume ?? 50,
          muted: config.muteVideo || false
        });
        
        // 表示時間をオーバーレイに送信
        window.electronAPI.sendToOverlay('send-stamp-duration', {
          duration: config.stampDuration || 3,
          baseSize: config.stampBaseSize || 220
        });
        
        console.log('?? 設定を受信してオーバーレイに転送:', config);
      }
      return;
    }

    // ★ ホストが stamp を受け取ったとき、オーバーレイへ送る
    if (data.type === 'stamp') {
      // ホストクライアントだけ処理する
      if (
        state.role === 'host' &&
        window.electronAPI &&
        typeof window.electronAPI.sendStamp === 'function'
      ) {
        const payload = data.payload || {};
        if (payload.filename) {
          window.electronAPI.sendStamp({
            filename: payload.filename
          });
        }
      }
      return;
    }

    if (data.type === 'vcast-config') {
      if (
        state.role === 'host' &&
        window.electronAPI &&
        typeof window.electronAPI.sendToOverlay === 'function'
      ) {
        window.electronAPI.sendToOverlay('vcast-config', data.config);
      }
      return;
    }

    if (data.type === 'vcast-state') {
      if (
        state.role === 'host' &&
        window.electronAPI &&
        typeof window.electronAPI.sendToOverlay === 'function'
      ) {
        window.electronAPI.sendToOverlay('vcast-state', data.state);
      }
      window.dispatchEvent(new CustomEvent('vcastStateUpdated', { detail: data.state }));
      return;
    }

    if (data.type === 'ohinerimaki-bell') {
      if (
        state.role === 'host' &&
        window.electronAPI &&
        typeof window.electronAPI.sendToOverlay === 'function'
      ) {
        window.electronAPI.sendToOverlay('ohinerimaki-bell', data);
      }

      if (window.otsumamiOhinerimaki && typeof window.otsumamiOhinerimaki.handleBell === 'function') {
        window.otsumamiOhinerimaki.handleBell(data);
      }
      return;
    }

    if (data.type === 'ohinerimaki-deleted') {
      if (
        state.role === 'host' &&
        window.electronAPI &&
        typeof window.electronAPI.sendToOverlay === 'function'
      ) {
        window.electronAPI.sendToOverlay('ohinerimaki-deleted', data);
      }

      if (window.otsumamiOhinerimaki && typeof window.otsumamiOhinerimaki.handleDeleted === 'function') {
        window.otsumamiOhinerimaki.handleDeleted(data);
      }
      return;
    }

    if (data.type === 'vcast-reaction') {
      const detail = {
        action: data.action,
        points: data.points,
        mood: data.mood,
        personality: data.personality,
        totalPoints: data.totalPoints
      };
      window.dispatchEvent(new CustomEvent('vcastStateUpdated', { detail }));

      if (
        state.role === 'host' &&
        window.electronAPI &&
        typeof window.electronAPI.sendToOverlay === 'function'
      ) {
        window.electronAPI.sendToOverlay('vcast-reaction', detail);
      }

      if (window.showToast) {
        window.showToast(`? リアクション +${data.points}`, 'success');
      }
      return;
    }
     // ★ キュー受付状態の更新
    if (data.type === 'queue-enabled') {
      state.queueEnabled = data.enabled;
      
      const checkbox = document.getElementById('queueToggle');
      if (checkbox) {
        checkbox.checked = data.enabled;
      }

      // フォーム表示/非表示
      const queueForm = document.getElementById('queueForm');
      if (queueForm) {
        queueForm.style.display = data.enabled ? 'block' : 'none';
      }

      logStatus(`キュー受付: ${data.enabled ? 'ON' : 'OFF'}`);
      return;
    }

   // ★ キュー更新
    if (data.type === 'queue-update') {
      state.videoQueue = data.queue || [];
      
      // queue.jsのupdateQueueDisplay関数を呼び出し
      if (window.otsumamiQueue && typeof window.otsumamiQueue.updateQueueDisplay === 'function') {
        window.otsumamiQueue.updateQueueDisplay(state.videoQueue);
      }

      // ★ ホスト側：動画が何も再生されていない、または終了状態ならキューから自動再生
      if (state.role === 'host' && state.player && state.videoQueue.length > 0) {
        try {
          const playerState = state.player.getPlayerState();
          
          // -1: 未開始, 0: 終了, 5: 頭出し済み
          if (playerState === -1 || playerState === 0 || playerState === 5) {
            console.log('[Queue] プレイヤーが停止中、キューから自動再生');
            
            scheduleQueueAutoplay(state);
          }
        } catch (e) {
          console.error('[Queue] プレイヤー状態取得エラー:', e);
        }
      }
      
      return;
    }

    // ★ ホスト：動画ロード指示
    if (data.type === 'load-video') {
      if (state.role === 'host' && state.player) {
        state.player.loadVideoById(data.videoId);
        
        // ★ autoplayフラグがtrueなら自動再生
        if (data.autoplay) {
          setTimeout(() => {
            state.player.playVideo();
          }, 500); // 読み込み待ち
        }
        
        logStatus('次の動画を読み込みました');
      }
      return;
    }
    if (data.type === 'sync' && state.role === 'viewer') {
      state.lastSyncPayload = data.payload;
      applySync(data.payload, false);
    }
  };

  socket.onclose = () => {
    if (state.ws !== socket) return;
    logStatus('接続切断');
  };

  socket.onerror = (err) => {
    if (state.ws !== socket) return;
    console.error(err);
    logStatus('接続エラー');
  };
}


// ===== ビューア側：同期適用 =====
export async function applySync(payload, force) {
  if (!payload) return;
  state.lastSyncPayload = payload;
  // 未初期化の間は最新の同期情報だけを保持する。タブ選択は変更しない。
  if (!state.player || typeof state.player.loadVideoById !== 'function') return;

  if (payload.action === 'load') {
    state.player.loadVideoById(payload.videoId);
    return;
  }

  if (payload.action === 'state') {

    if (payload.videoId) {
      try {
        const data = state.player.getVideoData && state.player.getVideoData();
        const currentVid = data && data.video_id;
        if (!currentVid || currentVid !== payload.videoId) {
          state.player.loadVideoById(payload.videoId);
        }
      } catch (e) {
        state.player.loadVideoById(payload.videoId);
      }
    }

    const desiredTime = Math.max(0, payload.currentTime - state.viewerOffsetSec);
    const now = state.player.getCurrentTime();
    const diff = desiredTime - now;

    if ((payload.state === YT.PlayerState.PLAYING) || force) {
      if (force || Math.abs(diff) > 0.3) {
        state.player.seekTo(desiredTime, true);
      }
    }

    if (payload.state === YT.PlayerState.PLAYING) {
      state.player.playVideo();
    } else if (
      payload.state === YT.PlayerState.PAUSED ||
      payload.state === YT.PlayerState.ENDED
    ) {
      state.player.pauseVideo();
    }
  }
}
export function refreshView() {
  if (!state.lastSyncPayload) {
    // ★ alertWithFocus を使用
    if (window.alertWithFocus) {
      window.alertWithFocus('まだホストから同期情報が来ていません');
    } else {
      alert('まだホストから同期情報が来ていません');
    }
    return;
  }
  applySync(state.lastSyncPayload, true);
}
// ===== スタンプ管理メッセージ送信 =====
window.otsumamiWS = window.otsumamiWS || {};

window.otsumamiWS.sendStampAddRequest = function (url, options = {}) {
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return;

  const { password = null, serverId = null } = options || {};

  state.ws.send(
    JSON.stringify({
      type: 'stamp-add',
      url,
      password,
      serverId
    })
  );
};
// ★ 追加：スタンプ並び替え
window.otsumamiWS.sendStampReorderRequest = function (urls) {
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return;

  state.ws.send(
    JSON.stringify({
      type: 'stamp-reorder',
      urls
    })
  );
};
window.otsumamiWS.sendStampCategoryAddToStamps = function (urls, categoryId) {
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return;

  state.ws.send(
    JSON.stringify({
      type: 'stamp-category-add',
      urls,
      category: categoryId
    })
  );
};

window.otsumamiWS.sendStampCategoryRemoveFromStamps = function (urls, categoryId) {
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return;

  state.ws.send(
    JSON.stringify({
      type: 'stamp-category-remove',
      urls,
      category: categoryId
    })
  );
};

window.otsumamiWS.sendStampCategoryAddRequest = function (id, label) {
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return;

  state.ws.send(
    JSON.stringify({
      type: 'stamp-category-def-add',
      id,
      label
    })
  );
};

window.otsumamiWS.sendStampCategoryDeleteRequest = function (id) {
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return;

  state.ws.send(
    JSON.stringify({
      type: 'stamp-category-delete',
      id
    })
  );
};

window.otsumamiWS.sendStampDeleteRequest = function (urls) {
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return;

  state.ws.send(
    JSON.stringify({
      type: 'stamp-delete',
      urls
    })
  );
};

window.otsumamiWS.sendStampThumbRebuildAllRequest = function () {
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return;

  state.ws.send(
    JSON.stringify({
      type: 'stamp-thumb-regenerate-all'
    })
  );
};

window.otsumamiWS.sendStampThumbRebuildSelectedRequest = function (urls) {
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return;

  state.ws.send(
    JSON.stringify({
      type: 'stamp-thumb-regenerate-selected',
      urls
    })
  );
};
