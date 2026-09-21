// js/tabs/profile-tab-init.js
// プロフィールタブ専用の初期化処理

import { CONFIG } from '../constants.js';
import {
  applyFeatureToggles,
  applySkin,
  collectFreeFormItemsFromUI,
  createFreeFormItemId,
  displayProfilePhoto,
  renderFreeFormItems,
  renderLinks,
  updateIndicatorStates,
  updateTabStates
} from './profile-tab-ui.js';

// アイコンマッピング
const ICON_MAP = {
  twitter: 'fa-brands fa-x-twitter',
  youtube: 'fa-brands fa-youtube',
  twitch: 'fa-brands fa-twitch',
  discord: 'fa-brands fa-discord',
  wiki: 'fa-solid fa-book',
  link: 'fa-solid fa-link',
  web: 'fa-solid fa-globe',
  mail: 'fa-solid fa-envelope'
};

const MAX_LINKS = 5;
const EXTRA_ITEM_TYPES = {
  free: { label: 'フリーフォーム', placeholder: '自由に記入してください' }
};

let currentProfileConfig = null;
let cachedInviteLink = '';
let cachedBanList = [];

/**
 * プロフィールタブの初期化
 */
export async function initProfileTab() {
  console.log('[ProfileTab] 初期化開始');
  
  // DOMが準備できるまで少し待つ
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // ホスト/リスナーモードを設定
  updateRoleUI();
  
  // イベントリスナーを設定
  setupEventListeners();
  
  // プロフィール設定を読み込み
  await loadProfileConfig();

  // 招待リンクを初期化
  await updateInviteLink();

  await loadBanList();
  
  // WebSocketメッセージハンドラを登録
  registerWebSocketHandlers();

  window.addEventListener('hostingStateChanged', async (event) => {
    const hosting = event?.detail?.hosting;
    if (hosting) {
      await loadProfileConfig();
      if (currentProfileConfig?.features) {
        updateTabStates(currentProfileConfig.features);
        setTimeout(() => {
          if (currentProfileConfig?.features) {
            updateIndicatorStates(currentProfileConfig.features);
          }
        }, 500);
      }
      return;
    }

    updateIndicatorStates({
      otsumami: false,
      stamps: false,
      ohinerimaki: false,
      vcast: false
    });
  });
  
  // 役割変更時の再描画
  window.addEventListener('otsumamiRoleChanged', () => {
    updateRoleUI();
    loadProfileConfig();
  });
  
  console.log('[ProfileTab] 初期化完了');
}

/**
 * ホスト/リスナーモードのUI更新
 */
function updateRoleUI() {
  const role = window.state?.role || window.otsumamiRole || 'viewer';
  const tabProfile = document.getElementById('tab-profile');
  
  if (!tabProfile) return;
  
  // クラスを切り替え
  tabProfile.classList.remove('host-mode', 'viewer-mode');
  tabProfile.classList.add(role === 'host' ? 'host-mode' : 'viewer-mode');
  
  // リスナーの場合は接続状態も管理
  if (role === 'viewer') {
    const isConnected = window.otsumamiWs && window.otsumamiWs.readyState === WebSocket.OPEN;
    if (isConnected) {
      tabProfile.classList.add('viewer-connected');
      tabProfile.classList.remove('viewer-disconnected');
    } else {
      tabProfile.classList.add('viewer-disconnected');
      tabProfile.classList.remove('viewer-connected');
    }
  }
  
  // 入力欄の readonly 状態を更新
  const isHost = (role === 'host');
  const inputs = tabProfile.querySelectorAll('input, textarea');
  
  inputs.forEach(input => {
    if (isHost) {
      input.removeAttribute('readonly');
      input.classList.remove('readonly');
    } else {
      input.setAttribute('readonly', 'readonly');
      input.classList.add('readonly');
    }
  });

  updateInviteLink();
  loadBanList();

  if (currentProfileConfig?.profile?.freeFormItems) {
    renderFreeFormItems({
      items: currentProfileConfig.profile.freeFormItems,
      isHost: role === 'host',
      onRemoveItem: removeFreeFormItem
    });
  }

  if (role === 'host' && currentProfileConfig?.features) {
    updateIndicatorStates(currentProfileConfig.features);
  }
  
  console.log('[ProfileTab] Role UI updated:', role);
}

/**
 * プロフィール設定を読み込む
 */
async function loadProfileConfig() {
  const role = window.state?.role || window.otsumamiRole || 'viewer';
  
  // リスナーの場合は、WebSocket接続がない限り読み込まない
  if (role === 'viewer') {
    const isConnected = window.otsumamiWs && window.otsumamiWs.readyState === WebSocket.OPEN;
    if (!isConnected) {
      console.log('[ProfileTab] リスナー: 未接続のため読み込みスキップ');
      return;
    }

    // リスナーは接続先ホストへ同期要求（ローカルAPIは参照しない）
    window.otsumamiWs.send(JSON.stringify({ type: 'request-profile-config' }));
    return;
  }
  
  try {
    const response = await fetch('/api/profile-config');
    const data = await response.json();
    
    if (data.success && data.config) {
      applyProfileConfig(data.config);
      console.log('[ProfileTab] 設定を読み込みまし');
      
      // ★ 読み込み成功後にUI状態を更新
      updateRoleUI();
    }
  } catch (error) {
    console.error('[ProfileTab] 設定読み込み失敗:', error);
    
    // リスナーの場合はエラーを表示しない（接続前の可能性が高い）
    if (role === 'host') {
      console.error('[ProfileTab] ホスト: 設定読み込みに失敗しました');
    }
  }
}

/**
 * プロフィール設定をUIに適用
 */
function applyProfileConfig(config) {
  currentProfileConfig = config;
  const role = window.state?.role || window.otsumamiRole || 'viewer';
  // プロフィール情報
  if (config.profile) {
    const nameInput = document.getElementById('profileName');
    const furiganaInput = document.getElementById('profileFurigana');
    const nicknameInput = document.getElementById('profileNickname');
    const favoriteInput = document.getElementById('profileFavorite');
    const locationInput = document.getElementById('profileLocation');
    const startYearInput = document.getElementById('profileStartYear');
    const activeTimeInput = document.getElementById('profileActiveTime');
    const skinSelect = document.getElementById('profileSkinSelect');
    
    if (nameInput) nameInput.value = config.profile.name || '';
    if (furiganaInput) furiganaInput.value = config.profile.furigana || '';
    if (nicknameInput) nicknameInput.value = config.profile.nickname || '';
    if (favoriteInput) favoriteInput.value = config.profile.favorite || '';
    if (locationInput) locationInput.value = config.profile.location || '';
    if (startYearInput) startYearInput.value = config.profile.startYear || '';
    if (activeTimeInput) activeTimeInput.value = config.profile.activeTime || '';
    if (skinSelect) skinSelect.value = config.profile.skin || 'basic';
    applySkin(config.profile.skin || 'basic');
    
    // 画像を表示
    if (config.profile.photo) {
      displayProfilePhoto(config.profile.photo);
    }
    
    // SNSリンクを描画
    if (config.profile.links) {
      renderLinks({
        links: config.profile.links,
        isHost: role === 'host',
        iconMap: ICON_MAP,
        maxLinks: MAX_LINKS,
        onDeleteLink: deleteLink,
        onOpenLinkModal: openLinkModal
      });
    }

    // フリーフォーム項目を描画
    renderFreeFormItems({
      items: config.profile.freeFormItems || [],
      isHost: role === 'host',
      onRemoveItem: removeFreeFormItem
    });
  }
  
  // 機能設定
  if (config.features) {
    applyFeatureToggles(config.features);
    updateTabStates(config.features);
  }
  
  // リスナーの場合は接続済みクラスを追加
  if (role === 'viewer') {
    const tabProfile = document.getElementById('tab-profile');
    if (tabProfile) {
      tabProfile.classList.add('viewer-connected');
      tabProfile.classList.remove('viewer-disconnected');
    }
  }
}

function resolveRemoteProfileConfig(config) {
  if (!config || typeof config !== 'object') return config;
  const wsUrl = window.otsumamiWs?.url;
  if (!wsUrl) return config;

  try {
    const wsEndpoint = new URL(wsUrl);
    const protocol = wsEndpoint.protocol === 'wss:' ? 'https:' : 'http:';
    const origin = `${protocol}//${wsEndpoint.host}`;
    const resolved = JSON.parse(JSON.stringify(config));

    const photo = resolved?.profile?.photo;
    if (typeof photo === 'string' && photo.startsWith('/')) {
      resolved.profile.photo = new URL(photo, origin).toString();
    }

    return resolved;
  } catch (error) {
    return config;
  }
}

function addFreeFormItem() {
  if (!currentProfileConfig) {
    currentProfileConfig = { profile: {}, features: {} };
  }
  if (!currentProfileConfig.profile) {
    currentProfileConfig.profile = {};
  }
  if (!Array.isArray(currentProfileConfig.profile.freeFormItems)) {
    currentProfileConfig.profile.freeFormItems = [];
  }

  currentProfileConfig.profile.freeFormItems = collectFreeFormItemsFromUI();

  const newItem = {
    id: createFreeFormItemId(),
    title: '',
    content: ''
  };
  currentProfileConfig.profile.freeFormItems.push(newItem);
  renderFreeFormItems({
    items: currentProfileConfig.profile.freeFormItems,
    isHost: true,
    onRemoveItem: removeFreeFormItem
  });
}

function removeFreeFormItem(itemId) {
  if (!currentProfileConfig?.profile?.freeFormItems) return;
  currentProfileConfig.profile.freeFormItems = currentProfileConfig.profile.freeFormItems.filter(item => item.id !== itemId);
  renderFreeFormItems({
    items: currentProfileConfig.profile.freeFormItems,
    isHost: true,
    onRemoveItem: removeFreeFormItem
  });
}

async function updateInviteLink() {
  const input = document.getElementById('inviteLinkInput');
  if (!input) return;

  const role = window.state?.role || window.otsumamiRole || 'viewer';
  if (role !== 'host') return;

  const port = location.port || CONFIG.WS_PORT || '7244';
  let host = location.hostname;

  try {
    const response = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' });
    if (response.ok) {
      const data = await response.json();
      if (data?.ip) {
        host = data.ip;
      }
    }
  } catch (error) {
    console.warn('[ProfileTab] グローバルIP取得に失敗:', error);
  }

  cachedInviteLink = `http://${host}:${port}`;
  input.value = cachedInviteLink;
}

async function loadBanList() {
  const role = window.state?.role || window.otsumamiRole || 'viewer';
  if (role !== 'host') return;

  try {
    const response = await fetch('/api/profile-config/ban-list');
    const data = await response.json();
    if (data.success && Array.isArray(data.bannedIps)) {
      cachedBanList = data.bannedIps;
      renderBanList();
    }
  } catch (error) {
    console.error('[ProfileTab] BANリスト取得失敗:', error);
  }
}

function renderBanList() {
  const list = document.getElementById('banList');
  if (!list) return;

  list.innerHTML = '';

  if (!cachedBanList.length) {
    const empty = document.createElement('div');
    empty.className = 'ban-empty';
    empty.textContent = 'BAN対象はありません';
    list.appendChild(empty);
    return;
  }

  cachedBanList.forEach((ip) => {
    const item = document.createElement('div');
    item.className = 'ban-item';

    const label = document.createElement('span');
    label.className = 'ban-ip';
    label.textContent = ip;

    const removeBtn = document.createElement('button');
    removeBtn.className = 'ban-remove-btn';
    removeBtn.textContent = '解除';
    removeBtn.addEventListener('click', () => removeBanIp(ip));

    item.appendChild(label);
    item.appendChild(removeBtn);
    list.appendChild(item);
  });
}

async function addBanIp() {
  const role = window.state?.role || window.otsumamiRole || 'viewer';
  if (role !== 'host') return;

  const input = document.getElementById('banIpInput');
  if (!input) return;

  const ip = input.value.trim();
  if (!ip) return;

  try {
    const response = await fetch('/api/profile-config/ban-list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip })
    });
    const data = await response.json();
    if (data.success && Array.isArray(data.bannedIps)) {
      cachedBanList = data.bannedIps;
      renderBanList();
      input.value = '';
      if (window.showToast) {
        window.showToast('BANリストに追加しました', 'success');
      }
    } else if (window.showToast) {
      window.showToast(data.message || 'BANリストの更新に失敗しました', 'error');
    }
  } catch (error) {
    console.error('[ProfileTab] BAN追加失敗:', error);
    if (window.showToast) {
      window.showToast('BANリストの更新に失敗しました', 'error');
    }
  }
}

async function removeBanIp(ip) {
  const role = window.state?.role || window.otsumamiRole || 'viewer';
  if (role !== 'host') return;

  try {
    const response = await fetch(`/api/profile-config/ban-list/${encodeURIComponent(ip)}`, {
      method: 'DELETE'
    });
    const data = await response.json();
    if (data.success && Array.isArray(data.bannedIps)) {
      cachedBanList = data.bannedIps;
      renderBanList();
      if (window.showToast) {
        window.showToast('BANを解除しました', 'success');
      }
    } else if (window.showToast) {
      window.showToast(data.message || 'BAN解除に失敗しました', 'error');
    }
  } catch (error) {
    console.error('[ProfileTab] BAN解除失敗:', error);
    if (window.showToast) {
      window.showToast('BAN解除に失敗しました', 'error');
    }
  }
}

/**
 * リンクを削除
 */
async function deleteLink(index) {
  try {
    // 現在の設定を取得
    const response = await fetch('/api/profile-config');
    const data = await response.json();
    
    if (!data.success || !data.config) {
      throw new Error('設定の取得に失敗しました');
    }
    
    // リンクを削除
    const links = data.config.profile.links || [];
    links.splice(index, 1);
    
    // 保存
    const config = {
      ...data.config,
      profile: {
        ...data.config.profile,
        links: links
      }
    };
    
    const saveResponse = await fetch('/api/profile-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    
    const saveData = await saveResponse.json();
    
    if (saveData.success) {
      // UI更新
      renderLinks({
        links,
        isHost: true,
        iconMap: ICON_MAP,
        maxLinks: MAX_LINKS,
        onDeleteLink: deleteLink,
        onOpenLinkModal: openLinkModal
      });
      
      // WebSocket通知
      broadcastProfileUpdate(config);
      
      if (window.showToast) {
        window.showToast('リンクを削除しました', 'success');
      }
    }
  } catch (error) {
    console.error('[ProfileTab] リンク削除失敗:', error);
    if (window.showToast) {
      window.showToast('削除に失敗しました', 'error');
    }
  }
}

/**
 * リンク追加モーダルを開く
 */
function openLinkModal() {
  const modal = document.getElementById('linkModal');
  if (!modal) return;
  
  // フォームをリセット
  document.getElementById('linkUrlInput').value = '';
  document.getElementById('linkLabelInput').value = '';
  
  // アイコン選択をリセット
  const iconOptions = document.querySelectorAll('.link-modal-icon-option');
  iconOptions.forEach(option => option.classList.remove('selected'));
  
  // 最初のアイコンを選択
  if (iconOptions[0]) {
    iconOptions[0].classList.add('selected');
  }
  
  modal.classList.add('active');
}

/**
 * リンク追加モーダルを閉じる
 */
function closeLinkModal() {
  const modal = document.getElementById('linkModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

/**
 * リンクを保存
 */
async function saveLinkFromModal() {
  const url = document.getElementById('linkUrlInput').value.trim();
  const label = document.getElementById('linkLabelInput').value.trim();
  const selectedIcon = document.querySelector('.link-modal-icon-option.selected');
  
  // バリデーション
  if (!url) {
    alert('URLを入力してください');
    return;
  }
  
  if (!label) {
    alert('表示名を入力してください');
    return;
  }
  
  if (!selectedIcon) {
    alert('アイコンを選択してください');
    return;
  }
  
  const icon = selectedIcon.dataset.icon;
  
  try {
    // 現在の設定を取得
    const response = await fetch('/api/profile-config');
    const data = await response.json();
    
    if (!data.success || !data.config) {
      throw new Error('設定の取得に失敗しました');
    }
    
    // リンクを追加
    const links = data.config.profile.links || [];
    
    if (links.length >= MAX_LINKS) {
      alert(`リンクは最大${MAX_LINKS}個までです`);
      return;
    }
    
    links.push({ url, icon, label });
    
    // 保存
    const config = {
      ...data.config,
      profile: {
        ...data.config.profile,
        links: links
      }
    };
    
    const saveResponse = await fetch('/api/profile-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    
    const saveData = await saveResponse.json();
    
    if (saveData.success) {
      // UI更新
      renderLinks({
        links,
        isHost: true,
        iconMap: ICON_MAP,
        maxLinks: MAX_LINKS,
        onDeleteLink: deleteLink,
        onOpenLinkModal: openLinkModal
      });
      
      // WebSocket通知
      broadcastProfileUpdate(config);
      
      // モーダルを閉じる
      closeLinkModal();
      
      if (window.showToast) {
        window.showToast('リンクを追加しました', 'success');
      }
    }
  } catch (error) {
    console.error('[ProfileTab] リンク追加失敗:', error);
    if (window.showToast) {
      window.showToast('追加に失敗しました', 'error');
    }
  }
}

/**
 * 機能トグルを適用
 */
/**
 * 画像アップロード処理
 */
async function handlePhotoUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  // 画像ファイルかチェック
  if (!file.type.startsWith('image/')) {
    if (window.showToast) {
      window.showToast('画像ファイルを選択してください', 'error');
    }
    return;
  }
  
  // ファイルサイズチェック（500KB以下）
  const maxSize = 500 * 1024;
  if (file.size > maxSize) {
    if (window.showToast) {
      window.showToast('ファイルサイズは500KB以下にしてください', 'error');
    }
    return;
  }
  
  try {
    // Base64に変換
    const base64 = await fileToBase64(file);
    
    // 現在の設定を取得
    const response = await fetch('/api/profile-config');
    const data = await response.json();
    
    if (!data.success || !data.config) {
      throw new Error('設定の取得に失敗しました');
    }
    
    // 画像を保存
    const config = {
      ...data.config,
      profile: {
        ...data.config.profile,
        photo: base64
      }
    };
    
    const saveResponse = await fetch('/api/profile-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    
    const saveData = await saveResponse.json();
    
    if (saveData.success) {
      const updatedConfig = saveData.config || config;
      const updatedPhoto = updatedConfig.profile?.photo || '';

      // UI更新
      displayProfilePhoto(updatedPhoto);
      
      // WebSocket通知
      broadcastProfileUpdate(updatedConfig);
      
      if (window.showToast) {
        window.showToast('画像を保存しました', 'success');
      }
    }
  } catch (error) {
    console.error('[ProfileTab] 画像アップロード失敗:', error);
    if (window.showToast) {
      window.showToast('画像の保存に失敗しました', 'error');
    }
  }
  
  // ファイル入力をリセット
  event.target.value = '';
}

/**
 * ファイルをBase64に変換
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * イベントリスナーを設定
 */
function setupEventListeners() {
  // 保存ボタン
  const saveBtn = document.getElementById('saveProfileBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', saveProfile);
  }

  const skinSelect = document.getElementById('profileSkinSelect');
  if (skinSelect) {
    skinSelect.addEventListener('change', () => {
      applySkin(skinSelect.value);
    });
  }
  
  // 機能トグル（ホストのみ）
  const toggles = document.querySelectorAll('.toggle-switch');
  toggles.forEach(toggle => {
    toggle.addEventListener('click', () => {
      const role = window.state?.role || window.otsumamiRole || 'viewer';
      if (role !== 'host') return; // リスナーは操作不可
      
      toggle.classList.toggle('active');
    });
  });
  
  // 画像クリック（ホストのみ）
  const photoFrame = document.getElementById('profilePhotoFrame');
  const photoInput = document.getElementById('profilePhotoInput');
  
  if (photoFrame && photoInput) {
    photoFrame.addEventListener('click', () => {
      const role = window.state?.role || window.otsumamiRole || 'viewer';
      if (role !== 'host') return; // リスナーは操作不可
      
      photoInput.click();
    });
    
    photoInput.addEventListener('change', handlePhotoUpload);
  }
  
  // モーダル関連
  const modal = document.getElementById('linkModal');
  const cancelBtn = document.getElementById('linkModalCancelBtn');
  const saveModalBtn = document.getElementById('linkModalSaveBtn');
  
  if (cancelBtn) {
    cancelBtn.addEventListener('click', closeLinkModal);
  }
  
  if (saveModalBtn) {
    saveModalBtn.addEventListener('click', saveLinkFromModal);
  }
  
  // モーダル外クリックで閉じる
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeLinkModal();
      }
    });
  }
  
  // アイコン選択
  const iconOptions = document.querySelectorAll('.link-modal-icon-option');
  iconOptions.forEach(option => {
    option.addEventListener('click', () => {
      iconOptions.forEach(opt => opt.classList.remove('selected'));
      option.classList.add('selected');
    });
  });

  const addFreeFormBtn = document.getElementById('addFreeFormBtn');
  if (addFreeFormBtn) {
    addFreeFormBtn.addEventListener('click', () => {
      const role = window.state?.role || window.otsumamiRole || 'viewer';
      if (role !== 'host') return;
      addFreeFormItem();
    });
  }

  const inviteCopyBtn = document.getElementById('inviteLinkCopyBtn');
  if (inviteCopyBtn) {
    inviteCopyBtn.addEventListener('click', async () => {
      await updateInviteLink();
      if (!cachedInviteLink) return;
      try {
        await navigator.clipboard.writeText(cachedInviteLink);
        if (window.showToast) {
          window.showToast('招待リンクをコピーしました', 'success');
        }
      } catch (error) {
        if (window.showToast) {
          window.showToast('コピーに失敗しました', 'error');
        }
      }
    });
  }

  const banAddBtn = document.getElementById('banIpAddBtn');
  if (banAddBtn) {
    banAddBtn.addEventListener('click', addBanIp);
  }

  const banInput = document.getElementById('banIpInput');
  if (banInput) {
    banInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        addBanIp();
      }
    });
  }
}

/**
 * プロフィールを保存
 */
async function saveProfile() {
  const role = window.state?.role || window.otsumamiRole || 'viewer';
  if (role !== 'host') {
    if (window.showToast) {
      window.showToast('ホストのみ保存できます', 'error');
    }
    return;
  }
  
  // 現在の設定を取得（リンク情報と画像を保持するため）
  let currentLinks = [];
  let currentPhoto = '';
  try {
    const response = await fetch('/api/profile-config');
    const data = await response.json();
    if (data.success && data.config && data.config.profile) {
      currentLinks = data.config.profile.links || [];
      currentPhoto = data.config.profile.photo || '';
    }
  } catch (error) {
    console.warn('[ProfileTab] 既存設定の取得に失敗:', error);
  }
  
  // 設定を収集
  const config = {
    profile: {
      name: document.getElementById('profileName')?.value?.trim() || '',
      furigana: document.getElementById('profileFurigana')?.value?.trim() || '',
      nickname: document.getElementById('profileNickname')?.value?.trim() || '',
      favorite: document.getElementById('profileFavorite')?.value?.trim() || '',
      location: document.getElementById('profileLocation')?.value?.trim() || '',
      startYear: document.getElementById('profileStartYear')?.value?.trim() || '',
      activeTime: document.getElementById('profileActiveTime')?.value?.trim() || '',
      skin: document.getElementById('profileSkinSelect')?.value || 'basic',
      freeFormItems: collectFreeFormItemsFromUI(),
      links: currentLinks, // 既存のリンクを保持
      photo: currentPhoto // 既存の画像を保持
    },
    features: {
      otsumami: document.getElementById('toggleOtsumami')?.classList.contains('active') ?? true,
      stamps: document.getElementById('toggleStamps')?.classList.contains('active') ?? true,
      ohinerimaki: document.getElementById('toggleOhinerimaki')?.classList.contains('active') ?? false,
      vcast: document.getElementById('toggleVcast')?.classList.contains('active') ?? false
    }
  };
  
  try {
    // サーバーに保存
    const response = await fetch('/api/profile-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    
    const data = await response.json();
    
    if (data.success) {
      // トースト通知
      if (window.showToast) {
        window.showToast('プロフィールを保存しました', 'success');
      } else {
        alert('プロフィールを保存しました');
      }
      
      // WebSocket経由で全クライアントに通知
      const updatedConfig = data.config || config;
      broadcastProfileUpdate(updatedConfig);
      
      // タブの有効/無効を更新
      updateTabStates(updatedConfig.features);
      
      console.log('[ProfileTab] 保存完了:', updatedConfig);
    } else {
      throw new Error(data.message || '保存に失敗しました');
    }
  } catch (error) {
    console.error('[ProfileTab] 保存失敗:', error);
    if (window.showToast) {
      window.showToast('保存に失敗しました', 'error');
    } else {
      alert('保存に失敗しました: ' + error.message);
    }
  }
}

/**
 * プロフィール更新をブロードキャスト
 */
function broadcastProfileUpdate(config) {
  if (window.otsumamiWs && window.otsumamiWs.readyState === WebSocket.OPEN) {
    window.otsumamiWs.send(JSON.stringify({
      type: 'profile-config-updated',
      config: config
    }));
    console.log('[ProfileTab] プロフィール更新をブロードキャスト');
  }
}

/**
 * タブの有効/無効を更新
 */
/**
 * WebSocketメッセージハンドラを登録
 */
function registerWebSocketHandlers() {
  console.log('[ProfileTab] WebSocketハンドラを登録開始');
  
  // 既にハンドラが登録されている場合はスキップ
  if (window.profileTabMessageHandler) {
    console.log('[ProfileTab] ハンドラは既に登録済み');
    return;
  }
  
  const handleProfileWsData = (data) => {
    if (!data || typeof data !== 'object') return;

    // 接続完了時（リスナー側）
    if (
      (data.type === 'joined' && data.role === 'viewer') ||
      (data.type === 'registered' && (window.state?.role || window.otsumamiRole || 'viewer') === 'viewer')
    ) {
      console.log('[ProfileTab] リスナーとして接続完了 - プロフィールを読み込み');

      // ★ UI状態を更新
      updateRoleUI();

      // 少し待ってからプロフィールを読み込む
      setTimeout(() => {
        loadProfileConfig();
      }, 500);
    }

    // プロフィール更新
    if (data.type === 'profile-config-updated') {
      console.log('[ProfileTab] プロフィール更新を受信');
      if (data.config) {
        const role = window.state?.role || window.otsumamiRole || 'viewer';
        const config = role === 'viewer' ? resolveRemoteProfileConfig(data.config) : data.config;
        applyProfileConfig(config);
        
        // タブ状態を更新
        if (data.config.features) {
          updateTabStates(data.config.features);
        }
      }
    }

    // 初期同期（接続時）
    if (data.type === 'profile-config-sync') {
      console.log('[ProfileTab] プロフィール同期を受信');
      if (data.config) {
        const role = window.state?.role || window.otsumamiRole || 'viewer';
        const config = role === 'viewer' ? resolveRemoteProfileConfig(data.config) : data.config;
        applyProfileConfig(config);
        updateRoleUI();
        if (config.features) {
          updateTabStates(config.features);
        }
      }
    }
  };

  // グローバルなメッセージハンドラ関数を定義
  window.profileTabMessageHandler = function(event) {
    try {
      const data = JSON.parse(event.data);
      handleProfileWsData(data);
    } catch (e) {
      // JSON parse エラーは無視
    }
  };

  window.profileTabEventMessageHandler = function(event) {
    handleProfileWsData(event?.detail);
  };
  window.removeEventListener('websocket-message', window.profileTabEventMessageHandler);
  window.addEventListener('websocket-message', window.profileTabEventMessageHandler);
  
  // WebSocketが接続されたらイベントリスナーを追加
  const setupWebSocketListener = () => {
    if (window.otsumamiWs && window.otsumamiWs.readyState === WebSocket.OPEN) {
      // 既存のリスナーを削除（重複防止）
      window.otsumamiWs.removeEventListener('message', window.profileTabMessageHandler);
      // 新しいリスナーを追加
      window.otsumamiWs.addEventListener('message', window.profileTabMessageHandler);
      console.log('[ProfileTab] WebSocketリスナーを追加しました');
      return true;
    }
    return false;
  };
  
  // 既に接続済みの場合は即座に設定
  if (setupWebSocketListener()) {
    window.removeEventListener('websocket-message', window.profileTabEventMessageHandler);
    window.addEventListener('websocket-message', window.profileTabEventMessageHandler);
    // ★ 接続済みの場合は即座にプロフィールを読み込む
    const role = window.state?.role || window.otsumamiRole || 'viewer';
    if (role === 'viewer') {
      // UI状態を更新
      updateRoleUI();
      
      setTimeout(() => {
        loadProfileConfig();
      }, 500);
    }
    return;
  }
  
  // まだ接続されていない場合は、接続を待つ（タイムアウトあり）
  const maxWaitMs = 60000;
  const startAt = Date.now();
  const checkInterval = setInterval(() => {
    if (setupWebSocketListener()) {
      clearInterval(checkInterval);
      window.removeEventListener('websocket-message', window.profileTabEventMessageHandler);
      window.addEventListener('websocket-message', window.profileTabEventMessageHandler);
      
      // ★ 接続成功時にリスナーならプロフィールを読み込む
      const role = window.state?.role || window.otsumamiRole || 'viewer';
      if (role === 'viewer') {
        updateRoleUI();
        setTimeout(() => {
          loadProfileConfig();
        }, 500);
      }
      return;
    }

    if (Date.now() - startAt > maxWaitMs) {
      clearInterval(checkInterval);
      console.warn('[ProfileTab] WebSocket接続待ちがタイムアウトしました');
    }
  }, 500);
}
