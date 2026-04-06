export class HUD {
  constructor(canvas) {
    // Canvas rendering context
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext('2d') : null;

    // Hide old DOM HUD
    const oldHud = document.getElementById('hud');
    if (oldHud) {
      this._oldHudElement = oldHud;
      oldHud.style.display = 'none';
    }

    // Global: stylized thin scrollbar matching game UI (dark + gold)
    if (!document.getElementById('game-scrollbar-style')) {
      const s = document.createElement('style');
      s.id = 'game-scrollbar-style';
      s.textContent = `
        *{scrollbar-width:thin;scrollbar-color:rgba(160,140,100,0.4) rgba(20,18,15,0.3)}
        *::-webkit-scrollbar{width:6px;height:6px}
        *::-webkit-scrollbar-track{background:rgba(20,18,15,0.3);border-radius:3px}
        *::-webkit-scrollbar-thumb{background:rgba(160,140,100,0.4);border-radius:3px}
        *::-webkit-scrollbar-thumb:hover{background:rgba(200,180,120,0.6)}
      `;
      document.head.appendChild(s);
    }

    // Keep DOM references for fallback
    this.bossContainer = document.getElementById('boss-hp-container');
    this.countdown = document.getElementById('wave-countdown');

    // --- Internal state (populated by API methods, drawn by render()) ---
    this._hp = 0;
    this._maxHP = 1;
    this._resource = 0;
    this._maxResource = 1;
    this._resourceColor = '#3498db';
    this._resourceName = 'Mana';
    this._resourceGradient = ['#00008b', '#4169e1'];

    this._xp = 0;
    this._xpToNext = 1;
    this._level = 1;

    this._gold = 0;
    this._floorName = '';
    this._levelName = '';
    this._enemyAlive = 0;
    this._enemyTotal = 0;

    this._leftSkill = null;
    this._rightSkill = null;

    this._hotbar = [null, null, null, null];

    this._statusEffects = [];

    this._bossHP = 0;
    this._bossMaxHP = 0;
    this._bossName = '';
    this._bossPhase2 = false;
    this._showBoss = false;

    this._countdownValue = 0;
    this._showCountdown = false;

    // Animation state
    this._pulseTime = 0;
    this._lowHpFlashTime = 0;
    this._noResourceFlashLeft = 0;
    this._noResourceFlashRight = 0;

    // Globe liquid animation
    this._hpGlobeWaveOffset = 0;
    this._resGlobeWaveOffset = Math.PI; // offset so they don't sync

    // Clickable panel buttons (HTML overlay on top of canvas)
    this.onPanelClick = null; // set by game.js: (panelName) => {}
    this._panelButtons = this._createPanelButtons();

    // Drop zones for drag-and-drop from skill book / inventory windows
    this._createDropZones();

    // Hide HUD overlays initially (shown when game enters PLAYING/BASE_CAMP)
    this.setVisible(false);
  }

  setVisible(visible) {
    const display = visible ? '' : 'none';
    if (this._panelButtons) this._panelButtons.style.display = display;
    if (this._dropContainer) this._dropContainer.style.display = display;
  }

  _createPanelButtons() {
    const container = document.createElement('div');
    container.id = 'hud-panel-buttons';
    Object.assign(container.style, {
      position: 'fixed', bottom: '28px', left: '50%', transform: 'translateX(-50%)',
      display: 'flex', gap: '6px', zIndex: '100', pointerEvents: 'auto',
    });

    const buttons = [
      { key: 'C', label: 'Character', panel: 'character' },
      { key: 'K', label: 'Skills', panel: 'skillBook' },
      { key: 'I', label: 'Inventory', panel: 'inventory' },
    ];

    for (const b of buttons) {
      const btn = document.createElement('button');
      btn.textContent = b.key;
      btn.title = `${b.label} (${b.key})`;
      Object.assign(btn.style, {
        width: '32px', height: '26px', background: 'rgba(60, 55, 45, 0.7)',
        border: '1px solid rgba(180, 170, 130, 0.4)', borderRadius: '3px',
        color: 'rgba(200, 190, 170, 0.8)', fontSize: '12px', fontWeight: 'bold',
        cursor: 'pointer', fontFamily: '"Segoe UI", Arial, sans-serif',
        transition: 'background 0.15s, color 0.15s',
      });
      btn.addEventListener('mouseenter', () => {
        btn.style.background = 'rgba(100, 90, 70, 0.8)';
        btn.style.color = '#e8d8b0';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = 'rgba(60, 55, 45, 0.7)';
        btn.style.color = 'rgba(200, 190, 170, 0.8)';
      });
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.onPanelClick) this.onPanelClick(b.panel);
      });
      container.appendChild(btn);
    }

    document.body.appendChild(container);
    return container;
  }

  _createDropZones() {
    // Invisible HTML drop targets over the canvas-rendered HUD slots
    // Positioned in render() to match actual slot positions
    this.onSkillDrop = null;   // (skillId, slot) => {} — set by game.js
    this.onHotbarDrop = null;  // (itemId, slot) => {} — set by game.js

    const dropContainer = document.createElement('div');
    dropContainer.id = 'hud-drop-zones';
    Object.assign(dropContainer.style, {
      position: 'fixed', bottom: '0', left: '0', right: '0',
      height: '120px', pointerEvents: 'none', zIndex: '99',
    });

    // Skill slots (LMB, RMB)
    this._skillDropZones = [];
    for (const slotName of ['left', 'right']) {
      const zone = document.createElement('div');
      Object.assign(zone.style, {
        position: 'absolute', width: '48px', height: '48px',
        pointerEvents: 'auto', borderRadius: '4px',
      });
      zone.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; zone.style.background = 'rgba(200, 180, 100, 0.3)'; zone.style.border = '2px solid #c9a84c'; });
      zone.addEventListener('dragleave', () => { zone.style.background = ''; zone.style.border = ''; });
      zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.style.background = ''; zone.style.border = '';
        try {
          const data = JSON.parse(e.dataTransfer.getData('application/skill'));
          if (data && data.skillId && this.onSkillDrop) this.onSkillDrop(data.skillId, slotName);
        } catch {}
      });
      dropContainer.appendChild(zone);
      this._skillDropZones.push({ el: zone, slot: slotName });
    }

    // Hotbar slots (1-4)
    this._hotbarDropZones = [];
    for (let i = 0; i < 4; i++) {
      const zone = document.createElement('div');
      Object.assign(zone.style, {
        position: 'absolute', width: '36px', height: '36px',
        pointerEvents: 'auto', borderRadius: '3px',
      });
      zone.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; zone.style.background = 'rgba(200, 180, 100, 0.3)'; zone.style.border = '2px solid #c9a84c'; });
      zone.addEventListener('dragleave', () => { zone.style.background = ''; zone.style.border = ''; });
      zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.style.background = ''; zone.style.border = '';
        try {
          const data = JSON.parse(e.dataTransfer.getData('application/item'));
          if (data && data.itemId && this.onHotbarDrop) this.onHotbarDrop(data.itemId, i);
        } catch {}
      });
      dropContainer.appendChild(zone);
      this._hotbarDropZones.push({ el: zone, index: i });
    }

    document.body.appendChild(dropContainer);
    this._dropContainer = dropContainer;
  }

  // ========================
  // Backward-compatible API
  // ========================

  updateHP(hp, maxHP) {
    this._hp = hp;
    this._maxHP = maxHP;
  }

  updateResource(current, max, color, name) {
    this._resource = current;
    this._maxResource = max;
    if (color) this._resourceColor = color;
    if (name) this._resourceName = name;
  }

  setResourceColor(gradient) {
    if (gradient) this._resourceGradient = gradient;
  }

  updateXP(xp, xpToNext, level) {
    this._xp = xp;
    this._xpToNext = xpToNext;
    this._level = level;
  }

  updateGold(gold) {
    this._gold = gold;
  }

  updateSkillSlots(leftSkill, rightSkill) {
    this._leftSkill = leftSkill;
    this._rightSkill = rightSkill;
  }

  updateWave(wave) {
    this._floorName = `Floor ${wave}`;
  }

  showBossHP(name, hp, maxHP) {
    this._bossName = name;
    this._bossHP = hp;
    this._bossMaxHP = maxHP;
    this._showBoss = true;
  }

  hideBossHP() {
    this._showBoss = false;
    this._bossHP = 0;
  }

  updateLevelName(name) {
    this._levelName = name || '';
  }

  updateScore() { /* no-op */ }

  updateEnemyCount(alive, total) {
    this._enemyAlive = alive;
    this._enemyTotal = total;
  }

  showCountdown(seconds) {
    this._countdownValue = Math.ceil(seconds);
    this._showCountdown = true;
  }

  hideCountdown() {
    this._showCountdown = false;
  }

  updateAbilities() { /* no-op in canvas HUD */ }

  // New API methods
  setStatusEffects(effects) {
    this._statusEffects = effects || [];
  }

  setHotbar(hotbarItems) {
    this._hotbar = hotbarItems || [null, null, null, null];
  }

  setSkillCooldowns(leftCd, rightCd) {
    if (this._leftSkill) {
      this._leftSkill.cooldownRemaining = leftCd?.remaining ?? 0;
      this._leftSkill.cooldownTotal = leftCd?.total ?? 1;
    }
    if (this._rightSkill) {
      this._rightSkill.cooldownRemaining = rightCd?.remaining ?? 0;
      this._rightSkill.cooldownTotal = rightCd?.total ?? 1;
    }
  }

  // ========================
  // Main render method
  // ========================

  render(state) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const W = state?.canvasWidth || this.canvas.width;
    const H = state?.canvasHeight || this.canvas.height;

    // Apply state if provided (overrides stored values)
    if (state) {
      if (state.hp !== undefined) { this._hp = state.hp; this._maxHP = state.maxHP; }
      if (state.resource !== undefined) { this._resource = state.resource; this._maxResource = state.maxResource; }
      if (state.resourceColor) this._resourceColor = state.resourceColor;
      if (state.resourceName) this._resourceName = state.resourceName;
      if (state.resourceGradient) this._resourceGradient = state.resourceGradient;
      if (state.xp !== undefined) { this._xp = state.xp; this._xpToNext = state.xpToNext; this._level = state.level; }
      if (state.gold !== undefined) this._gold = state.gold;
      if (state.floorName) this._floorName = state.floorName;
      if (state.leftSkill) this._leftSkill = state.leftSkill;
      if (state.rightSkill) this._rightSkill = state.rightSkill;
      if (state.hotbar) this._hotbar = state.hotbar;
      if (state.statusEffects) this._statusEffects = state.statusEffects;
      if (state.bossHP > 0) {
        this._bossHP = state.bossHP;
        this._bossMaxHP = state.bossMaxHP;
        this._bossName = state.bossName;
        this._bossPhase2 = state.bossPhase2;
        this._showBoss = true;
      }
    }

    // Animation timing
    const now = performance.now() / 1000;
    this._pulseTime = now;
    this._hpGlobeWaveOffset += 0.03;
    this._resGlobeWaveOffset += 0.025;

    // --- Layout calculations ---
    const barHeight = Math.max(80, H * 0.15);
    const barY = H - barHeight;
    const globeDiameter = Math.max(60, Math.round(H * 0.08 * 2));
    const globeRadius = globeDiameter / 2;
    const globePadding = 12;
    const xpBarHeight = 8;

    // Save context state
    ctx.save();

    // ---- Bottom action bar background ----
    ctx.fillStyle = 'rgba(10, 8, 6, 0.82)';
    ctx.fillRect(0, barY, W, barHeight);

    // Top border line (subtle gold)
    ctx.strokeStyle = 'rgba(120, 90, 40, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, barY);
    ctx.lineTo(W, barY);
    ctx.stroke();

    // Inner highlight
    ctx.strokeStyle = 'rgba(180, 150, 80, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, barY + 2);
    ctx.lineTo(W, barY + 2);
    ctx.stroke();

    // ---- HP Globe (bottom-left) ----
    const hpGlobeX = globePadding + globeRadius + 8;
    const hpGlobeY = barY + barHeight / 2 - xpBarHeight / 2;
    this._drawGlobe(ctx, hpGlobeX, hpGlobeY, globeRadius,
      this._hp, this._maxHP,
      '#1a0000', ['#8b0000', '#cc0000'],
      this._hpGlobeWaveOffset,
      this._hp / this._maxHP < 0.25
    );
    // HP text
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.max(10, globeRadius * 0.3)}px "Segoe UI", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 4;
    ctx.fillText(`${Math.ceil(this._hp)}/${Math.ceil(this._maxHP)}`, hpGlobeX, hpGlobeY + 2);
    ctx.shadowBlur = 0;

    // ---- Resource Globe (bottom-right) ----
    const resGlobeX = W - globePadding - globeRadius - 8;
    const resGlobeY = hpGlobeY;
    const resGrad = this._resourceGradient || ['#00008b', '#4169e1'];
    const resBgColor = this._darkenColor(resGrad[0], 0.3);
    this._drawGlobe(ctx, resGlobeX, resGlobeY, globeRadius,
      this._resource, this._maxResource,
      resBgColor, resGrad,
      this._resGlobeWaveOffset,
      false
    );
    // Resource text
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.max(10, globeRadius * 0.3)}px "Segoe UI", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 4;
    ctx.fillText(`${Math.ceil(this._resource)}/${Math.ceil(this._maxResource)}`, resGlobeX, resGlobeY + 2);
    ctx.shadowBlur = 0;

    // ---- Center area layout ----
    const centerX = W / 2;
    const centerY = barY + (barHeight - xpBarHeight) / 2;

    // Potion hotbar (center-left)
    const potionSize = Math.max(28, Math.round(barHeight * 0.38));
    const potionGap = 4;
    const potionTotalW = 4 * potionSize + 3 * potionGap;
    const hotkeysWidth = 80;
    const skillSize = Math.max(36, Math.round(barHeight * 0.48));
    const skillGap = 6;
    const skillTotalW = 2 * skillSize + skillGap;

    // Total center content width
    const totalContentW = potionTotalW + hotkeysWidth + skillTotalW;
    const contentStartX = centerX - totalContentW / 2;

    const potionStartX = contentStartX;
    const potionY = centerY - potionSize / 2;

    for (let i = 0; i < 4; i++) {
      const x = potionStartX + i * (potionSize + potionGap);
      this._drawHotbarSlot(ctx, x, potionY, potionSize, this._hotbar[i], i + 1);
    }

    // Hotkey labels [C] [K] [I]
    const hotkeyX = potionStartX + potionTotalW + hotkeysWidth / 2;
    ctx.fillStyle = 'rgba(180, 170, 150, 0.3)';
    ctx.font = `${Math.max(9, potionSize * 0.28)}px "Segoe UI", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const labels = ['C', 'K', 'I'];
    const labelSpacing = 22;
    for (let i = 0; i < labels.length; i++) {
      const lx = hotkeyX + (i - 1) * labelSpacing;
      // Bracket background
      ctx.fillStyle = 'rgba(60, 55, 45, 0.5)';
      const bw = 18;
      const bh = 16;
      ctx.fillRect(lx - bw / 2, centerY - bh / 2, bw, bh);
      ctx.strokeStyle = 'rgba(120, 110, 80, 0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(lx - bw / 2, centerY - bh / 2, bw, bh);
      ctx.fillStyle = 'rgba(180, 170, 150, 0.4)';
      ctx.fillText(labels[i], lx, centerY);
    }

    // Skill slots (center-right)
    const skillStartX = potionStartX + potionTotalW + hotkeysWidth;
    const skillY = centerY - skillSize / 2;

    this._drawSkillSlot(ctx, skillStartX, skillY, skillSize, this._leftSkill, 'LMB');
    this._drawSkillSlot(ctx, skillStartX + skillSize + skillGap, skillY, skillSize, this._rightSkill, 'RMB');

    // ---- XP Bar (very bottom) ----
    const xpY = H - xpBarHeight;
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, xpY, W, xpBarHeight);
    const xpPct = this._xpToNext > 0 ? Math.max(0, Math.min(1, this._xp / this._xpToNext)) : 0;
    if (xpPct > 0) {
      const xpGrad = ctx.createLinearGradient(0, xpY, W * xpPct, xpY);
      xpGrad.addColorStop(0, '#4a0080');
      xpGrad.addColorStop(0.5, '#6a3dbf');
      xpGrad.addColorStop(1, '#4488ee');
      ctx.fillStyle = xpGrad;
      ctx.fillRect(0, xpY, W * xpPct, xpBarHeight);
    }
    // Subtle top border on XP bar
    ctx.strokeStyle = 'rgba(100, 70, 180, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, xpY);
    ctx.lineTo(W, xpY);
    ctx.stroke();

    // ---- Status Effects (above HP globe) ----
    if (this._statusEffects.length > 0) {
      this._drawStatusEffects(ctx, hpGlobeX - globeRadius, barY - 24, now);
    }

    // ---- Top-right info area ----
    this._drawInfoPanel(ctx, W, 0);

    // ---- Boss HP bar (top-center) ----
    if (this._showBoss && this._bossHP > 0) {
      this._drawBossHP(ctx, W, now);
    }

    // ---- Countdown overlay ----
    if (this._showCountdown && this._countdownValue > 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.font = `bold 72px "Segoe UI", Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = '#000';
      ctx.shadowBlur = 10;
      ctx.fillText(this._countdownValue, W / 2, H / 2 - 40);
      ctx.shadowBlur = 0;
    }

    ctx.restore();

    // Position HTML drop zones to match canvas-rendered slots
    this._positionDropZones(potionStartX, potionY, potionSize, potionGap, skillStartX, skillY, skillSize, skillGap);
  }

  _positionDropZones(potionStartX, potionY, potionSize, potionGap, skillStartX, skillY, skillSize, skillGap) {
    if (!this._hotbarDropZones || !this._skillDropZones) return;
    const canvas = this.canvas;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / canvas.width;
    const scaleY = rect.height / canvas.height;

    for (let i = 0; i < 4; i++) {
      const x = potionStartX + i * (potionSize + potionGap);
      const zone = this._hotbarDropZones[i].el;
      zone.style.left = `${rect.left + x * scaleX}px`;
      zone.style.bottom = `${window.innerHeight - rect.top - (potionY + potionSize) * scaleY}px`;
      zone.style.width = `${potionSize * scaleX}px`;
      zone.style.height = `${potionSize * scaleY}px`;
    }

    const slots = [
      { x: skillStartX, zone: this._skillDropZones[0] },
      { x: skillStartX + skillSize + skillGap, zone: this._skillDropZones[1] },
    ];
    for (const s of slots) {
      s.zone.el.style.left = `${rect.left + s.x * scaleX}px`;
      s.zone.el.style.bottom = `${window.innerHeight - rect.top - (skillY + skillSize) * scaleY}px`;
      s.zone.el.style.width = `${skillSize * scaleX}px`;
      s.zone.el.style.height = `${skillSize * scaleY}px`;
    }
  }

  // ========================
  // Globe rendering
  // ========================

  _drawGlobe(ctx, cx, cy, radius, value, maxValue, bgColor, gradientColors, waveOffset, pulseWhenLow) {
    const pct = maxValue > 0 ? Math.max(0, Math.min(1, value / maxValue)) : 0;

    ctx.save();

    // Outer decorative ring
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 4, 0, Math.PI * 2);
    const ringGrad = ctx.createRadialGradient(cx, cy, radius - 2, cx, cy, radius + 5);
    ringGrad.addColorStop(0, 'rgba(80, 65, 35, 0.8)');
    ringGrad.addColorStop(0.5, 'rgba(140, 115, 55, 0.9)');
    ringGrad.addColorStop(1, 'rgba(60, 45, 20, 0.6)');
    ctx.fillStyle = ringGrad;
    ctx.fill();

    // Low HP pulse glow
    if (pulseWhenLow) {
      const pulseAlpha = 0.3 + 0.3 * Math.sin(this._pulseTime * 5);
      ctx.shadowColor = `rgba(255, 0, 0, ${pulseAlpha})`;
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 0, 0, 0.01)';
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Clip to circle
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();

    // Dark background
    const bgGrad = ctx.createRadialGradient(cx, cy - radius * 0.3, radius * 0.1, cx, cy, radius);
    bgGrad.addColorStop(0, this._lightenColor(bgColor, 1.4));
    bgGrad.addColorStop(1, bgColor);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

    // Liquid fill from bottom
    if (pct > 0) {
      const fillTop = cy + radius - (pct * radius * 2);

      // Wavy surface
      ctx.beginPath();
      const waveAmplitude = Math.max(1.5, radius * 0.04);
      const waveFreq = 3;
      ctx.moveTo(cx - radius, cy + radius);
      ctx.lineTo(cx - radius, fillTop);
      for (let x = cx - radius; x <= cx + radius; x += 2) {
        const relX = (x - (cx - radius)) / (radius * 2);
        const wave = Math.sin(relX * Math.PI * waveFreq + waveOffset) * waveAmplitude;
        const wave2 = Math.sin(relX * Math.PI * (waveFreq * 1.7) + waveOffset * 1.3) * waveAmplitude * 0.5;
        ctx.lineTo(x, fillTop + wave + wave2);
      }
      ctx.lineTo(cx + radius, cy + radius);
      ctx.closePath();

      // Liquid gradient
      const liqGrad = ctx.createLinearGradient(cx, fillTop, cx, cy + radius);
      liqGrad.addColorStop(0, gradientColors[1]);
      liqGrad.addColorStop(0.4, gradientColors[1]);
      liqGrad.addColorStop(1, gradientColors[0]);
      ctx.fillStyle = liqGrad;
      ctx.fill();

      // Lighter highlight band near surface
      ctx.beginPath();
      ctx.moveTo(cx - radius, fillTop + waveAmplitude + 2);
      for (let x = cx - radius; x <= cx + radius; x += 2) {
        const relX = (x - (cx - radius)) / (radius * 2);
        const wave = Math.sin(relX * Math.PI * waveFreq + waveOffset) * waveAmplitude;
        const wave2 = Math.sin(relX * Math.PI * (waveFreq * 1.7) + waveOffset * 1.3) * waveAmplitude * 0.5;
        ctx.lineTo(x, fillTop + wave + wave2);
      }
      for (let x = cx + radius; x >= cx - radius; x -= 2) {
        const relX = (x - (cx - radius)) / (radius * 2);
        const wave = Math.sin(relX * Math.PI * waveFreq + waveOffset) * waveAmplitude;
        const wave2 = Math.sin(relX * Math.PI * (waveFreq * 1.7) + waveOffset * 1.3) * waveAmplitude * 0.5;
        ctx.lineTo(x, fillTop + wave + wave2 + 4);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.fill();
    }

    // Glass highlight (specular reflection)
    const hlGrad = ctx.createRadialGradient(
      cx - radius * 0.3, cy - radius * 0.35, radius * 0.05,
      cx - radius * 0.1, cy - radius * 0.1, radius * 0.8
    );
    hlGrad.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
    hlGrad.addColorStop(0.4, 'rgba(255, 255, 255, 0.06)');
    hlGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = hlGrad;
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

    // Bottom shadow inside globe
    const btmGrad = ctx.createLinearGradient(cx, cy + radius * 0.5, cx, cy + radius);
    btmGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    btmGrad.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
    ctx.fillStyle = btmGrad;
    ctx.fillRect(cx - radius, cy + radius * 0.5, radius * 2, radius * 0.5);

    ctx.restore();

    // Outer ring border (crisp)
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 1, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(90, 75, 40, 0.7)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Inner edge shadow
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 1, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // ========================
  // Hotbar slot rendering
  // ========================

  _drawHotbarSlot(ctx, x, y, size, item, keyNum) {
    // Slot background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(x, y, size, size);

    // Border
    ctx.strokeStyle = 'rgba(100, 85, 50, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);

    // Inner bevel
    ctx.strokeStyle = 'rgba(60, 50, 30, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 2, y + 2, size - 4, size - 4);

    if (item) {
      // Icon (emoji)
      if (item.icon) {
        ctx.font = `${Math.round(size * 0.5)}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff';
        ctx.fillText(item.icon, x + size / 2, y + size / 2);
      }

      // Stack count (bottom-right)
      if (item.stackCount && item.stackCount > 0) {
        ctx.font = `bold ${Math.max(8, size * 0.28)}px "Segoe UI", Arial, sans-serif`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 3;
        ctx.fillText(item.stackCount, x + size - 3, y + size - 2);
        ctx.shadowBlur = 0;
      }

      // Cooldown clock-wipe overlay
      if (item.cooldownPct && item.cooldownPct > 0) {
        this._drawClockWipe(ctx, x, y, size, item.cooldownPct);
      }
    }

    // Key number label (top-left)
    ctx.font = `${Math.max(8, size * 0.26)}px "Segoe UI", Arial, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(160, 150, 130, 0.6)';
    ctx.fillText(keyNum, x + 3, y + 2);
  }

  // ========================
  // Skill slot rendering
  // ========================

  _drawSkillSlot(ctx, x, y, size, skill, label) {
    // Slot background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(x, y, size, size);

    // Border (thicker than potions)
    const hasNoResource = skill && skill._noResourceFlash;
    ctx.strokeStyle = hasNoResource
      ? `rgba(255, 60, 60, ${0.5 + 0.5 * Math.sin(this._pulseTime * 12)})`
      : 'rgba(120, 100, 55, 0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);

    // Inner bevel
    ctx.strokeStyle = 'rgba(70, 60, 35, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 3, y + 3, size - 6, size - 6);

    if (skill) {
      // Skill icon
      if (skill.icon) {
        ctx.font = `${Math.round(size * 0.45)}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff';
        ctx.fillText(skill.icon, x + size / 2, y + size / 2 - 2);
      }

      // Skill name below
      if (skill.name) {
        ctx.font = `${Math.max(7, size * 0.18)}px "Segoe UI", Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = 'rgba(200, 190, 170, 0.7)';
        ctx.fillText(skill.name, x + size / 2, y + size - 2);
      }

      // Cooldown clock-wipe overlay
      if (skill.cooldownRemaining > 0 && skill.cooldownTotal > 0) {
        const cdPct = skill.cooldownRemaining / skill.cooldownTotal;
        this._drawClockWipe(ctx, x, y, size, cdPct);
        // Cooldown seconds text
        ctx.font = `bold ${Math.round(size * 0.35)}px "Segoe UI", Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 4;
        ctx.fillText(Math.ceil(skill.cooldownRemaining), x + size / 2, y + size / 2);
        ctx.shadowBlur = 0;
      }
    }

    // Label above slot (LMB / RMB)
    ctx.font = `bold ${Math.max(8, size * 0.22)}px "Segoe UI", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = 'rgba(180, 170, 140, 0.55)';
    ctx.fillText(label, x + size / 2, y - 3);
  }

  // ========================
  // Clock-wipe cooldown overlay
  // ========================

  _drawClockWipe(ctx, x, y, size, pct) {
    if (pct <= 0) return;
    const cx = x + size / 2;
    const cy = y + size / 2;
    const r = size * 0.7; // enough to cover the slot

    ctx.save();

    // Clip to slot rect
    ctx.beginPath();
    ctx.rect(x, y, size, size);
    ctx.clip();

    // Draw arc sector from 12 o'clock clockwise
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + Math.PI * 2 * pct;
    ctx.arc(cx, cy, r, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fill();

    ctx.restore();
  }

  // ========================
  // Status effects
  // ========================

  _drawStatusEffects(ctx, startX, y, now) {
    const size = 16;
    const gap = 3;

    const colorMap = {
      poison: '#22cc44',
      burning: '#ee8822',
      bleeding: '#cc2222',
      frozen: '#4488ff',
      slowed: '#4488ff',
      weakened: '#8844cc',
    };
    const charMap = {
      poison: 'P',
      burning: 'F',
      bleeding: 'B',
      frozen: 'I',
      slowed: 'S',
      weakened: 'W',
    };

    for (let i = 0; i < this._statusEffects.length; i++) {
      const eff = this._statusEffects[i];
      const ex = startX + i * (size + gap);
      const color = eff.color || colorMap[eff.type] || '#aaa';
      const char = charMap[eff.type] || '?';
      const remaining = eff.remainingDuration || 0;

      // Pulse when almost expired
      let alpha = 1;
      if (remaining < 1) {
        alpha = 0.4 + 0.6 * Math.abs(Math.sin(now * 8));
      }

      ctx.globalAlpha = alpha;

      // Background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(ex, y, size, size);

      // Color fill
      ctx.fillStyle = color;
      ctx.fillRect(ex + 1, y + 1, size - 2, size - 2);

      // Character
      ctx.fillStyle = '#fff';
      ctx.font = `bold 9px "Segoe UI", Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(char, ex + size / 2, y + size / 2 - 1);

      // Duration below
      if (remaining > 0) {
        ctx.font = `7px "Segoe UI", Arial, sans-serif`;
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#ddd';
        ctx.fillText(Math.ceil(remaining) + 's', ex + size / 2, y + size + 1);
      }

      ctx.globalAlpha = 1;
    }
  }

  // ========================
  // Top-right info panel
  // ========================

  _drawInfoPanel(ctx, canvasW) {
    const name = this._levelName || this._floorName || '';
    const padding = 10;
    const lineH = 18;
    const lines = [];

    if (name) lines.push(name);
    lines.push(`Lv. ${this._level}`);
    lines.push(`Gold: ${this._gold}`);
    if (this._enemyTotal > 0) {
      lines.push(`Enemies: ${this._enemyAlive}/${this._enemyTotal}`);
    }

    const boxW = 170;
    const boxH = lines.length * lineH + padding * 2;
    const boxX = canvasW - boxW - 10;
    const boxY = 10;

    // Background
    ctx.fillStyle = 'rgba(10, 8, 6, 0.7)';
    this._roundRect(ctx, boxX, boxY, boxW, boxH, 4);
    ctx.fill();

    ctx.strokeStyle = 'rgba(120, 100, 55, 0.4)';
    ctx.lineWidth = 1;
    this._roundRect(ctx, boxX, boxY, boxW, boxH, 4);
    ctx.stroke();

    ctx.font = `13px "Segoe UI", Arial, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    for (let i = 0; i < lines.length; i++) {
      const ly = boxY + padding + i * lineH;
      if (i === 0 && name) {
        ctx.fillStyle = '#e8d8a0';
        ctx.font = `bold 13px "Segoe UI", Arial, sans-serif`;
      } else if (lines[i].startsWith('Gold')) {
        ctx.fillStyle = '#ffd700';
        ctx.font = `13px "Segoe UI", Arial, sans-serif`;
      } else {
        ctx.fillStyle = '#c8c0b0';
        ctx.font = `13px "Segoe UI", Arial, sans-serif`;
      }
      ctx.fillText(lines[i], boxX + padding, ly);
    }
  }

  // ========================
  // Boss HP bar
  // ========================

  _drawBossHP(ctx, canvasW, now) {
    const barW = Math.round(canvasW * 0.4);
    const barH = 20;
    const barX = (canvasW - barW) / 2;
    const barY = 12;
    const pct = this._bossMaxHP > 0 ? Math.max(0, Math.min(1, this._bossHP / this._bossMaxHP)) : 0;

    // Background
    ctx.fillStyle = 'rgba(10, 8, 6, 0.8)';
    this._roundRect(ctx, barX - 2, barY - 2, barW + 4, barH + 4, 4);
    ctx.fill();

    ctx.strokeStyle = 'rgba(120, 100, 55, 0.5)';
    ctx.lineWidth = 1.5;
    this._roundRect(ctx, barX - 2, barY - 2, barW + 4, barH + 4, 4);
    ctx.stroke();

    // Dark bar interior
    ctx.fillStyle = '#1a0000';
    this._roundRect(ctx, barX, barY, barW, barH, 3);
    ctx.fill();

    // HP fill
    if (pct > 0) {
      const fillColor1 = this._bossPhase2 ? '#cc6600' : '#c0392b';
      const fillColor2 = this._bossPhase2 ? '#ff8800' : '#e74c3c';
      const grad = ctx.createLinearGradient(barX, barY, barX + barW * pct, barY);
      grad.addColorStop(0, fillColor1);
      grad.addColorStop(1, fillColor2);
      ctx.fillStyle = grad;
      this._roundRect(ctx, barX, barY, barW * pct, barH, 3);
      ctx.fill();
    }

    // Boss name above
    ctx.font = `bold 13px "Segoe UI", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = this._bossPhase2 ? '#ffaa44' : '#e8d0a0';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 3;
    ctx.fillText(this._bossName || 'Boss', canvasW / 2, barY - 4);
    ctx.shadowBlur = 0;

    // HP text inside bar
    ctx.font = `bold 11px "Segoe UI", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 2;
    ctx.fillText(
      `${Math.ceil(this._bossHP)} / ${Math.ceil(this._bossMaxHP)}`,
      canvasW / 2, barY + barH / 2
    );
    ctx.shadowBlur = 0;
  }

  // ========================
  // Utility helpers
  // ========================

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  _parseColor(color) {
    if (!color || typeof color !== 'string') return [30, 30, 30];
    // Handle hex: #rrggbb
    if (color[0] === '#' && color.length >= 7) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      return [isNaN(r) ? 30 : r, isNaN(g) ? 30 : g, isNaN(b) ? 30 : b];
    }
    // Handle rgb(r, g, b)
    const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
    return [30, 30, 30];
  }

  _darkenColor(hex, factor) {
    const [r, g, b] = this._parseColor(hex);
    return `rgb(${Math.round(r * factor)}, ${Math.round(g * factor)}, ${Math.round(b * factor)})`;
  }

  _lightenColor(hex, factor) {
    const [r, g, b] = this._parseColor(hex);
    return `rgb(${Math.min(255, Math.round(r * factor))}, ${Math.min(255, Math.round(g * factor))}, ${Math.min(255, Math.round(b * factor))})`;
  }
}
