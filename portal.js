(() => {
  const playLink = document.getElementById('playLink');
  const openLocal = document.getElementById('openLocal');
  const openFrame = document.getElementById('openFrame');
  const statusText = document.getElementById('statusText');
  const gameFrame = document.getElementById('gameFrame');
  const frameFallback = document.getElementById('frameFallback');

  const gameUrl = './jogo.html';

  frameFallback.style.display = 'block';
  statusText.textContent = 'Portal pronto';

  openFrame.addEventListener('click', () => {
    gameFrame.src = `${gameUrl}?t=${Date.now()}`;
    statusText.textContent = 'Prévia atualizando';
    frameFallback.style.display = 'none';
  });

  openLocal.addEventListener('click', () => {
    gameFrame.src = gameUrl;
    statusText.textContent = 'Prévia local aberta';
    frameFallback.style.display = 'none';
  });

  playLink.addEventListener('click', () => {
    statusText.textContent = 'Abrindo o jogo';
  });

  gameFrame.addEventListener('load', () => {
    frameFallback.style.display = 'none';
    statusText.textContent = 'Prévia carregada';
  });
})();
