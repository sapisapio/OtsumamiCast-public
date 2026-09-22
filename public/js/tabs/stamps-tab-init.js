// js/tabs/stamps-tab-init.js
// スタンプタブ専用の初期化処理

import { initStampSizeControls } from '../stamps.js';

/**
 * スタンプタブの初期化
 * タブが読み込まれた後に必ず実行される
 */
export function initStampsTab() {
  console.log('[StampsTab] 初期化開始');
  
  // スライダーイベントの設定
  initSliders();
  
  // 設定の読み込み
  loadStampSettings();
  window.otsumamiStamp?.renderCategoryUI?.();
  window.addEventListener('websocket-message', event => {
    if (event.detail?.type === 'stamp-config' && window.otsumamiRole === 'viewer') loadStampSettings();
  });
  
  // ホスト設定セクションの表示制御
  updateHostSettingsSectionVisibility();
  
  // ロール変更イベントのリスナー登録
  window.addEventListener('otsumamiRoleChanged', () => { updateHostSettingsSectionVisibility(); loadStampSettings(); });
  
  // ★ 追加：既に受信済みのスタンプリストを再描画
  if (window.otsumamiStamp && typeof window.otsumamiStamp.renderStampList === 'function') {
    console.log('[StampsTab] スタンプリストを再描画');
    window.otsumamiStamp.renderStampList();
    
    // 最近使ったスタンプも再描画
    if (typeof window.otsumamiStamp.renderRecentStamps === 'function') {
      window.otsumamiStamp.renderRecentStamps();
    }
  }
  
  // ★ スタンプ管理UIのイベント設定
  initStampManagementUI();
  initStaticThumbnailPreviewControl();
  initThumbnailHoverZoomControl();

  if (window.otsumamiStamp && typeof window.otsumamiStamp.initStampDom === 'function') {
    window.otsumamiStamp.initStampDom();
  } else {
    initStampSizeControls();
  }
  
  console.log('[StampsTab] 初期化完了');
}

/**
 * スライダーのイベント設定
 */
function initSliders() {
  // ファイルサイズスライダー
  const maxFileSize = document.getElementById('maxFileSize');
  if (maxFileSize) {
    maxFileSize.addEventListener('input', (e) => {
      const value = e.target.value;
      document.getElementById('fileSizeValue').textContent = value;
      document.getElementById('fileSizeDisplay').textContent = `${value} MB`;
    });
  }

  // 最大スタンプ数スライダー
  const maxStampSlider = document.getElementById('maxStampSlider');
  if (maxStampSlider) {
    maxStampSlider.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      let displayText;
      
      if (value === 1100) {
        displayText = '無制限';
        document.getElementById('stampCountValue').textContent = '無制限';
      } else {
        displayText = `${value}個`;
        document.getElementById('stampCountValue').textContent = value;
      }
      
      document.getElementById('stampCountDisplay').textContent = displayText;
    });
  }

  // 動画スタンプ音量スライダー
  const videoStampVolume = document.getElementById('videoStampVolume');
  if (videoStampVolume) {
    videoStampVolume.addEventListener('input', (e) => {
      const value = e.target.value;
      document.getElementById('videoVolumeValue').textContent = value;
      document.getElementById('videoVolumeDisplay').textContent = `${value}%`;
    });
  }

  // スタンプ表示時間スライダー
  const stampDuration = document.getElementById('stampDuration');
  if (stampDuration) {
    stampDuration.addEventListener('input', (e) => {
      const value = e.target.value;
      document.getElementById('stampDurationValue').textContent = value;
      document.getElementById('stampDurationDisplay').textContent = `${value}秒`;
    });
  }


  // スタンプ規定サイズスライダー
  const stampBaseSizeSlider = document.getElementById('stampBaseSizeSlider');
  if (stampBaseSizeSlider) {
    stampBaseSizeSlider.addEventListener('input', (e) => {
      const value = e.target.value;
      const label = document.getElementById('stampBaseSizeLabel');
      const display = document.getElementById('stampBaseSizeDisplay');
      if (label) label.textContent = value;
      if (display) display.textContent = `${value}px`;
    });
  }

  // 着信音音量スライダー
  const stampSoundVolume = document.getElementById('stampSoundVolume');
  if (stampSoundVolume) {
    stampSoundVolume.addEventListener('input', (e) => {
      const value = e.target.value;
      document.getElementById('soundVolumeValue').textContent = value;
      document.getElementById('soundVolumeDisplay').textContent = `${value}%`;
    });
  }
}

/**
 * 設定を読み込む
 */
async function loadStampSettings() {
  try {
    const isViewer = (window.state?.role || window.otsumamiRole) === 'viewer';
    const data = isViewer
      ? { success: true, config: window.otsumamiRemoteStampConfig || {} }
      : await (await fetch('/api/stamp-config')).json();

    if (data.success) {
      const config = data.config;
      
      // ファイルサイズを設定
      if (config.maxFileSize !== undefined) {
        document.getElementById('maxFileSize').value = config.maxFileSize || 5;
        document.getElementById('fileSizeValue').textContent = config.maxFileSize || 5;
        document.getElementById('fileSizeDisplay').textContent = `${config.maxFileSize || 5} MB`;
      }
      
      // 最大スタンプ数を設定
      let stampValue = 100;
      if (config.maxStampCount === 'unlimited' || config.maxStampCount === 0) {
        stampValue = 1100;
        document.getElementById('stampCountValue').textContent = '無制限';
        document.getElementById('stampCountDisplay').textContent = '無制限';
      } else if (config.maxStampCount) {
        stampValue = config.maxStampCount;
        document.getElementById('stampCountValue').textContent = stampValue;
        document.getElementById('stampCountDisplay').textContent = `${stampValue}個`;
      }
      document.getElementById('maxStampSlider').value = stampValue;
      
      // パスワードを設定
      if (config.discordPassword) {
        document.getElementById('discordPassword').value = config.discordPassword;
      }
      
      // リスナーのスタンプ追加権限を設定
      const permission = config.listenerAddPermission || 'host-only';
      const permissionRadio = document.querySelector('input[name="listenerPermission"][value="' + permission + '"]');
      if (permissionRadio) {
        permissionRadio.checked = true;
      }
      
      const soundRadio = [...document.querySelectorAll('input[name="stampSound"]')].find(el => el.value === (config.stampSound || 'sound1'));
      if (soundRadio) soundRadio.checked = true;
      const soundVolume = document.getElementById('stampSoundVolume');
      if (soundVolume) soundVolume.value = config.stampSoundVolume ?? 50;
      const soundLabel = document.getElementById('soundVolumeValue');
      if (soundLabel) soundLabel.textContent = String(config.stampSoundVolume ?? 50);
      // 音量
      if (config.videoVolume !== undefined) {
        document.getElementById('videoStampVolume').value = config.videoVolume;
        document.getElementById('videoVolumeValue').textContent = config.videoVolume;
        document.getElementById('videoVolumeDisplay').textContent = `${config.videoVolume}%`;
      }
      
      // ミュート
      if (config.muteVideo !== undefined) {
        document.getElementById('muteVideoStamps').checked = config.muteVideo;
      }
      
      // 表示時間
      if (config.stampDuration !== undefined) {
        document.getElementById('stampDuration').value = config.stampDuration;
        document.getElementById('stampDurationValue').textContent = config.stampDuration;
        document.getElementById('stampDurationDisplay').textContent = `${config.stampDuration}秒`;
      }

      const staticThumbCheckbox = document.getElementById('staticThumbnailPreview');
      if (staticThumbCheckbox) {
        staticThumbCheckbox.checked = !!config.staticThumbnailPreview;
      }
      if (
        window.otsumamiStamp &&
        typeof window.otsumamiStamp.applyStaticThumbnailPreviewSetting === 'function'
      ) {
        window.otsumamiStamp.applyStaticThumbnailPreviewSetting(!!config.staticThumbnailPreview);
      }

      const hoverZoomCheckbox = document.getElementById('thumbnailHoverZoom');
      if (hoverZoomCheckbox) {
        hoverZoomCheckbox.checked = !!config.thumbnailHoverZoom;
      }
      if (
        window.otsumamiStamp &&
        typeof window.otsumamiStamp.applyThumbnailHoverZoomSetting === 'function'
      ) {
        window.otsumamiStamp.applyThumbnailHoverZoomSetting(!!config.thumbnailHoverZoom);
      }

      // 規定サイズ（オーバーレイ表示）
      if (config.stampBaseSize !== undefined) {
        const baseSlider = document.getElementById('stampBaseSizeSlider');
        const baseLabel = document.getElementById('stampBaseSizeLabel');
        const baseDisplay = document.getElementById('stampBaseSizeDisplay');
        if (baseSlider) baseSlider.value = config.stampBaseSize;
        if (baseLabel) baseLabel.textContent = `${config.stampBaseSize}`;
        if (baseDisplay) baseDisplay.textContent = `${config.stampBaseSize}px`;
        localStorage.setItem('otsumamiStampBaseSize', config.stampBaseSize);
      }
      
      if (window.electronAPI && window.electronAPI.sendToOverlay) {
        window.electronAPI.sendToOverlay('send-stamp-sound', { sound: config.stampSound || 'sound1', volume: config.stampSoundVolume ?? 50 });
        window.electronAPI.sendToOverlay('send-video-volume', {
          volume: config.videoVolume ?? 50,
          muted: config.muteVideo ?? false
        });
        window.electronAPI.sendToOverlay('send-stamp-duration', {
          duration: config.stampDuration ?? 3,
          baseSize: config.stampBaseSize ?? 220
        });
      }

      console.log('⚙️ スタンプ設定を読み込みました:', config);
    }
  } catch (error) {
    console.error('❌ スタンプ設定読み込み失敗:', error);
  }
}

/**
 * ホスト設定セクションの表示制御
 */
function updateHostSettingsSectionVisibility() {
  const hostSettingsSection = document.getElementById('hostStampSettingsSection');
  if (!hostSettingsSection) return;
  
  // ロール情報を取得
  const currentRole = window.state?.role || window.otsumamiRole || window.localStorage.getItem('otsumami-role') || 'viewer';
  
  if (currentRole === 'host') {
    hostSettingsSection.style.display = 'block';
  } else {
    hostSettingsSection.style.display = 'none';
  }
  
  console.log('[StampsTab] ロール表示更新:', currentRole);
}

/**
 * 設定へスロール（グローバル関数として公開）
 */
window.scrollToSettings = function() {
  const section = document.getElementById('hostStampSettingsSection');
  if (section) {
    section.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }
};

/**
 * すべての設定を保存（グローバル関数として公開）
 */
window.saveAllSettings = async function() {
  const fileSize = parseInt(document.getElementById('maxFileSize').value);
  const stampCountSlider = parseInt(document.getElementById('maxStampSlider').value);
  const stampCount = stampCountSlider === 1100 ? 'unlimited' : stampCountSlider;
  const permission = document.querySelector('input[name="listenerPermission"]:checked').value;
  const password = document.getElementById('discordPassword').value.trim();
  const videoVolume = parseInt(document.getElementById('videoStampVolume').value);
  const muteVideo = document.getElementById('muteVideoStamps').checked;
  const stampDuration = parseInt(document.getElementById('stampDuration').value);
  const stampSound = document.querySelector('input[name="stampSound"]:checked').value;
  const stampSoundVolume = parseInt(document.getElementById('stampSoundVolume').value);
  const stampBaseSize = parseInt(document.getElementById('stampBaseSizeSlider')?.value || '220', 10);
  const staticThumbnailPreview = !!document.getElementById('staticThumbnailPreview')?.checked;
  const thumbnailHoverZoom = !!document.getElementById('thumbnailHoverZoom')?.checked;

  try {
    // 権限設定を保存
    const permissionResponse = await fetch('/api/stamp-config/listener-permission', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permission })
    });
    
    if (!permissionResponse.ok) {
      throw new Error('権限設定の保存に失敗しました');
    }
    
    // その他の設定を保存
    const response = await fetch('/api/stamp-config/save-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        maxFileSize: fileSize,
        maxStampCount: stampCount,
        discordPassword: password || null,
        videoVolume: videoVolume,
        muteVideo: muteVideo,
        stampDuration: stampDuration,
        stampBaseSize: stampBaseSize,
        stampSound,
        stampSoundVolume,
        staticThumbnailPreview: staticThumbnailPreview,
        thumbnailHoverZoom: thumbnailHoverZoom
      })
    });

    if (response.ok) {
      // 成功トーストを表示
      if (window.showToast) {
        window.showToast('設定を保存しました', 'success');
      } else {
        alert('設定を保存しました');
      }
      
      // ★ オーバーレイに設定を送信
      if (window.electronAPI && window.electronAPI.sendToOverlay) {
        window.electronAPI.sendToOverlay('send-video-volume', {
          volume: videoVolume,
          muted: muteVideo
        });
        
        window.electronAPI.sendToOverlay('send-stamp-duration', {
          duration: stampDuration,
          baseSize: stampBaseSize
        });
        
        window.electronAPI.sendToOverlay('send-stamp-sound', {
          sound: stampSound,
          volume: stampSoundVolume
        });
      }
    } else {
      if (window.showToast) {
        window.showToast('保存に失敗しました', 'error');
      } else {
        alert('保存に失敗しました');
      }
    }
  } catch (error) {
    if (window.showToast) {
      window.showToast('エラーが発生しました', 'error');
    } else {
      alert('エラーが発生しました');
    }
    console.error(error);
  }
};

function initStaticThumbnailPreviewControl() {
  const checkbox = document.getElementById('staticThumbnailPreview');
  if (!checkbox) return;

  checkbox.addEventListener('change', async () => {
    const enabled = checkbox.checked;

    if (
      window.otsumamiStamp &&
      typeof window.otsumamiStamp.applyStaticThumbnailPreviewSetting === 'function'
    ) {
      window.otsumamiStamp.applyStaticThumbnailPreviewSetting(enabled);
      window.otsumamiStamp.renderRecentStamps();
      window.otsumamiStamp.renderStampList();
    }

    if (window.otsumamiRole !== 'host') return;
    try {
      await fetch('/api/stamp-config/save-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staticThumbnailPreview: enabled })
      });
    } catch (error) {
      console.error('負荷軽減モード設定の保存に失敗:', error);
    }
  });
}

function initThumbnailHoverZoomControl() {
  const checkbox = document.getElementById('thumbnailHoverZoom');
  if (!checkbox) return;

  checkbox.addEventListener('change', async () => {
    const enabled = checkbox.checked;

    if (
      window.otsumamiStamp &&
      typeof window.otsumamiStamp.applyThumbnailHoverZoomSetting === 'function'
    ) {
      window.otsumamiStamp.applyThumbnailHoverZoomSetting(enabled);
      window.otsumamiStamp.renderRecentStamps();
      window.otsumamiStamp.renderStampList();
    }

    try {
      await fetch('/api/stamp-config/save-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thumbnailHoverZoom: enabled })
      });
    } catch (error) {
      console.error('ホバー拡大設定の保存に失敗:', error);
    }
  });
}

/**
 * スタンプ管理UIのイベント設定
 */
function initStampManagementUI() {
  // stamps.jsから移植した初期化処理
  const addBtn = document.getElementById('stampUrlAddButton');
  const urlInput = document.getElementById('stampUrlInput');
  const dropZone = document.getElementById('stampUrlDropZone');
  const editBtn = document.getElementById('stampEditToggleBtn');
  const deleteBtn = document.getElementById('stampDeleteButton');
  const thumbRebuildSelectedBtn = document.getElementById('stampThumbRebuildSelectedButton');
  const thumbRebuildAllBtn = document.getElementById('stampThumbRebuildAllButton');
  const thumbRebuildProgressText = document.getElementById('stampThumbRebuildProgressText');

  const setThumbRebuildProgress = (progress) => {
    if (!thumbRebuildProgressText) return;
    const scopeLabel = progress.scope === 'selected' ? '選択' : '全件';
    const current = Number(progress.current || 0);
    const total = Number(progress.total || 0);
    const status = progress.status || 'progress';

    if (status === 'start') {
      thumbRebuildProgressText.style.display = 'block';
      thumbRebuildProgressText.textContent = `サムネイル再生成を開始しました（${scopeLabel}）`;
      if (thumbRebuildSelectedBtn) thumbRebuildSelectedBtn.disabled = true;
      if (thumbRebuildAllBtn) thumbRebuildAllBtn.disabled = true;
      return;
    }

    if (status === 'progress') {
      thumbRebuildProgressText.style.display = 'block';
      thumbRebuildProgressText.textContent = `サムネイル再生成中（${scopeLabel}）: ${current}/${total}`;
      return;
    }

    if (status === 'done') {
      thumbRebuildProgressText.textContent =
        `サムネイル再生成完了（${scopeLabel}）: 成功${progress.successCount || 0}件 / 失敗${progress.failCount || 0}件`;
      if (thumbRebuildSelectedBtn) thumbRebuildSelectedBtn.disabled = false;
      if (thumbRebuildAllBtn) thumbRebuildAllBtn.disabled = false;
      setTimeout(() => {
        if (!thumbRebuildProgressText) return;
        thumbRebuildProgressText.style.display = 'none';
        thumbRebuildProgressText.textContent = '';
      }, 3000);
      return;
    }
  };

  window.otsumamiStamp = window.otsumamiStamp || {};
  window.otsumamiStamp.updateThumbRegenerateProgress = setThumbRebuildProgress;

  // ==== ドロップエリアからの自動追加 ====
  if (dropZone && addBtn && urlInput) {
    const preventDefaults = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) => {
      dropZone.addEventListener(eventName, preventDefaults);
    });

    ['dragenter', 'dragover'].forEach((eventName) => {
      dropZone.addEventListener(eventName, () => {
        dropZone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach((eventName) => {
      dropZone.addEventListener(eventName, () => {
        dropZone.classList.remove('dragover');
      });
    });

    dropZone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      if (!dt) return;

      const textData =
        dt.getData('text/uri-list') || dt.getData('text/plain') || '';
      if (!textData) return;

      const firstUrl = textData
        .split(/\s+/)
        .map((s) => s.trim())
        .find((s) => s.startsWith('http'));

      if (!firstUrl) return;

      urlInput.value = firstUrl;
      addBtn.click();
    });
  }

  // ==== URL追加ボタン ====
  if (addBtn && urlInput) {
    addBtn.addEventListener('click', async () => {
      const getCurrentRole = () => {
        return window.state?.role || window.otsumamiRole || window.localStorage.getItem('otsumami-role') || 'viewer';
      };
      
      const r = getCurrentRole();
      let hostConfig = null;
      let viewerPassword = null;
      
      // リスナーの場合、ホスト設定を確認
      if (r === 'viewer') {
        try {
          const data = { success: !!window.otsumamiRemoteStampConfig, config: window.otsumamiRemoteStampConfig };
          
          if (!data.success) {
            alert('ホスト設定を取得できません');
            return;
          }
          
          hostConfig = data.config;
          
          if (hostConfig.listenerAddPermission === 'host-only') {
            alert('ホストがスタンプ追加を許可していません');
            return;
          }
          
          if (hostConfig.passwordRequired) {
            const passwordInput = prompt('このスタンプを追加するにはパスワードが必要です。\nパスワードを入力してください:');
            if (passwordInput === null) {
              return;
            }

            viewerPassword = passwordInput;
          }
        } catch (error) {
          console.error('ホスト設定取得エラー:', error);
          alert('ホスト設定を確認できません');
          return;
        }
      } else if (r !== 'host') {
        alert('スタンプを追加するには、ホストに接続してください');
        return;
      }

      const url = urlInput.value.trim();
      if (!url) return;

      if (
        !url.startsWith('https://cdn.discordapp.com/') &&
        !url.startsWith('https://media.discordapp.net/')
      ) {
        alert('Discord CDN（cdn.discordapp.com / media.discordapp.net）のURLのみ追加できます');
        return;
      }

      if (
        !window.otsumamiWS ||
        typeof window.otsumamiWS.sendStampAddRequest !== 'function'
      ) {
        alert('スタンプ管理サーバに接続されていません。\nホストとして接続したあとに試してください。');
        return;
      }

      window.otsumamiWS.sendStampAddRequest(url, { password: viewerPassword });
      urlInput.value = '';
    });
  }

  // ==== 編集モード & 削除 ====
  if (editBtn && deleteBtn) {
    deleteBtn.disabled = true;

    editBtn.addEventListener('click', () => {
      const getCurrentRole = () => {
        return window.state?.role || window.otsumamiRole || window.localStorage.getItem('otsumami-role') || 'viewer';
      };
      
      const r = getCurrentRole();
      
      if (r !== 'host' && r !== 'viewer') {
        alert('スタンプの整理に接続してください');
        return;
      }

      // stamps.jsのグローバル変数を参照
      const editMode = window.stampEditMode || false;
      const wasEditMode = editMode;
      window.stampEditMode = !editMode;
      
      editBtn.textContent = window.stampEditMode ? '整理モード（ON）' : '整理モード';
      deleteBtn.disabled = !window.stampEditMode || r !== 'host';
      
      if (window.otsumamiStamp && typeof window.otsumamiStamp.renderStampList === 'function') {
        window.otsumamiStamp.renderStampList();
      }

      if (wasEditMode && !window.stampEditMode) {
        if (
          window.otsumamiWS &&
          typeof window.otsumamiWS.sendStampReorderRequest === 'function' &&
          window.currentStampImages
        ) {
          window.otsumamiWS.sendStampReorderRequest(window.currentStampImages);
        }
      }
    });

    deleteBtn.addEventListener('click', () => {
      if (!window.stampEditMode) return;

      const getCurrentRole = () => {
        return window.state?.role || window.otsumamiRole || window.localStorage.getItem('otsumami-role') || 'viewer';
      };
      
      const r = getCurrentRole();
      
      if (r !== 'host') {
        alert('スタンプの削除はホストのみ可能です');
        return;
      }

      if (
        !window.otsumamiWS ||
        typeof window.otsumamiWS.sendStampDeleteRequest !== 'function'
      ) {
        alert('スタンプ管理サーバに接続されていません。\nホストとして接続したあとに試してください。');
        return;
      }

      const checkboxes = document.querySelectorAll('.stamp-delete-checkbox');
      const toDelete = [];
      checkboxes.forEach((cb) => {
        if (cb.checked && cb.dataset.url) {
          toDelete.push(cb.dataset.url);
        }
      });

      if (!toDelete.length) {
        alert('削除するスタンプを選択してください');
        return;
      }

      const confirmed = confirm(`選択した${toDelete.length}件のスタンプを削除します。\nこの操作は元に戻せません。続行しますか？`);
      if (!confirmed) {
        return;
      }

      window.otsumamiWS.sendStampDeleteRequest(toDelete);

      window.stampEditMode = false;
      editBtn.textContent = '整理モード';
      deleteBtn.disabled = true;
    });

    // ==== カテゴリ一括付与 ====
    const categorySelect = document.getElementById('stampCategorySelect');
    const categoryApplyBtn = document.getElementById('stampCategoryApplyButton');
    const categoryRemoveBtn = document.getElementById('stampCategoryRemoveButton');

    if (categorySelect && categoryApplyBtn) {
      categoryApplyBtn.addEventListener('click', () => {
        const getCurrentRole = () => {
          return window.state?.role || window.otsumamiRole || window.localStorage.getItem('otsumami-role') || 'viewer';
        };
        
        const r = getCurrentRole();
        
        if (r !== 'host' && r !== 'viewer') {
          alert('カテゴリを付与するには接続してください');
          return;
        }

        const selectedOptions = [...categorySelect.selectedOptions].map(opt => opt.value);
        if (!selectedOptions.length) {
          alert('カテゴリを選択してください');
          return;
        }

        const selected = [...document.querySelectorAll('.stamp-delete-checkbox')]
          .filter((cb) => cb.checked)
          .map((cb) => cb.dataset.url);

        if (!selected.length) {
          alert('カテゴリを付与するスタンプを選択してください');
          return;
        }

        if (
          !window.otsumamiWS ||
          typeof window.otsumamiWS.sendStampCategoryAddToStamps !== 'function'
        ) {
          alert('スタンプ管理サーバに接続されていません。');
          return;
        }

        selectedOptions.forEach(categoryId => {
          window.otsumamiWS.sendStampCategoryAddToStamps(selected, categoryId);
        });
      });
    }

    if (categorySelect && categoryRemoveBtn) {
      categoryRemoveBtn.addEventListener('click', () => {
        const selectedOptions = [...categorySelect.selectedOptions].map(opt => opt.value);
        if (!selectedOptions.length) {
          alert('除去するカテゴリを選択してください');
          return;
        }

        const selected = [...document.querySelectorAll('.stamp-delete-checkbox')]
          .filter((cb) => cb.checked)
          .map((cb) => cb.dataset.url);

        if (!selected.length) {
          alert('カテゴリを除去するスタンプを選択してください');
          return;
        }

        if (
          !window.otsumamiWS ||
          typeof window.otsumamiWS.sendStampCategoryRemoveFromStamps !== 'function'
        ) {
          alert('スタンプ管理サーバに接続されていません。');
          return;
        }

        selectedOptions.forEach(categoryId => {
          window.otsumamiWS.sendStampCategoryRemoveFromStamps(selected, categoryId);
        });
      });
    }
  }

  // ==== カテゴリ追加ボタン ====
  const addCategoryBtn = document.getElementById('addCategoryBtn');
  if (addCategoryBtn) {
    addCategoryBtn.addEventListener('click', () => {
      const getCurrentRole = () => {
        return window.state?.role || window.otsumamiRole || window.localStorage.getItem('otsumami-role') || 'viewer';
      };
      if (getCurrentRole() !== 'host') {
        alert('カテゴリ追加はホストのみ可能です');
        return;
      }
      const idInput = document.getElementById('newCategoryId');
      const labelInput = document.getElementById('newCategoryLabel');
      const id = (idInput?.value || '').trim();
      const label = (labelInput?.value || '').trim();
      if (!id || !label) {
        alert('IDとラベルを入力してください');
        return;
      }
      if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
        alert('IDは英数字、ハイフン、アンダースコアのみ使用できます');
        return;
      }
      if (window.otsumamiWS && typeof window.otsumamiWS.sendStampCategoryAddRequest === 'function') {
        window.otsumamiWS.sendStampCategoryAddRequest(id, label);
        idInput.value = '';
        labelInput.value = '';
      }
    });
  }
// ===== セキュリティ：ローカルスタンプUIはホスト（localhost）のみ表示 =====
(function hideLocalStampUI() {
  const host = location.hostname;
  const isLocal = host === 'localhost' || host === '127.0.0.1';

  if (!isLocal) {
    // 📁ファイルボタンだけを隠す
    const fileButton = document.querySelector('button[onclick*="stampLocalAdd"]');
    if (fileButton) {
      fileButton.style.display = 'none';
    }
    
    console.log('[StampsTab] リモート環境：ローカルスタンプUIを非表示');
  }
})();

  // ==== ローカルファイル追加 ====
  const localFileInput = document.getElementById('stampLocalAdd');
  if (localFileInput) {
    localFileInput.addEventListener('change', async (e) => {
      // ===== セキュリティ：ローカルホスト以外は即拒否 =====
      const host = location.hostname;
      const isLocal = host === 'localhost' || host === '127.0.0.1';

      if (!isLocal) {
        console.warn('[StampsTab] リモート環境からのローカルスタンプ追加を拒否');
        alert('ローカルファイルからのスタンプ追加はホストのみ可能です');
        e.target.value = '';
        return;
      }

      const file = e.target.files[0];
      if (!file) return;

      const validTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'video/mp4', 'video/webm'];
      if (!validTypes.includes(file.type)) {
        alert('対応形式: PNG, JPEG, GIF, WebP, MP4, WebM');
        return;
      }

      const sizeMB = (file.size / 1024 / 1024).toFixed(2);
      if (file.size > 100 * 1024 * 1024) {
        if (!confirm(`ファイルサイズが ${sizeMB}MB と大きいですが、追加しますか？\n（ストレージを消費します）`)) {
          return;
        }
      }

      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        const base64 = typeof result === 'string' ? result.split(',')[1] || '' : '';

        if (!base64) {
          console.warn('[Stamps] Base64 に変換できませんでした');
          return;
        }

        const ws = window.otsumamiWs;
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          console.warn('[Stamps] WebSocket未接続のためローカルスタンプを追加できません');
          if (window.alertWithFocus) {
            window.alertWithFocus('スタンプを追加するには配信に接続している必要があります');
          } else {
            alert('スタンプを追加するには配信に接続している必要があります');
          }
          return;
        }

        ws.send(JSON.stringify({
          type: 'stamp-add-local',
          filename: file.name,
          fileData: base64
        }));

        console.log(`✅ ローカルスタンプ送信: ${file.name} (${sizeMB}MB)`);
      };

      reader.readAsDataURL(file);
    });
  }

  if (thumbRebuildSelectedBtn) {
    thumbRebuildSelectedBtn.addEventListener('click', () => {
      const getCurrentRole = () => {
        return window.state?.role || window.otsumamiRole || window.localStorage.getItem('otsumami-role') || 'viewer';
      };

      const r = getCurrentRole();
      if (r !== 'host') {
        alert('サムネイル再生成はホストのみ可能です');
        return;
      }

      if (!window.stampEditMode) {
        alert('整理モードで再生成対象を選択してください');
        return;
      }

      const selected = [...document.querySelectorAll('.stamp-delete-checkbox')]
        .filter((cb) => cb.checked && cb.dataset.url)
        .map((cb) => cb.dataset.url);

      if (!selected.length) {
        alert('再生成するスタンプを選択してください');
        return;
      }

      const confirmed = confirm(`選択した${selected.length}件のサムネイルを再生成します。続行しますか？`);
      if (!confirmed) {
        return;
      }

      if (
        !window.otsumamiWS ||
        typeof window.otsumamiWS.sendStampThumbRebuildSelectedRequest !== 'function'
      ) {
        alert('スタンプ管理サーバに接続されていません。');
        return;
      }

      window.otsumamiWS.sendStampThumbRebuildSelectedRequest(selected);
    });
  }

  if (thumbRebuildAllBtn) {
    thumbRebuildAllBtn.addEventListener('click', () => {
      const getCurrentRole = () => {
        return window.state?.role || window.otsumamiRole || window.localStorage.getItem('otsumami-role') || 'viewer';
      };

      const r = getCurrentRole();
      if (r !== 'host') {
        alert('サムネイル再生成はホストのみ可能です');
        return;
      }

      const confirmed = confirm('全スタンプのサムネイルを再生成します。件数が多いと時間がかかります。続行しますか？');
      if (!confirmed) {
        return;
      }

      if (
        !window.otsumamiWS ||
        typeof window.otsumamiWS.sendStampThumbRebuildAllRequest !== 'function'
      ) {
        alert('スタンプ管理サーバに接続されていません。');
        return;
      }

      window.otsumamiWS.sendStampThumbRebuildAllRequest();
    });
  }
  
  console.log('[StampsTab] スタンプ管理UIの初期化完了');
}
