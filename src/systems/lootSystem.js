export class LootSystem {
  constructor(itemGenerator) {
    this.itemGenerator = itemGenerator;
    this.groundItems = [];  // { x, y, item, timer, bobOffset }
    this.goldDrops = [];    // { x, y, amount, timer }
    this.bossChest = null;  // { x, y, items: [], gold, opened }
  }

  // Roll loot for a regular enemy kill
  rollEnemyDrop(enemy, floor, playerClass) {
    const goldAmount = 1 + floor + Math.floor(Math.random() * 3);
    this.spawnGold(enemy.x, enemy.y, goldAmount);

    // 7% item drop chance
    if (Math.random() < 0.07) {
      const item = this.itemGenerator.generate(floor, null, null, playerClass);
      if (item) this.spawnGroundItem(enemy.x, enemy.y, item);
    }

    // 20% junk drop
    if (Math.random() < 0.2) {
      const junk = this.itemGenerator.generate(floor, null, 'junk');
      if (junk) this.spawnGroundItem(enemy.x + (Math.random() - 0.5) * 30, enemy.y + (Math.random() - 0.5) * 30, junk);
    }
  }

  // Roll loot for elite/mini-boss
  rollEliteDrop(enemy, floor, playerClass) {
    const goldAmount = 10 + floor * 2 + Math.floor(Math.random() * 10);
    this.spawnGold(enemy.x, enemy.y, goldAmount);

    // Guaranteed magic+ item
    const item = this.itemGenerator.generate(floor, 'magic', null, playerClass);
    if (item) this.spawnGroundItem(enemy.x, enemy.y, item);
  }

  // Create boss chest
  createBossChest(x, y, floor, playerClass) {
    const items = [];
    const goldAmount = 50 + floor * 5 + Math.floor(Math.random() * 20);

    // Guaranteed rare+ item
    items.push(this.itemGenerator.generate(floor, 'rare', null, playerClass));

    // Chance for legendary (5% + floor%)
    if (Math.random() < 0.05 + floor * 0.01) {
      items.push(this.itemGenerator.generate(floor, 'legendary', null, playerClass));
    }

    // Extra random item
    if (Math.random() < 0.5) {
      items.push(this.itemGenerator.generate(floor, null, null, playerClass));
    }

    this.bossChest = {
      x, y,
      items: items.filter(i => i !== null),
      gold: goldAmount,
      opened: false,
    };
  }

  spawnGold(x, y, amount) {
    const spread = 20;
    this.goldDrops.push({
      x: x + (Math.random() - 0.5) * spread,
      y: y + (Math.random() - 0.5) * spread,
      amount,
      timer: 30, // 30s lifetime
    });
  }

  spawnGroundItem(x, y, item) {
    this.groundItems.push({
      x: x + (Math.random() - 0.5) * 20,
      y: y + (Math.random() - 0.5) * 20,
      item,
      timer: 60, // 60s lifetime
      bobOffset: Math.random() * Math.PI * 2,
    });
  }

  // Update timers, handle player pickup
  update(dt, playerX, playerY, playerRadius, magnetRange, onGoldPickup, onItemPickup) {
    // Gold auto-collect (magnet)
    for (let i = this.goldDrops.length - 1; i >= 0; i--) {
      const g = this.goldDrops[i];
      g.timer -= dt;
      if (g.timer <= 0) { this.goldDrops.splice(i, 1); continue; }

      const dx = playerX - g.x;
      const dy = playerY - g.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Magnet pull
      if (dist < magnetRange) {
        const pull = 250 * dt;
        g.x += (dx / Math.max(1, dist)) * pull;
        g.y += (dy / Math.max(1, dist)) * pull;
      }

      // Collect
      if (dist < playerRadius + 10) {
        if (onGoldPickup) onGoldPickup(g.amount);
        this.goldDrops.splice(i, 1);
      }
    }

    // Ground items - walk over to pick up
    for (let i = this.groundItems.length - 1; i >= 0; i--) {
      const gi = this.groundItems[i];
      gi.timer -= dt;
      if (gi.timer <= 0) { this.groundItems.splice(i, 1); continue; }

      const dx = playerX - gi.x;
      const dy = playerY - gi.y;
      if (Math.sqrt(dx * dx + dy * dy) < playerRadius + 12) {
        if (onItemPickup && onItemPickup(gi.item)) {
          this.groundItems.splice(i, 1);
        }
      }
    }
  }

  clear() {
    this.groundItems = [];
    this.goldDrops = [];
    this.bossChest = null;
  }
}
