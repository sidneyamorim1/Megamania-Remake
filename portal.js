(() => {
  const playLink = document.getElementById('playLink');
  const statusText = document.getElementById('statusText');
  const gameFrame = document.getElementById('gameFrame');
  statusText.textContent = 'Megamania-Remake carregando';

  playLink.addEventListener('click', () => {
    statusText.textContent = 'Abrindo o jogo';
  });

  gameFrame.addEventListener('load', () => {
    statusText.textContent = 'Megamania-Remake carregado';
  });
})();
