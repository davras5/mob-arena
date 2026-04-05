export class UpgradeShop {
  constructor() {
    this.container = document.getElementById('upgrade-shop');
    this.coinsDisplay = document.getElementById('shop-coins');
    this.upgradeList = document.getElementById('upgrade-list');
    this.closeBtn = document.getElementById('shop-close-btn');
  }

  show(progression, onClose) {
    this.container.classList.remove('hidden');
    this._render(progression);

    const handler = () => {
      this.closeBtn.removeEventListener('click', handler);
      this.hide();
      if (onClose) onClose();
    };
    this.closeBtn.addEventListener('click', handler);
  }

  _render(progression) {
    this.coinsDisplay.textContent = `Coins: ${progression.coins.toLocaleString()}`;
    this.upgradeList.innerHTML = '';

    for (const upg of progression.getUpgrades()) {
      const level = progression.getUpgradeLevel(upg.id);
      const isMaxed = level >= upg.maxLevel;
      const cost = isMaxed ? 'MAX' : upg.cost[level];
      const canAfford = progression.canAfford(upg.id);

      const div = document.createElement('div');
      div.className = `upgrade-item ${isMaxed ? 'maxed' : ''} ${canAfford ? 'affordable' : ''}`;
      div.innerHTML = `
        <div class="upgrade-icon">${upg.icon}</div>
        <div class="upgrade-info">
          <div class="upgrade-name">${upg.name} ${isMaxed ? '(MAX)' : `Lv.${level}`}</div>
          <div class="upgrade-desc">${upg.description}</div>
        </div>
        <div class="upgrade-cost">${isMaxed ? '✓' : `${cost} coins`}</div>
      `;

      if (!isMaxed && canAfford) {
        div.addEventListener('click', () => {
          progression.buyUpgrade(upg.id);
          this._render(progression);
        });
      }

      this.upgradeList.appendChild(div);
    }
  }

  hide() {
    this.container.classList.add('hidden');
  }
}
