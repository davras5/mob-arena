import { Game } from './game.js';

async function init() {
  const canvas = document.getElementById('game-canvas');

  // Load data
  const [floorsRes, classesRes, campRes, resourcesRes, skillsRes, itemBasesRes, affixesRes, trapsRes, potionsRes, lootTablesRes] = await Promise.all([
    fetch('./src/data/floors.json'),
    fetch('./src/data/classes.json'),
    fetch('./src/data/camp.json'),
    fetch('./src/data/resources.json'),
    fetch('./src/data/skills.json').catch(() => new Response('{}')),
    fetch('./src/data/itemBases.json'),
    fetch('./src/data/affixes.json'),
    fetch('./src/data/traps.json'),
    fetch('./src/data/potions.json'),
    fetch('./src/data/lootTables.json'),
  ]);
  const floorsData = await floorsRes.json();
  const classesData = await classesRes.json();
  const campData = await campRes.json();
  const resourcesData = await resourcesRes.json();
  const skillsData = await skillsRes.json();
  const itemBasesData = await itemBasesRes.json();
  const affixesData = await affixesRes.json();
  const trapsData = await trapsRes.json();
  const potionsData = await potionsRes.json();
  const lootTablesData = await lootTablesRes.json();

  const game = new Game(canvas, floorsData, classesData, campData, resourcesData, skillsData, itemBasesData, affixesData, trapsData, potionsData, lootTablesData);

  // Show Continue button if a save with a class exists
  const savedChar = game.persistence.getCharacter();
  const continueBtn = document.getElementById('continue-btn');
  if (savedChar && savedChar.class) {
    continueBtn.classList.remove('hidden');
    continueBtn.textContent = `Continue (${savedChar.class.charAt(0).toUpperCase() + savedChar.class.slice(1)} Lv.${savedChar.level || 1})`;
  }

  // Menu start button
  document.getElementById('start-btn').addEventListener('click', () => {
    if (game.state === 'MENU') {
      game.audio.buttonClick();
      game.start(); // shows class picker
    }
  });

  // Continue button
  continueBtn.addEventListener('click', () => {
    if (game.state === 'MENU' && savedChar && savedChar.class) {
      game.audio.buttonClick();
      game.start(savedChar.class); // skip class picker, use saved class
    }
  });

  // Pause: Escape key
  game.input.onPause = () => game.togglePause();

  // Pause: button and overlay resume
  document.getElementById('pause-btn').addEventListener('click', () => game.togglePause());
  document.getElementById('resume-btn').addEventListener('click', () => game.togglePause());
  document.getElementById('camp-btn').addEventListener('click', () => {
    game.togglePause();
    if (game._enterBaseCamp) game._enterBaseCamp();
  });

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
