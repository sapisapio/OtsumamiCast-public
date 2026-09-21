const fs = require('fs').promises;
const path = require('path');

class OhinerimakiConfig {
  constructor(configPath, notificationsPath) {
    this.configPath = configPath;
    this.notificationsPath = notificationsPath;
    this.config = {
      links: {
        amazonWishlist: '',
        amazonGiftEmail: '',
        qrImage: ''
      },
      soundVolume: 50
    };
    this.notifications = [];
  }

  async initialize() {
    await this.ensureDirectory();
    await this.loadConfig();
    await this.loadNotifications();
  }

  async ensureDirectory() {
    const dir = path.dirname(this.configPath);
    await fs.mkdir(dir, { recursive: true });
  }

  async loadConfig() {
    try {
      const data = await fs.readFile(this.configPath, 'utf8');
      const loaded = JSON.parse(data);
      if (loaded && typeof loaded === 'object') {
        this.config = {
          ...this.config,
          ...loaded,
          links: {
            ...this.config.links,
            ...(loaded.links || {})
          }
        };
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        await this.saveConfig();
      } else {
        console.error('[OhinerimakiConfig] 設定読み込み失敗:', error);
      }
    }
  }

  async loadNotifications() {
    try {
      const data = await fs.readFile(this.notificationsPath, 'utf8');
      const loaded = JSON.parse(data);
      this.notifications = Array.isArray(loaded) ? loaded : [];
    } catch (error) {
      if (error.code === 'ENOENT') {
        await this.saveNotifications();
      } else {
        console.error('[OhinerimakiConfig] 通知読み込み失敗:', error);
      }
    }
  }

  getConfig() {
    return { ...this.config };
  }

  getNotifications() {
    return [...this.notifications];
  }

  async updateConfig(newConfig) {
    this.config = {
      ...this.config,
      ...newConfig,
      links: {
        ...this.config.links,
        ...(newConfig.links || {})
      }
    };
    await this.saveConfig();
  }

  async addNotification(notification) {
    this.notifications.push(notification);
    await this.saveNotifications();
  }

  async deleteNotification(id) {
    const before = this.notifications.length;
    this.notifications = this.notifications.filter(item => item.id !== id);
    if (this.notifications.length !== before) {
      await this.saveNotifications();
      return true;
    }
    return false;
  }

  async saveConfig() {
    try {
      await fs.writeFile(
        this.configPath,
        JSON.stringify(this.config, null, 2),
        'utf8'
      );
    } catch (error) {
      console.error('[OhinerimakiConfig] 設定保存失敗:', error);
      throw error;
    }
  }

  async saveNotifications() {
    try {
      await fs.writeFile(
        this.notificationsPath,
        JSON.stringify(this.notifications, null, 2),
        'utf8'
      );
    } catch (error) {
      console.error('[OhinerimakiConfig] 通知保存失敗:', error);
      throw error;
    }
  }
}

module.exports = OhinerimakiConfig;
