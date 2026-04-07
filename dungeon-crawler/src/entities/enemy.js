const ENEMY_TYPES = {
  grunt: {
    color: '#e74c3c',
    radius: 12,
    baseHP: 30,
    baseSpeed: 70,
    damage: 5,
    xp: 10,
  },
  rusher: {
    color: '#e67e22',
    radius: 10,
    baseHP: 20,
    baseSpeed: 120,
    damage: 4,
    xp: 12,
  },
  brute: {
    color: '#8e44ad',
    radius: 18,
    baseHP: 80,
    baseSpeed: 45,
    damage: 12,
    xp: 18,
  },
  ranged: {
    color: '#27ae60',
    radius: 11,
    baseHP: 25,
    baseSpeed: 60,
    damage: 6,
    xp: 14,
    attackRange: 200,
    shootCooldown: 2.0,
    projectileSpeed: 180,
  },
  splitter: {
    color: '#f39c12',
    radius: 14,
    baseHP: 35,
    baseSpeed: 65,
    damage: 5,
    xp: 15,
    splitsInto: 'grunt',
    splitCount: 2,
  },
  necromancer_enemy: {
    color: '#6c3483',
    radius: 13,
    baseHP: 40,
    baseSpeed: 55,
    damage: 7,
    xp: 16,
    attackRange: 180,
    shootCooldown: 2.5,
    projectileSpeed: 160,
    resurrects: true,
  },
  burrower: {
    color: '#784212',
    radius: 12,
    baseHP: 35,
    baseSpeed: 75,
    damage: 8,
    xp: 16,
    burrowCycle: 3.0,
  },
  shielder: {
    color: '#5d6d7e',
    radius: 16,
    baseHP: 50,
    baseSpeed: 50,
    damage: 6,
    xp: 18,
    shieldAngle: true,
  },
  bomber: {
    color: '#c0392b',
    radius: 10,
    baseHP: 15,
    baseSpeed: 80,
    damage: 3,
    xp: 12,
    explodeOnDeath: true,
    explosionRadius: 50,
    explosionDamage: 25,
  },
};

export class Enemy {
  constructor(type, x, y, level) {
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

    // Level scaling (DESIGN_BRIEF 7.4)
    this.level = level || 1;
    const lvl = this.level;
    this.maxHP = Math.round(def.baseHP * (1 + 0.12 * (lvl - 1)));
    this.hp = this.maxHP;
    this.damage = Math.round(this.damage * (1 + 0.10 * (lvl - 1)));
    this.speed = this.speed * (1 + 0.01 * (lvl - 1));
    // XP scales with level
    this.xp = Math.round(this.xp * lvl);

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

    // Burrower state
    this.burrowCycle = def.burrowCycle || 0;
    this.burrowTimer = this.burrowCycle * (0.5 + Math.random() * 0.5);
    this.isBurrowed = false;
    this.burrowSurfaceTimer = 0;

    // Shielder: directional shield
    this.hasShieldAngle = def.shieldAngle || false;
    this.shieldFacing = 0; // angle facing player

    // Bomber
    this.explodeOnDeath = def.explodeOnDeath || false;
    this.explosionRadius = def.explosionRadius || 0;
    this.explosionDamage = def.explosionDamage || 0;
    if (this.explosionDamage) {
      this.explosionDamage = Math.round(this.explosionDamage * (1 + 0.10 * (lvl - 1)));
    }

    // Necromancer enemy resurrects
    this.resurrects = def.resurrects || false;

    // Stun (from warrior slam etc)
    this._stunTimer = 0;

    // === v3 spec-tree status effects ===
    // Map of status type → state object. Each entry shape:
    //   { dps, duration, source, dotAccum }
    // Statuses are applied via applyStatus(), ticked via tickStatuses(),
    // queried via hasStatus(), and cleared on expiry or death.
    //
    // Frozen is special: while present, the enemy can't move OR attack.
    // The dispatch in update() reads hasStatus('frozen') and returns early.
    this.statuses = {};

    // Spawn animation
    this.spawnTimer = 0.3;
  }

  // === Status helpers ===

  /**
   * Apply or refresh a status. Same-source application refreshes; different
   * sources are tracked as a single entry but the dps/duration are taken
   * from whichever was most recently applied (simple model — no stacking).
   *
   * @param {string} type     'burning' | 'bleeding' | 'plagued' | 'frozen'
   * @param {object} payload  { dps, duration, source }
   */
  applyStatus(type, payload) {
    if (!type || !payload) return;
    this.statuses[type] = {
      dps: payload.dps || 0,
      duration: payload.duration || 0,
      source: payload.source || 'unknown',
      dotAccum: 0,
      // Optional gameplay metadata that triggers may read (e.g. spread chance)
      spreadChancePerTick: payload.spreadChancePerTick || 0,
      slowPct: payload.slowPct || 0,
    };
  }

  hasStatus(type) {
    const s = this.statuses[type];
    return !!(s && s.duration > 0);
  }

  getStatus(type) {
    return this.statuses[type] || null;
  }

  clearStatus(type) {
    delete this.statuses[type];
  }

  /**
   * Tick every active status. Returns an array of damage tick events:
   *   [{ status, damage }] — caller (game.js) applies damage via takeDamage
   *   so death + onKill triggers fire correctly.
   *
   * Frozen does NOT produce damage events but its duration ticks down.
   * Slowed (legacy) is handled separately in update() — not in this map.
   */
  tickStatuses(dt) {
    const damageTicks = [];
    for (const type of Object.keys(this.statuses)) {
      const s = this.statuses[type];
      if (!s || s.duration <= 0) {
        delete this.statuses[type];
        continue;
      }
      s.duration -= dt;
      // DoT statuses accumulate fractional damage and emit a tick when ≥1
      if (s.dps > 0) {
        s.dotAccum += s.dps * dt;
        if (s.dotAccum >= 1) {
          const dmg = Math.floor(s.dotAccum);
          s.dotAccum -= dmg;
          damageTicks.push({ status: type, damage: dmg });
        }
      }
      if (s.duration <= 0) {
        delete this.statuses[type];
      }
    }
    return damageTicks;
  }

  get scale() {
    return Math.min(1, 1 - this.spawnTimer / 0.3);
  }

  update(dt, playerX, playerY) {
    if (this.spawnTimer > 0) this.spawnTimer -= dt;
    if (this.hitFlashTimer > 0) this.hitFlashTimer -= dt;
    if (this._stunTimer > 0) { this._stunTimer -= dt; return; }
    // v3 frozen status: complete movement + attack lockout while active.
    // Status ticking is owned by game.js update loop (so DoT damage flows
    // through takeDamage), but the lockout has to be checked here.
    if (this.hasStatus('frozen')) return;
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

    // Burrower: cycle between burrowed (invulnerable) and surfaced
    if (this.burrowCycle > 0) {
      this.burrowTimer -= dt;
      if (this.isBurrowed) {
        // Move toward player while underground (faster)
        if (dist > 1) {
          this.x += (dx / dist) * this.speed * 1.5 * dt;
          this.y += (dy / dist) * this.speed * 1.5 * dt;
        }
        if (this.burrowTimer <= 0) {
          this.isBurrowed = false;
          this.burrowTimer = this.burrowCycle;
        }
        if (this.contactCooldown > 0) this.contactCooldown -= dt;
        return;
      } else if (this.burrowTimer <= 0) {
        this.isBurrowed = true;
        this.burrowTimer = 1.5; // underground for 1.5s
        return;
      }
    }

    // Shielder: face player with shield, absorbs frontal projectiles
    if (this.hasShieldAngle) {
      this.shieldFacing = Math.atan2(dy, dx); // face toward player
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
    if (this.hasStatus('frozen')) return false;
    return this.attackRange > 0 && this.shootTimer <= 0;
  }

  shoot() {
    this.shootTimer = this.shootCooldown;
  }

  applySlow(percent, duration) {
    this.slowPercent = Math.max(this.slowPercent, percent);
    this.slowTimer = Math.max(this.slowTimer, duration);
  }

  takeDamage(amount, fromAngle) {
    // Burrower is invulnerable while underground
    if (this.isBurrowed) return false;

    // Shielder: block frontal damage (within ~90 degrees of facing)
    if (this.hasShieldAngle && fromAngle !== undefined) {
      let angleDiff = fromAngle - this.shieldFacing;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      if (Math.abs(angleDiff) < Math.PI / 4) {
        // Blocked by shield - take reduced damage
        amount = Math.round(amount * 0.2);
      }
    }

    this.hp -= amount;
    this.hitFlashTimer = 0.1;
    if (this.hp <= 0) {
      this.dead = true;
    }
    return this.dead;
  }
}

export { ENEMY_TYPES };
