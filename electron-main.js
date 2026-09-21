/**
 * OtsumamiCast - Electronメインプロセス
 * 
 * Electronアプリケーションの起動・管理
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');

if (process.platform === 'win32') {
  app.setAppUserModelId('com.otsumamicast.app');
}

// 二重起動防止
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
  return;
}

// ウィンドウ管理モジュール
const mainWindow = require('./windows/main-window');
const videoWindow = require('./windows/video-window');
const overlayManager = require('./windows/overlay-manager');

// IPCハンドラー
const { registerIpcHandlers } = require('./ipc/handlers');

let serverStarted = false;
let mainBrowserWindow;

/**
 * WebSocketサーバーを起動
 */
function startServer() {
  if (serverStarted) {
    console.log('[MAIN] サーバーは既に起動済みです');
    return;
  }
  serverStarted = true;

  // ★★★ 重要: userData パスを環境変数で渡す ★★★
  process.env.OTS_USER_DATA = app.getPath('userData');
  
  console.log('[MAIN] userData パス:', process.env.OTS_USER_DATA);
  console.log('[MAIN] server/index.js を起動します...');
  
  // server/index.js を require（startServerWrapper が自動実行される）
  require(path.join(__dirname, 'server', 'index.js'));
}

/**
 * アプリ初期化
 */
app.whenReady().then(() => {
  console.log('[MAIN] アプリ準備完了');
  console.log('[MAIN] isPackaged:', app.isPackaged);

  // ★ パッケージ版のみサーバーを起動
  if (app.isPackaged) {
    console.log('[MAIN] パッケージ版 → 内蔵サーバーを起動');
    startServer();
  } else {
    console.log('[MAIN] 開発モード → 外部サーバー使用（npm run dev:server）');
  }

  // メインウィンドウ作成
  mainBrowserWindow = mainWindow.createMainWindow();

  // ウィンドウが閉じられたときの処理
  mainBrowserWindow.on('closed', () => {
    overlayManager.closeOverlay();
    mainBrowserWindow = null;

    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
  
  // IPCハンドラーを登録
  registerIpcHandlers(mainWindow, videoWindow, overlayManager);

  // Mac 用の再アクティブ処理
  app.on('activate', () => {
    if (!mainBrowserWindow) {
      mainBrowserWindow = mainWindow.createMainWindow();
    }
  });
});

/**
 * 全ウィンドウが閉じられたとき
 */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

/**
 * アプリ終了前にオーバーレイを閉じる
 */
app.on('before-quit', () => {
  console.log('[MAIN] アプリ終了処理...');
  overlayManager.closeOverlay();
});
