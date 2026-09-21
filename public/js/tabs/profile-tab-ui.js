// js/tabs/profile-tab-ui.js
// プロフィールタブのUI描画ユーティリティ

function sanitizeUrl(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url, window.location.origin);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }
    return parsed.href;
  } catch (error) {
    return null;
  }
}

function generateItemId() {
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function applySkin(skin) {
  const container = document.querySelector('#tab-profile .profile-container');
  if (!container) return;

  const skinName = skin || 'basic';
  container.dataset.skin = skinName;

  const existingSkinCSS = document.querySelectorAll('link[data-profile-skin]');
  existingSkinCSS.forEach(link => link.remove());

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `/css/profile-skins/${skinName}.css`;
  link.setAttribute('data-profile-skin', skinName);
  document.head.appendChild(link);

  console.log(`[ProfileTab] スキン適用: ${skinName}`);
}

export function displayProfilePhoto(photoData) {
  const frame = document.getElementById('profilePhotoFrame');
  if (!frame) return;

  const isAllowedPhotoSrc = (value) => {
    if (!value || typeof value !== 'string') return false;
    if (value.startsWith('data:image/')) return true;
    try {
      const parsed = new URL(value, window.location.origin);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch (error) {
      return false;
    }
  };

  if (photoData) {
    frame.innerHTML = '';
    if (!isAllowedPhotoSrc(photoData)) {
      return;
    }
    const img = document.createElement('img');
    img.src = photoData;
    img.alt = 'プロフィール画像';
    frame.appendChild(img);
  } else {
    frame.innerHTML = `
      <div class="photo-placeholder">
        <div class="photo-icon">🖼️</div>
        <div>画像</div>
      </div>
    `;
  }
}

export function renderLinks({ links, isHost, iconMap, maxLinks, onDeleteLink, onOpenLinkModal }) {
  const linksGrid = document.getElementById('profileLinksGrid');
  if (!linksGrid) {
    console.warn('[ProfileTab] profileLinksGrid が見つかりません');
    return;
  }

  linksGrid.innerHTML = '';

  const items = Array.isArray(links) ? links : [];
  items.forEach((link, index) => {
    const safeUrl = sanitizeUrl(link?.url);
    if (!safeUrl) {
      return;
    }

    const iconClass = iconMap[link?.icon] || iconMap.link;
    const linkItem = document.createElement('a');
    linkItem.className = 'link-item';
    linkItem.href = safeUrl;
    linkItem.target = '_blank';
    linkItem.rel = 'noopener noreferrer';
    linkItem.dataset.icon = link?.icon || 'link';

    if (isHost) {
      const deleteBtn = document.createElement('div');
      deleteBtn.className = 'delete-btn';
      deleteBtn.dataset.index = String(index);
      deleteBtn.textContent = '×';
      deleteBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        onDeleteLink(index);
      });
      linkItem.appendChild(deleteBtn);
    }

    const iconCircle = document.createElement('div');
    iconCircle.className = 'link-icon-circle';
    const iconEl = document.createElement('i');
    iconEl.className = iconClass;
    iconCircle.appendChild(iconEl);

    const label = document.createElement('div');
    label.className = 'link-label';
    label.textContent = link?.label || '';

    linkItem.appendChild(iconCircle);
    linkItem.appendChild(label);
    linksGrid.appendChild(linkItem);
  });

  if (isHost && items.length < maxLinks) {
    const addBtn = document.createElement('div');
    addBtn.className = 'add-link-btn';
    addBtn.id = 'addLinkBtn';
    addBtn.textContent = '+';
    addBtn.addEventListener('click', onOpenLinkModal);
    linksGrid.appendChild(addBtn);
  }
}

export function renderFreeFormItems({ items, isHost, onRemoveItem }) {
  const container = document.getElementById('profileFreeFormItems');
  if (!container) return;

  const safeItems = Array.isArray(items) ? items : [];

  container.innerHTML = '';

  safeItems.forEach(item => {
    const freeFormItem = document.createElement('div');
    freeFormItem.className = 'free-form-item';
    freeFormItem.dataset.itemId = item.id || '';

    const header = document.createElement('div');
    header.className = 'free-form-header';

    if (isHost) {
      const titleInput = document.createElement('input');
      titleInput.type = 'text';
      titleInput.className = 'free-form-title-input';
      titleInput.value = item.title || '';
      titleInput.placeholder = 'タイトル';
      titleInput.dataset.field = 'title';
      titleInput.dataset.itemId = item.id || '';
      header.appendChild(titleInput);

      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'free-form-delete-btn';
      deleteBtn.type = 'button';
      deleteBtn.textContent = '削除';
      deleteBtn.addEventListener('click', () => {
        onRemoveItem(item.id);
      });
      header.appendChild(deleteBtn);
    } else {
      const title = document.createElement('div');
      title.className = 'free-form-title';
      title.textContent = item.title || '';
      header.appendChild(title);
    }

    const body = document.createElement('div');
    body.className = 'free-form-body';

    if (isHost) {
      const textarea = document.createElement('textarea');
      textarea.className = 'free-form-textarea';
      textarea.value = item.content || '';
      textarea.placeholder = '自由に記入してください';
      textarea.dataset.field = 'content';
      textarea.dataset.itemId = item.id || '';
      body.appendChild(textarea);
    } else {
      const display = document.createElement('div');
      display.className = 'free-form-display';
      display.textContent = item.content || '（未入力）';
      body.appendChild(display);
    }

    freeFormItem.appendChild(header);
    freeFormItem.appendChild(body);
    container.appendChild(freeFormItem);
  });
}

export function collectFreeFormItemsFromUI() {
  const container = document.getElementById('profileFreeFormItems');
  if (!container) return [];

  const items = [];
  container.querySelectorAll('.free-form-item').forEach(itemEl => {
    const itemId = itemEl.dataset.itemId || generateItemId();
    const titleInput = itemEl.querySelector('.free-form-title-input');
    const textarea = itemEl.querySelector('.free-form-textarea');
    const content = textarea?.value || '';
    const title = titleInput?.value?.trim() || '';

    items.push({
      id: itemId,
      title,
      content
    });
  });

  return items;
}

export function applyFeatureToggles(features) {
  const featureMap = {
    otsumami: 'toggleOtsumami',
    stamps: 'toggleStamps',
    ohinerimaki: 'toggleOhinerimaki',
    vcast: 'toggleVcast'
  };

  Object.entries(featureMap).forEach(([key, id]) => {
    const toggle = document.getElementById(id);
    if (!toggle) return;

    if (features[key]) {
      toggle.classList.add('active');
    } else {
      toggle.classList.remove('active');
    }
  });
}

export function updateIndicatorStates(features) {
  if (!window.electronAPI || typeof window.electronAPI.featureToggled !== 'function') {
    return;
  }

  window.electronAPI.featureToggled('otsumami', features.otsumami);
  window.electronAPI.featureToggled('stamp', features.stamps);
  window.electronAPI.featureToggled('ohinerimaki', features.ohinerimaki);
}

function updateTabState(tabId, enabled) {
  const tab = document.getElementById(tabId);
  if (!tab) return;

  if (enabled) {
    tab.disabled = false;
    tab.style.opacity = '1';
  } else {
    tab.disabled = true;
    tab.style.opacity = '0.3';
  }
}

export function updateTabStates(features) {
  updateTabState('otsumamiTab', features.otsumami);
  updateTabState('stampsTab', features.stamps);
  updateTabState('ohinerimakiTab', features.ohinerimaki);
  updateTabState('vcastTab', features.vcast);
  updateIndicatorStates(features);
}

export function createFreeFormItemId() {
  return generateItemId();
}
