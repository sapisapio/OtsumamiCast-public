// js/tabs/ohinerimaki-tab-init.js
// おひねり撒きタブ専用の初期化処理

const LOCAL_STORAGE_KEY = 'ohinerimaki-last-send';
const COOLDOWN_MS = 60 * 1000;

let ohinerimakiConfig = {
  links: {
    amazonWishlist: '',
    amazonGiftEmail: '',
    qrImage: ''
  },
  soundVolume: 50
};
let notificationsCache = [];
let cooldownTimer = null;

/**
 * おひねり撒きタブの初期化
 */
export async function initOhinerimakiTab() {
  console.log('[OhinerimakiTab] 初期化開始');

  await Promise.all([
    loadOhinerimakiConfig(),
    loadOhinerimakiNotifications()
  ]);

  initButtons();
  updateHostOnlyUI();
  setupCooldownState();

  window.addEventListener('otsumamiRoleChanged', updateHostOnlyUI);

  window.otsumamiOhinerimaki = {
    handleBell: (payload) => {
      if (!payload || !payload.id) return;
      notificationsCache.unshift(payload);
      renderNotificationList();
    },
    handleDeleted: (payload) => {
      if (!payload?.id) return;
      notificationsCache = notificationsCache.filter(item => item.id !== payload.id);
      renderNotificationList();
    }
  };

  console.log('[OhinerimakiTab] 初期化完了');
}

async function loadOhinerimakiConfig() {
  try {
    const response = await fetch('/api/ohinerimaki-config');
    const data = await response.json();
    if (data?.config) {
      ohinerimakiConfig = data.config;
    }
    applyConfigToUI();
    renderLinks();
  } catch (error) {
    console.error('[OhinerimakiTab] 設定読み込み失敗:', error);
  }
}

async function loadOhinerimakiNotifications() {
  try {
    const response = await fetch('/api/ohinerimaki-notifications');
    const data = await response.json();
    notificationsCache = Array.isArray(data.notifications) ? data.notifications : [];
    renderNotificationList();
  } catch (error) {
    console.error('[OhinerimakiTab] 通知読み込み失敗:', error);
  }
}

function applyConfigToUI() {
  const wishlistInput = document.getElementById('linkAmazonWishlist');
  const emailInput = document.getElementById('linkAmazonGiftEmail');
  const qrInput = document.getElementById('ohinerimakiQrInput');
  const volumeInput = document.getElementById('ohinerimakiSoundVolume');
  const volumeLabel = document.getElementById('ohinerimakiSoundVolumeLabel');

  if (wishlistInput) wishlistInput.value = ohinerimakiConfig.links?.amazonWishlist || '';
  if (emailInput) emailInput.value = ohinerimakiConfig.links?.amazonGiftEmail || '';
  if (qrInput) {
    qrInput.dataset.imageData = ohinerimakiConfig.links?.qrImage || '';
    updateQrPreview(qrInput.dataset.imageData);
  }
  if (volumeInput) volumeInput.value = ohinerimakiConfig.soundVolume ?? 50;
  if (volumeLabel) volumeLabel.textContent = String(ohinerimakiConfig.soundVolume ?? 50);
}

function initButtons() {
  const bellBtn = document.getElementById('sendOhinerimakiBellBtn');
  if (bellBtn && !bellBtn.dataset.initialized) {
    bellBtn.addEventListener('click', handleSendBell);
    bellBtn.dataset.initialized = 'true';
  }

  const saveBtn = document.getElementById('saveOhinerimakiBtn');
  if (saveBtn && !saveBtn.dataset.initialized) {
    saveBtn.addEventListener('click', saveOhinerimakiConfig);
    saveBtn.dataset.initialized = 'true';
  }

  const qrInput = document.getElementById('ohinerimakiQrInput');
  const qrSelectBtn = document.getElementById('ohinerimakiQrSelectBtn');
  if (qrSelectBtn && !qrSelectBtn.dataset.initialized) {
    qrSelectBtn.addEventListener('click', () => {
      const role = window.state?.role || window.otsumamiRole || 'viewer';
      if (role !== 'host') return;
      qrInput?.click();
    });
    qrSelectBtn.dataset.initialized = 'true';
  }
  if (qrInput && !qrInput.dataset.initialized) {
    qrInput.addEventListener('change', handleQrUpload);
    qrInput.dataset.initialized = 'true';
  }

  const volumeInput = document.getElementById('ohinerimakiSoundVolume');
  const volumeLabel = document.getElementById('ohinerimakiSoundVolumeLabel');
  if (volumeInput && !volumeInput.dataset.initialized) {
    volumeInput.addEventListener('input', () => {
      if (volumeLabel) volumeLabel.textContent = volumeInput.value;
    });
    volumeInput.dataset.initialized = 'true';
  }

  const testBtn = document.getElementById('ohinerimakiTestBellBtn');
  if (testBtn && !testBtn.dataset.initialized) {
    testBtn.addEventListener('click', () => sendOhinerimakiTest());
    testBtn.dataset.initialized = 'true';
  }

  const amountInput = document.getElementById('ohinerimakiAmount');
  document.querySelectorAll('input[name="ohinerimakiIcon"]').forEach((radio) => {
    if (!radio.dataset.initialized) {
      radio.addEventListener('change', () => {
        if (!amountInput) return;
        amountInput.disabled = radio.value === 'gift' && radio.checked;
      });
      radio.dataset.initialized = 'true';
    }
  });

  if (amountInput) {
    const selectedIcon = document.querySelector('input[name="ohinerimakiIcon"]:checked')?.value;
    amountInput.disabled = selectedIcon === 'gift';
  }
}

function handleSendBell() {
  const nameInput = document.getElementById('ohinerimakiName');
  const amountInput = document.getElementById('ohinerimakiAmount');
  const icon = document.querySelector('input[name="ohinerimakiIcon"]:checked')?.value || 'gift';

  const name = nameInput?.value || '';
  const amount = amountInput?.value || '';

  const nameError = validateName(name);
  if (nameError) {
    showError(nameError);
    return;
  }

  const amountError = validateAmount(amount, icon);
  if (amountError) {
    showError(amountError);
    return;
  }

  if (!window.otsumamiWs || window.otsumamiWs.readyState !== WebSocket.OPEN) {
    showError('WebSocketに接続されていません');
    return;
  }

  window.otsumamiWs.send(JSON.stringify({
    type: 'ohinerimaki-bell',
    name: name.trim(),
    icon,
    amount: icon === 'gift' ? null : parseInt(amount, 10)
  }));

  if (window.showToast) {
    window.showToast('通知を送信しました', 'success');
  }

  if (nameInput) nameInput.value = '';
  if (amountInput) amountInput.value = '';

  startCooldown();
}

function sendOhinerimakiTest() {
  if (!window.otsumamiWs || window.otsumamiWs.readyState !== WebSocket.OPEN) {
    showError('WebSocketに接続されていません');
    return;
  }

  window.otsumamiWs.send(JSON.stringify({
    type: 'ohinerimaki-bell',
    name: 'テスト送信',
    icon: 'gift',
    amount: null,
    isTest: true
  }));
}

async function saveOhinerimakiConfig() {
  const wishlistInput = document.getElementById('linkAmazonWishlist');
  const emailInput = document.getElementById('linkAmazonGiftEmail');
  const qrInput = document.getElementById('ohinerimakiQrInput');
  const volumeInput = document.getElementById('ohinerimakiSoundVolume');

  const amazonWishlist = wishlistInput?.value.trim() || '';
  const amazonGiftEmail = emailInput?.value.trim() || '';
  const qrImage = qrInput?.dataset?.imageData || '';
  const soundVolume = volumeInput ? parseInt(volumeInput.value, 10) : 50;

  const urlError = validateUrl(amazonWishlist);
  if (urlError) {
    showError(urlError);
    return;
  }

  const emailError = validateEmail(amazonGiftEmail);
  if (emailError) {
    showError(emailError);
    return;
  }

  const payload = {
    links: {
      amazonWishlist,
      amazonGiftEmail,
      qrImage
    },
    soundVolume: Number.isNaN(soundVolume) ? 50 : soundVolume
  };

  try {
    const response = await fetch('/api/ohinerimaki-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || '保存に失敗しました');
    }

    ohinerimakiConfig = data.config;
    applyConfigToUI();
    renderLinks();

    if (window.electronAPI && typeof window.electronAPI.sendToOverlay === 'function') {
      window.electronAPI.sendToOverlay('ohinerimaki-volume', {
        volume: ohinerimakiConfig.soundVolume ?? 50
      });
    }

    if (window.showToast) {
      window.showToast('設定を保存しました', 'success');
    }
  } catch (error) {
    console.error('[OhinerimakiTab] 保存失敗:', error);
    showError('保存に失敗しました');
  }
}

function renderLinks() {
  const container = document.getElementById('ohinerimakiLinksContainer');
  if (!container) return;

  container.innerHTML = '';

  const wishlistUrl = sanitizeUrl(ohinerimakiConfig.links?.amazonWishlist);
  const giftEmail = ohinerimakiConfig.links?.amazonGiftEmail || '';
  const qrImage = getSafeQrImageSrc(ohinerimakiConfig.links?.qrImage || '');
  let hasAny = false;

  if (wishlistUrl) {
    const link = document.createElement('a');
    link.href = wishlistUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Amazonほしいものリスト';
    link.className = 'ohinerimaki-link-item';
    container.appendChild(link);
    hasAny = true;
  }

  if (giftEmail && !validateEmail(giftEmail)) {
    const mailLink = document.createElement('a');
    mailLink.href = `mailto:${giftEmail}`;
    mailLink.textContent = `Amazonギフト券送付先: ${giftEmail}`;
    mailLink.className = 'ohinerimaki-link-item';
    container.appendChild(mailLink);
    hasAny = true;
  }

  if (qrImage) {
    const wrapper = document.createElement('div');
    wrapper.style.marginTop = '10px';

    const label = document.createElement('div');
    label.className = 'small-text';
    label.textContent = 'QRコード';
    label.style.marginBottom = '6px';

    const img = document.createElement('img');
    img.src = qrImage;
    img.alt = 'QRコード';
    img.style.maxWidth = '240px';
    img.style.width = '100%';
    img.style.borderRadius = '8px';
    img.style.border = '1px solid rgba(0,0,0,0.1)';

    wrapper.appendChild(label);
    wrapper.appendChild(img);
    container.appendChild(wrapper);
    hasAny = true;
  }

  if (!hasAny) {
    const empty = document.createElement('div');
    empty.className = 'small-text';
    empty.style.color = '#888';
    empty.textContent = '配信者がリンクを設定すると、ここに表示されます';
    container.appendChild(empty);
  }
}

function renderNotificationList() {
  const list = document.getElementById('ohinerimakiNotificationList');
  if (!list) return;

  list.innerHTML = '';
  const role = window.state?.role || window.otsumamiRole || 'viewer';
  if (role !== 'host') return;

  notificationsCache.forEach((item) => {
    const wrapper = document.createElement('div');
    wrapper.style.display = 'flex';
    wrapper.style.justifyContent = 'space-between';
    wrapper.style.alignItems = 'center';
    wrapper.style.padding = '8px 0';
    wrapper.style.borderBottom = '1px solid rgba(255,255,255,0.1)';

    const info = document.createElement('div');
    info.style.display = 'flex';
    info.style.flexDirection = 'column';
    info.style.gap = '4px';

    const title = document.createElement('div');
    title.textContent = `${formatIcon(item)} ${item.name}`;
    title.style.fontWeight = '600';

    const meta = document.createElement('div');
    meta.className = 'small-text';
    const timestamp = item.timestamp ? new Date(item.timestamp).toLocaleString() : '';
    meta.textContent = `IP: ${item.ip || '-'} / ${timestamp}`;

    info.appendChild(title);
    info.appendChild(meta);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn btn-secondary';
    deleteBtn.textContent = '削除';
    deleteBtn.style.marginLeft = '12px';
    deleteBtn.addEventListener('click', () => deleteNotification(item.id));

    wrapper.appendChild(info);
    wrapper.appendChild(deleteBtn);
    list.appendChild(wrapper);
  });
}

async function deleteNotification(id) {
  if (!id) return;
  if (!window.otsumamiWs || window.otsumamiWs.readyState !== WebSocket.OPEN) {
    showError('WebSocketに接続されていません');
    return;
  }

  window.otsumamiWs.send(JSON.stringify({
    type: 'ohinerimaki-delete',
    id
  }));
}

function validateName(name) {
  if (!name || name.trim().length === 0) {
    return '名前を入力してください';
  }

  let length = 0;
  for (const char of name) {
    length += /[^\x01-\x7E]/.test(char) ? 2 : 1;
  }

  if (length > 12) {
    return '名前は全角6文字（半角12文字）以内にしてください';
  }

  return null;
}

function validateAmount(amount, icon) {
  if (icon === 'gift') return null;
  const num = parseInt(amount, 10);
  if (Number.isNaN(num) || num < 1 || num > 50000) {
    return '金額は1〜50000円の範囲で入力してください';
  }
  return null;
}

function validateUrl(url) {
  if (!url || url.trim().length === 0) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return 'http/https のURLを入力してください';
    }
    return null;
  } catch (error) {
    return '正しいURLを入力してください';
  }
}

function validateEmail(email) {
  if (!email || email.trim().length === 0) return null;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return '正しいメールアドレスを入力してください';
  }
  return null;
}

function sanitizeUrl(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }
    return parsed.href;
  } catch (error) {
    return null;
  }
}

function getSafeQrImageSrc(value) {
  if (!value || typeof value !== 'string') return null;
  if (value.startsWith('data:image/')) return value;
  try {
    const parsed = new URL(value, window.location.origin);
    if (parsed.origin !== window.location.origin) return null;
    if (!parsed.pathname.startsWith('/images/')) return null;
    return parsed.href;
  } catch (error) {
    return null;
  }
}

function formatIcon(item) {
  if (item.icon === 'money') {
    return `💰${item.amount ? `${item.amount}円` : ''}`;
  }
  return '🎁';
}

function updateHostOnlyUI() {
  const role = window.state?.role || window.otsumamiRole || 'viewer';
  const hostOnlySections = document.querySelectorAll('.host-only-ui');
  const viewerOnlySections = document.querySelectorAll('.viewer-only-ui');

  hostOnlySections.forEach(section => {
    section.style.display = role === 'host' ? '' : 'none';
  });
  viewerOnlySections.forEach(section => {
    section.style.display = role === 'host' ? 'none' : '';
  });

  renderNotificationList();
}

function handleQrUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    showError('画像ファイルを選択してください');
    return;
  }

  const maxSize = 500 * 1024;
  if (file.size > maxSize) {
    showError('ファイルサイズは500KB以下にしてください');
    return;
  }

  fileToBase64(file)
    .then((base64) => {
      const qrInput = document.getElementById('ohinerimakiQrInput');
      if (qrInput) {
        qrInput.dataset.imageData = base64;
        updateQrPreview(base64);
      }
    })
    .catch((error) => {
      console.error('[OhinerimakiTab] QR画像変換失敗:', error);
      showError('画像の読み込みに失敗しました');
    })
    .finally(() => {
      event.target.value = '';
    });
}

function updateQrPreview(imageSrc) {
  const preview = document.getElementById('ohinerimakiQrPreview');
  if (!preview) return;
  preview.innerHTML = '';

  const safeSrc = getSafeQrImageSrc(imageSrc);
  if (!safeSrc) return;

  const img = document.createElement('img');
  img.src = safeSrc;
  img.alt = 'QRコードプレビュー';
  img.style.maxWidth = '240px';
  img.style.width = '100%';
  img.style.borderRadius = '8px';
  img.style.border = '1px solid rgba(0,0,0,0.1)';
  preview.appendChild(img);
}

function showError(message) {
  if (window.showToast) {
    window.showToast(message, 'error');
  } else {
    alert(message);
  }
}

function setupCooldownState() {
  const lastSent = parseInt(localStorage.getItem(LOCAL_STORAGE_KEY) || '0', 10);
  if (!Number.isNaN(lastSent) && Date.now() - lastSent < COOLDOWN_MS) {
    startCooldown(lastSent);
  } else {
    updateCooldownUI(0);
  }
}

function startCooldown(forcedTimestamp = null) {
  const timestamp = forcedTimestamp ?? Date.now();
  localStorage.setItem(LOCAL_STORAGE_KEY, String(timestamp));
  updateCooldownUI(COOLDOWN_MS - (Date.now() - timestamp));

  if (cooldownTimer) {
    clearInterval(cooldownTimer);
  }

  cooldownTimer = setInterval(() => {
    const remaining = COOLDOWN_MS - (Date.now() - timestamp);
    updateCooldownUI(remaining);
    if (remaining <= 0) {
      clearInterval(cooldownTimer);
      cooldownTimer = null;
      localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
  }, 1000);
}

function updateCooldownUI(remainingMs) {
  const button = document.getElementById('sendOhinerimakiBellBtn');
  const label = document.getElementById('ohinerimakiCooldown');
  if (!button || !label) return;

  if (remainingMs > 0) {
    const seconds = Math.ceil(remainingMs / 1000);
    button.disabled = true;
    label.textContent = `次回送信可能まで ${seconds}秒`;
  } else {
    button.disabled = false;
    label.textContent = '';
  }
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
