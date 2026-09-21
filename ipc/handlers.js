const { ipcMain, app, shell } = require('electron');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

// ★ 開発時のスタンプフォルダは public/stamps に統一
const stampDir = path.join(app.getAppPath(), 'public', 'stamps');
/**
 * IPCハンドラーを登録
 */
function registerIpcHandlers(mainWindow, videoWindow, overlayManager) {
  // ===== メインウィンドウ制御 =====
  
  ipcMain.on('minimize-window', () => {
    mainWindow.minimizeWindow();
  });
  
  ipcMain.on('maximize-window', () => {
    mainWindow.toggleMaximizeWindow();
  });
  
  ipcMain.on('close-window', () => {
    mainWindow.closeWindow();
  });
  
  // ===== 動画ウィンドウ =====
  
  ipcMain.on('open-video-window', (event, currentVideoData) => {
    const vw = videoWindow.createVideoWindow();
    
    if (vw) {
      vw.webContents.once('did-finish-load', () => {
        if (currentVideoData && currentVideoData.videoId) {
          setTimeout(() => {
            videoWindow.sendToVideoWindow(currentVideoData);
          }, 500);
        }
      });
    }
  });
  
  ipcMain.on('video-command', (event, data) => {
    videoWindow.sendToVideoWindow(data);
  });
  
  // ===== オーバーレイ =====
  
  ipcMain.on('open-overlay', () => {
    overlayManager.openOverlay();
  });
  
  ipcMain.on('close-overlay', () => {
    overlayManager.closeOverlay();
  });
  
  ipcMain.on('overlay-click-through', (event, enabled) => {
    overlayManager.setClickThrough(enabled);
  });
  
  ipcMain.on('overlay-resize', (event, width, height) => {
    overlayManager.resizeOverlay(width, height);
  });

  ipcMain.on('indicator-resize', (event, width, height) => {
    overlayManager.resizeIndicator(width, height);
  });
  
  ipcMain.on('setup-mode-changed', (event, setupMode) => {
    overlayManager.sendToOverlay('setup-mode-changed', setupMode);
  });
  
  ipcMain.on('feature-toggled', (event, feature, enabled) => {
    overlayManager.sendToOverlay('feature-toggled', feature, enabled);
  });
  // ★ スタンプ転送
  ipcMain.on('stamp-send', (event, payload) => {
    overlayManager.sendToOverlay('stamp-receive', payload);
  });
  // スタンプサイズ変更（メインウインドウ → オーバーレイ）
  ipcMain.on('stamp-scale', (event, value) => {
    const num = Number(value);
    if (!Number.isFinite(num) || num <= 0) return;

    overlayManager.sendToOverlay('stamp-scale', {
      scale: num
    });
  });

   // ★ 音量設定をオーバーレイに送信
  ipcMain.on('send-video-volume', (event, payload) => {
    overlayManager.sendToOverlay('video-volume', payload);
  });
  
  // ★ 表示時間設定をオーバーレイに送信
  ipcMain.on('send-stamp-duration', (event, payload) => {
    overlayManager.sendToOverlay('stamp-duration', payload);
  });
  
  // ★ 着信音設定をオーバーレイに送信
  ipcMain.on('send-stamp-sound', (event, payload) => {
    overlayManager.sendToOverlay('stamp-sound', payload);
  });

  // ★ おひねり通知をオーバーレイに送信
  ipcMain.on('ohinerimaki-bell', (event, payload) => {
    overlayManager.sendToOverlay('ohinerimaki-bell', payload);
  });

  ipcMain.on('ohinerimaki-deleted', (event, payload) => {
    overlayManager.sendToOverlay('ohinerimaki-deleted', payload);
  });

  ipcMain.on('ohinerimaki-volume', (event, payload) => {
    overlayManager.sendToOverlay('ohinerimaki-volume', payload);
  });

  ipcMain.on('vcast-config', (event, payload) => {
    overlayManager.sendToOverlay('vcast-config', payload);
  });

  ipcMain.on('vcast-reaction', (event, payload) => {
    overlayManager.sendToOverlay('vcast-reaction', payload);
  });

  ipcMain.on('vcast-state', (event, payload) => {
    overlayManager.sendToOverlay('vcast-state', payload);
  });

  
  // ===== スタンプフォルダ =====
  ipcMain.handle('open-stamp-folder', async () => {
    try {
      // フォルダが無ければ作成
      if (!fs.existsSync(stampDir)) {
        fs.mkdirSync(stampDir, { recursive: true });
      }
      // エクスプローラで開く
      await shell.openPath(stampDir);
      // レンダラ側でパスが欲しくなった時用に返しておく
      return { success: true, path: stampDir };
    } catch (e) {
      console.error('[IPC] open-stamp-folder error:', e);
      return { success: false, error: String(e) };
    }
  });

// ★ スタンプ一覧取得（.png/.gif/.webp）
  ipcMain.handle('list-stamps', async () => {
    try {
      if (!fs.existsSync(stampDir)) {
        fs.mkdirSync(stampDir, { recursive: true });
      }

      const files = await fs.promises.readdir(stampDir);
const exts = ['.png', '.gif', '.webp', '.jpg', '.jpeg', '.apng', '.webm', '.mp4'];

      const stampFiles = files.filter((name) => {
        const ext = path.extname(name).toLowerCase();
        return exts.includes(ext);
      });

      return { success: true, files: stampFiles };
    } catch (e) {
      console.error('[IPC] list-stamps error:', e);
      return { success: false, error: String(e), files: [] };
    }
  });
}

module.exports = { registerIpcHandlers };
