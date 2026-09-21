const fs = require('fs').promises;
const path = require('path');

const MIME_EXT_MAP = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif'
};

function isImageDataUrl(value) {
  return typeof value === 'string' && value.startsWith('data:image/');
}

function parseDataUrl(dataUrl) {
  const match = /^data:(image\/\w+);base64,(.+)$/i.exec(dataUrl || '');
  if (!match) return null;
  return { mime: match[1].toLowerCase(), data: match[2] };
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function saveImageDataUrl({ dataUrl, imageDir, baseName, maxBytes = null }) {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) {
    throw new Error('画像データが不正です');
  }

  const ext = MIME_EXT_MAP[parsed.mime] || '.png';
  const buffer = Buffer.from(parsed.data, 'base64');
  if (maxBytes && buffer.length > maxBytes) {
    throw new Error('画像サイズが上限を超えています');
  }

  await ensureDir(imageDir);
  const filename = `${baseName}${ext}`;
  const filePath = path.join(imageDir, filename);
  await fs.writeFile(filePath, buffer);
  return filename;
}

async function maybeStoreImage({ value, imageDir, publicBasePath, baseName, maxBytes = null }) {
  if (!isImageDataUrl(value)) {
    return { value, updated: false };
  }

  const filename = await saveImageDataUrl({
    dataUrl: value,
    imageDir,
    baseName,
    maxBytes
  });

  const version = Date.now();
  const publicUrl = `${publicBasePath}/${filename}?v=${version}`;
  return { value: publicUrl, updated: true };
}

module.exports = {
  isImageDataUrl,
  parseDataUrl,
  ensureDir,
  saveImageDataUrl,
  maybeStoreImage
};
