// js/tabs/vcast-tab-init.js
// Vcastタブ専用の初期化処理

const vcastTierClasses = [
  'vcast-level-tier-0',
  'vcast-level-tier-1',
  'vcast-level-tier-2',
  'vcast-level-tier-3',
  'vcast-level-tier-4',
  'vcast-level-tier-5',
  'vcast-level-tier-6'
];

function microphoneConstraints(deviceId) {
  return {
    ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    autoGainControl: false,
    echoCancellation: false,
    noiseSuppression: false
  };
}

/**
 * Vcastタブの初期化
 */
export async function initVcastTab() {
  console.log('[VcastTab] 初期化開始');
  
  // 設定を読み込み
  await Promise.all([
    loadVcastConfig(),
    loadVcastState()
  ]);
  
  // スライダーイベントの設定
  initSliders();
  
  // ボタンイベントの設定
  initButtons();
  initReactions();
  
  // ホスト専用UI表示制御
  updateHostOnlyUI();
  window.addEventListener('otsumamiRoleChanged', updateHostOnlyUI);
  window.addEventListener('otsumamiTabChanged', handleVcastTabChanged);
  window.addEventListener('pagehide', stopMicPreview);
  
  console.log('[VcastTab] 初期化完了');
}

let vcastLatestState = {};

/**
 * Vcast設定を読み込む
 */
async function loadVcastConfig() {
  try {
    const response = await fetch('/api/vcast-config');
    const data = await response.json();
    if (data?.config) {
      applyConfigToUI(data.config);
      if (
        window.state?.role === 'host' &&
        window.electronAPI?.sendToOverlay
      ) {
        window.electronAPI.sendToOverlay('vcast-config', data.config);
      }
    }
    console.log('[VcastTab] 設定を読み込みました');
  } catch (error) {
    console.error('[VcastTab] 設定読み込み失敗:', error);
  }
}

async function loadVcastState() {
  try {
    const response = await fetch('/api/vcast-state');
    const data = await response.json();
    if (data?.state) {
      applyStateToUI(data.state);
    }
  } catch (error) {
    console.error('[VcastTab] 状態読み込み失敗:', error);
  }
}

function applyConfigToUI(config) {
  const animSelect = document.getElementById('vcastIdleAnimation');
  const animSpeed = document.getElementById('vcastAnimationSpeed');
  const idleIntensity = document.getElementById('vcastIdleIntensity');
  const voiceReaction = document.getElementById('vcastVoiceReaction');
  const voiceSensitivity = document.getElementById('vcastVoiceSensitivity');
  const voiceThreshold = document.getElementById('vcastVoiceThreshold');
  const micIntensity = document.getElementById('vcastMicIntensity');
  const micAnimation = document.getElementById('vcastMicAnimation');
  const micDevice = document.getElementById('vcastMicDevice');
  const size = document.getElementById('vcastSize');
  const position = document.getElementById('vcastPosition');
  const enabled = document.getElementById('vcastEnabled');

  const idleAnimation = config.idleAnimation || config.animation || 'none';
  if (animSelect) animSelect.value = idleAnimation;
  if (animSpeed) animSpeed.value = config.animationSpeed ?? 1.0;
  if (idleIntensity) idleIntensity.value = config.idleIntensity ?? 100;
  if (voiceReaction) voiceReaction.checked = !!config.voiceReaction;
  if (voiceSensitivity) voiceSensitivity.value = config.voiceSensitivity ?? 50;
  if (voiceThreshold) voiceThreshold.value = config.voiceThreshold ?? 50;
  if (micIntensity) micIntensity.value = config.micIntensity ?? 100;
  if (micAnimation) micAnimation.value = config.micAnimation || 'none';
  if (size) size.value = config.size ?? 150;
  if (position) position.value = config.position || 'bottom-right';
  if (enabled) enabled.checked = config.enabled !== false;

  const fileInput = document.getElementById('vcastAvatarFile');
  if (fileInput && config.avatarImage) {
    fileInput.dataset.imageData = config.avatarImage;
    const preview = document.getElementById('vcastPreview');
    if (preview) {
      const sizeValue = config.size ?? 150;
      preview.innerHTML = '';
      const avatarImage = config.avatarImage;
      if (!isAllowedImageSrc(avatarImage)) {
        console.warn('[VcastTab] 不正な画像スキーム');
        return;
      }
      const img = document.createElement('img');
      img.src = avatarImage;
      img.style.maxWidth = `${sizeValue}px`;
      img.style.maxHeight = `${sizeValue}px`;
      img.style.objectFit = 'contain';
      preview.appendChild(img);
    }
  }

  if (animSpeed) {
    document.getElementById('vcastAnimationSpeedValue').textContent = animSpeed.value;
  }
  if (idleIntensity) {
    document.getElementById('vcastIdleIntensityValue').textContent = idleIntensity.value;
  }
  if (voiceSensitivity) {
    document.getElementById('vcastVoiceSensitivityValue').textContent = voiceSensitivity.value;
  }
  if (voiceThreshold) {
    document.getElementById('vcastVoiceThresholdValue').textContent = voiceThreshold.value;
  }
  if (micIntensity) {
    document.getElementById('vcastMicIntensityValue').textContent = micIntensity.value;
  }
  if (size) {
    document.getElementById('vcastSizeValue').textContent = size.value;
    updatePreviewSize(size.value);
  }

  if (micDevice && config.micDeviceId) {
    micDevice.dataset.preferred = config.micDeviceId;
    micDevice.value = config.micDeviceId;
  }
}

function isAllowedImageSrc(value) {
  if (!value || typeof value !== 'string') return false;
  if (value.startsWith('data:image/')) return true;
  try {
    const parsed = new URL(value, window.location.origin);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch (error) {
    return false;
  }
}

function applyStateToUI(state) {
  const personality = document.getElementById('vcastPersonality');
  const mood = document.getElementById('vcastMood');
  const level = document.getElementById('vcastLevel');
  const points = document.getElementById('vcastPoints');
  const personalityFrame = document.querySelector('.vcast-personality-frame');

  const totalPoints = state.totalPoints ?? null;
  const computedLevel = computeVcastLevel(totalPoints);
  const levelLabel = computedLevel === null ? '--' : computedLevel >= 99 ? 'MAX' : computedLevel;

  if (personality) personality.textContent = state.personality || '--';
  if (mood) mood.textContent = `気分: ${formatMood(state.mood)}`;
  if (level) level.textContent = `レベル: ${levelLabel}`;
  if (points) points.textContent = `ポイント: ${totalPoints ?? '--'}`;
  setVcastLevelTierClass(personalityFrame, computedLevel);
}

function formatMood(mood) {
  switch (mood) {
    case 'good':
      return '😊';
    case 'bad':
      return '😡';
    default:
      return '😐';
  }
}

function computeVcastLevel(totalPoints) {
  if (totalPoints === null || totalPoints === undefined) return null;
  const points = Math.max(0, totalPoints);
  const rawLevel = Math.floor((1 + Math.sqrt(1 + (4 * points) / 5)) / 2);
  return Math.max(1, rawLevel);
}

function setVcastLevelTierClass(target, level) {
  if (!target) return;
  vcastTierClasses.forEach((className) => target.classList.remove(className));
  if (level === null || level === undefined) return;
  const tier = Math.min(6, Math.floor(level / 10));
  target.classList.add(`vcast-level-tier-${tier}`);
}
/**
 * スライダーイベントの初期化
 */
function initSliders() {
  // アニメーション速度スライダー
  const animSpeedSlider = document.getElementById('vcastAnimationSpeed');
  if (animSpeedSlider) {
    animSpeedSlider.addEventListener('input', (e) => {
      const value = parseFloat(e.target.value).toFixed(1);
      document.getElementById('vcastAnimationSpeedValue').textContent = value;
    });
  }

  const idleIntensitySlider = document.getElementById('vcastIdleIntensity');
  if (idleIntensitySlider) {
    idleIntensitySlider.addEventListener('input', (e) => {
      document.getElementById('vcastIdleIntensityValue').textContent = e.target.value;
    });
  }
  
  // 音声感度スライダー
  const voiceSensSlider = document.getElementById('vcastVoiceSensitivity');
  if (voiceSensSlider) {
    voiceSensSlider.addEventListener('input', (e) => {
      const value = e.target.value;
      document.getElementById('vcastVoiceSensitivityValue').textContent = value;
    });
  }

  const voiceThreshold = document.getElementById('vcastVoiceThreshold');
  if (voiceThreshold) {
    voiceThreshold.addEventListener('input', (e) => {
      document.getElementById('vcastVoiceThresholdValue').textContent = e.target.value;
    });
  }

  const micIntensity = document.getElementById('vcastMicIntensity');
  if (micIntensity) {
    micIntensity.addEventListener('input', (e) => {
      document.getElementById('vcastMicIntensityValue').textContent = e.target.value;
    });
  }
  
  // サイズスライダー
  const sizeSlider = document.getElementById('vcastSize');
  if (sizeSlider) {
    sizeSlider.addEventListener('input', (e) => {
      const value = e.target.value;
      document.getElementById('vcastSizeValue').textContent = value;
      updatePreviewSize(value);
    });
  }
}

/**
 * ボタンイベントの初期化
 */
function initButtons() {
  // 画像選択
  const fileInput = document.getElementById('vcastAvatarFile');
  if (fileInput && !fileInput.dataset.initialized) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        handleAvatarUpload(file);
      }
    });
    fileInput.dataset.initialized = 'true';
  }
  
  // 保存ボタン
  const saveBtn = document.getElementById('saveVcastBtn');
  if (saveBtn && !saveBtn.dataset.initialized) {
    saveBtn.addEventListener('click', () => {
      saveVcastConfig();
    });
    saveBtn.dataset.initialized = 'true';
  }
}

function initReactions() {
  const reactions = [
    { id: 'vcastActionStroke', action: 'stroke', label: 'なでる', icon: '🫳' },
    { id: 'vcastActionMassage', action: 'massage', label: 'もむ', icon: '🤲' },
    { id: 'vcastActionRub', action: 'rub', label: 'こする', icon: '🖐️' },
    { id: 'vcastActionLick', action: 'lick', label: 'なめる', icon: '👅' },
    { id: 'vcastHostActionStroke', action: 'stroke', label: 'なでる', icon: '🫳' },
    { id: 'vcastHostActionMassage', action: 'massage', label: 'もむ', icon: '🤲' },
    { id: 'vcastHostActionRub', action: 'rub', label: 'こする', icon: '🖐️' },
    { id: 'vcastHostActionLick', action: 'lick', label: 'なめる', icon: '👅' }
  ];

  reactions.forEach((item) => {
    const button = document.getElementById(item.id);
    if (!button || button.dataset.initialized) return;
    button.addEventListener('click', () => sendReaction(item.action, item.label, item.icon));
    button.dataset.initialized = 'true';
  });
}

function sendReaction(action, label, icon) {
  if (window.otsumamiWs && window.otsumamiWs.readyState === WebSocket.OPEN) {
    window.otsumamiWs.send(JSON.stringify({
      type: 'vcast-reaction',
      action
    }));
    showToastMessage(`${icon} ${label} を送信しました`);
    return;
  }

  const role = window.state?.role || window.otsumamiRole || 'viewer';
  if (role === 'host') {
    performLocalReaction(action, label, icon);
    return;
  }

  showToastMessage('接続されていません');
}

function performLocalReaction(action, label, icon) {
  const points = 1;
  const totalPoints = (vcastLatestState.totalPoints ?? 0) + points;
  const detail = {
    action,
    points,
    totalPoints,
    mood: vcastLatestState.mood ?? null,
    personality: vcastLatestState.personality ?? null
  };

  vcastLatestState = {
    ...vcastLatestState,
    ...detail
  };

  window.dispatchEvent(new CustomEvent('vcastStateUpdated', { detail }));

  if (window.electronAPI && typeof window.electronAPI.sendToOverlay === 'function') {
    window.electronAPI.sendToOverlay('vcast-reaction', detail);
  }

  showToastMessage(`${icon} ${label} をローカル実行しました`);
}

/**
 * アバター画像アップロード処理
 */
function handleAvatarUpload(file) {
  console.log('[VcastTab] アバター画像選択:', file.name);

  const maxBytes = 100 * 1024 * 1024;
  if (file.size > maxBytes) {
    const sizeMB = (file.size / 1024 / 1024).toFixed(2);
    const message = `ファイルサイズが ${sizeMB}MB です。100MB以下の画像を選択してください。`;
    if (window.showToast) {
      window.showToast(message, 'error');
    } else {
      alert(message);
    }
    return;
  }
  
  // プレビュー表示
  const reader = new FileReader();
  reader.onload = (e) => {
    const preview = document.getElementById('vcastPreview');
    const size = document.getElementById('vcastSize').value;

    const fileInput = document.getElementById('vcastAvatarFile');
    if (fileInput) {
      fileInput.dataset.imageData = e.target.result;
    }

    preview.innerHTML = '';
    const avatarImage = e.target.result;
    if (!isAllowedImageSrc(avatarImage)) {
      console.warn('[VcastTab] 不正な画像スキーム');
      return;
    }
    const img = document.createElement('img');
    img.src = avatarImage;
    img.style.maxWidth = `${size}px`;
    img.style.maxHeight = `${size}px`;
    img.style.objectFit = 'contain';
    preview.appendChild(img);
  };
  reader.readAsDataURL(file);
}

/**
 * プレビューサイズ更新
 */
function updatePreviewSize(size) {
  const preview = document.getElementById('vcastPreview');
  const img = preview.querySelector('img');
  if (img) {
    img.style.maxWidth = `${size}px`;
    img.style.maxHeight = `${size}px`;
  }
}

/**
 * Vcast設定を保存
 */
async function saveVcastConfig() {
  const config = {
    avatarImage: document.getElementById('vcastAvatarFile')?.dataset?.imageData || '',
    animation: document.getElementById('vcastIdleAnimation').value,
    idleAnimation: document.getElementById('vcastIdleAnimation').value,
    animationSpeed: parseFloat(document.getElementById('vcastAnimationSpeed').value),
    idleIntensity: parseInt(document.getElementById('vcastIdleIntensity').value),
    voiceReaction: document.getElementById('vcastVoiceReaction').checked,
    voiceSensitivity: parseInt(document.getElementById('vcastVoiceSensitivity').value),
    voiceThreshold: parseInt(document.getElementById('vcastVoiceThreshold').value),
    micIntensity: parseInt(document.getElementById('vcastMicIntensity').value),
    micAnimation: document.getElementById('vcastMicAnimation').value,
    micDeviceId: document.getElementById('vcastMicDevice').value || 'default',
    size: parseInt(document.getElementById('vcastSize').value),
    position: document.getElementById('vcastPosition').value,
    enabled: document.getElementById('vcastEnabled').checked
  };
  
  try {
    const response = await fetch('/api/vcast-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || '保存に失敗しました');
    }

    const updatedConfig = data.config || config;
    const fileInput = document.getElementById('vcastAvatarFile');
    if (fileInput) {
      fileInput.dataset.imageData = updatedConfig.avatarImage || '';
    }
    
    if (window.showToast) {
      window.showToast('設定を保存しました', 'success');
    } else {
      alert('設定を保存しました');
    }
    
    if (window.electronAPI && window.electronAPI.sendToOverlay) {
      window.electronAPI.sendToOverlay('vcast-config', updatedConfig);
    }
  } catch (error) {
    console.error('[VcastTab] 保存失敗:', error);
    if (window.showToast) {
      window.showToast('保存に失敗しました', 'error');
    } else {
      alert('保存に失敗しました');
    }
  }
}

/**
 * ホスト専用UI表示制御
 */
function updateHostOnlyUI() {
  const role = window.state?.role || window.otsumamiRole || 'viewer';
  const hostSettings = document.getElementById('vcastHostSettings');
  const reactionSection = document.getElementById('vcastReactionSection');
  
  if (hostSettings) {
    hostSettings.style.display = role === 'host' ? '' : 'none';
  }
  if (reactionSection) {
    reactionSection.style.display = role === 'host' ? 'none' : '';
  }
  
  console.log('[VcastTab] ロール表示更新:', role);
}

function showToastMessage(message) {
  const toast = document.getElementById('vcastReactionToast');
  if (toast) {
    toast.textContent = message;
    return;
  }
  if (window.showToast) {
    window.showToast(message, 'info');
  }
}

if (!window.vcastHandlersInitialized) {
  window.vcastHandlersInitialized = true;
  window.addEventListener('vcastStateUpdated', (event) => {
    if (event?.detail) {
      vcastLatestState = {
        ...vcastLatestState,
        ...event.detail
      };
      applyStateToUI(event.detail);
      if (event.detail.points !== undefined) {
        const actionText = formatAction(event.detail.action);
        showToastMessage(`${actionText} +${event.detail.points}`);
      }
    }
  });
}

function formatAction(action) {
  switch (action) {
    case 'stroke':
      return '🫳 なでる';
    case 'massage':
      return '🤲 もむ';
    case 'rub':
      return '🖐️ こする';
    case 'lick':
      return '👅 なめる';
    default:
      return '✨ リアクション';
  }
}

async function loadMicDevices() {
  if (!navigator.mediaDevices?.enumerateDevices) return;
  let permissionStream = null;
  try {
    permissionStream = await navigator.mediaDevices.getUserMedia({
      audio: microphoneConstraints()
    });
  } catch (error) {
    console.warn('[VcastTab] マイク権限取得失敗:', error);
  } finally {
    permissionStream?.getTracks().forEach((track) => track.stop());
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const micSelect = document.getElementById('vcastMicDevice');
    if (!micSelect) return;
    micSelect.innerHTML = '';
    const audioInputs = devices.filter((device) => device.kind === 'audioinput');
    audioInputs.forEach((device, index) => {
      const option = document.createElement('option');
      option.value = device.deviceId || 'default';
      option.textContent = device.label || `マイク ${index + 1}`;
      micSelect.appendChild(option);
    });
    if (micSelect.dataset.preferred) {
      micSelect.value = micSelect.dataset.preferred;
    }
    if (isVcastTabActive()) startMicPreview();
  } catch (error) {
    console.warn('[VcastTab] マイク一覧取得失敗:', error);
  }
}

let micPreviewStream = null;
let micPreviewAnalyzer = null;
let micPreviewRaf = null;
let micPreviewRequestId = 0;

function isVcastTabActive() {
  return document.querySelector('.tab.active')?.dataset.tab === 'vcast';
}

function handleVcastTabChanged(event) {
  if (event.detail?.tabName === 'vcast') startMicPreview();
  else stopMicPreview();
}

async function startMicPreview() {
  const micSelect = document.getElementById('vcastMicDevice');
  if (!isVcastTabActive() || !micSelect || !navigator.mediaDevices?.getUserMedia) return;
  stopMicPreview();
  const requestId = ++micPreviewRequestId;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: microphoneConstraints(micSelect.value || undefined)
    });
    if (requestId !== micPreviewRequestId || !isVcastTabActive()) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    micPreviewStream = stream;
    const context = new (window.AudioContext || window.webkitAudioContext)();
    const source = context.createMediaStreamSource(stream);
    const analyzer = context.createAnalyser();
    analyzer.fftSize = 256;
    source.connect(analyzer);
    micPreviewAnalyzer = { analyzer, context };
    updateMicPreview();
  } catch (error) {
    console.warn('[VcastTab] マイクプレビュー失敗:', error);
  }
}

function stopMicPreview() {
  micPreviewRequestId += 1;
  if (micPreviewStream) {
    micPreviewStream.getTracks().forEach((track) => track.stop());
  }
  micPreviewStream = null;
  if (micPreviewAnalyzer?.context) {
    micPreviewAnalyzer.context.close();
  }
  micPreviewAnalyzer = null;
  if (micPreviewRaf) {
    cancelAnimationFrame(micPreviewRaf);
    micPreviewRaf = null;
  }
}

function updateMicPreview() {
  if (!micPreviewAnalyzer) return;
  const data = new Uint8Array(micPreviewAnalyzer.analyzer.frequencyBinCount);
  micPreviewAnalyzer.analyzer.getByteFrequencyData(data);
  const avg = data.reduce((sum, v) => sum + v, 0) / data.length;
  const bar = document.getElementById('vcastMicLevelBar');
  if (bar) {
    const percent = Math.min(100, Math.round((avg / 255) * 100));
    bar.style.width = `${percent}%`;
  }
  micPreviewRaf = requestAnimationFrame(updateMicPreview);
}

loadMicDevices().then(() => {
  const micSelect = document.getElementById('vcastMicDevice');
  if (micSelect) {
    micSelect.addEventListener('change', () => {
      if (isVcastTabActive()) startMicPreview();
    });
  }
});
