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

    this.hitFlashTimer = 0;
    this.slowTimer = 0;
    this.slowPercent = 0;
    this.dead = false;
    this.contactCooldown = 0;

    // Rusher zigzag
    this.zigzagOffset = Math.random() * Math.PI * 2;

    // Brute charge
    this.chargeState = 'idle';
    this.chargeTimer = 0;

    // Ranged strafe
    this.strafeTimer = 0;
    this.strafeDir = 1;

    // Spawn animation
    this.spawnTimer = 0.3;
  }

  get scale() {
    return Math.min(1, 1 - this.spawnTimer / 0.3);
  }

  update(dt, playerX, playerY) {
    if (this.spawnTimer > 0) this.spawnTimer -= dt;
    if (this.hitFlashTimer > 0) this.hitFlashTimer -= dt;
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

    // Ranged: strafe when in attack range instead of standing still
    if (this.attackRange > 0 && dist < this.attackRange) {
      this.shootTimer -= dt;
      this.strafeTimer += dt;
      if (this.strafeTimer >= 2) {
        this.strafeTimer = 0;
        this.strafeDir *= -1;
      }
      // Move perpendicular to player direction
      if (dist > 1) {
        const perpX = -dy / dist;
        const perpY = dx / dist;
        this.x += perpX * this.strafeDir * this.speed * dt;
        this.y += perpY * this.strafeDir * this.speed * dt;
      }
      if (this.contactCooldown > 0) this.contactCooldown -= dt;
      return;
    }

    // Splitter: flee when below 50% HP
    if (this.type === 'splitter' && this.hp < this.maxHP * 0.5) {
      if (dist > 1) {
        this.x -= (dx / dist) * this.speed * dt;
        this.y -= (dy / dist) * this.speed * dt;
      }
      if (this.shootTimer > 0) this.shootTimer -= dt;
      if (this.contactCooldown > 0) this.contactCooldown -= dt;
      return;
    }

    // Brute: charge-up when close
    if (this.type === 'brute') {
      if (this.chargeState === 'idle' && dist < 100) {
        this.chargeState = 'winding';
        this.chargeTimer = 0.3;
      }
      if (this.chargeState === 'winding') {
        this.chargeTimer -= dt;
        if (this.chargeTimer <= 0) {
          this.chargeState = 'lunging';
          this.chargeTimer = 0.2;
        }
        // Stand still during wind-up
        if (this.shootTimer > 0) this.shootTimer -= dt;
        if (this.contactCooldown > 0) this.contactCooldown -= dt;
        return;
      }
      if (this.chargeState === 'lunging') {
        this.chargeTimer -= dt;
        if (dist > 1) {
          const lungeSpeed = this.speed * 3;
          this.x += (dx / dist) * lungeSpeed * dt;
          this.y += (dy / dist) * lungeSpeed * dt;
        }
        if (this.chargeTimer <= 0) {
          this.chargeState = 'idle';
        }
        if (this.shootTimer > 0) this.shootTimer -= dt;
        if (this.contactCooldown > 0) this.contactCooldown -= dt;
        return;
      }
    }

    // Rusher: zigzag movement
    if (this.type === 'rusher') {
      this.zigzagOffset += dt * 8;
      if (dist > 1) {
        const perpX = -dy / dist;
        const perpY = dx / dist;
        const zigzag = Math.sin(this.zigzagOffset) * 0.6;
        const moveX = (dx / dist) + perpX * zigzag;
        const moveY = (dy / dist) + perpY * zigzag;
        const moveLen = Math.sqrt(moveX * moveX + moveY * moveY);
        this.x += (moveX / moveLen) * this.speed * dt;
        this.y += (moveY / moveLen) * this.speed * dt;
      }
      if (this.shootTimer > 0) this.shootTimer -= dt;
      if (this.contactCooldown > 0) this.contactCooldown -= dt;
      return;
    }

    // Default: direct chase (grunt and others)
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
    this.hitFlashTimer = 0.1;
    if (this.hp <= 0) {
      this.dead = true;
    }
    return this.dead;
  }
}

export { ENEMY_TYPES };
