// ===== ユーティリティ関数 =====

/**
 * YouTube URLから動画IDを抽出
 * @param {string} url - YouTube URL
 * @returns {string|null} - 動画ID、失敗時はnull
 */
export function parseVideoId(url) {
  try {
    // プロトコルがなければ追加
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    
    const u = new URL(url);
    
    // youtu.be 形式
    if (u.hostname === 'youtu.be' || u.hostname === 'www.youtu.be') {
      return u.pathname.slice(1).split('?')[0];
    }
    
    // youtube.com 形式
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v');
      if (v) return v;
    }
    
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * IPアドレスの妥当性チェック
 * @param {string} ip - IPアドレス文字列
 * @returns {boolean} - 妥当な場合true
 */
export function validateIpAddress(ip) {
  const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (!ipPattern.test(ip)) return false;
  
  const parts = ip.split('.');
  return parts.every(part => {
    const num = parseInt(part, 10);
    return num >= 0 && num <= 255;
  });
}

/**
 * 秒数を HH:MM:SS 形式にフォーマット
 * @param {number} seconds - 秒数
 * @returns {string} - フォーマット済み時間文字列
 */
export function formatTime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  
  const pad = (n) => n.toString().padStart(2, '0');
  
  if (h > 0) {
    return `${h}:${pad(m)}:${pad(s)}`;
  }
  return `${m}:${pad(s)}`;
}

/**
 * デバウンス関数（連続呼び出しを制限）
 * @param {Function} func - 実行する関数
 * @param {number} wait - 待機時間（ミリ秒）
 * @returns {Function} - デバウンスされた関数
 */
export function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

/**
 * ステータスバーにメッセージを表示
 * @param {string} msg - 表示するメッセージ
 */
export function logStatus(msg) {
  const statusElement = document.getElementById('status');
  if (statusElement) {
    statusElement.textContent = 'ステータス: ' + msg;
  }
  console.log(`[Status] ${msg}`);
}

/**
 * 安全にalert/toastを呼び出す
 * @param {string} message - 表示するメッセージ
 * @param {string} type - トーストタイプ（'info', 'success', 'warning', 'error'）
 */
export function showMessage(message, type = 'info') {
  if (window.showToast) {
    window.showToast(message, type);
  } else if (window.alertWithFocus) {
    window.alertWithFocus(message);
  } else {
    alert(message);
  }
}

/**
 * 外部ブラウザでURLを開く
 * @param {string} url - 開くURL
 */
export async function openInBrowser(url) {
  try {
    if (window.electronAPI?.openExternal) {
      await window.electronAPI.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  } catch (e) {
    console.error('外部ブラウザで開けませんでした:', e);
    window.open(url, '_blank');
  }
}
