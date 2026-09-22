const express = require('express');
const path = require('path');
const http = require('http');
const https = require('https');
const imageStore = require('./image-store');

// 設定ファイルからスタンプディレクトリを取得
const CONFIG = require('../config/default');

/**
 * YP（イエローページ）データを取得
 * @param {string} url - YP URL
 * @returns {Promise<string>} YPデータ（テキスト）
 */
function fetchYP(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    
    const request = client.get(url, (response) => {
      let data = '';
      
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        resolve(data);
      });
    }).on('error', reject);
    request.setTimeout(CONFIG.API.YP_TIMEOUT, () => request.destroy(new Error('YP取得タイムアウト')));
  });
}

/**
 * APIルートを設定
 * @param {express.Application} app - Expressアプリ
 * @param {UPnPManager} upnpManager - UPnPマネージャー
 * @param {StampHandler} stampHandler - スタンプハンドラー
 * @param {StampManager} stampManager - スタンプマネージャー
 * @param {StampConfig} stampConfig - スタンプ設定
 * @param {ProfileConfig} profileConfig - プロフィール設定
 * @param {OhinerimakiConfig} ohinerimakiConfig - おひねり設定
 * @param {VcastConfig} vcastConfig - Vcast設定
 * @param {VcastState} vcastState - Vcast状態
 */
function setupRoutes(
  app,
  upnpManager,
  stampHandler,
  stampManager = null,
  stampConfig = null,
  profileConfig = null,
  ohinerimakiConfig = null,
  vcastConfig = null,
  vcastState = null,
  wsManager = null
) {
  const isLocalRequest = (req) => {
    const ip = req.ip || '';
    if (ip === '::1' || ip === '::ffff:127.0.0.1') {
      return true;
    }
    return /^127\./.test(ip);
  };

  const upnpPort = CONFIG.UPNP.PUBLIC_PORT || 7244;
  
  // 管理操作はローカルのアプリ画面からのみ受け付ける。
  app.use('/api', (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD') return next();
    const origin = req.headers.origin;
    const expected = req.protocol + '://' + req.headers.host;
    if (!isLocalRequest(req) || (origin && origin !== expected)) {
      return res.status(403).json({ success: false, error: '管理操作はローカル接続のみ利用できます' });
    }
    next();
  });
  // アプリから接続したリスナーが取得する公開情報のみCORSを許可する。
  app.get('/api/public/ohinerimaki-config', (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({ success: true, config: ohinerimakiConfig?.getConfig() || {} });
  });
  app.use((req, res, next) => {
    if (/^\/(?:profile-config|stamp-config)\.json$/.test(req.path)) return res.sendStatus(404);
    next();
  });

  // ===== 静的ファイル配信 =====
  // ★ 画像フォルダを公開（プロフィール/Vcast）
  console.log(`[ROUTES] 画像フォルダを公開: ${CONFIG.SERVER.IMAGE_DIR}`);
  app.use(
    CONFIG.SERVER.IMAGE_PUBLIC_PATH,
    express.static(CONFIG.SERVER.IMAGE_DIR, {
      maxAge: '30d',
      setHeaders: (res) => {
        res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
      }
    })
  );

  // ★ スタンプフォルダを明示的に公開（CONFIG.SERVER.STAMP_DIRを使用）
  console.log(`[ROUTES] スタンプフォルダを公開: ${CONFIG.SERVER.STAMP_DIR}`);
  app.use('/stamps', express.static(CONFIG.SERVER.STAMP_DIR, {
    setHeaders(res, filename) {
      // 再生成時にURLのvだけを更新する。旧URLは再検証可能なままにする。
      if (res.req.query.v && /^\d+$/.test(String(res.req.query.v))) {
        res.setHeader('Cache-Control', 'public, max-age=2592000, immutable');
      }
    }
  }));

  // public 配信は最後にして、/images や /stamps を優先させる
  app.use(express.static(path.join(__dirname, '..', 'public')));
  
  // ===== YP（イエローページ）API =====
  
  // YP一覧取得（2つのサーバーから取得して統合）
  app.get('/api/yp', async (req, res) => {
    try {
      // 2つのYPサーバーから並列取得
      const [bayonet, pAt] = await Promise.allSettled([
        fetchYP('http://bayonet.ddo.jp/sp/index.txt'),
        fetchYP('https://p-at.net/index.txt')
      ]);

      let combinedData = '';

      // bayonetのデータを追加
      if (bayonet.status === 'fulfilled' && bayonet.value) {
        combinedData += bayonet.value.trim();
      }

      // p-at.netのデータを追加
      if (pAt.status === 'fulfilled' && pAt.value) {
        if (combinedData) combinedData += '\n';
        combinedData += pAt.value.trim();
      }

      // 重複を除去
      const lines = combinedData.split('\n');
      const uniqueLines = [...new Set(lines)].filter(line => line.trim());

      const collator = new Intl.Collator('ja', { numeric: true, sensitivity: 'base' });
      const parsedEntries = uniqueLines.map((line) => {
        const fields = line.split('<>');
        const channelName = fields[0] || '';
        const detail = fields[5] || '';
        const comment = fields[17] || '';
        const hasDollar = /[$＄]/.test(detail) || /[$＄]/.test(comment);
        const displayName = `${hasDollar ? '【$】' : ''}${channelName}`;
        fields[0] = displayName;
        return {
          line: fields.join('<>'),
          sortKey: displayName,
          hasDollar
        };
      });

      const sortedEntries = parsedEntries.sort((a, b) => {
        if (a.hasDollar !== b.hasDollar) {
          return a.hasDollar ? -1 : 1;
        }
        return collator.compare(a.sortKey, b.sortKey);
      });

      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.send(sortedEntries.map(entry => entry.line).join('\n'));

      console.log(`  YP取得成功: ${sortedEntries.length}件`);
    } catch (error) {
      console.error('? YP取得失敗:', error);
      res.status(500).send('YP取得失敗');
    }
  });

  // ===== UPnP API =====
  
  // ポート開放
  app.post('/api/upnp/open', async (req, res) => {
    if (!isLocalRequest(req)) {
      res.status(403).json({
        success: false,
        message: 'UPnP は localhost のみ実行可能です'
      });
      return;
    }
    const result = await upnpManager.openPort(upnpPort);
    res.json(result);
  });

  // ポート閉鎖
  app.post('/api/upnp/close', async (req, res) => {
    if (!isLocalRequest(req)) {
      res.status(403).json({
        success: false,
        message: 'UPnP は localhost のみ実行可能です'
      });
      return;
    }
    const result = await upnpManager.closePort(upnpPort);
    res.json(result);
  });

  // 外部IP取得
  app.get('/api/upnp/ip', async (req, res) => {
    if (!isLocalRequest(req)) {
      res.status(403).json({
        success: false,
        message: 'UPnP は localhost のみ実行可能です'
      });
      return;
    }
    const ip = await upnpManager.getExternalIP();
    res.json({ ip });
  });

  // ===== スタンプ API =====

  // スタンプ一覧取得
  app.get('/api/stamps', async (req, res) => {
    try {
      const stamps = stampManager ? stampManager.getStamps() : [];
      res.json({ success: true, stamps });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // スタンプ追加（この処理は実際にはIPCハンドラー側で行う想定）
  app.post('/api/stamps', async (req, res) => {
    try {
      const { srcPath, stampId } = req.body;
      const result = await stampHandler.addStamp(srcPath, stampId);
      res.json({ success: true, stamp: result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // スタンプ削除
  app.delete('/api/stamps/:stampId', async (req, res) => {
    try {
      const { stampId } = req.params;
      await stampHandler.deleteStamp(stampId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // ===== スタンプ設定 API =====

  // スタンプ設定取得
  app.get('/api/stamp-config', (req, res) => {
    if (!stampConfig) {
      return res.status(500).json({ success: false, error: 'スタンプ設定が利用できません' });
    }
    
    res.json({
      success: true,
      config: isLocalRequest(req) ? stampConfig.getAll() : (({ discordPassword, discordServerPasswords, ...config }) => config)(stampConfig.getAll())
    });
  });

  // ファイルサイズ上限を設定
  app.post('/api/stamp-config/max-file-size', async (req, res) => {
    try {
      if (!stampConfig) {
        throw new Error('スタンプ設定が利用できません');
      }
      
      const { sizeMB } = req.body;
      await stampConfig.setMaxFileSize(sizeMB);
      
      res.json({
        success: true,
        maxFileSize: stampConfig.config.maxFileSize
      });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // 最大スタンプ数を設定
  app.post('/api/stamp-config/max-stamp-count', async (req, res) => {
    try {
      if (!stampConfig) {
        throw new Error('スタンプ設定が利用できません');
      }
      
      const { count } = req.body;
      await stampConfig.setMaxStampCount(count);
      
      res.json({
        success: true,
        maxStampCount: stampConfig.config.maxStampCount
      });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // リスナーのスタンプ追加権限を設定
  app.post('/api/stamp-config/listener-permission', async (req, res) => {
    try {
      if (!stampConfig) {
        throw new Error('スタンプ設定が利用できません');
      }
      
      const { permission } = req.body;
      await stampConfig.setListenerAddPermission(permission);
      
      res.json({
        success: true,
        listenerAddPermission: stampConfig.config.listenerAddPermission
      });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // 許可するDiscordサーバーを追加
  app.post('/api/stamp-config/discord-server', async (req, res) => {
    try {
      if (!stampConfig) {
        throw new Error('スタンプ設定が利用できません');
      }
      
      const { serverId, password } = req.body;
      await stampConfig.addAllowedDiscordServer(serverId, password);
      
      res.json({
        success: true,
        allowedDiscordServerIds: stampConfig.config.allowedDiscordServerIds
      });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // 許可するDiscordサーバーを削除
  app.delete('/api/stamp-config/discord-server/:serverId', async (req, res) => {
    try {
      if (!stampConfig) {
        throw new Error('スタンプ設定が利用できません');
      }
      
      const { serverId } = req.params;
      await stampConfig.removeAllowedDiscordServer(serverId);
      
      res.json({
        success: true,
        allowedDiscordServerIds: stampConfig.config.allowedDiscordServerIds
      });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

 // すべての設定をまとめて保存
  app.post('/api/stamp-config/save-all', async (req, res) => {
    try {
      if (!stampConfig) {
        throw new Error('スタンプ設定が利用できません');
      }
      
      const { maxFileSize, maxStampCount, discordPassword, videoVolume, muteVideo, stampDuration, stampBaseSize, stampSound, stampSoundVolume, staticThumbnailPreview, thumbnailHoverZoom } = req.body;
      
      // ★ 設定を更新（saveは一度だけ）
      if (maxFileSize !== undefined) {
        stampConfig.config.maxFileSize = maxFileSize;
      }
      
      if (maxStampCount !== undefined) {
        stampConfig.config.maxStampCount = maxStampCount;
      }
      
      if (discordPassword !== undefined) {
        stampConfig.config.discordPassword = discordPassword || null;
      }
      
      if (videoVolume !== undefined) {
        stampConfig.config.videoVolume = videoVolume;
      }
      
      if (muteVideo !== undefined) {
        stampConfig.config.muteVideo = muteVideo;
      }
      
      if (stampDuration !== undefined) {
        stampConfig.config.stampDuration = stampDuration;
      }

      if (stampBaseSize !== undefined) {
        const baseSize = parseInt(stampBaseSize, 10);
        if (!Number.isFinite(baseSize) || baseSize < 120 || baseSize > 480) {
          throw new Error('スタンプ規定サイズは120?480pxで設定してください');
        }
        stampConfig.config.stampBaseSize = baseSize;
      }
      
      if (stampSound !== undefined) {
        stampConfig.config.stampSound = stampSound;
      }
      
      if (stampSoundVolume !== undefined) {
        stampConfig.config.stampSoundVolume = stampSoundVolume;
      }

      if (staticThumbnailPreview !== undefined) {
        stampConfig.config.staticThumbnailPreview = !!staticThumbnailPreview;
      }

      if (thumbnailHoverZoom !== undefined) {
        stampConfig.config.thumbnailHoverZoom = !!thumbnailHoverZoom;
      }
      
      // ★ 一度だけ保存
      await stampConfig.save();
      
      res.json({
        success: true,
        config: stampConfig.getAll()
      });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });
  // ===== プロフィール設定 API =====
  
  // プロフィール設定取得
  app.get('/api/profile-config', async (req, res) => {
    if (!profileConfig) {
      return res.status(500).json({ success: false, error: 'プロフィール設定が利用できません' });
    }

    const config = profileConfig.getPublic();
    const photo = config?.profile?.photo;
    if (imageStore.isImageDataUrl(photo)) {
      try {
        const stored = await imageStore.maybeStoreImage({
          value: photo,
          imageDir: CONFIG.SERVER.IMAGE_DIR,
          publicBasePath: CONFIG.SERVER.IMAGE_PUBLIC_PATH,
          baseName: 'profile-photo',
          maxBytes: 500 * 1024
        });
        if (stored.updated) {
          config.profile.photo = stored.value;
          await profileConfig.save();
        }
      } catch (error) {
        console.error('[ROUTES] プロフィール画像の移行に失敗:', error);
      }
    }
    
    res.json({
      success: true,
      config
    });
  });
  
  // プロフィール設定保存
  app.post('/api/profile-config', async (req, res) => {
    try {
      if (!profileConfig) {
        throw new Error('プロフィール設定が利用できません');
      }

      const payload = req.body;
      if (payload?.profile?.photo) {
        const stored = await imageStore.maybeStoreImage({
          value: payload.profile.photo,
          imageDir: CONFIG.SERVER.IMAGE_DIR,
          publicBasePath: CONFIG.SERVER.IMAGE_PUBLIC_PATH,
          baseName: 'profile-photo',
          maxBytes: 500 * 1024
        });
        payload.profile.photo = stored.value;
      }

      await profileConfig.update(payload);
      
      res.json({
        success: true,
        config: profileConfig.getAll()
      });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // BANリスト取得（ローカルのみ）
  app.get('/api/profile-config/ban-list', (req, res) => {
    if (!profileConfig) {
      return res.status(500).json({ success: false, error: 'プロフィール設定が利用できません' });
    }
    if (!isLocalRequest(req)) {
      return res.status(403).json({ success: false, message: 'ローカル接続のみ利用できます' });
    }

    res.json({
      success: true,
      bannedIps: profileConfig.getBannedIps()
    });
  });

  // BANリスト追加（ローカルのみ）
  app.post('/api/profile-config/ban-list', async (req, res) => {
    try {
      if (!profileConfig) {
        throw new Error('プロフィール設定が利用できません');
      }
      if (!isLocalRequest(req)) {
        return res.status(403).json({ success: false, message: 'ローカル接続のみ利用できます' });
      }
      const ip = req.body?.ip || '';
      await profileConfig.addBannedIp(ip);
      if (wsManager && typeof wsManager.disconnectClientsByIp === 'function') {
        wsManager.disconnectClientsByIp(ip);
      }
      res.json({
        success: true,
        bannedIps: profileConfig.getBannedIps()
      });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  // BANリスト削除（ローカルのみ）
  app.delete('/api/profile-config/ban-list/:ip', async (req, res) => {
    try {
      if (!profileConfig) {
        throw new Error('プロフィール設定が利用できません');
      }
      if (!isLocalRequest(req)) {
        return res.status(403).json({ success: false, message: 'ローカル接続のみ利用できます' });
      }
      await profileConfig.removeBannedIp(req.params.ip || '');
      res.json({
        success: true,
        bannedIps: profileConfig.getBannedIps()
      });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  });

  // ===== おひねり設定 API =====

  app.get('/api/ohinerimaki-config', async (req, res) => {
    if (!ohinerimakiConfig) {
      return res.status(500).json({ success: false, error: 'おひねり設定が利用できません' });
    }

    const config = ohinerimakiConfig.getConfig();
    const qrImage = config?.links?.qrImage;
    if (imageStore.isImageDataUrl(qrImage)) {
      try {
        const stored = await imageStore.maybeStoreImage({
          value: qrImage,
          imageDir: CONFIG.SERVER.IMAGE_DIR,
          publicBasePath: CONFIG.SERVER.IMAGE_PUBLIC_PATH,
          baseName: 'ohinerimaki-qr',
          maxBytes: 500 * 1024
        });
        if (stored.updated) {
          config.links.qrImage = stored.value;
          await ohinerimakiConfig.updateConfig({ links: { qrImage: stored.value } });
        }
      } catch (error) {
        console.error('[ROUTES] おひねりQR画像の移行に失敗:', error);
      }
    }

    res.json({
      success: true,
      config
    });
  });

  app.post('/api/ohinerimaki-config', async (req, res) => {
    try {
      if (!ohinerimakiConfig) {
        throw new Error('おひねり設定が利用できません');
      }
      if (!isLocalRequest(req)) {
        return res.status(403).json({ success: false, error: 'ローカル接続のみ変更できます' });
      }

      const payload = req.body;
      if (payload?.links?.qrImage) {
        const stored = await imageStore.maybeStoreImage({
          value: payload.links.qrImage,
          imageDir: CONFIG.SERVER.IMAGE_DIR,
          publicBasePath: CONFIG.SERVER.IMAGE_PUBLIC_PATH,
          baseName: 'ohinerimaki-qr',
          maxBytes: 500 * 1024
        });
        payload.links.qrImage = stored.value;
      }

      await ohinerimakiConfig.updateConfig(payload);

      res.json({
        success: true,
        config: ohinerimakiConfig.getConfig()
      });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.get('/api/ohinerimaki-notifications', (req, res) => {
    if (!isLocalRequest(req)) return res.sendStatus(403);
    if (!ohinerimakiConfig) {
      return res.status(500).json({ success: false, error: 'おひねり通知が利用できません' });
    }

    res.json({
      success: true,
      notifications: ohinerimakiConfig.getNotifications()
    });
  });

  app.post('/api/ohinerimaki-notifications/delete', async (req, res) => {
    try {
      if (!ohinerimakiConfig) {
        throw new Error('おひねり通知が利用できません');
      }

      const { id } = req.body;
      if (!id) {
        throw new Error('id が指定されていません');
      }

      const deleted = await ohinerimakiConfig.deleteNotification(id);
      res.json({
        success: true,
        deleted
      });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  // ===== Vcast API =====

  app.get('/api/vcast-config', async (req, res) => {
    if (!vcastConfig) {
      return res.status(500).json({ success: false, error: 'Vcast設定が利用できません' });
    }

    const config = vcastConfig.getAll();
    const avatarImage = config?.avatarImage;
    if (imageStore.isImageDataUrl(avatarImage)) {
      try {
        const stored = await imageStore.maybeStoreImage({
          value: avatarImage,
          imageDir: CONFIG.SERVER.IMAGE_DIR,
          publicBasePath: CONFIG.SERVER.IMAGE_PUBLIC_PATH,
          baseName: 'vcast-avatar',
          maxBytes: 100 * 1024 * 1024
        });
        if (stored.updated) {
          config.avatarImage = stored.value;
          await vcastConfig.save();
        }
      } catch (error) {
        console.error('[ROUTES] Vcastアバター画像の移行に失敗:', error);
      }
    }

    res.json({
      success: true,
      config
    });
  });

  app.post('/api/vcast-config', async (req, res) => {
    try {
      if (!vcastConfig) {
        throw new Error('Vcast設定が利用できません');
      }

      const payload = req.body;
      if (payload?.avatarImage) {
        if (!isLocalRequest(req)) {
          return res.status(403).json({ success: false, error: 'Vcastアバターのアップロードはlocalhost限定です' });
        }
        const stored = await imageStore.maybeStoreImage({
          value: payload.avatarImage,
          imageDir: CONFIG.SERVER.IMAGE_DIR,
          publicBasePath: CONFIG.SERVER.IMAGE_PUBLIC_PATH,
          baseName: 'vcast-avatar',
          maxBytes: 100 * 1024 * 1024
        });
        payload.avatarImage = stored.value;
      }

      await vcastConfig.update(payload);
      res.json({
        success: true,
        config: vcastConfig.getAll()
      });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  });

  app.get('/api/vcast-state', (req, res) => {
    if (!vcastState) {
      return res.status(500).json({ success: false, error: 'Vcast状態が利用できません' });
    }

    res.json({
      success: true,
      state: vcastState.getState()
    });
  });
  
  // ===== ヘルスチェック =====
  
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    });
  });

  console.log('? APIルートを設定しました');
}

module.exports = setupRoutes;
