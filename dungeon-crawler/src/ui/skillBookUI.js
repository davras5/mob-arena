export class SkillBookUI {
  constructor() {
    this.container = document.getElementById('skill-book-panel');
  }

  show(skillManager, playerLevel, gold, onLearn, onEquipLeft, onEquipRight) {
    if (!this.container) return Promise.resolve();
    this.container.classList.remove('hidden');
    this.container.innerHTML = '';

    return new Promise((resolve) => {
      const skills = skillManager.getAllSkills();

      let html = `
        <div class="skillbook-header">
          <h2>Skill Book</h2>
          <span class="skillbook-gold">Gold: <strong>${gold}</strong></span>
          <span class="skillbook-level">Level: <strong>${playerLevel}</strong></span>
          <button class="skillbook-close-btn" id="skillbook-close">Close</button>
        </div>
        <div class="skillbook-list">
      `;

      for (const skill of skills) {
        const level = skill.currentLevel;
        const maxLevel = skill.levels.length;
        const isMaxed = level >= maxLevel;
        const nextLevelData = !isMaxed ? skill.levels[level] : null; // 0-indexed: level 0 = first unlock
        const canLearn = nextLevelData && playerLevel >= nextLevelData.levelReq && gold >= nextLevelData.cost;
        const isLearned = level > 0;

        // Current level stats
        const currentData = level > 0 ? skill.levels[level - 1] : null;

        // Pips
        let pips = '';
        for (let i = 0; i < maxLevel; i++) {
          pips += `<span class="skill-pip ${i < level ? 'filled' : ''}">\u25cf</span>`;
        }

        // Slot compatibility
        const canLeft = skill.slot === 'left' || skill.slot === 'either';
        const canRight = skill.slot === 'right' || skill.slot === 'either';

        html += `
          <div class="skillbook-row ${isLearned ? 'learned' : 'unlearned'}" data-skill-id="${skill.id}">
            <div class="skillbook-icon">${skill.icon}</div>
            <div class="skillbook-info">
              <div class="skillbook-name">${skill.name} ${pips}</div>
              <div class="skillbook-desc">${skill.description}</div>
              <div class="skillbook-stats">
                ${currentData ? `Damage: ${currentData.damage || '-'} | Cost: ${skill.resourceCost} | CD: ${skill.cooldown}s` : 'Not learned'}
              </div>
            </div>
            <div class="skillbook-actions">
              ${!isMaxed ? `<button class="skillbook-learn-btn ${canLearn ? '' : 'disabled'}" data-action="learn" data-skill="${skill.id}">
                ${level === 0 ? 'Learn' : 'Upgrade'} (${nextLevelData ? nextLevelData.cost + 'g' : ''})
                ${nextLevelData && playerLevel < nextLevelData.levelReq ? '<br><small>Lv' + nextLevelData.levelReq + ' req</small>' : ''}
              </button>` : '<span class="skillbook-maxed">MAX</span>'}
              ${isLearned && canLeft ? `<button class="skillbook-equip-btn ${skill.isEquippedLeft ? 'active' : ''}" data-action="equip-left" data-skill="${skill.id}">LMB${skill.isEquippedLeft ? ' \u2713' : ''}</button>` : ''}
              ${isLearned && canRight ? `<button class="skillbook-equip-btn ${skill.isEquippedRight ? 'active' : ''}" data-action="equip-right" data-skill="${skill.id}">RMB${skill.isEquippedRight ? ' \u2713' : ''}</button>` : ''}
            </div>
          </div>
        `;
      }

      html += `</div>`;
      this.container.innerHTML = html;

      // Wire events
      this.container.querySelector('#skillbook-close').addEventListener('click', () => {
        this.hide();
        resolve();
      });

      for (const btn of this.container.querySelectorAll('[data-action="learn"]:not(.disabled)')) {
        btn.addEventListener('click', () => {
          const skillId = btn.dataset.skill;
          if (onLearn) onLearn(skillId);
          // Re-render
          this.hide();
          resolve('refresh');
        });
      }

      for (const btn of this.container.querySelectorAll('[data-action="equip-left"]')) {
        btn.addEventListener('click', () => {
          if (onEquipLeft) onEquipLeft(btn.dataset.skill);
          this.hide();
          resolve('refresh');
        });
      }

      for (const btn of this.container.querySelectorAll('[data-action="equip-right"]')) {
        btn.addEventListener('click', () => {
          if (onEquipRight) onEquipRight(btn.dataset.skill);
          this.hide();
          resolve('refresh');
        });
      }
    });
  }

  hide() {
    if (this.container) this.container.classList.add('hidden');
  }
}
