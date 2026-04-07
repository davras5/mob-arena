/**
 * QuickSkillPicker — flyout popup for swapping the LMB or RMB attack.
 *
 * Layout per WIREFRAMES §3 "Quick Skill Picker":
 *   2x2 grid grouped by spec, with spec label headers.
 *   Row 1 = Spec 1 (Primary | Secondary)
 *   Row 2 = Spec 2 (Primary | Secondary)
 *
 * The picker only handles attack assignment to LMB / RMB. To bind a
 * consumable to a slot, drag from inventory directly onto the slot.
 * Keyboard slots 1–5 do NOT use this picker — they use drag-from-inventory.
 */
export class QuickSkillPicker {
  constructor() {
    this._overlay = null;
    this._panel = null;
    this._tooltip = null;
    this._resolve = null;
    this._onKeyDown = null;
  }

  /**
   * Show the picker anchored near (anchorX, anchorY).
   *
   * @param {SkillManager} skillManager
   * @param {'leftClick'|'rightClick'} targetSlot - canonical slot id from setSlots()
   * @param {number} anchorX  screen X
   * @param {number} anchorY  screen Y
   * @returns {Promise<string|null>} selected attackId or null if cancelled
   */
  show(skillManager, targetSlot, anchorX, anchorY) {
    this._cleanup();

    return new Promise(resolve => {
      this._resolve = resolve;

      // Click-away backdrop
      this._overlay = document.createElement('div');
      Object.assign(this._overlay.style, {
        position: 'fixed', top: '0', left: '0',
        width: '100%', height: '100%',
        zIndex: '9998',
      });
      this._overlay.addEventListener('pointerdown', () => this._cancel());

      // Hover tooltip
      this._tooltip = document.createElement('div');
      Object.assign(this._tooltip.style, {
        position: 'fixed',
        padding: '6px 10px',
        background: 'rgba(0,0,0,0.92)',
        color: '#eee',
        fontSize: '12px',
        borderRadius: '4px',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        zIndex: '10001',
        display: 'none',
        border: '1px solid #444',
        boxShadow: '0 2px 8px rgba(0,0,0,0.6)',
      });

      // Panel
      this._panel = document.createElement('div');
      Object.assign(this._panel.style, {
        position: 'fixed',
        background: 'linear-gradient(180deg, #1a1a2e, #16213e)',
        border: '1px solid #444',
        borderRadius: '6px',
        padding: '8px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
        zIndex: '9999',
        fontFamily: "'Segoe UI', Arial, sans-serif",
        color: '#e0ddd5',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        minWidth: '180px',
      });

      // Build the 2x2 layout
      this._buildContent(skillManager, targetSlot);

      document.body.appendChild(this._overlay);
      document.body.appendChild(this._panel);
      document.body.appendChild(this._tooltip);

      // Position above anchor
      const panelRect = this._panel.getBoundingClientRect();
      let left = anchorX - panelRect.width / 2;
      let top = anchorY - panelRect.height - 10;
      left = Math.max(4, Math.min(left, window.innerWidth - panelRect.width - 4));
      top = Math.max(4, top);
      this._panel.style.left = left + 'px';
      this._panel.style.top = top + 'px';

      // ESC to cancel
      this._onKeyDown = e => {
        if (e.key === 'Escape') {
          e.preventDefault();
          this._cancel();
        }
      };
      window.addEventListener('keydown', this._onKeyDown);
    });
  }

  // -------------------------------------------------------------------
  // Build the spec-grouped 2x2 grid
  // -------------------------------------------------------------------

  _buildContent(skillManager, targetSlot) {
    // Look up what's currently in the OTHER slot so we can mark it
    const otherSlot = targetSlot === 'leftClick' ? 'rightClick' : 'leftClick';
    const otherBinding = skillManager.getSlotBinding(otherSlot);
    const otherAttackId = otherBinding && otherBinding.type === 'attack' ? otherBinding.id : null;

    const specKeys = skillManager.getSpecs(); // e.g. ['guardian', 'berserker']

    for (const specKey of specKeys) {
      const spec = skillManager.getSpec(specKey);
      if (!spec || !spec.specData) continue;

      const ranks = skillManager.getPointsInTree(specKey);
      const specColor = spec.specData.color || '#888';
      const specLabel = spec.specData.label || specKey;

      // Spec header row
      const header = document.createElement('div');
      header.textContent = `${specLabel.toUpperCase()}  (${ranks} pts)`;
      Object.assign(header.style, {
        fontSize: '11px',
        fontWeight: 'bold',
        letterSpacing: '1px',
        color: specColor,
        textAlign: 'center',
        paddingBottom: '2px',
        borderBottom: `1px solid ${this._withAlpha(specColor, 0.3)}`,
      });
      this._panel.appendChild(header);

      // Two-button row: primary | secondary
      const row = document.createElement('div');
      Object.assign(row.style, {
        display: 'flex',
        gap: '8px',
        justifyContent: 'center',
      });

      const attacks = [
        { kind: 'primary',   def: spec.specData.primary },
        { kind: 'secondary', def: spec.specData.secondary },
      ];

      for (const { kind, def } of attacks) {
        if (!def) continue;
        const btn = this._buildAttackButton(skillManager, def, kind, specColor, ranks, otherAttackId);
        row.appendChild(btn);
      }

      this._panel.appendChild(row);
    }
  }

  _buildAttackButton(skillManager, attackDef, kind, specColor, specRanks, otherAttackId) {
    const resolved = skillManager.getResolvedAttack(attackDef.id);
    const isOnOtherSlot = attackDef.id === otherAttackId;
    const isUntrained = specRanks === 0;

    const btn = document.createElement('button');
    Object.assign(btn.style, {
      width: '64px',
      height: '64px',
      padding: '0',
      border: isOnOtherSlot ? '2px solid #c9a84c' : `1px solid ${this._withAlpha(specColor, 0.5)}`,
      borderRadius: '6px',
      background: 'rgba(20, 18, 30, 0.9)',
      color: '#eee',
      cursor: 'pointer',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      transition: 'background 0.12s, border-color 0.12s',
      opacity: isUntrained ? '0.65' : '1',
    });

    // Icon
    const icon = document.createElement('div');
    icon.textContent = attackDef.icon || '?';
    Object.assign(icon.style, {
      fontSize: '24px',
      lineHeight: '1',
      marginBottom: '2px',
    });
    btn.appendChild(icon);

    // Slot kind label (PRI / SEC)
    const kindLabel = document.createElement('div');
    kindLabel.textContent = kind === 'primary' ? 'PRI' : 'SEC';
    Object.assign(kindLabel.style, {
      fontSize: '8px',
      letterSpacing: '0.5px',
      color: this._withAlpha(specColor, 0.85),
      fontWeight: 'bold',
    });
    btn.appendChild(kindLabel);

    // Hover effects
    btn.addEventListener('pointerenter', e => {
      btn.style.background = 'rgba(40, 38, 60, 0.95)';
      const cdText = resolved && resolved.cooldown ? `${resolved.cooldown}s CD` : '';
      const costText = resolved && resolved.cost ? `${resolved.cost} resource` : 'free';
      const trainedText = isUntrained
        ? ' • untrained (base power)'
        : ` • ${specRanks} pts in spec`;
      this._tooltip.innerHTML = `
        <div style="font-weight:bold;margin-bottom:2px;">${attackDef.name}</div>
        <div style="opacity:0.8;">${costText} • ${cdText}${trainedText}</div>
      `;
      this._tooltip.style.display = 'block';
      this._positionTooltip(e);
    });
    btn.addEventListener('pointermove', e => this._positionTooltip(e));
    btn.addEventListener('pointerleave', () => {
      btn.style.background = 'rgba(20, 18, 30, 0.9)';
      this._tooltip.style.display = 'none';
    });

    btn.addEventListener('pointerdown', e => {
      e.stopPropagation();
      this._select(attackDef.id);
    });

    return btn;
  }

  // -------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------

  _positionTooltip(e) {
    if (!this._tooltip) return;
    this._tooltip.style.left = (e.clientX + 12) + 'px';
    this._tooltip.style.top = (e.clientY - 32) + 'px';
  }

  _withAlpha(hex, alpha) {
    if (typeof hex !== 'string' || !hex.startsWith('#')) return `rgba(160, 140, 100, ${alpha})`;
    const h = hex.replace('#', '');
    const expanded = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    if (expanded.length !== 6) return `rgba(160, 140, 100, ${alpha})`;
    const r = parseInt(expanded.substr(0, 2), 16);
    const g = parseInt(expanded.substr(2, 2), 16);
    const b = parseInt(expanded.substr(4, 2), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  _select(attackId) {
    const resolve = this._resolve;
    this._cleanup();
    if (resolve) resolve(attackId);
  }

  _cancel() {
    const resolve = this._resolve;
    this._cleanup();
    if (resolve) resolve(null);
  }

  _cleanup() {
    if (this._overlay) { this._overlay.remove(); this._overlay = null; }
    if (this._panel)   { this._panel.remove();   this._panel = null; }
    if (this._tooltip) { this._tooltip.remove(); this._tooltip = null; }
    if (this._onKeyDown) {
      window.removeEventListener('keydown', this._onKeyDown);
      this._onKeyDown = null;
    }
    this._resolve = null;
  }
}
