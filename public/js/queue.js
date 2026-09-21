import { state, logStatus, parseVideoId } from './main.js';

/**
 * キュー管理モジュール
 */

// ===== リクエスト送信 =====
export function requestVideo(url) {
  if (!url || !url.trim()) {
    if (window.alertWithFocus) {
      window.alertWithFocus('URLを入力してください');
    } else {
      alert('URLを入力してください');
    }
    return;
  }

  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
    if (window.alertWithFocus) {
      window.alertWithFocus('接続されていません');
    } else {
      alert('接続されていません');
    }
    return;
  }

  // YouTube動画タイトルを取得してから送信
  const videoId = parseVideoId(url);
  if (!videoId) {
    if (window.alertWithFocus) {
      window.alertWithFocus('無効なYouTube URLです');
    } else {
      alert('無効なYouTube URLです');
    }
    return;
  }

  // タイトル取得は非同期なので、とりあえずvideoIdだけ送信
  state.ws.send(JSON.stringify({
    type: 'request-video',
    url: url.trim(),
    title: videoId  // 後で改善可能
  }));

  logStatus('リクエストを送信しました');
}

// ===== ホスト：次の動画を再生 =====
export function playNext() {
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
    if (window.alertWithFocus) {
      window.alertWithFocus('接続されていません');
    } else {
      alert('接続されていません');
    }
    return;
  }

  state.ws.send(JSON.stringify({
    type: 'play-next'
  }));
}

// ===== ホスト：キューから削除 =====
export function removeQueueItem(queueId) {
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) return;

  state.ws.send(JSON.stringify({
    type: 'remove-queue-item',
    queueId: queueId
  }));
}

// ===== キュー受付ON/OFF =====
export function toggleQueue(enabled) {
  if (!state.ws || state.ws.readyState !== WebSocket.OPEN) {
    if (window.alertWithFocus) {
      window.alertWithFocus('接続されていません');
    } else {
      alert('接続されていません');
    }
    return;
  }

  state.ws.send(JSON.stringify({
    type: 'toggle-queue',
    enabled: enabled
  }));

  logStatus(`キュー受付: ${enabled ? 'ON' : 'OFF'}`);
}

// ===== キュー表示更新 =====
export function updateQueueDisplay(queue) {
  const hostList = document.getElementById('hostQueueList');
  const viewerList = document.getElementById('viewerQueueList');

  const truncateTitle = (title) => {
    const safeTitle = typeof title === 'string' ? title : '';
    return safeTitle.length > 200 ? `${safeTitle.slice(0, 200)}…` : safeTitle;
  };

  const renderQueue = (container) => {
    if (!container) return;
    container.innerHTML = '';

    if (!queue || queue.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'queue-empty';
      empty.textContent = 'キューは空です';
      container.appendChild(empty);
      return;
    }

    queue.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'queue-item';
      row.dataset.queueId = String(item.id);

      const number = document.createElement('span');
      number.className = 'queue-number';
      number.textContent = `${index + 1}.`;
      row.appendChild(number);

      const title = document.createElement('span');
      title.className = 'queue-title';
      title.textContent = truncateTitle(item.title);
      row.appendChild(title);

      const by = document.createElement('span');
      by.className = 'queue-by';
      by.textContent = `(${item.requestedBy || ''})`;
      row.appendChild(by);

      if (state.role === 'host') {
        const removeButton = document.createElement('button');
        removeButton.className = 'btn btn-small queue-remove-btn';
        removeButton.dataset.queueId = String(item.id);
        removeButton.textContent = '削除';
        row.appendChild(removeButton);
      }

      container.appendChild(row);
    });
  };

  renderQueue(hostList);
  renderQueue(viewerList);

  // 削除ボタンのイベントリスナー（ホストのみ）
  if (state.role === 'host') {
    document.querySelectorAll('.queue-remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const queueId = parseInt(e.target.dataset.queueId);
        removeQueueItem(queueId);
      });
    });
  }
}
