const { contextBridge, shell, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 外部ブラウザで開く
  openExternal: (url) => {
    // TODO(security): 将来的にドメイン制限や確認ダイアログの導入を検討する
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        console.error('[Security] 不正なURLスキーム:', url);
        return Promise.reject(new Error('HTTP/HTTPSのみ許可'));
      }
    } catch (error) {
      console.error('[Security] URLパース失敗:', url);
      return Promise.reject(new Error('無効なURL'));
    }
    return shell.openExternal(url);
  },

  // 動画ウィンドウ関連
  openVideoWindow: (currentVideoData) => {
    ipcRenderer.send('open-video-window', currentVideoData);
  },
  sendVideoCommand: (data) => {
    ipcRenderer.send('video-command', data);
  },
  onSyncVideo: (callback) => {
    ipcRenderer.on('sync-video', (event, data) => callback(data));
  },

  // メインウィンドウ制御
  minimizeWindow: () => {
    ipcRenderer.send('minimize-window');
  },
  maximizeWindow: () => {
    ipcRenderer.send('maximize-window');
  },
  closeWindow: () => {
    ipcRenderer.send('close-window');
  },

  // オーバーレイ制御
  openOverlay: () => {
    ipcRenderer.send('open-overlay');
  },
  closeOverlay: () => {
    ipcRenderer.send('close-overlay');
  },

  // ★スタンプ送信★
  sendStamp: (payload) => {
    ipcRenderer.send('stamp-send', payload);
  },

  // ★ スタンプフォルダを開く
  openStampFolder: async () => {
    return await ipcRenderer.invoke('open-stamp-folder');
  },
  // ★ スタンプ一覧取得（stamps フォルダの .png/.gif/.webp）
  listStamps: async () => {
    return await ipcRenderer.invoke('list-stamps');
  },
  // ★ ローカルスタンプ追加
  addStamp: async (filePath) => {
    return await ipcRenderer.invoke('add-stamp', filePath);
  },
  // ★ 追加: スタンプスケールの設定
  setStampScale: (value) => {
    ipcRenderer.send('stamp-scale', value);
  },
  
  // ★ オーバーレイに設定を送信
  sendToOverlay: (channel, data) => {
    ipcRenderer.send(channel, data);
  },
  
  // 汎用フラグ送信用（テーマなど）
  featureToggled: (feature, value) => {
    ipcRenderer.send('feature-toggled', feature, value);
  }
});
