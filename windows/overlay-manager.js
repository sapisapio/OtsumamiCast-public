const { BrowserWindow, screen } = require('electron');
const path = require('path');

let indicatorWindow = null;
let overlayWindow = null;
const OVERLAY_BASE_URL = 'http://localhost:7244';

function reinforceTopMost(targetWindow) {
  if (!targetWindow || targetWindow.isDestroyed()) return;
  try {
    // 他ソフトとの競合で背面に回るケースを減らす
    targetWindow.setAlwaysOnTop(true, 'screen-saver');
    targetWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    targetWindow.moveTop();
  } catch (error) {
    console.warn('[OVERLAY] 最前面の強制に失敗。通常設定で再試行します', error);
    targetWindow.setAlwaysOnTop(true);
  }
}

function loadWithRetry(targetWindow, url, fallbackPath, { retries = 5, delay = 1000 } = {}) {
  const attemptLoad = (remaining) => {
    targetWindow.loadURL(url).catch((error) => {
      console.warn('[OVERLAY] loadURL 失敗', error);
      if (remaining > 0) {
        setTimeout(() => attemptLoad(remaining - 1), delay);
        return;
      }
      if (fallbackPath) {
        targetWindow.loadFile(fallbackPath).catch((fallbackError) => {
          console.error('[OVERLAY] fallback loadFile 失敗', fallbackError);
        });
      }
    });
  };

  attemptLoad(retries);
}

// ★ 最後に選ばれたテーマを覚えておく
let currentTheme = null;

/**
 * インジケーターウィンドウを作成
 */
function createIndicatorWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth } = primaryDisplay.workAreaSize;
  
  indicatorWindow = new BrowserWindow({
    x: screenWidth - 250 - 20,  // 右端から250px+20px
    y: 20,
    width: 250,
    height: 30,
    title: '通知バー',
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '..', 'preload-overlay.js')
    }
  });

  loadWithRetry(
    indicatorWindow,
    `${OVERLAY_BASE_URL}/indicator.html`,
    path.join(__dirname, '..', 'public', 'indicator.html')
  );
  reinforceTopMost(indicatorWindow);
  indicatorWindow.setIgnoreMouseEvents(false);

  // ★ 読み込み完了時に、覚えているテーマを一度だけ送る
  indicatorWindow.webContents.on('did-finish-load', () => {
    if (currentTheme) {
      indicatorWindow.webContents.send('feature-toggled', 'theme', currentTheme);
    }
  });
  
  indicatorWindow.on('closed', () => {
    if (overlayWindow) {
      overlayWindow.close();
    }
    indicatorWindow = null;
  });

  ['show', 'focus', 'blur', 'restore'].forEach((eventName) => {
    indicatorWindow.on(eventName, () => reinforceTopMost(indicatorWindow));
  });
  
  // インジケーターをドラッグ → オーバーレイも追従（右端を揃える）
  indicatorWindow.on('move', () => {
    if (overlayWindow) {
      const [x, y] = indicatorWindow.getPosition();
      const [overlayWidth] = overlayWindow.getSize();
      const [indWidth, indHeight] = indicatorWindow.getSize();
      
      // オーバーレイの右端 = インジケーターの右端
      // 縦方向は「インジケーターのすぐ下」から 2px だけ詰める
      overlayWindow.setPosition(
        x + indWidth - overlayWidth,
        y + indHeight - 2
      );
    }
  });
}

/**
 * オーバーレイウィンドウを作成
 */
function createOverlayWindow() {
  const [indX, indY] = indicatorWindow.getPosition();
  const [indWidth, indHeight] = indicatorWindow.getSize();
  
  overlayWindow = new BrowserWindow({
    x: indX + indWidth - 600,  // 右端を揃える（左に出っ張る）
    y: indY + indHeight - 2,   // ★ ここも高さ基準で 2px 詰め
    width: 600,
    height: 400,
    title: '表示部',
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '..', 'preload-overlay.js')
    }
  });

  loadWithRetry(
    overlayWindow,
    `${OVERLAY_BASE_URL}/overlay.html`,
    path.join(__dirname, '..', 'public', 'overlay.html')
  );
  reinforceTopMost(overlayWindow);
  overlayWindow.setIgnoreMouseEvents(false);

  // DevToolsの自動表示は無効化

  // ★ こっちも読み込み完了時にテーマを送る
  overlayWindow.webContents.on('did-finish-load', () => {
    console.log('[OVERLAY] overlay.html 読み込み完了');
    if (currentTheme) {
      overlayWindow.webContents.send('feature-toggled', 'theme', currentTheme);
    }
  });

  overlayWindow.on('closed', () => {
    overlayWindow = null;
  });

  ['show', 'focus', 'blur', 'restore'].forEach((eventName) => {
    overlayWindow.on(eventName, () => reinforceTopMost(overlayWindow));
  });
}

/**
 * オーバーレイをリサイズ（右端固定、左端を動かす）
 */
function resizeOverlay(width, height) {
  if (overlayWindow && indicatorWindow) {
    const [indX, indY] = indicatorWindow.getPosition();
    const [indWidth, indHeight] = indicatorWindow.getSize();
    
    // 右端 = インジケーターの右端
    const rightEdge = indX + indWidth;
    
    // オーバーレイをリサイズ（右端固定、左に伸びる）
    overlayWindow.setBounds({
      x: rightEdge - Math.round(width),
      y: indY + indHeight - 2,          // ★ ここも 2px 詰め
      width: Math.round(width),
      height: Math.round(height)
    });
  }
}

/**
 * インジケーターをリサイズ（右端固定）
 */
function resizeIndicator(width, height) {
  if (!indicatorWindow) return;
  const [x, y] = indicatorWindow.getPosition();
  const [currentWidth] = indicatorWindow.getSize();
  const rightEdge = x + currentWidth;
  const nextWidth = Math.max(Math.round(width), 140);
  const nextHeight = Math.max(Math.round(height), 24);
  indicatorWindow.setBounds({
    x: rightEdge - nextWidth,
    y,
    width: nextWidth,
    height: nextHeight
  });

  if (overlayWindow) {
    const [overlayWidth] = overlayWindow.getSize();
    overlayWindow.setPosition(rightEdge - overlayWidth, y + nextHeight - 2);
  }
}

/**
 * オーバーレイ・インジケーターにメッセージ送信
 */
function sendToOverlay(channel, ...args) {
  // ★ テーマイベントのときは現在値を保存
  if (channel === 'feature-toggled') {
    const [feature, value] = args;
    if (feature === 'theme') {
      currentTheme = value;
    }
  }

  console.log(`[OVERLAY] メッセージ送信: ${channel}`, args);

  if (indicatorWindow && !indicatorWindow.isDestroyed()) {
    indicatorWindow.webContents.send(channel, ...args);
  }
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send(channel, ...args);
  }
}

/**
 * クリックを透過/非透過にする
 */
function setClickThrough(enabled) {
  if (overlayWindow) {
    overlayWindow.setIgnoreMouseEvents(enabled, { forward: true });
  }
}

/**
 * オーバーレイを開く
 */
function openOverlay() {
  if (!indicatorWindow) {
    createIndicatorWindow();
    createOverlayWindow();
  } else if (!overlayWindow) {
    createOverlayWindow();
  }

  reinforceTopMost(indicatorWindow);
  reinforceTopMost(overlayWindow);
}

/**
 * オーバーレイを閉じる
 */
function closeOverlay() {
  if (overlayWindow) {
    overlayWindow.close();
    overlayWindow = null;
  }
  if (indicatorWindow) {
    indicatorWindow.close();
    indicatorWindow = null;
  }
}

module.exports = {
  openOverlay,
  closeOverlay,
  setClickThrough,
  resizeOverlay,
  resizeIndicator,
  sendToOverlay
};
