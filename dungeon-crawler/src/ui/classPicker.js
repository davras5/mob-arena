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
        const resourceName = cls.resourceType ? cls.resourceType.charAt(0).toUpperCase() + cls.resourceType.slice(1) : '';

        // Stat bars using statBars config (1-5 scale) or computed from base stats
        const bars = cls.statBars || {};
        const hpPct = (bars.hp || Math.round((stats.maxHP / 140) * 5)) * 20;
        const dmgPct = (bars.damage || Math.round((stats.damage / 22) * 5)) * 20;
        const spdPct = (bars.speed || Math.round((stats.speed / 140) * 5)) * 20;
        const defPct = (bars.defense || 2) * 20;

        card.innerHTML = `
          <div class="class-icon" style="color:${cls.color}">${cls.icon}</div>
          <div class="class-name" style="color:${cls.color}">${cls.name}</div>
          <div class="class-desc">${cls.description}</div>
          <div class="class-stats">
            <div class="class-stat-row">
              <span class="stat-label">HP</span>
              <div class="stat-bar"><div class="stat-fill" style="width:${hpPct}%;background:${cls.color}"></div></div>
            </div>
            <div class="class-stat-row">
              <span class="stat-label">DMG</span>
              <div class="stat-bar"><div class="stat-fill" style="width:${dmgPct}%;background:${cls.color}"></div></div>
            </div>
            <div class="class-stat-row">
              <span class="stat-label">SPD</span>
              <div class="stat-bar"><div class="stat-fill" style="width:${spdPct}%;background:${cls.color}"></div></div>
            </div>
            <div class="class-stat-row">
              <span class="stat-label">DEF</span>
              <div class="stat-bar"><div class="stat-fill" style="width:${defPct}%;background:${cls.color}"></div></div>
            </div>
          </div>
          <div class="class-ability" style="opacity:0.7">Resource: ${resourceName}</div>
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
