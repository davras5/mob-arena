import { UI_THEME } from './uiTheme.js';
import { Tooltip } from './tooltip.js';

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
    this._displayHP = 0; // smoothly lerped value for animation
    this._resource = 0;
    this._maxResource = 1;
    this._displayResource = 0; // smoothly lerped value for animation
    this._displayXP = 0; // smoothly lerped XP value
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

    // === v3 spec-tree HUD state ===
    // Unified 7-slot action bar. Each entry is null OR
    //   { binding: { type, id }, icon, name, label,
    //     resourceCost, stackCount, cooldownRemaining, cooldownTotal,
    //     specColor, untrained, lastReadyFlash }
    // Slots are keyed by canonical slot id (matches skillManager).
    this._slots = {
      leftClick:  null,
      rightClick: null,
      slot1: null, slot2: null, slot3: null, slot4: null, slot5: null,
    };

    // Just-ready tick animations: map of slotId → time of last flash (seconds)
    this._readyFlashUntil = {};

    // Click-while-on-cooldown red pulse: map of slotId → expiry time
    this._errorFlashUntil = {};

    // No-resource red pulse: map of slotId → expiry time
    this._noResourceFlashUntil = {};

    this._statusEffects = [];
    this._statusEffectTooltipEls = [];

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
      Tooltip.attach(btn, () => {
        const labels = {
          character: 'Character (C) — view your stats and attributes',
          skillBook: 'Skill Book (K) — view your skills and assign LMB/RMB',
          inventory: 'Inventory (I) — manage gear and consumables',
        };
        return labels[b.panel] || b.label;
      });
    }

    // Help button (F1)
    const helpBtn = document.createElement('button');
    helpBtn.textContent = '?';
    helpBtn.title = 'Help (F1)';
    Object.assign(helpBtn.style, {
      width: '32px', height: '26px',
      background: 'rgba(60, 55, 45, 0.7)',
      border: '1px solid rgba(180, 170, 130, 0.4)',
      borderRadius: '3px',
      color: 'rgba(200, 190, 170, 0.8)',
      fontSize: '14px',
      fontWeight: 'bold',
      cursor: 'pointer',
      fontFamily: '"Segoe UI", Arial, sans-serif',
      transition: 'background 0.15s, color 0.15s',
      marginLeft: '4px',
    });
    helpBtn.addEventListener('mouseenter', () => { helpBtn.style.background = 'rgba(100, 90, 70, 0.8)'; helpBtn.style.color = '#e8d8b0'; });
    helpBtn.addEventListener('mouseleave', () => { helpBtn.style.background = 'rgba(60, 55, 45, 0.7)'; helpBtn.style.color = 'rgba(200, 190, 170, 0.8)'; });
    helpBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.onPanelClick) this.onPanelClick('help');
    });
    container.appendChild(helpBtn);
    Tooltip.attach(helpBtn, 'Help & Controls (F1)');

    document.body.appendChild(container);
    return container;
  }

  _createDropZones() {
    // Invisible HTML drop targets over the canvas-rendered HUD slots.
    // Positioned in render() to match actual slot positions.
    //
    // Drop callbacks (set by game.js):
    //   onHotbarDrop(payload, slotId) — payload = { type, id } from inventory or skill book
    //   onSlotClick(slotId)           — clicking the slot opens the picker (LMB/RMB only)
    //   onSlotSwapClick(slotId)       — clicking the swap arrow on LMB/RMB
    this.onHotbarDrop = null;
    this.onSlotClick = null;
    this.onSlotSwapClick = null;

    const dropContainer = document.createElement('div');
    dropContainer.id = 'hud-drop-zones';
    Object.assign(dropContainer.style, {
      position: 'fixed', bottom: '0', left: '0', right: '0',
      height: '120px', pointerEvents: 'none', zIndex: '99',
    });

    // One drop zone per slot (LMB, RMB, slot1..slot5)
    this._slotZones = {};
    const slotIds = ['leftClick', 'rightClick', 'slot1', 'slot2', 'slot3', 'slot4', 'slot5'];
    for (const slotId of slotIds) {
      const zone = document.createElement('div');
      Object.assign(zone.style, {
        position: 'absolute', width: '48px', height: '48px',
        pointerEvents: 'auto', borderRadius: '4px', cursor: 'pointer',
      });

      zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        zone.style.background = 'rgba(200, 180, 100, 0.3)';
        zone.style.border = '2px solid #c9a84c';
      });
      zone.addEventListener('dragleave', () => {
        zone.style.background = '';
        zone.style.border = '';
      });
      zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.style.background = '';
        zone.style.border = '';
        // Accept either an attack drop (from skill book) or an item drop (from inventory)
        let payload = null;
        try {
          const a = e.dataTransfer.getData('application/x-attack');
          if (a) payload = JSON.parse(a);
        } catch {}
        if (!payload) {
          try {
            const i = e.dataTransfer.getData('application/x-consumable');
            if (i) payload = JSON.parse(i);
          } catch {}
        }
        // Legacy fallbacks (Phase 4 will sweep these out)
        if (!payload) {
          try {
            const a = e.dataTransfer.getData('application/skill');
            if (a) {
              const d = JSON.parse(a);
              if (d.skillId) payload = { type: 'attack', id: d.skillId };
            }
          } catch {}
        }
        if (!payload) {
          try {
            const i = e.dataTransfer.getData('application/item');
            if (i) {
              const d = JSON.parse(i);
              if (d.itemId) payload = { type: 'consumable', id: d.itemId };
            }
          } catch {}
        }
        if (payload && this.onHotbarDrop) {
          this.onHotbarDrop(payload, slotId);
        }
      });

      // Click on slot — game.js decides what to do (typically: open picker for LMB/RMB,
      // do nothing for keyboard slots since drag-from-inventory is the rebind path).
      zone.addEventListener('click', () => {
        if (this.onSlotClick) this.onSlotClick(slotId);
      });

      dropContainer.appendChild(zone);
      this._slotZones[slotId] = zone;
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

  // === v3 unified action bar API ===
  //
  // Canonical setter — call once per frame from game.js with the resolved
  // state of every slot. The HUD treats `null` slots as empty.
  //
  // Each slot entry shape:
  //   {
  //     binding:          { type: 'attack'|'consumable', id: string },
  //     icon:             string (emoji or character),
  //     name:             string (short display name),
  //     resourceCost:     number (0 = free),
  //     stackCount:       number|null (consumables only; null hides badge),
  //     cooldownRemaining: number,
  //     cooldownTotal:     number,
  //     specColor:        string|null (e.g. '#5a7a95' for Guardian; null for consumables),
  //     untrained:        boolean (attack from a spec the player has 0 points in — shows ⚠),
  //     specMismatchTooltip: string|null,
  //   }
  setSlots(slots) {
    if (!slots) return;
    for (const k of Object.keys(this._slots)) {
      // Detect cooldown finishing this frame so we can ready-flash on the
      // next render call. Only secondaries (cooldownTotal > 1.5s) chirp.
      const next = slots[k] || null;
      const prev = this._slots[k];
      if (prev && next
          && prev.cooldownRemaining > 0
          && (next.cooldownRemaining || 0) <= 0
          && (prev.cooldownTotal || 0) > 1.5) {
        this._readyFlashUntil[k] = (performance.now() / 1000) + 0.15;
      }
      this._slots[k] = next;
    }
  }

  /**
   * Trigger a one-shot red error pulse on a slot — used when the player
   * tried to cast an empty / on-cooldown / no-resource slot. Distinct
   * tooltip messages can be passed by the caller.
   */
  flashSlotError(slotId, kind = 'cooldown') {
    const now = performance.now() / 1000;
    if (kind === 'no_resource') {
      this._noResourceFlashUntil[slotId] = now + 0.4;
    } else {
      this._errorFlashUntil[slotId] = now + 0.25;
    }
  }

  // ---- Backward-compatible shims (Phase 4 sweep will remove these) ----
  updateSkillSlots(leftSkill, rightSkill) {
    // legacy 2-slot API — wrap into new 7-slot shape
    if (leftSkill !== undefined) this._slots.leftClick = leftSkill ? this._wrapLegacySkill(leftSkill) : null;
    if (rightSkill !== undefined) this._slots.rightClick = rightSkill ? this._wrapLegacySkill(rightSkill) : null;
  }

  _wrapLegacySkill(skill) {
    return {
      binding: { type: 'attack', id: skill.id || 'unknown' },
      icon: skill.icon || '?',
      name: skill.name || '',
      resourceCost: skill.resourceCost || 0,
      stackCount: null,
      cooldownRemaining: skill.cooldownRemaining || 0,
      cooldownTotal: skill.cooldownTotal || 0,
      specColor: null,
      untrained: false,
      specMismatchTooltip: null,
    };
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

  // Legacy 4-slot potion hotbar API — wrap into the new 7-slot model.
  // Items become consumable bindings on slot1..slot4. Phase 4 wiring will
  // call setSlots() directly and remove this shim.
  setHotbar(hotbarItems) {
    if (!hotbarItems) return;
    for (let i = 0; i < 4; i++) {
      const item = hotbarItems[i];
      const slotKey = 'slot' + (i + 1);
      if (!item) {
        this._slots[slotKey] = null;
      } else {
        this._slots[slotKey] = {
          binding: { type: 'consumable', id: item.id || item.baseType || 'unknown' },
          icon: item.icon || '?',
          name: item.name || '',
          resourceCost: 0,
          stackCount: item.stackCount || item.count || null,
          cooldownRemaining: item.cooldownRemaining || 0,
          cooldownTotal: item.cooldownTotal || 0,
          specColor: null,
          untrained: false,
          specMismatchTooltip: null,
        };
      }
    }
  }

  setSkillCooldowns(/* leftCd, rightCd */) {
    // No-op shim — cooldowns are now part of setSlots() payloads.
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
      // Legacy fields — game.js may still pass these during the Phase 4 transition
      if (state.leftSkill) this._slots.leftClick = this._wrapLegacySkill(state.leftSkill);
      if (state.rightSkill) this._slots.rightClick = this._wrapLegacySkill(state.rightSkill);
      if (state.hotbar) this.setHotbar(state.hotbar);
      // New canonical field — preferred path
      if (state.slots) this.setSlots(state.slots);
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

    // Smooth lerp HP/resource/XP for fluid animations
    const lerpSpeed = 0.15;
    this._displayHP += (this._hp - this._displayHP) * lerpSpeed;
    this._displayResource += (this._resource - this._displayResource) * lerpSpeed;
    this._displayXP += (this._xp - this._displayXP) * lerpSpeed;
    // Snap if very close
    if (Math.abs(this._displayHP - this._hp) < 0.5) this._displayHP = this._hp;
    if (Math.abs(this._displayResource - this._resource) < 0.5) this._displayResource = this._resource;
    if (Math.abs(this._displayXP - this._xp) < 0.5) this._displayXP = this._xp;

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
      this._displayHP, this._maxHP,
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
      this._displayResource, this._maxResource,
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

    // ---- Unified 7-slot Action Bar (center) ----
    //
    // Layout: [LMB] [RMB] gap [1] [2] [3] [4] [5]
    // LMB/RMB are ~25% larger to anchor as primary combat slots.
    // Stored layout (for drop zone positioning):
    //   this._slotLayout = { slotId: { x, y, size } }
    const centerX = W / 2;
    const centerY = barY + (barHeight - xpBarHeight) / 2;

    const mouseSlotSize = Math.max(40, Math.round(barHeight * 0.50));
    const keySlotSize   = Math.max(32, Math.round(barHeight * 0.40));
    const slotGap   = 5;
    const groupGap  = 14; // visual separator between mouse pair and key row

    const mouseRowW = 2 * mouseSlotSize + slotGap;
    const keyRowW   = 5 * keySlotSize + 4 * slotGap;
    const totalW    = mouseRowW + groupGap + keyRowW;

    const startX = centerX - totalW / 2;
    const mouseY = centerY - mouseSlotSize / 2;
    const keyY   = centerY - keySlotSize / 2;

    this._slotLayout = {};

    // LMB / RMB
    const mouseSlotIds = [
      { id: 'leftClick',  label: 'LMB' },
      { id: 'rightClick', label: 'RMB' },
    ];
    for (let i = 0; i < mouseSlotIds.length; i++) {
      const x = startX + i * (mouseSlotSize + slotGap);
      const cfg = mouseSlotIds[i];
      this._slotLayout[cfg.id] = { x, y: mouseY, size: mouseSlotSize };
      this._drawActionBarSlot(ctx, x, mouseY, mouseSlotSize, this._slots[cfg.id], cfg.label, cfg.id);
    }

    // Keyboard slots 1–5
    const keysStartX = startX + mouseRowW + groupGap;
    for (let i = 0; i < 5; i++) {
      const x = keysStartX + i * (keySlotSize + slotGap);
      const slotId = 'slot' + (i + 1);
      this._slotLayout[slotId] = { x, y: keyY, size: keySlotSize };
      this._drawActionBarSlot(ctx, x, keyY, keySlotSize, this._slots[slotId], String(i + 1), slotId);
    }

    // ---- XP Bar (very bottom) ----
    const xpY = H - xpBarHeight;
    ctx.fillStyle = '#0a0a12';
    ctx.fillRect(0, xpY, W, xpBarHeight);
    const xpPct = this._xpToNext > 0 ? Math.max(0, Math.min(1, this._displayXP / this._xpToNext)) : 0;
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

    // Save indicator toast (top-right area)
    const saveTimer = state?.saveIndicatorTimer || 0;
    if (saveTimer > 0) {
      const fade = saveTimer > 0.3 ? 1 : (saveTimer / 0.3);
      ctx.save();
      ctx.globalAlpha = fade * 0.92;
      ctx.fillStyle = 'rgba(20, 30, 20, 0.85)';
      ctx.strokeStyle = '#27ae60';
      ctx.lineWidth = 1.5;
      const tx = W - 130; const ty = 60;
      ctx.fillRect(tx, ty, 110, 28);
      ctx.strokeRect(tx, ty, 110, 28);
      ctx.fillStyle = '#27ae60';
      ctx.font = 'bold 13px "Segoe UI", Arial, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✓ Saved', tx + 55, ty + 14);
      ctx.restore();
    }

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
    this._positionDropZones();
  }

  _positionDropZones() {
    if (!this._slotZones || !this._slotLayout) return;
    const canvas = this.canvas;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / canvas.width;
    const scaleY = rect.height / canvas.height;

    for (const [slotId, layout] of Object.entries(this._slotLayout)) {
      const zone = this._slotZones[slotId];
      if (!zone) continue;
      zone.style.left = `${rect.left + layout.x * scaleX}px`;
      zone.style.bottom = `${window.innerHeight - rect.top - (layout.y + layout.size) * scaleY}px`;
      zone.style.width = `${layout.size * scaleX}px`;
      zone.style.height = `${layout.size * scaleY}px`;
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
  // Action bar slot rendering (canonical, used for all 7 slots)
  // ========================
  //
  // `slot` shape: see HUD.setSlots() docstring above. `label` is the
  // hotkey label drawn outside the slot ("LMB", "RMB", "1"–"5"). `slotId`
  // is the canonical id used for ready-flash / error-flash lookups.

  _drawActionBarSlot(ctx, x, y, size, slot, label, slotId) {
    const now = this._pulseTime;
    const hasErrorFlash = (this._errorFlashUntil[slotId] || 0) > now;
    const hasNoResourceFlash = (this._noResourceFlashUntil[slotId] || 0) > now;
    const readyFlashActive = (this._readyFlashUntil[slotId] || 0) > now;

    // Slot background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(x, y, size, size);

    // Border — color depends on state
    let borderColor = 'rgba(120, 100, 55, 0.6)';
    let borderWidth = size > 40 ? 2 : 1.5;
    if (hasErrorFlash || hasNoResourceFlash) {
      borderColor = `rgba(255, 60, 60, ${0.55 + 0.45 * Math.sin(now * 14)})`;
      borderWidth = 2;
    } else if (readyFlashActive) {
      const remaining = (this._readyFlashUntil[slotId] - now) / 0.15;
      borderColor = `rgba(255, 215, 80, ${remaining})`;
      borderWidth = 2;
    } else if (slot && slot.specColor) {
      // Tint slot border with the spec color (subtly)
      borderColor = this._withAlpha(slot.specColor, 0.55);
    } else if (!slot) {
      // Empty slot — dotted dark border
      borderColor = 'rgba(80, 70, 50, 0.45)';
    }
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = borderWidth;
    ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);

    // Inner bevel
    ctx.strokeStyle = 'rgba(60, 50, 30, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 2, y + 2, size - 4, size - 4);

    if (slot) {
      const isOnCD = slot.cooldownRemaining > 0 && slot.cooldownTotal > 0;
      const isStackEmpty = slot.binding && slot.binding.type === 'consumable'
        && (slot.stackCount === 0 || slot.stackCount === '0');

      // Icon — desaturated/dimmed when on cooldown or stack empty
      if (slot.icon) {
        ctx.save();
        if (isOnCD || isStackEmpty || slot.untrained) {
          ctx.globalAlpha = isStackEmpty ? 0.35 : 0.55;
        }
        ctx.font = `${Math.round(size * 0.48)}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff';
        ctx.fillText(slot.icon, x + size / 2, y + size / 2 - 1);
        ctx.restore();
      }

      // Stack count (bottom-right) for consumables. "0" still shown so the
      // player knows the slot is bound but empty (auto-refill pending).
      if (slot.binding && slot.binding.type === 'consumable' && slot.stackCount != null) {
        ctx.font = `bold ${Math.max(8, size * 0.26)}px "Segoe UI", Arial, sans-serif`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = isStackEmpty ? '#cc4040' : '#fff';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 3;
        ctx.fillText(slot.stackCount, x + size - 3, y + size - 2);
        ctx.shadowBlur = 0;
      }

      // Resource cost (bottom-left) for attacks with cost > 0
      if (slot.binding && slot.binding.type === 'attack' && slot.resourceCost > 0) {
        ctx.font = `${Math.max(7, size * 0.18)}px "Segoe UI", Arial, sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillStyle = 'rgba(120, 180, 220, 0.85)';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 2;
        ctx.fillText(slot.resourceCost, x + 3, y + size - 2);
        ctx.shadowBlur = 0;
      }

      // Untrained warning (small ⚠ top-right) — attack from a spec the player has 0 points in
      if (slot.untrained) {
        ctx.font = `${Math.max(8, size * 0.22)}px "Segoe UI", Arial, sans-serif`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#ffb830';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 2;
        ctx.fillText('\u26A0', x + size - 3, y + 2);
        ctx.shadowBlur = 0;
      }

      // Cooldown clock-wipe overlay
      if (isOnCD) {
        const cdPct = slot.cooldownRemaining / slot.cooldownTotal;
        this._drawClockWipe(ctx, x, y, size, cdPct);
        // Numeric remaining — ONLY for cooldowns > 1.5s (per WIREFRAMES §3)
        if (slot.cooldownTotal > 1.5) {
          ctx.font = `bold ${Math.round(size * 0.32)}px "Segoe UI", Arial, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = '#fff';
          ctx.shadowColor = '#000';
          ctx.shadowBlur = 4;
          ctx.fillText(slot.cooldownRemaining.toFixed(1), x + size / 2, y + size / 2);
          ctx.shadowBlur = 0;
        }
      }
    }

    // Hotkey / mouse-button label above the slot
    ctx.font = `bold ${Math.max(8, size * 0.22)}px "Segoe UI", Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = 'rgba(180, 170, 140, 0.55)';
    ctx.fillText(label, x + size / 2, y - 3);
  }

  // Helper: convert a hex color to rgba with the given alpha
  _withAlpha(hex, alpha) {
    if (typeof hex !== 'string' || !hex.startsWith('#')) return `rgba(120, 100, 55, ${alpha})`;
    const h = hex.replace('#', '');
    const expanded = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    if (expanded.length !== 6) return `rgba(120, 100, 55, ${alpha})`;
    const r = parseInt(expanded.substr(0, 2), 16);
    const g = parseInt(expanded.substr(2, 2), 16);
    const b = parseInt(expanded.substr(4, 2), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
    const size = 22;
    const gap = 4;

    const colorMap = {
      poison: '#22cc44',
      burning: '#ee8822',
      bleeding: '#cc2222',
      frozen: '#4488ff',
      slowed: '#4488ff',
      weakened: '#8844cc',
    };

    // Buff vs debuff — for now all are debuffs (red border).
    const debuffTypes = new Set(['poison', 'burning', 'bleeding', 'frozen', 'slowed', 'weakened']);

    const positions = [];

    for (let i = 0; i < this._statusEffects.length; i++) {
      const eff = this._statusEffects[i];
      const ex = startX + i * (size + gap);
      const color = eff.color || colorMap[eff.type] || '#aaa';
      const icon = (UI_THEME.statusIcons && UI_THEME.statusIcons[eff.type]) || '?';
      const remaining = eff.remainingDuration || eff.remaining || eff.duration || 0;
      const isDebuff = debuffTypes.has(eff.type);

      // Pulse when almost expired
      let alpha = 1;
      if (remaining > 0 && remaining < 1) {
        alpha = 0.4 + 0.6 * Math.abs(Math.sin(now * 8));
      }

      ctx.globalAlpha = alpha;

      // Tinted background (effect color tint over dark base)
      const [r, g, b] = this._parseColor(color);
      ctx.fillStyle = 'rgba(10, 8, 6, 0.85)';
      ctx.fillRect(ex, y, size, size);
      ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.22)`;
      ctx.fillRect(ex, y, size, size);

      // Border — red for debuffs, green for buffs
      ctx.strokeStyle = isDebuff ? 'rgba(231, 76, 60, 0.85)' : 'rgba(39, 174, 96, 0.85)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(ex + 0.5, y + 0.5, size - 1, size - 1);

      // Emoji icon
      ctx.font = `16px "Segoe UI Emoji", "Apple Color Emoji", "Segoe UI", Arial, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#fff';
      ctx.fillText(icon, ex + size / 2, y + size / 2 + 1);

      // Duration below
      if (remaining > 0) {
        ctx.font = `bold 9px "Segoe UI", Arial, sans-serif`;
        ctx.textBaseline = 'top';
        ctx.fillStyle = '#e8d8a0';
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 2;
        ctx.fillText(Math.ceil(remaining) + 's', ex + size / 2, y + size + 2);
        ctx.shadowBlur = 0;
      }

      ctx.globalAlpha = 1;

      positions.push({
        effect: { type: eff.type, remaining, duration: eff.duration || eff.totalDuration || remaining },
        x: ex, y, w: size, h: size,
      });
    }

    this._updateStatusEffectTooltips(positions);
  }

  _updateStatusEffectTooltips(positions) {
    // Ensure we have enough overlay divs
    while (this._statusEffectTooltipEls.length < positions.length) {
      const div = document.createElement('div');
      div.className = 'status-effect-tooltip-target';
      Object.assign(div.style, {
        position: 'fixed', pointerEvents: 'auto', background: 'transparent',
      });
      document.body.appendChild(div);
      this._statusEffectTooltipEls.push({ div, lastEffect: null });
    }
    // Position divs and (re)attach tooltips
    const canvas = this.canvas;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / canvas.width;
    const scaleY = rect.height / canvas.height;
    for (let i = 0; i < this._statusEffectTooltipEls.length; i++) {
      const item = this._statusEffectTooltipEls[i];
      if (i < positions.length) {
        const p = positions[i];
        item.div.style.display = 'block';
        item.div.style.left = `${rect.left + p.x * scaleX}px`;
        item.div.style.top = `${rect.top + p.y * scaleY}px`;
        item.div.style.width = `${p.w * scaleX}px`;
        item.div.style.height = `${p.h * scaleY}px`;
        // Refresh tooltip handler if effect changed
        if (item.lastEffect !== p.effect.type) {
          item.lastEffect = p.effect.type;
          Tooltip.detach(item.div);
          const type = p.effect.type;
          const name = UI_THEME.statusNames[type] || type;
          const desc = UI_THEME.statusDescriptions[type] || '';
          Tooltip.attach(item.div, () => {
            const remaining = Math.ceil(p.effect.remaining || p.effect.duration || 0);
            return `<div style="color:${UI_THEME.gold};font-weight:bold;margin-bottom:4px">${name}</div>` +
                   `<div style="color:${UI_THEME.textSecondary};margin-bottom:4px">${desc}</div>` +
                   `<div style="color:${UI_THEME.textMuted};font-size:11px">Remaining: ${remaining}s</div>`;
          });
        }
      } else {
        item.div.style.display = 'none';
      }
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
