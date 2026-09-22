import { scheduleQueueAutoplay, resetQueueAutoplay } from './queue-autoplay.js';
import { state, logStatus, parseVideoId } from './main.js';

// ===== YouTube Iframe API =====
export function onYouTubeIframeAPIReady() {
  const playerDiv = state.role === 'host' ? 'playerHost' : 'playerViewer';
  
  if (state.player || !document.getElementById(playerDiv)) return;
  state.player = new YT.Player(playerDiv, {
    height: '100%',
    width: '100%',
    videoId: '',
    events: {
      'onReady': onPlayerReady,
      'onStateChange': onPlayerStateChange
    }
  });
}

// YouTube APIがグローバルから呼び出せるようにする
window.onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;

export function initPlayerIfReady() {
  const playerDiv = state.role === 'host' ? 'playerHost' : 'playerViewer';
  const el = document.getElementById(playerDiv);
  const loggedTargets = initPlayerIfReady.loggedTargets || new Set();
  initPlayerIfReady.loggedTargets = loggedTargets;

  if (!el) {
    if (!loggedTargets.has(playerDiv)) {
      console.log('[Player] DOM未生成のため初期化待ち:', playerDiv);
      loggedTargets.add(playerDiv);
    }
    return;
  }

  loggedTargets.delete(playerDiv);

  if (window.YT && YT.Player && !state.player) {
    onYouTubeIframeAPIReady();
  }
}

function onPlayerReady() {
  logStatus("プレイヤー準備OK");
  if (state.role === 'viewer' && state.lastSyncPayload) {
    import('./websocket.js').then(({ applySync }) => applySync(state.lastSyncPayload, true));
  }
}

function onPlayerStateChange(event) {
  if (state.role !== "host") return;
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return;

  const playerState = event.data;
  const currentTime = state.player.getCurrentTime();

  sendSyncState(playerState, currentTime);

  // ★ 動画終了時：次の動画を自動再生（キューがあれば）
  if (playerState === YT.PlayerState.ENDED) {
    console.log('動画終了を検知');
    
    if (state.videoQueue && state.videoQueue.length > 0) {
      console.log('→ キューに動画あり、次の動画を自動再生');
      
      scheduleQueueAutoplay(state); // 1秒待ってから次へ
    } else {
      console.log('→ キューは空です');
    }
  }

  if (playerState === YT.PlayerState.PLAYING) {
    resetQueueAutoplay();
    if (state.syncInterval) clearInterval(state.syncInterval);
    state.syncInterval = setInterval(() => {
      if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return;
      const now = state.player.getCurrentTime();
      sendSyncState(YT.PlayerState.PLAYING, now);
    }, 1000);
  } else {
    if (state.syncInterval) {
      clearInterval(state.syncInterval);
      state.syncInterval = null;
    }
  }
}

function sendSyncState(playerState, currentTime) {
  if (!state.player) return;

  let videoId = '';
  try {
    const data = state.player.getVideoData();
    if (data && data.video_id) {
      videoId = data.video_id;
    }
  } catch (e) {}

  const payload = {
    action: 'state',
    state: playerState,
    currentTime,
    videoId
  };

  state.ws.send(JSON.stringify({
    type: 'sync',
    roomId: state.FIXED_ROOM_ID,
    payload
  }));
}

export function hostLoadVideo() {
  if (state.role !== 'host') {
    alert('ホストモードで使ってください');
    return;
  }
  
  // ★ プレイヤーが初期化されていない場合は初期化
  if (!state.player) {
    console.log('[Player] プレイヤーが未初期化 → 初期化実行');
    initPlayerIfReady();
    
    // 初期化を待つ
    setTimeout(() => {
      hostLoadVideo();
    }, 500);
    return;
  }
  
  // ★ プレイヤーメソッドが存在するか確認
  if (typeof state.player.loadVideoById !== 'function') {
    console.error('[Player] プレイヤーが正しく初期化されていません');
    alert('プレイヤーの初期化に失敗しました。ページを再読み込みしてください。');
    return;
  }
  
  const url = document.getElementById('ytUrl').value.trim();
  const vid = parseVideoId(url);
  if (!vid) {
    alert('URLから動画IDが取得できません');
    return;
  }
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
}
