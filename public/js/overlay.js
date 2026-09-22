// オーバーレイ:セットアップモードとリサイズ制御
const STAMP_DIR = 'stamps';  // メインウィンドウと同じ相対パスを想定
let setupMode = true;

// ★ 追加:現在のスタンプ倍率(スライダーの値)
let currentStampScale = 1;
let stampBaseSize = 220;

// ★ 追加:動画スタンプの音量設定
let videoStampVolume = 0.5; // 0.0 ~ 1.0
let videoStampMuted = false;
let stampDuration = 3000; // ミリ秒(デフォルト3秒)
// ★ 着信音設定
let stampSoundConfig = {
  selectedSound: 'sound1',
  volume: 0.5
};

let ohinerimakiSoundVolume = 0.5;
let currentOhinerimakiAudio = null;

const ohinerimakiListContainer = document.getElementById('ohinerimakiNotifications');
const vcastAvatar = document.getElementById('vcastAvatar');
const vcastAvatarImage = document.getElementById('vcastAvatarImage');
const overlayTextTools = document.getElementById('overlayTextTools');
const overlayTextToggle = document.getElementById('overlayTextToggle');
const overlayTextSettingsToggle = document.getElementById('overlayTextSettingsToggle');
const overlayTextPanel = document.getElementById('overlayTextPanel');
const overlayTextItem = document.getElementById('overlayTextItem');
const overlayTextBox = document.getElementById('overlayTextBox');
const overlayTextDragHandle = document.getElementById('overlayTextDragHandle');
const overlayTextResizeHandle = document.getElementById('overlayTextResizeHandle');
const overlayTextSize = document.getElementById('overlayTextSize');
const overlayTextStrokeToggle = document.getElementById('overlayTextStrokeToggle');
const overlayTextStrokeWidth = document.getElementById('overlayTextStrokeWidth');
const overlayTextStrokeColor = document.getElementById('overlayTextStrokeColor');


let vcastConfig = null;
let vcastState = null;
let vcastMicStream = null;
let vcastMicAnalyzer = null;
let vcastMicAnimationId = null;
let vcastMicRippleAt = 0;
let vcastMicDeviceId = null;

// ★ 着信音キャッシュ
const soundCache = {};

// ★ 現在再生中の音声を管理
let currentPlayingAudio = null;

function setOverlayTextVisibility(visible) {
  if (!overlayTextItem) return;
  overlayTextItem.classList.toggle('is-hidden', !visible);
  overlayTextItem.setAttribute('aria-hidden', visible ? 'false' : 'true');
}

function setOverlayTextEditing(enabled) {
  if (!overlayTextBox) return;
  overlayTextBox.setAttribute('contenteditable', enabled ? 'true' : 'false');
}

function fitOverlayTextToContent() {
  if (!overlayTextBox || overlayTextBox.dataset.resized === 'true') return;
  overlayTextBox.style.width = 'auto';
  overlayTextBox.style.height = 'auto';
  const nextWidth = Math.min(overlayTextBox.scrollWidth + 2, window.innerWidth - 40);
  const nextHeight = Math.min(overlayTextBox.scrollHeight + 2, window.innerHeight - 40);
  overlayTextBox.style.width = `${Math.max(nextWidth, 120)}px`;
  overlayTextBox.style.height = `${Math.max(nextHeight, 52)}px`;
}

function applyOverlayTextStyles() {
  if (!overlayTextBox) return;
  if (overlayTextSize) {
    overlayTextBox.style.fontSize = `${overlayTextSize.value}px`;
  }
  if (overlayTextStrokeToggle && overlayTextStrokeWidth && overlayTextStrokeColor) {
    const strokeEnabled = overlayTextStrokeToggle.checked;
    const width = strokeEnabled ? Number(overlayTextStrokeWidth.value) : 0;
    const color = overlayTextStrokeColor.value;
    if (width > 0) {
      const offsets = [
        [-width, 0],
        [width, 0],
        [0, -width],
        [0, width],
        [-width, -width],
        [-width, width],
        [width, -width],
        [width, width]
      ];
      overlayTextBox.style.textShadow = offsets
        .map(([x, y]) => `${x}px ${y}px 0 ${color}`)
        .join(', ');
    } else {
      overlayTextBox.style.textShadow = '0 1px 3px rgba(0, 0, 0, 0.4)';
    }
  }
  fitOverlayTextToContent();
}

/**
 * スタンプ着信音を再生
 */
function playStampSound(stampUrl) {
  if (!stampUrl) return;
  
  // mp4/webmは動画なので着信音を鳴らさない
  const ext = stampUrl.toLowerCase().split('.').pop().split('?')[0];
  if (ext === 'mp4' || ext === 'webm') {
    return;
  }
  
  // ランダム選択の場合
  let soundFile = stampSoundConfig.selectedSound;
  if (soundFile === 'random') {
    const sounds = ['sound1', 'sound2', 'sound3', 'sound4'];
    soundFile = sounds[Math.floor(Math.random() * sounds.length)];
  }
  
  const soundPath = `/sounds/${soundFile}.mp3`;
  // ★ 前回の再生を停止
  if (currentPlayingAudio) {
    currentPlayingAudio.pause();
    currentPlayingAudio.currentTime = 0;
  }

  // ★ キャッシュから取得または新規作成
  if (!soundCache[soundPath]) {
    soundCache[soundPath] = new Audio(soundPath);
  }

  const audio = soundCache[soundPath];
  audio.volume = stampSoundConfig.volume;

  // 再生
  currentPlayingAudio = audio;
  audio.play().catch(err => {
    console.log('[Overlay] 着信音再生失敗:', err.message);
    currentPlayingAudio = null;
  });
}

function playOhinerimakiSound() {
  const soundPath = '/sounds/ohinerimaki-bell.mp3';

  if (currentOhinerimakiAudio) {
    currentOhinerimakiAudio.pause();
    currentOhinerimakiAudio.currentTime = 0;
  }

  const audio = new Audio(soundPath);
  audio.volume = ohinerimakiSoundVolume;
  currentOhinerimakiAudio = audio;
  audio.play().catch(err => {
    console.log('[Overlay] おひねり音再生失敗:', err.message);
    currentOhinerimakiAudio = null;
  });
}

function formatOhinerimakiIcon(notification) {
  if (notification.icon === 'money') {
    return '💰';
  }
  return '🎁';
}

function formatOhinerimakiLabel(notification) {
  if (notification.icon === 'money') {
    const amountText = notification.amount ? `${notification.amount}円` : '';
    return `${amountText} ${notification.name || ''}`.trim();
  }
  return notification.name || '';
}

function renderOhinerimakiNotification(notification) {
  if (!ohinerimakiListContainer) return;

  const item = document.createElement('div');
  item.className = 'ohinerimaki-notification-item';
  item.dataset.id = notification.id;

  const icon = document.createElement('span');
  icon.className = 'ohinerimaki-notification-icon';
  icon.textContent = formatOhinerimakiIcon(notification);

  const name = document.createElement('span');
  name.className = 'ohinerimaki-notification-name';
  name.textContent = formatOhinerimakiLabel(notification);

  item.appendChild(icon);
  item.appendChild(name);
  ohinerimakiListContainer.appendChild(item);
  ohinerimakiListContainer.scrollTop = ohinerimakiListContainer.scrollHeight;
}

function removeOhinerimakiNotification(id) {
  if (!ohinerimakiListContainer) return;
  const target = ohinerimakiListContainer.querySelector(`[data-id="${id}"]`);
  if (target) {
    target.remove();
  }
}

async function loadOhinerimakiInitialState() {
  if (!ohinerimakiListContainer) return;
  try {
    const [configRes, notificationsRes] = await Promise.all([
      fetch('/api/ohinerimaki-config'),
      fetch('/api/ohinerimaki-notifications')
    ]);

    if (configRes.ok) {
      const configData = await configRes.json();
      if (configData?.config?.soundVolume !== undefined) {
        ohinerimakiSoundVolume = configData.config.soundVolume / 100;
      }
    }

    if (notificationsRes.ok) {
      const notificationData = await notificationsRes.json();
      const notifications = Array.isArray(notificationData.notifications)
        ? notificationData.notifications
        : [];
      ohinerimakiListContainer.innerHTML = '';
      notifications.forEach(renderOhinerimakiNotification);
    }
  } catch (error) {
    console.warn('[Overlay] おひねり通知初期化失敗:', error);
  }
}

function handleOhinerimakiBell(notification) {
  if (!notification) return;
  playOhinerimakiSound();
  showStampOnOverlay({ filename: '/images/ohinerimaki-present.gif' }, { playSound: false });

  setTimeout(() => {
    renderOhinerimakiNotification(notification);
  }, stampDuration);
}

function updateVcastConfig(config) {
  if (!config || !vcastAvatar || !vcastAvatarImage) return;
  vcastConfig = config;

  vcastAvatarImage.src = config.avatarImage || '';
  vcastAvatar.style.display = config.enabled && config.avatarImage ? 'flex' : 'none';
  vcastAvatar.style.width = `${config.size || 150}px`;
  vcastAvatar.style.height = `${config.size || 150}px`;

  vcastAvatar.classList.remove(
    'position-bottom-left',
    'position-bottom-center',
    'position-bottom-right',
    'idle-bounce',
    'idle-shake',
    'idle-rotate',
    'idle-breathe',
    'idle-tilt',
    'idle-rotate',
    'idle-heartbeat',
    'idle-stomp',
    'idle-micro-rotate'
  );

  const positionClass = `position-${config.position || 'bottom-right'}`;
  vcastAvatar.classList.add(positionClass);

  const animationMap = {
    bounce: 'idle-bounce',
    shake: 'idle-shake',
    rotate: 'idle-rotate',
    breathe: 'idle-breathe',
    tilt: 'idle-tilt',
    'micro-rotate': 'idle-micro-rotate',
    heartbeat: 'idle-heartbeat',
    stomp: 'idle-stomp'
  };
  const idleAnimation = config.idleAnimation || config.animation;
  const animationClass = animationMap[idleAnimation];
  if (animationClass) {
    vcastAvatar.classList.add(animationClass);
  }

  vcastAvatar.style.setProperty('--vcast-idle-speed', config.animationSpeed || 1);
  vcastAvatar.style.setProperty(
    '--vcast-idle-intensity',
    ((config.idleIntensity ?? 100) / 100) * 5
  );

  if (config.voiceReaction) {
    if (vcastMicDeviceId !== config.micDeviceId) {
      stopVcastMic();
    }
    vcastMicDeviceId = config.micDeviceId || null;
    startVcastMic();
  } else {
    stopVcastMic();
    vcastAvatar.classList.remove('mic-bright', 'mic-dim', 'mic-pulse', 'mic-glow');
    vcastAvatar.classList.remove('mic-glow');
    if (vcastAvatarImage) {
      vcastAvatarImage.style.transform = '';
      vcastAvatarImage.style.filter = '';
    }
  }
}

function updateVcastState(state) {
  if (!state) return;
  vcastState = {
    ...(vcastState || {}),
    ...state
  };
}

function showVcastReaction(payload) {
  if (!vcastAvatar || !vcastConfig) return;
  if (!vcastConfig.enabled) return;

  const reaction = document.createElement('div');
  reaction.className = 'vcast-reaction';

  const icon = document.createElement('span');
  icon.textContent = reactionIcon(payload.action);
  reaction.appendChild(icon);

  const points = document.createElement('span');
  points.className = 'vcast-reaction-points';
  points.textContent = `+${payload.points}`;
  reaction.appendChild(points);

  const offsetX = Math.floor(Math.random() * 20) - 10;
  reaction.style.right = `${20 + offsetX}px`;

  vcastAvatar.appendChild(reaction);
  setTimeout(() => reaction.remove(), 1700);

  const ripple = document.createElement('div');
  ripple.className = 'vcast-ripple';
  ripple.style.bottom = '20px';
  ripple.style.right = '40px';
  vcastAvatar.appendChild(ripple);
  setTimeout(() => ripple.remove(), 1400);
}

function reactionIcon(action) {
  switch (action) {
    case 'stroke':
      return '🫳';
    case 'massage':
      return '🤲';
    case 'rub':
      return '🖐️';
    case 'lick':
      return '👅';
    default:
      return '✨';
  }
}

async function startVcastMic() {
  if (vcastMicStream || !navigator.mediaDevices?.getUserMedia) return;
  try {
    const deviceId = vcastConfig?.micDeviceId;
    vcastMicStream = await navigator.mediaDevices.getUserMedia({
      audio: deviceId ? { deviceId: { exact: deviceId } } : true
    });
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(vcastMicStream);
    const analyzer = audioContext.createAnalyser();
    analyzer.fftSize = 256;
    source.connect(analyzer);
    vcastMicAnalyzer = { analyzer, audioContext };
    loopVcastMic();
  } catch (error) {
    console.warn('[Vcast] マイク取得失敗:', error);
  }
}

function stopVcastMic() {
  if (vcastMicStream) {
    vcastMicStream.getTracks().forEach(track => track.stop());
  }
  vcastMicStream = null;
  if (vcastMicAnalyzer?.audioContext) {
    vcastMicAnalyzer.audioContext.close();
  }
  vcastMicAnalyzer = null;
  if (vcastMicAnimationId) {
    cancelAnimationFrame(vcastMicAnimationId);
    vcastMicAnimationId = null;
  }
}

function loopVcastMic() {
  if (!vcastMicAnalyzer || !vcastAvatar) return;
  const { analyzer } = vcastMicAnalyzer;
  const data = new Uint8Array(analyzer.frequencyBinCount);
  analyzer.getByteFrequencyData(data);
  const avg = data.reduce((sum, v) => sum + v, 0) / data.length;
  const sensitivity = vcastConfig?.voiceSensitivity ?? 50;
  const threshold = vcastConfig?.voiceThreshold ?? Math.max(10, 120 - sensitivity);
  const intensity = ((vcastConfig?.micIntensity ?? 100) / 100) * 5;
  const active = avg > threshold;
  const micAnimation = vcastConfig?.micAnimation || 'none';

  if (vcastAvatarImage) {
    vcastAvatarImage.style.transform = '';
    vcastAvatarImage.style.filter = '';
  }
  vcastAvatar.classList.toggle('mic-glow', false);
  vcastAvatar.classList.toggle('mic-bright', false);
  vcastAvatar.classList.toggle('mic-dim', false);
  vcastAvatar.classList.toggle('mic-pulse', false);
  vcastAvatar.style.filter = '';

  if (micAnimation === 'bright') {
    if (vcastAvatarImage && active) {
      const brightness = 1 + 0.25 * intensity;
      vcastAvatarImage.style.filter = `brightness(${brightness})`;
    }
  } else if (micAnimation === 'scale') {
    vcastAvatar.classList.toggle('mic-pulse', active);
    if (vcastAvatarImage && active) {
      const scale = 1 + Math.min(0.12 * intensity, avg / 400);
      vcastAvatarImage.style.transform = `scale(${scale})`;
    }
  } else if (micAnimation === 'bounce') {
    if (vcastAvatarImage && active) {
      const offset = Math.min(24 * intensity, avg / 6);
      vcastAvatarImage.style.transform = `translateY(-${offset}px)`;
    }
  } else if (micAnimation === 'nod') {
    if (vcastAvatarImage && active) {
      const angle = -Math.min(18 * intensity, avg / 5);
      vcastAvatarImage.style.transform = `rotate(${angle}deg)`;
    }
  } else if (micAnimation === 'glow') {
    if (active) {
      const glowSize = 8 * intensity;
      vcastAvatar.style.filter = `drop-shadow(0 0 ${glowSize}px rgba(255, 255, 255, 0.6))`;
    }
  } else if (micAnimation === 'ripple') {
    const now = Date.now();
    if (active && now - vcastMicRippleAt > 900) {
      vcastMicRippleAt = now;
    const ripple = document.createElement('div');
    ripple.className = 'vcast-ripple';
    ripple.style.setProperty('--vcast-ripple-scale', String(1 + intensity * 0.6));
    ripple.style.bottom = '20px';
    ripple.style.right = '40px';
      vcastAvatar.appendChild(ripple);
      setTimeout(() => ripple.remove(), 1400);
    }
  }

  vcastMicAnimationId = requestAnimationFrame(loopVcastMic);
}


// 起動直後から必ずセットアップモード(枠＋ハンドル有効)にしておく
document.body.classList.add('setup-mode');

// インジケーター → メイン → オーバーレイ で飛んでくる「setupModeChanged」通知を受信
if (window.electronAPI && typeof window.electronAPI.onSetupModeChanged === 'function') {
  window.electronAPI.onSetupModeChanged((mode) => {
    setupMode = !!mode;
    document.body.classList.toggle('setup-mode', setupMode);
    setOverlayTextEditing(setupMode);
    if (!setupMode && overlayTextPanel) {
      overlayTextPanel.classList.remove('is-open');
    }
    console.log('[Overlay] Setup mode:', setupMode ? 'ON' : 'OFF');
  });
}

setOverlayTextEditing(setupMode);

if (overlayTextToggle && overlayTextItem) {
  let isVisible = !overlayTextItem.classList.contains('is-hidden');
  overlayTextToggle.addEventListener('click', () => {
    isVisible = !isVisible;
    setOverlayTextVisibility(isVisible);
    if (isVisible) {
      fitOverlayTextToContent();
      overlayTextBox?.focus();
    }
  });
}

if (overlayTextSettingsToggle && overlayTextPanel) {
  overlayTextSettingsToggle.addEventListener('click', (event) => {
    event.stopPropagation();
    overlayTextPanel.classList.toggle('is-open');
  });
}

document.addEventListener('click', (event) => {
  if (!overlayTextPanel || !overlayTextPanel.classList.contains('is-open')) return;
  if (overlayTextPanel.contains(event.target)) return;
  if (overlayTextSettingsToggle && overlayTextSettingsToggle.contains(event.target)) return;
  overlayTextPanel.classList.remove('is-open');
});

if (overlayTextSize) {
  overlayTextSize.addEventListener('input', applyOverlayTextStyles);
}
if (overlayTextStrokeToggle) {
  overlayTextStrokeToggle.addEventListener('change', applyOverlayTextStyles);
}
if (overlayTextStrokeWidth) {
  overlayTextStrokeWidth.addEventListener('input', applyOverlayTextStyles);
}
if (overlayTextStrokeColor) {
  overlayTextStrokeColor.addEventListener('input', applyOverlayTextStyles);
}
if (overlayTextBox) {
  overlayTextBox.addEventListener('input', fitOverlayTextToContent);
  overlayTextBox.addEventListener('blur', fitOverlayTextToContent);
  applyOverlayTextStyles();
}

if (overlayTextDragHandle && overlayTextItem) {
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;

  const onDragMove = (event) => {
    if (!isDragging) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    const maxLeft = window.innerWidth - overlayTextItem.offsetWidth - 10;
    const maxTop = window.innerHeight - overlayTextItem.offsetHeight - 10;
    const nextLeft = Math.min(Math.max(startLeft + dx, 10), Math.max(maxLeft, 10));
    const nextTop = Math.min(Math.max(startTop + dy, 10), Math.max(maxTop, 10));
    overlayTextItem.style.left = `${nextLeft}px`;
    overlayTextItem.style.top = `${nextTop}px`;
    overlayTextItem.style.right = 'auto';
  };

  const onDragEnd = () => {
    if (!isDragging) return;
    isDragging = false;
    document.removeEventListener('pointermove', onDragMove);
    document.removeEventListener('pointerup', onDragEnd);
  };

  overlayTextDragHandle.addEventListener('pointerdown', (event) => {
    if (!setupMode) return;
    event.preventDefault();
    const rect = overlayTextItem.getBoundingClientRect();
    isDragging = true;
    startX = event.clientX;
    startY = event.clientY;
    startLeft = rect.left;
    startTop = rect.top;
    document.addEventListener('pointermove', onDragMove);
    document.addEventListener('pointerup', onDragEnd);
  });
}

if (overlayTextResizeHandle && overlayTextBox) {
  let isResizing = false;
  let startX = 0;
  let startY = 0;
  let startWidth = 0;
  let startHeight = 0;

  const onResizeMove = (event) => {
    if (!isResizing) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    const nextWidth = Math.max(startWidth + dx, 120);
    const nextHeight = Math.max(startHeight + dy, 52);
    overlayTextBox.style.width = `${nextWidth}px`;
    overlayTextBox.style.height = `${nextHeight}px`;
  };

  const onResizeEnd = () => {
    if (!isResizing) return;
    isResizing = false;
    document.removeEventListener('pointermove', onResizeMove);
    document.removeEventListener('pointerup', onResizeEnd);
  };

  overlayTextResizeHandle.addEventListener('pointerdown', (event) => {
    if (!setupMode) return;
    event.preventDefault();
    const rect = overlayTextBox.getBoundingClientRect();
    overlayTextBox.dataset.resized = 'true';
    isResizing = true;
    startX = event.clientX;
    startY = event.clientY;
    startWidth = rect.width;
    startHeight = rect.height;
    document.addEventListener('pointermove', onResizeMove);
    document.addEventListener('pointerup', onResizeEnd);
  });
}

// 左下のリサイズハンドル
const resizeHandle = document.getElementById('resizeHandle');

if (!resizeHandle) {
  console.warn('[Overlay] resizeHandle not found');
} else {
  let isResizing = false;

  // 現在のオーバーレイの幅と高さ(初期値はウインドウサイズを読む)
  let currentWidth = window.innerWidth || 600;
  let currentHeight = window.innerHeight || 400;

  let startX = 0;
  let startY = 0;
  let startWidth = currentWidth;
  let startHeight = currentHeight;

  let rafId = null;

  // メインプロセスへサイズ変更を通知
  function sendResize(width, height) {
    if (!window.electronAPI || typeof window.electronAPI.resizeOverlay !== 'function') {
      console.warn('[Overlay] electronAPI.resizeOverlay is not available');
      return;
    }
    window.electronAPI.resizeOverlay(Math.round(width), Math.round(height));
  }

  function onMouseDown(e) {
    if (!setupMode) {
      // 透過モード中はリサイズ禁止
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    isResizing = true;

    startX = e.screenX;
    startY = e.screenY;
    startWidth = currentWidth;
    startHeight = currentHeight;

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  function onMouseMove(e) {
    if (!isResizing) return;

    const dx = e.screenX - startX;
    const dy = e.screenY - startY;

    // 左下ハンドル想定:
    // 左にドラッグ → 幅を広げる
    // 下にドラッグ → 高さを広げる
    let newWidth = startWidth - dx;
    let newHeight = startHeight + dy;

    // 最小サイズ制限
    if (newWidth < 200) newWidth = 200;
    if (newHeight < 120) newHeight = 120;

    currentWidth = newWidth;
    currentHeight = newHeight;

    // resize を投げすぎないように requestAnimationFrame で間引く
    if (rafId) return;

    rafId = requestAnimationFrame(() => {
      rafId = null;
      sendResize(currentWidth, currentHeight);
    });
  }

  function onMouseUp() {
    if (!isResizing) return;

    isResizing = false;

    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }

    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }

  resizeHandle.addEventListener('mousedown', onMouseDown);
}

// ===== スタンプ表示処理 =====

function showStampOnOverlay(payload, options = {}) {
  if (!payload || !payload.filename) return;

  let src = payload.filename;

  // ★ 着信音を再生
  if (options.playSound !== false) {
    playStampSound(src);
  }

  // ★ 修正:パス処理を改善
  if (/^https?:\/\//i.test(src)) {
    // 1. HTTP/HTTPSの絶対URLはそのまま使う
    // (何もしない)
  } else if (src.startsWith('/')) {
    // 2. "/" から始まる場合は、先頭の "/" を削除
    src = src.substring(1);
  } else if (!src.startsWith(`${STAMP_DIR}/`)) {
    // 3. "stamps/" で始まっていない場合は追加
    src = `${STAMP_DIR}/${src}`;
  }

  console.log('[Overlay] Stamp path:', src);

  // ★ 動画判定
  const lowerSrc = src.toLowerCase();
  const isVideo = lowerSrc.endsWith('.mp4') || lowerSrc.endsWith('.webm');

  if (isVideo) {
    // ===== 動画スタンプの処理 =====
    const video = document.createElement('video');
    video.className = 'stamp-instance';
    video.src = src;
    video.autoplay = true;
    video.muted = videoStampMuted;
    video.volume = videoStampMuted ? 0 : videoStampVolume;
    video.loop = false;
    video.playsInline = true;
    video.setAttribute('playsinline', 'playsinline');

    video.addEventListener('loadedmetadata', () => {
      const overlayWidth =
        window.innerWidth ||
        document.documentElement.clientWidth ||
        800;
      const overlayHeight =
        window.innerHeight ||
        document.documentElement.clientHeight ||
        600;

      const videoWidth = video.videoWidth || 320;
      const videoHeight = video.videoHeight || 240;

      // ★ スライダーで指定された倍率を使う
      const baseScale = stampBaseSize / Math.max(videoWidth, videoHeight, 1);
      let scale = baseScale * currentStampScale;
      scale = Math.min(scale, overlayWidth / videoWidth, overlayHeight / videoHeight);

      const finalWidth  = videoWidth  * scale;
      const finalHeight = videoHeight * scale;

      video.style.width = `${finalWidth}px`;
      video.style.height = `${finalHeight}px`;
      video.style.objectFit = 'contain';
      video.style.transform = 'none';

      const maxX = Math.max(overlayWidth  - finalWidth, 0);
      const maxY = Math.max(overlayHeight - finalHeight, 0);

      video.style.left = `${Math.random() * maxX}px`;
      video.style.top  = `${Math.random() * maxY}px`;

      // 再生開始
      video.play().catch(err => {
        console.error('[Overlay] Failed to play video:', err);
      });
    });

       // ★ 動画が終わったら即座に消す
    video.addEventListener('ended', () => {
      video.classList.add('fade-out');
      setTimeout(() => {
        video.pause();
        video.remove();
      }, 400); // フェードアウト時間
    });

    video.addEventListener('error', () => {
      console.error('[Overlay] Failed to load video:', src);
    });

    document.body.appendChild(video);

    // 設定された時間で消す
    const fadeOutTime = stampDuration - 400; // 0.4秒前にフェードアウト開始
    setTimeout(() => {
      video.classList.add('fade-out');
    }, fadeOutTime);

    setTimeout(() => {
      video.pause();
      video.remove();
    }, stampDuration);

  } else {
    // ===== 画像スタンプの処理(既存のまま) =====
    const img = document.createElement('img');
    img.className = 'stamp-instance';
    img.src = src;
    
img.addEventListener('load', () => {
      const overlayWidth =
        window.innerWidth ||
        document.documentElement.clientWidth ||
        800;
      const overlayHeight =
        window.innerHeight ||
        document.documentElement.clientHeight ||
        600;

      const naturalWidth = img.naturalWidth || 100;
      const naturalHeight = img.naturalHeight || 100;

      // ★ スライダーで指定された倍率を使う
      const baseScale = stampBaseSize / Math.max(naturalWidth, naturalHeight, 1);
      let scale = baseScale * currentStampScale;
      scale = Math.min(scale, overlayWidth / naturalWidth, overlayHeight / naturalHeight);

      const finalWidth  = naturalWidth  * scale;
      const finalHeight = naturalHeight * scale;

      img.style.width = `${finalWidth}px`;
      img.style.height = `${finalHeight}px`;
      img.style.objectFit = 'contain';
      img.style.transform = 'none';

      const maxX = Math.max(overlayWidth  - finalWidth, 0);
      const maxY = Math.max(overlayHeight - finalHeight, 0);

      img.style.left = `${Math.random() * maxX}px`;
      img.style.top  = `${Math.random() * maxY}px`;
      
      // ★ ロード完了後にDOMに追加
      document.body.appendChild(img);
    });

    img.addEventListener('error', () => {
      console.error('[Overlay] Failed to load stamp image:', src);
    });

  


    // 設定された時間で消す
    const fadeOutTime = stampDuration - 400; // 0.4秒前にフェードアウト開始
    setTimeout(() => {
      img.classList.add('fade-out');
    }, fadeOutTime);

    setTimeout(() => {
      img.remove();
    }, stampDuration);
  }
}

// ★ スタンプサイズ変更通知
if (window.electronAPI && typeof window.electronAPI.onStampScale === 'function') {
  window.electronAPI.onStampScale((payload) => {
    if (!payload || typeof payload.scale !== 'number') return;
    currentStampScale = payload.scale;
    console.log('[Overlay] Stamp scale updated:', currentStampScale);
  });
} else {
  console.warn('[Overlay] electronAPI.onStampScale が利用できません');
}

// ★ スタンプ本体受信 → 表示
if (window.electronAPI && typeof window.electronAPI.onStamp === 'function') {
  window.electronAPI.onStamp((payload) => {
    console.log('[Overlay] Stamp received:', payload);
    showStampOnOverlay(payload);
  });
} else {
  console.warn('[Overlay] electronAPI.onStamp が利用できません');
}

console.log('[Overlay] initialized, electronAPI:', !!window.electronAPI);

loadOhinerimakiInitialState();
fetch('/api/vcast-config')
  .then(res => res.json())
  .then(data => updateVcastConfig(data?.config))
  .catch(() => {});
fetch('/api/vcast-state')
  .then(res => res.json())
  .then(data => updateVcastState(data?.state))
  .catch(() => {});

// ★ 音量設定受信
if (window.electronAPI && typeof window.electronAPI.onVideoVolume === 'function') {
  window.electronAPI.onVideoVolume((payload) => {
    if (!payload) return;
    if (typeof payload.volume === 'number') {
      videoStampVolume = payload.volume / 100; // 0-100 → 0.0-1.0
    }
    if (typeof payload.muted === 'boolean') {
      videoStampMuted = payload.muted;
    }
    console.log('[Overlay] Video volume updated:', videoStampVolume, 'muted:', videoStampMuted);
  });
} else {
  console.warn('[Overlay] electronAPI.onVideoVolume が利用できません');
}


// ★ 表示時間設定受信
if (window.electronAPI && typeof window.electronAPI.onStampDuration === 'function') {
  window.electronAPI.onStampDuration((payload) => {
    if (!payload || typeof payload.duration !== 'number') return;
    stampDuration = payload.duration * 1000; // 秒 → ミリ秒
    if (typeof payload.baseSize === 'number') {
      stampBaseSize = Math.max(120, Math.min(480, payload.baseSize));
    }
    console.log('[Overlay] Stamp duration updated:', stampDuration, 'ms', 'baseSize:', stampBaseSize);
  });
} else {
  console.warn('[Overlay] electronAPI.onStampDuration が利用できません');
}

// ★ 着信音設定受信
if (window.electronAPI && typeof window.electronAPI.onStampSound === 'function') {
  window.electronAPI.onStampSound((payload) => {
    if (!payload) return;
    if (payload.sound) {
      stampSoundConfig.selectedSound = payload.sound;
    }
    if (typeof payload.volume === 'number') {
      stampSoundConfig.volume = payload.volume / 100; // 0-100 → 0.0-1.0
    }
    console.log('[Overlay] Stamp sound updated:', stampSoundConfig);
  });
} else {
  console.warn('[Overlay] electronAPI.onStampSound が利用できません');
}

if (window.electronAPI && typeof window.electronAPI.onOhinerimakiBell === 'function') {
  window.electronAPI.onOhinerimakiBell((payload) => {
    console.log('[Overlay] Ohinerimaki bell received:', payload);
    handleOhinerimakiBell(payload);
  });
} else {
  console.warn('[Overlay] electronAPI.onOhinerimakiBell が利用できません');
}

if (window.electronAPI && typeof window.electronAPI.onOhinerimakiDeleted === 'function') {
  window.electronAPI.onOhinerimakiDeleted((payload) => {
    if (!payload?.id) return;
    removeOhinerimakiNotification(payload.id);
  });
} else {
  console.warn('[Overlay] electronAPI.onOhinerimakiDeleted が利用できません');
}

if (window.electronAPI && typeof window.electronAPI.onOhinerimakiVolume === 'function') {
  window.electronAPI.onOhinerimakiVolume((payload) => {
    if (!payload) return;
    if (typeof payload.volume === 'number') {
      ohinerimakiSoundVolume = payload.volume / 100;
    }
  });
} else {
  console.warn('[Overlay] electronAPI.onOhinerimakiVolume が利用できません');
}

if (window.electronAPI && typeof window.electronAPI.onVcastConfig === 'function') {
  window.electronAPI.onVcastConfig((payload) => {
    updateVcastConfig(payload);
  });
} else {
  console.warn('[Overlay] electronAPI.onVcastConfig が利用できません');
}

if (window.electronAPI && typeof window.electronAPI.onVcastReaction === 'function') {
  window.electronAPI.onVcastReaction((payload) => {
    showVcastReaction(payload);
    updateVcastState({ totalPoints: payload.totalPoints });
  });
} else {
  console.warn('[Overlay] electronAPI.onVcastReaction が利用できません');
}

if (window.electronAPI && typeof window.electronAPI.onVcastState === 'function') {
  window.electronAPI.onVcastState((payload) => {
    updateVcastState(payload);
  });
} else {
  console.warn('[Overlay] electronAPI.onVcastState が利用できません');
}

// ウィンドウの再作成時も、保存済み設定を読み込む。
fetch('/api/stamp-config').then(response => response.json()).then(({ config }) => {
  if (!config) return;
  stampSoundConfig.selectedSound = config.stampSound || 'sound1';
  stampSoundConfig.volume = (config.stampSoundVolume ?? 50) / 100;
  videoStampVolume = (config.videoVolume ?? 50) / 100;
  videoStampMuted = !!config.muteVideo;
  stampDuration = (config.stampDuration ?? 3) * 1000;
  stampBaseSize = config.stampBaseSize ?? 220;
}).catch(error => console.error('スタンプ設定の読み込みに失敗しました', error));
