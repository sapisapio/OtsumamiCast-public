/**
 * OtsumamiCast - メインサーバー
 * 
 * Express + WebSocket + UPnP を統合したサーバー
 * 開発環境: npm run dev:server
 * ビルド環境: Electronから自動起動
 */

const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs').promises;

// 自作モジュール
const UPnPManager = require('./upnp');
const WebSocketManager = require('./websocket');
const StampHandler = require('./stamp-handler');
const StampManager = require('./stamp-manager');
const StampConfig = require('./stamp-config');
const ProfileConfig = require('./profile-config');
const OhinerimakiConfig = require('./ohinerimaki-config');
const VcastConfig = require('./vcast-config');
const { VcastState } = require('./vcast-state');
const imageStore = require('./image-store');
const setupRoutes = require('./routes');

// 設定
const CONFIG = require('../config/default');

// ===== サーバー初期化 =====
const app = express();
const server = http.createServer(app);

// JSONボディパーサー（Vcastアバター画像のアップロードに備えて上限を拡大）
app.use(express.json({ limit: '150mb' }));


// ===== モジュール初期化 =====
const upnpManager = new UPnPManager({
  publicPort: CONFIG.UPNP.PUBLIC_PORT,
  privatePort: CONFIG.UPNP.PRIVATE_PORT,
  ttl: CONFIG.UPNP.TTL,
  description: CONFIG.UPNP.DESCRIPTION
});
const stampHandler = new StampHandler(CONFIG.SERVER.STAMP_DIR, {
  thumbSize: CONFIG.CLIENT.STAMP_THUMB_SIZE
});
const stampConfig = new StampConfig(CONFIG.SERVER.STAMP_CONFIG_PATH);
const profileConfig = new ProfileConfig(CONFIG.SERVER.PROFILE_CONFIG_PATH);
const stampManager = new StampManager(CONFIG.SERVER.STAMP_LIST_PATH, stampConfig);
const ohinerimakiConfig = new OhinerimakiConfig(
  CONFIG.SERVER.OHINERIMAKI_CONFIG_PATH,
  CONFIG.SERVER.OHINERIMAKI_NOTIFICATIONS_PATH
);
const vcastConfig = new VcastConfig(CONFIG.SERVER.VCAST_CONFIG_PATH);
const vcastState = new VcastState(
  CONFIG.SERVER.VCAST_STATE_PATH,
  CONFIG.SERVER.VCAST_SECRET_PATH
);
const wsManager = new WebSocketManager(
  server,
  stampHandler,
  stampManager,
  stampConfig,
  profileConfig,
  ohinerimakiConfig,
  vcastConfig,
  vcastState
);

// ===== 起動処理 =====
async function startServer() {
  try {
    console.log('[SERVER] サーバー起動処理開始...');
    console.log('[SERVER] スタンプディレクトリ:', CONFIG.SERVER.STAMP_DIR);
    console.log('[SERVER] スタンプリスト:', CONFIG.SERVER.STAMP_LIST_PATH);
    console.log('[SERVER] スタンプ設定:', CONFIG.SERVER.STAMP_CONFIG_PATH);
    console.log('[SERVER] プロフィール設定:', CONFIG.SERVER.PROFILE_CONFIG_PATH);
    console.log('[SERVER] おひねり設定:', ohinerimakiConfig.configPath);
    console.log('[SERVER] Vcast設定:', CONFIG.SERVER.VCAST_CONFIG_PATH);

    // スタンプディレクトリ初期化
    await stampHandler.initialize();
    await upnpManager.initialize();

    // スタンプ設定を読み込み
    await stampConfig.initialize();
    
    // プロフィール設定を読み込み
    await profileConfig.initialize();

    // スタンプリスト読み込み
    await stampManager.initialize();
    await ohinerimakiConfig.initialize();
    await vcastConfig.initialize();
    await vcastState.initialize();

    // 画像保存ディレクトリを初期化
    await fs.mkdir(CONFIG.SERVER.IMAGE_DIR, { recursive: true });

    // プロフィール画像の移行（Base64 → ファイル）
    const profileData = profileConfig.getAll();
    const profilePhoto = profileData?.profile?.photo;
    if (imageStore.isImageDataUrl(profilePhoto)) {
      const stored = await imageStore.maybeStoreImage({
        value: profilePhoto,
        imageDir: CONFIG.SERVER.IMAGE_DIR,
        publicBasePath: CONFIG.SERVER.IMAGE_PUBLIC_PATH,
        baseName: 'profile-photo',
        maxBytes: 500 * 1024
      });
      if (stored.updated) {
        profileData.profile.photo = stored.value;
        await profileConfig.save();
      }
    }

    // Vcastアバター画像の移行（Base64 → ファイル）
    const vcastData = vcastConfig.getAll();
    const vcastAvatar = vcastData?.avatarImage;
    if (imageStore.isImageDataUrl(vcastAvatar)) {
      const stored = await imageStore.maybeStoreImage({
        value: vcastAvatar,
        imageDir: CONFIG.SERVER.IMAGE_DIR,
        publicBasePath: CONFIG.SERVER.IMAGE_PUBLIC_PATH,
        baseName: 'vcast-avatar',
        maxBytes: 100 * 1024 * 1024
      });
      if (stored.updated) {
        vcastData.avatarImage = stored.value;
        await vcastConfig.save();
      }
    }

    // APIルート設定
    setupRoutes(
      app,
      upnpManager,
      stampHandler,
      stampManager,
      stampConfig,
      profileConfig,
      ohinerimakiConfig,
      vcastConfig,
      vcastState,
      wsManager
    );

    // サーバー起動
await new Promise((resolve, reject) => {
server.once('error', reject);
server.listen(CONFIG.SERVER.PORT, CONFIG.SERVER.HOST, () => {
  server.removeListener('error', reject);
  resolve();
  console.log('');
  console.log('='.repeat(50));
  console.log('🎉 OtsumamiCast サーバー起動');
  console.log('='.repeat(50));
  console.log(`📡 ポート: ${CONFIG.SERVER.PORT}`);
  console.log(`🌐 IPv4: http://0.0.0.0:${CONFIG.SERVER.PORT}`);
  console.log(`🌐 ネットワーク: http://192.168.1.50:${CONFIG.SERVER.PORT}`);
  console.log(`🌐 ローカル: http://localhost:${CONFIG.SERVER.PORT}`);
  console.log(`📁 スタンプフォルダ: ${CONFIG.SERVER.STAMP_DIR}`);
  console.log(`📄 スタンプリスト: ${CONFIG.SERVER.STAMP_LIST_PATH}`);
  console.log(`⚙️  スタンプ設定: ${CONFIG.SERVER.STAMP_CONFIG_PATH}`);
  console.log(`🔧 環境: ${CONFIG.SERVER.NODE_ENV}`);
  console.log('='.repeat(50));
  console.log('');
});
});
  } catch (error) {
    console.error('❌ サーバー起動エラー:', error);
    console.error('スタック:', error.stack);
    throw error;
  }
}

let shutdownPromise;
function shutdown() {
  if (shutdownPromise) return shutdownPromise;
  shutdownPromise = (async () => {
    wsManager.close();
    server.close();
    await upnpManager.cleanup();
    await Promise.all([stampConfig.save(), profileConfig.save(), ohinerimakiConfig.saveConfig(), vcastConfig.save(), vcastState.saveState()]);
  })();
  return shutdownPromise;
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => shutdown().finally(() => process.exit(0)));
const ready = startServer();
if (require.main === module) ready.catch(error => { console.error(error); process.exit(1); });
module.exports = { ready, shutdown };
