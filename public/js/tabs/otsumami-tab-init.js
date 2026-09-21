// js/tabs/otsumami-tab-init.js
// おつまみタブ専用の初期化処理

/**
 * おつまみタブの初期化
 * タブが読み込まれた後に必ず実行される
 */
export async function initOtsumamiTab() {
  console.log('[OtsumamiTab] 初期化開始');

  window.dispatchEvent(new Event('otsumamiTabReady'));

  // ★ YouTubeプレイヤーを初期化
  await initYouTubePlayer();
  
  // ★ おつまみタブ内のボタンにイベントリスナーを設定
  initTabButtons();
  initViewerDelaySlider();
  
  // キュー機能の初期化
  await initQueueFeature();
  
  // ロール変更時のコンテンツ表示制御
  updateOtsumamiContentVisibility();
  window.addEventListener('otsumamiRoleChanged', updateOtsumamiContentVisibility);
  
  // ホスト状態の変更を監視（URL入力欄の有効化/無効化）
  updateHostUrlSectionState();
  window.addEventListener('hostingStateChanged', (e) => {
    console.log('[OtsumamiTab] ホスト状態変更イベント受信:', e.detail);
    updateHostUrlSectionState();
  });
  
  console.log('[OtsumamiTab] 初期化完了');
}

/**
 * リスナー側ディレイスライダー初期化
 * タブ動的読み込み後に必ず再バインドする
 */
function initViewerDelaySlider() {
  const slider = document.getElementById('offsetSlider');
  const label = document.getElementById('offsetLabel');
  if (!slider || !label) return;

  const clamp = (value) => {
    const min = Number(slider.min || 0);
    const max = Number(slider.max || 10);
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return min;
    return Math.max(min, Math.min(max, numeric));
  };

  const updateFromValue = (value) => {
    const sec = clamp(value);
    slider.value = String(sec);
    if (window.state) {
      window.state.viewerOffsetSec = sec;
    }
    label.textContent = `${sec} 秒`;
    localStorage.setItem('otsumami-viewer-offset-sec', String(sec));
  };

  const saved = localStorage.getItem('otsumami-viewer-offset-sec');
  const initial = saved !== null
    ? saved
    : (window.state?.viewerOffsetSec ?? slider.value);
  updateFromValue(initial);

  if (slider.dataset.bound === 'true') {
    return;
  }

  slider.addEventListener('input', () => {
    updateFromValue(slider.value);
  });
  slider.addEventListener('change', () => {
    updateFromValue(slider.value);
  });

  slider.dataset.bound = 'true';
  console.log('[OtsumamiTab] ディレイスライダーを初期化:', slider.value);
}

/**
 * YouTubeプレイヤーの初期化
 */
async function initYouTubePlayer() {
  console.log('[OtsumamiTab] YouTubeプレイヤー初期化開始');
  
  // ★ ホスト/リスナーに応じてコンテンツを表示（playerのdivを表示するため）
  const role = window.state?.role || 'viewer';
  const hostContent = document.getElementById('hostContent');
  const viewerContent = document.getElementById('viewerContent');
  
  if (role === 'host' && hostContent) {
    hostContent.style.display = 'block';
    if (viewerContent) viewerContent.style.display = 'none';
  } else if (role === 'viewer' && viewerContent) {
    viewerContent.style.display = 'block';
    if (hostContent) hostContent.style.display = 'none';
  }
  
  // YouTube IFrame APIが読み込まれるまで待つ
  if (!window.YT || !window.YT.Player) {
    console.log('[OtsumamiTab] YouTube IFrame APIが未読み込み - 待機中...');
    await new Promise((resolve) => {
      const checkYT = setInterval(() => {
        if (window.YT && window.YT.Player) {
          clearInterval(checkYT);
          resolve();
        }
      }, 100);
      
      // 10秒でタイムアウト
      setTimeout(() => {
        clearInterval(checkYT);
        resolve();
      }, 10000);
    });
  }
  
  if (!window.YT || !window.YT.Player) {
    console.error('[OtsumamiTab] YouTube IFrame APIの読み込みに失敗');
    return;
  }
  
  // プレイヤーが既に存在する場合はスキップ
  if (window.state?.player && typeof window.state.player.loadVideoById === 'function') {
    console.log('[OtsumamiTab] YouTubeプレイヤーは既に初期化済み');
    return;
  }
  
  const { initPlayerIfReady } = await import('../player.js');

const start = Date.now();
const timeout = 8000;

while (Date.now() - start < timeout) {
  const ok = initPlayerIfReady();

  if (
    window.state?.player &&
    typeof window.state.player.loadVideoById === 'function'
  ) {
    console.log('[OtsumamiTab] YouTubeプレイヤー初期化完了');
    return;
  }

  await new Promise(r => setTimeout(r, 100));
}

console.warn('[OtsumamiTab] YouTubeプレイヤー初期化タイムアウト');
}

/**
 * おつまみタブ内のボタンにイベントリスナーを設定
 */
function initTabButtons() {
  console.log('[OtsumamiTab] ボタン初期化開始');
  
  // ★ コンパクトモード切替ボタン
  const minimumModeBtn = document.getElementById('minimumModeBtn');
  if (minimumModeBtn && !minimumModeBtn.dataset.initialized) {
    minimumModeBtn.addEventListener('click', () => {
      console.log('[OtsumamiTab] コンパクトモードボタンクリック');
      
      // compact.jsの toggleMinimumMode を呼び出す
      if (typeof window.toggleMinimumMode === 'function') {
        window.toggleMinimumMode();
        console.log('[OtsumamiTab] window.toggleMinimumMode() 実行');
      } else {
        console.warn('[OtsumamiTab] toggleMinimumMode が見つかりません');
        // compact.jsのロード待ち
        setTimeout(() => {
          if (typeof window.toggleMinimumMode === 'function') {
            window.toggleMinimumMode();
          } else {
            console.error('[OtsumamiTab] compact.jsが読み込まれていません');
          }
        }, 100);
      }
    });
    minimumModeBtn.dataset.initialized = 'true';
    console.log('[OtsumamiTab] コンパクトモードボタン初期化');
  }

  // 動画読み込みボタン
  const loadBtn = document.getElementById('loadBtn');
  if (loadBtn && !loadBtn.dataset.initialized) {
    loadBtn.addEventListener('click', async () => {
      const { hostLoadVideo } = await import('../player.js');
      hostLoadVideo();
    });
    loadBtn.dataset.initialized = 'true';
    console.log('[OtsumamiTab] 読み込みボタン初期化');
  }

  // クリップボードボタン
  const clipboardBtn = document.getElementById('clipboardBtn');
  if (clipboardBtn && !clipboardBtn.dataset.initialized) {
    clipboardBtn.addEventListener('click', async () => {
      try {
        const { parseVideoId } = await import('../main.js');
        const { showMessage } = await import('../utils.js');
        const { MESSAGES } = await import('../constants.js');
        
        const text = await navigator.clipboard.readText();
        const vid = parseVideoId(text);
        
        if (!vid) {
          showMessage(MESSAGES.CLIPBOARD_INVALID, 'warning');
          return;
        }
        
        // URL入力欄に反映
        const ytUrlInput = document.getElementById('ytUrl');
        if (ytUrlInput) {
          ytUrlInput.value = text;
        }
        
        // ★ hostLoadVideo()を使う
        if (window.state?.role === 'host' && window.state?.hosting) {
          const { hostLoadVideo } = await import('../player.js');
          hostLoadVideo();
        }
      } catch (e) {
        const { showMessage } = await import('../utils.js');
        const { MESSAGES } = await import('../constants.js');
        showMessage(MESSAGES.CLIPBOARD_ERROR, 'error');
        console.error(e);
      }
    });
    clipboardBtn.dataset.initialized = 'true';
    console.log('[OtsumamiTab] クリップボードボタン初期化');
  }

  // ドロップゾーン
  const dropZone = document.getElementById('dropZone');
  if (dropZone && !dropZone.dataset.initialized) {
    console.log('[OtsumamiTab] ドロップゾーンを初期化中...');
    
    // ドラッグオーバー時のスタイル変更
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.style.borderColor = '#0078d4';
      dropZone.style.background = '#e6f2ff';
    });

    dropZone.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.style.borderColor = '#c0c0c0';
      dropZone.style.background = '#fafafa';
    });

    // ドロップ時の処理
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.style.borderColor = '#c0c0c0';
      dropZone.style.background = '#fafafa';

      // ★ getData()は即座に取得する必要がある（asyncの前）
      const url = e.dataTransfer.getData('text/plain') || e.dataTransfer.getData('text/uri-list');

      // 非同期処理
      (async () => {
        const { parseVideoId, logStatus } = await import('../main.js');
        const { showMessage } = await import('../utils.js');
        const { MESSAGES } = await import('../constants.js');

        if (!url) {
          showMessage(MESSAGES.URL_ERROR, 'warning');
          return;
        }

        // YouTube URLかチェック
        const vid = parseVideoId(url);
        if (!vid) {
          showMessage(MESSAGES.NOT_YOUTUBE_URL, 'warning');
          return;
        }

        // URL入力欄に反映
        const ytUrlInput = document.getElementById('ytUrl');
        if (ytUrlInput) {
          ytUrlInput.value = url;
        }

        // ★ hostLoadVideo()を使う
        if (window.state?.role === 'host' && window.state?.hosting) {
          const { hostLoadVideo } = await import('../player.js');
          hostLoadVideo();
        }
      })();
    });
    
    dropZone.dataset.initialized = 'true';
    console.log('[OtsumamiTab] ドロップゾーン初期化完了');
  } else {
    console.log('[OtsumamiTab] ドロップゾーンが見つからないか、既に初期化済み');
  }
  
  console.log('[OtsumamiTab] ボタン初期化完了');
}

/**
 * キュー機能の初期化
 */
async function initQueueFeature() {
  // ★ 既に初期化済みならスキップ
  if (window.otsumamiQueueInitialized) {
    console.log('[OtsumamiTab] キュー機能は既に初期化済み');
    return;
  }
  
  try {
    const { toggleQueue, requestVideo, playNext, updateQueueDisplay } = await import('../queue.js');
    
    // グローバルに公開（他の場所から使えるように）
    window.otsumamiQueue = {
      toggleQueue,
      requestVideo,
      playNext,
      updateQueueDisplay
    };

    // チェックボックスのイベント
    const queueToggle = document.getElementById('queueToggle');
    if (queueToggle) {
      queueToggle.addEventListener('change', (e) => {
        toggleQueue(e.target.checked);
      });
    }

    // キューに追加ボタン
    const addToQueueBtn = document.getElementById('addToQueueBtn');
    if (addToQueueBtn) {
      addToQueueBtn.addEventListener('click', () => {
        const input = document.getElementById('queueUrlInput');
        if (input) {
          requestVideo(input.value);
          input.value = ''; // クリア
        }
      });
    }

    // 次の動画ボタン（ホストのみ）
    const playNextBtn = document.getElementById('playNextBtn');
    if (playNextBtn) {
      playNextBtn.addEventListener('click', () => {
        playNext();
      });
    }

    // ロール変更時の表示切り替え
    function updateQueueUIForRole() {
      // window.state.role を優先的に参照
      const role = window.state?.role || window.otsumamiRole || localStorage.getItem('otsumami-role') || 'viewer';
      
      console.log('[OtsumamiTab] キューUI更新 - ロール:', role);
      
      // チェックボックス行の表示/非表示（ホストのみ表示）
      const queueToggleRow = document.getElementById('queueToggleRow');
      if (queueToggleRow) {
        queueToggleRow.style.display = role === 'host' ? 'block' : 'none';
      }
      
      // 次の動画ボタンの表示/非表示
      const playNextBtn = document.getElementById('playNextBtn');
      if (playNextBtn) {
        playNextBtn.style.display = role === 'host' ? 'inline-block' : 'none';
      }

      // キューリストの表示切り替え
      const hostList = document.getElementById('hostQueueList');
      const viewerList = document.getElementById('viewerQueueList');
      
      if (hostList) hostList.style.display = role === 'host' ? 'block' : 'none';
      if (viewerList) viewerList.style.display = role === 'viewer' ? 'block' : 'none';
    }
    
    // イベントリスナー登録
    window.addEventListener('otsumamiRoleChanged', updateQueueUIForRole);
    
    // 初回実行（state.roleが設定されるまで待つ）
    const checkAndUpdate = () => {
      if (window.state && window.state.role) {
        updateQueueUIForRole();
      } else {
        setTimeout(checkAndUpdate, 50);
      }
    };
    checkAndUpdate();

    // ★ 初期化完了フラグ
    window.otsumamiQueueInitialized = true;
    console.log('[OtsumamiTab] キュー機能初期化完了');
  } catch (error) {
    console.error('[OtsumamiTab] キュー機能初期化失敗:', error);
  }
}

/**
 * ロール変更時のコンテンツ表示制御
 * ホスト/リスナーでコンテンツを切り替える
 */
function updateOtsumamiContentVisibility() {
  const role = window.state?.role || window.otsumamiRole || localStorage.getItem('otsumami-role') || 'viewer';
  
  console.log('[OtsumamiTab] コンテンツ表示更新 - ロール:', role);
  
  const hostContent = document.getElementById('hostContent');
  const viewerContent = document.getElementById('viewerContent');
  
  if (role === 'host') {
    if (hostContent) hostContent.style.display = 'block';
    if (viewerContent) viewerContent.style.display = 'none';
  } else {
    if (hostContent) hostContent.style.display = 'none';
    if (viewerContent) viewerContent.style.display = 'block';
  }
  
  // ホスト状態も更新
  updateHostUrlSectionState();
}

/**
 * ホスト状態に応じてURL入力欄を制御
 */
function updateHostUrlSectionState() {
  const role = window.state?.role || window.otsumamiRole || localStorage.getItem('otsumami-role') || 'viewer';
  const hosting = window.state?.hosting || false;
  const hostUrlSection = document.getElementById('hostUrlSection');
  
  if (!hostUrlSection) return;
  
  console.log('[OtsumamiTab] URL入力欄の状態更新 - ロール:', role, 'ホスト中:', hosting);
  
  // ホストモードで、かつホスト開始済みの場合のみ有効化
  if (role === 'host' && hosting) {
    hostUrlSection.classList.remove('disabled-overlay');
    hostUrlSection.querySelectorAll('input, button').forEach(el => el.disabled = false);
  } else {
    hostUrlSection.classList.add('disabled-overlay');
    hostUrlSection.querySelectorAll('input, button').forEach(el => el.disabled = true);
  }
}
