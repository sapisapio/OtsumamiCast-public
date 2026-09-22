export function connectionUrl(input, fallback = window.location.origin) {
  const raw = String(input || fallback).trim();
  const explicitScheme = /^[a-z]+:\/\//i.test(raw);
  const url = new URL(explicitScheme ? raw : `http://${raw}`);
  if (!['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol) || !url.hostname || url.username || url.password) {
    throw new Error('配信者のURLまたはIP:ポートを入力してください');
  }
  if (!explicitScheme && !url.port) url.port = '7244';
  url.protocol = ['https:', 'wss:'].includes(url.protocol) ? 'wss:' : 'ws:';
  url.pathname = '/';
  url.search = '';
  url.hash = '';
  return url.toString();
}

export function assetOrigin(socket = window.otsumamiWs) {
  if (!socket?.url) return window.location.origin;
  const url = new URL(socket.url);
  url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:';
  return url.origin;
}

export function resolveAsset(url, socket = window.otsumamiWs) {
  return url ? new URL(url, assetOrigin(socket)).toString() : '';
}
