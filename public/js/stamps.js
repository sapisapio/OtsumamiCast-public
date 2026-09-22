import { resolveAsset } from './connection-target.js';
// js/stamps.js
// ==============================
// スタンプ一覧・送信まわり
// ==============================
let currentCategoryFilter = "";
let CATEGORY_MAP = {};
let categorySignature = null;
let editMode = false;
let role = null; // 'host' or 'viewer'
if (window.stampEditMode === undefined) {
  window.stampEditMode = false;
}

function updateCategories(categories) {
  const signature = JSON.stringify(categories);
  if (signature === categorySignature) return;
  categorySignature = signature;
  CATEGORY_MAP = Object.create(null);
  if (Array.isArray(categories)) {
    categories.forEach(c => {
      if (c && c.id && c.label) {
        CATEGORY_MAP[c.id] = c.label;
      }
    });
  }
  renderCategoryUI();
}

function renderCategoryUI() {
  renderCategoryFilterButtons();
  renderCategorySelectOptions();
  renderCategoryListForHost();
}

function renderCategoryFilterButtons() {
  const container = document.getElementById('stampCategoryFilterButtons');
  if (!container) return;
  container.innerHTML = '';
  const allBtn = document.createElement('button');
  allBtn.className = 'btn btn-small stamp-filter-btn';
  allBtn.dataset.filter = '';
  allBtn.textContent = '全部表示';
  container.appendChild(allBtn);
  const unclassifiedBtn = document.createElement('button');
  unclassifiedBtn.className = 'btn btn-small stamp-filter-btn';
  unclassifiedBtn.dataset.filter = 'all';
  unclassifiedBtn.textContent = '📁未分類';
  container.appendChild(unclassifiedBtn);
  Object.keys(CATEGORY_MAP).forEach(id => {
    const btn = document.createElement('button');
    btn.className = 'btn btn-small stamp-filter-btn';
    btn.dataset.filter = id;
    btn.textContent = CATEGORY_MAP[id];
    container.appendChild(btn);
  });
}

function renderCategorySelectOptions() {
  const select = document.getElementById('stampCategorySelect');
  if (!select) return;
  const selected = new Set([...select.selectedOptions].map(option => option.value));
  select.innerHTML = '';
  Object.keys(CATEGORY_MAP).forEach(id => {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = CATEGORY_MAP[id];
    opt.selected = selected.has(id);
    select.appendChild(opt);
  });
}

function renderCategoryListForHost() {
  const container = document.getElementById('categoryListContainer');
  if (!container) return;
  container.innerHTML = '';
  Object.keys(CATEGORY_MAP).forEach(id => {
    const row = document.createElement('div');
    row.className = 'row';
    row.style.marginBottom = '4px';
    const span = document.createElement('span');
    span.textContent = `${id}: ${CATEGORY_MAP[id]}`;
    span.style.marginRight = '8px';
    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-small';
    delBtn.style.background = '#c33';
    delBtn.textContent = '削除';
    delBtn.addEventListener('click', () => {
      if (window.otsumamiWS && typeof window.otsumamiWS.sendStampCategoryDeleteRequest === 'function') {
        window.otsumamiWS.sendStampCategoryDeleteRequest(id);
      }
    });
    row.appendChild(span);
    row.appendChild(delBtn);
    container.appendChild(row);
  });
}

// サーバー管理のスタンプリスト（URL配列）
let currentStampImages = [];

// サーバーから来たスタンプオブジェクト一式（カテゴリなどメタ情報用）
let stampMetaList = [];


// ★ 追加：ドラッグ中のスタンプURL
let draggingStampUrl = null;

// 最近使ったスタンプ（URLベース）
let recentStampUrls = [];
const RECENT_STAMP_LIMIT = 10;


// 今のロールを取り直すヘルパー（グローバル）
function getCurrentRole() {
  const r =
    window.otsumamiRole ||
    window.localStorage.getItem('otsumami-role') ||
    "viewer";
  role = r;
  return r;
}


// ==============================
// サーバからのスタンプリスト更新入口
// ==============================

window.otsumamiStamp = window.otsumamiStamp || {};

// stamps: [{ id, url, enabled, lastUsedAt, ... }, ...]
window.otsumamiStamp.updateStampListFromServer = function (stamps) {
  if (!Array.isArray(stamps)) return;

  const enabled = stamps.filter(
    (s) =>
      s &&
      s.enabled !== false &&
      typeof s.url === 'string' &&
      s.url.length > 0
  );

  if (!enabled.length) {
    console.log('[Stamps] サーバからのスタンプリストは空');
    currentStampImages = [];
    stampMetaList = [];
    recentStampUrls = [];
    renderRecentStamps();
    renderStampList();
    return;
  }

  // ★ ここではもう lastUsedAt で「並び替え」はしない
  //    → メインリストの順番はサーバが渡してきた順をそのまま使う
  stampMetaList = enabled;
  currentStampImages = enabled.map((s) => s.url);
  window.currentStampImages = [...currentStampImages];

  // ★ lastUsedAt は「最近使ったスタンプ欄」だけで使う
  const sortedByLastUsed = [...enabled].sort((a, b) => {
    const aT = a.lastUsedAt || 0;
    const bT = b.lastUsedAt || 0;
    return bT - aT;
  });

  recentStampUrls = sortedByLastUsed
    .filter((s) => typeof s.url === 'string' && s.url.length > 0 && s.lastUsedAt)
    .map((s) => s.url)
    .slice(0, RECENT_STAMP_LIMIT);

  console.log(
    '[Stamps] サーバからのスタンプリストを反映:',
    currentStampImages.length,
    '件'
  );

  renderRecentStamps();
  renderStampList();
};

// ==============================
// ユーティリティ
// ==============================

// ※ 以前使っていた「一覧先頭に持ってくる」用関数（今は未使用）
//   → クリックで位置が動くと連打しづらいので、挙動から撤廃
function bumpStampToFront(url) {
  const idx = currentStampImages.indexOf(url);
  if (idx === -1) return;
  currentStampImages.splice(idx, 1);
  currentStampImages.unshift(url);
  renderStampList();
}

// 最近使ったスタンプの更新
function updateRecentStamps(url) {
  if (!url) return;

  // 既に含まれていたら一度取り除く
  recentStampUrls = recentStampUrls.filter((u) => u !== url);

  // 先頭に追加
  recentStampUrls.unshift(url);

  // 上限を超えた分は切り捨て
  if (recentStampUrls.length > RECENT_STAMP_LIMIT) {
    recentStampUrls.length = RECENT_STAMP_LIMIT;
  }

  renderRecentStamps();
}

function isVideoUrl(url) {
  const lower = (url || '').toLowerCase().split('?')[0];
  return lower.endsWith('.webm') || lower.endsWith('.mp4');
}

function isGifUrl(url) {
  const lower = (url || '').toLowerCase().split('?')[0];
  return lower.endsWith('.gif');
}

function isStaticThumbnailPreviewEnabled() {
  if (window.otsumamiStampConfig && window.otsumamiStampConfig.staticThumbnailPreview === true) {
    return true;
  }
  return localStorage.getItem('otsumamiStaticThumbnailPreview') === 'true';
}

function applyStaticThumbnailPreviewSetting(enabled) {
  window.otsumamiStampConfig = window.otsumamiStampConfig || {};
  window.otsumamiStampConfig.staticThumbnailPreview = !!enabled;
  localStorage.setItem('otsumamiStaticThumbnailPreview', enabled ? 'true' : 'false');
}

function isThumbnailHoverZoomEnabled() {
  if (window.otsumamiStampConfig && window.otsumamiStampConfig.thumbnailHoverZoom === true) {
    return true;
  }
  return localStorage.getItem('otsumamiThumbnailHoverZoom') === 'true';
}

function applyThumbnailHoverZoomSetting(enabled) {
  window.otsumamiStampConfig = window.otsumamiStampConfig || {};
  window.otsumamiStampConfig.thumbnailHoverZoom = !!enabled;
  localStorage.setItem('otsumamiThumbnailHoverZoom', enabled ? 'true' : 'false');
  if (!enabled) {
    hideThumbHoverPreview();
  }
}

let thumbHoverPreviewEl = null;

function ensureThumbHoverPreviewElement() {
  if (thumbHoverPreviewEl) return thumbHoverPreviewEl;
  thumbHoverPreviewEl = document.createElement('div');
  thumbHoverPreviewEl.id = 'stampThumbHoverPreview';
  thumbHoverPreviewEl.className = 'stamp-thumb-hover-preview';
  const img = document.createElement('img');
  img.alt = '';
  thumbHoverPreviewEl.appendChild(img);
  document.body.appendChild(thumbHoverPreviewEl);
  return thumbHoverPreviewEl;
}

function hideThumbHoverPreview() {
  if (!thumbHoverPreviewEl) return;
  thumbHoverPreviewEl.classList.remove('visible');
}

const THUMB_HOVER_ZOOM_SIZE = 256;

function resolveAbsoluteStampAssetUrl(url) { return resolveAsset(url); }

function resolveHoverZoomImageUrl(url, info) {
  const thumbVersion = info && Number.isFinite(Number(info.thumbUpdatedAt))
    ? Number(info.thumbUpdatedAt)
    : (info && Number.isFinite(Number(info.createdAt)) ? Number(info.createdAt) : 0);

  const appendVersion = (rawUrl) => {
    if (!rawUrl) return '';
    const resolved = resolveAsset(rawUrl);
    return thumbVersion ? `${resolved}${resolved.includes('?') ? '&' : '?'}v=${thumbVersion}` : resolved;
  };

  // 動画は静止画サムネイルを拡大表示
  if (isVideoUrl(url)) {
    if (info?.staticThumbUrl) {
      return appendVersion(resolveAbsoluteStampAssetUrl(info.staticThumbUrl));
    }
    if (info?.id) {
      return appendVersion(resolveAbsoluteStampAssetUrl(`/stamps/thumbs/${info.id}.png`));
    }
    return resolvePreviewThumbUrl(info);
  }

  // 静止画・GIFは元ファイルを優先（解像度が高い）
  if (url) {
    return appendVersion(resolveAbsoluteStampAssetUrl(url));
  }

  return resolvePreviewThumbUrl(info);
}

function positionThumbHoverPreview(event) {
  if (!thumbHoverPreviewEl) return;

  const margin = 12;
  const width = thumbHoverPreviewEl.offsetWidth || THUMB_HOVER_ZOOM_SIZE + 12;
  const height = thumbHoverPreviewEl.offsetHeight || THUMB_HOVER_ZOOM_SIZE + 12;

  let left = event.clientX + margin;
  let top = event.clientY + margin;

  if (left + width > window.innerWidth - margin) {
    left = event.clientX - width - margin;
  }
  if (top + height > window.innerHeight - margin) {
    top = event.clientY - height - margin;
  }

  thumbHoverPreviewEl.style.left = `${Math.max(margin, left)}px`;
  thumbHoverPreviewEl.style.top = `${Math.max(margin, top)}px`;
}

function attachStampHoverZoom(thumbEl, url, info) {
  if (!isThumbnailHoverZoomEnabled()) return;

  let hovering = false;
  const showPreview = (event) => {
    hovering = true;
    if (thumbEl.classList.contains('dragging')) return;

    const preview = ensureThumbHoverPreviewElement();
    const img = preview.querySelector('img');
    const src = resolveHoverZoomImageUrl(url, info);
    if (!src) return;

    const showAtCursor = (cursorEvent) => {
      if (!hovering) return;
      preview.classList.add('visible');
      positionThumbHoverPreview(cursorEvent);
    };

    img.onload = () => showAtCursor(event);
    img.onerror = () => {
      const fallback = resolvePreviewThumbUrl(info);
      if (!fallback || img.src === fallback) return;
      img.src = fallback;
    };

    if (img.src === src && img.complete && img.naturalWidth > 0) {
      showAtCursor(event);
      return;
    }

    img.src = src;
    if (img.complete && img.naturalWidth > 0) {
      showAtCursor(event);
    }
  };

  thumbEl.addEventListener('mouseenter', showPreview);
  thumbEl.addEventListener('mousemove', (event) => {
    if (!thumbHoverPreviewEl?.classList.contains('visible')) return;
    positionThumbHoverPreview(event);
  });
  thumbEl.addEventListener('mouseleave', () => { hovering = false; hideThumbHoverPreview(); });
}

function resolvePreviewThumbUrl(info) {
  if (!info) return '';

  const useStatic = isStaticThumbnailPreviewEnabled();
  const thumbVersion = Number.isFinite(Number(info.thumbUpdatedAt))
    ? Number(info.thumbUpdatedAt)
    : (Number.isFinite(Number(info.createdAt)) ? Number(info.createdAt) : 0);

  const appendVersion = (rawUrl) => {
    if (!rawUrl) return '';
    const resolved = resolveAsset(rawUrl);
    return thumbVersion ? `${resolved}${resolved.includes('?') ? '&' : '?'}v=${thumbVersion}` : resolved;
  };

  if (useStatic) {
    if (info.staticThumbUrl) {
      return appendVersion(info.staticThumbUrl);
    }
    if (info.thumbUrl && info.thumbUrl.toLowerCase().includes('.png')) {
      return appendVersion(info.thumbUrl);
    }
    if (info.id) {
      return appendVersion(`/stamps/thumbs/${info.id}.png`);
    }
  }

  return info.thumbUrl ? appendVersion(info.thumbUrl) : '';
}

function createStampPreviewMedia(url, info) {
  const isVideo = isVideoUrl(url);
  const isGif = isGifUrl(url);
  const isAnimatedSource = isVideo || isGif;
  const useStaticPreview = isStaticThumbnailPreviewEnabled();

  const img = document.createElement('img');
  const previewThumbUrl = resolvePreviewThumbUrl(info);
  const src = previewThumbUrl || (!isAnimatedSource ? resolveAsset(url) : '');

  img.src = src;
  img.alt = url;
  img.className = 'stamp-thumb-media';

  img.addEventListener('error', () => {
    if (img.dataset.fallbackApplied === 'true') return;
    img.dataset.fallbackApplied = 'true';
    const fallback = info?.thumbUrl ? resolveAsset(info.thumbUrl) : (!isAnimatedSource ? resolveAsset(url) : '');
    if (fallback && img.src !== fallback) img.src = fallback;
  });

  return img;
}

function applyPreviewSizeFromStorage() {
  const saved = localStorage.getItem('otsumamiStampPreviewSize');
  if (!saved) return;
  const previewSize = Number(saved);
  if (!Number.isFinite(previewSize)) return;
  document.documentElement.style.setProperty('--stamp-preview-size', `${previewSize}px`);
}

// ==============================
// 最近スタンプ欄描画
// ==============================

function renderRecentStamps() {
  const container = document.getElementById('recentStampList');
  if (!container) return;

  container.innerHTML = '';

  recentStampUrls.forEach((url) => {
    const thumb = document.createElement('div');
    thumb.className = 'stamp-thumb';

      const lower = url.toLowerCase();
    const isVideo = lower.endsWith('.webm') || lower.endsWith('.mp4');

    // 動画の場合はバッジ表示用のクラスを追加
    if (isVideo) {
      thumb.classList.add('is-video');
    }

    const info = stampMetaList.find((s) => s.url === url) || null;
    const mediaEl = createStampPreviewMedia(url, info);
    thumb.appendChild(mediaEl);
    attachStampHoverZoom(thumb, url, info);

    // 最近欄は常に「送信専用」（整理モードは関与させない）
    thumb.addEventListener('click', () => {
      sendStampToOverlayOrHost(url);
    });

    container.appendChild(thumb);
  });
}

// ==============================
// スタンプ一覧描画
// ==============================

function renderStampList() {
  const container = document.getElementById('stampList');
  if (!container) return;

  container.innerHTML = '';
  role = getCurrentRole();
  editMode = window.stampEditMode === true;

  currentStampImages.forEach((url) => {
    // メタ情報を取得（カテゴリ・thumbUrl など）
    const info = stampMetaList.find((s) => s.url === url) || null;

    // カテゴリは配列として扱う
    const categories = Array.isArray(info?.category) ? info.category : [];

    // ========= フィルタ適用ロジック =========
    // currentCategoryFilter === "" → フィルタなし（全部表示）
    // currentCategoryFilter === "all" → 「未分類（カテゴリが空）」だけ表示
    // currentCategoryFilter === "joy" 等 → そのカテゴリを持つスタンプを表示
    if (currentCategoryFilter === "all") {
      // 未分類フィルタ：カテゴリが何か入っているものは除外
      if (categories.length > 0) {
        return;
      }
    } else if (currentCategoryFilter) {
      // 特定カテゴリフィルタ
      if (!categories.includes(currentCategoryFilter)) {
        return;
      }
    }
    // currentCategoryFilter が "" のときは何も return せず、そのまま表示

    const thumb = document.createElement('div');
    thumb.className = 'stamp-thumb';

    // 画像か動画か判定用の文字列
    //  ・動画は常に元URLで判定＆再生
    //  ・画像は thumbUrl があればそっちを使う
    const lowerSrcForType = url.toLowerCase();
    const isVideo = lowerSrcForType.endsWith('.webm') || lowerSrcForType.endsWith('.mp4');

    // 動画の場合はバッジ表示用のクラスを追加
    if (isVideo) {
      thumb.classList.add('is-video');
    }

    const mediaEl = createStampPreviewMedia(url, info);
    thumb.appendChild(mediaEl);
    attachStampHoverZoom(thumb, url, info);

    // 編集モード描画時だけチェックボックスを表示（ホストとリスナー両方）
    if (editMode && (role === 'host' || role === 'viewer')) {
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'stamp-delete-checkbox';
      cb.dataset.url = url;

      // 右上に重ねて表示
      cb.style.position = 'absolute';
      cb.style.top = '4px';
      cb.style.right = '4px';
      cb.style.transform = 'scale(1.2)';

      // 親 container が relative になっていないので設定する
      thumb.style.position = 'relative';

      thumb.appendChild(cb);

      // ★ ドラッグ並び替えはホストのみ許可（保存先がホスト管理のため）
      const canReorder = role === 'host';
      thumb.setAttribute('draggable', canReorder ? 'true' : 'false');

      thumb.addEventListener('dragstart', (e) => {
        if (!editMode || !canReorder) return; // 編集モード中のホストのみドラッグ可能
        draggingStampUrl = url;
        thumb.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
      });

      thumb.addEventListener('dragover', (e) => {
        e.preventDefault(); // drop を許可
        e.dataTransfer.dropEffect = 'move';
        thumb.classList.add('drag-over');
      });

      thumb.addEventListener('dragleave', () => {
        thumb.classList.remove('drag-over');
      });

      thumb.addEventListener('drop', (e) => {
        e.preventDefault();
        thumb.classList.remove('drag-over');

        if (!canReorder || !draggingStampUrl || draggingStampUrl === url) {
          draggingStampUrl = null;
          return;
        }

        const fromIndex = currentStampImages.indexOf(draggingStampUrl);
        const toIndex = currentStampImages.indexOf(url);
        if (fromIndex === -1 || toIndex === -1) {
          draggingStampUrl = null;
          return;
        }

        const moved = currentStampImages.splice(fromIndex, 1)[0];
        currentStampImages.splice(toIndex, 0, moved);

        draggingStampUrl = null;
        renderStampList(); // 並び替え後に再描画

        // 並び替え直後に保存して、再接続/再読込でも順番を維持
        if (
          window.otsumamiWS &&
          typeof window.otsumamiWS.sendStampReorderRequest === 'function'
        ) {
          window.otsumamiWS.sendStampReorderRequest(currentStampImages);
        }
      });

      thumb.addEventListener('dragend', () => {
        draggingStampUrl = null;
        thumb.classList.remove('dragging');
      });
      // ★ ドラッグ対応ここまで
    }

    // 通常クリック時はスタンプ送信
    thumb.addEventListener('click', () => {
      if (!editMode) {
        sendStampToOverlayOrHost(url);
      }
    });

    container.appendChild(thumb);
  });
  window.currentStampImages = [...currentStampImages];
}



// ==============================
// スタンプサイズ調整UI
// ==============================

export function initStampSizeControls() {
  const baseSizeSlider = document.getElementById('stampBaseSizeSlider');
  const baseSizeLabel = document.getElementById('stampBaseSizeLabel');
  const baseSizeDisplay = document.getElementById('stampBaseSizeDisplay');
  const previewSizeRadios = document.querySelectorAll('input[name="stampPreviewSizeOption"]');

  // 表示倍率は廃止し、常に 100% として扱う
  localStorage.setItem('otsumamiStampScale', '100');
  if (window.electronAPI && typeof window.electronAPI.setStampScale === 'function') {
    window.electronAPI.setStampScale(1);
  }

  const updateBaseSizeLabel = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return;
    if (baseSizeLabel) baseSizeLabel.textContent = `${Math.round(num)}`;
    if (baseSizeDisplay) baseSizeDisplay.textContent = `${Math.round(num)}px`;
  };

  if (baseSizeSlider) {
    const savedBaseSize = localStorage.getItem('otsumamiStampBaseSize');
    if (savedBaseSize !== null) {
      baseSizeSlider.value = savedBaseSize;
    }
    updateBaseSizeLabel(baseSizeSlider.value);

    baseSizeSlider.addEventListener('input', () => {
      const raw = Number(baseSizeSlider.value);
      if (!Number.isFinite(raw)) return;
      updateBaseSizeLabel(raw);
      localStorage.setItem('otsumamiStampBaseSize', raw);
    });
  }

  const applyPreviewSize = (value) => {
    const size = Number(value);
    if (!Number.isFinite(size)) return;
    localStorage.setItem('otsumamiStampPreviewSize', size);
    document.documentElement.style.setProperty('--stamp-preview-size', `${size}px`);
  };

  if (previewSizeRadios.length > 0) {
    let savedPreviewSize = localStorage.getItem('otsumamiStampPreviewSize') || '64';
    if (savedPreviewSize === '112') {
      savedPreviewSize = '128';
      localStorage.setItem('otsumamiStampPreviewSize', '128');
    }

    let hasMatched = false;
    previewSizeRadios.forEach((radio) => {
      if (radio.value === savedPreviewSize) {
        radio.checked = true;
        hasMatched = true;
      }

      radio.addEventListener('change', () => {
        if (!radio.checked) return;
        applyPreviewSize(radio.value);
      });
    });

    if (!hasMatched) {
      const fallback = previewSizeRadios[1] || previewSizeRadios[0];
      if (fallback) {
        fallback.checked = true;
        applyPreviewSize(fallback.value);
      }
    } else {
      applyPreviewSize(savedPreviewSize);
    }
  } else {
    applyPreviewSizeFromStorage();
  }
}

// ==============================
// スタンプ送信（ホスト/ビューアで挙動分岐）
// ==============================

function sendStampToOverlayOrHost(url) {
  const normalizeFilenameForSend = (rawUrl) => {
    if (!rawUrl || typeof rawUrl !== 'string') return rawUrl;
    if (!/^https?:\/\//i.test(rawUrl)) return rawUrl;

    try {
      const parsed = new URL(rawUrl);
      // サーバ管理スタンプは pathname を送る（使用履歴更新と整合）
      if (parsed.pathname.startsWith('/stamps/')) {
        return `${parsed.pathname}${parsed.search || ''}`;
      }
    } catch (error) {
      // URL解析失敗時はそのまま送る
    }
    return rawUrl;
  };

  const sendUrl = normalizeFilenameForSend(url);

  // ロール情報は websocket.js 側でセットしている
  const currentRole = window.otsumamiRole || (window.isHost ? 'host' : 'viewer');

  // ---- ホスト側：ローカルのオーバーレイにだけ表示 ----
  if (currentRole === 'host') {
    if (
      !window.electronAPI ||
      typeof window.electronAPI.sendStamp !== 'function'
    ) {
      console.warn(
        '[Stamps] ホストですが electronAPI.sendStamp が利用できません'
      );
      return;
    }

    window.electronAPI.sendStamp({ filename: sendUrl });


    // ★ ホストが押しても一覧の順番は変えない。最近欄だけ更新。
    updateRecentStamps(url);
    return;
  }

  // ---- ビューア側：WebSocket 経由でホストへ投げる ----
  const ws = window.otsumamiWs;
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.warn('[Stamps] WebSocket未接続のためスタンプを送信できません');

    if (window.alertWithFocus) {
      window.alertWithFocus('スタンプを送るには、配信者に接続している必要があります');
    } else {
      alert('スタンプを送るには、配信者に接続している必要があります');
    }
    return;
  }

  ws.send(
    JSON.stringify({
      type: 'stamp',
      payload: {
        filename: sendUrl
      }
    })
  );


  // ★ ビューア側も送信成功時に最近欄だけ更新
  updateRecentStamps(url);
}

// ==============================
// 初期化
// ==============================

function initStampDom() {
  if (window.otsumamiStampDomInitialized) return;

  const stampList = document.getElementById('stampList');
  if (!stampList) {
    return;
  }

  applyPreviewSizeFromStorage();
  renderRecentStamps();
  renderStampList();
  initStampSizeControls();

  window.otsumamiStampDomInitialized = true;
  console.log('[Stamps] initialized');
}

document.addEventListener('DOMContentLoaded', () => {
  initStampDom();
});

// ★ ここからは DOMContentLoaded の外
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('stamp-filter-btn')) {
    currentCategoryFilter = e.target.dataset.filter;
    renderStampList();
  }
});

// ★ タブ動的読み込み対応：関数をグローバル公開
window.otsumamiStamp = window.otsumamiStamp || {};
window.otsumamiStamp.renderStampList = renderStampList;
window.otsumamiStamp.renderRecentStamps = renderRecentStamps;
window.otsumamiStamp.initStampDom = initStampDom;
window.otsumamiStamp.applyStaticThumbnailPreviewSetting = applyStaticThumbnailPreviewSetting;
window.otsumamiStamp.isStaticThumbnailPreviewEnabled = isStaticThumbnailPreviewEnabled;
window.otsumamiStamp.applyThumbnailHoverZoomSetting = applyThumbnailHoverZoomSetting;
window.otsumamiStamp.isThumbnailHoverZoomEnabled = isThumbnailHoverZoomEnabled;
window.otsumamiStamp.updateCategories = updateCategories;
window.otsumamiStamp.renderCategoryFilterButtons = renderCategoryFilterButtons;
window.otsumamiStamp.renderCategorySelectOptions = renderCategorySelectOptions;
window.otsumamiStamp.renderCategoryListForHost = renderCategoryListForHost;

Object.defineProperty(window.otsumamiStamp, 'CATEGORY_MAP', {
  get() { return CATEGORY_MAP; },
  enumerable: true
});

window.otsumamiStamp.renderCategoryUI = renderCategoryUI;
