export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.radius = 16;
    this.baseSpeed = 120;
    this.speed = this.baseSpeed;
    this.baseAttackCooldown = 1.0;
    this.attackCooldown = this.baseAttackCooldown;
    this.attackTimer = 0;
    this.baseDamage = 15;
    this.damage = this.baseDamage;
    this.maxHP = 100;
    this.hp = this.maxHP;
    this.aimAngle = 0;
    this.abilities = []; // { id, level }
    this.shieldHP = 0;
    this.shieldMaxHP = 0;
    this.shieldCooldown = 0;
    this.shieldTimer = 0;
    this.dashCooldown = 0;
    this.dashTimer = 0;
    this.dashDistance = 0;
    this.isDashing = false;
    this.dashVx = 0;
    this.dashVy = 0;
    this.dashRemaining = 0;
    this.invulnTimer = 0;

    // Computed stats (refreshed on ability change)
    this.extraProjectiles = 0;
    this.spreadAngle = 0;
    this.pierce = 0;
    this.bounces = 0;
    this.bounceRange = 0;
    this.explosionRadius = 0;
    this.explosionDamage = 0;
    this.chainCount = 0;
    this.chainDamage = 0;
    this.chainRange = 0;
    this.regenRate = 0;
    this.thornsDamage = 0;
    this.magnetRange = 40;
    this.lifestealPercent = 0;
    this.critChance = 0;
    this.frostAuraRadius = 0;
    this.frostSlowPercent = 0;
    this.fireTrailDamage = 0;
    this.fireTrailDuration = 0;
    this.speedMult = 1;
    this.attackSpeedMult = 1;
    this.damageBonus = 0;
    this.maxHPBonus = 0;

    this.regenAccum = 0;
    this.fireTrailTimer = 0;
  }

  getAbilityLevel(abilityId) {
    const a = this.abilities.find(ab => ab.id === abilityId);
    return a ? a.level : 0;
  }

  addAbility(abilityId, abilityData) {
    const existing = this.abilities.find(ab => ab.id === abilityId);
    if (existing) {
      existing.level = Math.min(existing.level + 1, abilityData.maxLevel);
    } else {
      this.abilities.push({ id: abilityId, level: 1 });
    }
    this.recalcStats(abilityData);
  }

  recalcAllStats(allAbilityData) {
    // Reset to base
    this.extraProjectiles = 0;
    this.spreadAngle = 0;
    this.pierce = 0;
    this.bounces = 0;
    this.bounceRange = 0;
    this.explosionRadius = 0;
    this.explosionDamage = 0;
    this.chainCount = 0;
    this.chainDamage = 0;
    this.chainRange = 0;
    this.regenRate = 0;
    this.thornsDamage = 0;
    this.magnetRange = 40;
    this.lifestealPercent = 0;
    this.critChance = 0;
    this.frostAuraRadius = 0;
    this.frostSlowPercent = 0;
    this.fireTrailDamage = 0;
    this.fireTrailDuration = 0;
    this.speedMult = 1;
    this.attackSpeedMult = 1;
    this.damageBonus = 0;
    this.maxHPBonus = 0;
    this.shieldMaxHP = 0;
    this.shieldCooldown = 0;
    this.dashDistance = 0;
    this.dashCooldown = 0;

    for (const ab of this.abilities) {
      const data = allAbilityData.find(a => a.id === ab.id);
      if (!data) continue;
      const lvlData = data.levels[ab.level - 1];
      if (!lvlData) continue;
      this._applyLevelData(lvlData);
    }

    this.maxHP = 100 + this.maxHPBonus;
    this.hp = Math.min(this.hp, this.maxHP);
    this.speed = this.baseSpeed * this.speedMult;
    this.attackCooldown = this.baseAttackCooldown * this.attackSpeedMult;
    this.damage = this.baseDamage + this.damageBonus;
  }

  recalcStats(singleAbilityData) {
    // Quick path: just recalc everything from stored abilities
    // We need all ability data though, so this is called from game
  }

  _applyLevelData(d) {
    if (d.extraProjectiles) this.extraProjectiles = d.extraProjectiles;
    if (d.spreadAngle) this.spreadAngle = d.spreadAngle;
    if (d.pierce) this.pierce = d.pierce;
    if (d.bounces) this.bounces = d.bounces;
    if (d.bounceRange) this.bounceRange = d.bounceRange;
    if (d.explosionRadius) this.explosionRadius = d.explosionRadius;
    if (d.explosionDamage) this.explosionDamage = d.explosionDamage;
    if (d.chains) this.chainCount = d.chains;
    if (d.chainDamage) this.chainDamage = d.chainDamage;
    if (d.chainRange) this.chainRange = d.chainRange;
    if (d.regenRate) this.regenRate = d.regenRate;
    if (d.thornsDamage) this.thornsDamage = d.thornsDamage;
    if (d.magnetRange) this.magnetRange = d.magnetRange;
    if (d.lifestealPercent) this.lifestealPercent = d.lifestealPercent;
    if (d.critChance) this.critChance = d.critChance;
    if (d.auraRadius) this.frostAuraRadius = d.auraRadius;
    if (d.slowPercent) this.frostSlowPercent = d.slowPercent;
    if (d.trailDamage) this.fireTrailDamage = d.trailDamage;
    if (d.trailDuration) this.fireTrailDuration = d.trailDuration;
    if (d.speedMult) this.speedMult = d.speedMult;
    if (d.attackSpeedMult) this.attackSpeedMult = d.attackSpeedMult;
    if (d.damageBonus) this.damageBonus = d.damageBonus;
    if (d.maxHPBonus) this.maxHPBonus = d.maxHPBonus;
    if (d.shieldHP) this.shieldMaxHP = d.shieldHP;
    if (d.shieldCooldown) this.shieldCooldown = d.shieldCooldown;
    if (d.dashDistance) this.dashDistance = d.dashDistance;
    if (d.dashCooldown) this.dashCooldown = d.dashCooldown;
  }

  update(dt, moveVector, mapWidth, mapHeight) {
    // Dash
    if (this.isDashing) {
      this.dashRemaining -= dt;
      if (this.dashRemaining <= 0) {
        this.isDashing = false;
      } else {
        this.x += this.dashVx * dt * 600;
        this.y += this.dashVy * dt * 600;
      }
    } else {
      this.x += moveVector.x * this.speed * dt;
      this.y += moveVector.y * this.speed * dt;
    }

    // Clamp to map
    this.x = Math.max(this.radius, Math.min(mapWidth - this.radius, this.x));
    this.y = Math.max(this.radius, Math.min(mapHeight - this.radius, this.y));

    // Attack cooldown
    if (this.attackTimer > 0) this.attackTimer -= dt;

    // Shield regen
    if (this.shieldMaxHP > 0 && this.shieldHP <= 0) {
      this.shieldTimer -= dt;
      if (this.shieldTimer <= 0) {
        this.shieldHP = this.shieldMaxHP;
        this.shieldTimer = this.shieldCooldown;
      }
    }

    // Dash cooldown
    if (this.dashTimer > 0) this.dashTimer -= dt;

    // Invuln timer
    if (this.invulnTimer > 0) this.invulnTimer -= dt;

    // Regen
    if (this.regenRate > 0) {
      this.regenAccum += this.regenRate * dt;
      if (this.regenAccum >= 1) {
        const heal = Math.floor(this.regenAccum);
        this.hp = Math.min(this.maxHP, this.hp + heal);
        this.regenAccum -= heal;
      }
    }

    // Fire trail timer
    if (this.fireTrailDamage > 0) {
      this.fireTrailTimer -= dt;
    }
  }

  tryDash(moveVector) {
    if (this.dashDistance <= 0 || this.dashTimer > 0 || this.isDashing) return false;
    if (moveVector.x === 0 && moveVector.y === 0) return false;
    this.isDashing = true;
    this.dashVx = moveVector.x;
    this.dashVy = moveVector.y;
    this.dashRemaining = 0.15;
    this.dashTimer = this.dashCooldown;
    this.invulnTimer = 0.15;
    return true;
  }

  takeDamage(amount) {
    if (this.invulnTimer > 0) return 0;
    let remaining = amount;
    if (this.shieldHP > 0) {
      const absorbed = Math.min(this.shieldHP, remaining);
      this.shieldHP -= absorbed;
      remaining -= absorbed;
      if (this.shieldHP <= 0) {
        this.shieldTimer = this.shieldCooldown;
      }
    }
    this.hp -= remaining;
    this.invulnTimer = 0.2;
    return remaining;
  }

  canAttack() {
    return this.attackTimer <= 0;
  }

  attack() {
    this.attackTimer = this.attackCooldown;
  }
}
