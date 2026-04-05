const STORAGE_KEY = 'wave_survival_progress';

const UPGRADES = [
  { id: 'max_hp', name: 'Constitution', icon: '♥', description: '+10 max HP per level', maxLevel: 5, cost: [50, 100, 200, 400, 800], bonus: 10 },
  { id: 'base_damage', name: 'Strength', icon: '⚔', description: '+3 base damage per level', maxLevel: 5, cost: [50, 100, 200, 400, 800], bonus: 3 },
  { id: 'move_speed', name: 'Agility', icon: '⚡', description: '+5% move speed per level', maxLevel: 5, cost: [50, 100, 200, 400, 800], bonus: 0.05 },
  { id: 'xp_gain', name: 'Wisdom', icon: '✦', description: '+10% XP gain per level', maxLevel: 5, cost: [75, 150, 300, 600, 1200], bonus: 0.1 },
  { id: 'starting_shield', name: 'Guardian', icon: '◉', description: 'Start with +10 shield per level', maxLevel: 3, cost: [100, 250, 500], bonus: 10 },
  { id: 'coin_bonus', name: 'Fortune', icon: '★', description: '+15% coin gain per level', maxLevel: 3, cost: [100, 250, 500], bonus: 0.15 },
];

export class Progression {
  constructor() {
    this.data = this._load();
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { coins: 0, upgrades: {}, totalScore: 0, runsCompleted: 0, levelsCleared: [] };
  }

  _save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {}
  }

  get coins() { return this.data.coins; }

  getUpgradeLevel(id) {
    return this.data.upgrades[id] || 0;
  }

  getUpgrades() { return UPGRADES; }

  canAfford(upgradeId) {
    const def = UPGRADES.find(u => u.id === upgradeId);
    if (!def) return false;
    const level = this.getUpgradeLevel(upgradeId);
    if (level >= def.maxLevel) return false;
    return this.data.coins >= def.cost[level];
  }

  buyUpgrade(upgradeId) {
    const def = UPGRADES.find(u => u.id === upgradeId);
    if (!def || !this.canAfford(upgradeId)) return false;
    const level = this.getUpgradeLevel(upgradeId);
    this.data.coins -= def.cost[level];
    this.data.upgrades[upgradeId] = level + 1;
    this._save();
    return true;
  }

  addCoins(score) {
    const coinBonusMult = 1 + this.getUpgradeLevel('coin_bonus') * 0.15;
    const coins = Math.round(score * 0.1 * coinBonusMult);
    this.data.coins += coins;
    this.data.totalScore += score;
    this.data.runsCompleted++;
    this._save();
    return coins;
  }

  applyToPlayer(player) {
    const hpBonus = this.getUpgradeLevel('max_hp') * 10;
    const dmgBonus = this.getUpgradeLevel('base_damage') * 3;
    const spdBonus = this.getUpgradeLevel('move_speed') * 0.05;
    const shieldBonus = this.getUpgradeLevel('starting_shield') * 10;

    player.maxHP += hpBonus;
    player.hp = player.maxHP;
    player.baseDamage += dmgBonus;
    player.damage = player.baseDamage;
    player.baseSpeed *= (1 + spdBonus);
    player.speed = player.baseSpeed;
    if (shieldBonus > 0) {
      player.shieldHP = shieldBonus;
      player.shieldMaxHP = Math.max(player.shieldMaxHP, shieldBonus);
    }
  }

  getXPMultiplier() {
    return 1 + this.getUpgradeLevel('xp_gain') * 0.1;
  }

  markLevelCleared(levelId) {
    if (!this.data.levelsCleared.includes(levelId)) {
      this.data.levelsCleared.push(levelId);
      this._save();
    }
  }

  reset() {
    this.data = { coins: 0, upgrades: {}, totalScore: 0, runsCompleted: 0, levelsCleared: [] };
    this._save();
  }
}
