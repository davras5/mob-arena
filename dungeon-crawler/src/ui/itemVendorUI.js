/* ---------------------------------------------------------------
 *  ItemVendorUI — split-panel item shop for the Item Vendor NPC.
 *  Left: vendor stock for purchase. Right: player inventory for selling.
 * --------------------------------------------------------------- */

const RARITY_COLORS = {
  junk:      '#888888',
  common:    '#ffffff',
  uncommon:  '#3498db',
  rare:      '#f1c40f',
  epic:      '#9b59b6',
  legendary: '#e67e22',
};

const CELL_SIZE = 44;
const INV_COLS = 10;
const INV_ROWS = 6;

export class ItemVendorUI {
  constructor() {
    this.overlay = null;
    this._escHandler = null;
    this._resolve = null;
    this._tooltip = null;
    this._confirmDialog = null;
  }

  /**
   * Show the Item Vendor panel.
   * @param {object[]} vendorStock - array of items the vendor sells
   * @param {object} inventory - player's Inventory instance
   * @param {object} player - player object (gold, level, class)
   * @param {function} onBuy - callback(item) when player buys
   * @param {function} onSell - callback(itemId) when player sells
   * @param {function} onSellJunk - callback() for bulk junk sell
   * @returns {Promise} resolves when panel is closed
   */
  show(vendorStock, inventory, player, onBuy, onSell, onSellJunk) {
    this.vendorStock = vendorStock;
    this.inventory = inventory;
    this.player = player;
    this.onBuy = onBuy;
    this.onSell = onSell;
    this.onSellJunk = onSellJunk;

    return new Promise((resolve) => {
      this._resolve = resolve;
      this._build();
      this._escHandler = (e) => {
        if (e.key === 'Escape') {
          if (this._confirmDialog) {
            this._closeConfirm();
          } else {
            this._close();
          }
        }
      };
      window.addEventListener('keydown', this._escHandler);
    });
  }

  // ---------------------------------------------------------------
  //  Build the full overlay
  // ---------------------------------------------------------------
  _build() {
    if (this.overlay) this.overlay.remove();
    this._tooltip = null;
    this._confirmDialog = null;

    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'fixed',
      top: '0', left: '0', width: '100%', height: '100%',
      background: 'rgba(0,0,0,0.78)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: '9999',
      fontFamily: "'Segoe UI', Arial, sans-serif",
    });
    this.overlay = overlay;

    const panel = document.createElement('div');
    Object.assign(panel.style, {
      width: '88%', maxWidth: '1100px', height: '88%', maxHeight: '720px',
      background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)',
      border: '2px solid #c9a84c',
      borderRadius: '12px',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      color: '#e0e0e0',
      boxShadow: '0 0 40px rgba(201,168,76,0.3)',
    });

    // --- Header ---
    panel.appendChild(this._buildHeader());

    // --- Body: split left / right ---
    const body = document.createElement('div');
    Object.assign(body.style, {
      flex: '1', display: 'flex', overflow: 'hidden',
    });

    body.appendChild(this._buildVendorPane());
    body.appendChild(this._buildInventoryPane());

    panel.appendChild(body);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
  }

  // ---------------------------------------------------------------
  //  Header
  // ---------------------------------------------------------------
  _buildHeader() {
    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 24px',
      borderBottom: '2px solid #c9a84c',
      background: 'rgba(201,168,76,0.08)',
      flexShrink: '0',
    });

    const title = document.createElement('h2');
    title.textContent = 'ITEM VENDOR';
    Object.assign(title.style, {
      margin: '0', fontSize: '24px', fontWeight: 'bold',
      color: '#c9a84c', letterSpacing: '3px',
      textShadow: '0 0 10px rgba(201,168,76,0.4)',
    });

    const headerRight = document.createElement('div');
    Object.assign(headerRight.style, { display: 'flex', alignItems: 'center', gap: '16px' });

    const levelLabel = document.createElement('span');
    levelLabel.textContent = `Level: ${this.player.level || 1}`;
    Object.assign(levelLabel.style, { color: '#aaa', fontSize: '14px' });

    const goldLabel = document.createElement('span');
    goldLabel.textContent = `Gold: ${this.player.gold || 0}`;
    Object.assign(goldLabel.style, { color: '#ffd700', fontSize: '16px', fontWeight: 'bold' });

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '[X]';
    Object.assign(closeBtn.style, {
      background: 'none', border: '1px solid #c9a84c', color: '#c9a84c',
      fontSize: '18px', cursor: 'pointer', padding: '4px 10px',
      borderRadius: '4px', fontWeight: 'bold',
    });
    closeBtn.addEventListener('click', () => this._close());
    closeBtn.addEventListener('mouseenter', () => { closeBtn.style.background = 'rgba(201,168,76,0.2)'; });
    closeBtn.addEventListener('mouseleave', () => { closeBtn.style.background = 'none'; });

    headerRight.append(levelLabel, goldLabel, closeBtn);
    header.append(title, headerRight);
    return header;
  }

  // ---------------------------------------------------------------
  //  Left pane — Vendor Stock
  // ---------------------------------------------------------------
  _buildVendorPane() {
    const pane = document.createElement('div');
    Object.assign(pane.style, {
      flex: '1', display: 'flex', flexDirection: 'column',
      borderRight: '2px solid #c9a84c',
      overflow: 'hidden',
    });

    // Pane title
    const paneTitle = document.createElement('div');
    paneTitle.textContent = 'FOR SALE';
    Object.assign(paneTitle.style, {
      padding: '10px 16px', fontSize: '14px', fontWeight: 'bold',
      color: '#c9a84c', letterSpacing: '2px',
      borderBottom: '1px solid #333', flexShrink: '0',
      background: 'rgba(201,168,76,0.04)',
    });
    pane.appendChild(paneTitle);

    // Scrollable list
    const list = document.createElement('div');
    Object.assign(list.style, {
      flex: '1', overflowY: 'auto', padding: '8px 12px',
    });

    // Separate equipment from potions/consumables
    const equipment = [];
    const consumables = [];
    for (const item of this.vendorStock) {
      if (item.slot === 'consumable' || item.stackable || item.type === 'hp_potion') {
        consumables.push(item);
      } else {
        equipment.push(item);
      }
    }

    // Equipment rows
    for (const item of equipment) {
      list.appendChild(this._buildVendorRow(item));
    }

    // Potions section
    if (consumables.length > 0) {
      const potionHeader = document.createElement('div');
      potionHeader.textContent = 'CONSUMABLES';
      Object.assign(potionHeader.style, {
        fontSize: '12px', fontWeight: 'bold', color: '#888',
        letterSpacing: '1px', padding: '10px 0 6px 0',
        borderTop: '1px solid #333', marginTop: '8px',
      });
      list.appendChild(potionHeader);

      for (const item of consumables) {
        list.appendChild(this._buildVendorRow(item));
      }
    }

    pane.appendChild(list);
    return pane;
  }

  _buildVendorRow(item) {
    const gold = this.player.gold || 0;
    const price = item.buyPrice || item.sellValue || item.sellPrice || 0;
    const canAfford = gold >= price;

    const row = document.createElement('div');
    Object.assign(row.style, {
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '8px 10px', marginBottom: '4px',
      background: 'rgba(255,255,255,0.04)',
      borderRadius: '6px',
      border: canAfford ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(180,40,40,0.5)',
      cursor: canAfford ? 'pointer' : 'default',
      transition: 'background 0.15s',
    });

    if (canAfford) {
      row.addEventListener('mouseenter', () => { row.style.background = 'rgba(255,255,255,0.1)'; });
      row.addEventListener('mouseleave', () => { row.style.background = 'rgba(255,255,255,0.04)'; });
    }

    // Icon preview
    const iconEl = document.createElement('span');
    iconEl.textContent = item.icon || '?';
    Object.assign(iconEl.style, {
      fontSize: '24px', width: '32px', textAlign: 'center', flexShrink: '0',
    });

    // Info
    const info = document.createElement('div');
    Object.assign(info.style, { flex: '1', minWidth: '0' });

    const nameRow = document.createElement('div');
    Object.assign(nameRow.style, { display: 'flex', alignItems: 'center', gap: '6px' });

    const nameEl = document.createElement('span');
    nameEl.textContent = item.name;
    Object.assign(nameEl.style, {
      fontWeight: 'bold', fontSize: '13px',
      color: RARITY_COLORS[item.rarity] || '#fff',
      textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap',
    });
    nameRow.appendChild(nameEl);

    // Quantity badge for consumables
    if (item.stackCount !== undefined && item.stackCount > 1) {
      const qtyBadge = document.createElement('span');
      qtyBadge.textContent = `x${item.stackCount}`;
      Object.assign(qtyBadge.style, {
        fontSize: '11px', padding: '1px 5px', borderRadius: '3px',
        background: 'rgba(255,255,255,0.1)', color: '#aaa',
      });
      nameRow.appendChild(qtyBadge);
    }

    info.appendChild(nameRow);

    // Key stat line
    const statLine = document.createElement('div');
    Object.assign(statLine.style, { fontSize: '11px', color: '#aaa', marginTop: '2px' });

    const statParts = [];
    if (item.baseStat) {
      if (item.baseStat.type === 'damage') {
        statParts.push(`${item.baseStat.min}-${item.baseStat.max} Damage`);
      } else if (item.baseStat.type === 'armor') {
        statParts.push(`${item.baseStat.value} Armor`);
      }
    } else if (item.damageMin && item.damageMax) {
      statParts.push(`${item.damageMin}-${item.damageMax} Damage`);
    } else if (item.armor) {
      statParts.push(`${item.armor} Armor`);
    }
    if (item.baseStats && item.baseStats.healAmount) {
      statParts.push(`Heals ${item.baseStats.healAmount} HP`);
    }
    if (item.slot && item.slot !== 'consumable' && item.slot !== 'junk') {
      statParts.push(item.slot.charAt(0).toUpperCase() + item.slot.slice(1));
    }
    statLine.textContent = statParts.join(' | ');
    info.appendChild(statLine);

    // Affix summary for uncommon+
    if (item.affixes && item.affixes.length > 0 && item.rarity !== 'common' && item.rarity !== 'junk') {
      const affixLine = document.createElement('div');
      Object.assign(affixLine.style, { fontSize: '10px', color: '#5dade2', marginTop: '1px' });
      const affixText = item.affixes.map(a => {
        const sign = a.value >= 0 ? '+' : '';
        return `${sign}${a.value}${a.percent ? '%' : ''} ${a.name || a.statKey || ''}`;
      }).join(', ');
      affixLine.textContent = affixText;
      info.appendChild(affixLine);
    }

    // Price
    const priceEl = document.createElement('span');
    priceEl.textContent = `${price}g`;
    Object.assign(priceEl.style, {
      fontSize: '14px', fontWeight: 'bold', flexShrink: '0',
      color: canAfford ? '#ffd700' : '#cc3333',
      minWidth: '50px', textAlign: 'right',
    });

    row.append(iconEl, info, priceEl);

    // Tooltip on hover
    row.addEventListener('mouseenter', (e) => this._showTooltip(item, e, true));
    row.addEventListener('mousemove', (e) => this._moveTooltip(e));
    row.addEventListener('mouseleave', () => this._hideTooltip());

    // Click to buy
    row.addEventListener('click', () => {
      if (!canAfford) return;
      if (price > 100) {
        this._showConfirmDialog(item, price, () => {
          this._executeBuy(item);
        });
      } else {
        this._executeBuy(item);
      }
    });

    return row;
  }

  _executeBuy(item) {
    if (this.onBuy) this.onBuy(item);
    this._build();
  }

  // ---------------------------------------------------------------
  //  Right pane — Player Inventory
  // ---------------------------------------------------------------
  _buildInventoryPane() {
    const pane = document.createElement('div');
    Object.assign(pane.style, {
      width: `${INV_COLS * CELL_SIZE + 48}px`,
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden', flexShrink: '0',
    });

    // Pane title
    const paneTitle = document.createElement('div');
    paneTitle.textContent = 'YOUR INVENTORY';
    Object.assign(paneTitle.style, {
      padding: '10px 16px', fontSize: '14px', fontWeight: 'bold',
      color: '#c9a84c', letterSpacing: '2px',
      borderBottom: '1px solid #333', flexShrink: '0',
      background: 'rgba(201,168,76,0.04)',
    });
    pane.appendChild(paneTitle);

    // Grid container (scrollable if needed)
    const gridWrap = document.createElement('div');
    Object.assign(gridWrap.style, {
      flex: '1', overflowY: 'auto', padding: '12px 16px',
      display: 'flex', justifyContent: 'center',
    });

    const grid = document.createElement('div');
    Object.assign(grid.style, {
      position: 'relative',
      width: `${INV_COLS * CELL_SIZE}px`,
      height: `${INV_ROWS * CELL_SIZE}px`,
      flexShrink: '0',
    });

    // Draw grid cells
    for (let r = 0; r < INV_ROWS; r++) {
      for (let c = 0; c < INV_COLS; c++) {
        const cell = document.createElement('div');
        Object.assign(cell.style, {
          position: 'absolute',
          left: `${c * CELL_SIZE}px`,
          top: `${r * CELL_SIZE}px`,
          width: `${CELL_SIZE}px`,
          height: `${CELL_SIZE}px`,
          border: '1px solid rgba(255,255,255,0.08)',
          boxSizing: 'border-box',
          background: 'rgba(255,255,255,0.02)',
        });
        grid.appendChild(cell);
      }
    }

    // Draw items on top of grid
    const drawn = new Set();
    for (let r = 0; r < INV_ROWS; r++) {
      for (let c = 0; c < INV_COLS; c++) {
        const itemId = this.inventory.grid[r] && this.inventory.grid[r][c];
        if (!itemId || drawn.has(itemId)) continue;
        drawn.add(itemId);

        const item = this.inventory.items[itemId];
        if (!item) continue;

        // Find top-left
        const found = this.inventory.findItemById(itemId);
        if (!found) continue;
        const col = found.col;
        const row = found.row;
        const w = item.gridW || 1;
        const h = item.gridH || 1;

        const itemEl = document.createElement('div');
        Object.assign(itemEl.style, {
          position: 'absolute',
          left: `${col * CELL_SIZE + 1}px`,
          top: `${row * CELL_SIZE + 1}px`,
          width: `${w * CELL_SIZE - 2}px`,
          height: `${h * CELL_SIZE - 2}px`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column',
          background: this._itemBgColor(item.rarity),
          border: `1px solid ${RARITY_COLORS[item.rarity] || '#555'}`,
          borderRadius: '4px',
          cursor: 'pointer',
          boxSizing: 'border-box',
          overflow: 'hidden',
          transition: 'filter 0.15s',
        });

        // Icon
        const icon = document.createElement('span');
        icon.textContent = item.icon || '?';
        Object.assign(icon.style, {
          fontSize: w > 1 ? '20px' : '16px',
          lineHeight: '1',
        });
        itemEl.appendChild(icon);

        // Stack count
        if (item.stackCount !== undefined && item.stackCount > 1) {
          const stackLabel = document.createElement('span');
          stackLabel.textContent = item.stackCount;
          Object.assign(stackLabel.style, {
            position: 'absolute', bottom: '1px', right: '3px',
            fontSize: '10px', fontWeight: 'bold', color: '#fff',
            textShadow: '0 0 3px #000',
          });
          itemEl.appendChild(stackLabel);
        }

        // Sell price overlay
        const sellTag = document.createElement('span');
        sellTag.textContent = `${item.sellValue || item.sellPrice || 0}g`;
        Object.assign(sellTag.style, {
          position: 'absolute', bottom: '1px', left: '2px',
          fontSize: '9px', color: '#ffd700',
          textShadow: '0 0 3px #000',
        });
        itemEl.appendChild(sellTag);

        // Hover
        itemEl.addEventListener('mouseenter', (e) => {
          itemEl.style.filter = 'brightness(1.3)';
          this._showTooltip(item, e, false);
        });
        itemEl.addEventListener('mousemove', (e) => this._moveTooltip(e));
        itemEl.addEventListener('mouseleave', () => {
          itemEl.style.filter = 'none';
          this._hideTooltip();
        });

        // Right-click to sell
        itemEl.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          this._executeSell(item.id);
        });

        grid.appendChild(itemEl);
      }
    }

    gridWrap.appendChild(grid);
    pane.appendChild(gridWrap);

    // --- Bottom bar: gold + Sell Junk ---
    const bottomBar = document.createElement('div');
    Object.assign(bottomBar.style, {
      padding: '10px 16px',
      borderTop: '1px solid #333',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexShrink: '0',
      background: 'rgba(0,0,0,0.2)',
    });

    const goldDisplay = document.createElement('span');
    goldDisplay.textContent = `Gold: ${this.player.gold || 0}`;
    Object.assign(goldDisplay.style, {
      color: '#ffd700', fontSize: '16px', fontWeight: 'bold',
    });

    const junkValue = this.inventory.getJunkValue ? this.inventory.getJunkValue() : 0;
    const junkCount = this.inventory.getJunkItems ? this.inventory.getJunkItems().length : 0;

    const sellJunkBtn = document.createElement('button');
    sellJunkBtn.textContent = junkCount > 0 ? `Sell Junk: ${junkValue}g` : 'No Junk';
    const hasJunk = junkCount > 0;
    Object.assign(sellJunkBtn.style, {
      padding: '6px 16px', borderRadius: '4px', fontWeight: 'bold',
      fontSize: '13px',
      cursor: hasJunk ? 'pointer' : 'default',
      border: hasJunk ? '1px solid #e67e22' : '1px solid #555',
      background: hasJunk ? 'rgba(230,126,34,0.15)' : 'rgba(255,255,255,0.03)',
      color: hasJunk ? '#e67e22' : '#666',
    });

    if (hasJunk) {
      sellJunkBtn.addEventListener('mouseenter', () => { sellJunkBtn.style.background = 'rgba(230,126,34,0.3)'; });
      sellJunkBtn.addEventListener('mouseleave', () => { sellJunkBtn.style.background = 'rgba(230,126,34,0.15)'; });
      sellJunkBtn.addEventListener('click', () => {
        if (this.onSellJunk) this.onSellJunk();
        this._build();
      });
    }

    bottomBar.append(goldDisplay, sellJunkBtn);
    pane.appendChild(bottomBar);

    return pane;
  }

  _executeSell(itemId) {
    if (this.onSell) this.onSell(itemId);
    this._build();
  }

  _itemBgColor(rarity) {
    const map = {
      junk:      'rgba(136,136,136,0.15)',
      common:    'rgba(255,255,255,0.08)',
      uncommon:  'rgba(52,152,219,0.15)',
      rare:      'rgba(241,196,15,0.12)',
      epic:      'rgba(155,89,182,0.15)',
      legendary: 'rgba(230,126,34,0.18)',
    };
    return map[rarity] || 'rgba(255,255,255,0.06)';
  }

  // ---------------------------------------------------------------
  //  Tooltip
  // ---------------------------------------------------------------
  _showTooltip(item, event, isVendorItem) {
    this._hideTooltip();

    const tip = document.createElement('div');
    Object.assign(tip.style, {
      position: 'fixed',
      zIndex: '10001',
      pointerEvents: 'none',
      background: 'linear-gradient(180deg, #1e1e30 0%, #12122a 100%)',
      border: `1px solid ${RARITY_COLORS[item.rarity] || '#555'}`,
      borderRadius: '6px',
      padding: '10px 14px',
      maxWidth: '280px',
      minWidth: '180px',
      color: '#e0e0e0',
      fontSize: '12px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.7)',
      fontFamily: "'Segoe UI', Arial, sans-serif",
    });

    // Name
    const nameEl = document.createElement('div');
    nameEl.textContent = item.name;
    Object.assign(nameEl.style, {
      fontWeight: 'bold', fontSize: '14px',
      color: RARITY_COLORS[item.rarity] || '#fff',
      marginBottom: '4px',
    });
    tip.appendChild(nameEl);

    // Rarity + slot
    const metaEl = document.createElement('div');
    const rarityLabel = (item.rarity || 'common').charAt(0).toUpperCase() + (item.rarity || 'common').slice(1);
    const slotLabel = item.slot ? item.slot.charAt(0).toUpperCase() + item.slot.slice(1) : '';
    metaEl.textContent = [rarityLabel, slotLabel].filter(Boolean).join(' ');
    Object.assign(metaEl.style, { fontSize: '11px', color: '#888', marginBottom: '6px' });
    tip.appendChild(metaEl);

    // Item level + level req
    if (item.iLvl || item.itemLevel) {
      const ilvlEl = document.createElement('div');
      ilvlEl.textContent = `Item Level: ${item.iLvl || item.itemLevel}`;
      Object.assign(ilvlEl.style, { fontSize: '11px', color: '#777', marginBottom: '2px' });
      tip.appendChild(ilvlEl);
    }
    if (item.levelReq && item.levelReq > 1) {
      const reqColor = (this.player.level || 1) >= item.levelReq ? '#888' : '#cc3333';
      const reqEl = document.createElement('div');
      reqEl.textContent = `Requires Level ${item.levelReq}`;
      Object.assign(reqEl.style, { fontSize: '11px', color: reqColor, marginBottom: '2px' });
      tip.appendChild(reqEl);
    }
    if (item.classReq) {
      const classEl = document.createElement('div');
      classEl.textContent = `Class: ${item.classReq}`;
      Object.assign(classEl.style, { fontSize: '11px', color: '#888', marginBottom: '2px' });
      tip.appendChild(classEl);
    }

    // Separator
    tip.appendChild(this._tooltipSeparator());

    // Base stats
    if (item.baseStat) {
      const statEl = document.createElement('div');
      if (item.baseStat.type === 'damage') {
        statEl.textContent = `${item.baseStat.min} - ${item.baseStat.max} Damage`;
      } else if (item.baseStat.type === 'armor') {
        statEl.textContent = `${item.baseStat.value} Armor`;
      }
      Object.assign(statEl.style, { fontSize: '13px', color: '#fff', fontWeight: 'bold', marginBottom: '4px' });
      tip.appendChild(statEl);
    } else {
      if (item.damageMin && item.damageMax) {
        const statEl = document.createElement('div');
        statEl.textContent = `${item.damageMin} - ${item.damageMax} Damage`;
        Object.assign(statEl.style, { fontSize: '13px', color: '#fff', fontWeight: 'bold', marginBottom: '4px' });
        tip.appendChild(statEl);
      }
      if (item.armor) {
        const statEl = document.createElement('div');
        statEl.textContent = `${item.armor} Armor`;
        Object.assign(statEl.style, { fontSize: '13px', color: '#fff', fontWeight: 'bold', marginBottom: '4px' });
        tip.appendChild(statEl);
      }
    }

    // Consumable stats
    if (item.baseStats && item.baseStats.healAmount) {
      const healEl = document.createElement('div');
      healEl.textContent = `Restores ${item.baseStats.healAmount} HP`;
      Object.assign(healEl.style, { fontSize: '13px', color: '#e74c3c', fontWeight: 'bold', marginBottom: '4px' });
      tip.appendChild(healEl);
    }

    // Affixes
    if (item.affixes && item.affixes.length > 0) {
      for (const affix of item.affixes) {
        const affEl = document.createElement('div');
        const sign = affix.value >= 0 ? '+' : '';
        affEl.textContent = `${sign}${affix.value}${affix.percent ? '%' : ''} ${affix.name || affix.statKey || ''}`;
        Object.assign(affEl.style, { fontSize: '12px', color: '#5dade2', marginBottom: '1px' });
        tip.appendChild(affEl);
      }
    }

    // Unique effect
    if (item.uniqueEffect) {
      tip.appendChild(this._tooltipSeparator());
      const uniqEl = document.createElement('div');
      uniqEl.textContent = item.uniqueEffect;
      Object.assign(uniqEl.style, { fontSize: '12px', color: '#e67e22', fontStyle: 'italic', marginBottom: '2px' });
      tip.appendChild(uniqEl);
    }

    // Separator before price
    tip.appendChild(this._tooltipSeparator());

    // Price info
    const priceEl = document.createElement('div');
    if (isVendorItem) {
      const price = item.buyPrice || item.sellValue || item.sellPrice || 0;
      priceEl.textContent = `Buy: ${price}g`;
      priceEl.style.color = '#ffd700';
    } else {
      const sell = item.sellValue || item.sellPrice || 0;
      priceEl.textContent = `Sell: ${sell}g  (Right-click to sell)`;
      priceEl.style.color = '#ffd700';
    }
    Object.assign(priceEl.style, { fontSize: '11px', marginTop: '2px' });
    tip.appendChild(priceEl);

    // Comparison hint
    if (isVendorItem && item.slot && item.slot !== 'consumable' && item.slot !== 'junk') {
      const equipped = this._findEquippedInSlot(item.slot);
      if (equipped) {
        tip.appendChild(this._tooltipSeparator());
        const cmpHeader = document.createElement('div');
        cmpHeader.textContent = `Currently equipped: ${equipped.name}`;
        Object.assign(cmpHeader.style, { fontSize: '11px', color: '#aaa', marginBottom: '2px' });
        tip.appendChild(cmpHeader);

        // Compare key stat
        const cmpLines = this._compareItems(item, equipped);
        for (const line of cmpLines) {
          const lineEl = document.createElement('div');
          lineEl.textContent = line.text;
          Object.assign(lineEl.style, { fontSize: '11px', color: line.color, marginBottom: '1px' });
          tip.appendChild(lineEl);
        }
      }
    }

    this._tooltip = tip;
    this.overlay.appendChild(tip);
    this._moveTooltip(event);
  }

  _moveTooltip(e) {
    if (!this._tooltip) return;
    const pad = 14;
    let x = e.clientX + pad;
    let y = e.clientY + pad;

    // Keep on screen
    const rect = this._tooltip.getBoundingClientRect();
    if (x + rect.width > window.innerWidth - pad) {
      x = e.clientX - rect.width - pad;
    }
    if (y + rect.height > window.innerHeight - pad) {
      y = e.clientY - rect.height - pad;
    }
    this._tooltip.style.left = `${x}px`;
    this._tooltip.style.top = `${y}px`;
  }

  _hideTooltip() {
    if (this._tooltip) {
      this._tooltip.remove();
      this._tooltip = null;
    }
  }

  _tooltipSeparator() {
    const sep = document.createElement('div');
    Object.assign(sep.style, {
      height: '1px', background: 'rgba(255,255,255,0.1)',
      margin: '5px 0',
    });
    return sep;
  }

  _findEquippedInSlot(slot) {
    // Check player equipment if available
    if (this.player.equipment && this.player.equipment[slot]) {
      return this.player.equipment[slot];
    }
    return null;
  }

  _compareItems(newItem, equipped) {
    const lines = [];

    const newDmg = newItem.damageMin && newItem.damageMax ? (newItem.damageMin + newItem.damageMax) / 2 : 0;
    const eqDmg = equipped.damageMin && equipped.damageMax ? (equipped.damageMin + equipped.damageMax) / 2 : 0;

    if (newDmg || eqDmg) {
      const diff = newDmg - eqDmg;
      const sign = diff >= 0 ? '+' : '';
      lines.push({
        text: `Avg Damage: ${sign}${Math.round(diff)}`,
        color: diff >= 0 ? '#4caf50' : '#cc3333',
      });
    }

    const newArmor = newItem.armor || 0;
    const eqArmor = equipped.armor || 0;
    if (newArmor || eqArmor) {
      const diff = newArmor - eqArmor;
      const sign = diff >= 0 ? '+' : '';
      lines.push({
        text: `Armor: ${sign}${diff}`,
        color: diff >= 0 ? '#4caf50' : '#cc3333',
      });
    }

    return lines;
  }

  // ---------------------------------------------------------------
  //  Confirmation dialog (for items > 100g)
  // ---------------------------------------------------------------
  _showConfirmDialog(item, price, onConfirm) {
    this._closeConfirm();

    const dialog = document.createElement('div');
    Object.assign(dialog.style, {
      position: 'fixed',
      top: '0', left: '0', width: '100%', height: '100%',
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: '10002',
    });

    const box = document.createElement('div');
    Object.assign(box.style, {
      background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)',
      border: '2px solid #c9a84c',
      borderRadius: '10px',
      padding: '20px 28px',
      maxWidth: '340px',
      textAlign: 'center',
      color: '#e0e0e0',
      fontFamily: "'Segoe UI', Arial, sans-serif",
      boxShadow: '0 4px 30px rgba(0,0,0,0.6)',
    });

    const msg = document.createElement('div');
    msg.innerHTML = `Buy <strong style="color:${RARITY_COLORS[item.rarity] || '#fff'}">${item.name}</strong> for <strong style="color:#ffd700">${price}g</strong>?`;
    Object.assign(msg.style, { fontSize: '15px', marginBottom: '18px' });
    box.appendChild(msg);

    const btnRow = document.createElement('div');
    Object.assign(btnRow.style, { display: 'flex', gap: '12px', justifyContent: 'center' });

    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = 'Buy';
    Object.assign(confirmBtn.style, {
      padding: '8px 28px', borderRadius: '4px', fontWeight: 'bold',
      fontSize: '14px', cursor: 'pointer', border: 'none',
      background: 'linear-gradient(180deg, #4caf50 0%, #388e3c 100%)',
      color: '#fff',
    });
    confirmBtn.addEventListener('mouseenter', () => { confirmBtn.style.filter = 'brightness(1.2)'; });
    confirmBtn.addEventListener('mouseleave', () => { confirmBtn.style.filter = 'none'; });
    confirmBtn.addEventListener('click', () => {
      this._closeConfirm();
      onConfirm();
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    Object.assign(cancelBtn.style, {
      padding: '8px 28px', borderRadius: '4px', fontWeight: 'bold',
      fontSize: '14px', cursor: 'pointer',
      border: '1px solid #666', background: 'rgba(255,255,255,0.06)',
      color: '#aaa',
    });
    cancelBtn.addEventListener('mouseenter', () => { cancelBtn.style.background = 'rgba(255,255,255,0.12)'; });
    cancelBtn.addEventListener('mouseleave', () => { cancelBtn.style.background = 'rgba(255,255,255,0.06)'; });
    cancelBtn.addEventListener('click', () => { this._closeConfirm(); });

    btnRow.append(confirmBtn, cancelBtn);
    box.appendChild(btnRow);
    dialog.appendChild(box);
    this.overlay.appendChild(dialog);
    this._confirmDialog = dialog;
  }

  _closeConfirm() {
    if (this._confirmDialog) {
      this._confirmDialog.remove();
      this._confirmDialog = null;
    }
  }

  // ---------------------------------------------------------------
  //  Close the vendor panel
  // ---------------------------------------------------------------
  _close() {
    this._hideTooltip();
    this._closeConfirm();
    if (this._escHandler) {
      window.removeEventListener('keydown', this._escHandler);
      this._escHandler = null;
    }
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
    if (this._resolve) {
      this._resolve();
      this._resolve = null;
    }
  }
}
