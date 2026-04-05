export class HUD {
  constructor() {
    this.hpBar = document.getElementById('hp-bar');
    this.hpText = document.getElementById('hp-text');
    this.waveCounter = document.getElementById('wave-counter');
    this.bossContainer = document.getElementById('boss-hp-container');
    this.bossName = document.getElementById('boss-name');
    this.bossHPBar = document.getElementById('boss-hp-bar');
    this.abilityIcons = document.getElementById('ability-icons');
    this.countdown = document.getElementById('wave-countdown');
    this.enemyCounter = document.getElementById('enemy-counter');
    this.xpBar = document.getElementById('xp-bar');
    this.xpText = document.getElementById('xp-text');
    this.scoreDisplay = document.getElementById('score-display');
  }

  updateHP(hp, maxHP) {
    const pct = Math.max(0, hp / maxHP * 100);
    this.hpBar.style.width = pct + '%';
    this.hpText.textContent = `${Math.ceil(hp)} / ${maxHP}`;
  }

  updateXP(xp, xpToNext, level) {
    const pct = Math.max(0, xp / xpToNext * 100);
    this.xpBar.style.width = pct + '%';
    this.xpText.textContent = `Lv.${level}`;
  }

  updateWave(wave) {
    this.waveCounter.textContent = `Wave ${wave}`;
  }

  showBossHP(name, hp, maxHP) {
    this.bossContainer.classList.remove('hidden');
    this.bossName.textContent = name;
    const pct = Math.max(0, hp / maxHP * 100);
    this.bossHPBar.style.setProperty('--boss-hp', pct + '%');
    // Use pseudo-element width or inline
    this.bossHPBar.innerHTML = `<div style="width:${pct}%;height:100%;background:linear-gradient(to right,#c0392b,#e74c3c);border-radius:5px;transition:width 0.2s"></div>`;
  }

  hideBossHP() {
    this.bossContainer.classList.add('hidden');
  }

  updateAbilities(abilities, allAbilityData) {
    this.abilityIcons.innerHTML = '';
    for (const ab of abilities) {
      const data = allAbilityData.find(a => a.id === ab.id);
      if (!data) continue;
      const div = document.createElement('div');
      div.className = 'ability-icon';
      div.innerHTML = `
        <span>${data.icon}</span>
        <div class="level-badge">${ab.level}</div>
      `;
      div.title = `${data.name} Lv.${ab.level}`;
      this.abilityIcons.appendChild(div);
    }
  }

  updateScore(score) {
    this.scoreDisplay.textContent = `Score: ${score.toLocaleString()}`;
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
