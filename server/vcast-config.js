const fs = require('fs').promises;

class VcastConfig {
  constructor(configPath) {
    this.configPath = configPath;
    this.config = {
      avatarImage: '',
      animation: 'none',
      idleAnimation: 'none',
      animationSpeed: 1.0,
      idleIntensity: 100,
      voiceReaction: false,
      voiceSensitivity: 50,
      voiceThreshold: 50,
      micIntensity: 100,
      micAnimation: 'none',
      micDeviceId: 'default',
      size: 150,
      position: 'bottom-right',
      enabled: false,
      showPoints: true
    };
  }

  async initialize() {
    try {
      const data = await fs.readFile(this.configPath, 'utf8');
      const loaded = JSON.parse(data);
      if (loaded && typeof loaded === 'object') {
        this.config = {
          ...this.config,
          ...loaded
        };
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        await this.save();
      } else {
        console.error('[VcastConfig] 読み込み失敗:', error);
      }
    }
  }

  getAll() {
    return { ...this.config };
  }

  async update(newConfig) {
    this.config = {
      ...this.config,
      ...newConfig
    };
    await this.save();
  }

  async save() {
    await fs.writeFile(
      this.configPath,
      JSON.stringify(this.config, null, 2),
      'utf8'
    );
  }
}

module.exports = VcastConfig;
