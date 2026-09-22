let timer = null;
let pendingSocket = null;

export function resetQueueAutoplay() {
  clearTimeout(timer);
  timer = null;
  pendingSocket = null;
}

export function scheduleQueueAutoplay(state, delay = 500) {
  if (timer || pendingSocket === state.ws) return;
  const socket = state.ws;
  timer = setTimeout(() => {
    timer = null;
    if (state.ws !== socket || state.role !== 'host' || socket?.readyState !== 1 || !state.videoQueue?.length) return;
    if (![-1, 0, 5].includes(state.player?.getPlayerState())) return;
    pendingSocket = socket;
    socket.send(JSON.stringify({ type: 'play-next' }));
  }, delay);
}
