const BOSS_DEFS = {
  stoneguard: {
    name: 'Stoneguard',
    color: '#7f8c8d',
    radius: 32,
    hp: 300,
    speed: 45,
    damage: 25,
    abilities: ['charge', 'stomp'],
    chargeCooldown: 5,
    chargeSpeed: 250,
    stompCooldown: 8,
    stompRadius: 100,
    stompDamage: 20,
  },
  voidlord: {
    name: 'Voidlord',
    color: '#9b59b6',
    radius: 30,
    hp: 450,
    speed: 40,
    damage: 20,
    abilities: ['teleport', 'rift'],
    teleportCooldown: 6,
    riftCooldown: 8,
    riftDamage: 15,
    riftRadius: 60,
  },
  swarmmother: {
    name: 'Swarmmother',
    color: '#d4ac0d',
    radius: 35,
    hp: 400,
    speed: 30,
    damage: 15,
    abilities: ['summon'],
    summonCooldown: 4,
    summonCount: 3,
  },
};

export class Boss {
  constructor(type, x, y, wave) {
    const def = BOSS_DEFS[type];
    this.type = type;
    this.name = def.name;
    this.color = def.color;
    this.radius = def.radius;
    this.x = x;
    this.y = y;
    this.baseSpeed = def.speed;
    this.speed = def.speed;
    this.damage = def.damage;
    this.phase = 1;

    const hpMult = Math.pow(1.1, wave - 1);
    this.maxHP = Math.round(def.hp * hpMult);
    this.hp = this.maxHP;

    this.abilities = def.abilities;
    this.def = def;

    // Ability timers
    this.chargeCooldown = def.chargeCooldown || 99;
    this.chargeTimer = this.chargeCooldown;
    this.isCharging = false;
    this.chargeVx = 0;
    this.chargeVy = 0;
    this.chargeDuration = 0;

    this.stompCooldown = def.stompCooldown || 99;
    this.stompTimer = this.stompCooldown * 0.5;
    this.stompActive = false;
    this.stompAnimTimer = 0;

    this.teleportCooldown = def.teleportCooldown || 99;
    this.teleportTimer = this.teleportCooldown * 0.5;

    this.riftCooldown = def.riftCooldown || 99;
    this.riftTimer = this.riftCooldown * 0.5;
    this.rifts = [];

    this.summonCooldown = def.summonCooldown || 99;
    this.summonTimer = this.summonCooldown;
    this.summonCount = def.summonCount || 0;

    this.contactCooldown = 0;
    this.dead = false;
    this.slowTimer = 0;
    this.slowPercent = 0;
  }

  update(dt, playerX, playerY, mapWidth, mapHeight) {
    // Phase check
    if (this.phase === 1 && this.hp <= this.maxHP * 0.5) {
      this.phase = 2;
      this.speed = this.baseSpeed * 1.3;
      // Reduce all cooldowns
      this.chargeCooldown *= 0.7;
      this.stompCooldown *= 0.7;
      this.teleportCooldown *= 0.7;
      this.riftCooldown *= 0.7;
      this.summonCooldown *= 0.7;
    }

    // Slow effect
    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
    }
    const currentSpeed = this.slowTimer > 0 ? this.speed * (1 - this.slowPercent * 0.5) : this.speed;

    // Charge movement
    if (this.isCharging) {
      this.chargeDuration -= dt;
      this.x += this.chargeVx * dt;
      this.y += this.chargeVy * dt;
      this.x = Math.max(this.radius, Math.min(mapWidth - this.radius, this.x));
      this.y = Math.max(this.radius, Math.min(mapHeight - this.radius, this.y));
      if (this.chargeDuration <= 0) this.isCharging = false;
      return null;
    }

    // Stomp animation
    if (this.stompActive) {
      this.stompAnimTimer -= dt;
      if (this.stompAnimTimer <= 0) this.stompActive = false;
      return null;
    }

    // Move toward player
    const dx = playerX - this.x;
    const dy = playerY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > this.radius) {
      this.x += (dx / dist) * currentSpeed * dt;
      this.y += (dy / dist) * currentSpeed * dt;
    }

    this.x = Math.max(this.radius, Math.min(mapWidth - this.radius, this.x));
    this.y = Math.max(this.radius, Math.min(mapHeight - this.radius, this.y));

    // Ability timers
    this.chargeTimer -= dt;
    this.stompTimer -= dt;
    this.teleportTimer -= dt;
    this.riftTimer -= dt;
    this.summonTimer -= dt;
    if (this.contactCooldown > 0) this.contactCooldown -= dt;

    // Update rifts
    for (const r of this.rifts) {
      r.timer -= dt;
    }
    this.rifts = this.rifts.filter(r => r.timer > 0);

    // Execute abilities
    let action = null;

    if (this.abilities.includes('charge') && this.chargeTimer <= 0 && dist > 80) {
      this.chargeTimer = this.chargeCooldown;
      this.isCharging = true;
      const chargeSpeed = this.def.chargeSpeed || 250;
      this.chargeVx = (dx / dist) * chargeSpeed;
      this.chargeVy = (dy / dist) * chargeSpeed;
      this.chargeDuration = 0.5;
    }

    if (this.abilities.includes('stomp') && this.stompTimer <= 0 && dist < 120) {
      this.stompTimer = this.stompCooldown;
      this.stompActive = true;
      this.stompAnimTimer = 0.3;
      action = { type: 'stomp', x: this.x, y: this.y, radius: this.def.stompRadius, damage: this.def.stompDamage };
    }

    if (this.abilities.includes('teleport') && this.teleportTimer <= 0) {
      this.teleportTimer = this.teleportCooldown;
      // Teleport near player
      const angle = Math.random() * Math.PI * 2;
      const teleDist = 100 + Math.random() * 50;
      this.x = Math.max(this.radius, Math.min(mapWidth - this.radius, playerX + Math.cos(angle) * teleDist));
      this.y = Math.max(this.radius, Math.min(mapHeight - this.radius, playerY + Math.sin(angle) * teleDist));
    }

    if (this.abilities.includes('rift') && this.riftTimer <= 0) {
      this.riftTimer = this.riftCooldown;
      this.rifts.push({
        x: playerX + (Math.random() - 0.5) * 60,
        y: playerY + (Math.random() - 0.5) * 60,
        radius: this.def.riftRadius || 60,
        damage: this.def.riftDamage || 15,
        timer: 3,
      });
    }

    if (this.abilities.includes('summon') && this.summonTimer <= 0) {
      this.summonTimer = this.summonCooldown;
      action = { type: 'summon', x: this.x, y: this.y, count: this.summonCount };
    }

    return action;
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
