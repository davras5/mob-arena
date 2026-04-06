export class GameOverUI {
  constructor() {
    this.container = document.getElementById('game-over-screen');
    this.finalWave = document.getElementById('final-wave');
    this.bestComboEl = document.getElementById('best-combo'); // may not exist
    this.finalScore = document.getElementById('final-score');
    this.killBreakdown = document.getElementById('kill-breakdown');
    this.restartBtn = document.getElementById('restart-btn');
  }

  show(wave, bestCombo, score = 0, kills = {}) {
    this.container.classList.remove('hidden');
    this.finalWave.textContent = `You reached Wave ${wave}`;
    if (this.bestComboEl) {
      this.bestComboEl.textContent = bestCombo > 1 ? `Best Combo: x${bestCombo}` : '';
    }
    if (this.finalScore) {
      this.finalScore.textContent = `Score: ${score.toLocaleString()}`;
    }
    if (this.killBreakdown) {
      const LABELS = { grunt: 'Grunt', rusher: 'Rusher', brute: 'Brute', ranged: 'Ranged', splitter: 'Splitter', boss: 'Boss' };
      const entries = Object.entries(kills)
        .filter(([, count]) => count > 0)
        .map(([type, count]) => `<span class="kill-entry">${LABELS[type] || type}: ${count}</span>`)
        .join('');
      this.killBreakdown.innerHTML = entries;
    }
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
