const ENEMY_TYPES = {
  grunt: {
    color: '#e74c3c',
    radius: 12,
    baseHP: 20,
    baseSpeed: 50,
    damage: 10,
    xp: 10,
  },
  rusher: {
    color: '#e67e22',
    radius: 10,
    baseHP: 12,
    baseSpeed: 100,
    damage: 8,
    xp: 12,
  },
  brute: {
    color: '#8e44ad',
    radius: 18,
    baseHP: 60,
    baseSpeed: 35,
    damage: 20,
    xp: 25,
  },
  ranged: {
    color: '#27ae60',
    radius: 11,
    baseHP: 15,
    baseSpeed: 40,
    damage: 12,
    xp: 15,
    attackRange: 200,
    shootCooldown: 2.0,
    projectileSpeed: 180,
  },
  splitter: {
    color: '#f39c12',
    radius: 14,
    baseHP: 25,
    baseSpeed: 45,
    damage: 8,
    xp: 15,
    splitsInto: 'grunt',
    splitCount: 2,
  },
};

export class Enemy {
  constructor(type, x, y, wave) {
    const def = ENEMY_TYPES[type];
    this.type = type;
    this.x = x;
    this.y = y;
    this.color = def.color;
    this.radius = def.radius;
    this.baseSpeed = def.baseSpeed;
    this.speed = def.baseSpeed;
    this.damage = def.damage;
    this.xp = def.xp;

    // Scale by wave
    const hpMult = Math.pow(1.1, wave - 1);
    this.maxHP = Math.round(def.baseHP * hpMult);
    this.hp = this.maxHP;

    this.attackRange = def.attackRange || 0;
    this.shootCooldown = def.shootCooldown || 0;
    this.shootTimer = this.shootCooldown * Math.random();
    this.projectileSpeed = def.projectileSpeed || 0;

    this.splitsInto = def.splitsInto || null;
    this.splitCount = def.splitCount || 0;

    this.slowTimer = 0;
    this.slowPercent = 0;
    this.dead = false;
    this.contactCooldown = 0;
  }

  update(dt, playerX, playerY) {
    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Slow effect
    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
      this.speed = this.baseSpeed * (1 - this.slowPercent);
    } else {
      this.speed = this.baseSpeed;
    }

    // Ranged: stop at distance
    if (this.attackRange > 0 && dist < this.attackRange) {
      this.shootTimer -= dt;
      return; // Don't move closer
    }

    if (dist > 1) {
      this.x += (dx / dist) * this.speed * dt;
      this.y += (dy / dist) * this.speed * dt;
    }

    if (this.shootTimer > 0) this.shootTimer -= dt;
    if (this.contactCooldown > 0) this.contactCooldown -= dt;
  }

  canShoot() {
    return this.attackRange > 0 && this.shootTimer <= 0;
  }

  shoot() {
    this.shootTimer = this.shootCooldown;
  }

  applySlow(percent, duration) {
    this.slowPercent = Math.max(this.slowPercent, percent);
    this.slowTimer = Math.max(this.slowTimer, duration);
  }

  takeDamage(amount) {
    this.hp -= amount;
    if (this.hp <= 0) {
      this.dead = true;
    }
    return this.dead;
  }
}

export { ENEMY_TYPES };
