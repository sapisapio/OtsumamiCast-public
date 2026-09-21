const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // インジケーター用
  setupModeChanged: (mode) => ipcRenderer.send('setup-mode-changed', mode),
  featureToggled: (feature, enabled) => ipcRenderer.send('feature-toggled', feature, enabled),
  
  // オーバーレイ用
  onSetupModeChanged: (callback) => ipcRenderer.on('setup-mode-changed', (event, mode) => callback(mode)),
  onFeatureToggled: (callback) => ipcRenderer.on('feature-toggled', (event, feature, enabled) => callback(feature, enabled)),

 // ★ スタンプ受信
  onStamp: (callback) =>
    ipcRenderer.on('stamp-receive', (event, payload) => callback(payload)),
  // ★ 追加：スタンプサイズ変更イベント
  onStampScale: (callback) =>
    ipcRenderer.on('stamp-scale', (event, payload) => callback(payload)),  
    // ★ 音量設定受信
  onVideoVolume: (callback) =>
    ipcRenderer.on('video-volume', (event, payload) => callback(payload)),
  
  // ★ 表示時間設定受信
  onStampDuration: (callback) =>
    ipcRenderer.on('stamp-duration', (event, payload) => callback(payload)),
  
  // ★ 着信音設定受信
  onStampSound: (callback) =>
    ipcRenderer.on('stamp-sound', (event, payload) => callback(payload)),

  // ★ おひねり通知受信
  onOhinerimakiBell: (callback) =>
    ipcRenderer.on('ohinerimaki-bell', (event, payload) => callback(payload)),
  onOhinerimakiDeleted: (callback) =>
    ipcRenderer.on('ohinerimaki-deleted', (event, payload) => callback(payload)),
  onOhinerimakiVolume: (callback) =>
    ipcRenderer.on('ohinerimaki-volume', (event, payload) => callback(payload)),

  onVcastConfig: (callback) =>
    ipcRenderer.on('vcast-config', (event, payload) => callback(payload)),
  onVcastReaction: (callback) =>
    ipcRenderer.on('vcast-reaction', (event, payload) => callback(payload)),
  onVcastState: (callback) =>
    ipcRenderer.on('vcast-state', (event, payload) => callback(payload)),
  
  // 共通
  setClickThrough: (enabled) => ipcRenderer.send('overlay-click-through', enabled),
  resizeOverlay: (width, height) => ipcRenderer.send('overlay-resize', width, height),
  resizeIndicator: (width, height) => ipcRenderer.send('indicator-resize', width, height)
});
