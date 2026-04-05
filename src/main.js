import { Game } from './game.js';

async function init() {
  const canvas = document.getElementById('game-canvas');

  // Load data
  const [abilitiesRes, wavesRes, levelsRes, weaponsRes] = await Promise.all([
    fetch('./src/data/abilities.json'),
    fetch('./src/data/waves.json'),
    fetch('./src/data/levels.json'),
    fetch('./src/data/weapons.json'),
  ]);
  const abilitiesData = await abilitiesRes.json();
  const wavesData = await wavesRes.json();
  const levelsData = await levelsRes.json();
  const weaponsData = await weaponsRes.json();

  const game = new Game(canvas, abilitiesData, wavesData, levelsData, weaponsData);

  // Menu start button
  document.getElementById('start-btn').addEventListener('click', () => {
    if (game.state === 'MENU') {
      game.audio.buttonClick();
      game.start();
    }
  });

  // Shop button
  document.getElementById('shop-btn').addEventListener('click', () => {
    game.audio.buttonClick();
    game.upgradeShop.show(game.progression, () => {
      game._updateMenuCoins();
    });
  });

  // Show coins on menu
  game._updateMenuCoins();

  // Pause: Escape key
  game.input.onPause = () => game.togglePause();

  // Pause: button and overlay resume
  document.getElementById('pause-btn').addEventListener('click', () => game.togglePause());
  document.getElementById('resume-btn').addEventListener('click', () => game.togglePause());

  // Game loop
  let lastTime = performance.now();

  function loop(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.05); // Cap at 50ms
    lastTime = now;

    if (game.state !== 'MENU' && game.state !== 'GAME_OVER' && game.state !== 'WORLD_MAP' && !game.paused) {
      game.update(dt);
    }
    game.render();

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}

init().catch(console.error);
