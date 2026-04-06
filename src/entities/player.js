export class Player {
  constructor(x, y, classConfig) {
    this.x = x;
    this.y = y;

    // Class identity
    this.playerClass = classConfig ? classConfig.id : null;
    this.classConfig = classConfig || null;

    // Base stats (overridden by class)
    const base = classConfig ? classConfig.baseStats : {};
    this.radius = base.radius || 16;
    this.baseSpeed = base.speed || 120;
    this.speed = this.baseSpeed;
    this.baseAttackCooldown = base.attackCooldown || 1.0;
    this.attackCooldown = this.baseAttackCooldown;
    this.attackTimer = 0;
    this.baseDamage = base.damage || 15;
    this.damage = this.baseDamage;
    this.maxHP = base.maxHP || 100;
    this.hp = this.maxHP;
    this.attackRange = base.attackRange || 500;
    this.projectileSpeed = base.projectileSpeed || 300;
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

    // Class visual
    this.color = classConfig ? classConfig.color : '#3498db';
    this.highlightColor = classConfig ? classConfig.highlightColor : '#5dade2';

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

    // === New shared blessing stats ===
    this.poisonDamage = 0;
    this.poisonDuration = 0;
    this.homingPower = 0;
    this.pullRadius = 0;
    this.pullForce = 0;
    this.orbCooldown = 0;
    this.orbDuration = 0;
    this.orbTimer = 0;
    this.dodgeChance = 0;
    this.novaRadius = 0;
    this.novaSlow = 0;
    this.novaDuration = 0;
    this.novaCooldown = 0;
    this.novaTimer = 0;
    this.bladeCount = 0;
    this.bladeDamage = 0;
    this.bladeRadius = 0;
    this.harvestDmgPerStack = 0;
    this.harvestMaxStacks = 0;
    this.harvestDuration = 0;
    this.harvestStacks = 0;
    this.harvestTimer = 0;
    this.flatDamageReduction = 0;
    this.deathExplosionRadius = 0;
    this.deathExplosionDamage = 0;
    this.phaseTime = 0;
    this.overchargeEvery = 0;
    this.overchargeDamageMult = 1;
    this.overchargeSizeMult = 1;
    this.overchargeCounter = 0;
    this.xpMultiplier = 1;
    this.fieldDuration = 0;
    this.fieldCooldown = 0;
    this.fieldSlowPercent = 0;
    this.fieldTimer = 0;
    this.fieldActive = false;

    // Active synergies
    this.activeSynergies = [];

    // === Warrior stats ===
    this.sweepAngle = classConfig && classConfig.meleeArc ? classConfig.meleeArc : 90;
    this.sweepDamageBonus = 0;
    this.meleeRangeBonus = 0;
    this.knockbackBonus = 0;
    this.berserkThreshold = 0;
    this.berserkDamageMult = 1;
    this.berserkSpeedMult = 1;
    this.damageReduction = 0;
    this.slamRadius = 0;
    this.slamDamage = 0;
    this.slamStunDuration = 0;
    this.killSpeedBuff = 1;
    this.killBuffDuration = 0;
    this.killBuffTimer = 0;

    // === Mage stats ===
    this.meteorCooldown = 0;
    this.meteorTimer = 0;
    this.meteorRadius = 0;
    this.meteorDamage = 0;
    this.echoChance = 0;
    this.echoDelay = 0;
    this.echoDamageMult = 0.7;
    this.echoQueued = false;
    this.echoTimer = 0;
    this.manaShieldAbsorb = 0;
    this.manaShieldCooldownPenalty = 0;
    this.elementCycle = null;
    this.elementIndex = 0;
    this.aoeRadiusMult = 1;
    this.aoeDamageMult = 1;
    this.siphonCooldownReduction = 0;
    this.siphonAttackSpeedBurst = 0;

    // Mage decoy
    this.decoy = null; // { x, y, timer, radius }

    // === Archer stats ===
    this.markMaxStacks = 0;
    this.markDamagePerStack = 0;
    this.markDuration = 0;
    this.rainCooldown = 0;
    this.rainTimer = 0;
    this.rainRadius = 0;
    this.rainArrows = 0;
    this.rainDamage = 0;
    this.quickdrawShots = 0;
    this.quickdrawDamageBonus = 0;
    this.quickdrawCounter = 0;
    this.windWalkMaxBonus = 0;
    this.windWalkRangeBonus = 0;
    this.windWalkBuildTime = 0;
    this.windWalkTimer = 0;
    this.splitCount = 0;
    this.splitDamagePct = 0;

    // === Necromancer stats ===
    this.maxMinions = classConfig ? (classConfig.maxMinions || 0) : 0;
    this.maxMinionBonus = 0;
    this.minionDamageBonus = 0;
    this.minionHPBonus = 0;
    this.minionDurationBonus = 0;
    this.minionExplosionRadius = 0;
    this.minionExplosionDamage = 0;
    this.soulLinkPercent = 0;
    this.corpseSpeedBuff = 1;
    this.corpseBuffDuration = 0;
    this.corpseSpawnChance = 0;
    this.corpseHeal = 0;
    this.corpseSpeedTimer = 0;
    this.pactDamageMult = 0;
    this.pactCooldown = 0;
    this.pactTimer = 0;
    this.pactReady = false;
    this.minionSlowPercent = 0;
    this.minionSlowDuration = 0;
    this.minionPullRange = 0;
    this.minionPullStrength = 0;
    this.hitCounter = 0; // for summon-on-Nth-hit
    this.soulHarvestActive = false;
    this.soulHarvestTimer = 0;
    this.soulHarvestX = 0;
    this.soulHarvestY = 0;

    // Unique ability cooldown (used by all classes for their unique)
    this.uniqueAbilityCooldown = classConfig && classConfig.uniqueAbility ? classConfig.uniqueAbility.cooldown : 0;
    this.uniqueAbilityTimer = 0;

    // XP / leveling
    this.xp = 0;
    this.level = 1;
    this.xpToNext = 50;
  }

  addXP(amount) {
    this.xp += amount * this.xpMultiplier;
    let leveled = false;
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level++;
      this.xpToNext = Math.round(50 * Math.pow(1.3, this.level - 1));
      this.hp = Math.min(this.maxHP, this.hp + this.maxHP * 0.2);
      leveled = true;
    }
    return leveled;
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
    // Reset computed stats to base
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

    // Reset new shared blessing stats
    this.poisonDamage = 0;
    this.poisonDuration = 0;
    this.homingPower = 0;
    this.pullRadius = 0;
    this.pullForce = 0;
    this.orbCooldown = 0;
    this.orbDuration = 0;
    this.dodgeChance = 0;
    this.novaRadius = 0;
    this.novaSlow = 0;
    this.novaDuration = 0;
    this.novaCooldown = 0;
    this.bladeCount = 0;
    this.bladeDamage = 0;
    this.bladeRadius = 0;
    this.harvestDmgPerStack = 0;
    this.harvestMaxStacks = 0;
    this.harvestDuration = 0;
    this.flatDamageReduction = 0;
    this.deathExplosionRadius = 0;
    this.deathExplosionDamage = 0;
    this.phaseTime = 0;
    this.overchargeEvery = 0;
    this.overchargeDamageMult = 1;
    this.overchargeSizeMult = 1;
    this.xpMultiplier = 1;
    this.fieldDuration = 0;
    this.fieldCooldown = 0;
    this.fieldSlowPercent = 0;

    // Reset class-specific computed stats
    this.sweepAngle = this.classConfig && this.classConfig.meleeArc ? this.classConfig.meleeArc : 90;
    this.sweepDamageBonus = 0;
    this.meleeRangeBonus = 0;
    this.knockbackBonus = 0;
    this.berserkThreshold = 0;
    this.berserkDamageMult = 1;
    this.berserkSpeedMult = 1;
    this.damageReduction = 0;
    this.slamRadius = 0;
    this.slamDamage = 0;
    this.slamStunDuration = 0;
    this.killSpeedBuff = 1;
    this.killBuffDuration = 0;

    this.meteorCooldown = 0;
    this.meteorRadius = 0;
    this.meteorDamage = 0;
    this.echoChance = 0;
    this.echoDelay = 0;
    this.echoDamageMult = 0.7;
    this.manaShieldAbsorb = 0;
    this.manaShieldCooldownPenalty = 0;
    this.elementCycle = null;
    this.elementIndex = 0;
    this.aoeRadiusMult = 1;
    this.aoeDamageMult = 1;
    this.siphonCooldownReduction = 0;
    this.siphonAttackSpeedBurst = 0;

    this.markMaxStacks = 0;
    this.markDamagePerStack = 0;
    this.markDuration = 0;
    this.rainCooldown = 0;
    this.rainRadius = 0;
    this.rainArrows = 0;
    this.rainDamage = 0;
    this.quickdrawShots = 0;
    this.quickdrawDamageBonus = 0;
    this.windWalkMaxBonus = 0;
    this.windWalkRangeBonus = 0;
    this.windWalkBuildTime = 0;
    this.splitCount = 0;
    this.splitDamagePct = 0;

    this.maxMinionBonus = 0;
    this.minionDamageBonus = 0;
    this.minionHPBonus = 0;
    this.minionDurationBonus = 0;
    this.minionExplosionRadius = 0;
    this.minionExplosionDamage = 0;
    this.soulLinkPercent = 0;
    this.corpseSpeedBuff = 1;
    this.corpseBuffDuration = 0;
    this.corpseSpawnChance = 0;
    this.corpseHeal = 0;
    this.pactDamageMult = 0;
    this.pactCooldown = 0;
    this.minionSlowPercent = 0;
    this.minionSlowDuration = 0;
    this.minionPullRange = 0;
    this.minionPullStrength = 0;

    for (const ab of this.abilities) {
      const data = allAbilityData.find(a => a.id === ab.id);
      if (!data) continue;
      const lvlData = data.levels[ab.level - 1];
      if (!lvlData) continue;
      this._applyLevelData(lvlData);
    }

    const baseMaxHP = this.classConfig ? this.classConfig.baseStats.maxHP : 100;
    this.maxHP = baseMaxHP + this.maxHPBonus;
    this.hp = Math.min(this.hp, this.maxHP);
    this.speed = this.baseSpeed * this.speedMult;
    this.attackCooldown = this.baseAttackCooldown * this.attackSpeedMult;
    this.damage = this.baseDamage + this.damageBonus;

    // Necromancer max minions
    if (this.classConfig) {
      this.maxMinions = (this.classConfig.maxMinions || 0) + this.maxMinionBonus;
    }
  }

  recalcStats(singleAbilityData) {
    // Quick path: just recalc everything from stored abilities
    // We need all ability data though, so this is called from game
  }

  _applyLevelData(d) {
    // Shared stats
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

    // New shared blessings
    if (d.poisonDamage) this.poisonDamage = d.poisonDamage;
    if (d.poisonDuration) this.poisonDuration = d.poisonDuration;
    if (d.homingPower) this.homingPower = d.homingPower;
    if (d.pullRadius) this.pullRadius = d.pullRadius;
    if (d.pullForce) this.pullForce = d.pullForce;
    if (d.orbCooldown) this.orbCooldown = d.orbCooldown;
    if (d.orbDuration) this.orbDuration = d.orbDuration;
    if (d.dodgeChance) this.dodgeChance = d.dodgeChance;
    if (d.novaRadius) this.novaRadius = d.novaRadius;
    if (d.novaSlow) this.novaSlow = d.novaSlow;
    if (d.novaDuration) this.novaDuration = d.novaDuration;
    if (d.novaCooldown) this.novaCooldown = d.novaCooldown;
    if (d.bladeCount) this.bladeCount = d.bladeCount;
    if (d.bladeDamage) this.bladeDamage = d.bladeDamage;
    if (d.bladeRadius) this.bladeRadius = d.bladeRadius;
    if (d.harvestDmgPerStack) this.harvestDmgPerStack = d.harvestDmgPerStack;
    if (d.harvestMaxStacks) this.harvestMaxStacks = d.harvestMaxStacks;
    if (d.harvestDuration) this.harvestDuration = d.harvestDuration;
    if (d.flatDamageReduction) this.flatDamageReduction = d.flatDamageReduction;
    if (d.deathExplosionRadius) this.deathExplosionRadius = d.deathExplosionRadius;
    if (d.deathExplosionDamage) this.deathExplosionDamage = d.deathExplosionDamage;
    if (d.phaseTime) this.phaseTime = d.phaseTime;
    if (d.overchargeEvery) this.overchargeEvery = d.overchargeEvery;
    if (d.overchargeDamageMult) this.overchargeDamageMult = d.overchargeDamageMult;
    if (d.overchargeSizeMult) this.overchargeSizeMult = d.overchargeSizeMult;
    if (d.xpMultiplier) this.xpMultiplier = d.xpMultiplier;
    if (d.fieldDuration) this.fieldDuration = d.fieldDuration;
    if (d.fieldCooldown) this.fieldCooldown = d.fieldCooldown;
    if (d.fieldSlowPercent) this.fieldSlowPercent = d.fieldSlowPercent;

    // Warrior
    if (d.sweepAngle) this.sweepAngle = d.sweepAngle;
    if (d.sweepDamageBonus) this.sweepDamageBonus = d.sweepDamageBonus;
    if (d.meleeRangeBonus) this.meleeRangeBonus = d.meleeRangeBonus;
    if (d.knockbackBonus) this.knockbackBonus = d.knockbackBonus;
    if (d.berserkThreshold) this.berserkThreshold = d.berserkThreshold;
    if (d.berserkDamageMult) this.berserkDamageMult = d.berserkDamageMult;
    if (d.berserkSpeedMult) this.berserkSpeedMult = d.berserkSpeedMult;
    if (d.damageReduction) this.damageReduction = d.damageReduction;
    if (d.slamRadius) this.slamRadius = d.slamRadius;
    if (d.slamDamage) this.slamDamage = d.slamDamage;
    if (d.slamStunDuration) this.slamStunDuration = d.slamStunDuration;
    if (d.killSpeedBuff) this.killSpeedBuff = d.killSpeedBuff;
    if (d.killBuffDuration) this.killBuffDuration = d.killBuffDuration;

    // Mage
    if (d.meteorCooldown) this.meteorCooldown = d.meteorCooldown;
    if (d.meteorRadius) this.meteorRadius = d.meteorRadius;
    if (d.meteorDamage) this.meteorDamage = d.meteorDamage;
    if (d.echoChance) this.echoChance = d.echoChance;
    if (d.echoDelay) this.echoDelay = d.echoDelay;
    if (d.echoDamageMult) this.echoDamageMult = d.echoDamageMult;
    if (d.manaShieldAbsorb) this.manaShieldAbsorb = d.manaShieldAbsorb;
    if (d.manaShieldCooldownPenalty !== undefined) this.manaShieldCooldownPenalty = d.manaShieldCooldownPenalty;
    if (d.elementCycle) this.elementCycle = d.elementCycle;
    if (d.aoeRadiusMult) this.aoeRadiusMult = d.aoeRadiusMult;
    if (d.aoeDamageMult) this.aoeDamageMult = d.aoeDamageMult;
    if (d.siphonCooldownReduction) this.siphonCooldownReduction = d.siphonCooldownReduction;
    if (d.siphonAttackSpeedBurst) this.siphonAttackSpeedBurst = d.siphonAttackSpeedBurst;

    // Archer
    if (d.markMaxStacks) this.markMaxStacks = d.markMaxStacks;
    if (d.markDamagePerStack) this.markDamagePerStack = d.markDamagePerStack;
    if (d.markDuration) this.markDuration = d.markDuration;
    if (d.rainCooldown) this.rainCooldown = d.rainCooldown;
    if (d.rainRadius) this.rainRadius = d.rainRadius;
    if (d.rainArrows) this.rainArrows = d.rainArrows;
    if (d.rainDamage) this.rainDamage = d.rainDamage;
    if (d.quickdrawShots) this.quickdrawShots = d.quickdrawShots;
    if (d.quickdrawDamageBonus) this.quickdrawDamageBonus = d.quickdrawDamageBonus;
    if (d.windWalkMaxBonus) this.windWalkMaxBonus = d.windWalkMaxBonus;
    if (d.windWalkRangeBonus) this.windWalkRangeBonus = d.windWalkRangeBonus;
    if (d.windWalkBuildTime) this.windWalkBuildTime = d.windWalkBuildTime;
    if (d.splitCount) this.splitCount = d.splitCount;
    if (d.splitDamagePct) this.splitDamagePct = d.splitDamagePct;

    // Necromancer
    if (d.maxMinionBonus) this.maxMinionBonus = d.maxMinionBonus;
    if (d.minionDamageBonus) this.minionDamageBonus = d.minionDamageBonus;
    if (d.minionHPBonus) this.minionHPBonus = d.minionHPBonus;
    if (d.minionDurationBonus) this.minionDurationBonus = d.minionDurationBonus;
    if (d.minionExplosionRadius) this.minionExplosionRadius = d.minionExplosionRadius;
    if (d.minionExplosionDamage) this.minionExplosionDamage = d.minionExplosionDamage;
    if (d.soulLinkPercent) this.soulLinkPercent = d.soulLinkPercent;
    if (d.corpseSpeedBuff) this.corpseSpeedBuff = d.corpseSpeedBuff;
    if (d.corpseBuffDuration) this.corpseBuffDuration = d.corpseBuffDuration;
    if (d.corpseSpawnChance) this.corpseSpawnChance = d.corpseSpawnChance;
    if (d.corpseHeal) this.corpseHeal = d.corpseHeal;
    if (d.pactDamageMult) this.pactDamageMult = d.pactDamageMult;
    if (d.pactCooldown) this.pactCooldown = d.pactCooldown;
    if (d.minionSlowPercent) this.minionSlowPercent = d.minionSlowPercent;
    if (d.minionSlowDuration) this.minionSlowDuration = d.minionSlowDuration;
    if (d.minionPullRange) this.minionPullRange = d.minionPullRange;
    if (d.minionPullStrength) this.minionPullStrength = d.minionPullStrength;
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
      let currentSpeed = this.speed;

      // Warrior berserker speed bonus
      if (this.berserkSpeedMult > 1 && this.berserkThreshold > 0 && this.hp / this.maxHP < this.berserkThreshold) {
        currentSpeed *= this.berserkSpeedMult;
      }

      // Necromancer corpse walk speed
      if (this.corpseSpeedTimer > 0) {
        currentSpeed *= this.corpseSpeedBuff;
        this.corpseSpeedTimer -= dt;
      }

      // Archer wind walk
      if (this.windWalkBuildTime > 0) {
        if (moveVector.x !== 0 || moveVector.y !== 0) {
          this.windWalkTimer = Math.min(this.windWalkTimer + dt, this.windWalkBuildTime);
        } else {
          this.windWalkTimer = 0;
        }
        const windPct = this.windWalkTimer / this.windWalkBuildTime;
        currentSpeed *= (1 + this.windWalkMaxBonus * windPct);
      }

      this.x += moveVector.x * currentSpeed * dt;
      this.y += moveVector.y * currentSpeed * dt;
    }

    // Clamp to map
    this.x = Math.max(this.radius, Math.min(mapWidth - this.radius, this.x));
    this.y = Math.max(this.radius, Math.min(mapHeight - this.radius, this.y));

    // Attack cooldown
    if (this.attackTimer > 0) {
      let cdSpeed = 1;
      // Blood rage kill speed buff
      if (this.killBuffTimer > 0) {
        cdSpeed = 1 / this.killSpeedBuff; // killSpeedBuff < 1 means faster
        this.killBuffTimer -= dt;
      }
      // Quickdraw instant shots
      if (this.quickdrawCounter > 0) {
        this.attackTimer = 0;
      } else {
        this.attackTimer -= dt * cdSpeed;
      }
    }

    // Shield regen
    if (this.shieldMaxHP > 0 && this.shieldHP <= 0) {
      this.shieldTimer -= dt;
      if (this.shieldTimer <= 0) {
        this.shieldHP = this.shieldMaxHP;
        this.shieldTimer = this.shieldCooldown;
      }
    }

    // Dash / unique ability cooldown
    if (this.dashTimer > 0) this.dashTimer -= dt;
    if (this.uniqueAbilityTimer > 0) this.uniqueAbilityTimer -= dt;

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

    // Mage meteor timer
    if (this.meteorCooldown > 0) {
      this.meteorTimer -= dt;
    }

    // Mage echo timer
    if (this.echoQueued) {
      this.echoTimer -= dt;
    }

    // Mage decoy timer
    if (this.decoy) {
      this.decoy.timer -= dt;
      if (this.decoy.timer <= 0) this.decoy = null;
    }

    // Archer rain of arrows timer
    if (this.rainCooldown > 0) {
      this.rainTimer -= dt;
    }

    // Necromancer dark pact timer
    if (this.pactCooldown > 0) {
      this.pactTimer -= dt;
    }

    // Necromancer soul harvest
    if (this.soulHarvestActive) {
      this.soulHarvestTimer -= dt;
      if (this.soulHarvestTimer <= 0) {
        this.soulHarvestActive = false;
      }
    }

    // Graviton orb timer
    if (this.orbCooldown > 0) {
      this.orbTimer -= dt;
    }

    // Frost nova cooldown
    if (this.novaTimer > 0) {
      this.novaTimer -= dt;
    }

    // Soul harvest passive stacks decay
    if (this.harvestTimer > 0) {
      this.harvestTimer -= dt;
      if (this.harvestTimer <= 0) {
        this.harvestStacks = 0;
      }
    }

    // Temporal field timer
    if (this.fieldCooldown > 0) {
      this.fieldTimer -= dt;
      if (this.fieldActive) {
        if (this.fieldTimer <= 0) {
          this.fieldActive = false;
          this.fieldTimer = this.fieldCooldown;
        }
      } else if (this.fieldTimer <= 0) {
        this.fieldActive = true;
        this.fieldTimer = this.fieldDuration;
      }
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

  tryUniqueAbility(moveVector) {
    if (this.uniqueAbilityTimer > 0) return false;
    if (!this.classConfig) return false;
    if (moveVector.x === 0 && moveVector.y === 0) return false;

    this.uniqueAbilityTimer = this.uniqueAbilityCooldown;
    return true; // game.js handles the specific ability logic
  }

  takeDamage(amount) {
    if (this.invulnTimer > 0) return 0;

    // Dodge chance
    if (this.dodgeChance > 0 && Math.random() < this.dodgeChance) {
      this._lastDodged = true;
      return 0; // Dodged!
    }
    this._lastDodged = false;

    let remaining = amount;

    // Iron skin: flat damage reduction (shared blessing)
    if (this.flatDamageReduction > 0) {
      remaining = Math.max(1, remaining - this.flatDamageReduction);
    }

    // Warrior: class damage reduction (armor plates)
    if (this.damageReduction > 0) {
      remaining = Math.max(1, remaining - this.damageReduction);
    }

    // Mage: mana shield absorb
    if (this.manaShieldAbsorb > 0) {
      const absorbed = remaining * this.manaShieldAbsorb;
      remaining -= absorbed;
      this.attackTimer += this.manaShieldCooldownPenalty;
    }

    // Shield absorb
    if (this.shieldHP > 0) {
      const absorbed = Math.min(this.shieldHP, remaining);
      this.shieldHP -= absorbed;
      remaining -= absorbed;
      if (this.shieldHP <= 0) {
        this.shieldTimer = this.shieldCooldown;
      }
    }

    // Necromancer: soul link redirect to minions (handled in game.js since it needs minion array)
    // The soulLinkPercent is checked in game.js before calling this

    this.hp -= remaining;
    this.invulnTimer = 0.2;
    return remaining;
  }

  canAttack() {
    return this.attackTimer <= 0;
  }

  attack() {
    this.attackTimer = this.attackCooldown;
    if (this.quickdrawCounter > 0) {
      this.quickdrawCounter--;
    }
  }

  getMeleeRange() {
    const base = this.classConfig ? this.classConfig.baseStats.attackRange : 80;
    return base + this.meleeRangeBonus;
  }

  getMeleeKnockback() {
    const base = this.classConfig ? this.classConfig.meleeKnockback : 15;
    return base + this.knockbackBonus;
  }

  getEffectiveDamage() {
    let dmg = this.damage + this.sweepDamageBonus;
    // Berserker rage
    if (this.berserkThreshold > 0 && this.hp / this.maxHP < this.berserkThreshold) {
      dmg *= this.berserkDamageMult;
    }
    // Dark pact
    if (this.pactReady) {
      dmg *= this.pactDamageMult;
      this.pactReady = false;
    }
    return Math.round(dmg);
  }

  getAttackRange() {
    let range = this.attackRange;
    // Archer wind walk range bonus
    if (this.windWalkBuildTime > 0 && this.windWalkTimer > 0) {
      const pct = this.windWalkTimer / this.windWalkBuildTime;
      range += this.windWalkRangeBonus * pct;
    }
    return range;
  }
}
