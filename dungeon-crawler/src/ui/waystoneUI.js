export class WaystoneUI {
  constructor() {
    this.container = document.getElementById('waystone-panel');
  }

  show(levelsData, unlockedWaystones, clearedDungeons) {
    this.container.classList.remove('hidden');
    this.container.innerHTML = '';

    return new Promise((resolve) => {
      let html = `
        <div class="waystone-header">
          <h2>Way Stone Network</h2>
          <p class="waystone-subtitle">Select a destination to teleport</p>
        </div>
        <div class="waystone-list">
      `;

      for (const level of levelsData) {
        const isUnlocked = unlockedWaystones.includes(level.id + '_entrance');
        const isCleared = clearedDungeons[level.id];
        const stateClass = isUnlocked ? (isCleared ? 'cleared' : 'unlocked') : 'locked';

        html += `
          <div class="waystone-dest ${stateClass}" data-level-id="${level.id}">
            <span class="waystone-icon">${level.icon}</span>
            <div class="waystone-info">
              <div class="waystone-name">${level.name}</div>
              <div class="waystone-desc">${isUnlocked ? level.description : 'Not yet discovered'}</div>
            </div>
            <div class="waystone-status">
              ${isCleared ? '\u2713' : isUnlocked ? '\u27a4' : '\ud83d\udd12'}
            </div>
          </div>
        `;
      }

      html += `</div>`;
      html += `<button class="waystone-close-btn" id="waystone-close">Back to Camp</button>`;

      this.container.innerHTML = html;

      // Wire click handlers
      for (const dest of this.container.querySelectorAll('.waystone-dest.unlocked, .waystone-dest.cleared')) {
        dest.addEventListener('click', () => {
          const levelId = dest.dataset.levelId;
          const level = levelsData.find(l => l.id === levelId);
          this.hide();
          resolve({ action: 'teleport', level });
        });
        dest.addEventListener('touchend', (e) => {
          e.preventDefault();
          const levelId = dest.dataset.levelId;
          const level = levelsData.find(l => l.id === levelId);
          this.hide();
          resolve({ action: 'teleport', level });
        });
      }

      this.container.querySelector('#waystone-close').addEventListener('click', () => {
        this.hide();
        resolve({ action: 'cancel' });
      });
    });
  }

  hide() {
    this.container.classList.add('hidden');
  }
}
