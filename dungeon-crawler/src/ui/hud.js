export class HUD {
  constructor() {
    this.hpBar = document.getElementById('hp-bar');
    this.hpText = document.getElementById('hp-text');
    this.resourceBar = document.getElementById('resource-bar');
    this.resourceText = document.getElementById('resource-text');
    this.resourceBarContainer = document.getElementById('resource-bar-container');
    this.waveCounter = document.getElementById('wave-counter');
    this.bossContainer = document.getElementById('boss-hp-container');
    this.bossName = document.getElementById('boss-name');
    this.bossHPBar = document.getElementById('boss-hp-bar');
    this.abilityIcons = document.getElementById('ability-icons');
    this.countdown = document.getElementById('wave-countdown');
    this.enemyCounter = document.getElementById('enemy-counter');
    this.xpBar = document.getElementById('xp-bar');
    this.xpText = document.getElementById('xp-text');
    this.scoreDisplay = document.getElementById('score-display'); // may not exist
    this.levelName = document.getElementById('level-name');
    this.goldDisplay = document.getElementById('gold-display');
    this.skillSlotLeft = document.getElementById('skill-slot-left');
    this.skillSlotRight = document.getElementById('skill-slot-right');
  }

  updateHP(hp, maxHP) {
    const pct = Math.max(0, hp / maxHP * 100);
    this.hpBar.style.width = pct + '%';
    this.hpText.textContent = `${Math.ceil(hp)} / ${maxHP}`;
  }

  updateResource(current, max, color, name) {
    if (!this.resourceBar) return;
    const pct = Math.max(0, current / max * 100);
    this.resourceBar.style.width = pct + '%';
    if (color) {
      this.resourceBar.style.background = `linear-gradient(to right, ${color}, ${color})`;
    }
    if (this.resourceText) {
      this.resourceText.textContent = `${Math.ceil(current)} ${name || ''}`;
    }
  }

  setResourceColor(gradient) {
    if (!this.resourceBar || !gradient) return;
    this.resourceBar.style.background = `linear-gradient(to right, ${gradient[0]}, ${gradient[1]})`;
  }

  updateXP(xp, xpToNext, level) {
    const pct = Math.max(0, xp / xpToNext * 100);
    this.xpBar.style.width = pct + '%';
    this.xpText.textContent = `Lv.${level}`;
  }

  updateGold(gold) {
    if (this.goldDisplay) {
      this.goldDisplay.textContent = `Gold: ${gold}`;
    }
  }

  updateSkillSlots(leftSkill, rightSkill) {
    if (this.skillSlotLeft) {
      this.skillSlotLeft.innerHTML = leftSkill ? `<span class="slot-icon">${leftSkill.icon || '?'}</span><span class="slot-label">LMB</span>` : '<span class="slot-label">LMB</span>';
    }
    if (this.skillSlotRight) {
      this.skillSlotRight.innerHTML = rightSkill ? `<span class="slot-icon">${rightSkill.icon || '?'}</span><span class="slot-label">RMB</span>` : '<span class="slot-label">RMB</span>';
    }
  }

  updateWave(wave) {
    this.waveCounter.textContent = `Floor ${wave}`;
  }

  showBossHP(name, hp, maxHP) {
    this.bossContainer.classList.remove('hidden');
    this.bossName.textContent = name;
    const pct = Math.max(0, hp / maxHP * 100);
    this.bossHPBar.innerHTML = `<div style="width:${pct}%;height:100%;background:linear-gradient(to right,#c0392b,#e74c3c);border-radius:5px;transition:width 0.2s"></div>`;
  }

  hideBossHP() {
    this.bossContainer.classList.add('hidden');
  }

  updateAbilities(abilities, allAbilityData) {
    this.abilityIcons.innerHTML = '';
    for (const ab of abilities) {
      const data = allAbilityData ? allAbilityData.find(a => a.id === ab.id) : null;
      if (!data) continue;
      const div = document.createElement('div');
      div.className = 'ability-icon';
      div.innerHTML = `<span>${data.icon}</span><div class="level-badge">${ab.level}</div>`;
      div.title = `${data.name} Lv.${ab.level}`;
      this.abilityIcons.appendChild(div);
    }
  }

  updateLevelName(name) {
    if (this.levelName) this.levelName.textContent = name || '';
  }

  updateScore(score) {
    // Score display removed in ARPG refactor
  }

  updateEnemyCount(alive, total) {
    this.enemyCounter.textContent = `Enemies: ${alive} / ${total}`;
  }

  showCountdown(seconds) {
    this.countdown.classList.remove('hidden');
    this.countdown.textContent = Math.ceil(seconds);
  }

  hideCountdown() {
    this.countdown.classList.add('hidden');
  }
}
