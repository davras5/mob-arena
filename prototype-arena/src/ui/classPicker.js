export class ClassPicker {
  constructor() {
    this.container = document.getElementById('class-picker');
    this.cardsEl = document.getElementById('class-cards');
  }

  show(classesData) {
    this.container.classList.remove('hidden');
    this.cardsEl.innerHTML = '';

    return new Promise((resolve) => {
      const classIds = ['warrior', 'mage', 'archer', 'necromancer'];

      for (const id of classIds) {
        const cls = classesData[id];
        if (!cls) continue;

        const card = document.createElement('div');
        card.className = 'class-card';
        card.style.borderColor = cls.color;

        const stats = cls.baseStats;
        const abilityDesc = cls.uniqueAbility.name + ' - ' + cls.uniqueAbility.description;

        // Stat bars relative to max values
        const hpPct = Math.round((stats.maxHP / 140) * 100);
        const spdPct = Math.round((stats.speed / 140) * 100);
        const dmgPct = Math.round((stats.damage / 22) * 100);
        const atkSpd = Math.round((1 / stats.attackCooldown) / (1 / 0.6) * 100);

        card.innerHTML = `
          <div class="class-icon" style="color:${cls.color}">${cls.icon}</div>
          <div class="class-name" style="color:${cls.color}">${cls.name}</div>
          <div class="class-desc">${cls.description}</div>
          <div class="class-stats">
            <div class="class-stat-row">
              <span class="stat-label">HP</span>
              <div class="stat-bar"><div class="stat-fill" style="width:${hpPct}%;background:${cls.color}"></div></div>
              <span class="stat-value">${stats.maxHP}</span>
            </div>
            <div class="class-stat-row">
              <span class="stat-label">SPD</span>
              <div class="stat-bar"><div class="stat-fill" style="width:${spdPct}%;background:${cls.color}"></div></div>
              <span class="stat-value">${stats.speed}</span>
            </div>
            <div class="class-stat-row">
              <span class="stat-label">DMG</span>
              <div class="stat-bar"><div class="stat-fill" style="width:${dmgPct}%;background:${cls.color}"></div></div>
              <span class="stat-value">${stats.damage}</span>
            </div>
            <div class="class-stat-row">
              <span class="stat-label">ATK</span>
              <div class="stat-bar"><div class="stat-fill" style="width:${atkSpd}%;background:${cls.color}"></div></div>
              <span class="stat-value">${stats.attackCooldown}s</span>
            </div>
          </div>
          <div class="class-ability">${abilityDesc}</div>
        `;

        card.addEventListener('click', () => {
          this.hide();
          resolve(cls);
        });
        card.addEventListener('touchend', (e) => {
          e.preventDefault();
          this.hide();
          resolve(cls);
        });

        this.cardsEl.appendChild(card);
      }
    });
  }

  hide() {
    this.container.classList.add('hidden');
  }
}
