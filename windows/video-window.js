const { app, BrowserWindow } = require('electron');
const path = require('path');

let videoWindow = null;

const VIDEO_FALLBACK = path.join(__dirname, '..', 'public', 'video.html');

const loadWithRetry = require('./load-window');
const { getLocalOrigin } = require('../config/app-settings');

/**
 * 動画ウィンドウを作成
 */
function createVideoWindow() {
  if (videoWindow) {
    videoWindow.focus();
    return videoWindow;
  }

  const iconPath = process.platform === 'win32'
    ? path.join(app.getAppPath(), 'public', 'icon.ico')
    : undefined;
  
  videoWindow = new BrowserWindow({
    width: 800,
    height: 600,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    title: '動画ウィンドウ'
  });
  
  loadWithRetry(videoWindow, `${getLocalOrigin()}/video.html`, VIDEO_FALLBACK);
  
  videoWindow.on('closed', () => {
    videoWindow = null;
  });
  
  return videoWindow;
}

/**
 * 動画ウィンドウにメッセージを送信
 */
function sendToVideoWindow(message) {
  if (videoWindow && !videoWindow.isDestroyed()) {
    videoWindow.webContents.send('sync-video', message);
  }
}

/**
 * 動画ウィンドウを取得
 */
function getVideoWindow() {
  return videoWindow;
}

module.exports = {
  createVideoWindow,
  sendToVideoWindow,
  getVideoWindow
};
