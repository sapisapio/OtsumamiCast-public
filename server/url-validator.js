/**
 * OtsumamiCast - URL検証ユーティリティ
 * 
 * Discord、Imgur、その他のURLを検証
 */

class URLValidator {
  /**
   * URLが有効なDiscord CDN URLか確認
   * @param {string} url - URL
   * @returns {boolean}
   */
  static isDiscordCDNUrl(url) {
    if (!url || typeof url !== 'string') return false;
    
    try {
      const urlObj = new URL(url);
      // Discord CDN ドメイン
      return urlObj.hostname === 'cdn.discordapp.com' || 
             urlObj.hostname === 'media.discordapp.net';
    } catch (error) {
      return false;
    }
  }

  /**
   * URLがImgurか確認
   * @param {string} url - URL
   * @returns {boolean}
   */
  static isImgurUrl(url) {
    if (!url || typeof url !== 'string') return false;
    
    try {
      const urlObj = new URL(url);
      return urlObj.hostname === 'imgur.com' || 
             urlObj.hostname === 'www.imgur.com' ||
             urlObj.hostname === 'i.imgur.com';
    } catch (error) {
      return false;
    }
  }

  /**
   * URLのファイル形式を取得
   * @param {string} url - URL
   * @returns {string|null} 拡張子（小文字）
   */
  static getFileExtension(url) {
    if (!url || typeof url !== 'string') return null;
    
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname.toLowerCase();
      
      // クエリ文字列を除去
      const pathWithoutQuery = pathname.split('?')[0];
      
      // 拡張子を抽出
      const match = pathWithoutQuery.match(/\.([a-z0-9]+)$/);
      return match ? match[1] : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * ファイル形式が許可されているか確認
   * @param {string} url - URL
   * @param {string[]} allowedExtensions - 許可する拡張子（例：['png', 'jpg', 'mp4', 'webm']）
   * @returns {boolean}
   */
  static isAllowedFileType(url, allowedExtensions = ['png', 'jpg', 'jpeg', 'gif', 'mp4', 'webm']) {
    const ext = this.getFileExtension(url);
    if (!ext) return false;
    
    return allowedExtensions.includes(ext);
  }

  /**
   * URLが有効か基本的な検証
   * @param {string} url - URL
   * @returns {boolean}
   */
  static isValidUrl(url) {
    if (!url || typeof url !== 'string') return false;
    
    try {
      new URL(url);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * URLのソースタイプを判定
   * @param {string} url - URL
   * @returns {'discord' | 'imgur' | 'other' | null}
   */
  static getSourceType(url) {
    if (this.isDiscordCDNUrl(url)) {
      return 'discord';
    }
    
    if (this.isImgurUrl(url)) {
      return 'imgur';
    }
    
    if (this.isValidUrl(url)) {
      return 'other';
    }
    
    return null;
  }

  /**
   * Discord URLからサーバーIDを抽出（可能な場合）
   * 
   * Discord CDN URLの形式：
   * https://cdn.discordapp.com/attachments/{channel_id}/{message_id}/{filename}
   * 
   * ただし、サーバーIDは含まれていないため、
   * リスナーが申告する必要がある
   * 
   * @param {string} url - URL
   * @returns {string|null} チャンネルID（存在する場合）
   */
  static extractDiscordChannelId(url) {
    if (!this.isDiscordCDNUrl(url)) return null;
    
    try {
      const urlObj = new URL(url);
      const parts = urlObj.pathname.split('/');
      
      // /attachments/{channel_id}/{message_id}/{filename}
      if (parts[1] === 'attachments' && parts.length >= 4) {
        return parts[2]; // channel_id
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * URLが安全か確認（基本的なチェック）
   * 
   * - ファイル形式が許可されているか
   * - URLが有効か
   * 
   * @param {string} url - URL
   * @param {string[]} allowedExtensions - 許可する拡張子
   * @returns {{valid: boolean, error?: string}}
   */
  static validateUrl(url, allowedExtensions = ['png', 'jpg', 'jpeg', 'gif', 'mp4', 'webm']) {
    // URL の基本的な有効性
    if (!this.isValidUrl(url)) {
      return {
        valid: false,
        error: '無効なURLです'
      };
    }
    
    // ファイル形式の確認
    if (!this.isAllowedFileType(url, allowedExtensions)) {
      const ext = this.getFileExtension(url);
      return {
        valid: false,
        error: `ファイル形式が許可されていません: .${ext}`
      };
    }
    
    return {
      valid: true
    };
  }
}

module.exports = URLValidator;
