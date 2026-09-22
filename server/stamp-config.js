/**
 * OtsumamiCast - スタンプ設定管理
 * 
 * ホストが設定可能な項目：
 * - ファイルサイズ上限（1MB～50MB）
 * - 最大スタンプ数（100～1000 or 無制限）
 * - リスナーのスタンプ追加権限（3段階）
 * - 許可するDiscordサーバーID
 */

const fs = require('fs').promises;
const path = require('path');

class StampConfig {
  constructor(configPath) {
    this.configPath = configPath;
    this.config = this.getDefaultConfig();
  }

  /**
   * デフォルト設定を取得
   */
  getDefaultConfig() {
    return {
      version: 1,
      
      // ファイルサイズ制限（MB）
      maxFileSize: 5,
      
      // 最大スタンプ数（0 = 無制限）
      maxStampCount: 100,
      
      // リスナーのスタンプ追加権限
      // 'host-only' | 'discord-only' | 'discord-and-other'
      listenerAddPermission: 'host-only',
      
      // 動画スタンプ音量設定
      videoVolume: 50, // 0-100
      muteVideo: false,
      
      // スタンプ表示時間（秒）
      stampDuration: 3, // 1-10秒

      // スタンプ規定サイズ（px）
      stampBaseSize: 220, // 120-480px

      // 一覧サムネイルを静止画のみ表示（負荷軽減）
      staticThumbnailPreview: false,

      // サムネイルにマウスを合わせたとき拡大表示（ホスト）
      thumbnailHoverZoom: false,
      
      // 着信音設定
      stampSound: 'sound1', // 'sound1', 'sound2', 'sound3', 'sound4', 'random'
      stampSoundVolume: 50, // 0-100
      
      // 許可するDiscordサーバーID（複数可）
      allowedDiscordServerIds: [],
      
      // Discordサーバーのパスワード保護
      discordServerPasswords: {}, // { serverId: 'password', ... }
      // グローバルDiscordパスワード
      discordPassword: null,
      
      // その他の設定
      createdAt: Date.now(),
      updatedAt: Date.now(),

      // カテゴリ一覧
      categories: [
        { id: 'joy',   label: '😆喜' },
        { id: 'anger', label: '💢怒' },
        { id: 'sad',   label: '😢哀' },
        { id: 'fun',   label: '😎楽' },
        { id: 'other', label: '📢他' }
      ]
    };
  }

  /**
   * 初期化：設定ファイルを読み込む
   */
  async initialize() {
    try {
      const data = await fs.readFile(this.configPath, 'utf8');
      this.config = JSON.parse(data);
      // categories が無ければデフォルトを追加
      if (!Array.isArray(this.config.categories)) {
        this.config.categories = this.getDefaultConfig().categories;
        await this.save();
      }
      console.log('✅ スタンプ設定を読み込みました');
    } catch (error) {
      if (error.code === 'ENOENT') {
        // ファイルが無ければデフォルト設定で作成
        await this.save();
        console.log('✅ スタンプ設定ファイルを新規作成しました');
      } else {
        console.error('❌ スタンプ設定読み込み失敗:', error);
        this.config = this.getDefaultConfig();
      }
    }
  }

  /**
   * 設定を保存
   */
  async save() {
    try {
      this.config.updatedAt = Date.now();
      await fs.writeFile(
        this.configPath,
        JSON.stringify(this.config, null, 2),
        'utf8'
      );
      console.log('✅ スタンプ設定を保存しました');
    } catch (error) {
      console.error('❌ スタンプ設定保存失敗:', error);
      throw error;
    }
  }

  /**
   * 全設定を取得
   */
  getAll() {
    return { ...this.config };
  }

  /**
   * ファイルサイズ上限を設定（MB）
   * @param {number} sizeMB - 1～50
   */
  async setMaxFileSize(sizeMB) {
    if (sizeMB < 1 || sizeMB > 50) {
      throw new Error('ファイルサイズは1～50MBの範囲で設定してください');
    }
    this.config.maxFileSize = sizeMB;
    await this.save();
  }

  /**
   * 最大スタンプ数を設定
   * @param {number|string} count - 100, 200, 300, 500, 1000, or 'unlimited'
   */
  async setMaxStampCount(count) {
    const validValues = [100, 200, 300, 500, 1000, 0]; // 0 = 無制限
    const numCount = count === 'unlimited' ? 0 : parseInt(count, 10);
    
    if (!validValues.includes(numCount)) {
      throw new Error('最大スタンプ数は100, 200, 300, 500, 1000, または無制限で設定してください');
    }
    
    this.config.maxStampCount = numCount;
    await this.save();
  }

  /**
   * リスナーのスタンプ追加権限を設定
   * @param {string} permission - 'host-only' | 'discord-only' | 'discord-and-other'
   */
  async setListenerAddPermission(permission) {
    const validPermissions = ['host-only', 'discord-only', 'discord-and-other'];
    
    if (!validPermissions.includes(permission)) {
      throw new Error('権限設定が不正です');
    }
    
    this.config.listenerAddPermission = permission;
    await this.save();
  }

  /**
   * 許可するDiscordサーバーIDを追加
   * @param {string} serverId - DiscordサーバーID
   * @param {string} password - パスワード（オプション）
   */
  async addAllowedDiscordServer(serverId, password = null) {
    if (!serverId || typeof serverId !== 'string') {
      throw new Error('サーバーIDが不正です');
    }
    
    // 既に存在する場合はスキップ
    if (!this.config.allowedDiscordServerIds.includes(serverId)) {
      this.config.allowedDiscordServerIds.push(serverId);
    }
    
    // パスワード設定
    if (password) {
      this.config.discordServerPasswords[serverId] = password;
    }
    
    await this.save();
  }

  /**
   * 許可するDiscordサーバーIDを削除
   * @param {string} serverId - DiscordサーバーID
   */
  async removeAllowedDiscordServer(serverId) {
    this.config.allowedDiscordServerIds = this.config.allowedDiscordServerIds.filter(
      id => id !== serverId
    );
    
    // パスワードも削除
    delete this.config.discordServerPasswords[serverId];
    
    await this.save();
  }

  /**
   * Discordパスワードを設定
   * @param {string} password - パスワード（オプション）
   */
  async setDiscordPassword(password = null) {
    // グローバルなDiscordパスワードを設定
    if (password) {
      this.config.discordPassword = password;
    } else {
      delete this.config.discordPassword;
    }
    await this.save();
  }

  /**
   * Discordサーバーが許可されているか確認
   * @param {string} serverId - DiscordサーバーID
   * @param {string} password - パスワード（オプション）
   * @returns {boolean}
   */
  isDiscordServerAllowed(serverId, password = null) {
    // ホストのみ設定の場合は許可しない
    if (this.config.listenerAddPermission === 'host-only') {
      return false;
    }
    
    if (this.config.allowedDiscordServerIds.length === 0) {
      return true;
    }

    // サーバーIDが許可リストに含まれているか確認
    if (!this.config.allowedDiscordServerIds.includes(serverId)) {
      return false;
    }
    
    // パスワード保護がある場合は確認
    const requiredPassword = this.config.discordServerPasswords[serverId];
    if (requiredPassword && password !== requiredPassword) {
      return false;
    }
    
    return true;
  }

  /**
   * リスナーがスタンプを追加できるか確認
   * @param {string} sourceType - 'discord' | 'imgur' | 'other'
   * @param {string} serverId - DiscordサーバーID（sourceTypeが'discord'の場合）
   * @param {string} password - パスワード（オプション）
   * @returns {boolean}
   */
  canListenerAddStamp(sourceType, serverId = null, password = null) {
    const permission = this.config.listenerAddPermission;
    
    // ホストのみ設定
    if (permission === 'host-only') {
      return false;
    }

    if (this.config.discordPassword && password !== this.config.discordPassword) {
      return false;
    }
    
    // Discordのみ許可
    if (permission === 'discord-only') {
      if (sourceType !== 'discord') {
        return false;
      }
      // Discordサーバーの確認
      return this.isDiscordServerAllowed(serverId, password);
    }
    
    // Discord + その他を許可
    if (permission === 'discord-and-other') {
      if (sourceType === 'discord') {
        // Discordの場合はサーバーID確認
        return this.isDiscordServerAllowed(serverId, password);
      }
      // その他のURLは許可
      return true;
    }
    
    return false;
  }

  /**
   * スタンプ数が上限に達しているか確認
   * @param {number} currentCount - 現在のスタンプ数
   * @returns {boolean}
   */
  isStampCountLimitReached(currentCount) {
    const maxCount = this.config.maxStampCount;
    
    // 無制限の場合
    if (maxCount === 0) {
      return false;
    }
    
    return currentCount >= maxCount;
  }

  /**
   * ファイルサイズが制限内か確認（バイト数）
   * @param {number} fileSizeBytes - ファイルサイズ（バイト）
   * @returns {boolean}
   */
  isFileSizeValid(fileSizeBytes) {
    const maxSizeBytes = this.config.maxFileSize * 1024 * 1024;
    return fileSizeBytes <= maxSizeBytes;
  }

  getCategories() {
    return Array.isArray(this.config.categories) ? this.config.categories : [];
  }

  async addCategory(id, label) {
    if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,40}$/.test(id) || ['all', '__proto__', 'constructor', 'prototype'].includes(id)) {
      throw new Error('カテゴリIDが不正です');
    }
    if (!label || typeof label !== 'string' || label.length > 80) {
      throw new Error('カテゴリラベルが不正です');
    }
    if (!Array.isArray(this.config.categories)) {
      this.config.categories = [];
    }
    if (this.config.categories.some(c => c.id === id)) {
      throw new Error('同じIDのカテゴリが既に存在します');
    }
    this.config.categories.push({ id, label });
    await this.save();
  }

  async deleteCategory(id) {
    if (!Array.isArray(this.config.categories)) return;
    this.config.categories = this.config.categories.filter(c => c.id !== id);
    await this.save();
  }
}

module.exports = StampConfig;
