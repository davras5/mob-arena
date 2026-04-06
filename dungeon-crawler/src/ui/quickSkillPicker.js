/**
 * QuickSkillPicker — flyout popup for swapping skills on the action bar.
 * Small icon grid that appears above a skill slot anchor point.
 */
export class QuickSkillPicker {
  constructor() {
    this._overlay = null;   // click-away backdrop
    this._panel = null;     // the popup container
    this._tooltip = null;   // hover tooltip element
    this._resolve = null;   // promise resolver
    this._onKeyDown = null; // stored handler for cleanup
  }

  /**
   * Show the picker anchored near (anchorX, anchorY).
   * @param {SkillManager} skillManager
   * @param {'left'|'right'} targetSlot
   * @param {number} anchorX  screen X
   * @param {number} anchorY  screen Y
   * @returns {Promise<string|null>} selected skillId or null if cancelled
   */
  show(skillManager, targetSlot, anchorX, anchorY) {
    // Tear down any existing picker first
    this._cleanup();

    return new Promise(resolve => {
      this._resolve = resolve;

      // --- Invisible overlay for click-away dismiss ---
      this._overlay = document.createElement('div');
      Object.assign(this._overlay.style, {
        position: 'fixed', top: '0', left: '0',
        width: '100%', height: '100%',
        zIndex: '9998',
      });
      this._overlay.addEventListener('pointerdown', () => this._cancel());

      // --- Tooltip (hidden until hover) ---
      this._tooltip = document.createElement('div');
      Object.assign(this._tooltip.style, {
        position: 'fixed',
        padding: '4px 8px',
        background: 'rgba(0,0,0,0.85)',
        color: '#eee',
        fontSize: '12px',
        borderRadius: '4px',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
        zIndex: '10001',
        display: 'none',
      });

      // --- Panel ---
      this._panel = document.createElement('div');
      Object.assign(this._panel.style, {
        position: 'fixed',
        width: '200px',
        background: 'linear-gradient(180deg, #1a1a2e, #16213e)',
        border: '1px solid #444',
        borderRadius: '6px',
        padding: '8px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
        zIndex: '9999',
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px',
      });

      // Determine which skillId is currently equipped in the target slot
      const equippedId = targetSlot === 'left'
        ? skillManager.leftSlot
        : skillManager.rightSlot;

      // Collect learned active skills
      const allActives = skillManager.getAllActives();
      const learnedActives = allActives.filter(s => s.isLearned);

      // Sort so Basic Attack (tier 0 / isDefault) comes first
      learnedActives.sort((a, b) => {
        if (a.isDefault && !b.isDefault) return -1;
        if (!a.isDefault && b.isDefault) return 1;
        return (a.tier || 0) - (b.tier || 0);
      });

      for (const skill of learnedActives) {
        const btn = document.createElement('button');
        const onCooldown = (skillManager.cooldowns[skill.id] || 0) > 0;
        const isEquipped = skill.id === equippedId;
        const isBasicAttack = skill.isDefault;
        const costText = skill.resourceCost
          ? `${skill.resourceCost} resource`
          : 'Free';

        Object.assign(btn.style, {
          width: '40px',
          height: '40px',
          fontSize: '20px',
          lineHeight: '40px',
          textAlign: 'center',
          padding: '0',
          border: isEquipped ? '2px solid gold' : '1px solid #555',
          borderRadius: '4px',
          background: onCooldown
            ? 'rgba(60,60,60,0.7)'
            : 'rgba(30,30,50,0.9)',
          opacity: onCooldown ? '0.45' : '1',
          cursor: 'pointer',
          position: 'relative',
          flexShrink: '0',
        });

        btn.textContent = skill.icon || '?';
        btn.title = ''; // suppress native tooltip

        // "Free" badge on basic attack
        if (isBasicAttack) {
          const badge = document.createElement('span');
          Object.assign(badge.style, {
            position: 'absolute',
            bottom: '-2px',
            right: '-2px',
            fontSize: '8px',
            background: '#27ae60',
            color: '#fff',
            borderRadius: '3px',
            padding: '0 3px',
            lineHeight: '12px',
            pointerEvents: 'none',
          });
          badge.textContent = 'free';
          btn.appendChild(badge);
        }

        // Hover → tooltip
        btn.addEventListener('pointerenter', e => {
          this._tooltip.textContent = `${skill.name}  (${costText})`;
          this._tooltip.style.display = 'block';
          this._positionTooltip(e);
        });
        btn.addEventListener('pointermove', e => this._positionTooltip(e));
        btn.addEventListener('pointerleave', () => {
          this._tooltip.style.display = 'none';
        });

        // Click → select
        btn.addEventListener('pointerdown', e => {
          e.stopPropagation();
          this._select(skill.id);
        });

        this._panel.appendChild(btn);
      }

      // Append elements
      document.body.appendChild(this._overlay);
      document.body.appendChild(this._panel);
      document.body.appendChild(this._tooltip);

      // Position panel above anchor
      const panelRect = this._panel.getBoundingClientRect();
      let left = anchorX - panelRect.width / 2;
      let top = anchorY - panelRect.height - 8;

      // Clamp to viewport
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

  // ---- internal helpers ----

  _positionTooltip(e) {
    if (!this._tooltip) return;
    this._tooltip.style.left = (e.clientX + 12) + 'px';
    this._tooltip.style.top = (e.clientY - 24) + 'px';
  }

  _select(skillId) {
    const resolve = this._resolve;
    this._cleanup();
    if (resolve) resolve(skillId);
  }

  _cancel() {
    const resolve = this._resolve;
    this._cleanup();
    if (resolve) resolve(null);
  }

  _cleanup() {
    if (this._overlay) { this._overlay.remove(); this._overlay = null; }
    if (this._panel)   { this._panel.remove();   this._panel = null; }
    if (this._tooltip) { this._tooltip.remove();  this._tooltip = null; }
    if (this._onKeyDown) {
      window.removeEventListener('keydown', this._onKeyDown);
      this._onKeyDown = null;
    }
    this._resolve = null;
  }
}
