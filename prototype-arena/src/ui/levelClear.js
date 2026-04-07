export class LevelClearUI {
  constructor() {
    this.container = document.getElementById('level-clear-screen');
    this.title = document.getElementById('level-clear-title');
    this.scoreEl = document.getElementById('clear-score');
    this.comboEl = document.getElementById('clear-combo');
    this.killsEl = document.getElementById('clear-kills');
    this.stars = [
      document.getElementById('star-1'),
      document.getElementById('star-2'),
      document.getElementById('star-3'),
    ];
    this.continueBtn = document.getElementById('continue-btn');
  }

  show(levelName, score, bestCombo, totalKills, starCount) {
    this.container.classList.remove('hidden');
    this.title.textContent = `${levelName} Complete!`;
    this.scoreEl.textContent = score.toLocaleString();
    this.comboEl.textContent = bestCombo > 1 ? `x${bestCombo}` : '-';
    this.killsEl.textContent = totalKills.toString();

    // Animate stars
    for (let i = 0; i < 3; i++) {
      this.stars[i].classList.remove('earned', 'unearned');
      if (i < starCount) {
        this.stars[i].classList.add('earned');
        // Stagger animation
        this.stars[i].style.animationDelay = `${0.3 + i * 0.3}s`;
      } else {
        this.stars[i].classList.add('unearned');
      }
    }

    return new Promise((resolve) => {
      const handler = () => {
        this.continueBtn.removeEventListener('click', handler);
        this.hide();
        resolve();
      };
      this.continueBtn.addEventListener('click', handler);
    });
  }

  hide() {
    this.container.classList.add('hidden');
  }
}
