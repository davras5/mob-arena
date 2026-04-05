export class BlessingPicker {
  constructor() {
    this.container = document.getElementById('blessing-picker');
    this.cardsEl = document.getElementById('blessing-cards');
    this.onChoose = null;
  }

  show(options, playerAbilities) {
    this.container.classList.remove('hidden');
    this.cardsEl.innerHTML = '';

    return new Promise((resolve) => {
      for (const opt of options) {
        const currentLevel = playerAbilities.find(a => a.id === opt.id)?.level || 0;
        const nextLevel = currentLevel + 1;
        const nextLevelData = opt.levels[nextLevel - 1];

        const card = document.createElement('div');
        card.className = 'blessing-card';
        card.innerHTML = `
          <div class="card-icon">${opt.icon}</div>
          <div class="card-name">${opt.name}</div>
          <div class="card-desc">${opt.description}</div>
          <div class="card-level">${currentLevel > 0 ? `Lv.${currentLevel} → Lv.${nextLevel}` : `New! Lv.1`}</div>
        `;
        card.addEventListener('click', () => {
          this.hide();
          resolve(opt);
        });
        // Touch support
        card.addEventListener('touchend', (e) => {
          e.preventDefault();
          this.hide();
          resolve(opt);
        });
        this.cardsEl.appendChild(card);
      }
    });
  }

  hide() {
    this.container.classList.add('hidden');
  }
}
