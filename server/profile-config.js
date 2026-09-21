// server/profile-config.js
// プロフィール設定の管理

const fs = require('fs').promises;
const path = require('path');

class ProfileConfig {
  constructor(configPath) {
    this.configPath = configPath;
    this.config = {
      profile: {
        name: '',
        furigana: '',
        nickname: '',
        favorite: '',
        location: '',
        startYear: '',
        activeTime: '',
        links: [],
        photo: '',
        skin: 'basic',
        freeFormItems: [
          {
            id: 'default-rules',
            title: 'ローカルルール',
            content: ''
          }
        ]
      },
      features: {
        otsumami: true,
        stamps: true,
        ohinerimaki: false,
        vcast: false
      },
      bannedIps: []
    };
  }

  /**
   * 初期化
   */
  async initialize() {
    try {
      // 設定ファイルが存在するか確認
      try {
        await fs.access(this.configPath);
      } catch {
        // 存在しない場合はデフォルト設定で作成
        await this.save();
        console.log('[ProfileConfig] デフォルト設定ファイルを作成しました');
        return;
      }

      // 設定ファイルを読み込み
      const data = await fs.readFile(this.configPath, 'utf8');
      const loadedConfig = JSON.parse(data);
      
      // ★ 古い形式（オブジェクト）を新形式（配列）に変換
      if (loadedConfig.profile && loadedConfig.profile.links) {
        if (!Array.isArray(loadedConfig.profile.links)) {
          console.log('[ProfileConfig] 古いリンク形式を検出 → 空配列に変換');
          loadedConfig.profile.links = [];
        }
      }

      if (loadedConfig.profile) {
        loadedConfig.profile.furigana = loadedConfig.profile.furigana || '';
        loadedConfig.profile.nickname = loadedConfig.profile.nickname || '';
        loadedConfig.profile.favorite = loadedConfig.profile.favorite || '';
        loadedConfig.profile.location = loadedConfig.profile.location || '';
        loadedConfig.profile.startYear = loadedConfig.profile.startYear || '';
        loadedConfig.profile.activeTime = loadedConfig.profile.activeTime || '';
        if (!loadedConfig.profile.skin) {
          loadedConfig.profile.skin = 'basic';
        }
        
        // 古いextraItemsをfreeFormItemsに変換
        if (loadedConfig.profile.extraItems && !loadedConfig.profile.freeFormItems) {
          console.log('[ProfileConfig] extraItems → freeFormItems に変換');
          loadedConfig.profile.freeFormItems = loadedConfig.profile.extraItems;
          delete loadedConfig.profile.extraItems;
        }
        
        // freeFormItemsが存在しない場合はデフォルトを設定
        if (!Array.isArray(loadedConfig.profile.freeFormItems)) {
          loadedConfig.profile.freeFormItems = [
            {
              id: 'default-rules',
              title: 'ローカルルール',
              content: loadedConfig.profile.rules || ''
            }
          ];
        }
        
        // 古いrulesフィールドを削除
        delete loadedConfig.profile.rules;
      }

      if (!Array.isArray(loadedConfig.bannedIps)) {
        loadedConfig.bannedIps = [];
      }
      
      this.config = loadedConfig;
      console.log('[ProfileConfig] 設定を読み込みました');
    } catch (error) {
      console.error('[ProfileConfig] 初期化エラー:', error);
      // エラー時はデフォルト設定を使用
    }
  }

  /**
   * 設定を取得
   */
  getAll() {
    return this.config;
  }

  getBannedIps() {
    return Array.isArray(this.config.bannedIps) ? this.config.bannedIps : [];
  }

  normalizeIp(ip) {
    if (typeof ip !== 'string') return '';
    const trimmed = ip.trim();
    return trimmed.startsWith('::ffff:') ? trimmed.replace('::ffff:', '') : trimmed;
  }

  isIpBanned(ip) {
    const normalized = this.normalizeIp(ip);
    if (!normalized) return false;
    return this.getBannedIps().includes(normalized);
  }

  async addBannedIp(ip) {
    const normalized = this.normalizeIp(ip);
    if (!normalized) return;
    const list = this.getBannedIps();
    if (!list.includes(normalized)) {
      list.push(normalized);
      this.config.bannedIps = list;
      await this.save();
    }
  }

  async removeBannedIp(ip) {
    const normalized = this.normalizeIp(ip);
    if (!normalized) return;
    const list = this.getBannedIps().filter((item) => item !== normalized);
    this.config.bannedIps = list;
    await this.save();
  }

  /**
   * 設定を更新
   */
  async update(newConfig) {
    this.config = {
      ...this.config,
      ...newConfig
    };
    await this.save();
  }

  /**
   * 設定を保存
   */
  async save() {
    try {
      await fs.writeFile(
        this.configPath,
        JSON.stringify(this.config, null, 2),
        'utf8'
      );
      console.log('[ProfileConfig] 設定を保存しました');
    } catch (error) {
      console.error('[ProfileConfig] 保存エラー:', error);
      throw error;
    }
  }
}

module.exports = ProfileConfig;
