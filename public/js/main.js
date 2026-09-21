// ===== グローバル状態管理（リファクタリング版） =====

import { CONFIG } from './constants.js';
import { parseVideoId, logStatus } from './utils.js';

// ===== 状態管理 =====
export const state = {
  ws: null,
  role: "viewer",
  FIXED_ROOM_ID: CONFIG.FIXED_ROOM_ID,
  player: null,
  viewerOffsetSec: CONFIG.DEFAULT_OFFSET,
  lastSyncPayload: null,
  syncInterval: null,
  hosting: false,
  // ★ キュー関連
  queueEnabled: false,
  videoQueue: []
};

// ===== エクスポート（後方互換性のため） =====
export { parseVideoId, logStatus };

// ===== グローバルアクセス用（compact.js などで使用） =====
window.state = state;
window.parseVideoId = parseVideoId;
window.logStatus = logStatus;

console.log('[Main] State manager initialized');
