export class GameOverUI {
  constructor() {
    this.container = document.getElementById('game-over-screen');
    this.finalWave = document.getElementById('final-wave');
    this.restartBtn = document.getElementById('restart-btn');
  }

  show(wave) {
    this.container.classList.remove('hidden');
    this.finalWave.textContent = `You reached Wave ${wave}`;
    return new Promise((resolve) => {
      const handler = () => {
        this.restartBtn.removeEventListener('click', handler);
        this.hide();
        resolve();
      };
      this.restartBtn.addEventListener('click', handler);
    });
  }

  hide() {
    this.container.classList.add('hidden');
  }
}
