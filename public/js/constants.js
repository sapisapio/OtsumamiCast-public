// ===== 定数定義 =====

export const CONFIG = {
  WS_PORT: 7244,
  FIXED_ROOM_ID: 'main',
  DEFAULT_OFFSET: 0,
  MAX_OFFSET: 10,
  SYNC_INTERVAL: 1000
};

export const PLAYER_STATES = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5
};

export const URLS = {
  YP_API: '/api/yp',
  UPNP_OPEN: '/api/upnp/open',
  UPNP_CLOSE: '/api/upnp/close',
  PORT_CHECK: 'https://www.akakagemaru.info/port/tcpport.php',
  LOCAL_SERVER: window.location.origin
};

export const MESSAGES = {
  HOSTING_SWITCH_CONFIRM: 'ホスト中です。切り替えるとホストが解除されます。よろしいですか？',
  CLIPBOARD_INVALID: 'クリップボードに有効なYouTube URLがありません',
  CLIPBOARD_ERROR: 'クリップボードの読み取りに失敗しました',
  IP_REQUIRED: 'IPアドレスを入力してください',
  URL_ERROR: 'URLが取得できませんでした',
  NOT_YOUTUBE_URL: 'YouTube URLではありません',
  ELECTRON_ONLY: 'Electron環境でのみ動作します'
};
