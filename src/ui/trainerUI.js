/**
 * TrainerUI — replaces the old SkillVendorUI.
 *
 * Per WIREFRAMES §7, the Trainer's only function is RESPEC. There is no
 * skill purchasing — all skill progression happens in the Skill Book (K).
 *
 * Two cards:
 *   1. Skill Tree Respec — refunds all skill points, first use is free
 *   2. Attribute Respec — refunds all attribute points
 *
 * Each card has a confirm popup and disabled states for "no points spent",
 * "cannot afford".
 *
 * The Trainer is the ONLY place that toggles `player.freeRespecUsed`. It
 * passes `{free: ...}` into `skillManager.refundAll()` so the manager and
 * persistence stay in sync.
 */
export class TrainerUI {
  constructor() {
    this.overlay = null;
    this._resolve = null;
    this._keyHandler = null;
  }

  /**
   * Show the Trainer modal.
   *
   * @param {SkillManager} skillManager
   * @param {object} player           - reference to the player entity
   * @param {object} callbacks
   * @param {function} callbacks.onSpendGold      - (amount: number) => boolean. Returns false if the
   *                                                 charge couldn't be made (caller's responsibility to
   *                                                 keep gold + UI in sync).
   * @param {function} callbacks.onAttributeRespec - () => void. Resets attributes to base + refunds
   *                                                  attribute points. Trainer doesn't touch attributes
   *                                                  itself because game.js owns the attribute formula.
   * @returns {Promise<void>} resolves when the panel closes
   */
  show(skillManager, player, callbacks = {}) {
    this._cleanup();
    this._skillManager = skillManager;
    this._player = player;
    this._callbacks = callbacks;

    return new Promise(resolve => {
      this._resolve = resolve;
      this._build();
      this._keyHandler = (e) => {
        if (e.key === 'Escape') { e.preventDefault(); this._close(); }
      };
      document.addEventListener('keydown', this._keyHandler);
    });
  }

  // ===========================================================
  // Build
  // ===========================================================

  _build() {
    const overlay = document.createElement('div');
    this.overlay = overlay;
    Object.assign(overlay.style, {
      position: 'fixed', top: '0', left: '0',
      width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.7)',
      zIndex: '9000',
      fontFamily: "'Segoe UI', Arial, sans-serif",
      color: '#e0ddd5',
    });

    const panel = document.createElement('div');
    Object.assign(panel.style, {
      width: '560px', maxWidth: '92%',
      backgroundColor: '#1a1a2e',
      border: '2px solid #444',
      borderRadius: '8px',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      boxShadow: '0 0 40px rgba(0,0,0,0.8)',
    });
    overlay.appendChild(panel);

    panel.appendChild(this._buildHeader());

    const content = document.createElement('div');
    Object.assign(content.style, { padding: '14px 22px 22px 22px' });
    panel.appendChild(content);
    this._content = content;

    this._renderContent();

    document.body.appendChild(overlay);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this._close();
    });
  }

  _renderContent() {
    const content = this._content;
    if (!content) return;
    content.innerHTML = '';

    // Flavor text
    const flavor = document.createElement('div');
    Object.assign(flavor.style, {
      fontSize: '12px',
      color: '#999',
      fontStyle: 'italic',
      textAlign: 'center',
      marginBottom: '14px',
      lineHeight: '1.4',
    });
    flavor.innerHTML = `"Need a fresh start? I can help you re-allocate your points.<br>
      To learn and improve skills, open your Skill Book (K)."`;
    content.appendChild(flavor);

    content.appendChild(this._buildSkillRespecCard());
    content.appendChild(this._buildAttributeRespecCard());
    content.appendChild(this._buildInfoCard());
  }

  _buildHeader() {
    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 22px',
      backgroundColor: '#12122a',
      borderBottom: '1px solid #333',
    });

    const title = document.createElement('div');
    title.textContent = 'TRAINER';
    Object.assign(title.style, {
      fontSize: '18px', fontWeight: 'bold', color: '#f0c040', letterSpacing: '2px',
    });
    header.appendChild(title);

    const right = document.createElement('div');
    Object.assign(right.style, { display: 'flex', alignItems: 'center', gap: '14px' });

    const gold = document.createElement('div');
    gold.textContent = `Gold: ${this._player ? (this._player.gold || 0) : 0}`;
    Object.assign(gold.style, { fontSize: '13px', color: '#f0c040' });
    right.appendChild(gold);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '[X]';
    Object.assign(closeBtn.style, {
      background: 'none', border: '1px solid #666', color: '#ccc',
      fontSize: '14px', padding: '3px 8px', cursor: 'pointer', borderRadius: '4px',
    });
    closeBtn.addEventListener('click', () => this._close());
    right.appendChild(closeBtn);

    header.appendChild(right);
    return header;
  }

  // -----------------------------------------------------------
  // Skill tree respec card
  // -----------------------------------------------------------

  _buildSkillRespecCard() {
    const mgr = this._skillManager;
    const player = this._player;
    const card = document.createElement('div');
    Object.assign(card.style, {
      border: '1px solid #444',
      borderRadius: '6px',
      padding: '14px 16px',
      marginBottom: '12px',
      background: 'rgba(20, 18, 30, 0.6)',
    });

    const title = document.createElement('div');
    title.textContent = 'SKILL TREE RESPEC';
    Object.assign(title.style, {
      fontSize: '13px', fontWeight: 'bold', letterSpacing: '1px',
      color: '#e0ddd5', marginBottom: '8px',
    });
    card.appendChild(title);

    const desc = document.createElement('div');
    desc.textContent = 'Refunds all spent skill points. Your action bar attack assignments are preserved.';
    Object.assign(desc.style, { fontSize: '11px', color: '#999', marginBottom: '10px' });
    card.appendChild(desc);

    // Investment summary
    const summary = document.createElement('div');
    Object.assign(summary.style, {
      fontSize: '11px', color: '#bbb',
      background: 'rgba(0,0,0,0.3)',
      padding: '8px 10px',
      borderRadius: '3px',
      marginBottom: '10px',
      lineHeight: '1.5',
    });
    let summaryHtml = '<b>Current investment:</b><br>';
    let totalSpent = 0;
    for (const specKey of mgr.getSpecs()) {
      const spec = mgr.getSpec(specKey);
      const label = (spec && spec.specData && spec.specData.label) || specKey;
      const pts = mgr.getPointsInTree(specKey);
      totalSpent += pts;
      summaryHtml += `&nbsp;&nbsp;${label}: ${pts} points<br>`;
    }
    summaryHtml += `&nbsp;&nbsp;Available: ${mgr.getSkillPointsAvailable()} points<br>`;
    summaryHtml += `&nbsp;&nbsp;<span style="color:#888;">─────────────────</span><br>`;
    summaryHtml += `&nbsp;&nbsp;Total spent: <b>${totalSpent}</b> (Lv ${player ? player.level : 1})`;
    summary.innerHTML = summaryHtml;
    card.appendChild(summary);

    // Cost line
    const cost = (player && player.level) ? player.level * 25 : 0;
    const isFree = player && !player.freeRespecUsed;
    const gold = (player && player.gold) || 0;
    const costEl = document.createElement('div');
    Object.assign(costEl.style, { fontSize: '12px', marginBottom: '10px' });
    if (isFree) {
      costEl.innerHTML = `<span style="color:#f0c040;font-weight:bold;">★ FIRST RESPEC IS FREE ★</span>`;
    } else if (gold < cost) {
      costEl.innerHTML = `Cost: <span style="color:#cc4040;">${cost}g (have ${gold}g)</span> <span style="color:#888;">— player level × 25</span>`;
    } else {
      costEl.innerHTML = `Cost: <span style="color:#f0c040;">${cost}g</span> <span style="color:#888;">— player level × 25</span>`;
    }
    card.appendChild(costEl);

    // Button
    const btn = document.createElement('button');
    btn.textContent = 'RESPEC TREE';
    const canAfford = isFree || gold >= cost;
    const hasPoints = totalSpent > 0;
    const disabled = !hasPoints || !canAfford;
    Object.assign(btn.style, this._buttonStyle(isFree && hasPoints ? 'gold' : 'normal', disabled));
    if (!hasPoints) btn.title = 'Nothing to refund yet — spend some points in the Skill Book first.';
    if (!disabled) {
      btn.addEventListener('click', () => this._confirmSkillRespec(cost, isFree));
    }
    card.appendChild(btn);

    return card;
  }

  _confirmSkillRespec(cost, isFree) {
    const mgr = this._skillManager;
    const totalSpent = mgr.getTotalPointsSpent();
    this._showConfirmDialog({
      title: 'CONFIRM RESPEC',
      message: `This will refund all ${totalSpent} spent skill points. You'll need to re-spend them in the Skill Book.`,
      costLabel: isFree ? 'Cost: FREE (one-time)' : `Cost: ${cost}g`,
      goldHighlight: isFree,
      onConfirm: () => {
        if (!isFree) {
          if (this._callbacks.onSpendGold && this._callbacks.onSpendGold(cost) === false) {
            return;
          }
        }
        // Refund via skillManager — pass {free} so the manager updates
        // freeRespecUsed itself, keeping the player state in sync.
        mgr.refundAll({ free: isFree });
        this._renderContent();
        this._afterRespec();
      },
    });
  }

  // -----------------------------------------------------------
  // Attribute respec card
  // -----------------------------------------------------------

  _buildAttributeRespecCard() {
    const player = this._player;
    const card = document.createElement('div');
    Object.assign(card.style, {
      border: '1px solid #444',
      borderRadius: '6px',
      padding: '14px 16px',
      marginBottom: '12px',
      background: 'rgba(20, 18, 30, 0.6)',
    });

    const title = document.createElement('div');
    title.textContent = 'ATTRIBUTE RESPEC';
    Object.assign(title.style, {
      fontSize: '13px', fontWeight: 'bold', letterSpacing: '1px',
      color: '#e0ddd5', marginBottom: '8px',
    });
    card.appendChild(title);

    const desc = document.createElement('div');
    desc.textContent = 'Refunds all spent attribute points so you can re-allocate STR / INT / AGI / STA.';
    Object.assign(desc.style, { fontSize: '11px', color: '#999', marginBottom: '10px' });
    card.appendChild(desc);

    // Attribute summary
    const summary = document.createElement('div');
    Object.assign(summary.style, {
      fontSize: '11px', color: '#bbb',
      background: 'rgba(0,0,0,0.3)',
      padding: '8px 10px',
      borderRadius: '3px',
      marginBottom: '10px',
    });
    const attrs = (player && player.attributes) || {};
    summary.innerHTML = `<b>Current attributes:</b><br>
      &nbsp;&nbsp;STR ${attrs.str || 0} &nbsp;&nbsp; INT ${attrs.int || 0}<br>
      &nbsp;&nbsp;AGI ${attrs.agi || 0} &nbsp;&nbsp; STA ${attrs.sta || 0}`;
    card.appendChild(summary);

    // Cost line
    const cost = (player && player.level) ? player.level * 15 : 0;
    const gold = (player && player.gold) || 0;
    const costEl = document.createElement('div');
    Object.assign(costEl.style, { fontSize: '12px', marginBottom: '10px' });
    if (gold < cost) {
      costEl.innerHTML = `Cost: <span style="color:#cc4040;">${cost}g (have ${gold}g)</span> <span style="color:#888;">— player level × 15</span>`;
    } else {
      costEl.innerHTML = `Cost: <span style="color:#f0c040;">${cost}g</span> <span style="color:#888;">— player level × 15</span>`;
    }
    card.appendChild(costEl);

    // Button
    const btn = document.createElement('button');
    btn.textContent = 'RESPEC ATTRIBUTES';
    const totalAttrs = Object.values(attrs).reduce((a, b) => a + (b || 0), 0);
    const baseAttrs = (player && player.classConfig && player.classConfig.baseAttributes) || {};
    const baseTotal = Object.values(baseAttrs).reduce((a, b) => a + (b || 0), 0);
    const hasSpentAttrs = totalAttrs > baseTotal;
    const canAfford = gold >= cost;
    const disabled = !hasSpentAttrs || !canAfford;
    Object.assign(btn.style, this._buttonStyle('normal', disabled));
    if (!hasSpentAttrs) btn.title = 'No attribute points to refund.';
    if (!disabled) {
      btn.addEventListener('click', () => this._confirmAttributeRespec(cost));
    }
    card.appendChild(btn);

    return card;
  }

  _confirmAttributeRespec(cost) {
    this._showConfirmDialog({
      title: 'CONFIRM RESPEC',
      message: `This will refund all spent attribute points and reset STR/INT/AGI/STA to your class base.`,
      costLabel: `Cost: ${cost}g`,
      goldHighlight: false,
      onConfirm: () => {
        if (this._callbacks.onSpendGold && this._callbacks.onSpendGold(cost) === false) return;
        if (this._callbacks.onAttributeRespec) this._callbacks.onAttributeRespec();
        this._renderContent();
        this._afterRespec();
      },
    });
  }

  // -----------------------------------------------------------
  // Info card
  // -----------------------------------------------------------

  _buildInfoCard() {
    const card = document.createElement('div');
    Object.assign(card.style, {
      border: '1px solid rgba(120, 100, 55, 0.3)',
      borderLeft: '3px solid #f0c040',
      borderRadius: '4px',
      padding: '10px 14px',
      background: 'rgba(40, 30, 10, 0.3)',
      fontSize: '11px',
      color: '#bbb',
      lineHeight: '1.5',
    });
    card.innerHTML = `💡 To learn new skills or improve attacks, open your <b>Skill Book (K)</b>. You earn 1 skill point per level.`;
    return card;
  }

  // -----------------------------------------------------------
  // Confirm dialog
  // -----------------------------------------------------------

  _showConfirmDialog({ title, message, costLabel, goldHighlight, onConfirm }) {
    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'fixed', top: '0', left: '0', right: '0', bottom: '0',
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: '11000',
    });

    const dialog = document.createElement('div');
    Object.assign(dialog.style, {
      background: '#1a1a2e',
      border: '2px solid #555',
      borderRadius: '6px',
      padding: '22px 26px',
      maxWidth: '440px',
      color: '#e0ddd5',
      fontFamily: "'Segoe UI', Arial, sans-serif",
      textAlign: 'center',
    });

    dialog.innerHTML = `
      <div style="font-size:14px;font-weight:bold;color:#f0c040;letter-spacing:1px;margin-bottom:12px;">
        ${title}
      </div>
      <div style="font-size:12px;color:#ccc;margin-bottom:14px;line-height:1.5;">
        ${message}
      </div>
      <div style="font-size:13px;font-weight:bold;color:${goldHighlight ? '#f0c040' : '#e0ddd5'};margin-bottom:18px;">
        ${costLabel}
      </div>
    `;

    const btnRow = document.createElement('div');
    Object.assign(btnRow.style, { display: 'flex', gap: '10px', justifyContent: 'center' });
    const cancel = document.createElement('button');
    cancel.textContent = 'CANCEL';
    Object.assign(cancel.style, this._buttonStyle('normal', false));
    cancel.addEventListener('click', () => overlay.remove());
    const confirm = document.createElement('button');
    confirm.textContent = 'CONFIRM';
    Object.assign(confirm.style, this._buttonStyle(goldHighlight ? 'gold' : 'normal', false));
    confirm.addEventListener('click', () => {
      overlay.remove();
      onConfirm();
    });
    btnRow.appendChild(cancel);
    btnRow.appendChild(confirm);
    dialog.appendChild(btnRow);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
  }

  // -----------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------

  _buttonStyle(variant, disabled) {
    const base = {
      width: '100%',
      padding: '10px 18px',
      background: 'rgba(40, 38, 60, 0.9)',
      border: '1px solid #555',
      borderRadius: '4px',
      color: '#e0ddd5',
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontSize: '12px',
      letterSpacing: '0.5px',
      fontWeight: 'bold',
      opacity: disabled ? '0.45' : '1',
    };
    if (variant === 'gold' && !disabled) {
      base.background = 'rgba(120, 90, 20, 0.7)';
      base.border = '1px solid #c9a84c';
      base.color = '#f0c040';
    }
    return base;
  }

  _afterRespec() {
    // Open Skill Book automatically? Per WIREFRAMES §7.2 the Skill Book opens
    // after a successful respec so the player can immediately re-spend. We
    // signal that intent through a callback the host (game.js) provides.
    if (this._callbacks.onAfterRespec) this._callbacks.onAfterRespec();
  }

  _close() {
    const resolve = this._resolve;
    this._cleanup();
    if (resolve) resolve();
  }

  _cleanup() {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler);
      this._keyHandler = null;
    }
    this._resolve = null;
  }
}
