/**
 * OtsumamiCast - Electronメインプロセス
 * 
 * Electronアプリケーションの起動・管理
 */

const { app, dialog } = require('electron');
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

const settings = require('./config/app-settings');
process.env.OTS_USER_DATA = app.getPath('userData');
const savedSettings = settings.readSettings(process.env.OTS_USER_DATA);
process.env.PORT = String(settings.validPort(process.env.PORT) ? Number(process.env.PORT) :
  (settings.validPort(savedSettings.port) ? Number(savedSettings.port) : 7244));

// ウィンドウ管理モジュール
const mainWindow = require('./windows/main-window');
const videoWindow = require('./windows/video-window');
const overlayManager = require('./windows/overlay-manager');

// IPCハンドラー
const { registerIpcHandlers } = require('./ipc/handlers');

let serverStarted = false;
let serverModule;
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
  
  // サーバーの待受開始を待ってから画面を作成する
  serverModule = require(path.join(__dirname, 'server', 'index.js'));
  return serverModule.ready;
}

/**
 * アプリ初期化
 */
app.whenReady().then(async () => {
  console.log('[MAIN] アプリ準備完了');
  console.log('[MAIN] isPackaged:', app.isPackaged);

  try { await startServer(); } catch (error) {
    dialog.showErrorBox('サーバーを起動できません', 'ポート ' + process.env.PORT + ' を使用できません。別のアプリが使用していないか確認してください。\n設定ファイル: ' + path.join(app.getPath('userData'), 'app-settings.json') + '\n' + error.message);
    app.exit(1);
    return;
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
let quitting = false;
app.on('before-quit', (event) => {
  overlayManager.closeOverlay();
  if (quitting || !serverModule) return;
  event.preventDefault();
  quitting = true;
  serverModule.shutdown().catch(console.error).finally(() => app.quit());
});
