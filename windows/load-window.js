function loadWithRetry(window, url, fallbackPath, { retries = 5, delay = 1000 } = {}) {
  const attempt = (remaining) => {
    if (window.isDestroyed()) return;
    window.loadURL(url).catch((error) => {
      if (window.isDestroyed()) return;
      if (remaining > 0) {
        setTimeout(() => attempt(remaining - 1), delay);
      } else if (fallbackPath) {
        window.loadFile(fallbackPath).catch(console.error);
      } else {
        console.error('画面を読み込めませんでした', error);
      }
    });
  };
  attempt(retries);
}
module.exports = loadWithRetry;
