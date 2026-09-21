const { app, BrowserWindow } = require('electron');
const path = require('path');

let videoWindow = null;
const VIDEO_URL = 'http://localhost:7244/video.html';
const VIDEO_FALLBACK = path.join(__dirname, '..', 'public', 'video.html');

function loadWithRetry(targetWindow, url, fallbackPath, { retries = 5, delay = 1000 } = {}) {
  const attemptLoad = (remaining) => {
    targetWindow.loadURL(url).catch((error) => {
      console.warn('[VIDEO] loadURL 失敗', error);
      if (remaining > 0) {
        setTimeout(() => attemptLoad(remaining - 1), delay);
        return;
      }
      if (fallbackPath) {
        targetWindow.loadFile(fallbackPath).catch((fallbackError) => {
          console.error('[VIDEO] fallback loadFile 失敗', fallbackError);
        });
      }
    });
  };

  attemptLoad(retries);
}

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
  
  loadWithRetry(videoWindow, VIDEO_URL, VIDEO_FALLBACK);
  
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
