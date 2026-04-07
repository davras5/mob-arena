const SHOP_ITEMS = [
  {
    id: 'health_potion',
    name: 'Health Potion',
    description: 'Restores 40 HP. Max carry: 3.',
    icon: '\u2764',
    price: 50,
    maxOwned: 3,
    type: 'consumable',
  },
  {
    id: 'damage_scroll',
    name: 'Scroll of Might',
    description: '+20% damage for next dungeon run.',
    icon: '\u2694',
    price: 100,
    maxOwned: 1,
    type: 'buff',
  },
  {
    id: 'defense_scroll',
    name: 'Scroll of Fortitude',
    description: '+20% damage reduction for next dungeon run.',
    icon: '\ud83d\udee1',
    price: 100,
    maxOwned: 1,
    type: 'buff',
  },
];

export class ShopUI {
  constructor() {
    this.container = document.getElementById('shop-panel');
  }

  show(gold, inventory) {
    this.container.classList.remove('hidden');
    this.container.innerHTML = '';

    return new Promise((resolve) => {
      let html = `
        <div class="shop-header">
          <h2>Vendor</h2>
          <span class="shop-gold">Gold: <strong>${gold}</strong></span>
        </div>
        <div class="shop-items">
      `;

      for (const item of SHOP_ITEMS) {
        const owned = inventory[item.id] || 0;
        const canBuy = gold >= item.price && owned < item.maxOwned;
        const stateClass = canBuy ? 'available' : 'unavailable';

        html += `
          <div class="shop-item ${stateClass}" data-item-id="${item.id}" data-price="${item.price}">
            <div class="shop-item-icon">${item.icon}</div>
            <div class="shop-item-name">${item.name}</div>
            <div class="shop-item-desc">${item.description}</div>
            <div class="shop-item-price">${item.price} gold</div>
            <div class="shop-item-owned">${owned}/${item.maxOwned}</div>
          </div>
        `;
      }

      html += `</div>`;
      html += `<button class="shop-close-btn" id="shop-close">Back to Camp</button>`;

      this.container.innerHTML = html;

      // Buy handlers
      for (const el of this.container.querySelectorAll('.shop-item.available')) {
        el.addEventListener('click', () => {
          const itemId = el.dataset.itemId;
          const price = parseInt(el.dataset.price);
          this.hide();
          resolve({ action: 'buy', itemId, price });
        });
        el.addEventListener('touchend', (e) => {
          e.preventDefault();
          const itemId = el.dataset.itemId;
          const price = parseInt(el.dataset.price);
          this.hide();
          resolve({ action: 'buy', itemId, price });
        });
      }

      this.container.querySelector('#shop-close').addEventListener('click', () => {
        this.hide();
        resolve({ action: 'cancel' });
      });
    });
  }

  hide() {
    this.container.classList.add('hidden');
  }
}
