const fs = require('fs').promises;
const path = require('path');

class StampManager {
  constructor(stampListPath, stampConfig = null) {
    this.stampListPath = stampListPath;
    this.stampConfig = stampConfig; // StampConfigインスタンス
    this.stampList = { version: 1, stamps: [] };
  }

  normalizeStampUrl(url) {
    if (typeof url !== 'string' || !url.trim()) return '';
    const trimmed = url.trim();
    try {
      if (/^https?:\/\//i.test(trimmed)) {
        const parsed = new URL(trimmed);
        return parsed.pathname || '';
      }
      return trimmed.split('?')[0];
    } catch (error) {
      return trimmed.split('?')[0];
    }
  }

  /**
   * 初期化：stamp-list.jsonを読み込む
   */
  async initialize() {
    await this.load();
    console.log(`✅ スタンプリスト読み込み: ${this.stampList.stamps.length}件`);
  }

  /**
   * stamp-list.jsonを読み込む
   */
  async load() {
    try {
      const data = await fs.readFile(this.stampListPath, 'utf8');
      const parsed = JSON.parse(data);
      
      if (parsed && Array.isArray(parsed.stamps)) {
        this.stampList = parsed;
        // 空オブジェクトを除去
        this.stampList.stamps = this.stampList.stamps.filter(s => s && s.id);
        // 文字列カテゴリを配列に移行
        let migrated = false;
        this.stampList.stamps.forEach(s => {
          if (typeof s.category === 'string') {
            s.category = s.category ? [s.category] : [];
            migrated = true;
          } else if (!Array.isArray(s.category)) {
            s.category = [];
            migrated = true;
          }
        });
        if (migrated) {
          await this.save();
        }
      }
    } catch (error) {
      if (error.code === 'ENOENT') {
        // ファイルが無ければ新規作成
        this.stampList = { version: 1, stamps: [] };
        await this.save();
      } else {
        console.error('❌ stamp-list.json読み込み失敗:', error);
      }
    }
  }

  /**
   * stamp-list.jsonに保存
   */
  async save() {
    try {
      await fs.writeFile(
        this.stampListPath,
        JSON.stringify(this.stampList, null, 2),
        'utf8'
      );
    } catch (error) {
      console.error('❌ stamp-list.json保存失敗:', error);
    }
  }

  /**
   * スタンプ一覧を取得
   */
  getStamps() {
    return this.stampList.stamps.filter(s => s && s.enabled !== false).map(({ addedIp, sourceUrl, ...stamp }) => stamp);
  }

  /**
   * スタンプを追加
   */
  async addStamp(stampInfo) {
    // 上限チェック
    const maxCount = this.stampConfig ? this.stampConfig.config.maxStampCount : 100;
    const isUnlimited = maxCount === 0;
    
    if (!isUnlimited && this.stampList.stamps.length >= maxCount) {
      throw new Error(`スタンプ上限（${maxCount}件）に達しています`);
    }

    // 重複チェック
    const exists = this.stampList.stamps.find(s => s.id === stampInfo.id);
    if (exists) {
      console.warn(`⚠️ スタンプID重複: ${stampInfo.id}`);
      return;
    }

    this.stampList.stamps.push({
      id: stampInfo.id,
      url: stampInfo.url,
      thumbUrl: stampInfo.thumbUrl || null,
      staticThumbUrl: stampInfo.staticThumbUrl || stampInfo.thumbUrl || null,
      thumbUpdatedAt: stampInfo.thumbUpdatedAt || stampInfo.createdAt || Date.now(),
      label: stampInfo.label || '',
      addedBy: stampInfo.addedBy || 'host',
      enabled: true,
      createdAt: stampInfo.createdAt || Date.now(),
      lastUsedAt: 0,
      sourceUrl: stampInfo.sourceUrl || null,
      category: stampInfo.category || [],

    });

    await this.save();
    console.log(`✅ スタンプ追加: ${stampInfo.id}`);
  }

  /**
   * スタンプ使用を記録（lastUsedAtを更新）
   */
  async updateStampUsage(filename) {
    // filenameから該当スタンプを探す
    const stamp = this.stampList.stamps.find(s => 
      s.url === filename || 
      s.url === `/${filename}` ||
      s.url.endsWith(`/${filename}`)
    );

    if (stamp) {
      stamp.lastUsedAt = Date.now();
      await this.save();
    }
  }

  /**
   * スタンプにカテゴリを追加
   */
  async addCategoryToStamps(urls, categoryId) {
    let updated = false;
    const normalizedTargets = new Set(
      (Array.isArray(urls) ? urls : [urls]).map((url) => this.normalizeStampUrl(url))
    );

    this.stampList.stamps.forEach((stamp) => {
      const normalizedStampUrl = this.normalizeStampUrl(stamp.url);
      if (!normalizedTargets.has(normalizedStampUrl)) return;
      if (stamp) {
        if (!Array.isArray(stamp.category)) {
          stamp.category = [];
        }
        if (!stamp.category.includes(categoryId)) {
          stamp.category.push(categoryId);
          updated = true;
        }
      }
    });

    if (updated) {
      await this.save();
      console.log(`✅ カテゴリ追加: ${urls.length}件 ← ${categoryId}`);
    }
  }

  /**
   * スタンプからカテゴリを除去
   */
  async removeCategoryFromStamps(urls, categoryId) {
    let updated = false;
    const normalizedTargets = new Set(
      (Array.isArray(urls) ? urls : [urls]).map((url) => this.normalizeStampUrl(url))
    );

    this.stampList.stamps.forEach((stamp) => {
      const normalizedStampUrl = this.normalizeStampUrl(stamp.url);
      if (!normalizedTargets.has(normalizedStampUrl)) return;
      if (stamp && Array.isArray(stamp.category)) {
        const before = stamp.category.length;
        stamp.category = stamp.category.filter(c => c !== categoryId);
        if (stamp.category.length !== before) {
          updated = true;
        }
      }
    });

    if (updated) {
      await this.save();
      console.log(`✅ カテゴリ除去: ${urls.length}件 ← ${categoryId}`);
    }
  }

  /**
   * 全スタンプから特定カテゴリを除去（カテゴリ定義削除時用）
   */
  async removeCategoryFromAllStamps(categoryId) {
    let updated = false;

    this.stampList.stamps.forEach((stamp) => {
      if (Array.isArray(stamp.category)) {
        const before = stamp.category.length;
        stamp.category = stamp.category.filter(c => c !== categoryId);
        if (stamp.category.length !== before) {
          updated = true;
        }
      }
    });

    if (updated) {
      await this.save();
      console.log(`✅ カテゴリ全除去: ${categoryId}`);
    }
  }

  /**
   * スタンプを並び替え
   */
  async reorderStamps(urls) {
    const newOrder = [];
    const remaining = [...this.stampList.stamps];
    const normalizedUrls = (Array.isArray(urls) ? urls : [urls]).map((url) => this.normalizeStampUrl(url));

    // urlsの順番通りに並び替え
    normalizedUrls.forEach((url) => {
      const index = remaining.findIndex((s) => this.normalizeStampUrl(s.url) === url);
      if (index !== -1) {
        newOrder.push(remaining[index]);
        remaining.splice(index, 1);
      }
    });

    // 残りを追加
    newOrder.push(...remaining);

    this.stampList.stamps = newOrder;
    await this.save();
    console.log(`✅ スタンプ並び替え完了`);
  }

  /**
   * スタンプを削除
   */
  async deleteStamps(urls) {
    const before = this.stampList.stamps.length;
    const normalizedTargets = new Set(
      (Array.isArray(urls) ? urls : [urls]).map((url) => this.normalizeStampUrl(url))
    );

    this.stampList.stamps = this.stampList.stamps.filter(s => 
      !normalizedTargets.has(this.normalizeStampUrl(s.url))
    );

    const deleted = before - this.stampList.stamps.length;

    if (deleted > 0) {
      await this.save();
      console.log(`✅ スタンプ削除: ${deleted}件`);
    }

    return deleted;
  }

  async touchThumbnailUpdatedAtByUrls(urls, updatedAt = Date.now()) {
    const normalizedTargets = new Set(
      (Array.isArray(urls) ? urls : [urls]).map((url) => this.normalizeStampUrl(url))
    );
    let updated = 0;

    this.stampList.stamps.forEach((stamp) => {
      if (!normalizedTargets.has(this.normalizeStampUrl(stamp.url))) return;
      stamp.thumbUpdatedAt = updatedAt;
      updated += 1;
    });

    if (updated > 0) {
      await this.save();
    }

    return updated;
  }

  async touchThumbnailUpdatedAtByIds(stampIds, updatedAt = Date.now()) {
    const targetIds = new Set(Array.isArray(stampIds) ? stampIds : [stampIds]);
    let updated = 0;

    this.stampList.stamps.forEach((stamp) => {
      if (!targetIds.has(stamp.id)) return;
      stamp.thumbUpdatedAt = updatedAt;
      updated += 1;
    });

    if (updated > 0) {
      await this.save();
    }

    return updated;
  }

  async updateThumbnailUrlsByIds(thumbsById = {}) {
    let updated = 0;

    this.stampList.stamps.forEach((stamp) => {
      if (!stamp || !stamp.id) return;
      const next = thumbsById[stamp.id];
      if (!next) return;

      if (typeof next === 'string') {
        stamp.thumbUrl = next;
        updated += 1;
        return;
      }

      if (next.thumbUrl) {
        stamp.thumbUrl = next.thumbUrl;
      }
      if (next.staticThumbUrl) {
        stamp.staticThumbUrl = next.staticThumbUrl;
      }
      updated += 1;
    });

    if (updated > 0) {
      await this.save();
    }

    return updated;
  }

  /**
   * スタンプIDから情報を取得
   */
  getStampById(stampId) {
    return this.stampList.stamps.find(s => s.id === stampId);
  }
}

module.exports = StampManager;
