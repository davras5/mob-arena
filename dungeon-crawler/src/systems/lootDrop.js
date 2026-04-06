function randomInRange(range) {
  return range[0] + Math.floor(Math.random() * (range[1] - range[0] + 1));
}

function dist(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

export class LootDrop {
  constructor(itemGenerator, lootTablesData) {
    this.itemGenerator = itemGenerator;
    this.lootTables = lootTablesData;
    this.groundItems = [];   // { item, x, y, spawnTime, pickupRadius }
    this.goldDrops = [];     // { amount, x, y, pickupRadius, spawnTime }
    this.bossChest = null;
    this.inventoryFullTimer = 0;
  }

  // ── Enemy death loot ───────────────────────────────────────────────

  rollEnemyDrop(enemy, floorNumber, playerClass) {
    const table = this.lootTables?.dropSources?.regular_enemy;
    if (!table) return; // No loot table configured
    const potionChance = this.lootTables.potionDropChance.regular_enemy || 0;
    const enemyLevel = enemy.level || floorNumber;
    const spread = 20;

    // 1) Gold — always drop
    const goldAmount = randomInRange(table.goldBase) * enemyLevel;
    this.spawnGold(
      enemy.x + (Math.random() - 0.5) * spread,
      enemy.y + (Math.random() - 0.5) * spread,
      Math.max(1, Math.round(goldAmount))
    );

    // 2) Item roll
    if (Math.random() < table.itemDropChance) {
      const iLvl = enemyLevel;
      const item = this.itemGenerator.generate(iLvl, playerClass, { minRarity: table.minRarity });
      if (item) {
        this.spawnGroundItem(
          enemy.x + (Math.random() - 0.5) * spread,
          enemy.y + (Math.random() - 0.5) * spread,
          item
        );
      }
    }

    // 3) Potion roll
    if (Math.random() < potionChance) {
      const potion = {
        id: 'potion_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        name: 'Health Potion',
        baseType: 'hp_potion',
        slot: 'consumable',
        type: 'hp_potion',
        rarity: 'common',
        rarityColor: '#e74c3c',
        itemLevel: enemyLevel,
        classReq: null,
        levelReq: 0,
        baseStats: { healAmount: 30 + floorNumber * 5 },
        affixes: [],
        uniqueEffect: null,
        sellValue: 5,
        icon: '❤',
        stackCount: 1,
        maxStack: 5,
        gridW: 1,
        gridH: 1,
        isConsumable: true,
        isStackable: true,
        effect: { type: 'heal_percent', value: 0.3, resource: 'hp' },
        cooldownGroup: 'shared',
        cooldown: 3.0,
      };
      this.spawnGroundItem(
        enemy.x + (Math.random() - 0.5) * spread,
        enemy.y + (Math.random() - 0.5) * spread,
        potion
      );
    }
  }

  // ── Boss chest ─────────────────────────────────────────────────────

  createBossChest(x, y, floorNumber, playerClass) {
    const table = this.lootTables?.dropSources?.main_boss_chest;
    if (!table) return;
    const itemCount = table.itemCount || 2;
    const bossLevel = floorNumber;

    const items = [];
    for (let i = 0; i < itemCount; i++) {
      const item = this.itemGenerator.generate(
        bossLevel, playerClass,
        { minRarity: table.minRarity, rarityBonus: table.rarityBonus || 0 }
      );
      if (item) items.push(item);
    }

    // Bonus legendary chance via rarityBonus
    if (table.rarityBonus && Math.random() < table.rarityBonus / 100) {
      const bonusItem = this.itemGenerator.generate(bossLevel, playerClass, { forceRarity: 'legendary' });
      if (bonusItem) items.push(bonusItem);
    }

    const goldAmount = randomInRange(table.goldBase) * bossLevel;

    this.bossChest = {
      x,
      y,
      items,
      gold: Math.max(1, Math.round(goldAmount)),
      opened: false,
    };
  }

  // ── Spawning helpers ───────────────────────────────────────────────

  spawnGroundItem(x, y, item) {
    this.groundItems.push({
      item,
      x,
      y,
      spawnTime: performance.now(),
      pickupRadius: 32,
      bobOffset: Math.random() * Math.PI * 2,
    });
  }

  spawnGold(x, y, amount) {
    this.goldDrops.push({
      amount,
      x,
      y,
      pickupRadius: 48,
      spawnTime: performance.now(),
    });
  }

  // ── Per-frame update ───────────────────────────────────────────────

  update(dt, playerX, playerY, playerRadius, magnetRange, onGoldPickup, onItemPickup) {
    // Tick inventory-full message timer
    if (this.inventoryFullTimer > 0) {
      this.inventoryFullTimer -= dt;
    }

    // 1) Gold auto-pickup + magnet pull
    for (let i = this.goldDrops.length - 1; i >= 0; i--) {
      const g = this.goldDrops[i];
      const d = dist(playerX, playerY, g.x, g.y);

      // Magnet effect — slide gold toward player
      if (d < magnetRange && d > g.pickupRadius) {
        const pull = 250 * dt;
        const dx = playerX - g.x;
        const dy = playerY - g.y;
        g.x += (dx / Math.max(1, d)) * pull;
        g.y += (dy / Math.max(1, d)) * pull;
      }

      // Pick up
      if (d < g.pickupRadius) {
        if (onGoldPickup) onGoldPickup(g.amount);
        this.goldDrops.splice(i, 1);
      }
    }

    // 2) Item auto-pickup
    for (let i = this.groundItems.length - 1; i >= 0; i--) {
      const gi = this.groundItems[i];
      const d = dist(playerX, playerY, gi.x, gi.y);

      if (d < gi.pickupRadius) {
        if (onItemPickup) {
          const picked = onItemPickup(gi.item);
          if (picked) {
            this.groundItems.splice(i, 1);
          } else {
            // Inventory full — show message briefly
            this.inventoryFullTimer = 1.5;
          }
        }
      }
    }
  }

  // ── Cleanup / accessors ────────────────────────────────────────────

  clear() {
    this.groundItems = [];
    this.goldDrops = [];
    this.bossChest = null;
  }

  getGroundItems() {
    return this.groundItems;
  }

  getGoldDrops() {
    return this.goldDrops;
  }
}
