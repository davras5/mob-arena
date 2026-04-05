import { Game } from './game.js';

async function init() {
  const canvas = document.getElementById('game-canvas');

  // Load data
  const [abilitiesRes, wavesRes] = await Promise.all([
    fetch('./src/data/abilities.json'),
    fetch('./src/data/waves.json'),
  ]);
  const abilitiesData = await abilitiesRes.json();
  const wavesData = await wavesRes.json();

  const game = new Game(canvas, abilitiesData, wavesData);

  // Menu start button
  document.getElementById('start-btn').addEventListener('click', () => {
    if (game.state === 'MENU') {
      game.audio.buttonClick();
      game.start();
    }
  });

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

    if (game.state !== 'MENU' && game.state !== 'GAME_OVER' && !game.paused) {
      game.update(dt);
    }
    game.render();

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}

init().catch(console.error);
