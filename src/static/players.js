(() => {
  // Optional Worker override; GitHub Pages publishes a timestamped static snapshot.
  const PLAYER_COUNT_URL = siteConfig.playerCountUrl || new URL('players.json', document.baseURI).href;
  const count = document.querySelector('#player-count');
  const status = document.querySelector('#player-count-status');
  let busy = false;
  let lastSuccess = 0;
  async function updatePlayers() {
    if (busy || document.hidden || !count) return;
    busy = true;
    try {
      const response = await fetch(PLAYER_COUNT_URL, {cache:'no-store',signal:AbortSignal.timeout(10000)});
      if (!response.ok) throw new Error('Unavailable');
      const data = await response.json();
      const checkedAt = Date.parse(data.checkedAt);
      if (!Number.isSafeInteger(data.players) || data.players < 0 || !Number.isFinite(checkedAt) || Date.now()-checkedAt > 60*60*1000 || checkedAt > Date.now()+60000) throw new Error('Invalid data');
      count.textContent = data.players.toLocaleString('en');
      status.textContent = 'Checked ' + new Date(checkedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}) + ' · Steam'+(siteConfig.playerCountUrl?'':' · updates about every 15 min');
      lastSuccess = Date.now();
    } catch {
      count.textContent = '—';
      status.textContent = 'Player count unavailable';
    } finally {busy = false;}
  }
  updatePlayers();
  setInterval(updatePlayers, 5*60*1000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && Date.now()-lastSuccess >= 5*60*1000) updatePlayers();
  });
})();
