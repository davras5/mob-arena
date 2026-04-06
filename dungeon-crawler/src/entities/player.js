export class Player {
  constructor(x, y, classConfig) {
    this.x = x;
    this.y = y;

    // Class identity
    this.playerClass = classConfig ? classConfig.id : null;
    this.classConfig = classConfig || null;

    // Attributes (ARPG system)
    this.attributes = { str: 0, int: 0, agi: 0, sta: 0 };
    this.baseAttributes = classConfig.baseAttributes || { str: 1, int: 1, agi: 1, sta: 1 };
    this.attributePointsAvailable = 0;
    this.primaryAttribute = classConfig.primaryAttribute || 'str';

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

    // Resource system (mana/rage/stamina)
    this.resourceType = null;
    this.resourceName = '';
    this.resource = 0;
    this.maxResource = 100;
    this.baseResourceRegen = 0;
    this.resourceRegen = 0;
    this.resourceDecay = 0;
    this.resourceDecayDelay = 0;
    this.resourceDecayTimer = 0;
    this.resourceRegenPause = 0;
    this.resourceRegenPauseTimer = 0;
    this.resourceOnHitDeal = 0;
    this.resourceOnHitTake = 0;
    this.resourceOnKill = 0;
    this.resourceOnMinionKill = 0;
    this.resourceColor = '#3498db';
    this.resourceBarGradient = ['#3498db', '#3498db'];

    // Weapon damage (from equipment)
    this.weaponDamageMin = base.damage || 15;
    this.weaponDamageMax = base.damage || 15;

    // Armor (from equipment)
    this.totalArmor = 0;
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

    // Equipment slots (ARPG system)
    this.equipment = {
      mainHand: null,
      offHand: null,
      chest: null,
      legs: null,
      belt: null,
      boots: null
    };

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
    this.critDamageMultiplier = 1.5; // Base 1.5x crit damage
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

    // Skill system (ARPG)
    this.learnedSkills = {};    // { skillId: level }
    this.passiveSkills = {};    // { passiveId: rank }
    this.passivePointsAvailable = 0;
    this.activeSkills = classConfig.defaultSkills || { leftClick: null, rightClick: null };
    this.summonToggles = {};    // Necro: { summon_skeleton: true/false }
    this.skillCooldowns = {};   // { skillId: remainingCooldown }
    this.gold = 0;
    this.potions = 0;
    this.maxPotions = 3;
    this.potionHeal = 40;
  }

  addXP(amount) {
    this.xp += amount * this.xpMultiplier;
    let leveled = false;
    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.level++;
      this.attributePointsAvailable++;
      this.passivePointsAvailable++;
      this.xpToNext = Math.floor(100 * Math.pow(this.level, 1.5));
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
    this.critDamageMultiplier = 1.5; // Base crit multiplier
    // Note: Overcharge passive and gear bonuses add to this in their respective apply methods
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

    // Attribute bonuses
    const totalStr = this.baseAttributes.str + this.attributes.str;
    const totalInt = this.baseAttributes.int + this.attributes.int;
    const totalAgi = this.baseAttributes.agi + this.attributes.agi;
    const totalSta = this.baseAttributes.sta + this.attributes.sta;

    // STR: +melee damage, +armor
    this.damageBonus += (this.primaryAttribute === 'str') ? totalStr * 0.01 * this.baseDamage : 0;
    this.totalArmor += totalStr * 0.5;

    // INT: +spell damage, +mana pool
    if (this.primaryAttribute === 'int') {
      this.damageBonus += totalInt * 0.01 * this.baseDamage;
    }

    // AGI: +dodge, +crit, +move speed
    this.dodgeChance += totalAgi * 0.003;
    if (this.dodgeChance > 0.30) this.dodgeChance = 0.30; // cap
    this.critChance += 0.02 + totalAgi * 0.002;
    this.speedMult += totalAgi * 0.002;
    this.attackSpeedMult += totalAgi * 0.002; // AGI also gives attack speed per DESIGN_BRIEF

    // STA: +max HP, +HP regen
    this.maxHPBonus += totalSta * 10;
    this.regenRate += totalSta * 0.1;

    // Reset weapon damage to class base each frame so unequipping reverts properly
    const baseDmg = (this.classConfig && this.classConfig.baseStats && this.classConfig.baseStats.damage) || 15;
    this.weaponDamageMin = baseDmg;
    this.weaponDamageMax = baseDmg;

    // Apply equipped main-hand weapon damage range (replaces base, doesn't add)
    const mainHand = this.equipment.mainHand;
    if (mainHand && mainHand.damageMin && mainHand.damageMax) {
      this.weaponDamageMin = mainHand.damageMin;
      this.weaponDamageMax = mainHand.damageMax;
    }

    // Equipment stat aggregation
    for (const slot of Object.values(this.equipment)) {
      if (!slot) continue;
      const item = slot;
      // Base equipment stats
      if (item.armor) this.totalArmor += item.armor;
      // Off-hand weapons (quiver, etc.) add to damage bonus, main hand handled above
      if (item !== mainHand && item.damageMin && item.damageMax) {
        this.damageBonus += Math.floor((item.damageMin + item.damageMax) / 2);
      }
      if (item.spellDamage) this.damageBonus += item.spellDamage;
      // item.manaBonus is handled in _updateResourceFromAttributes()
      // Affix stats
      if (item.affixes) {
        for (const affix of item.affixes) {
          if (affix.statKey === 'maxHPBonus') this.maxHPBonus += affix.value;
          else if (affix.statKey === 'armorBonus') this.totalArmor += affix.value;
          else if (affix.statKey === 'damageBonus') this.damageBonus += affix.value;
          else if (affix.statKey === 'critChanceBonus') this.critChance += affix.value;
          else if (affix.statKey === 'attackSpeedPercent') this.attackSpeedMult += affix.value;
          else if (affix.statKey === 'moveSpeedPercent') this.speedMult += affix.value;
          else if (affix.statKey === 'lifestealPercent') this.lifestealPercent += affix.value;
          else if (affix.statKey === 'damageReductionPercent') this.flatDamageReduction += affix.value;
          else if (affix.statKey === 'critDamageBonus') this.critDamageMultiplier += affix.value;
          else if (affix.statKey === 'dodgeChanceBonus') this.dodgeChance += affix.value;
          else if (affix.statKey === 'str') this.damageBonus += (this.primaryAttribute === 'str') ? affix.value * 0.01 * this.baseDamage : 0;
          else if (affix.statKey === 'int') { if (this.primaryAttribute === 'int') this.damageBonus += affix.value * 0.01 * this.baseDamage; }
          else if (affix.statKey === 'agi') { this.dodgeChance += affix.value * 0.003; this.critChance += affix.value * 0.002; }
          else if (affix.statKey === 'sta') { this.maxHPBonus += affix.value * 10; }
        }
      }
    }
    // Re-cap dodge after equipment
    if (this.dodgeChance > 0.30) this.dodgeChance = 0.30;

    // Apply passive skill bonuses
    for (const [passiveId, rank] of Object.entries(this.passiveSkills)) {
      if (rank <= 0) continue;
      // Passive effects are looked up from skills data — applied via game.js calling recalcAllStats
      // The effectPerRank values are applied by _applyPassiveEffects() called from game
    }

    const baseMaxHP = this.classConfig ? this.classConfig.baseStats.maxHP : 100;
    this.maxHP = baseMaxHP + this.maxHPBonus;
    this.hp = Math.min(this.hp, this.maxHP);
    this.speed = this.baseSpeed * this.speedMult;
    this.attackCooldown = this.baseAttackCooldown * this.attackSpeedMult;
    this.damage = this.baseDamage + this.damageBonus;

    // Update resource pools based on new attribute values
    this._updateResourceFromAttributes();

    // Necromancer max minions
    if (this.classConfig) {
      this.maxMinions = (this.classConfig.maxMinions || 0) + this.maxMinionBonus;
    }
  }

  recalcStats(singleAbilityData) {
    // Quick path: just recalc everything from stored abilities
    // We need all ability data though, so this is called from game
  }

  /**
   * Apply passive skill effects. Called by game.js after recalcAllStats().
   * @param {object} passiveDefs - Array of passive skill definitions with effectPerRank
   */
  applyPassiveEffects(passiveDefs) {
    if (!passiveDefs) return;
    for (const passive of passiveDefs) {
      const rank = this.passiveSkills[passive.id] || 0;
      if (rank <= 0) continue;
      const fx = passive.effectPerRank;
      if (!fx) continue;
      for (const [key, valuePerRank] of Object.entries(fx)) {
        const totalValue = valuePerRank * rank;
        // Map passive effect keys to player properties
        if (key === 'flatDamageReduction') this.flatDamageReduction += totalValue;
        else if (key === 'lifestealPercent') this.lifestealPercent += totalValue;
        else if (key === 'rageGenerationMult') { /* applied in resource system */ }
        else if (key === 'armorPercent') this.totalArmor *= (1 + totalValue);
        else if (key === 'attackSpeedPercent') this.attackSpeedMult += totalValue;
        else if (key === 'maxHPBonus') this.maxHPBonus += totalValue;
        else if (key === 'lowHPDamagePercent') { this._lowHPDmgBonus = totalValue; this._lowHPThreshold = fx.lowHPThreshold || 0.4; }
        else if (key === 'spellDamagePercent') this.damageBonus += totalValue * this.baseDamage;
        else if (key === 'manaRegenBonus') { /* applied in resource system */ }
        else if (key === 'allDamagePercent') this.damageBonus += totalValue * this.baseDamage;
        else if (key === 'maxHPPercent') this.maxHPBonus += totalValue * (this.classConfig?.baseStats?.maxHP || 100);
        else if (key === 'statusDurationPercent') { /* applied in status effect system */ }
        else if (key === 'magicDamageReduction') { /* applied in takeDamage */ }
        else if (key === 'cooldownReduction') { /* applied in skill execution */ }
        else if (key === 'critDamageBonus') this.critDamageMultiplier += totalValue;
        else if (key === 'critChanceBonus') this.critChance += totalValue;
        else if (key === 'moveSpeedPercent') this.speedMult += totalValue;
        else if (key === 'pierce') this.pierce += totalValue;
        else if (key === 'dodgeChanceBonus') this.dodgeChance = Math.min(0.30, this.dodgeChance + totalValue);
        else if (key === 'rangedDamagePercent') { if (this.classConfig?.attackType === 'ranged') this.damageBonus += totalValue * this.baseDamage; }
        else if (key === 'maxStaminaBonus') { /* applied in resource system */ }
        else if (key === 'petHPPercent' || key === 'petDamagePercent' || key === 'maxPetCountBonus' || key === 'petLifestealPercent' || key === 'dmgReductionPerPet') { /* applied in minion/pet system */ }
        else if (key === 'manaOnKillPercent') { /* applied in _onEnemyDeath */ }
        else if (key === 'corpseDurationBonus' || key === 'corpseExplosionDamagePercent') { /* applied in corpse system */ }
      }
    }
    // Recompute finals after passive application
    const baseMaxHP = this.classConfig ? this.classConfig.baseStats.maxHP : 100;
    this.maxHP = baseMaxHP + this.maxHPBonus;
    this.hp = Math.min(this.hp, this.maxHP);
    this.speed = this.baseSpeed * this.speedMult;
    this.attackCooldown = this.baseAttackCooldown * this.attackSpeedMult;
    this.damage = this.baseDamage + this.damageBonus;
    if (this.dodgeChance > 0.30) this.dodgeChance = 0.30;
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

      // Freeze ray slow (boss debuff, frame-based)
      if (this._freezeSlowTimer > 0) {
        this._freezeSlowTimer -= dt;
        currentSpeed *= (1 - (this._freezeSlowPct || 0));
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

    // Resource system update
    this.updateResource(dt);

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

  takeDamage(amount, attackerLevel = 1, options = {}) {
    if (this.invulnTimer > 0) return 0;

    const isEnvironmental = options.environmental || false;
    const isDot = options.dot || false;

    // Dodge check (not for AoE, environmental, or DoT)
    if (!isEnvironmental && !isDot && !options.isAoE && this.dodgeChance > 0 && Math.random() < this.dodgeChance) {
      this._lastDodged = true;
      return 0;
    }
    this._lastDodged = false;

    let remaining = amount;

    // Armor damage reduction (diminishing returns) — environmental damage ignores armor
    if (!isEnvironmental && this.totalArmor > 0) {
      const armorDR = this.totalArmor / (this.totalArmor + 50 + attackerLevel * 5);
      remaining *= (1 - armorDR);
    }

    // Flat damage reduction from passives (Toughness, etc.)
    if (this.flatDamageReduction > 0) {
      remaining *= (1 - this.flatDamageReduction);
    }

    // Warrior: class damage reduction
    if (this.damageReduction > 0) {
      remaining *= (1 - this.damageReduction);
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

    remaining = Math.max(0, remaining);
    this.hp -= remaining;
    if (!isDot) this.invulnTimer = 0.2;
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

  // Old skill tree methods removed — replaced by ARPG skill system in Stage 2
  // investSkill(skillId) { ... }
  // respecSkills() { ... }
  // applySkillTree(skillTreeData) { ... }

  _applySkillStat(key, value) {
    // Map skill stat keys to player properties
    // This is additive for most stats
    switch (key) {
      case 'maxHPBonus': this.maxHPBonus += value; break;
      case 'flatDamageReduction': this.flatDamageReduction += value; break;
      case 'damageReduction': this.damageReduction += value; break;
      case 'reflectPercent': this.thornsDamage = Math.max(this.thornsDamage, value); break;
      case 'sweepAngleBonus': this.sweepAngle += value; break;
      case 'baseDamageBonus': this.damageBonus += value; break;
      case 'moveSpeedBonus': this.speedMult *= (1 + value); break;
      case 'attackSpeedBonusBelowHP': this.berserkThreshold = 0.6; this.berserkDamageMult = 1; this.berserkSpeedMult = 1 + value; break;
      case 'bleedDamage': this.poisonDamage = Math.max(this.poisonDamage, value); break;
      case 'bleedDuration': this.poisonDuration = Math.max(this.poisonDuration, value); break;
      case 'killHeal': this.corpseHeal = Math.max(this.corpseHeal, value); break;
      case 'lifestealPercent': this.lifestealPercent = Math.max(this.lifestealPercent, value); break;
      case 'critChance': this.critChance = Math.max(this.critChance, value); break;
      case 'tripleChance': this.critChance = Math.max(this.critChance, value); break;
      case 'echoChance': this.echoChance = Math.max(this.echoChance, value); break;
      case 'echoDamagePct': this.echoDamageMult = Math.max(this.echoDamageMult, value); break;
      case 'regenRate': this.regenRate = Math.max(this.regenRate, value); break;
      case 'igniteDPS': this.poisonDamage = Math.max(this.poisonDamage, value); break;
      case 'igniteDuration': this.poisonDuration = Math.max(this.poisonDuration, value); break;
      case 'splitCount': this.splitCount = Math.max(this.splitCount, value); break;
      case 'splitDamagePct': this.splitDamagePct = Math.max(this.splitDamagePct, value); break;
      case 'maxMinionBonus': this.maxMinionBonus += value; break;
      case 'minionDamageBonus': this.minionDamageBonus += value; break;
      case 'minionHPBonus': this.minionHPBonus += value; break;
      case 'firstHitBonusAdd': /* handled in attack calc */ break;
      case 'explosionRadius': this.explosionRadius = Math.max(this.explosionRadius, value); break;
      case 'explosionDamage': this.explosionDamage = Math.max(this.explosionDamage, value); break;
      // Store other stats generically
      default:
        if (!this._skillStats) this._skillStats = {};
        this._skillStats[key] = value;
    }
  }

  getSkillStat(key, defaultValue) {
    if (this._skillStats && this._skillStats[key] !== undefined) return this._skillStats[key];
    return defaultValue || 0;
  }

  // === POTION ===
  // === RESOURCE SYSTEM ===
  initResource(resourceConfig) {
    if (!resourceConfig) return;
    this.resourceType = resourceConfig.type;
    this.resourceName = resourceConfig.displayName;
    this.maxResource = resourceConfig.base + (resourceConfig.perLevel || 0) * (this.level - 1);
    this.resource = this.resourceType === 'rage' ? 0 : this.maxResource; // Rage starts empty
    this.baseResourceRegen = resourceConfig.regen || 0;
    this.resourceRegen = this.baseResourceRegen + (resourceConfig.regenPerLevel || 0) * (this.level - 1);
    this.resourceDecay = resourceConfig.decay || 0;
    this.resourceDecayDelay = resourceConfig.decayDelay || 0;
    this.resourceDecayTimer = 0;
    this.resourceRegenPause = resourceConfig.regenPause || 0;
    this.resourceRegenPauseTimer = 0;
    this.resourceOnHitDeal = resourceConfig.onHitDeal || 0;
    this.resourceOnHitTake = resourceConfig.onHitTake || 0;
    this.resourceOnKill = resourceConfig.onKill || 0;
    this.resourceOnMinionKill = resourceConfig.onMinionKill || 0;
    this.resourceColor = resourceConfig.colors?.text || resourceConfig.color || '#3498db';
    this.resourceBarGradient = resourceConfig.colors?.bar || resourceConfig.barGradient || ['#3498db', '#3498db'];
    this._resourceConfig = resourceConfig;
    // Apply attribute-based scaling
    this._updateResourceFromAttributes();
  }

  _updateResourceFromAttributes() {
    const cfg = this._resourceConfig;
    if (!cfg) return;

    // Get the scaling attribute value
    let scalingValue = 0;
    if (cfg.scalingStat) {
      const totalAttr = (this.baseAttributes[cfg.scalingStat] || 0) + (this.attributes[cfg.scalingStat] || 0);
      scalingValue = totalAttr;
    }

    // Max resource = base + (scalingPerPoint * attribute)
    this.maxResource = cfg.base + (cfg.scalingPerPoint || 0) * scalingValue;

    // Regen = baseRegen + (regenScalingPerPoint * attribute)
    let regenScaling = 0;
    if (cfg.regenScalingStat) {
      const totalRegenAttr = (this.baseAttributes[cfg.regenScalingStat] || 0) + (this.attributes[cfg.regenScalingStat] || 0);
      regenScaling = totalRegenAttr;
    }
    this.resourceRegen = (cfg.regen || 0) + (cfg.regenScalingPerPoint || 0) * regenScaling;

    // Floor start value for rage
    if (cfg.floorStartValue > 0) {
      this._floorStartResource = cfg.floorStartValue;
    }

    // Basic attack generation (rage)
    this.basicAttackResourceGen = cfg.basicAttackGeneration || 0;
  }

  updateResource(dt) {
    // Resource scaling applied in recalcAllStats(), not per-frame

    // Regen pause (stamina)
    if (this.resourceRegenPauseTimer > 0) {
      this.resourceRegenPauseTimer -= dt;
    }

    // Passive regen (mana, stamina)
    if (this.resourceRegen > 0 && this.resourceRegenPauseTimer <= 0) {
      this.resource = Math.min(this.maxResource, this.resource + this.resourceRegen * dt);
    }

    // Rage decay
    if (this.resourceDecay > 0) {
      this.resourceDecayTimer -= dt;
      if (this.resourceDecayTimer <= 0 && this.resource > 0) {
        this.resource = Math.max(0, this.resource - this.resourceDecay * dt);
      }
    }
  }

  spendResource(amount) {
    if (this.resource < amount) return false;
    this.resource -= amount;
    // Pause regen (stamina)
    if (this.resourceRegenPause > 0) {
      this.resourceRegenPauseTimer = this.resourceRegenPause;
    }
    return true;
  }

  gainResource(amount) {
    this.resource = Math.min(this.maxResource, this.resource + amount);
    // Reset rage decay timer
    if (this.resourceDecay > 0) {
      this.resourceDecayTimer = this.resourceDecayDelay;
    }
  }

  hasResource(amount) {
    return this.resource >= amount;
  }

  getWeaponDamage() {
    return this.weaponDamageMin + Math.random() * (this.weaponDamageMax - this.weaponDamageMin);
  }

  usePotion() {
    if (this.potions <= 0) return false;
    if (this.hp >= this.maxHP) return false;
    this.potions--;
    this.hp = Math.min(this.maxHP, this.hp + this.potionHeal);
    return true;
  }

  // === LOAD STATE FROM PERSISTENCE ===
  loadFromSave(saveData) {
    if (!saveData) return;
    this.level = saveData.level || 1;
    this.xp = saveData.xp || 0;
    this.xpToNext = Math.floor(100 * Math.pow(this.level, 1.5));
    const data = saveData;
      if (data.attributes) this.attributes = { ...data.attributes };
      if (data.attributePointsAvailable !== undefined) this.attributePointsAvailable = data.attributePointsAvailable;
      if (data.learnedSkills) this.learnedSkills = { ...data.learnedSkills };
      if (data.passiveSkills) this.passiveSkills = { ...data.passiveSkills };
      if (data.passivePointsAvailable !== undefined) this.passivePointsAvailable = data.passivePointsAvailable;
      if (data.activeSkills) this.activeSkills = { ...data.activeSkills };
      if (data.summonToggles) this.summonToggles = { ...data.summonToggles };
      if (data.hp !== undefined) this.hp = data.hp;
      if (data.gold !== undefined) this.gold = data.gold;
      if (data.potions !== undefined) this.potions = data.potions;
      if (data.equipment) this.equipment = JSON.parse(JSON.stringify(data.equipment));
  }

  getSaveData() {
    return {
      level: this.level,
      xp: this.xp,
      attributes: { ...this.attributes },
      attributePointsAvailable: this.attributePointsAvailable,
      learnedSkills: { ...this.learnedSkills },
      passiveSkills: { ...this.passiveSkills },
      passivePointsAvailable: this.passivePointsAvailable,
      activeSkills: { ...this.activeSkills },
      summonToggles: { ...this.summonToggles },
      hp: this.hp,
      gold: this.gold,
      potions: this.potions,
      equipment: JSON.parse(JSON.stringify(this.equipment)),
    };
  }
}
