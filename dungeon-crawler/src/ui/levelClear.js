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
    if (this.scoreEl) this.scoreEl.textContent = score.toLocaleString();
    if (this.comboEl) this.comboEl.textContent = bestCombo > 1 ? `x${bestCombo}` : '-';
    this.killsEl.textContent = totalKills.toString();

    // Star criteria labels
    const criteria = [
      'Defeat the Boss',
      'Clear All Combat Rooms',
      'Defeat All Side Bosses',
    ];

    // Animate stars
    for (let i = 0; i < 3; i++) {
      this.stars[i].classList.remove('earned', 'unearned');
      if (i < starCount) {
        this.stars[i].classList.add('earned');
        this.stars[i].style.animationDelay = `${0.3 + i * 0.3}s`;
      } else {
        this.stars[i].classList.add('unearned');
      }
      // Add a label below each star
      let labelEl = this.stars[i].nextElementSibling;
      if (!labelEl || !labelEl.classList || !labelEl.classList.contains('star-label')) {
        labelEl = document.createElement('div');
        labelEl.className = 'star-label';
        labelEl.style.cssText = 'position:absolute;top:100%;left:50%;transform:translateX(-50%);font-size:10px;color:#a89c80;white-space:nowrap;margin-top:4px;text-align:center;font-family:"Segoe UI",Arial,sans-serif;';
        // Position the parent star relative so the label can absolute under it
        this.stars[i].style.position = 'relative';
        this.stars[i].appendChild(labelEl);
      }
      labelEl.textContent = criteria[i];
      labelEl.style.color = i < starCount ? '#f1c40f' : '#666';
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
