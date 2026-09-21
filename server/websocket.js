const WebSocket = require('ws');
const applyStampHandlers = require('./websocket-stamp-handlers');
const applyQueueHandlers = require('./websocket-queue-handlers');
const applyExtraHandlers = require('./websocket-extra-handlers');

class WebSocketManager {
  constructor(
    server,
    stampHandler = null,
    stampManager = null,
    stampConfig = null,
    profileConfig = null,
    ohinerimakiConfig = null,
    vcastConfig = null,
    vcastState = null
  ) {
    this.wss = new WebSocket.Server({ server });
    this.clients = new Map(); // ws -> { role, videoId, ... }
    this.stampHandler = stampHandler; // StampHandlerインスタンス
    this.stampManager = stampManager; // StampManagerインスタンス
    this.stampConfig = stampConfig; // StampConfigインスタンス
    this.profileConfig = profileConfig;
    this.ohinerimakiConfig = ohinerimakiConfig;
    this.vcastConfig = vcastConfig;
    this.vcastState = vcastState;
    // ★ 動画キュー管理
    this.videoQueue = [];           // キュー配列
    this.queueEnabled = false;      // リクエスト受付ON/OFF
    this.currentQueueId = 0;        // キューID採番用
    this.ohinerimakiRateLimit = new Map(); // IP -> timestamp
    this.rateLimits = new Map(); // ws -> { type: [timestamps] }
    this.stampDownloadRateLimit = new Map(); // ws -> [timestamps]
    applyStampHandlers(this);
    applyQueueHandlers(this);
    applyExtraHandlers(this);
    this.setupWebSocket();
    this.setupOhinerimakiCleanup();
  }

  /**
   * WebSocket接続処理
   */
  setupWebSocket() {
    this.wss.on('connection', (ws) => {
      const remoteAddress = ws?._socket?.remoteAddress || '';
      const normalizedIp = this.normalizeAddress(remoteAddress);
      if (this.profileConfig?.isIpBanned(normalizedIp)) {
        console.log(`⛔ BANされたIPからの接続を拒否: ${normalizedIp}`);
        this.sendTo(ws, {
          type: 'banned',
          message: 'ホストによりBANされています'
        });
        setTimeout(() => {
          ws.close(1008, 'banned');
        }, 50);
        return;
      }

      console.log('🔌 新しいクライアントが接続しました');

      // クライアント情報を初期化
      this.clients.set(ws, {
        role: null,
        videoId: null,
        connectedAt: new Date()
      });

      // メッセージ受信
      ws.on('message', (data) => {
        this.handleMessage(ws, data);
      });

      // 切断処理
      ws.on('close', () => {
        console.log('🔌 クライアントが切断しました');
        this.clients.delete(ws);
        this.rateLimits.delete(ws);
        this.stampDownloadRateLimit.delete(ws);
      });

      // エラー処理
      ws.on('error', (error) => {
        console.error('❌ WebSocketエラー:', error);
        this.clients.delete(ws);
        this.rateLimits.delete(ws);
        this.stampDownloadRateLimit.delete(ws);
      });
    });

    console.log('✅ WebSocketサーバーを起動しました');
  }

  /**
   * メッセージ処理
   * @param {WebSocket} ws - 送信元のWebSocket
   * @param {Buffer} data - 受信データ
   */
  handleMessage(ws, data) {
    try {
      const message = JSON.parse(data.toString());
      const clientInfo = this.clients.get(ws);

      console.log(`📨 受信: ${message.type}`);

      const rateLimitTypeMap = {
        stamp: 'stamp',
        comment: 'comment',
        sync: 'sync',
        'request-video': 'queue',
        'remove-queue-item': 'queue',
        'play-next': 'queue',
        'toggle-queue': 'queue'
      };

      const rateLimitConfig = {
        stamp: 60,
        comment: 60,
        sync: 120,
        queue: 30
      };

      const rateLimitType = rateLimitTypeMap[message.type];
      if (rateLimitType) {
        const limit = rateLimitConfig[rateLimitType];
        if (!this.checkRateLimit(ws, rateLimitType, limit)) {
          this.sendTo(ws, {
            type: 'error',
            message: '送信が速すぎます'
          });
          return;
        }
      }

      switch (message.type) {
        case 'join':
          // クライアント登録（互換性のため）
          this.handleJoin(ws, message);
          break;

        case 'register':
          // クライアント登録（新仕様）
          this.handleRegister(ws, message);
          break;

        case 'sync':
          // 動画同期
          this.handleSync(ws, message);
          break;

        case 'stamp':
          // スタンプ送信
          this.handleStamp(ws, message);
          break;

        case 'stamp-add-local':
          // ローカルスタンプ追加
          this.handleStampAddLocal(ws, message);
          break;

        case 'stamp-add':
          // URLスタンプ追加
          this.handleStampAdd(ws, message);
          break;

        case 'stamp-reorder':
          // スタンプ並び替え
          this.handleStampReorder(ws, message);
          break;

        case 'stamp-category-add':
          // スタンプにカテゴリ付与
          this.handleStampCategoryAdd(ws, message);
          break;

        case 'stamp-category-remove':
          // スタンプからカテゴリ除去
          this.handleStampCategoryRemove(ws, message);
          break;

        case 'stamp-category-def-add':
          // カテゴリ定義追加
          this.handleStampCategoryDefAdd(ws, message);
          break;

        case 'stamp-category-delete':
          // カテゴリ削除
          this.handleStampCategoryDelete(ws, message);
          break;

        case 'stamp-delete':
          // スタンプ削除
          this.handleStampDelete(ws, message);
          break;

        case 'stamp-thumb-regenerate-all':
          // 全サムネイル再生成
          this.handleStampThumbRegenerateAll(ws, message);
          break;

        case 'stamp-thumb-regenerate-selected':
          // 選択サムネイル再生成
          this.handleStampThumbRegenerateSelected(ws, message);
          break;

        case 'comment':
          // コメント送信
          this.handleComment(ws, message);
          break;
        case 'ohinerimaki-bell':
          this.handleOhinerimakiBell(ws, message);
          break;
        case 'ohinerimaki-delete':
          this.handleOhinerimakiDelete(ws, message);
          break;
        case 'vcast-reaction':
          this.handleVcastReaction(ws, message);
          break;
                  case 'toggle-queue':
          // キュー受付ON/OFF
          this.handleToggleQueue(ws, message);
          break;

        case 'request-video':
          // 動画リクエスト
          this.handleVideoRequest(ws, message);
          break;

        case 'remove-queue-item':
          // キューから削除
          this.handleRemoveQueueItem(ws, message);
          break;

        case 'play-next':
          // 次の動画を再生
          this.handlePlayNext(ws, message);
          break;
        case 'profile-config-updated':
          // プロフィール設定更新
          this.handleProfileConfigUpdated(ws, message);
          break;
        case 'request-profile-config':
          // プロフィール設定取得
          this.handleProfileConfigRequest(ws);
          break;
        default:
          console.warn(`⚠️ 未知のメッセージタイプ: ${message.type}`);
      }
    } catch (error) {
      console.error('❌ メッセージ処理エラー:', error);
    }
  }

  normalizeAddress(remoteAddress) {
    if (!remoteAddress) return '';
    return remoteAddress.startsWith('::ffff:')
      ? remoteAddress.replace('::ffff:', '')
      : remoteAddress;
  }

  disconnectClientsByIp(ip) {
    const target = this.normalizeAddress(ip);
    if (!target) return;
    this.clients.forEach((clientInfo, ws) => {
      const remoteAddress = ws?._socket?.remoteAddress || '';
      const normalizedIp = this.normalizeAddress(remoteAddress);
      if (normalizedIp === target) {
        this.sendTo(ws, {
          type: 'banned',
          message: 'ホストによりBANされています'
        });
        ws.close(1008, 'banned');
      }
    });
  }

  isLocalhost(remoteAddress) {
    const normalized = this.normalizeAddress(remoteAddress);
    return normalized === '127.0.0.1' || normalized === '::1';
  }

  isTrustedClient(remoteAddress) {
    const normalized = this.normalizeAddress(remoteAddress);
    if (this.isLocalhost(normalized)) return true;
    if (normalized.startsWith('10.')) return true;
    if (normalized.startsWith('192.168.')) return true;
    if (normalized.startsWith('172.')) {
      const secondOctet = Number.parseInt(normalized.split('.')[1], 10);
      return secondOctet >= 16 && secondOctet <= 31;
    }
    return false;
  }

  canAssignHost(ws) {
    const remoteAddress = ws?._socket?.remoteAddress;
    if (!this.isTrustedClient(remoteAddress)) {
      console.log(`❌ ホスト権限拒否: ${remoteAddress} からの接続`);
      return { allowed: false, reason: 'untrusted' };
    }

    const existingHost = Array.from(this.clients.values()).find(
      (info, client) => client !== ws && info.role === 'host'
    );

    if (existingHost) {
      console.log('❌ ホスト登録拒否: すでにホストが存在します');
      return { allowed: false, reason: 'already-host' };
    }

    return { allowed: true };
  }

  /**
   * レート制限チェック
   * @param {WebSocket} ws
   * @param {string} type
   * @param {number} maxPerMinute
   * @returns {boolean}
   */
  checkRateLimit(ws, type, maxPerMinute) {
    const now = Date.now();
    const limits = this.rateLimits.get(ws) || {};
    const history = Array.isArray(limits[type]) ? limits[type] : [];
    const recent = history.filter((timestamp) => now - timestamp < 60000);

    if (recent.length >= maxPerMinute) {
      limits[type] = recent;
      this.rateLimits.set(ws, limits);
      return false;
    }

    recent.push(now);
    limits[type] = recent;
    this.rateLimits.set(ws, limits);
    return true;
  }

  /**
   * ホストが存在するか確認
   * @returns {boolean}
   */
  hasHost() {
    return Array.from(this.clients.values()).some((info) => info.role === 'host');
  }

  /**
   * クライアント登録（join: 旧仕様互換）
   */
  async handleJoin(ws, message) {
    const clientInfo = this.clients.get(ws);
    
    if (clientInfo) {
      const requestedRole = message.role;

      if (requestedRole === 'viewer') {
        const hasHost = Array.from(this.clients.values()).some(
          (info) => info.role === 'host'
        );
        if (!hasHost) {
          this.sendTo(ws, {
            type: 'error',
            message: 'ホストが開始されていません'
          });
          ws.close();
          return;
        }
      }
      
      // ★ ホスト権限のセキュリティチェック
      if (requestedRole === 'host') {
        const hostCheck = this.canAssignHost(ws);
        if (!hostCheck.allowed) {
          this.sendTo(ws, {
            type: 'error',
            message: hostCheck.reason === 'already-host'
              ? 'すでにホストが存在します'
              : 'ホストになれるのはローカル接続のみです'
          });
          
          // 強制的にviewerに変更
          clientInfo.role = 'viewer';
          clientInfo.roomId = message.roomId;
          
          this.sendTo(ws, {
            type: 'joined',
            role: 'viewer',
            roomId: message.roomId
          });
          
          console.log(`✅ 参加: viewer (強制変更) (部屋: ${message.roomId || 'なし'})`);
          return;
        }
        
      }
      
      // ★ セキュリティチェック通過 or viewer
      clientInfo.role = requestedRole;
      clientInfo.roomId = message.roomId;
      
      console.log(`✅ 参加: ${requestedRole} (部屋: ${message.roomId || 'なし'})`);
    }

    // 参加確認を返す
    this.sendTo(ws, {
      type: 'joined',
      role: clientInfo.role,
      roomId: message.roomId
    });

    // スタンプリストを送信（StampManagerから取得）
    if (this.stampManager) {
      try {
        const stamps = this.stampManager.getStamps();
        const categories = this.stampConfig ? this.stampConfig.getCategories() : [];
        this.sendTo(ws, {
          type: 'stamp-list',
          stamps: stamps,
          categories: categories
        });
        console.log(`📤 スタンプリスト送信: ${stamps.length}件 (接続時)`);
      } catch (error) {
        console.error('❌ スタンプリスト送信失敗:', error);
      }
    }
    
    // ★ 設定を送信
    if (this.stampConfig) {
      try {
        const config = this.stampConfig.getAll();
        this.sendTo(ws, {
          type: 'stamp-config',
          config: {
            videoVolume: config.videoVolume || 50,
            muteVideo: config.muteVideo || false,
            stampDuration: config.stampDuration || 3,
            stampBaseSize: config.stampBaseSize || 220,
            staticThumbnailPreview: !!config.staticThumbnailPreview,
            thumbnailHoverZoom: !!config.thumbnailHoverZoom
          }
        });
        console.log('⚙️ スタンプ設定送信 (接続時)');
      } catch (error) {
        console.error('❌ スタンプ設定送信失敗:', error);
      }
    }

    // ★ キュー受付状態を送信
    this.sendTo(ws, {
      type: 'queue-enabled',
      enabled: this.queueEnabled
    });
    console.log(`📋 キュー受付状態送信 (接続時): ${this.queueEnabled ? 'ON' : 'OFF'}`);

    // ★ 現在のキューを送信
    if (this.videoQueue.length > 0) {
      this.sendTo(ws, {
        type: 'queue-update',
        queue: this.videoQueue,
        enabled: this.queueEnabled
      });
      console.log(`📋 現在のキュー送信 (接続時): ${this.videoQueue.length}件`);
    }

    if (this.vcastConfig) {
      this.sendTo(ws, {
        type: 'vcast-config',
        config: this.vcastConfig.getAll()
      });
    }

    if (this.vcastState) {
      this.sendTo(ws, {
        type: 'vcast-state',
        state: this.vcastState.getState()
      });
    }

    // ★ プロフィール設定を送信（接続時）
    this.handleProfileConfigRequest(ws);
  }

  setupOhinerimakiCleanup() {
    setInterval(() => {
      const now = Date.now();
      const THIRTY_MINUTES = 30 * 60 * 1000;
      for (const [ip, timestamp] of this.ohinerimakiRateLimit.entries()) {
        if (now - timestamp > THIRTY_MINUTES) {
          this.ohinerimakiRateLimit.delete(ip);
        }
      }
    }, 60 * 60 * 1000);
  }

  /**
   * クライアント登録
   */
  handleRegister(ws, message) {
    const clientInfo = this.clients.get(ws);
    
    if (clientInfo) {
      let assignedRole = message.role;
      let hostCheckReason = null;
      if (message.role === 'host') {
        const hostCheck = this.canAssignHost(ws);
        if (!hostCheck.allowed) {
          assignedRole = 'viewer';
          hostCheckReason = hostCheck.reason;
        }
      }
      if (assignedRole !== message.role) {
        this.sendTo(ws, {
          type: 'error',
          message: hostCheckReason === 'already-host'
            ? 'すでにホストが存在します'
            : 'ホストになれるのはローカル接続のみです'
        });
      }
      clientInfo.role = assignedRole;
      clientInfo.videoId = message.videoId;
      
      console.log(`✅ 登録: ${clientInfo.role} (Video: ${message.videoId || 'なし'})`);
    }

    // 登録確認を返す
    this.sendTo(ws, {
      type: 'registered',
      role: message.role
    });
  }

  /**
   * 動画同期処理
   */
  handleSync(ws, message) {
    const clientInfo = this.clients.get(ws);

    // ホストからの同期メッセージの場合
    if (clientInfo && clientInfo.role === 'host') {
      // 全リスナーにブロードキャスト
      this.broadcast(message, ws);
    }
  }

  /**
   * スタンプ処理
   */
  /**
   * 特定のクライアントにメッセージ送信
   * @param {WebSocket} ws - 送信先
   * @param {object} message - メッセージ
   */
  sendTo(ws, message) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  sendToHosts(message) {
    this.clients.forEach((clientInfo, ws) => {
      if (clientInfo.role === 'host' && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    });
  }

  /**
   * 全クライアントにブロードキャスト
   * @param {object} message - メッセージ
   * @param {WebSocket} excludeWs - 除外するクライアント（送信元など）
   */
  broadcast(message, excludeWs = null) {
    this.clients.forEach((clientInfo, ws) => {
      if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
      }
    });
  }

  /**
   * 接続中のクライアント数を取得
   * @returns {number}
   */
  getClientCount() {
    return this.clients.size;
  }

  /**
   * 接続中のホスト数を取得
   * @returns {number}
   */
  getHostCount() {
    let count = 0;
    this.clients.forEach((info) => {
      if (info.role === 'host') count++;
    });
    return count;
  }
  /**
   * クリーンアップ
   */
  close() {
    this.clients.forEach((_, ws) => {
      ws.close();
    });
    this.wss.close();
    console.log('✅ WebSocketサーバーを停止しました');
  }

  handleProfileConfigRequest(ws) {
    if (!this.profileConfig) return;
    try {
      this.sendTo(ws, {
        type: 'profile-config-sync',
        config: this.profileConfig.getAll()
      });
    } catch (error) {
      console.error('❌ プロフィール設定送信失敗:', error);
    }
  }
}

module.exports = WebSocketManager;
