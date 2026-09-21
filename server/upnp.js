const fs = require('fs').promises;
const path = require('path');
const natUpnp = require('nat-upnp');

const formatUpnpError = (error) => {
  if (!error) {
    return 'UPnPエラーが発生しました';
  }
  const message = error.message || String(error);
  const lowerMessage = message.toLowerCase();
  const code = error.code || '';

  if (
    lowerMessage.includes('no upnp') ||
    lowerMessage.includes('no igd') ||
    lowerMessage.includes('not found') ||
    code === 'ENOTFOUND'
  ) {
    return 'UPnP対応ルーターが見つかりません';
  }

  if (code === 'ETIMEDOUT' || lowerMessage.includes('timed out')) {
    return 'UPnPルーターとの通信がタイムアウトしました';
  }

  if (
    code === 'ECONNREFUSED' ||
    code === 'EHOSTUNREACH' ||
    code === 'ENETUNREACH' ||
    lowerMessage.includes('connect')
  ) {
    return 'UPnPルーターに接続できませんでした';
  }

  return `UPnPエラー: ${message}`;
};

class UPnPManager {
  constructor(options = {}) {
    this.client = natUpnp.createClient({
      timeout: 5000
    });
    this.publicPort = options.publicPort || 7244;
    this.privatePort = options.privatePort || 7244;
    this.ttl = typeof options.ttl === 'number' ? options.ttl : 0;
    this.description = options.description || 'OtsumamiCast';
    this.isProcessing = false;
    this.mappedPort = null;
    this.statePath = options.statePath || null;
    this.hasOpened = false;
  }

  callClient(methodName, options) {
    return new Promise((resolve, reject) => {
      const fn = this.client?.[methodName];
      if (typeof fn !== 'function') {
        reject(new Error(`UPnP client method not found: ${methodName}`));
        return;
      }

      let settled = false;
      const done = (error, result) => {
        if (settled) return;
        settled = true;
        if (error) {
          reject(error);
          return;
        }
        resolve(result);
      };

      try {
        if (options === undefined) {
          const maybePromise = fn.call(this.client, done);
          if (maybePromise && typeof maybePromise.then === 'function') {
            maybePromise.then((result) => done(null, result)).catch(done);
          }
        } else {
          const maybePromise = fn.call(this.client, options, done);
          if (maybePromise && typeof maybePromise.then === 'function') {
            maybePromise.then((result) => done(null, result)).catch(done);
          }
        }
      } catch (error) {
        done(error);
      }
    });
  }

  async initialize() {
    if (!this.statePath) return;
    try {
      const data = await fs.readFile(this.statePath, 'utf8');
      const parsed = JSON.parse(data);
      this.hasOpened = parsed?.hasOpened === true;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('? UPnP: 状態ファイル読み込み失敗:', error);
      }
    }
  }

  async persistState() {
    if (!this.statePath) return;
    try {
      await fs.mkdir(path.dirname(this.statePath), { recursive: true });
      await fs.writeFile(
        this.statePath,
        JSON.stringify({ hasOpened: this.hasOpened }, null, 2),
        'utf8'
      );
    } catch (error) {
      console.error('? UPnP: 状態ファイル保存失敗:', error);
    }
  }

  /**
   * ポート開放
   * @param {number} port - 開放するポート番号
   * @returns {Promise<object>} 結果
   */
  async openPort(port) {
    if (port !== this.publicPort) {
      return {
        success: false,
        error: '許可されていないポートです'
      };
    }

    if (this.isProcessing) {
      return {
        success: false,
        error: 'UPnP処理中です'
      };
    }

    if (this.mappedPort === port) {
      return {
        success: true,
        port,
        message: `ポート ${port} は既に開放済みです`
      };
    }

    this.isProcessing = true;
    try {
      // ルーターによっては externalIp が未対応なため、失敗しても開放処理は継続する
      try {
        await this.callClient('externalIp');
      } catch (error) {
        console.warn('?? UPnP: 外部IP取得に失敗しましたが、ポート開放は継続します:', error.message || error);
      }

      await this.callClient('portMapping', {
        public: this.publicPort,
        private: this.privatePort,
        ttl: this.ttl,
        description: this.description
      });

      this.mappedPort = port;
      this.hasOpened = true;
      await this.persistState();

      console.log(`? UPnP: ポート ${port} を開放しました`);

      return {
        success: true,
        port,
        message: `ポート ${port} を開放しました（開放確認ボタンで確認してください）`
      };
    } catch (error) {
      console.error('? UPnP: ポート開放失敗:', error);
      return {
        success: false,
        error: formatUpnpError(error)
      };
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * ポート閉鎖
   * @param {number} port - 閉鎖するポート番号
   * @returns {Promise<object>} 結果
   */
  async closePort(port) {
    if (port !== this.publicPort) {
      return {
        success: false,
        error: '許可されていないポートです'
      };
    }

    if (this.isProcessing) {
      return {
        success: false,
        error: 'UPnP処理中です'
      };
    }

    if (!this.mappedPort) {
      return {
        success: true,
        port,
        message: `ポート ${port} は既に閉鎖済みです`
      };
    }

    this.isProcessing = true;
    try {
      await this.callClient('portUnmapping', {
        public: this.publicPort
      });

      if (this.mappedPort === port) {
        this.mappedPort = null;
      }

      console.log(`? UPnP: ポート ${port} を閉鎖しました`);

      return {
        success: true,
        port,
        message: `ポート ${port} を閉鎖しました`
      };
    } catch (error) {
      console.error('? UPnP: ポート閉鎖失敗:', error);
      return {
        success: false,
        error: formatUpnpError(error)
      };
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 外部IPアドレス取得
   * @returns {Promise<string>} IPアドレス
   */
  async getExternalIP() {
    try {
      const ip = await this.callClient('externalIp');
      return ip;
    } catch (error) {
      console.error('? UPnP: 外部IP取得失敗:', error);
      return null;
    }
  }

  /**
   * クリーンアップ
   */
  async cleanup() {
    if (this.mappedPort) {
      await this.closePort(this.mappedPort);
    }
    if (this.client && typeof this.client.close === 'function') {
      this.client.close();
    }
  }
}

module.exports = UPnPManager;
