export class SkillManager {
  constructor(skillsData, playerClass) {
    this.playerClass = playerClass;

    const classData = skillsData[playerClass] || {};
    this.actives = classData.actives || [];
    this.passives = classData.passives || [];
    this.summonToggles = classData.summonToggles || [];

    // Upgrade cost tables
    const costs = skillsData.skillUpgradeCosts || {};
    this.tierBuyCost = costs.tierBuyCost || {};
    this.tierUpgradeBase = costs.tierUpgradeBase || {};
    this.tierMinLevel = costs.tierMinLevel || {};

    // Learned skill levels: { skillId: currentLevel (1-5) }
    this.learnedSkills = {};

    // Equipped active skills
    this.leftSlot = null;
    this.rightSlot = null;

    // Cooldowns: { skillId: remaining seconds }
    this.cooldowns = {};

    // Summon toggle states: { skillId: boolean }
    this.summonStates = {};

    // Passive ranks: { passiveId: currentRank (0 to maxRanks) }
    this.passiveRanks = {};

    // Passive points available to spend
    this.passivePoints = 0;

    // Pending summons for game.js to process each frame
    this.pendingSummons = [];

    // Auto-learn default skills at level 1
    for (const skill of this.actives) {
      if (skill.isDefault) {
        this.learnedSkills[skill.id] = 1;
        // Auto-equip first default to left slot
        if (!this.leftSlot) {
          this.leftSlot = skill.id;
        } else if (!this.rightSlot) {
          this.rightSlot = skill.id;
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Skill lookup
  // ---------------------------------------------------------------------------

  /** Find an active or summon toggle skill by id (not passives). */
  getSkill(skillId) {
    return (
      this.actives.find(s => s.id === skillId) ||
      this.summonToggles.find(s => s.id === skillId) ||
      null
    );
  }

  /** Get current level data for a learned skill. */
  getSkillLevel(skillId) {
    const skill = this.getSkill(skillId);
    const level = this.learnedSkills[skillId] || 0;
    if (!skill || level <= 0) return null;
    return { skill, level, data: skill.levels[level - 1] };
  }

  /** Equipped left skill with level data. */
  getLeftSkill() { return this.getSkillLevel(this.leftSlot); }

  /** Equipped right skill with level data. */
  getRightSkill() { return this.getSkillLevel(this.rightSlot); }

  // ---------------------------------------------------------------------------
  // Cost helpers
  // ---------------------------------------------------------------------------

  /** Gold cost to buy an unlearned skill (tier-based). */
  getBuyCost(skillId) {
    const skill = this.getSkill(skillId);
    if (!skill) return Infinity;
    return Number(this.tierBuyCost[skill.tier] ?? Infinity);
  }

  /** Gold cost to upgrade a learned skill to the next level. */
  getUpgradeCost(skillId) {
    const skill = this.getSkill(skillId);
    if (!skill) return Infinity;
    const currentLevel = this.learnedSkills[skillId] || 0;
    if (currentLevel <= 0) return this.getBuyCost(skillId);
    const nextLevel = currentLevel + 1;
    const base = Number(this.tierUpgradeBase[skill.tier] ?? Infinity);
    return base * nextLevel;
  }

  /** Minimum player level required for a skill's tier. */
  getMinLevel(skillId) {
    const skill = this.getSkill(skillId);
    if (!skill) return Infinity;
    return Number(this.tierMinLevel[skill.tier] ?? 1);
  }

  /** Maximum upgradeable level for a skill. */
  _getMaxLevel(skill) {
    if (!skill) return 0;
    // Summon toggles use their levels array length; actives cap at 5
    if (this.summonToggles.some(s => s.id === skill.id)) {
      return skill.levels ? skill.levels.length : 1;
    }
    return skill.levels ? Math.min(skill.levels.length, 5) : 5;
  }

  // ---------------------------------------------------------------------------
  // Learn / upgrade
  // ---------------------------------------------------------------------------

  /**
   * Attempt to learn or upgrade a skill.
   * Returns { success, cost?, reason? }.
   */
  learnSkill(skillId, playerLevel, playerGold) {
    const skill = this.getSkill(skillId);
    if (!skill) return { success: false, reason: 'Skill not found' };

    const currentLevel = this.learnedSkills[skillId] || 0;
    const maxLevel = this._getMaxLevel(skill);
    if (currentLevel >= maxLevel) return { success: false, reason: 'Already max level' };

    const minLevel = this.getMinLevel(skillId);
    if (playerLevel < minLevel) {
      return { success: false, reason: `Requires player level ${minLevel}` };
    }

    let cost;
    if (currentLevel === 0) {
      // Buying for the first time
      cost = this.getBuyCost(skillId);
    } else {
      // Upgrading
      cost = this.getUpgradeCost(skillId);
    }

    if (playerGold < cost) {
      return { success: false, reason: `Requires ${cost} gold` };
    }

    return { success: true, cost };
  }

  /** Apply the learn/upgrade after gold has been deducted. */
  applyLearnSkill(skillId) {
    this.learnedSkills[skillId] = (this.learnedSkills[skillId] || 0) + 1;

    // Auto-equip to an empty slot (actives only)
    if (this.actives.some(s => s.id === skillId)) {
      if (!this.leftSlot) {
        this.leftSlot = skillId;
      } else if (!this.rightSlot) {
        this.rightSlot = skillId;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Equip — any active can go in either slot
  // ---------------------------------------------------------------------------

  equipToLeft(skillId) {
    const skill = this.getSkill(skillId);
    if (!skill || !this.learnedSkills[skillId]) return false;
    if (!this.actives.some(s => s.id === skillId)) return false; // must be an active
    this.leftSlot = skillId;
    return true;
  }

  equipToRight(skillId) {
    const skill = this.getSkill(skillId);
    if (!skill || !this.learnedSkills[skillId]) return false;
    if (!this.actives.some(s => s.id === skillId)) return false;
    this.rightSlot = skillId;
    return true;
  }

  // ---------------------------------------------------------------------------
  // Skill usage (combat)
  // ---------------------------------------------------------------------------

  canUseSkill(skillId, player) {
    const info = this.getSkillLevel(skillId);
    if (!info) return false;
    if ((this.cooldowns[skillId] || 0) > 0) return false;
    const cost = info.skill.resourceCost || 0;
    return player.hasResource(cost);
  }

  useSkill(skillId, player) {
    const info = this.getSkillLevel(skillId);
    if (!info) return null;

    const cost = info.skill.resourceCost || 0;
    if (!player.spendResource(cost)) return null;

    // Start cooldown
    this.cooldowns[skillId] = info.skill.cooldown || 0;

    // Resource generation (e.g. basic attacks that generate rage)
    if (info.skill.resourceGeneration) {
      player.addResource(info.skill.resourceGeneration);
    }

    return info;
  }

  // ---------------------------------------------------------------------------
  // Passives
  // ---------------------------------------------------------------------------

  /** Returns passives array with current rank info. */
  getPassives() {
    return this.passives.map(p => ({
      ...p,
      currentRank: this.passiveRanks[p.id] || 0,
    }));
  }

  /** Invest 1 passive point into a passive. Returns true on success. */
  investPassive(passiveId) {
    const passive = this.passives.find(p => p.id === passiveId);
    if (!passive) return false;

    const currentRank = this.passiveRanks[passiveId] || 0;
    if (currentRank >= passive.maxRanks) return false;
    if (this.passivePoints <= 0) return false;

    this.passiveRanks[passiveId] = currentRank + 1;
    this.passivePoints -= 1;
    return true;
  }

  /** Reset all passive ranks to 0. Returns total points refunded. */
  respecPassives() {
    let total = 0;
    for (const id of Object.keys(this.passiveRanks)) {
      total += this.passiveRanks[id] || 0;
      this.passiveRanks[id] = 0;
    }
    this.passivePoints += total;
    return total;
  }

  // ---------------------------------------------------------------------------
  // Summon toggles
  // ---------------------------------------------------------------------------

  /** Returns summon toggles with current state and level. */
  getSummonToggles() {
    return this.summonToggles.map(s => ({
      ...s,
      currentLevel: this.learnedSkills[s.id] || 0,
      isActive: !!this.summonStates[s.id],
      levelData: this.learnedSkills[s.id]
        ? s.levels[(this.learnedSkills[s.id] || 1) - 1]
        : null,
    }));
  }

  /** Toggle a summon on or off. Must be learned. */
  toggleSummon(summonId) {
    const summon = this.summonToggles.find(s => s.id === summonId);
    if (!summon) return false;
    if (!this.learnedSkills[summonId]) return false;
    this.summonStates[summonId] = !this.summonStates[summonId];
    return true;
  }

  // ---------------------------------------------------------------------------
  // UI helpers
  // ---------------------------------------------------------------------------

  /** Returns all active skills with full UI info. */
  getAllActives() {
    return this.actives.map(skill => {
      const currentLevel = this.learnedSkills[skill.id] || 0;
      const maxLevel = this._getMaxLevel(skill);
      const isLearned = currentLevel > 0;

      return {
        ...skill,
        currentLevel,
        maxLevel,
        isLearned,
        isEquippedLeft: this.leftSlot === skill.id,
        isEquippedRight: this.rightSlot === skill.id,
        canBuy: !isLearned && this.getBuyCost(skill.id) < Infinity,
        canUpgrade: isLearned && currentLevel < maxLevel,
        buyCost: this.getBuyCost(skill.id),
        upgradeCost: isLearned ? this.getUpgradeCost(skill.id) : null,
        minLevel: this.getMinLevel(skill.id),
        levelData: isLearned ? skill.levels[currentLevel - 1] : null,
        nextLevelData: currentLevel < maxLevel ? skill.levels[currentLevel] : null,
      };
    });
  }

  /** Legacy-compatible: returns all actives + summon toggles. */
  getAllSkills() {
    const allCombat = [...this.actives, ...this.summonToggles];
    return allCombat.map(skill => ({
      ...skill,
      currentLevel: this.learnedSkills[skill.id] || 0,
      isEquippedLeft: this.leftSlot === skill.id,
      isEquippedRight: this.rightSlot === skill.id,
    }));
  }

  // ---------------------------------------------------------------------------
  // Update loop
  // ---------------------------------------------------------------------------

  update(dt, player) {
    // Tick cooldowns
    for (const id of Object.keys(this.cooldowns)) {
      if (this.cooldowns[id] > 0) {
        this.cooldowns[id] -= dt;
      }
    }

    // Process summon toggles — queue pending summons when ready
    this.pendingSummons = [];
    for (const summon of this.summonToggles) {
      if (!this.summonStates[summon.id]) continue;

      const level = this.learnedSkills[summon.id] || 0;
      if (level <= 0) continue;

      const levelData = summon.levels[level - 1];
      const maxPets = levelData.maxSummons || levelData.maxPets || 1;
      const cost = summon.resourceCost || 0;

      // Cooldown check
      if ((this.cooldowns[summon.id] || 0) > 0) continue;

      // Resource check
      if (!player.hasResource(cost)) continue;

      // Queue summon (game.js checks current pet count against maxPets)
      this.pendingSummons.push({
        skillId: summon.id,
        summonData: levelData,
        resourceCost: cost,
        cooldown: summon.cooldown || 3.0,
        maxPets,
      });
    }
  }

  /**
   * Called by game.js after it processes a pending summon.
   * Deducts resource and starts cooldown.
   */
  confirmSummon(summonId, player) {
    const summon = this.summonToggles.find(s => s.id === summonId);
    if (!summon) return;
    const cost = summon.resourceCost || 0;
    if (!player.spendResource(cost)) return;
    this.cooldowns[summonId] = summon.cooldown || 3.0;
  }

  // ---------------------------------------------------------------------------
  // Serialization
  // ---------------------------------------------------------------------------

  toSaveData() {
    return {
      learnedSkills: { ...this.learnedSkills },
      leftSlot: this.leftSlot,
      rightSlot: this.rightSlot,
      summonStates: { ...this.summonStates },
      passiveRanks: { ...this.passiveRanks },
      passivePoints: this.passivePoints,
    };
  }

  loadFromSave(data) {
    if (!data) return;
    if (data.learnedSkills && Object.keys(data.learnedSkills).length > 0) {
      this.learnedSkills = data.learnedSkills;
    }
    if (data.leftSlot) this.leftSlot = data.leftSlot;
    if (data.rightSlot) this.rightSlot = data.rightSlot;
    this.summonStates = data.summonStates || {};
    this.passiveRanks = data.passiveRanks || {};
    this.passivePoints = data.passivePoints || 0;
  }
}
