const fs = require('fs');
const path = require('path');

function applyStampHandlers(manager) {
  const DOWNLOAD_LIMIT = {
    max: 5,
    windowMs: 5 * 60 * 1000
  };

  function checkDownloadRateLimit(ws) {
    const now = Date.now();
    const ip = manager.normalizeAddress(ws?._socket?.remoteAddress) || 'unknown';

    // 接続し直して制限を回避できないようIP単位で記録する。
    for (const [storedIp, timestamps] of manager.stampDownloadRateLimit.entries()) {
      const active = timestamps.filter((timestamp) => now - timestamp < DOWNLOAD_LIMIT.windowMs);
      if (active.length) manager.stampDownloadRateLimit.set(storedIp, active);
      else manager.stampDownloadRateLimit.delete(storedIp);
    }

    const history = manager.stampDownloadRateLimit.get(ip) || [];
    const recent = history.filter((timestamp) => now - timestamp < DOWNLOAD_LIMIT.windowMs);
    if (recent.length >= DOWNLOAD_LIMIT.max) {
      manager.stampDownloadRateLimit.set(ip, recent);
      return false;
    }
    recent.push(now);
    manager.stampDownloadRateLimit.set(ip, recent);
    return true;
  }

  function normalizeStampPath(rawUrl) {
    if (typeof rawUrl !== 'string' || !rawUrl.trim()) return '';
    const trimmed = rawUrl.trim();
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

  function extractStampId(rawUrl) {
    const normalizedPath = normalizeStampPath(rawUrl);
    const match = normalizedPath.match(/^\/stamps\/(.+)$/);
    if (!match) return '';
    return path.basename(match[1], path.extname(match[1]));
  }

  function extractStampIdsFromUrls(urls) {
    const list = Array.isArray(urls) ? urls : [urls];
    return [...new Set(list.map((url) => extractStampId(url)).filter(Boolean))];
  }

  manager.handleStamp = async function handleStamp(ws, message) {
    let usedStamp = null;
    if (this.stampManager && message.payload && message.payload.filename) {
      usedStamp = await this.stampManager.updateStampUsage(message.payload.filename);
    }

    if (usedStamp) {
      this.broadcast({
        type: 'stamp-used',
        url: usedStamp.url,
        lastUsedAt: usedStamp.lastUsedAt
      });
    }

    this.broadcast({
      type: 'stamp',
      payload: message.payload || {},
      timestamp: Date.now()
    });
  };

  // ホストはスタンプをローカル表示するため、履歴だけサーバーへ記録する。
  manager.handleStampUsage = async function handleStampUsage(ws, message) {
    const clientInfo = this.clients.get(ws);
    if (clientInfo?.role !== 'host' || !this.stampManager) return;

    const filename = message?.payload?.filename;
    if (!filename) return;

    const usedStamp = await this.stampManager.updateStampUsage(filename);
    if (!usedStamp) return;

    this.broadcast({
      type: 'stamp-used',
      url: usedStamp.url,
      lastUsedAt: usedStamp.lastUsedAt
    });
  };

  manager.handleStampAddLocal = async function handleStampAddLocal(ws, message) {
    console.log('  ローカルスタンプ追加リクエスト:', message.filename);

    if (!this.stampHandler || !this.stampManager) {
      console.error('? StampHandlerまたはStampManagerが設定されていません');
      this.sendTo(ws, {
        type: 'error',
        message: 'スタンプ機能が利用できません'
      });
      return;
    }

    const clientInfo = this.clients.get(ws);
    if (!this.isTrustedClient(ws?._socket?.remoteAddress)) {
      this.sendTo(ws, {
        type: 'error',
        message: 'この操作はローカルネットワークからのみ許可されています'
      });
      return;
    }

    if (clientInfo?.role !== 'host') {
      this.sendTo(ws, {
        type: 'error',
        message: 'スタンプ追加はホストのみ許可されています'
      });
      return;
    }

    try {
      const maxFileSizeMB = this.stampConfig?.config?.maxFileSize || 50;
      const maxBytes = maxFileSizeMB * 1024 * 1024;
      const stampInfo = await this.stampHandler.addStampFromBase64(
        message.filename,
        message.fileData,
        maxBytes
      );


      await this.stampManager.addStamp({
        id: stampInfo.id,
        url: stampInfo.url,
        thumbUrl: stampInfo.thumbUrl,
        staticThumbUrl: stampInfo.staticThumbUrl,
        label: '',
        addedBy: 'host',
        enabled: true,
        createdAt: stampInfo.createdAt,
        lastUsedAt: 0,
        sourceUrl: null,
        category: [],
      });

      console.log('? スタンプ追加成功:', stampInfo.filename);

      await this.broadcastStampList();
    } catch (error) {
      console.error('? スタンプ追加失敗:', error);
      this.sendTo(ws, {
        type: 'error',
        message: `スタンプ追加失敗: ${error.message}`
      });
    }
  };

  manager.handleStampAdd = async function handleStampAdd(ws, message) {
    console.log('  URLスタンプ追加リクエスト:', message.url);

    const clientInfo = this.clients.get(ws);
    const isHost = clientInfo?.role === 'host';
    const canListenerAdd = this.stampConfig
      ? this.stampConfig.canListenerAddStamp(
        'discord',
        message.serverId || null,
        message.password || null
      )
      : false;

    if (!isHost && !canListenerAdd) {
      console.log('? スタンプ追加拒否: リスナーの追加は許可されていません');
      this.sendTo(ws, {
        type: 'error',
        message: 'スタンプ追加はホストのみ許可されています'
      });
      return;
    }

    if (!this.stampHandler || !this.stampManager) {
      console.error('? StampHandlerまたはStampManagerが設定されていません');
      return;
    }

    const discordUrl = message.url;

    if (
      !discordUrl.startsWith('https://cdn.discordapp.com/') &&
      !discordUrl.startsWith('https://media.discordapp.net/')
    ) {
      console.warn('?? 非対応URL:', discordUrl);
      this.sendTo(ws, {
        type: 'error',
        message: 'Discord CDNのURLのみ対応しています'
      });
      return;
    }

    // ホストの一括整理を妨げず、外部リスナーの追加だけを制限する。
    if (!isHost && !checkDownloadRateLimit(ws)) {
      this.sendTo(ws, {
        type: 'error',
        message: 'スタンプ追加は5分間に5件までです。時間をおいて試してください'
      });
      return;
    }

    try {
      const stampId = `s_${Date.now()}`;

      const stampInfo = await this.stampHandler.addStampFromDiscord(
        discordUrl,
        stampId
      );

      if (this.stampConfig) {
        const maxFileSize = this.stampConfig.config.maxFileSize || 50;
        if (!this.stampConfig.isFileSizeValid(stampInfo.fileSizeBytes)) {
          const stampPath = path.join(__dirname, '..', 'public', 'stamps', stampInfo.filename);
          try {
            await fs.promises.unlink(stampPath);
          } catch (e) {
            console.error('削除失敗:', e);
          }

          this.sendTo(ws, {
            type: 'error',
            message: `ファイルサイズが大きすぎます（最大: ${maxFileSize}MB）`
          });
          return;
        }
      }


      await this.stampManager.addStamp({
        id: stampInfo.id,
        url: stampInfo.url,
        thumbUrl: stampInfo.thumbUrl,
        staticThumbUrl: stampInfo.staticThumbUrl,
        label: '',
        addedBy: isHost ? 'host' : 'viewer',
        enabled: true,
        createdAt: stampInfo.createdAt,
        lastUsedAt: 0,
        sourceUrl: discordUrl,
        category: [],
      });

      console.log('? Discord URLからスタンプ追加成功:', stampInfo.filename);

      await this.broadcastStampList();
    } catch (error) {
      console.error('? Discord URLスタンプ追加失敗:', error);
      this.sendTo(ws, {
        type: 'error',
        message: `スタンプ追加失敗: ${error.message}`
      });
    }
  };

  manager.handleStampReorder = async function handleStampReorder(ws, message) {
    console.log('  スタンプ並び替えリクエスト');

    if (!this.stampManager) return;
    if (!this.isTrustedClient(ws?._socket?.remoteAddress)) {
      this.sendTo(ws, {
        type: 'error',
        message: 'この操作はローカルネットワークからのみ許可されています'
      });
      return;
    }

    if (this.clients.get(ws)?.role !== 'host') {
      this.sendTo(ws, {
        type: 'error',
        message: 'ホストのみ実行可能です'
      });
      return;
    }

    try {
      await this.stampManager.reorderStamps(message.urls);
      await this.broadcastStampList();
    } catch (error) {
      console.error('? スタンプ並び替え失敗:', error);
    }
  };

  manager.handleStampCategoryAdd = async function handleStampCategoryAdd(ws, message) {
    if (!['host', 'viewer'].includes(this.clients.get(ws)?.role) ||
        !Array.isArray(message.urls) || !message.urls.length || message.urls.length > 2000 ||
        !this.stampConfig?.getCategories().some(c => c.id === message.category) ||
        !this.checkRateLimit(ws, 'category', 60)) {
      this.sendTo(ws, { type: 'error', message: 'カテゴリ操作が許可されていません' });
      return;
    }
    console.log(' カテゴリ追加:', message.category);

    if (!this.stampManager) return;

    try {
      await this.stampManager.addCategoryToStamps(message.urls, message.category);
      await this.broadcastStampList();
    } catch (error) {
      console.error('カテゴリ追加失敗:', error);
    }
  };

  manager.handleStampCategoryRemove = async function handleStampCategoryRemove(ws, message) {
    if (!['host', 'viewer'].includes(this.clients.get(ws)?.role) ||
        !Array.isArray(message.urls) || !message.urls.length || message.urls.length > 2000 ||
        !this.stampConfig?.getCategories().some(c => c.id === message.category) ||
        !this.checkRateLimit(ws, 'category', 60)) {
      this.sendTo(ws, { type: 'error', message: 'カテゴリ操作が許可されていません' });
      return;
    }
    console.log(' カテゴリ除去:', message.category);

    if (!this.stampManager) return;

    try {
      await this.stampManager.removeCategoryFromStamps(message.urls, message.category);
      await this.broadcastStampList();
    } catch (error) {
      console.error('カテゴリ除去失敗:', error);
    }
  };

  manager.handleStampDelete = async function handleStampDelete(ws, message) {
    console.log(' ? スタンプ削除リクエスト');

    if (!this.stampHandler || !this.stampManager) {
      console.error('? StampHandlerまたはStampManagerが設定されていません');
      return;
    }
    if (!this.isTrustedClient(ws?._socket?.remoteAddress)) {
      this.sendTo(ws, {
        type: 'error',
        message: 'この操作はローカルネットワークからのみ許可されています'
      });
      return;
    }

    if (this.clients.get(ws)?.role !== 'host') {
      this.sendTo(ws, {
        type: 'error',
        message: 'ホストのみ実行可能です'
      });
      return;
    }

    try {
      const urls = Array.isArray(message.urls) ? message.urls : [message.urls];

      for (const url of urls) {
        const stampId = extractStampId(url);
        if (stampId) {
          try {
            await this.stampHandler.deleteStamp(stampId);
          } catch (e) {
            console.error('ファイル削除失敗:', stampId, e);
          }
        }
      }

      await this.stampManager.deleteStamps(urls);

      await this.broadcastStampList();
    } catch (error) {
      console.error('? スタンプ削除失敗:', error);
      this.sendTo(ws, {
        type: 'error',
        message: `スタンプ削除失敗: ${error.message}`
      });
    }
  };

  manager.handleStampThumbRegenerateAll = async function handleStampThumbRegenerateAll(ws) {
    console.log(' 🛠 サムネイル全件再生成リクエスト');

    if (!this.stampHandler || !this.stampManager) {
      this.sendTo(ws, {
        type: 'error',
        message: 'スタンプ機能が利用できません'
      });
      return;
    }
    if (!this.isTrustedClient(ws?._socket?.remoteAddress)) {
      this.sendTo(ws, {
        type: 'error',
        message: 'この操作はローカルネットワークからのみ許可されています'
      });
      return;
    }
    if (this.clients.get(ws)?.role !== 'host') {
      this.sendTo(ws, {
        type: 'error',
        message: 'ホストのみ実行可能です'
      });
      return;
    }

    try {
      this.sendTo(ws, {
        type: 'stamp-thumb-regenerate-progress',
        scope: 'all',
        status: 'start',
        current: 0,
        total: 0
      });

      const result = await this.stampHandler.regenerateAllThumbnails((progress) => {
        this.sendTo(ws, {
          type: 'stamp-thumb-regenerate-progress',
          scope: 'all',
          status: 'progress',
          ...progress
        });
      });
      const thumbsById = (result.regenerated || []).reduce((acc, item) => {
        if (item && item.stampId && item.thumbUrl) {
          acc[item.stampId] = {
            thumbUrl: item.thumbUrl,
            staticThumbUrl: item.staticThumbUrl
          };
        }
        return acc;
      }, {});
      await this.stampManager.updateThumbnailUrlsByIds(thumbsById);
      const updatedIds = Object.keys(thumbsById);
      await this.stampManager.touchThumbnailUpdatedAtByIds(updatedIds);
      await this.broadcastStampList();
      this.sendTo(ws, {
        type: 'stamp-thumb-regenerate-progress',
        scope: 'all',
        status: 'done',
        current: result.total,
        total: result.total,
        successCount: result.successCount,
        failCount: result.failCount
      });
      this.sendTo(ws, {
        type: 'stamp-thumb-regenerate-result',
        scope: 'all',
        ...result
      });
    } catch (error) {
      console.error('❌ サムネイル全件再生成失敗:', error);
      this.sendTo(ws, {
        type: 'stamp-thumb-regenerate-progress',
        scope: 'all',
        status: 'done',
        current: 0,
        total: 0,
        successCount: 0,
        failCount: 0
      });
      this.sendTo(ws, {
        type: 'error',
        message: `サムネイル再生成に失敗しました: ${error.message}`
      });
    }
  };

  manager.handleStampThumbRegenerateSelected = async function handleStampThumbRegenerateSelected(ws, message) {
    console.log(' 🛠 サムネイル選択再生成リクエスト');

    if (!this.stampHandler || !this.stampManager) {
      this.sendTo(ws, {
        type: 'error',
        message: 'スタンプ機能が利用できません'
      });
      return;
    }
    if (!this.isTrustedClient(ws?._socket?.remoteAddress)) {
      this.sendTo(ws, {
        type: 'error',
        message: 'この操作はローカルネットワークからのみ許可されています'
      });
      return;
    }
    if (this.clients.get(ws)?.role !== 'host') {
      this.sendTo(ws, {
        type: 'error',
        message: 'ホストのみ実行可能です'
      });
      return;
    }

    const stampIds = extractStampIdsFromUrls(message.urls || []);
    if (!stampIds.length) {
      this.sendTo(ws, {
        type: 'error',
        message: '再生成対象のスタンプが選択されていません'
      });
      return;
    }

    try {
      this.sendTo(ws, {
        type: 'stamp-thumb-regenerate-progress',
        scope: 'selected',
        status: 'start',
        current: 0,
        total: stampIds.length
      });

      const result = await this.stampHandler.regenerateThumbnailsByIds(stampIds, (progress) => {
        this.sendTo(ws, {
          type: 'stamp-thumb-regenerate-progress',
          scope: 'selected',
          status: 'progress',
          ...progress
        });
      });
      const thumbsById = (result.regenerated || []).reduce((acc, item) => {
        if (item && item.stampId && item.thumbUrl) {
          acc[item.stampId] = {
            thumbUrl: item.thumbUrl,
            staticThumbUrl: item.staticThumbUrl
          };
        }
        return acc;
      }, {});
      await this.stampManager.updateThumbnailUrlsByIds(thumbsById);
      await this.stampManager.touchThumbnailUpdatedAtByIds(Object.keys(thumbsById));
      await this.broadcastStampList();
      this.sendTo(ws, {
        type: 'stamp-thumb-regenerate-progress',
        scope: 'selected',
        status: 'done',
        current: result.total,
        total: result.total,
        successCount: result.successCount,
        failCount: result.failCount
      });
      this.sendTo(ws, {
        type: 'stamp-thumb-regenerate-result',
        scope: 'selected',
        ...result
      });
    } catch (error) {
      console.error('❌ サムネイル選択再生成失敗:', error);
      this.sendTo(ws, {
        type: 'stamp-thumb-regenerate-progress',
        scope: 'selected',
        status: 'done',
        current: 0,
        total: stampIds.length,
        successCount: 0,
        failCount: stampIds.length
      });
      this.sendTo(ws, {
        type: 'error',
        message: `サムネイル再生成に失敗しました: ${error.message}`
      });
    }
  };

  manager.broadcastStampList = async function broadcastStampList() {
    if (!this.stampManager) return;

    try {
      const stamps = this.stampManager.getStamps();
      const categories = this.stampConfig ? this.stampConfig.getCategories() : [];

      this.broadcast({
        type: 'stamp-list',
        stamps: stamps,
        categories: categories
      });

      console.log(`  スタンプリスト送信: ${stamps.length}件`);
    } catch (error) {
      console.error('? スタンプリスト送信失敗:', error);
    }
  };

  manager.handleStampCategoryDefAdd = async function handleStampCategoryDefAdd(ws, message) {
    console.log(' カテゴリ定義追加リクエスト:', message.id, message.label);

    if (!this.stampConfig) {
      this.sendTo(ws, { type: 'error', message: '設定が利用できません' });
      return;
    }
    if (this.clients.get(ws)?.role !== 'host') {
      this.sendTo(ws, { type: 'error', message: 'ホストのみ実行可能です' });
      return;
    }

    try {
      await this.stampConfig.addCategory(message.id, message.label);
      await this.broadcastStampList();
    } catch (error) {
      console.error('カテゴリ追加失敗:', error);
      this.sendTo(ws, { type: 'error', message: `カテゴリ追加失敗: ${error.message}` });
    }
  };

  manager.handleStampCategoryDelete = async function handleStampCategoryDelete(ws, message) {
    console.log(' カテゴリ削除リクエスト:', message.id);

    if (!this.stampConfig) {
      this.sendTo(ws, { type: 'error', message: '設定が利用できません' });
      return;
    }
    if (this.clients.get(ws)?.role !== 'host') {
      this.sendTo(ws, { type: 'error', message: 'ホストのみ実行可能です' });
      return;
    }

    try {
      await this.stampConfig.deleteCategory(message.id);
      if (this.stampManager) {
        await this.stampManager.removeCategoryFromAllStamps(message.id);
      }
      await this.broadcastStampList();
    } catch (error) {
      console.error('カテゴリ削除失敗:', error);
      this.sendTo(ws, { type: 'error', message: `カテゴリ削除失敗: ${error.message}` });
    }
  };
}

module.exports = applyStampHandlers;
