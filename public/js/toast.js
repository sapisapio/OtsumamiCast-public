// ===== トースト通知システム =====

// トーストコンテナを作成
let toastContainer = null;

function getToastContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

// アイコンマップ
const TOAST_ICONS = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️'
};

// トースト表示関数
function showToast(message, type = 'info', duration = 4000) {
  const container = getToastContainer();
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icon = document.createElement('div');
  icon.className = 'toast-icon';
  icon.textContent = TOAST_ICONS[type] || TOAST_ICONS.info;
  
  const messageDiv = document.createElement('div');
  messageDiv.className = 'toast-message';
  messageDiv.textContent = message;
  
  const closeBtn = document.createElement('button');
  closeBtn.className = 'toast-close';
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', () => {
    removeToast(toast);
  });
  
  toast.appendChild(icon);
  toast.appendChild(messageDiv);
  toast.appendChild(closeBtn);
  
  container.appendChild(toast);
  
  console.log(`Toast [${type}]: ${message}`);
  
  // 自動で消す
  if (duration > 0) {
    setTimeout(() => {
      removeToast(toast);
    }, duration);
  }
  
  return toast;
}

function removeToast(toast) {
  if (!toast || !toast.parentElement) return;
  
  toast.classList.add('closing');
  setTimeout(() => {
    toast.remove();
  }, 300);
}

// alert互換のラッパー関数
window.toast = showToast;

// alertWithFocusをtoastで置き換え
window.alertWithFocus = function(message) {
  // メッセージの内容から種類を判定
  let type = 'info';
  
  if (message.includes('✅') || message.includes('成功')) {
    type = 'success';
  } else if (message.includes('❌') || message.includes('エラー') || message.includes('失敗')) {
    type = 'error';
  } else if (message.includes('⚠️') || message.includes('警告') || message.includes('注意')) {
    type = 'warning';
  }
  
  // 絵文字を除去（CSSで表示するため）
  message = message.replace(/[✅❌⚠️ℹ️]/g, '').trim();
  
  showToast(message, type);
};

// 従来のalertも置き換え（オプション）
window.alert = window.alertWithFocus;

console.log('Toast notification system initialized');
