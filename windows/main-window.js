const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

let mainWindow = null;

const MAIN_FALLBACK = path.join(__dirname, '..', 'public', 'index.html');

const loadWithRetry = require('./load-window');
const { getLocalOrigin } = require('../config/app-settings');

/**
 * メインウィンドウを作成
 */
function createMainWindow() {
  Menu.setApplicationMenu(null);

  const iconPath = process.platform === 'win32'
    ? path.join(app.getAppPath(), 'public', 'icon.ico')
    : undefined;
  
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    frame: false, // ★ タイトルバーなし（Discord風）
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    title: 'おつまみキャスト',
    backgroundColor: '#f0f0f0'
  });

  loadWithRetry(mainWindow, getLocalOrigin(), MAIN_FALLBACK);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  
  // DevToolsの自動表示は無効化
  
  return mainWindow;
}

/**
 * ウィンドウを最小化
 */
function minimizeWindow() {
  if (mainWindow) mainWindow.minimize();
}

/**
 * ウィンドウを最大化/復元
 */
function toggleMaximizeWindow() {
  if (mainWindow) {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  }
}

/**
 * ウィンドウを閉じる
 */
function closeWindow() {
  if (mainWindow) mainWindow.close();
}

/**
 * メインウィンドウを取得
 */
function getMainWindow() {
  return mainWindow;
}

module.exports = {
  createMainWindow,
  minimizeWindow,
  toggleMaximizeWindow,
  closeWindow,
  getMainWindow
};
