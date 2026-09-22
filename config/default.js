/**
 * OtsumamiCast - 設定ファイル
 * 
 * サーバー・クライアント共通の設定値を一元管理
 * 環境変数で上書き可能
 * 
 * ★★★ パッケージ版では OTS_USER_DATA 環境変数を使用 ★★★
 */

const path = require('path');

// userData パスを取得（Electron から渡される）
const USER_DATA_DIR = process.env.OTS_USER_DATA;

// パッケージ版かどうか判定
const isPackaged = USER_DATA_DIR !== undefined;

const CONFIG = {
  // ===== サーバー設定 =====
  SERVER: {
    // ポート番号
    PORT: require('./app-settings').getPort(),
    
    // バインドするホスト
    HOST: process.env.HOST || '0.0.0.0',
    
    // スタンプ保存ディレクトリ
    // ★ パッケージ版: userData/stamps
    // ★ 開発版: public/stamps
    STAMP_DIR: isPackaged
      ? path.join(USER_DATA_DIR, 'stamps')
      : path.join(__dirname, '..', 'public', 'stamps'),
    
    // スタンプメタデータファイル
    // ★ パッケージ版: userData/stamp-list.json
    // ★ 開発版: プロジェクトルート/stamp-list.json
    STAMP_LIST_PATH: isPackaged
      ? path.join(USER_DATA_DIR, 'stamp-list.json')
      : path.join(__dirname, '..', 'stamp-list.json'),
    
    // スタンプ設定ファイル
    // ★ パッケージ版: userData/stamp-config.json
    // ★ 開発版: public/stamp-config.json
    STAMP_CONFIG_PATH: isPackaged
      ? path.join(USER_DATA_DIR, 'stamp-config.json')
      : path.join(__dirname, '..', 'public', 'stamp-config.json'),
    
    // プロフィール設定ファイル
    // ★ パッケージ版: userData/profile-config.json
    // ★ 開発版: public/profile-config.json
    PROFILE_CONFIG_PATH: isPackaged
      ? path.join(USER_DATA_DIR, 'profile-config.json')
      : path.join(__dirname, '..', 'public', 'profile-config.json'),

    // おひねり設定ファイル
    // ★ パッケージ版: userData/ohinerimaki-config.json
    // ★ 開発版: server/data/ohinerimaki-config.json
    OHINERIMAKI_CONFIG_PATH: isPackaged
      ? path.join(USER_DATA_DIR, 'ohinerimaki-config.json')
      : path.join(__dirname, '..', 'server', 'data', 'ohinerimaki-config.json'),

    // おひねり通知履歴
    // ★ パッケージ版: userData/ohinerimaki-notifications.json
    // ★ 開発版: server/data/ohinerimaki-notifications.json
    OHINERIMAKI_NOTIFICATIONS_PATH: isPackaged
      ? path.join(USER_DATA_DIR, 'ohinerimaki-notifications.json')
      : path.join(__dirname, '..', 'server', 'data', 'ohinerimaki-notifications.json'),

    // Vcast設定ファイル
    // ★ パッケージ版: userData/vcast-config.json
    // ★ 開発版: server/data/vcast-config.json
    VCAST_CONFIG_PATH: isPackaged
      ? path.join(USER_DATA_DIR, 'vcast-config.json')
      : path.join(__dirname, '..', 'server', 'data', 'vcast-config.json'),

    // Vcast状態ファイル
    // ★ パッケージ版: userData/vcast-state.json
    // ★ 開発版: server/data/vcast-state.json
    VCAST_STATE_PATH: isPackaged
      ? path.join(USER_DATA_DIR, 'vcast-state.json')
      : path.join(__dirname, '..', 'server', 'data', 'vcast-state.json'),

    // Vcast署名用シークレット
    // ★ パッケージ版: userData/vcast-secret.json
    // ★ 開発版: server/data/vcast-secret.json
    VCAST_SECRET_PATH: isPackaged
      ? path.join(USER_DATA_DIR, 'vcast-secret.json')
      : path.join(__dirname, '..', 'server', 'data', 'vcast-secret.json'),

    // 画像保存ディレクトリ
    // ★ パッケージ版: userData/images
    // ★ 開発版: public/images
    IMAGE_DIR: isPackaged
      ? path.join(USER_DATA_DIR, 'images')
      : path.join(__dirname, '..', 'public', 'images'),

    // 画像公開パス
    IMAGE_PUBLIC_PATH: '/images',
    
    // 環境
    NODE_ENV: process.env.NODE_ENV || 'development',
    
    // デバッグモード
    DEBUG: process.env.DEBUG === 'true'
  },

  // ===== クライアント設定 =====
  CLIENT: {
    // 固定ルームID
    FIXED_ROOM_ID: 'otsumamicast',
    
    // デフォルトのビューアーオフセット（秒）
    DEFAULT_OFFSET: 0,
    
    // 最近使ったスタンプの最大数
    RECENT_STAMP_LIMIT: 10,
    
    // スタンプの最大サイズ（ピクセル）
    STAMP_MAX_SIZE: 2000,
    
    // スタンプサムネイルサイズ（ピクセル）
    STAMP_THUMB_SIZE: 128,
    
    // スタンプの最大数
    STAMP_MAX_COUNT: 100
  },

  // ===== UPnP設定 =====
  UPNP: {
    // 公開ポート
    PUBLIC_PORT: require('./app-settings').getPort(),
    
    // プライベートポート
    PRIVATE_PORT: require('./app-settings').getPort(),
    
    // TTL（0 = 永続）
    TTL: 0,
    
    // 説明
    DESCRIPTION: 'OtsumamiCast'
  },

  // ===== WebSocket設定 =====
  WEBSOCKET: {
    // ハートビート間隔（ミリ秒）
    HEARTBEAT_INTERVAL: 30000,
    
    // ハートビートタイムアウト（ミリ秒）
    HEARTBEAT_TIMEOUT: 60000
  },

  // ===== API設定 =====
  API: {
    // YPサーバー（複数対応）
    YP_SERVERS: [
      'http://bayonet.ddo.jp/sp/index.txt',
      'https://p-at.net/index.txt'
    ],
    
    // YP取得タイムアウト（ミリ秒）
    YP_TIMEOUT: 5000
  },

  // ===== 画像処理設定 =====
  IMAGE: {
    // Sharp使用時の品質
    QUALITY: 80,
    
    // サムネイル生成時のアルゴリズム
    THUMBNAIL_FIT: 'cover'
  }
};

module.exports = CONFIG;
