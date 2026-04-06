export class Minion {
  constructor(x, y, config) {
    this.x = x;
    this.y = y;
    this.radius = 10;
    this.maxHP = config.hp || 30;
    this.hp = this.maxHP;
    this.damage = config.damage || 5;
    this.speed = config.speed || 80;
    this.duration = config.duration || 8;
    this.timer = this.duration;
    this.dead = false;
    this.color = '#2e86c1';
    this.targetEnemy = null;
    this.contactCooldown = 0;
    this.hitFlashTimer = 0;

    // Inherited from player's necromancer blessings
    this.slowPercent = config.slowPercent || 0;
    this.slowDuration = config.slowDuration || 0;
    this.pullRange = config.pullRange || 0;
    this.pullStrength = config.pullStrength || 0;

    // Spawn animation
    this.scale = 0;
    this.spawnTimer = 0.3;
  }

  update(dt, enemies, boss, mapWidth, mapHeight) {
    // Spawn animation
    if (this.spawnTimer > 0) {
      this.spawnTimer -= dt;
      this.scale = Math.min(1, 1 - this.spawnTimer / 0.3);
      return null;
    }
    this.scale = 1;

    // Lifetime
    this.timer -= dt;
    if (this.timer <= 0) {
      this.dead = true;
      return null;
    }

    // Contact cooldown
    if (this.contactCooldown > 0) this.contactCooldown -= dt;
    if (this.hitFlashTimer > 0) this.hitFlashTimer -= dt;

    // Find nearest enemy target
    let nearest = null;
    let nearestDist = Infinity;
    const allTargets = enemies.filter(e => !e.dead);
    if (boss && !boss.dead) allTargets.push(boss);

    for (const e of allTargets) {
      const dx = e.x - this.x;
      const dy = e.y - this.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = e;
      }
    }

    this.targetEnemy = nearest;

    // Pull distant enemies toward minion
    if (this.pullRange > 0 && this.pullStrength > 0) {
      for (const e of allTargets) {
        const dx = e.x - this.x;
        const dy = e.y - this.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < this.pullRange && d > this.radius + e.radius) {
          const pullForce = this.pullStrength * dt;
          e.x -= (dx / d) * pullForce;
          e.y -= (dy / d) * pullForce;
        }
      }
    }

    // Move toward target
    if (nearest) {
      const dx = nearest.x - this.x;
      const dy = nearest.y - this.y;
      const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      this.x += (dx / dist) * this.speed * dt;
      this.y += (dy / dist) * this.speed * dt;
    }

    // Clamp to map
    this.x = Math.max(this.radius, Math.min(mapWidth - this.radius, this.x));
    this.y = Math.max(this.radius, Math.min(mapHeight - this.radius, this.y));

    // Contact damage to enemies
    let hitResult = null;
    if (nearest && this.contactCooldown <= 0) {
      const dx = nearest.x - this.x;
      const dy = nearest.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < this.radius + nearest.radius) {
        const killed = nearest.takeDamage(this.damage);
        this.contactCooldown = 0.5;

        // Apply slow
        if (this.slowPercent > 0 && nearest.applySlow) {
          nearest.applySlow(this.slowPercent, this.slowDuration);
        }

        hitResult = { enemy: nearest, damage: this.damage, killed };
      }
    }

    return hitResult;
  }

  takeDamage(amount) {
    this.hp -= amount;
    this.hitFlashTimer = 0.1;
    if (this.hp <= 0) {
      this.dead = true;
      return true;
    }
    return false;
  }
}
