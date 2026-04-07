/* ---------------------------------------------------------------
 *  InventoryUI — full-screen inventory + equipment overlay panel
 *
 *  Opened with the I key.  Two-column layout:
 *    Left  — Equipment doll (6 slots) + stat summary
 *    Right — 10x6 inventory grid
 *    Bottom bar — gold display + junk value / sell button
 *
 *  All DOM is built with createElement + inline styles so the file
 *  is self-contained (no external CSS required).
 * --------------------------------------------------------------- */

const RARITY_COLORS = {
  junk:      '#888888',
  common:    '#ffffff',
  uncommon:  '#3498db',
  rare:      '#f1c40f',
  epic:      '#9b59b6',
  legendary: '#e67e22',
};

const SLOT_LABELS = {
  mainHand: 'Main Hand',
  offHand:  'Off Hand',
  chest:    'Chest',
  legs:     'Legs',
  belt:     'Belt',
  boots:    'Boots',
};

// Grid dimensions for equipment slot frames (w x h in "cell" units)
const SLOT_FRAMES = {
  chest:    { w: 2, h: 2 },
  mainHand: { w: 1, h: 2 },
  offHand:  { w: 1, h: 2 },
  legs:     { w: 2, h: 2 },
  belt:     { w: 2, h: 1 },
  boots:    { w: 1, h: 2 },
};

const CELL = 36; // px per inventory cell

// ---------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------

function _el(tag, styles, attrs) {
  const el = document.createElement(tag);
  if (styles) Object.assign(el.style, styles);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (k === 'textContent') el.textContent = v;
      else if (k === 'innerHTML') el.innerHTML = v;
      else el.setAttribute(k, v);
    }
  }
  return el;
}

function _rarityColor(rarity) {
  return RARITY_COLORS[rarity] || '#ffffff';
}

function _statLabel(key) {
  const map = {
    maxHPBonus: 'Max HP',
    maxManaBonus: 'Max Mana',
    attackSpeedPercent: 'Attack Speed',
    critChanceBonus: 'Crit Chance',
    lifestealPercent: 'Life Steal',
    damageReductionPercent: 'Damage Reduction',
    staminaRegenPercent: 'Stamina Regen',
    rageGenerationPercent: 'Rage Gen',
    str: 'Strength',
    int: 'Intellect',
    agi: 'Agility',
    sta: 'Stamina',
    moveSpeedPercent: 'Move Speed',
    manaRegenBonus: 'Mana Regen',
    reflectDamagePercent: 'Reflect Damage',
    critDamageBonus: 'Crit Damage',
    dodgeChanceBonus: 'Dodge Chance',
    armorBonus: 'Armor',
    damageBonus: 'Damage',
  };
  return map[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
}

function _formatAffixValue(affix) {
  if (affix.percent || affix.statKey.includes('Percent') || affix.statKey.includes('Chance') || affix.statKey.includes('Bonus') && affix.value < 1) {
    return `+${(affix.value * 100).toFixed(1)}%`;
  }
  return `+${affix.value}`;
}

// ---------------------------------------------------------------
//  InventoryUI
// ---------------------------------------------------------------

export class InventoryUI {
  constructor() {
    this._overlay = null;
    this._tooltip = null;
    this._contextMenu = null;
    this._resolve = null;
    this._boundKeyHandler = null;
  }

  /**
   * Show the inventory panel.
   *
   * @param {object} player       – player entity (equipment, attributes, stats, level, classId, etc.)
   * @param {object} inventory    – Inventory instance (grid, items, etc.)
   * @param {object} skillManager – SkillManager (unused currently, reserved for future)
   * @param {object} [options={}]
   * @param {boolean} [options.atVendor=false]
   * @param {function} [options.onEquip]    – (item, slot) => void
   * @param {function} [options.onUnequip]  – (slot) => void
   * @param {function} [options.onDrop]     – (item) => void
   * @param {function} [options.onSellJunk] – () => void
   * @returns {Promise} resolves when the panel is closed
   */
  show(player, inventory, skillManager, options = {}) {
    // Tear down any previous instance
    this.hide();

    this._player = player;
    this._inventory = inventory;
    this._skillManager = skillManager;
    this._options = options;

    return new Promise((resolve) => {
      this._resolve = resolve;
      this._buildOverlay();
      this._render();
      this._attachGlobalListeners();
    });
  }

  /**
   * Build inventory + equipment content into an existing container element.
   *
   * Unlike show(), this does NOT create a full-screen overlay, does NOT
   * add dimming, and does NOT handle ESC / keyboard close. The caller
   * owns the container lifecycle.
   *
   * @param {HTMLElement} container  – DOM element to render into
   * @param {object} player         – player entity
   * @param {object} inventory      – Inventory instance
   * @param {object} skillManager   – SkillManager (reserved)
   * @param {object} [options={}]
   * @param {boolean}  [options.atVendor]
   * @param {function} [options.onEquip]         – (item, slot) => void
   * @param {function} [options.onUnequip]       – (slot) => void
   * @param {function} [options.onDrop]          – (item) => void
   * @param {function} [options.onSellJunk]      – () => void
   * @param {function} [options.onAssignHotbar]  – (itemId, slotIndex) => void
   */
  buildInto(container, player, inventory, skillManager, options = {}) {
    // Store state so _render / helpers work identically
    this._player = player;
    this._inventory = inventory;
    this._skillManager = skillManager;
    this._options = options;

    // Clear previous content
    container.innerHTML = '';

    // Apply base styles to the container
    Object.assign(container.style, {
      fontFamily: '"Segoe UI", Arial, sans-serif',
      color: '#ddd',
      userSelect: 'none',
    });

    // Build panel structure (no overlay, no close button, no ESC)
    this._panel = _el('div', {
      display: 'flex',
      flexDirection: 'column',
      width: '780px',
      maxHeight: '100%',
      backgroundColor: '#1a1a2e',
      border: '2px solid #444',
      borderRadius: '8px',
      overflow: 'hidden',
    });

    // Header bar (no close button)
    const header = _el('div', {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '8px 16px',
      backgroundColor: '#16213e',
      borderBottom: '1px solid #333',
    });
    const title = _el('span', { fontSize: '18px', fontWeight: 'bold', color: '#e0e0e0' }, { textContent: 'Inventory' });
    header.appendChild(title);
    this._panel.appendChild(header);

    // Body — two columns
    this._body = _el('div', {
      display: 'flex',
      flexDirection: 'row',
      padding: '12px',
      gap: '16px',
      overflowY: 'auto',
      flex: '1',
    });
    this._panel.appendChild(this._body);

    // Bottom bar
    this._bottomBar = _el('div', {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '8px 16px',
      backgroundColor: '#16213e',
      borderTop: '1px solid #333',
      fontSize: '14px',
    });
    this._panel.appendChild(this._bottomBar);

    container.appendChild(this._panel);

    // Tooltip (positioned fixed, lives in container)
    this._tooltip = _el('div', {
      position: 'fixed',
      display: 'none',
      zIndex: '9100',
      backgroundColor: '#111',
      border: '1px solid #555',
      borderRadius: '6px',
      padding: '10px 14px',
      maxWidth: '280px',
      fontSize: '12px',
      lineHeight: '1.5',
      pointerEvents: 'none',
      color: '#ddd',
      boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
    });
    container.appendChild(this._tooltip);

    // Use container as the root for context menus (instead of overlay)
    this._embeddedRoot = container;

    // Render content
    this._render();
  }

  // ===========================================================
  //  Overlay skeleton
  // ===========================================================

  _buildOverlay() {
    // Full-screen overlay
    this._overlay = _el('div', {
      position: 'fixed',
      top: '0', left: '0', width: '100%', height: '100%',
      backgroundColor: 'rgba(0,0,0,0.85)',
      zIndex: '9000',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '"Segoe UI", Arial, sans-serif',
      color: '#ddd',
      userSelect: 'none',
    });

    // Panel container
    this._panel = _el('div', {
      display: 'flex',
      flexDirection: 'column',
      width: '780px',
      maxHeight: '90vh',
      backgroundColor: '#1a1a2e',
      border: '2px solid #444',
      borderRadius: '8px',
      overflow: 'hidden',
    });

    // Header bar
    const header = _el('div', {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '8px 16px',
      backgroundColor: '#16213e',
      borderBottom: '1px solid #333',
    });
    const title = _el('span', { fontSize: '18px', fontWeight: 'bold', color: '#e0e0e0' }, { textContent: 'Inventory' });
    const closeBtn = _el('button', {
      background: 'none', border: '1px solid #666', color: '#ccc',
      padding: '4px 12px', cursor: 'pointer', borderRadius: '4px',
      fontSize: '14px',
    }, { textContent: 'X' });
    closeBtn.addEventListener('click', () => this.hide());
    closeBtn.addEventListener('mouseenter', () => { closeBtn.style.backgroundColor = '#333'; });
    closeBtn.addEventListener('mouseleave', () => { closeBtn.style.backgroundColor = 'transparent'; });
    header.appendChild(title);
    header.appendChild(closeBtn);
    this._panel.appendChild(header);

    // Body — two columns
    this._body = _el('div', {
      display: 'flex',
      flexDirection: 'row',
      padding: '12px',
      gap: '16px',
      overflowY: 'auto',
      flex: '1',
    });
    this._panel.appendChild(this._body);

    // Bottom bar
    this._bottomBar = _el('div', {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '8px 16px',
      backgroundColor: '#16213e',
      borderTop: '1px solid #333',
      fontSize: '14px',
    });
    this._panel.appendChild(this._bottomBar);

    this._overlay.appendChild(this._panel);

    // Tooltip (positioned absolutely within overlay)
    this._tooltip = _el('div', {
      position: 'fixed',
      display: 'none',
      zIndex: '9100',
      backgroundColor: '#111',
      border: '1px solid #555',
      borderRadius: '6px',
      padding: '10px 14px',
      maxWidth: '280px',
      fontSize: '12px',
      lineHeight: '1.5',
      pointerEvents: 'none',
      color: '#ddd',
      boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
    });
    this._overlay.appendChild(this._tooltip);

    document.body.appendChild(this._overlay);
  }

  // ===========================================================
  //  Full re-render
  // ===========================================================

  _render() {
    this._body.innerHTML = '';
    this._bottomBar.innerHTML = '';

    // ---- Left column: Equipment + Stats ----
    const leftCol = _el('div', {
      display: 'flex',
      flexDirection: 'column',
      width: '280px',
      flexShrink: '0',
    });

    leftCol.appendChild(this._buildEquipmentDoll());
    leftCol.appendChild(this._buildStatSummary());
    this._body.appendChild(leftCol);

    // ---- Right column: Inventory grid ----
    const rightCol = _el('div', {
      display: 'flex',
      flexDirection: 'column',
      flex: '1',
      minWidth: '0',
    });

    const gridLabel = _el('div', {
      fontSize: '13px', color: '#999', marginBottom: '6px', fontWeight: 'bold',
    }, { textContent: 'Backpack' });
    rightCol.appendChild(gridLabel);
    rightCol.appendChild(this._buildInventoryGrid());
    this._body.appendChild(rightCol);

    // ---- Bottom bar ----
    this._renderBottomBar();
  }

  // ===========================================================
  //  Equipment Doll
  // ===========================================================

  _highlightValidSlots(targetSlot) {
    if (!this._equipmentSlotEls) return;
    for (const [slotName, el] of Object.entries(this._equipmentSlotEls)) {
      if (slotName === targetSlot) {
        // Remember original border color so we can restore on clear
        if (el.dataset.origBorder === undefined) {
          el.dataset.origBorder = el.style.borderColor || '';
        }
        el.style.boxShadow = '0 0 12px 3px rgba(241,196,15,0.7)';
        el.style.borderColor = '#f1c40f';
      }
    }
  }

  _clearSlotHighlights() {
    if (!this._equipmentSlotEls) return;
    for (const el of Object.values(this._equipmentSlotEls)) {
      el.style.boxShadow = '';
      // Restore original border color (captured before highlight applied)
      if (el.dataset.origBorder !== undefined) {
        el.style.borderColor = el.dataset.origBorder;
        delete el.dataset.origBorder;
      }
    }
  }

  _buildEquipmentDoll() {
    this._equipmentSlotEls = {};
    const wrapper = _el('div', {
      position: 'relative',
      width: '260px',
      height: '260px',
      margin: '0 auto 12px auto',
    });

    // Character silhouette area (center)
    const silhouette = _el('div', {
      position: 'absolute',
      left: '90px', top: '30px',
      width: '80px', height: '180px',
      background: 'radial-gradient(ellipse at center, rgba(60,60,100,0.3) 0%, transparent 70%)',
      borderRadius: '40px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '48px',
      color: 'rgba(255,255,255,0.12)',
    }, { textContent: '\u{1F9D9}' });
    wrapper.appendChild(silhouette);

    // Slot positions (px offsets within the 260x260 wrapper)
    const positions = {
      chest:    { x: 90,  y: 20  },
      mainHand: { x: 20,  y: 30  },
      offHand:  { x: 200, y: 30  },
      legs:     { x: 90,  y: 110 },
      belt:     { x: 20,  y: 130 },
      boots:    { x: 200, y: 130 },
    };

    const equipment = this._player.equipment || {};

    for (const [slot, pos] of Object.entries(positions)) {
      const frame = SLOT_FRAMES[slot];
      const w = frame.w * CELL;
      const h = frame.h * CELL;
      const item = equipment[slot] || null;

      const slotEl = _el('div', {
        position: 'absolute',
        left: pos.x + 'px',
        top: pos.y + 'px',
        width: w + 'px',
        height: h + 'px',
        border: item ? `2px solid ${_rarityColor(item.rarity)}` : '2px dashed #555',
        borderRadius: '4px',
        backgroundColor: item ? 'rgba(40,40,70,0.8)' : 'rgba(20,20,40,0.5)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: item ? 'pointer' : 'default',
        overflow: 'hidden',
        boxSizing: 'border-box',
        transition: 'border-color 0.15s',
      });
      this._equipmentSlotEls[slot] = slotEl;

      // Equipment slot drag-and-drop target (accept equipment drops)
      slotEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        slotEl.style.borderColor = '#3498db';
        slotEl.style.backgroundColor = 'rgba(52,152,219,0.2)';
      });
      slotEl.addEventListener('dragleave', () => {
        slotEl.style.borderColor = item ? _rarityColor(item.rarity) : '#555';
        slotEl.style.backgroundColor = item ? 'rgba(40,40,70,0.8)' : 'rgba(20,20,40,0.5)';
      });
      slotEl.addEventListener('drop', (e) => {
        e.preventDefault();
        slotEl.style.borderColor = item ? _rarityColor(item.rarity) : '#555';
        slotEl.style.backgroundColor = item ? 'rgba(40,40,70,0.8)' : 'rgba(20,20,40,0.5)';
        try {
          const data = JSON.parse(e.dataTransfer.getData('application/item'));
          if (data.type === 'equipment' && data.slot === slot) {
            const draggedItem = this._inventory.items[data.itemId];
            if (draggedItem && this._options.onEquip) {
              this._options.onEquip(draggedItem, slot);
              this._render();
            }
          }
        } catch (_) { /* ignore bad data */ }
      });

      if (item) {
        const icon = _el('div', { fontSize: '18px', lineHeight: '1' }, { textContent: item.icon || '?' });
        const name = _el('div', {
          fontSize: '9px',
          color: _rarityColor(item.rarity),
          textAlign: 'center',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: (w - 6) + 'px',
        }, { textContent: item.name });
        slotEl.appendChild(icon);
        slotEl.appendChild(name);

        // Hover → tooltip
        slotEl.addEventListener('mouseenter', (e) => this._showItemTooltip(e, item, null));
        slotEl.addEventListener('mousemove', (e) => this._positionTooltip(e));
        slotEl.addEventListener('mouseleave', () => this._hideTooltip());
        slotEl.addEventListener('mouseenter', () => { slotEl.style.borderColor = '#fff'; });
        slotEl.addEventListener('mouseleave', () => { slotEl.style.borderColor = _rarityColor(item.rarity); });

        // Click → tooltip
        slotEl.addEventListener('click', (e) => {
          e.stopPropagation();
          this._showItemTooltip(e, item, null);
        });

        // Right-click → unequip
        slotEl.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (this._options.onUnequip) {
            this._options.onUnequip(slot);
            this._render();
          }
        });
      } else {
        // Empty slot label
        const label = _el('div', {
          fontSize: '9px', color: '#555', textAlign: 'center',
        }, { textContent: SLOT_LABELS[slot] });
        slotEl.appendChild(label);
      }

      wrapper.appendChild(slotEl);
    }

    return wrapper;
  }

  // ===========================================================
  //  Stat Summary
  // ===========================================================

  _buildStatSummary() {
    const container = _el('div', {
      backgroundColor: 'rgba(20,20,40,0.6)',
      border: '1px solid #333',
      borderRadius: '4px',
      padding: '10px',
      fontSize: '12px',
      lineHeight: '1.7',
    });

    const p = this._player;
    const classId = p.classId || 'unknown';
    const classConfig = p.classConfig || {};
    const classColor = classConfig.color || '#aaa';
    const level = p.level || 1;

    // Resolve attribute totals
    const baseAttr = p.baseAttributes || { str: 0, int: 0, agi: 0, sta: 0 };
    const bonusAttr = p.attributes || { str: 0, int: 0, agi: 0, sta: 0 };
    const str = (baseAttr.str || 0) + (bonusAttr.str || 0);
    const int = (baseAttr.int || 0) + (bonusAttr.int || 0);
    const agi = (baseAttr.agi || 0) + (bonusAttr.agi || 0);
    const sta = (baseAttr.sta || 0) + (bonusAttr.sta || 0);

    // Computed stats
    const baseDmg = p.baseDamage || p.damage || 0;
    const dmgBonus = p.damageBonus || 0;
    const totalDmg = baseDmg + dmgBonus;
    const armor = p.totalArmor || 0;
    const critPct = ((p.critChance || 0) * 100).toFixed(1);
    const moveSpd = Math.round((p.baseSpeed || p.speed || 100) * (p.speedMult || 1));

    const html = `
      <div style="font-size:14px;font-weight:bold;color:${classColor};margin-bottom:4px;">
        ${classConfig.name || classId} <span style="color:#999;font-weight:normal;">Lv ${level}</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 12px;">
        <span style="color:#e74c3c;">STR <strong>${str}</strong></span>
        <span style="color:#3498db;">INT <strong>${int}</strong></span>
        <span style="color:#2ecc71;">AGI <strong>${agi}</strong></span>
        <span style="color:#f39c12;">STA <strong>${sta}</strong></span>
      </div>
      <hr style="border:none;border-top:1px solid #333;margin:6px 0;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 12px;">
        <span>Damage <strong style="color:#e0e0e0;">${totalDmg}</strong></span>
        <span>Armor <strong style="color:#e0e0e0;">${armor}</strong></span>
        <span>Crit <strong style="color:#e0e0e0;">${critPct}%</strong></span>
        <span>Speed <strong style="color:#e0e0e0;">${moveSpd}</strong></span>
      </div>
    `;

    container.innerHTML = html;
    return container;
  }

  // ===========================================================
  //  Inventory Grid (10x6)
  // ===========================================================

  _buildInventoryGrid() {
    const inv = this._inventory;
    const cols = inv.cols || 10;
    const rows = inv.rows || 6;
    const gridW = cols * CELL;
    const gridH = rows * CELL;

    const grid = _el('div', {
      position: 'relative',
      width: gridW + 'px',
      height: gridH + 'px',
      backgroundColor: '#111',
      border: '1px solid #333',
      borderRadius: '4px',
      overflow: 'hidden',
    });

    // Draw cell lines
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = _el('div', {
          position: 'absolute',
          left: (c * CELL) + 'px',
          top: (r * CELL) + 'px',
          width: CELL + 'px',
          height: CELL + 'px',
          border: '1px solid #3a3a52',
          boxShadow: 'inset 0 0 4px rgba(100, 100, 150, 0.1)',
          boxSizing: 'border-box',
        });
        grid.appendChild(cell);
      }
    }

    // Render items on top of grid
    const rendered = new Set(); // Track rendered item IDs
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const itemId = inv.grid[r] && inv.grid[r][c];
        if (!itemId || rendered.has(itemId)) continue;

        const item = inv.items[itemId];
        if (!item) continue;

        // Check this is the top-left corner
        const isTop = r === 0 || (inv.grid[r - 1] && inv.grid[r - 1][c]) !== itemId;
        const isLeft = c === 0 || inv.grid[r][c - 1] !== itemId;
        if (!isTop || !isLeft) continue;

        rendered.add(itemId);

        const iw = (item.gridW || 1) * CELL;
        const ih = (item.gridH || 1) * CELL;
        const isJunk = item.slot === 'junk' || item.rarity === 'junk';

        const itemEl = _el('div', {
          position: 'absolute',
          left: (c * CELL + 1) + 'px',
          top: (r * CELL + 1) + 'px',
          width: (iw - 2) + 'px',
          height: (ih - 2) + 'px',
          border: `2px solid ${_rarityColor(item.rarity)}`,
          borderRadius: '3px',
          backgroundColor: isJunk ? 'rgba(60,60,60,0.6)' : 'rgba(40,40,70,0.7)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxSizing: 'border-box',
          overflow: 'hidden',
          transition: 'border-color 0.1s, transform 0.1s',
        });

        // Icon
        const icon = _el('div', {
          fontSize: iw > CELL ? '18px' : '14px',
          lineHeight: '1',
        }, { textContent: item.icon || '?' });
        itemEl.appendChild(icon);

        // Junk trash indicator
        if (isJunk) {
          const trashIcon = _el('div', {
            position: 'absolute',
            top: '1px', left: '2px',
            fontSize: '8px',
            color: '#777',
            opacity: '0.7',
          }, { textContent: '\u{1F5D1}' });
          itemEl.appendChild(trashIcon);
        }

        // Stack count overlay
        if (item.stackCount !== undefined && item.stackCount > 1) {
          const stack = _el('div', {
            position: 'absolute',
            bottom: '1px', right: '3px',
            fontSize: '10px',
            fontWeight: 'bold',
            color: '#fff',
            textShadow: '0 0 3px #000, 0 0 3px #000',
          }, { textContent: String(item.stackCount) });
          itemEl.appendChild(stack);
        }

        // Drag-and-drop
        itemEl.draggable = true;
        itemEl.addEventListener('dragstart', (e) => {
          const isPotion = item.isConsumable || item.isStackable;
          e.dataTransfer.setData('application/item', JSON.stringify({
            itemId: item.id,
            type: isPotion ? 'potion' : 'equipment',
            slot: item.slot,
          }));
          e.dataTransfer.effectAllowed = 'move';
          itemEl.style.opacity = '0.5';
          // Highlight valid equipment slot targets
          if (!isPotion && item.slot) {
            this._highlightValidSlots(item.slot);
          }
        });
        itemEl.addEventListener('dragend', (e) => {
          itemEl.style.opacity = '';
          this._clearSlotHighlights();
          // If dropped outside any valid target, treat as "drop to ground"
          if (e.dataTransfer.dropEffect === 'none' && this._options.onDrop) {
            this._options.onDrop(item);
            this._render();
          }
        });

        // Hover
        itemEl.addEventListener('mouseenter', (e) => {
          itemEl.style.transform = 'scale(1.04)';
          itemEl.style.zIndex = '10';
          const equipped = this._getEquippedForSlot(item.slot);
          this._showItemTooltip(e, item, equipped);
        });
        itemEl.addEventListener('mousemove', (e) => this._positionTooltip(e));
        itemEl.addEventListener('mouseleave', () => {
          itemEl.style.transform = '';
          itemEl.style.zIndex = '';
          this._hideTooltip();
        });

        // Shift-click → quick equip
        itemEl.addEventListener('click', (e) => {
          e.stopPropagation();
          this._hideContextMenu();
          if (e.shiftKey && this._isEquippable(item)) {
            this._quickEquip(item);
          }
        });

        // Right-click → context menu
        itemEl.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this._showContextMenu(e, item, c, r);
        });

        grid.appendChild(itemEl);
      }
    }

    return grid;
  }

  // ===========================================================
  //  Bottom Bar
  // ===========================================================

  _renderBottomBar() {
    const gold = this._player.gold || 0;
    const junkValue = this._inventory.getJunkValue();

    const goldDisplay = _el('span', { color: '#f1c40f', fontSize: '14px' }, {
      innerHTML: `\u{1FA99} Gold: <strong>${gold}</strong>`,
    });
    this._bottomBar.appendChild(goldDisplay);

    if (this._options.atVendor) {
      const sellBtn = _el('button', {
        backgroundColor: junkValue > 0 ? '#27ae60' : '#555',
        color: '#fff',
        border: 'none',
        padding: '6px 16px',
        borderRadius: '4px',
        cursor: junkValue > 0 ? 'pointer' : 'default',
        fontWeight: 'bold',
        fontSize: '13px',
      }, { textContent: `Sell Junk: ${junkValue}g` });

      if (junkValue > 0) {
        sellBtn.addEventListener('click', () => {
          if (this._options.onSellJunk) {
            this._options.onSellJunk();
            this._render();
          }
        });
        sellBtn.addEventListener('mouseenter', () => { sellBtn.style.backgroundColor = '#2ecc71'; });
        sellBtn.addEventListener('mouseleave', () => { sellBtn.style.backgroundColor = '#27ae60'; });
      }

      this._bottomBar.appendChild(sellBtn);
    } else {
      const junkText = _el('span', { color: '#999', fontSize: '13px' }, {
        textContent: `Junk value: ${junkValue}g`,
      });
      this._bottomBar.appendChild(junkText);
    }
  }

  // ===========================================================
  //  Tooltip
  // ===========================================================

  _showItemTooltip(event, item, equippedItem) {
    if (!this._tooltip) return;

    let html = '';

    // Name in rarity color
    html += `<div style="font-size:14px;font-weight:bold;color:${_rarityColor(item.rarity)};margin-bottom:4px;">
      ${item.name}
    </div>`;

    // Type + iLvl
    const slotName = SLOT_LABELS[item.slot] || item.slot || '';
    const iLvl = item.iLvl || item.itemLevel || '';
    html += `<div style="color:#999;font-size:11px;margin-bottom:6px;">
      ${slotName}${iLvl ? ` &middot; iLvl ${iLvl}` : ''}
    </div>`;

    // Base stats
    if (item.baseStat) {
      if (item.baseStat.type === 'damage') {
        html += `<div style="color:#e0e0e0;">\u{2694}\uFE0F ${item.baseStat.min} - ${item.baseStat.max} Damage</div>`;
      } else if (item.baseStat.type === 'armor') {
        html += `<div style="color:#e0e0e0;">\u{1F6E1}\uFE0F ${item.baseStat.value} Armor</div>`;
      }
    } else {
      if (item.damageMin && item.damageMax) {
        html += `<div style="color:#e0e0e0;">\u{2694}\uFE0F ${item.damageMin} - ${item.damageMax} Damage</div>`;
      }
      if (item.armor) {
        html += `<div style="color:#e0e0e0;">\u{1F6E1}\uFE0F ${item.armor} Armor</div>`;
      }
    }

    // Extra base fields
    if (item.blockChance) html += `<div style="color:#8bb8d0;">${(item.blockChance * 100).toFixed(0)}% Block Chance</div>`;
    if (item.critBonus) html += `<div style="color:#8bb8d0;">+${(item.critBonus * 100).toFixed(1)}% Crit Chance</div>`;
    if (item.manaBonus) html += `<div style="color:#3498db;">+${item.manaBonus} Mana</div>`;
    if (item.cooldownReduction) html += `<div style="color:#8bb8d0;">-${(item.cooldownReduction * 100).toFixed(0)}% Cooldown</div>`;
    if (item.moveSpeedBonus) html += `<div style="color:#8bb8d0;">+${(item.moveSpeedBonus * 100).toFixed(0)}% Move Speed</div>`;
    if (item.speedMod && item.speedMod !== 1) html += `<div style="color:#8bb8d0;">${item.speedMod > 1 ? 'Fast' : 'Slow'} (${item.speedMod.toFixed(2)}x speed)</div>`;
    if (item.twoHanded) html += `<div style="color:#bbb;font-style:italic;">Two-Handed</div>`;

    // Affixes
    if (item.affixes && item.affixes.length > 0) {
      html += `<div style="margin-top:6px;border-top:1px solid #333;padding-top:4px;">`;
      for (const affix of item.affixes) {
        const color = '#5dade2';
        html += `<div style="color:${color};">${_formatAffixValue(affix)} ${_statLabel(affix.statKey)}</div>`;
      }
      html += `</div>`;
    }

    // Unique effect
    if (item.uniqueEffect) {
      html += `<div style="margin-top:6px;color:#e67e22;font-style:italic;border-top:1px solid #333;padding-top:4px;">
        \u{2728} ${item.uniqueEffect}
      </div>`;
    }

    // Level requirement
    if (item.levelReq && item.levelReq > 1) {
      const playerLevel = this._player.level || 1;
      const met = playerLevel >= item.levelReq;
      html += `<div style="margin-top:4px;color:${met ? '#2ecc71' : '#e74c3c'};">
        Requires Level ${item.levelReq}
      </div>`;
    }

    // Class restrictions
    if (item.classReq && item.classReq.length > 0) {
      const playerClass = this._player.classId || '';
      const allowed = item.classReq.includes(playerClass);
      const classes = item.classReq.map(c => c.charAt(0).toUpperCase() + c.slice(1)).join(', ');
      html += `<div style="color:${allowed ? '#999' : '#e74c3c'};">
        Classes: ${classes}
      </div>`;
    }

    // Sell value
    if (item.sellValue !== undefined) {
      html += `<div style="margin-top:4px;color:#f1c40f;font-size:11px;">Sell: ${item.sellValue}g</div>`;
    } else if (item.sellPrice !== undefined) {
      html += `<div style="margin-top:4px;color:#f1c40f;font-size:11px;">Sell: ${item.sellPrice}g</div>`;
    }

    // Comparison section
    if (equippedItem && equippedItem !== item && this._isEquippable(item)) {
      html += this._buildComparisonHTML(item, equippedItem);
    }

    this._tooltip.innerHTML = html;
    this._tooltip.style.display = 'block';
    this._positionTooltip(event);
  }

  _buildComparisonHTML(newItem, equippedItem) {
    let html = `<div style="margin-top:8px;border-top:1px dashed #555;padding-top:6px;">
      <div style="color:#999;font-size:10px;margin-bottom:3px;">vs. equipped:</div>`;

    // Compare damage
    const newDmg = (newItem.damageMin || 0) + (newItem.damageMax || 0);
    const eqDmg = (equippedItem.damageMin || 0) + (equippedItem.damageMax || 0);
    if (newDmg || eqDmg) {
      const delta = newDmg - eqDmg;
      if (delta !== 0) {
        const color = delta > 0 ? '#2ecc71' : '#e74c3c';
        const arrow = delta > 0 ? '\u25B2' : '\u25BC';
        html += `<div style="color:${color};">${arrow} ${delta > 0 ? '+' : ''}${delta} Damage</div>`;
      }
    }

    // Compare armor
    const newArmor = newItem.armor || 0;
    const eqArmor = equippedItem.armor || 0;
    if (newArmor || eqArmor) {
      const delta = newArmor - eqArmor;
      if (delta !== 0) {
        const color = delta > 0 ? '#2ecc71' : '#e74c3c';
        const arrow = delta > 0 ? '\u25B2' : '\u25BC';
        html += `<div style="color:${color};">${arrow} ${delta > 0 ? '+' : ''}${delta} Armor</div>`;
      }
    }

    // Compare affix totals per stat
    const newAffixes = this._aggregateAffixes(newItem.affixes || []);
    const eqAffixes = this._aggregateAffixes(equippedItem.affixes || []);
    const allKeys = new Set([...Object.keys(newAffixes), ...Object.keys(eqAffixes)]);

    for (const key of allKeys) {
      const nv = newAffixes[key] || 0;
      const ev = eqAffixes[key] || 0;
      const delta = nv - ev;
      if (Math.abs(delta) < 0.001) continue;

      const isPercent = key.includes('Percent') || key.includes('Chance') || key.includes('steal');
      const color = delta > 0 ? '#2ecc71' : '#e74c3c';
      const arrow = delta > 0 ? '\u25B2' : '\u25BC';
      const formatted = isPercent
        ? `${delta > 0 ? '+' : ''}${(delta * 100).toFixed(1)}%`
        : `${delta > 0 ? '+' : ''}${Math.round(delta)}`;
      html += `<div style="color:${color};">${arrow} ${formatted} ${_statLabel(key)}</div>`;
    }

    html += `</div>`;
    return html;
  }

  _aggregateAffixes(affixes) {
    const result = {};
    for (const a of affixes) {
      result[a.statKey] = (result[a.statKey] || 0) + a.value;
    }
    return result;
  }

  _positionTooltip(e) {
    if (!this._tooltip) return;
    const pad = 16;
    let x = e.clientX + pad;
    let y = e.clientY + pad;

    // Keep within viewport
    const tw = this._tooltip.offsetWidth;
    const th = this._tooltip.offsetHeight;
    if (x + tw > window.innerWidth - 8) x = e.clientX - tw - pad;
    if (y + th > window.innerHeight - 8) y = e.clientY - th - pad;
    if (x < 4) x = 4;
    if (y < 4) y = 4;

    this._tooltip.style.left = x + 'px';
    this._tooltip.style.top = y + 'px';
  }

  _hideTooltip() {
    if (this._tooltip) this._tooltip.style.display = 'none';
  }

  // ===========================================================
  //  Context Menu
  // ===========================================================

  _showContextMenu(event, item, col, row) {
    this._hideContextMenu();
    this._hideTooltip();

    const menu = _el('div', {
      position: 'fixed',
      left: event.clientX + 'px',
      top: event.clientY + 'px',
      zIndex: '9200',
      backgroundColor: '#1a1a2e',
      border: '1px solid #555',
      borderRadius: '4px',
      overflow: 'hidden',
      minWidth: '120px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.6)',
    });

    const addOption = (label, action, enabled = true) => {
      const opt = _el('div', {
        padding: '6px 14px',
        fontSize: '13px',
        cursor: enabled ? 'pointer' : 'default',
        color: enabled ? '#ddd' : '#666',
        backgroundColor: 'transparent',
        transition: 'background-color 0.1s',
      }, { textContent: label });

      if (enabled) {
        opt.addEventListener('mouseenter', () => { opt.style.backgroundColor = '#2a2a4e'; });
        opt.addEventListener('mouseleave', () => { opt.style.backgroundColor = 'transparent'; });
        opt.addEventListener('click', (e) => {
          e.stopPropagation();
          this._hideContextMenu();
          action();
        });
      }
      menu.appendChild(opt);
    };

    // Equip
    if (this._isEquippable(item)) {
      addOption('Equip', () => this._quickEquip(item));
    }

    // Assign to Hotbar (potions / consumables only)
    const isPotion = item.isConsumable || item.isStackable;
    if (isPotion && this._options.onAssignHotbar) {
      const hotbarRow = _el('div', {
        padding: '6px 14px',
        fontSize: '13px',
        color: '#ddd',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
      });
      const label = _el('span', { color: '#999', marginRight: '4px' }, { textContent: 'Hotbar \u2192' });
      hotbarRow.appendChild(label);

      for (let i = 0; i < 4; i++) {
        const slotBtn = _el('button', {
          width: '24px', height: '24px',
          border: '1px solid #666',
          borderRadius: '3px',
          backgroundColor: '#2a2a4e',
          color: '#ddd',
          fontSize: '12px',
          fontWeight: 'bold',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0',
          transition: 'background-color 0.1s',
        }, { textContent: String(i + 1) });

        slotBtn.addEventListener('mouseenter', () => { slotBtn.style.backgroundColor = '#3a3a6e'; });
        slotBtn.addEventListener('mouseleave', () => { slotBtn.style.backgroundColor = '#2a2a4e'; });
        slotBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this._hideContextMenu();
          this._options.onAssignHotbar(item.id, i);
        });
        hotbarRow.appendChild(slotBtn);
      }

      menu.appendChild(hotbarRow);
    }

    // Drop
    addOption('Drop', () => {
      if (this._options.onDrop) {
        this._options.onDrop(item);
        this._render();
      }
    });

    // Mark as Junk / Unmark
    const isJunk = item.rarity === 'junk';
    if (!isJunk && item.slot !== 'junk') {
      addOption('Mark as Junk', () => {
        item.rarity = 'junk';
        item.rarityColor = RARITY_COLORS.junk;
        this._render();
      });
    } else if (item.slot !== 'junk') {
      // Allow unmark if it was manually junked (slot !== 'junk' means not inherently junk)
      addOption('Unmark Junk', () => {
        // Restore original rarity — fallback to common
        item.rarity = item._originalRarity || 'common';
        item.rarityColor = RARITY_COLORS[item.rarity] || RARITY_COLORS.common;
        this._render();
      });
    }

    this._contextMenu = menu;
    const menuRoot = this._overlay || this._embeddedRoot || document.body;
    menuRoot.appendChild(menu);

    // Keep within viewport
    requestAnimationFrame(() => {
      const rect = menu.getBoundingClientRect();
      if (rect.right > window.innerWidth) menu.style.left = (window.innerWidth - rect.width - 8) + 'px';
      if (rect.bottom > window.innerHeight) menu.style.top = (window.innerHeight - rect.height - 8) + 'px';
    });

    // Click anywhere to dismiss
    const dismiss = (e) => {
      if (!menu.contains(e.target)) {
        this._hideContextMenu();
        document.removeEventListener('click', dismiss, true);
      }
    };
    setTimeout(() => document.addEventListener('click', dismiss, true), 0);
  }

  _hideContextMenu() {
    if (this._contextMenu) {
      this._contextMenu.remove();
      this._contextMenu = null;
    }
  }

  // ===========================================================
  //  Equipment helpers
  // ===========================================================

  _isEquippable(item) {
    const slot = item.slot;
    return slot && slot !== 'junk' && SLOT_LABELS[slot] !== undefined;
  }

  _getEquippedForSlot(slot) {
    if (!this._player.equipment) return null;
    return this._player.equipment[slot] || null;
  }

  _quickEquip(item) {
    if (!this._isEquippable(item)) return;
    if (this._options.onEquip) {
      this._options.onEquip(item, item.slot);
      this._render();
    }
  }

  // ===========================================================
  //  Global listeners (ESC to close)
  // ===========================================================

  _attachGlobalListeners() {
    this._boundKeyHandler = (e) => {
      if (e.key === 'Escape' || e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        e.stopPropagation();
        this.hide();
      }
    };
    document.addEventListener('keydown', this._boundKeyHandler, true);

    // Click overlay background to dismiss context menu or close
    this._overlay.addEventListener('click', (e) => {
      if (e.target === this._overlay) {
        this.hide();
      }
      this._hideContextMenu();
    });
  }

  // ===========================================================
  //  Teardown
  // ===========================================================

  hide() {
    this._hideTooltip();
    this._hideContextMenu();

    if (this._boundKeyHandler) {
      document.removeEventListener('keydown', this._boundKeyHandler, true);
      this._boundKeyHandler = null;
    }

    if (this._overlay) {
      this._overlay.remove();
      this._overlay = null;
    }

    this._tooltip = null;
    this._panel = null;
    this._body = null;
    this._bottomBar = null;
    this._embeddedRoot = null;

    if (this._resolve) {
      const resolve = this._resolve;
      this._resolve = null;
      resolve();
    }
  }
}
