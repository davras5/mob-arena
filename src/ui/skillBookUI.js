/**
 * SkillBookUI — central screen for the spec-tree skill system.
 *
 * Layout per WIREFRAMES §6:
 *   - Header: class name, level, skill points available, points-per-spec
 *   - Action bar (top): 7 slots — LMB / RMB / 1–5
 *   - Spec tabs (one per spec, double-line border on active)
 *   - Tree: 5 tier rows, gated by points-in-tree
 *     - Tier 1/2/4: ranked nodes with rank dots ◉◉◯◯◯
 *     - Tier 3: side-by-side branch choice cards
 *     - Tier 5: capstone card (full description even when locked)
 *   - Hover detail panel (bottom)
 *   - Footer: skill points + respec link
 *
 * This UI is DOM/HTML based (matches the existing codebase pattern).
 * All interactions go through the SkillManager (the UI never mutates
 * player.skillTree directly).
 *
 * The UI rebuilds itself on every spend/click — small enough that we don't
 * bother with diffing.
 */

import { TIER_GATES } from '../systems/skillTreeEngine.js';

const SLOT_IDS = ['leftClick', 'rightClick', 'slot1', 'slot2', 'slot3', 'slot4', 'slot5'];

export class SkillBookUI {
  constructor() {
    this.overlay = null;
    this._container = null;
    this._skillManager = null;
    this._player = null;
    this._activeSpecKey = null;     // currently visible spec tab
    this._hoveredNodeId = null;
    this._hoveredSlotId = null;
    this._onRefresh = null;
    this._resolve = null;
    this._keyHandler = null;
    this._pickerOpen = false;
    this._pendingBranchConfirm = null;
  }

  // ===========================================================
  // Public entry points
  // ===========================================================

  /**
   * Standalone modal mode: shows the skill book as a centered overlay.
   * Returns a promise that resolves when the panel closes.
   */
  show(skillManager, player) {
    this._cleanup();
    this._skillManager = skillManager;
    this._player = player;
    this._activeSpecKey = (skillManager.getSpecs()[0]) || null;

    return new Promise(resolve => {
      this._resolve = resolve;
      this._buildModal();
      this._keyHandler = (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          this._close();
        }
      };
      document.addEventListener('keydown', this._keyHandler);
    });
  }

  /**
   * Embedded mode: render the skill book content into an existing container.
   * Used by GameWindow. The caller provides an `onRefresh` callback that
   * the UI calls whenever it needs to rebuild after a spend/click.
   *
   * @param {HTMLElement} container
   * @param {SkillManager} skillManager
   * @param {object} player - the active player entity (for class, points)
   * @param {Function} onRefresh - rebuilder callback (typically wraps another buildInto call)
   */
  buildInto(container, skillManager, player, onRefresh) {
    this._container = container;
    this._skillManager = skillManager;
    this._player = player;
    this._onRefresh = onRefresh || null;
    if (!this._activeSpecKey) {
      this._activeSpecKey = (skillManager.getSpecs()[0]) || null;
    }
    container.innerHTML = '';
    this._buildContent(container);
  }

  // ===========================================================
  // Modal mode (standalone overlay)
  // ===========================================================

  _buildModal() {
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
      width: '85%', height: '88%', maxWidth: '900px',
      backgroundColor: '#1a1a2e',
      border: '2px solid #444',
      borderRadius: '8px',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      boxShadow: '0 0 40px rgba(0,0,0,0.8)',
    });
    overlay.appendChild(panel);

    const content = document.createElement('div');
    Object.assign(content.style, {
      flex: '1',
      overflowY: 'auto',
      padding: '14px 22px',
    });
    panel.appendChild(content);

    this._container = content;
    this._onRefresh = () => this._buildContent(content);
    this._buildContent(content);

    document.body.appendChild(overlay);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this._close();
    });
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

  // ===========================================================
  // Content building
  // ===========================================================

  _buildContent(target) {
    target.innerHTML = '';
    if (!this._skillManager) return;

    const mgr = this._skillManager;
    const player = this._player;
    const specKeys = mgr.getSpecs();
    if (specKeys.length === 0) return;

    // Header
    target.appendChild(this._buildHeader());

    // New character welcome banner (per WIREFRAMES §6.8)
    if (mgr.getTotalPointsSpent() === 0) {
      target.appendChild(this._buildWelcomeBanner());
    }

    // Action bar (the same 7 slots as the HUD, full size + descriptions)
    target.appendChild(this._buildSectionTitle('ACTION BAR'));
    target.appendChild(this._buildActionBar());

    // Spec tabs row
    target.appendChild(this._buildSpecTabs());

    // Active spec tree
    if (this._activeSpecKey) {
      target.appendChild(this._buildTree(this._activeSpecKey));
    }

    // Hover detail panel
    target.appendChild(this._buildDetailPanel());

    // Footer
    target.appendChild(this._buildFooter());
  }

  // -----------------------------------------------------------
  // Header
  // -----------------------------------------------------------

  _buildHeader() {
    const mgr = this._skillManager;
    const player = this._player;
    const wrap = document.createElement('div');
    Object.assign(wrap.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '8px 4px 14px 4px',
      borderBottom: '1px solid #333',
      marginBottom: '12px',
    });

    const left = document.createElement('div');
    const className = (player && player.classConfig && player.classConfig.name) || (player && player.class) || '';
    const lvl = player && player.level ? `Lv ${player.level}` : '';
    left.innerHTML = `<span style="font-size:18px;font-weight:bold;color:#f0c040;letter-spacing:1px;">SKILL BOOK</span>
      <span style="margin-left:14px;color:#bbb;font-size:13px;">${this._titleCase(className)} • ${lvl}</span>`;
    wrap.appendChild(left);

    const right = document.createElement('div');
    Object.assign(right.style, { fontSize: '13px', color: '#ccc', textAlign: 'right' });

    const pts = mgr.getSkillPointsAvailable();
    const ptsLine = document.createElement('div');
    ptsLine.innerHTML = `Skill Points: <span style="color:${pts > 0 ? '#7be07b' : '#888'};font-weight:bold;">${pts}</span> available`;
    right.appendChild(ptsLine);

    const investedLine = document.createElement('div');
    investedLine.style.marginTop = '2px';
    investedLine.style.fontSize = '11px';
    investedLine.style.color = '#999';
    const parts = [];
    for (const specKey of mgr.getSpecs()) {
      const spec = mgr.getSpec(specKey);
      const label = (spec && spec.specData && spec.specData.label) || specKey;
      parts.push(`${label} ${mgr.getPointsInTree(specKey)}`);
    }
    investedLine.textContent = 'Invested: ' + parts.join('  •  ');
    right.appendChild(investedLine);

    wrap.appendChild(right);
    return wrap;
  }

  _buildWelcomeBanner() {
    const banner = document.createElement('div');
    Object.assign(banner.style, {
      background: 'rgba(201, 168, 76, 0.10)',
      border: '1px solid rgba(201, 168, 76, 0.40)',
      borderRadius: '4px',
      padding: '10px 14px',
      marginBottom: '12px',
      color: '#e8d3a8',
      fontSize: '12px',
      textAlign: 'center',
      letterSpacing: '0.3px',
    });
    banner.innerHTML = `Welcome! You earn <b>1 skill point per level</b>. Spend them in either spec tree —
      try both LMB/RMB attacks first to see which playstyle you prefer.
      Drag potions and skills onto slots 1–5 as you collect them. Your <b>first respec is free</b>.`;
    return banner;
  }

  // -----------------------------------------------------------
  // Action bar (top)
  // -----------------------------------------------------------

  _buildActionBar() {
    const mgr = this._skillManager;

    const wrap = document.createElement('div');
    Object.assign(wrap.style, {
      display: 'flex',
      gap: '14px',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '14px 8px',
      background: 'rgba(10, 8, 6, 0.4)',
      border: '1px solid #2a2540',
      borderRadius: '6px',
      marginBottom: '14px',
    });

    // Mouse slot pair
    const mouseRow = document.createElement('div');
    Object.assign(mouseRow.style, { display: 'flex', gap: '8px' });
    for (const slotId of ['leftClick', 'rightClick']) {
      mouseRow.appendChild(this._buildSlotCell(slotId, 'large'));
    }
    wrap.appendChild(mouseRow);

    // Separator
    const sep = document.createElement('div');
    Object.assign(sep.style, {
      width: '1px',
      height: '60px',
      background: 'rgba(120, 100, 55, 0.3)',
    });
    wrap.appendChild(sep);

    // Keyboard slots
    const keyRow = document.createElement('div');
    Object.assign(keyRow.style, { display: 'flex', gap: '6px' });
    for (let i = 1; i <= 5; i++) {
      keyRow.appendChild(this._buildSlotCell('slot' + i, 'small'));
    }
    wrap.appendChild(keyRow);

    return wrap;
  }

  _buildSlotCell(slotId, size) {
    const mgr = this._skillManager;
    const isLarge = size === 'large';
    const cellSize = isLarge ? 64 : 52;

    const cell = document.createElement('div');
    cell.dataset.slotId = slotId;
    Object.assign(cell.style, {
      width: cellSize + 'px',
      height: cellSize + 'px',
      background: 'rgba(20, 18, 30, 0.85)',
      border: '1px solid rgba(120, 100, 55, 0.5)',
      borderRadius: '4px',
      cursor: 'pointer',
      position: 'relative',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column',
      transition: 'border-color 0.15s, background 0.15s',
    });

    const binding = mgr.getSlotBinding(slotId);

    if (binding) {
      // Look up the icon + name based on binding type
      let icon = '?';
      let name = '';
      let specMismatch = false;
      let specColor = null;

      if (binding.type === 'attack') {
        const baseDef = mgr.getAttack(binding.id);
        const resolved = mgr.getResolvedAttack(binding.id);
        if (baseDef) {
          icon = baseDef.icon || '?';
          name = baseDef.name || '';
        }
        // Spec mismatch warning
        const attackSpecKey = this._findSpecForAttack(binding.id);
        if (attackSpecKey) {
          const ranks = mgr.getPointsInTree(attackSpecKey);
          if (ranks === 0) specMismatch = true;
          const spec = mgr.getSpec(attackSpecKey);
          if (spec && spec.specData) specColor = spec.specData.color || null;
        }
      } else if (binding.type === 'consumable') {
        // We don't have a global potion catalog here, just show the id
        icon = '🧪';
        name = binding.id;
      }

      if (specColor) cell.style.borderColor = this._withAlpha(specColor, 0.6);

      const iconEl = document.createElement('div');
      iconEl.textContent = icon;
      Object.assign(iconEl.style, {
        fontSize: isLarge ? '32px' : '26px',
        lineHeight: '1',
      });
      cell.appendChild(iconEl);

      const nameEl = document.createElement('div');
      nameEl.textContent = name;
      Object.assign(nameEl.style, {
        fontSize: '9px',
        color: '#bbb',
        marginTop: '2px',
        textAlign: 'center',
        maxWidth: (cellSize - 6) + 'px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      });
      cell.appendChild(nameEl);

      if (specMismatch) {
        const warn = document.createElement('div');
        warn.textContent = '\u26A0';
        warn.title = 'You have not invested in this spec — attack will work at base power.';
        Object.assign(warn.style, {
          position: 'absolute',
          top: '2px',
          right: '4px',
          fontSize: '11px',
          color: '#ffb830',
        });
        cell.appendChild(warn);
      }
    } else {
      // Empty slot
      cell.style.borderStyle = 'dashed';
      cell.style.borderColor = 'rgba(80, 70, 50, 0.5)';
    }

    // Slot label (LMB / RMB / 1–5) above the cell
    const labelText = (slotId === 'leftClick') ? 'LMB'
                    : (slotId === 'rightClick') ? 'RMB'
                    : slotId.replace('slot', '');
    const labelWrap = document.createElement('div');
    labelWrap.style.position = 'relative';
    labelWrap.style.display = 'flex';
    labelWrap.style.flexDirection = 'column';
    labelWrap.style.alignItems = 'center';
    const labelEl = document.createElement('div');
    labelEl.textContent = labelText;
    Object.assign(labelEl.style, {
      fontSize: '10px',
      letterSpacing: '0.5px',
      color: 'rgba(180, 170, 140, 0.7)',
      fontWeight: 'bold',
      marginBottom: '3px',
    });
    labelWrap.appendChild(labelEl);
    labelWrap.appendChild(cell);

    // Click → open picker (LMB/RMB) OR clear binding (any slot, with confirmation? for now: do nothing)
    cell.addEventListener('click', (e) => {
      e.stopPropagation();
      // For now: only LMB/RMB get the picker. Keyboard slots are managed via drag.
      if (slotId === 'leftClick' || slotId === 'rightClick') {
        this._openInlinePicker(slotId, cell);
      }
    });

    cell.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      // Right-click to clear
      mgr.setHotbarSlot(slotId, null);
      this._refresh();
    });

    // Drag-and-drop target — accept attacks and consumables
    cell.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      cell.style.background = 'rgba(200, 180, 100, 0.25)';
    });
    cell.addEventListener('dragleave', () => {
      cell.style.background = 'rgba(20, 18, 30, 0.85)';
    });
    cell.addEventListener('drop', (e) => {
      e.preventDefault();
      cell.style.background = 'rgba(20, 18, 30, 0.85)';
      let payload = null;
      try {
        const a = e.dataTransfer.getData('application/x-attack');
        if (a) payload = JSON.parse(a);
      } catch {}
      if (!payload) {
        try {
          const c = e.dataTransfer.getData('application/x-consumable');
          if (c) payload = JSON.parse(c);
        } catch {}
      }
      if (payload) {
        mgr.setHotbarSlot(slotId, payload);
        this._refresh();
      }
    });

    return labelWrap;
  }

  // Inline picker drawn under a clicked LMB/RMB slot in the Skill Book.
  // Shows the same 4 class attacks the in-combat picker would show.
  _openInlinePicker(slotId, anchorEl) {
    if (this._pickerOpen) {
      this._pickerOpen.remove();
      this._pickerOpen = null;
    }

    const mgr = this._skillManager;
    const popup = document.createElement('div');
    Object.assign(popup.style, {
      position: 'absolute',
      zIndex: '10001',
      background: 'linear-gradient(180deg, #1a1a2e, #16213e)',
      border: '1px solid #555',
      borderRadius: '6px',
      padding: '10px',
      boxShadow: '0 6px 20px rgba(0,0,0,0.7)',
      minWidth: '220px',
    });

    const title = document.createElement('div');
    title.textContent = `Bind ${slotId === 'leftClick' ? 'LMB' : 'RMB'} attack`;
    Object.assign(title.style, {
      fontSize: '11px', fontWeight: 'bold', color: '#f0c040',
      marginBottom: '8px', letterSpacing: '0.5px', textAlign: 'center',
    });
    popup.appendChild(title);

    for (const specKey of mgr.getSpecs()) {
      const spec = mgr.getSpec(specKey);
      if (!spec || !spec.specData) continue;
      const ranks = mgr.getPointsInTree(specKey);
      const specColor = spec.specData.color || '#888';

      const specHeader = document.createElement('div');
      specHeader.textContent = `${spec.specData.label.toUpperCase()} (${ranks} pts)`;
      Object.assign(specHeader.style, {
        fontSize: '10px', fontWeight: 'bold',
        color: specColor, textAlign: 'center',
        marginTop: '4px', marginBottom: '4px',
      });
      popup.appendChild(specHeader);

      const row = document.createElement('div');
      Object.assign(row.style, { display: 'flex', gap: '6px', justifyContent: 'center' });

      for (const def of [spec.specData.primary, spec.specData.secondary]) {
        if (!def) continue;
        const btn = document.createElement('button');
        const resolved = mgr.getResolvedAttack(def.id);
        Object.assign(btn.style, {
          padding: '6px 8px',
          background: 'rgba(20, 18, 30, 0.9)',
          border: `1px solid ${this._withAlpha(specColor, 0.5)}`,
          borderRadius: '4px',
          color: '#eee',
          cursor: 'pointer',
          fontSize: '11px',
          display: 'flex', alignItems: 'center', gap: '6px',
        });
        btn.innerHTML = `<span style="font-size:18px;">${def.icon || '?'}</span><span>${def.name}</span>`;
        btn.title = resolved
          ? `${def.name} — ${resolved.cooldown}s CD${resolved.cost ? ' • ' + resolved.cost + ' resource' : ''}`
          : def.name;
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          mgr.setHotbarSlot(slotId, { type: 'attack', id: def.id });
          if (this._pickerOpen) { this._pickerOpen.remove(); this._pickerOpen = null; }
          this._refresh();
        });
        row.appendChild(btn);
      }
      popup.appendChild(row);
    }

    // Position relative to anchor
    document.body.appendChild(popup);
    const rect = anchorEl.getBoundingClientRect();
    const popupRect = popup.getBoundingClientRect();
    let left = rect.left + rect.width / 2 - popupRect.width / 2;
    let top = rect.bottom + 6;
    left = Math.max(4, Math.min(left, window.innerWidth - popupRect.width - 4));
    if (top + popupRect.height > window.innerHeight - 4) {
      top = rect.top - popupRect.height - 6;
    }
    popup.style.left = left + 'px';
    popup.style.top = top + 'px';

    this._pickerOpen = popup;

    // Click-away to close
    setTimeout(() => {
      const closeOnClickAway = (ev) => {
        if (popup && !popup.contains(ev.target)) {
          if (this._pickerOpen) { this._pickerOpen.remove(); this._pickerOpen = null; }
          document.removeEventListener('click', closeOnClickAway, true);
        }
      };
      document.addEventListener('click', closeOnClickAway, true);
    }, 0);
  }

  // -----------------------------------------------------------
  // Spec tabs
  // -----------------------------------------------------------

  _buildSpecTabs() {
    const mgr = this._skillManager;
    const wrap = document.createElement('div');
    Object.assign(wrap.style, {
      display: 'flex',
      gap: '4px',
      marginBottom: '0',
      paddingTop: '8px',
    });

    const specKeys = mgr.getSpecs();
    const hasUnspentPoints = mgr.getSkillPointsAvailable() > 0;

    for (const specKey of specKeys) {
      const spec = mgr.getSpec(specKey);
      if (!spec || !spec.specData) continue;
      const isActive = (specKey === this._activeSpecKey);
      const ranks = mgr.getPointsInTree(specKey);
      const specColor = spec.specData.color || '#888';

      const tab = document.createElement('div');
      Object.assign(tab.style, {
        flex: '1',
        padding: '10px 12px',
        background: isActive ? this._withAlpha(specColor, 0.2) : 'rgba(20, 18, 30, 0.6)',
        border: isActive
          ? `2px solid ${specColor}`
          : '1px solid rgba(80, 70, 50, 0.6)',
        borderBottom: isActive ? 'none' : '1px solid rgba(80, 70, 50, 0.6)',
        borderRadius: '4px 4px 0 0',
        cursor: isActive ? 'default' : 'pointer',
        textAlign: 'center',
        position: 'relative',
        transition: 'background 0.15s',
      });

      tab.innerHTML = `
        <div style="font-size:14px;font-weight:bold;color:${isActive ? specColor : '#bbb'};letter-spacing:1px;">
          ${spec.specData.icon || ''} ${spec.specData.label.toUpperCase()}
        </div>
        <div style="font-size:10px;color:#999;margin-top:2px;">${ranks} pts invested</div>
      `;

      // Pulse dot if there are unspent points
      if (hasUnspentPoints) {
        const dot = document.createElement('div');
        Object.assign(dot.style, {
          position: 'absolute', top: '6px', right: '8px',
          width: '8px', height: '8px',
          borderRadius: '50%',
          background: '#7be07b',
          boxShadow: '0 0 6px rgba(123, 224, 123, 0.8)',
        });
        tab.appendChild(dot);
      }

      tab.addEventListener('click', () => {
        if (this._activeSpecKey !== specKey) {
          this._activeSpecKey = specKey;
          this._refresh();
        }
      });

      wrap.appendChild(tab);
    }

    return wrap;
  }

  // -----------------------------------------------------------
  // Tree (active spec)
  // -----------------------------------------------------------

  _buildTree(specKey) {
    const mgr = this._skillManager;
    const spec = mgr.getSpec(specKey);
    if (!spec || !spec.specData) return document.createElement('div');

    const specColor = spec.specData.color || '#888';

    const wrap = document.createElement('div');
    Object.assign(wrap.style, {
      border: `2px solid ${specColor}`,
      borderTop: 'none',
      borderRadius: '0 0 6px 6px',
      padding: '12px 14px',
      background: 'rgba(10, 8, 6, 0.4)',
    });

    // Header strip with primary/secondary attack reference
    const attackRef = document.createElement('div');
    Object.assign(attackRef.style, {
      display: 'flex',
      justifyContent: 'space-around',
      padding: '6px 0 10px 0',
      borderBottom: '1px solid #333',
      marginBottom: '10px',
    });
    if (spec.specData.primary) {
      attackRef.appendChild(this._buildAttackChip(spec.specData.primary, 'PRIMARY'));
    }
    if (spec.specData.secondary) {
      attackRef.appendChild(this._buildAttackChip(spec.specData.secondary, 'SECONDARY'));
    }
    wrap.appendChild(attackRef);

    // Group nodes by tier
    const tiers = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    for (const node of spec.specData.tree) {
      if (tiers[node.tier]) tiers[node.tier].push(node);
    }

    for (let tier = 1; tier <= 5; tier++) {
      wrap.appendChild(this._buildTierRow(specKey, tier, tiers[tier], specColor));
    }

    return wrap;
  }

  _buildAttackChip(attackDef, label) {
    const chip = document.createElement('div');
    Object.assign(chip.style, {
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '4px 10px',
      background: 'rgba(30, 28, 40, 0.6)',
      borderRadius: '4px',
      cursor: 'grab',
    });
    chip.draggable = true;
    chip.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('application/x-attack',
        JSON.stringify({ type: 'attack', id: attackDef.id }));
      e.dataTransfer.effectAllowed = 'move';
    });
    chip.innerHTML = `
      <span style="font-size:22px;">${attackDef.icon || '?'}</span>
      <span>
        <div style="font-size:9px;color:#888;letter-spacing:0.5px;">${label}</div>
        <div style="font-size:12px;color:#e0ddd5;font-weight:bold;">${attackDef.name}</div>
      </span>
    `;
    return chip;
  }

  _buildTierRow(specKey, tier, nodes, specColor) {
    const mgr = this._skillManager;
    const pointsInTree = mgr.getPointsInTree(specKey);
    const gate = TIER_GATES[tier] || 0;
    const isUnlocked = pointsInTree >= gate;
    const ptsNeeded = gate - pointsInTree;

    const row = document.createElement('div');
    Object.assign(row.style, {
      marginBottom: '12px',
      padding: '8px 10px',
      background: 'rgba(0, 0, 0, 0.25)',
      border: `1px solid ${isUnlocked ? this._withAlpha(specColor, 0.4) : 'rgba(80, 70, 50, 0.4)'}`,
      borderRadius: '4px',
      opacity: isUnlocked ? '1' : '0.6',
    });

    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex', justifyContent: 'space-between',
      fontSize: '11px', letterSpacing: '0.5px',
      color: isUnlocked ? specColor : '#888',
      marginBottom: '6px',
      fontWeight: 'bold',
    });
    const tierLabel = tier === 5 ? 'TIER 5 — CAPSTONE' : `TIER ${tier}`;
    let statusText = '';
    if (!isUnlocked) {
      statusText = `🔒 need ${ptsNeeded} more pts`;
    } else if (tier === 3) {
      statusText = '✓ unlocked — choose ONE branch';
    } else if (tier > 1) {
      statusText = '✓ unlocked';
    }
    header.innerHTML = `<span>${tierLabel}  (gate ${gate})</span><span>${statusText}</span>`;
    row.appendChild(header);

    if (tier === 5) {
      // Capstone — single big card
      if (nodes.length > 0) {
        row.appendChild(this._buildCapstoneCard(specKey, nodes[0], isUnlocked, specColor));
      }
    } else if (tier === 3) {
      // Branch choice — side-by-side OR
      row.appendChild(this._buildBranchChoice(specKey, nodes, isUnlocked, specColor));
    } else {
      // Tier 1, 2, 4 — flat node list
      const list = document.createElement('div');
      Object.assign(list.style, {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
      });
      for (const node of nodes) {
        list.appendChild(this._buildNodeRow(specKey, node, isUnlocked, specColor));
      }
      row.appendChild(list);
    }

    return row;
  }

  _buildNodeRow(specKey, node, tierUnlocked, specColor) {
    const mgr = this._skillManager;
    const rank = mgr.player ? this._getNodeRank(specKey, node.id) : 0;
    const isMaxed = rank >= node.maxRank;
    const canSpendNow = tierUnlocked && !isMaxed && mgr.getSkillPointsAvailable() > 0;

    const el = document.createElement('div');
    Object.assign(el.style, {
      display: 'flex',
      alignItems: 'center',
      padding: '6px 8px',
      background: rank > 0 ? this._withAlpha(specColor, 0.10) : 'rgba(20, 18, 30, 0.5)',
      border: '1px solid ' + (rank > 0 ? this._withAlpha(specColor, 0.4) : 'rgba(60, 55, 45, 0.4)'),
      borderRadius: '3px',
      cursor: canSpendNow ? 'pointer' : 'default',
      transition: 'background 0.15s',
    });

    // Rank dots
    const dotsEl = document.createElement('div');
    dotsEl.style.fontSize = '14px';
    dotsEl.style.letterSpacing = '1px';
    dotsEl.style.minWidth = '70px';
    dotsEl.style.color = specColor;
    let dots = '';
    for (let i = 0; i < node.maxRank; i++) {
      dots += i < rank ? '◉' : '◯';
    }
    dotsEl.textContent = dots;
    el.appendChild(dotsEl);

    // Name + description
    const text = document.createElement('div');
    Object.assign(text.style, { flex: '1', marginLeft: '8px' });
    const nameLine = document.createElement('div');
    nameLine.innerHTML = `<span style="font-size:13px;font-weight:bold;color:#e0ddd5;">${node.name}</span>
      <span style="font-size:10px;color:#888;margin-left:6px;">(${rank}/${node.maxRank})</span>
      ${isMaxed ? '<span style="font-size:9px;color:#7be07b;background:rgba(0,80,0,0.4);padding:1px 4px;border-radius:3px;margin-left:6px;">MAX</span>' : ''}`;
    text.appendChild(nameLine);

    const descLine = document.createElement('div');
    descLine.textContent = node.description;
    Object.assign(descLine.style, { fontSize: '11px', color: '#999', marginTop: '2px' });
    text.appendChild(descLine);

    el.appendChild(text);

    // Hover for detail
    el.addEventListener('mouseenter', () => {
      this._hoveredNodeId = node.id;
      this._refreshDetailPanel();
      el.style.background = this._withAlpha(specColor, 0.15);
    });
    el.addEventListener('mouseleave', () => {
      el.style.background = rank > 0 ? this._withAlpha(specColor, 0.10) : 'rgba(20, 18, 30, 0.5)';
    });

    // Click to spend
    if (canSpendNow) {
      el.addEventListener('click', () => {
        const result = mgr.spendPoint(specKey, node.id);
        if (result.ok) {
          this._refresh();
        } else {
          this._flashError(el, result.reason);
        }
      });
    }

    return el;
  }

  _buildBranchChoice(specKey, nodes, tierUnlocked, specColor) {
    const wrap = document.createElement('div');
    Object.assign(wrap.style, {
      display: 'flex',
      alignItems: 'stretch',
      justifyContent: 'space-around',
      gap: '6px',
    });

    if (nodes.length === 0) return wrap;

    // Determine which branch (if any) is locked-in
    const mgr = this._skillManager;
    let chosenGroup = null;
    for (const n of nodes) {
      if (this._getNodeRank(specKey, n.id) > 0) {
        chosenGroup = n.branchGroup;
        break;
      }
    }

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const isMine = chosenGroup && this._getNodeRank(specKey, node.id) > 0;
      const isLockedByOther = chosenGroup && !isMine;

      const card = document.createElement('div');
      Object.assign(card.style, {
        flex: '1',
        padding: '8px',
        background: isMine ? this._withAlpha(specColor, 0.18) : 'rgba(20, 18, 30, 0.6)',
        border: `2px solid ${isMine ? specColor : (isLockedByOther ? 'rgba(80, 70, 50, 0.5)' : this._withAlpha(specColor, 0.4))}`,
        borderRadius: '4px',
        cursor: (tierUnlocked && !isLockedByOther && this._getNodeRank(specKey, node.id) < node.maxRank && mgr.getSkillPointsAvailable() > 0) ? 'pointer' : 'default',
        opacity: isLockedByOther ? '0.5' : '1',
        transition: 'background 0.15s',
        textAlign: 'center',
        position: 'relative',
      });

      const rank = this._getNodeRank(specKey, node.id);
      let dots = '';
      for (let j = 0; j < node.maxRank; j++) {
        dots += j < rank ? '◉' : '◯';
      }

      card.innerHTML = `
        <div style="font-size:13px;font-weight:bold;color:${isMine ? specColor : '#e0ddd5'};margin-bottom:4px;">${node.name}</div>
        <div style="font-size:14px;color:${specColor};margin-bottom:4px;">${dots}  (${rank}/${node.maxRank})</div>
        <div style="font-size:10px;color:#999;line-height:1.3;">${node.description}</div>
        ${isLockedByOther ? '<div style="font-size:9px;color:#a55;margin-top:4px;">🔒 Branch locked</div>' : ''}
      `;

      if (tierUnlocked && !isLockedByOther) {
        card.addEventListener('click', () => {
          // First investment? Show branch confirm popup
          if (rank === 0 && !chosenGroup) {
            this._confirmBranchChoice(specKey, node);
          } else {
            const result = mgr.spendPoint(specKey, node.id);
            if (result.ok) this._refresh();
            else this._flashError(card, result.reason);
          }
        });
      }

      card.addEventListener('mouseenter', () => {
        this._hoveredNodeId = node.id;
        this._refreshDetailPanel();
      });

      wrap.appendChild(card);

      // OR divider between cards
      if (i < nodes.length - 1) {
        const orDiv = document.createElement('div');
        orDiv.textContent = 'OR';
        Object.assign(orDiv.style, {
          alignSelf: 'center',
          fontSize: '11px',
          color: '#888',
          fontWeight: 'bold',
          padding: '0 4px',
        });
        wrap.appendChild(orDiv);
      }
    }

    return wrap;
  }

  _confirmBranchChoice(specKey, node) {
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
      padding: '20px 24px',
      maxWidth: '420px',
      color: '#e0ddd5',
      fontFamily: "'Segoe UI', Arial, sans-serif",
      textAlign: 'center',
    });
    dialog.innerHTML = `
      <div style="font-size:14px;font-weight:bold;color:#f0c040;margin-bottom:10px;">CHOOSE TIER 3 BRANCH</div>
      <div style="font-size:12px;color:#ccc;margin-bottom:14px;line-height:1.4;">
        Choose <b>${node.name}</b> as your Tier 3 branch?<br>
        You can only invest in one branch per spec until you respec.
      </div>
    `;
    const btnRow = document.createElement('div');
    Object.assign(btnRow.style, { display: 'flex', gap: '10px', justifyContent: 'center' });
    const cancel = document.createElement('button');
    cancel.textContent = 'CANCEL';
    Object.assign(cancel.style, this._buttonStyle());
    cancel.addEventListener('click', () => overlay.remove());
    const confirm = document.createElement('button');
    confirm.textContent = 'CONFIRM';
    Object.assign(confirm.style, this._buttonStyle('gold'));
    confirm.addEventListener('click', () => {
      overlay.remove();
      const result = this._skillManager.spendPoint(specKey, node.id);
      if (result.ok) this._refresh();
    });
    btnRow.appendChild(cancel);
    btnRow.appendChild(confirm);
    dialog.appendChild(btnRow);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
  }

  _buildCapstoneCard(specKey, node, tierUnlocked, specColor) {
    const mgr = this._skillManager;
    const rank = this._getNodeRank(specKey, node.id);
    const isInvested = rank > 0;
    const canInvest = tierUnlocked && !isInvested && mgr.getSkillPointsAvailable() > 0;

    const card = document.createElement('div');
    Object.assign(card.style, {
      padding: '14px 16px',
      background: isInvested
        ? `linear-gradient(180deg, ${this._withAlpha('#f0c040', 0.18)}, ${this._withAlpha(specColor, 0.18)})`
        : 'rgba(20, 18, 30, 0.7)',
      border: isInvested ? '2px solid #f0c040' : `2px ${tierUnlocked ? 'solid' : 'dashed'} ${this._withAlpha(specColor, 0.5)}`,
      borderRadius: '6px',
      textAlign: 'center',
      cursor: canInvest ? 'pointer' : 'default',
      position: 'relative',
    });

    card.innerHTML = `
      <div style="font-size:18px;color:#f0c040;font-weight:bold;letter-spacing:1px;">★ ${node.name.toUpperCase()} ★</div>
      <div style="font-size:11px;color:#bbb;margin-top:6px;line-height:1.5;max-width:480px;margin-left:auto;margin-right:auto;">
        ${node.description}
      </div>
      ${!tierUnlocked ? `<div style="font-size:10px;color:#888;margin-top:8px;">Available at 20 points in this tree.</div>` : ''}
      ${isInvested ? '<div style="font-size:10px;color:#f0c040;margin-top:8px;font-weight:bold;">✓ INVESTED</div>' : ''}
    `;

    if (canInvest) {
      card.addEventListener('click', () => {
        const result = mgr.spendPoint(specKey, node.id);
        if (result.ok) this._refresh();
      });
    }
    card.addEventListener('mouseenter', () => {
      this._hoveredNodeId = node.id;
      this._refreshDetailPanel();
    });

    return card;
  }

  // -----------------------------------------------------------
  // Hover detail panel (bottom)
  // -----------------------------------------------------------

  _buildDetailPanel() {
    const wrap = document.createElement('div');
    wrap.id = 'skill-book-detail-panel';
    Object.assign(wrap.style, {
      marginTop: '14px',
      padding: '10px 14px',
      background: 'rgba(0, 0, 0, 0.4)',
      border: '1px solid #2a2540',
      borderRadius: '4px',
      minHeight: '60px',
      fontSize: '12px',
      color: '#bbb',
    });

    if (!this._hoveredNodeId) {
      wrap.innerHTML = '<i style="color:#666;">Hover a tree node to see details.</i>';
      return wrap;
    }

    this._populateDetailPanel(wrap, this._hoveredNodeId);
    return wrap;
  }

  _refreshDetailPanel() {
    const el = document.getElementById('skill-book-detail-panel');
    if (!el) return;
    el.innerHTML = '';
    if (!this._hoveredNodeId) {
      el.innerHTML = '<i style="color:#666;">Hover a tree node to see details.</i>';
      return;
    }
    this._populateDetailPanel(el, this._hoveredNodeId);
  }

  _populateDetailPanel(target, nodeId) {
    const mgr = this._skillManager;
    // Find the node
    let foundNode = null;
    let foundSpec = null;
    for (const specKey of mgr.getSpecs()) {
      const spec = mgr.getSpec(specKey);
      if (!spec || !spec.specData) continue;
      const node = spec.specData.tree.find(n => n.id === nodeId);
      if (node) { foundNode = node; foundSpec = spec; break; }
    }
    if (!foundNode || !foundSpec) return;

    const rank = this._getNodeRank(foundSpec.specKey || this._activeSpecKey, foundNode.id);
    const tierLabel = `Tier ${foundNode.tier}`;
    const specColor = foundSpec.specData.color || '#888';
    const tierName = foundNode.tier === 5 ? 'CAPSTONE' : tierLabel;

    target.innerHTML = `
      <div style="font-weight:bold;color:#e0ddd5;font-size:13px;margin-bottom:4px;">
        ${foundNode.name}
        <span style="font-weight:normal;color:${specColor};font-size:11px;margin-left:6px;">
          ${foundSpec.specData.label} • ${tierName} • Rank ${rank}/${foundNode.maxRank}
        </span>
      </div>
      <div style="color:#999;line-height:1.4;">${foundNode.description}</div>
    `;
  }

  // -----------------------------------------------------------
  // Footer
  // -----------------------------------------------------------

  _buildFooter() {
    const mgr = this._skillManager;
    const player = this._player;
    const wrap = document.createElement('div');
    Object.assign(wrap.style, {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: '16px',
      paddingTop: '10px',
      borderTop: '1px solid #333',
      fontSize: '12px',
    });

    const left = document.createElement('div');
    const pts = mgr.getSkillPointsAvailable();
    left.innerHTML = pts > 0
      ? `<span style="color:#7be07b;font-weight:bold;">${pts} Skill Points available</span>`
      : `<span style="color:#888;">No skill points available</span>`;
    wrap.appendChild(left);

    const right = document.createElement('div');
    const cost = (player && player.level) ? player.level * 25 : 0;
    const isFree = player && !player.freeRespecUsed;
    right.innerHTML = isFree
      ? `<span style="color:#888;">Visit the Trainer to respec — </span><span style="color:#f0c040;">FIRST RESPEC IS FREE</span>`
      : `<span style="color:#888;">Visit the Trainer to respec (${cost}g)</span>`;
    wrap.appendChild(right);

    return wrap;
  }

  // -----------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------

  _buildSectionTitle(text) {
    const el = document.createElement('div');
    el.textContent = text;
    Object.assign(el.style, {
      fontSize: '11px',
      fontWeight: 'bold',
      letterSpacing: '1.5px',
      color: '#888',
      paddingBottom: '4px',
      marginTop: '8px',
      marginBottom: '6px',
    });
    return el;
  }

  _buttonStyle(variant) {
    const base = {
      padding: '8px 16px',
      background: 'rgba(40, 38, 60, 0.9)',
      border: '1px solid #555',
      borderRadius: '4px',
      color: '#e0ddd5',
      cursor: 'pointer',
      fontSize: '12px',
      letterSpacing: '0.5px',
      fontWeight: 'bold',
    };
    if (variant === 'gold') {
      base.background = 'rgba(120, 90, 20, 0.7)';
      base.border = '1px solid #c9a84c';
      base.color = '#f0c040';
    }
    return base;
  }

  _flashError(el, reason) {
    const orig = el.style.background;
    el.style.background = 'rgba(180, 40, 40, 0.4)';
    el.title = reason || 'Cannot spend';
    setTimeout(() => { el.style.background = orig; el.title = ''; }, 250);
  }

  _refresh() {
    if (this._onRefresh) {
      this._onRefresh();
    } else if (this._container) {
      this._buildContent(this._container);
    }
  }

  _getNodeRank(specKey, nodeId) {
    if (!this._skillManager) return 0;
    const spec = this._skillManager.getSpec(specKey);
    if (!spec) return 0;
    const tree = (this._player && this._player.skillTree) || {};
    const branchRanks = tree[spec.treeKey] || {};
    return branchRanks[nodeId] || 0;
  }

  _findSpecForAttack(attackId) {
    if (!this._skillManager) return null;
    for (const specKey of this._skillManager.getSpecs()) {
      const spec = this._skillManager.getSpec(specKey);
      if (!spec || !spec.specData) continue;
      if (spec.specData.primary && spec.specData.primary.id === attackId) return specKey;
      if (spec.specData.secondary && spec.specData.secondary.id === attackId) return specKey;
    }
    return null;
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

  _titleCase(s) {
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
}
