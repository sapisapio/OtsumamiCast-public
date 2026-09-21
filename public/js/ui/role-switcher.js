// ===== ロール切り替え機能 =====

import { state, logStatus } from '../main.js';
import { initPlayerIfReady } from '../player.js';

/**
 * ロール切り替え機能を初期化
 */
export function initRoleSwitcher() {
  const hostBtn = document.getElementById('hostBtn');
  const viewerBtn = document.getElementById('viewerBtn');
  
  if (hostBtn) {
    hostBtn.addEventListener('click', () => switchRole('host'));
  }
  
  if (viewerBtn) {
    viewerBtn.addEventListener('click', () => switchRole('viewer'));
  }
  
  console.log('[RoleSwitcher] Initialized');
}

/**
 * ロールを切り替える
 * @param {string} newRole - 新しいロール（'host' または 'viewer'）
 */
function switchRole(newRole) {
  // ★ ホスト中の切り替えを完全に禁止
  if (state.hosting && newRole !== state.role) {
    const currentRole = state.role; // ★ 現在のロールを保存
    
    if (window.alertWithFocus) {
      window.alertWithFocus('ホスト中です。\n\n他の配信を視聴したい場合は、右上の「ブラウザで開く」ボタンから別ウィンドウで開いてください。');
    } else {
      alert('ホスト中です。\n\n他の配信を視聴したい場合は、右上の「ブラウザで開く」ボタンから別ウィンドウで開いてください。');
    }
    
    // ★ ボタンを元に戻す（保存したロールを使用）
    setTimeout(() => {
      updateRoleButtons(currentRole);
    }, 0);
    return; // ★ ここでreturnするので、以下の処理は実行されない
  }

  state.role = newRole;

  // UI要素を取得
  const hostBtn = document.getElementById('hostBtn');
  const viewerBtn = document.getElementById('viewerBtn');
  const hostContent = document.getElementById('hostContent');
  const viewerContent = document.getElementById('viewerContent');
  const hostConnectionLine = document.getElementById('hostConnectionLine');
  const viewerConnectionLine = document.getElementById('viewerConnectionLine');
  const hostUrlSection = document.getElementById('hostUrlSection');

  if (state.role === 'host') {
    // ホストモードUI
    if (hostBtn) hostBtn.classList.add('active');
    if (viewerBtn) viewerBtn.classList.remove('active');
    if (hostContent) hostContent.style.display = 'block';
    if (viewerContent) viewerContent.style.display = 'none';
    if (hostConnectionLine) hostConnectionLine.classList.add('active');
    if (viewerConnectionLine) viewerConnectionLine.classList.remove('active');
    
    // ホスト状態に応じてURL入力欄を制御
    if (hostUrlSection) {
      if (state.hosting) {
        hostUrlSection.classList.remove('disabled-overlay');
        hostUrlSection.querySelectorAll('input, button').forEach(el => el.disabled = false);
      } else {
        hostUrlSection.classList.add('disabled-overlay');
        hostUrlSection.querySelectorAll('input, button').forEach(el => el.disabled = true);
      }
    }
  } else {
    // リスナーモードUI
    if (viewerBtn) viewerBtn.classList.add('active');
    if (hostBtn) hostBtn.classList.remove('active');
    if (hostContent) hostContent.style.display = 'none';
    if (viewerContent) viewerContent.style.display = 'block';
    if (hostConnectionLine) hostConnectionLine.classList.remove('active');
    if (viewerConnectionLine) viewerConnectionLine.classList.add('active');
  }

  // ホスト設定セクションの表示制御
  const hostStampSettingsSection = document.getElementById('hostStampSettingsSection');
  if (hostStampSettingsSection) {
    if (state.role === 'host') {
      hostStampSettingsSection.style.display = 'block';
    } else {
      hostStampSettingsSection.style.display = 'none';
    }
  }

  // ロール変更イベントを発火
  window.otsumamiRole = newRole;
  window.localStorage.setItem('otsumami-role', newRole);
  window.dispatchEvent(new CustomEvent('otsumamiRoleChanged', { detail: { role: newRole } }));

  // プレイヤーを再初期化
  if (state.player) {
    state.player.destroy();
    state.player = null;
  }
  initPlayerIfReady();
  
  logStatus(`モード切替: ${newRole === 'host' ? '配信者' : 'リスナー'}`);
}

/**
 * ロールボタンの表示を更新（内部用）
 * @param {string} role - 現在のロール
 */
function updateRoleButtons(role) {
  const hostBtn = document.getElementById('hostBtn');
  const viewerBtn = document.getElementById('viewerBtn');
  
  // 全てのactiveを削除
  if (hostBtn) hostBtn.classList.remove('active');
  if (viewerBtn) viewerBtn.classList.remove('active');
  
  // 正しいボタンにactiveを追加
  if (role === 'host') {
    if (hostBtn) hostBtn.classList.add('active');
  } else {
    if (viewerBtn) viewerBtn.classList.add('active');
  }
}