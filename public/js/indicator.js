let setupMode = true;

// □ボタンで枠表示切替
const toggleBtn = document.getElementById('toggleFrameBtn');
const indicatorBar = document.querySelector('.indicator-bar');
const indicatorDateTime = document.getElementById('indicatorDateTime');
const indicatorTimerInput = document.getElementById('indicatorTimerInput');
const indicatorTimerStart = document.getElementById('indicatorTimerStart');

if (toggleBtn) {
  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setupMode = !setupMode;

    toggleBtn.classList.toggle('transparent-mode', !setupMode);

    if (window.electronAPI) {
      if (typeof window.electronAPI.setupModeChanged === 'function') {
        window.electronAPI.setupModeChanged(setupMode);
      }
      if (typeof window.electronAPI.setClickThrough === 'function') {
        window.electronAPI.setClickThrough(!setupMode);
      }
    }
  });
}

function requestIndicatorResize() {
  if (!indicatorBar) return;
  const rect = indicatorBar.getBoundingClientRect();
  const width = Math.ceil(rect.width + 8);
  const height = Math.ceil(rect.height + 8);
  if (window.electronAPI && typeof window.electronAPI.resizeIndicator === 'function') {
    window.electronAPI.resizeIndicator(width, height);
  }
}

// ===== タイマー =====
const timerState = {
  running: false,
  mode: 'up',
  startTime: 0,
  elapsedMs: 0,
  remainingMs: 0,
  intervalId: null,
  alarmAudio: null,
  lastTickAt: 0
};

function formatTimer(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.min(Math.floor(totalSeconds / 3600), 99);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function parseTimerInput(text) {
  if (!text) return 0;
  const parts = text.split(':').map((value) => Number(value));
  if (parts.some((value) => Number.isNaN(value))) return 0;
  if (parts.length === 3) {
    return ((parts[0] * 3600) + (parts[1] * 60) + parts[2]) * 1000;
  }
  if (parts.length === 2) {
    return ((parts[0] * 60) + parts[1]) * 1000;
  }
  if (parts.length === 1) {
    return parts[0] * 1000;
  }
  return 0;
}

function updateTimerDisplay() {
  if (!indicatorTimerInput) return;
  if (timerState.mode === 'up') {
    indicatorTimerInput.value = formatTimer(timerState.elapsedMs);
  } else {
    indicatorTimerInput.value = formatTimer(timerState.remainingMs);
  }
}

function stopTimerInterval() {
  if (timerState.intervalId) {
    clearInterval(timerState.intervalId);
    timerState.intervalId = null;
  }
}

function playAlarm() {
  if (!timerState.alarmAudio) {
    timerState.alarmAudio = new Audio('sounds/alerm.mp3');
  }
  timerState.alarmAudio.currentTime = 0;
  timerState.alarmAudio.play().catch(() => {});
}

function startTimerInterval() {
  stopTimerInterval();
  timerState.lastTickAt = Date.now();
  timerState.intervalId = setInterval(() => {
    if (!timerState.running) return;
    const now = Date.now();
    const delta = now - timerState.lastTickAt;
    timerState.lastTickAt = now;
    if (timerState.mode === 'up') {
      timerState.elapsedMs = now - timerState.startTime;
    } else {
      timerState.remainingMs = Math.max(0, timerState.remainingMs - delta);
      if (timerState.remainingMs <= 0) {
        timerState.running = false;
        stopTimerInterval();
        playAlarm();
        if (indicatorTimerStart) {
          indicatorTimerStart.textContent = '▶';
          indicatorTimerStart.title = '開始';
          indicatorTimerStart.classList.remove('is-reload');
        }
        if (indicatorTimerInput) indicatorTimerInput.readOnly = false;
      }
    }
    updateTimerDisplay();
  }, 1000);
}

function handleTimerStartStop() {
  if (timerState.running) {
    handleTimerReset();
    return;
  }

  const inputValue = indicatorTimerInput ? indicatorTimerInput.value.trim() : '';
  const parsedMs = parseTimerInput(inputValue);
  if (parsedMs > 0) {
    timerState.mode = 'down';
  } else {
    timerState.mode = 'up';
  }

  timerState.running = true;
  timerState.startTime = Date.now();
  if (timerState.mode === 'up') {
    timerState.startTime -= timerState.elapsedMs;
  } else {
    timerState.remainingMs = parsedMs;
  }
  if (indicatorTimerStart) {
    indicatorTimerStart.textContent = '↺';
    indicatorTimerStart.title = 'リロード';
    indicatorTimerStart.classList.add('is-reload');
  }
  if (indicatorTimerInput) indicatorTimerInput.readOnly = true;
  startTimerInterval();
  updateTimerDisplay();
}

function handleTimerReset() {
  timerState.running = false;
  timerState.elapsedMs = 0;
  timerState.remainingMs = 0;
  timerState.mode = 'up';
  timerState.startTime = 0;
  stopTimerInterval();
  if (indicatorTimerInput) {
    indicatorTimerInput.value = '00:00:00';
    indicatorTimerInput.readOnly = false;
  }
  if (indicatorTimerStart) {
    indicatorTimerStart.textContent = '▶';
    indicatorTimerStart.title = '開始';
    indicatorTimerStart.classList.remove('is-reload');
  }
  updateTimerDisplay();
}

if (indicatorTimerStart) indicatorTimerStart.addEventListener('click', (event) => {
  event.stopPropagation();
  handleTimerStartStop();
});

if (indicatorTimerInput) {
  indicatorTimerInput.addEventListener('click', (event) => event.stopPropagation());
  indicatorTimerInput.addEventListener('blur', () => {
    if (timerState.running) return;
    const parsedMs = parseTimerInput(indicatorTimerInput.value.trim());
    indicatorTimerInput.value = formatTimer(parsedMs);
  });
}

function updateDateTime() {
  if (!indicatorDateTime) return;
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const date = String(now.getDate()).padStart(2, '0');
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  const weekday = days[now.getDay()];
  const hours = String(now.getHours());
  const minutes = String(now.getMinutes()).padStart(2, '0');
  indicatorDateTime.textContent = `${month}/${date}(${weekday})${hours}:${minutes}`;
}

setInterval(updateDateTime, 1000);
updateTimerDisplay();
updateDateTime();
requestIndicatorResize();

// アイコンのマップ作成（otsumami / stamp / superchat）
const featureIconMap = {};
document.querySelectorAll('.indicator-icon').forEach((el) => {
  const feature = el.dataset.feature;
  if (feature) {
    featureIconMap[feature] = el;
  }
});

// メインからの「機能ON/OFF」通知を受信
if (window.electronAPI && typeof window.electronAPI.onFeatureToggled === 'function') {
  window.electronAPI.onFeatureToggled((feature, value) => {
    if (feature === 'theme') {
      // テーマだけ特別扱い
      document.body.dataset.theme = value;
      console.log('[Indicator] Theme updated:', value);
      return;
    }

    // 機能のON/OFF → アイコンの .active 切り替え
    const icon = featureIconMap[feature];
    if (icon) {
      const enabled = !!value;
      icon.classList.toggle('active', enabled);
      console.log('[Indicator] Feature state changed:', feature, enabled);
    }
  });
}

console.log('Indicator initialized (passive mode: icons are display-only)');
