import { Enemy } from '../entities/enemy.js';
import { Boss } from '../entities/boss.js';
import { Blessing } from '../entities/blessing.js';

export class WaveSystem {
  constructor(waveData) {
    this.waveData = waveData;
    this.currentWave = 0;
    this.enemies = [];
    this.boss = null;
    this.blessings = [];
    this.state = 'idle'; // idle, active, cleared, blessing_pick, countdown
    this.countdownTimer = 0;
    this.blessingsToCollect = 0;
    this.mapWidth = 1600;
    this.mapHeight = 1600;
  }

  startWave(waveNum) {
    this.currentWave = waveNum;
    this.state = 'active';
    this.enemies = [];
    this.boss = null;

    const config = this._getWaveConfig(waveNum);

    // Spawn boss if applicable
    if (config.boss) {
      const bx = this.mapWidth / 2 + (Math.random() - 0.5) * 400;
      const by = this.mapHeight / 2 + (Math.random() - 0.5) * 400;
      this.boss = new Boss(config.boss, bx, by, waveNum);
    }

    // Spawn enemies
    if (config.enemies) {
      for (const group of config.enemies) {
        const scaledCount = this._scaleCount(group.count, waveNum);
        for (let i = 0; i < scaledCount; i++) {
          const pos = this._randomEdgePosition();
          this.enemies.push(new Enemy(group.type, pos.x, pos.y, waveNum));
        }
      }
    }

    this.blessingsToCollect = config.blessings || 1;
    this.totalEnemies = this.enemies.length + (this.boss ? 1 : 0);
  }

  _getWaveConfig(waveNum) {
    // Find exact match or generate from scaling
    const exact = this.waveData.find(w => w.wave === waveNum);
    if (exact) return exact;

    // Beyond defined waves: scale
    const isBossWave = waveNum % 5 === 0;
    const bosses = ['stoneguard', 'voidlord', 'swarmmother'];
    const bossIdx = Math.floor(waveNum / 5 - 1) % bosses.length;

    const types = ['grunt', 'rusher', 'brute', 'ranged', 'splitter'];
    const enemies = [];
    const numTypes = Math.min(3 + Math.floor(waveNum / 5), types.length);
    for (let i = 0; i < numTypes; i++) {
      enemies.push({
        type: types[i],
        count: Math.round(4 + waveNum * 0.8),
      });
    }

    return {
      wave: waveNum,
      enemies,
      boss: isBossWave ? bosses[bossIdx] : undefined,
      blessings: isBossWave ? 2 : 1,
    };
  }

  _scaleCount(baseCount, wave) {
    if (wave <= 15) return baseCount;
    return Math.round(baseCount * Math.pow(1.15, wave - 15));
  }

  _randomEdgePosition() {
    const side = Math.floor(Math.random() * 4);
    const margin = 50;
    switch (side) {
      case 0: return { x: margin + Math.random() * (this.mapWidth - 2 * margin), y: margin };
      case 1: return { x: margin + Math.random() * (this.mapWidth - 2 * margin), y: this.mapHeight - margin };
      case 2: return { x: margin, y: margin + Math.random() * (this.mapHeight - 2 * margin) };
      case 3: return { x: this.mapWidth - margin, y: margin + Math.random() * (this.mapHeight - 2 * margin) };
      default: return { x: this.mapWidth / 2, y: margin };
    }
  }

  checkWaveClear() {
    if (this.state !== 'active') return false;
    const allDead = this.enemies.every(e => e.dead);
    const bossDeadOrNone = !this.boss || this.boss.dead;
    return allDead && bossDeadOrNone;
  }

  triggerWaveClear() {
    this.state = 'cleared';
    // Spawn blessings
    this.blessings = [];
    const cx = this.mapWidth / 2;
    const cy = this.mapHeight / 2;
    for (let i = 0; i < this.blessingsToCollect; i++) {
      const angle = (i / this.blessingsToCollect) * Math.PI * 2;
      const dist = 80 + Math.random() * 60;
      // Spawn near center of map, spread out
      const bx = Math.max(60, Math.min(this.mapWidth - 60, cx + Math.cos(angle) * dist));
      const by = Math.max(60, Math.min(this.mapHeight - 60, cy + Math.sin(angle) * dist));
      this.blessings.push(new Blessing(bx, by));
    }
  }

  allBlessingsCollected() {
    return this.blessings.every(b => b.collected);
  }

  startCountdown(duration) {
    this.state = 'countdown';
    this.countdownTimer = duration;
  }

  updateCountdown(dt) {
    if (this.state !== 'countdown') return false;
    this.countdownTimer -= dt;
    return this.countdownTimer <= 0;
  }

  addEnemiesFromBoss(type, count, bossX, bossY) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 40 + Math.random() * 30;
      const ex = bossX + Math.cos(angle) * dist;
      const ey = bossY + Math.sin(angle) * dist;
      this.enemies.push(new Enemy(type, ex, ey, this.currentWave));
    }
  }
}
