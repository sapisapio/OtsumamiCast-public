const sharp = require('sharp');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const https = require('https');
const { spawn } = require('child_process');
function mediaTool(name) {
  const filename = process.platform === 'win32' ? name + '.exe' : name;
  const bundled = path.join(__dirname, '..', 'ffmpeg-bin', filename);
  return fsSync.existsSync(bundled) ? bundled : name;
}

class StampHandler {
  constructor(stampDir, options = {}) {
    this.stampDir = stampDir;
    this.thumbDir = path.join(stampDir, 'thumbs');
    this.thumbSize = Number(options.thumbSize) || 64;
    console.log(`[STAMP-HANDLER] スタンプディレクトリ: ${this.stampDir}`);
    console.log(`[STAMP-HANDLER] サムネイルディレクトリ: ${this.thumbDir}`);
  }

  /**
   * 初期化：ディレクトリ作成
   */
  async initialize() {
    try {
      console.log(`[STAMP-HANDLER] ディレクトリを作成中...`);
      await fs.mkdir(this.stampDir, { recursive: true });
      await fs.mkdir(this.thumbDir, { recursive: true });
      console.log('✅ スタンプディレクトリを初期化しました');
    } catch (error) {
      console.error('❌ スタンプディレクトリ初期化失敗:', error);
      console.error('パス:', this.stampDir);
      console.error('エラーコード:', error.code);
      console.error('エラーメッセージ:', error.message);
      throw error;
    }
  }

  /**
   * ファイルが動画かどうかを判定
   * @param {string} filePath - ファイルパス
   * @returns {boolean}
   */
  isVideoFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return ['.mp4', '.webm'].includes(ext);
  }

  isAnimatedImageFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return ['.gif', '.webp', '.apng'].includes(ext);
  }

  async shouldUseGifThumbnail(srcPath) {
    if (this.isVideoFile(srcPath)) {
      return true;
    }

    const ext = path.extname(srcPath).toLowerCase();
    if (!['.gif', '.webp', '.apng'].includes(ext)) {
      return false;
    }

    try {
      const metadata = await sharp(srcPath, { animated: true }).metadata();
      return (metadata.pages || 1) > 1;
    } catch (error) {
      // メタデータ判定に失敗した場合は拡張子ベースでGIF生成を優先
      return true;
    }
  }

  getValidStampExtensions() {
    return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.apng', '.mp4', '.webm'];
  }

  getThumbPath(stampId, ext = '.gif') {
    return path.join(this.thumbDir, `${stampId}${ext}`);
  }

  getThumbUrl(stampId, ext = '.gif') {
    return `/stamps/thumbs/${stampId}${ext}`;
  }

  async thumbFileExists(stampId, ext) {
    try {
      await fs.access(this.getThumbPath(stampId, ext));
      return true;
    } catch (error) {
      return false;
    }
  }

  async resolveExistingThumbUrl(stampId) {
    const candidates = ['.gif', '.png'];
    for (const ext of candidates) {
      if (await this.thumbFileExists(stampId, ext)) {
        return this.getThumbUrl(stampId, ext);
      }
    }
    return this.getThumbUrl(stampId, '.gif');
  }

  async resolveStaticThumbUrl(stampId) {
    if (await this.thumbFileExists(stampId, '.png')) {
      return this.getThumbUrl(stampId, '.png');
    }
    return this.resolveExistingThumbUrl(stampId);
  }

  getResizeOptions() {
    return {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    };
  }

  async createPngThumbnailFromImage(srcPath, stampId, size = this.thumbSize) {
    const thumbPath = this.getThumbPath(stampId, '.png');
    const resizeOptions = this.getResizeOptions();

    try {
      const metadata = await sharp(srcPath, { animated: true }).metadata();
      const isAnimated = (metadata.pages || 1) > 1;
      if (isAnimated) {
        await sharp(srcPath, { page: 0, pages: 1 })
          .resize(size, size, resizeOptions)
          .png({ compressionLevel: 9 })
          .toFile(thumbPath);
      } else {
        await sharp(srcPath)
          .resize(size, size, resizeOptions)
          .png({ compressionLevel: 9 })
          .toFile(thumbPath);
      }
      return thumbPath;
    } catch (error) {
      await sharp(srcPath)
        .resize(size, size, resizeOptions)
        .png({ compressionLevel: 9 })
        .toFile(thumbPath);
      return thumbPath;
    }
  }

  /**
   * Discord URLから画像をダウンロード
   * @param {string} discordUrl - Discord CDN URL
   * @param {string} stampId - スタンプID
   * @returns {Promise<string>} 保存したファイルパス
   */
  async downloadFromDiscord(discordUrl, stampId, maxSizeBytes = 50 * 1024 * 1024) {
    return new Promise((resolve, reject) => {
      try {
        const url = new URL(discordUrl);
        const ext = path.extname(url.pathname) || '.png';
        const filename = `${stampId}${ext}`;
        const filePath = path.join(this.stampDir, filename);

        https.get(discordUrl, (response) => {
          // ステータスコードチェック（ファイル作成前）
          if (response.statusCode !== 200) {
            response.resume(); // データを捨てる
            reject(new Error(`HTTP ${response.statusCode}`));
            return;
          }

          const contentLength = parseInt(response.headers['content-length'] || '0', 10);
          if (contentLength > maxSizeBytes) {
            response.resume();
            reject(new Error(`ファイルサイズが上限を超えています: ${contentLength} bytes`));
            return;
          }

          // 200 OKの場合のみファイルを作成
          const fileStream = fsSync.createWriteStream(filePath);
          let downloadedBytes = 0;
          let aborted = false;

          response.on('data', (chunk) => {
            downloadedBytes += chunk.length;
            if (!aborted && downloadedBytes > maxSizeBytes) {
              aborted = true;
              response.destroy();
              fileStream.close();
              fsSync.unlink(filePath, () => {});
              reject(new Error('ファイルサイズ上限超過'));
            }
          });

          response.pipe(fileStream);

          fileStream.on('finish', () => {
            fileStream.close();
            resolve(filePath);
          });

          fileStream.on('error', (error) => {
            // ファイル書き込みエラー時は削除
            fsSync.unlink(filePath, () => {});
            reject(error);
          });
        }).on('error', (error) => {
          // ネットワークエラー
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 動画からサムネイルを生成（ffmpegを使用）
   * @param {string} videoPath - 動画ファイルパス
   * @param {string} stampId - スタンプID
   * @param {number} size - サムネイルサイズ（デフォルト: this.thumbSize）
   * @returns {Promise<string>} サムネイルのパス
   */
  async createVideoThumbnail(videoPath, stampId, size = this.thumbSize) {
    const thumbPath = this.getThumbPath(stampId, '.gif');

    try {
      await new Promise((resolve, reject) => {
        const ffmpeg = spawn(mediaTool('ffmpeg'), [
          '-ss', '0',
          '-t', '2',
          '-i', videoPath,
          '-vf', `fps=6,scale=${size}:${size}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${size}:${size}:(ow-iw)/2:(oh-ih)/2:color=black`,
          '-loop', '0',
          '-y',
          thumbPath
        ], { windowsHide: true });

        ffmpeg.once('error', reject);
        ffmpeg.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`ffmpeg exited with code ${code}`));
          }
        });

        ffmpeg.stderr.on('data', () => {
          // ffmpegの出力は無視（冗長なため）
        });
      });

      console.log(`✅ 動画サムネイル(GIF)生成成功: ${stampId}`);
      return thumbPath;
    } catch (error) {
      console.error(`❌ 動画サムネイル(GIF)生成失敗: ${stampId}`, error);
      throw error;
    }
  }

  async createVideoStaticThumbnail(videoPath, stampId, size = this.thumbSize) {
    const thumbPath = this.getThumbPath(stampId, '.png');

    await new Promise((resolve, reject) => {
      const ffmpeg = spawn(mediaTool('ffmpeg'), [
        '-ss', '0',
        '-i', videoPath,
        '-frames:v', '1',
        '-vf', `scale=${size}:${size}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${size}:${size}:(ow-iw)/2:(oh-ih)/2:color=black`,
        '-y',
        thumbPath
      ], { windowsHide: true });

      ffmpeg.once('error', reject);
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`ffmpeg exited with code ${code}`));
        }
      });

      ffmpeg.stderr.on('data', () => {});
    });

    console.log(`✅ 動画静止サムネイル(PNG)生成成功: ${stampId}`);
    return thumbPath;
  }

  async createGifThumbnail(srcPath, stampId, size = this.thumbSize) {
    const thumbPath = this.getThumbPath(stampId, '.gif');
    const resizeOptions = this.getResizeOptions();

    await sharp(srcPath, { animated: true })
      .resize(size, size, resizeOptions)
      .gif({ effort: 7 })
      .toFile(thumbPath);

    return thumbPath;
  }

  /**
   * 通常表示用＋負荷軽減用のサムネイルを生成
   * @returns {Promise<{thumbPath: string, staticThumbPath: string, thumbUrl: string, staticThumbUrl: string}>}
   */
  async createThumbnail(srcPath, stampId, size = this.thumbSize) {
    try {
      if (this.isVideoFile(srcPath)) {
        const thumbPath = await this.createVideoThumbnail(srcPath, stampId, size);
        const staticThumbPath = await this.createVideoStaticThumbnail(srcPath, stampId, size);
        return {
          thumbPath,
          staticThumbPath,
          thumbUrl: this.getThumbUrl(stampId, '.gif'),
          staticThumbUrl: this.getThumbUrl(stampId, '.png')
        };
      }

      const useGif = await this.shouldUseGifThumbnail(srcPath);
      let thumbPath;
      let staticThumbPath;

      if (useGif) {
        thumbPath = await this.createGifThumbnail(srcPath, stampId, size);
        staticThumbPath = await this.createPngThumbnailFromImage(srcPath, stampId, size);
      } else {
        staticThumbPath = await this.createPngThumbnailFromImage(srcPath, stampId, size);
        thumbPath = staticThumbPath;
      }

      const thumbExt = path.extname(thumbPath).toLowerCase();
      console.log(`✅ サムネイル生成成功: ${stampId} (${thumbExt.replace('.', '')} + PNG)`);
      return {
        thumbPath,
        staticThumbPath,
        thumbUrl: this.getThumbUrl(stampId, thumbExt),
        staticThumbUrl: this.getThumbUrl(stampId, '.png')
      };
    } catch (error) {
      console.error(`❌ サムネイル生成失敗: ${stampId}`, error);
      throw error;
    }
  }

  /**
   * Discord URLからスタンプを追加
   * @param {string} discordUrl - Discord CDN URL
   * @param {string} stampId - スタンプID
   * @returns {Promise<object>} スタンプ情報
   */
  async addStampFromDiscord(discordUrl, stampId) {
    try {
      // 1. Discord URLから画像をダウンロード
      const filePath = await this.downloadFromDiscord(discordUrl, stampId);
      const filename = path.basename(filePath);

      let width, height;

      // 2. メタデータ取得（動画と画像で処理を分ける）
      if (this.isVideoFile(filePath)) {
        // 動画の場合はffprobeでメタデータ取得
        const metadata = await this.getVideoMetadata(filePath);
        width = metadata.width;
        height = metadata.height;
      } else {
        // 画像の場合はsharpでメタデータ取得
        const metadata = await sharp(filePath).metadata();
        width = metadata.width;
        height = metadata.height;
      }

      // 3. サムネイル生成
      const thumbs = await this.createThumbnail(filePath, stampId);

      // ファイルサイズを取得
      const stats = await fs.stat(filePath);
      const fileSizeBytes = stats.size;

      const stampInfo = {
        id: stampId,
        filename: filename,
        url: `/stamps/${filename}`,
        thumbUrl: thumbs.thumbUrl,
        staticThumbUrl: thumbs.staticThumbUrl,
        sourceUrl: discordUrl,
        enabled: true,
        lastUsedAt: 0,
        createdAt: Date.now(),
        size: { width, height },
        fileSizeBytes: fileSizeBytes,
        isVideo: this.isVideoFile(filePath)
      };

      console.log(`✅ Discord URLからスタンプ追加成功: ${stampInfo.filename}`);
      return stampInfo;
    } catch (error) {
      console.error('❌ Discord URLからスタンプ追加失敗:', error);
      throw error;
    }
  }

  /**
   * 動画のメタデータを取得（ffprobeを使用）
   * @param {string} videoPath - 動画ファイルパス
   * @returns {Promise<{width: number, height: number, duration: number}>}
   */
  async getVideoMetadata(videoPath) {
    return new Promise((resolve, reject) => {
      const ffprobe = spawn(mediaTool('ffprobe'), [
        '-v', 'error',
        '-select_streams', 'v:0',
        '-show_entries', 'stream=width,height,duration',
        '-of', 'json',
        videoPath
      ], { windowsHide: true });

      let output = '';

      ffprobe.stdout.on('data', (data) => {
        output += data.toString();
      });

      ffprobe.once('error', reject);
      ffprobe.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`ffprobe exited with code ${code}`));
          return;
        }

        try {
          const json = JSON.parse(output);
          const stream = json.streams[0];
          resolve({
            width: stream.width,
            height: stream.height,
            duration: parseFloat(stream.duration) || 0
          });
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Base64データからスタンプを追加
   * @param {string} filename - ファイル名
   * @param {string} base64Data - Base64エンコードされた画像データ
   * @returns {Promise<object>} スタンプ情報
   */
  async addStampFromBase64(filename, base64Data, maxBytes = null) {
    const stampId = `s_${Date.now()}`;
    const ext = path.extname(filename) || '.png';
    const stampPath = path.join(this.stampDir, `${stampId}${ext}`);

    try {
      // 1. Base64をデコードしてファイル保存
      const base64String = base64Data.replace(/^data:(image|video)\/\w+;base64,/, '');
      if (maxBytes) {
        const estimatedBytes = Math.floor((base64String.length * 3) / 4);
        if (estimatedBytes > maxBytes) {
          throw new Error('ファイルサイズが上限を超えています');
        }
      }
      const buffer = Buffer.from(base64String, 'base64');
      if (maxBytes && buffer.length > maxBytes) {
        throw new Error('ファイルサイズが上限を超えています');
      }
      await fs.writeFile(stampPath, buffer);

      let width, height;

      // 2. メタデータ取得（動画と画像で処理を分ける）
      if (this.isVideoFile(stampPath)) {
        // 動画の場合
        const metadata = await this.getVideoMetadata(stampPath);
        width = metadata.width;
        height = metadata.height;
      } else {
        // 画像の場合
        const metadata = await sharp(stampPath).metadata();
        width = metadata.width;
        height = metadata.height;
      }

      // 3. サムネイル生成
      const thumbs = await this.createThumbnail(stampPath, stampId);

      const stampInfo = {
        id: stampId,
        filename: `${stampId}${ext}`,
        url: `/stamps/${stampId}${ext}`,
        thumbUrl: thumbs.thumbUrl,
        staticThumbUrl: thumbs.staticThumbUrl,
        enabled: true,
        lastUsedAt: 0,
        createdAt: Date.now(),
        size: { width, height },
        isVideo: this.isVideoFile(stampPath)
      };

      console.log(`✅ スタンプ追加成功: ${stampInfo.filename} ${stampInfo.isVideo ? '(動画)' : '(画像)'}`);
      return stampInfo;
    } catch (error) {
      // エラー時はファイルを削除
      try {
        await fs.unlink(stampPath);
      } catch (e) {
        // 削除失敗は無視
      }
      throw error;
    }
  }

  /**
   * スタンプ追加処理（ファイルパスから）
   * @param {string} srcPath - 元画像のパス
   * @param {string} stampId - スタンプID
   * @returns {Promise<object>} スタンプ情報
   */
  async addStamp(srcPath, stampId) {
    const ext = path.extname(srcPath);
    const stampPath = path.join(this.stampDir, `${stampId}${ext}`);

    try {
      // 1. ファイルをコピー
      await fs.copyFile(srcPath, stampPath);

      let width, height;

      // 2. サイズチェック（動画と画像で処理を分ける）
      if (this.isVideoFile(stampPath)) {
        const metadata = await this.getVideoMetadata(stampPath);
        width = metadata.width;
        height = metadata.height;
      } else {
        const metadata = await sharp(stampPath).metadata();
        width = metadata.width;
        height = metadata.height;
      }

      // 3. サムネイル生成
      const thumbs = await this.createThumbnail(stampPath, stampId);

      return {
        id: stampId,
        path: stampPath,
        thumbnail: thumbs.thumbPath,
        staticThumbnail: thumbs.staticThumbPath,
        size: { width, height },
        isVideo: this.isVideoFile(stampPath)
      };
    } catch (error) {
      // エラー時はファイルを削除
      try {
        await fs.unlink(stampPath);
      } catch (e) {
        // 削除失敗は無視
      }
      throw error;
    }
  }

  /**
   * スタンプ一覧取得（メタデータ付き）
   * @returns {Promise<Array<object>>} スタンプ情報の配列
   */
  async getStampList() {
    try {
      const files = await fs.readdir(this.stampDir);
      const validExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.apng', '.mp4', '.webm'];
      
      const stampFiles = files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return validExts.includes(ext) && file.startsWith('s_');
      });

      // スタンプ情報を構築
      const stamps = await Promise.all(stampFiles.map(async (file) => {
        const stampId = path.basename(file, path.extname(file));
        const isVideo = this.isVideoFile(file);
        const thumbUrl = await this.resolveExistingThumbUrl(stampId);
        const staticThumbUrl = await this.resolveStaticThumbUrl(stampId);

        return {
          id: stampId,
          filename: file,
          url: `/stamps/${file}`,
          thumbUrl,
          staticThumbUrl,
          enabled: true,
          lastUsedAt: 0,
          createdAt: parseInt(stampId.replace('s_', '')) || 0,
          isVideo: isVideo
        };
      }));

      // 作成日時でソート（新しい順）
      stamps.sort((a, b) => b.createdAt - a.createdAt);

      return stamps;
    } catch (error) {
      console.error('❌ スタンプ一覧取得失敗:', error);
      return [];
    }
  }

  /**
   * スタンプ一覧取得（ファイル名のみ）
   * @returns {Promise<Array<string>>} スタンプファイル名の配列
   */
  async listStamps() {
    try {
      const files = await fs.readdir(this.stampDir);
      const validExts = this.getValidStampExtensions();
      
      return files.filter(file => {
        const ext = path.extname(file).toLowerCase();
        return validExts.includes(ext);
      });
    } catch (error) {
      console.error('❌ スタンプ一覧取得失敗:', error);
      return [];
    }
  }

  async resolveStampFileById(stampId) {
    const files = await fs.readdir(this.stampDir);
    const validExts = this.getValidStampExtensions();
    return files.find((file) => {
      const ext = path.extname(file).toLowerCase();
      if (!validExts.includes(ext)) return false;
      return path.basename(file, ext) === stampId;
    }) || null;
  }

  async regenerateThumbnailById(stampId) {
    const targetFile = await this.resolveStampFileById(stampId);
    if (!targetFile) {
      throw new Error(`スタンプファイルが見つかりません: ${stampId}`);
    }

    const srcPath = path.join(this.stampDir, targetFile);
    const thumbs = await this.createThumbnail(srcPath, stampId);
    return {
      stampId,
      thumbUrl: thumbs.thumbUrl,
      staticThumbUrl: thumbs.staticThumbUrl
    };
  }

  async regenerateThumbnailsByIds(stampIds, onProgress = null) {
    const result = {
      total: Array.isArray(stampIds) ? stampIds.length : 0,
      successCount: 0,
      failCount: 0,
      failedIds: [],
      regenerated: []
    };

    for (let index = 0; index < stampIds.length; index += 1) {
      const stampId = stampIds[index];
      try {
        const regenerated = await this.regenerateThumbnailById(stampId);
        result.successCount += 1;
        result.regenerated.push(regenerated);
      } catch (error) {
        result.failCount += 1;
        result.failedIds.push(stampId);
        console.error(`❌ サムネイル再生成失敗: ${stampId}`, error);
      }

      if (typeof onProgress === 'function') {
        onProgress({
          current: index + 1,
          total: result.total,
          stampId,
          successCount: result.successCount,
          failCount: result.failCount
        });
      }
    }

    return result;
  }

  async regenerateAllThumbnails(onProgress = null) {
    const files = await fs.readdir(this.stampDir);
    const validExts = this.getValidStampExtensions();
    const stampIds = files
      .filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return validExts.includes(ext) && file.startsWith('s_');
      })
      .map((file) => path.basename(file, path.extname(file)));

    return this.regenerateThumbnailsByIds(stampIds, onProgress);
  }

  /**
   * スタンプ削除
   * @param {string} stampId - 削除するスタンプID
   */
  async deleteStamp(stampId) {
    try {
      // 元画像を削除
      const target = await this.resolveStampFileById(stampId);
      
      if (target) {
        await fs.unlink(path.join(this.stampDir, target));
      }

      // サムネイルを削除（新形式GIF + 旧形式PNG）
      for (const ext of ['.gif', '.png']) {
        const thumbPath = this.getThumbPath(stampId, ext);
        try {
          await fs.unlink(thumbPath);
        } catch (e) {
          // サムネイルが無い場合は無視
        }
      }

      console.log(`✅ スタンプ削除成功: ${stampId}`);
    } catch (error) {
      console.error(`❌ スタンプ削除失敗: ${stampId}`, error);
      throw error;
    }
  }
}

module.exports = StampHandler;
