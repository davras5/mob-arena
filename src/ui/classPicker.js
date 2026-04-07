import { Tooltip } from './tooltip.js';

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
        const resourceDescs = {
          rage: '(builds on hit)',
          mana: '(regenerates)',
          stamina: '(fast regen)',
        };
        const resourceDescShort = resourceDescs[cls.resourceType] || '';

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
          ${resourceDescShort ? `<div class="class-ability" style="opacity:0.5;font-style:italic;font-size:11px">${resourceDescShort}</div>` : ''}
        `;

        Tooltip.attach(card, () => {
          const stats = cls.baseStats || {};
          const resourceDescsFull = {
            rage: 'Builds on hit, spent on skills',
            mana: 'Regenerates over time',
            stamina: 'Regenerates fast, paused after use',
          };
          const resDesc = resourceDescsFull[cls.resourceType] || '';
          return `<div style="color:${cls.color};font-weight:bold;font-size:14px;margin-bottom:6px">${cls.name}</div>` +
                 `<div style="color:#a89c80;margin-bottom:8px;font-size:11px">${cls.description}</div>` +
                 `<div style="color:#e8d3a8;font-size:12px;line-height:1.6">` +
                 `HP: <b>${stats.maxHP}</b><br>` +
                 `Damage: <b>${stats.damage}</b><br>` +
                 `Speed: <b>${stats.speed}</b><br>` +
                 `Attack: <b>${(1/stats.attackCooldown).toFixed(1)}/s</b><br>` +
                 `Resource: <b style="color:#c9a84c">${cls.resourceType.charAt(0).toUpperCase() + cls.resourceType.slice(1)}</b>` +
                 `</div>` +
                 (resDesc ? `<div style="color:#888;font-size:10px;margin-top:6px;font-style:italic">${resDesc}</div>` : '');
        });

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
