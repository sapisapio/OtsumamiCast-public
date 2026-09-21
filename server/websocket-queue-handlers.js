function parseVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }

  return null;
}

function applyQueueHandlers(manager) {
  const MAX_QUEUE_SIZE = 50;

  manager.handleToggleQueue = function handleToggleQueue(ws, message) {
    const clientInfo = this.clients.get(ws);

    if (clientInfo.role !== 'host') {
      this.sendTo(ws, { type: 'error', message: 'ホストのみ実行可能です' });
      return;
    }

    this.queueEnabled = message.enabled;
    console.log(`📋 キュー受付: ${this.queueEnabled ? 'ON' : 'OFF'}`);

    this.broadcast({
      type: 'queue-enabled',
      enabled: this.queueEnabled
    });
  };

  manager.handleVideoRequest = function handleVideoRequest(ws, message) {
    const clientInfo = this.clients.get(ws);

    if (!this.queueEnabled) {
      this.sendTo(ws, {
        type: 'error',
        message: 'リクエストは現在受け付けていません'
      });
      return;
    }

    if (this.videoQueue.length >= MAX_QUEUE_SIZE) {
      this.sendTo(ws, {
        type: 'error',
        message: `キューが満杯です（最大${MAX_QUEUE_SIZE}件）`
      });
      return;
    }

    const videoId = parseVideoId(message.url);
    if (!videoId) {
      this.sendTo(ws, { type: 'error', message: '無効なYouTube URLです' });
      return;
    }

    const queueItem = {
      id: ++this.currentQueueId,
      videoId: videoId,
      url: message.url,
      title: message.title || videoId,
      requestedBy: clientInfo.role === 'host' ? 'ホスト' : 'リスナー',
      timestamp: Date.now()
    };

    this.videoQueue.push(queueItem);
    console.log(`📋 キュー追加: ${queueItem.title} (by ${queueItem.requestedBy})`);

    this.broadcastQueueUpdate();
  };

  manager.handleRemoveQueueItem = function handleRemoveQueueItem(ws, message) {
    const clientInfo = this.clients.get(ws);

    if (clientInfo.role !== 'host') {
      this.sendTo(ws, { type: 'error', message: 'ホストのみ実行可能です' });
      return;
    }

    const index = this.videoQueue.findIndex(item => item.id === message.queueId);
    if (index !== -1) {
      const removed = this.videoQueue.splice(index, 1)[0];
      console.log(`🗑️ キュー削除: ${removed.title}`);
      this.broadcastQueueUpdate();
    }
  };

  manager.handlePlayNext = function handlePlayNext(ws) {
    const clientInfo = this.clients.get(ws);

    if (clientInfo.role !== 'host') {
      this.sendTo(ws, { type: 'error', message: 'ホストのみ実行可能です' });
      return;
    }

    if (this.videoQueue.length === 0) {
      this.sendTo(ws, { type: 'error', message: 'キューが空です' });
      return;
    }

    const nextVideo = this.videoQueue.shift();
    console.log(`▶️ 次の動画を再生: ${nextVideo.title}`);

    this.sendTo(ws, {
      type: 'load-video',
      videoId: nextVideo.videoId,
      autoplay: true
    });

    this.broadcastQueueUpdate();
  };

  manager.broadcastQueueUpdate = function broadcastQueueUpdate() {
    this.broadcast({
      type: 'queue-update',
      queue: this.videoQueue,
      enabled: this.queueEnabled
    });
  };
}

module.exports = applyQueueHandlers;
