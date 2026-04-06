export class SkillManager {
  constructor(skillsData, playerClass) {
    this.allSkills = skillsData[playerClass] || [];
    this.playerClass = playerClass;

    // Learned skills: { skillId: currentLevel (1-5) }
    this.learnedSkills = {};

    // Equipped skills
    this.leftSlot = null;  // skill id
    this.rightSlot = null; // skill id

    // Cooldowns: { skillId: remaining seconds }
    this.cooldowns = {};

    // Toggle states: { skillId: active boolean }
    this.toggles = {};
  }

  // Get skill definition by id
  getSkill(skillId) {
    return this.allSkills.find(s => s.id === skillId) || null;
  }

  // Get current level data for a skill
  getSkillLevel(skillId) {
    const skill = this.getSkill(skillId);
    const level = this.learnedSkills[skillId] || 0;
    if (!skill || level <= 0) return null;
    return { skill, level, data: skill.levels[level - 1] };
  }

  // Get the active left/right skill with current level data
  getLeftSkill() { return this.getSkillLevel(this.leftSlot); }
  getRightSkill() { return this.getSkillLevel(this.rightSlot); }

  // Learn or upgrade a skill (returns true if successful)
  learnSkill(skillId, playerLevel, gold) {
    const skill = this.getSkill(skillId);
    if (!skill) return { success: false, reason: 'Skill not found' };

    const currentLevel = this.learnedSkills[skillId] || 0;
    if (currentLevel >= skill.levels.length) return { success: false, reason: 'Already max level' };

    const nextLevelData = skill.levels[currentLevel]; // 0-indexed for next level
    if (playerLevel < nextLevelData.levelReq) return { success: false, reason: `Requires player level ${nextLevelData.levelReq}` };
    if (gold < nextLevelData.cost) return { success: false, reason: `Requires ${nextLevelData.cost} gold` };

    return { success: true, cost: nextLevelData.cost };
  }

  applyLearnSkill(skillId) {
    this.learnedSkills[skillId] = (this.learnedSkills[skillId] || 0) + 1;

    // Auto-equip if slot is empty
    const skill = this.getSkill(skillId);
    if (skill) {
      if (!this.leftSlot && (skill.slot === 'left' || skill.slot === 'either')) {
        this.leftSlot = skillId;
      } else if (!this.rightSlot && (skill.slot === 'right' || skill.slot === 'either')) {
        this.rightSlot = skillId;
      }
    }
  }

  // Equip a skill to a slot
  equipToLeft(skillId) {
    const skill = this.getSkill(skillId);
    if (!skill || !this.learnedSkills[skillId]) return false;
    if (skill.slot !== 'left' && skill.slot !== 'either') return false;
    this.leftSlot = skillId;
    return true;
  }

  equipToRight(skillId) {
    const skill = this.getSkill(skillId);
    if (!skill || !this.learnedSkills[skillId]) return false;
    if (skill.slot !== 'right' && skill.slot !== 'either') return false;
    this.rightSlot = skillId;
    return true;
  }

  // Check if a skill can be used right now
  canUseSkill(skillId, player) {
    const info = this.getSkillLevel(skillId);
    if (!info) return false;

    // Cooldown check
    if ((this.cooldowns[skillId] || 0) > 0) return false;

    // Resource check
    const cost = info.skill.resourceCost || 0;
    if (info.skill.attackType === 'toggle') {
      return true; // Toggles are always usable
    }
    return player.hasResource(cost);
  }

  // Use a skill - spend resource and start cooldown
  useSkill(skillId, player) {
    const info = this.getSkillLevel(skillId);
    if (!info) return null;

    // Toggle handling
    if (info.skill.attackType === 'toggle') {
      this.toggles[skillId] = !this.toggles[skillId];
      return info;
    }

    // Spend resource
    const cost = info.skill.resourceCost || 0;
    if (!player.spendResource(cost)) return null;

    // Start cooldown
    this.cooldowns[skillId] = info.skill.cooldown || 0;

    return info;
  }

  // Update cooldowns
  update(dt, player) {
    for (const id of Object.keys(this.cooldowns)) {
      if (this.cooldowns[id] > 0) {
        this.cooldowns[id] -= dt;
      }
    }

    // Toggle resource drain
    for (const [id, active] of Object.entries(this.toggles)) {
      if (active) {
        const skill = this.getSkill(id);
        if (skill && skill.resourceCost) {
          if (!player.spendResource(skill.resourceCost * dt)) {
            this.toggles[id] = false; // Ran out of resource
          }
        }
      }
    }
  }

  // Get all learnable skills (for skill book UI)
  getAllSkills() {
    return this.allSkills.map(skill => ({
      ...skill,
      currentLevel: this.learnedSkills[skill.id] || 0,
      isEquippedLeft: this.leftSlot === skill.id,
      isEquippedRight: this.rightSlot === skill.id,
    }));
  }

  // Serialization
  toSaveData() {
    return {
      learnedSkills: { ...this.learnedSkills },
      leftSlot: this.leftSlot,
      rightSlot: this.rightSlot,
    };
  }

  loadFromSave(data) {
    if (!data) return;
    this.learnedSkills = data.learnedSkills || {};
    this.leftSlot = data.leftSlot || null;
    this.rightSlot = data.rightSlot || null;
  }
}
