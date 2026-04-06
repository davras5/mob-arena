/* ---------------------------------------------------------------
 *  CharacterUI — full-screen character panel overlay
 *
 *  Opened with the C key.  Shows attribute allocation, offensive
 *  stats, defensive stats, and movement stats.
 *
 *  All DOM is built with createElement + inline styles so the file
 *  is self-contained (no external CSS required).
 * --------------------------------------------------------------- */

const ATTR_LABELS = {
  str: 'STR',
  agi: 'AGI',
  int: 'INT',
  sta: 'STA',
};

const ATTR_FULL_NAMES = {
  str: 'Strength',
  agi: 'Agility',
  int: 'Intellect',
  sta: 'Stamina',
};

const ATTR_DESCRIPTIONS = {
  str: 'Increases physical damage and armor',
  agi: 'Increases attack speed, crit chance, and dodge',
  int: 'Increases ability damage and max resource',
  sta: 'Increases max HP and HP regen',
};

// Which stats each attribute affects (for hover preview highlighting)
const ATTR_AFFECTED_STATS = {
  str: ['Damage', 'Armor'],
  agi: ['Attack Speed', 'Crit Chance', 'Dodge Chance'],
  int: ['Damage', 'Max Resource'],
  sta: ['Max HP', 'HP Regen'],
};

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

// ---------------------------------------------------------------
//  CharacterUI
// ---------------------------------------------------------------

export class CharacterUI {
  constructor() {
    this._overlay = null;
    this._panel = null;
    this._body = null;
    this._buildIntoContainer = null;
    this._resolve = null;
    this._boundKeyHandler = null;
    this._highlightedStats = new Set();
  }

  /**
   * Render the character panel content into an existing container element.
   * Does NOT create an overlay, dimming background, or ESC/close handling.
   * The caller (e.g. GameWindow) is responsible for the surrounding chrome.
   *
   * @param {HTMLElement} container         - element to render into
   * @param {object}      player            - player entity
   * @param {function}    onAllocate        - (attrName) => void — spend 1 point
   * @param {function}    onResetAttributes - (goldCost) => void — attribute respec
   */
  buildInto(container, player, onAllocate, onResetAttributes) {
    this._player = player;
    this._onAllocate = onAllocate;
    this._onResetAttributes = onResetAttributes;
    this._buildIntoContainer = container;

    container.innerHTML = '';
    this._body = container;
    this._render();
  }

  /**
   * Show the character panel as a full-screen overlay.
   *
   * @param {object}   player              - player entity
   * @param {function} onAllocate          - (attrName) => void — spend 1 point
   * @param {function} onResetAttributes   - (goldCost) => void — attribute respec
   * @returns {Promise} resolves when the panel is closed
   */
  show(player, onAllocate, onResetAttributes) {
    this.hide();

    this._player = player;
    this._onAllocate = onAllocate;
    this._onResetAttributes = onResetAttributes;
    this._buildIntoContainer = null;

    return new Promise((resolve) => {
      this._resolve = resolve;
      this._buildOverlay();
      // Render content into the overlay's body area, but keep
      // _buildIntoContainer null so _rebuild knows we're in overlay mode.
      this._body.innerHTML = '';
      this._render();
      this._buildIntoContainer = null;
      this._attachGlobalListeners();
    });
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
      width: '520px',
      maxHeight: '90vh',
      backgroundColor: '#1a1a2e',
      border: '2px solid #444',
      borderRadius: '8px',
      overflow: 'hidden',
    });

    // Header bar
    const header = this._buildHeader();
    this._panel.appendChild(header);

    // Scrollable body
    this._body = _el('div', {
      display: 'flex',
      flexDirection: 'column',
      padding: '16px',
      gap: '16px',
      overflowY: 'auto',
      flex: '1',
    });
    this._panel.appendChild(this._body);

    this._overlay.appendChild(this._panel);
    document.body.appendChild(this._overlay);
  }

  _buildHeader() {
    const p = this._player;
    const classColor = p.color || '#3498db';
    const className = (p.classConfig && p.classConfig.name) || p.playerClass || 'Unknown';

    const header = _el('div', {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '10px 16px',
      backgroundColor: '#16213e',
      borderBottom: '1px solid #333',
    });

    // Left side: class name + level
    const leftInfo = _el('div', {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    });

    const nameEl = _el('span', {
      fontSize: '18px',
      fontWeight: 'bold',
      color: classColor,
    }, { textContent: className });

    const levelEl = _el('span', {
      fontSize: '14px',
      color: '#aaa',
    }, { textContent: `Level ${p.level}` });

    leftInfo.appendChild(nameEl);
    leftInfo.appendChild(levelEl);

    // XP bar
    const xpPct = p.xpToNext > 0 ? Math.min((p.xp / p.xpToNext) * 100, 100) : 100;
    const xpContainer = _el('div', {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
    });
    const xpLabel = _el('span', {
      fontSize: '11px',
      color: '#888',
    }, { textContent: 'XP' });
    const xpBarOuter = _el('div', {
      width: '100px',
      height: '8px',
      backgroundColor: '#111',
      borderRadius: '4px',
      overflow: 'hidden',
      border: '1px solid #333',
    });
    const xpBarInner = _el('div', {
      width: `${xpPct}%`,
      height: '100%',
      backgroundColor: '#f1c40f',
      borderRadius: '4px',
      transition: 'width 0.3s',
    });
    xpBarOuter.appendChild(xpBarInner);
    const xpText = _el('span', {
      fontSize: '11px',
      color: '#888',
    }, { textContent: `${p.xp}/${p.xpToNext}` });

    xpContainer.appendChild(xpLabel);
    xpContainer.appendChild(xpBarOuter);
    xpContainer.appendChild(xpText);

    // Right side: close button
    const closeBtn = _el('button', {
      background: 'none',
      border: '1px solid #666',
      color: '#ccc',
      padding: '4px 12px',
      cursor: 'pointer',
      borderRadius: '4px',
      fontSize: '14px',
    }, { textContent: 'X' });
    closeBtn.addEventListener('click', () => this.hide());
    closeBtn.addEventListener('mouseenter', () => { closeBtn.style.backgroundColor = '#333'; });
    closeBtn.addEventListener('mouseleave', () => { closeBtn.style.backgroundColor = 'transparent'; });

    const leftCol = _el('div', {
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
    });
    leftCol.appendChild(leftInfo);
    leftCol.appendChild(xpContainer);

    header.appendChild(leftCol);
    header.appendChild(closeBtn);

    return header;
  }

  // ===========================================================
  //  Render content
  // ===========================================================

  _render() {
    this._body.innerHTML = '';
    this._highlightedStats = new Set();

    this._renderAttributes();
    this._renderOffensiveStats();
    this._renderDefensiveStats();
    this._renderMovementStats();
  }

  // -----------------------------------------------------------
  //  Attributes section
  // -----------------------------------------------------------

  _renderAttributes() {
    const p = this._player;
    const hasPoints = (p.attributePointsAvailable || 0) > 0;
    const classColor = p.color || '#3498db';
    const primary = p.primaryAttribute || 'str';

    const section = this._makeSection('ATTRIBUTES');

    // 2x2 grid for attributes
    const grid = _el('div', {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '8px 24px',
    });

    const attrOrder = ['str', 'agi', 'int', 'sta'];
    for (const attr of attrOrder) {
      const row = this._buildAttributeRow(attr, p, hasPoints, classColor, primary);
      grid.appendChild(row);
    }

    section.appendChild(grid);

    // Available points display
    const pointsRow = _el('div', {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: '10px',
      padding: '6px 10px',
      backgroundColor: hasPoints ? 'rgba(241,196,15,0.1)' : 'transparent',
      borderRadius: '4px',
      border: hasPoints ? '1px solid rgba(241,196,15,0.3)' : '1px solid transparent',
    });

    const pointsLabel = _el('span', {
      fontSize: '13px',
      color: hasPoints ? '#f1c40f' : '#666',
      fontWeight: hasPoints ? 'bold' : 'normal',
    }, { textContent: `Available points: ${p.attributePointsAvailable || 0}` });

    pointsRow.appendChild(pointsLabel);

    // Reset button
    const resetCost = (p.level || 1) * 15;
    const canAfford = (p.gold || 0) >= resetCost;
    const hasAllocated = attrOrder.some(a => (p.attributes[a] || 0) > 0);

    const resetBtn = _el('button', {
      background: 'none',
      border: `1px solid ${canAfford && hasAllocated ? '#e67e22' : '#555'}`,
      color: canAfford && hasAllocated ? '#e67e22' : '#555',
      padding: '4px 10px',
      cursor: canAfford && hasAllocated ? 'pointer' : 'not-allowed',
      borderRadius: '4px',
      fontSize: '12px',
      opacity: canAfford && hasAllocated ? '1' : '0.5',
    }, { innerHTML: `Reset <span style="color:#f1c40f;font-size:11px;">(${resetCost}g)</span>` });

    if (canAfford && hasAllocated) {
      resetBtn.addEventListener('click', () => {
        this._confirmReset(resetCost, () => {
          if (this._onResetAttributes) {
            this._onResetAttributes(resetCost);
            this._rebuild();
          }
        });
      });
      resetBtn.addEventListener('mouseenter', () => { resetBtn.style.backgroundColor = 'rgba(230,126,34,0.15)'; });
      resetBtn.addEventListener('mouseleave', () => { resetBtn.style.backgroundColor = 'transparent'; });
    }

    pointsRow.appendChild(resetBtn);
    section.appendChild(pointsRow);

    this._body.appendChild(section);
  }

  _buildAttributeRow(attr, player, hasPoints, classColor, primary) {
    const base = (player.baseAttributes && player.baseAttributes[attr]) || 0;
    const allocated = (player.attributes && player.attributes[attr]) || 0;
    const total = base + allocated;
    const isPrimary = attr === primary;

    const row = _el('div', {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '4px 8px',
      borderRadius: '4px',
      backgroundColor: isPrimary ? 'rgba(255,255,255,0.04)' : 'transparent',
    });

    // Attribute label
    const label = _el('span', {
      fontSize: '13px',
      fontWeight: 'bold',
      color: isPrimary ? classColor : '#bbb',
      minWidth: '36px',
    }, { textContent: ATTR_LABELS[attr] });

    // Star for primary
    if (isPrimary) {
      const star = _el('span', {
        fontSize: '12px',
        color: classColor,
        marginRight: '2px',
      }, { textContent: '\u2605' });
      row.appendChild(star);
    }

    row.appendChild(label);

    // Value display
    const valueStr = allocated > 0 ? `${total} (${base}+${allocated})` : `${total}`;
    const valueEl = _el('span', {
      fontSize: '13px',
      color: '#fff',
      minWidth: '60px',
    }, { textContent: valueStr });
    row.appendChild(valueEl);

    // Tooltip on hover for description
    row.title = `${ATTR_FULL_NAMES[attr]}: ${ATTR_DESCRIPTIONS[attr]}`;

    // [+] button
    if (hasPoints) {
      const plusBtn = _el('button', {
        background: 'none',
        border: '1px solid #3a3',
        color: '#3a3',
        width: '22px',
        height: '22px',
        cursor: 'pointer',
        borderRadius: '3px',
        fontSize: '14px',
        fontWeight: 'bold',
        lineHeight: '1',
        padding: '0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: '0',
      }, { textContent: '+' });

      plusBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this._onAllocate) {
          this._onAllocate(attr);
          this._rebuild();
        }
      });

      // Hover: highlight affected stats
      plusBtn.addEventListener('mouseenter', () => {
        plusBtn.style.backgroundColor = 'rgba(50,200,50,0.2)';
        plusBtn.style.color = '#5f5';
        this._highlightAffectedStats(attr, true);
      });
      plusBtn.addEventListener('mouseleave', () => {
        plusBtn.style.backgroundColor = 'transparent';
        plusBtn.style.color = '#3a3';
        this._highlightAffectedStats(attr, false);
      });

      row.appendChild(plusBtn);
    }

    return row;
  }

  // -----------------------------------------------------------
  //  Offensive stats
  // -----------------------------------------------------------

  _renderOffensiveStats() {
    const p = this._player;
    const section = this._makeSection('OFFENSIVE STATS');

    const stats = [
      { label: 'Damage',      value: `${p.damage || 0}` },
      { label: 'Attack Speed', value: `${(1 / (p.attackCooldown || 1)).toFixed(1)} atk/s` },
      { label: 'Crit Chance',  value: `${((p.critChance || 0) * 100).toFixed(1)}%` },
      { label: 'Crit Damage',  value: `${((p.critDamageMultiplier || 1.5) * 100).toFixed(0)}%` },
      { label: 'Lifesteal',    value: `${((p.lifestealPercent || 0) * 100).toFixed(1)}%` },
      { label: 'Pierce',       value: `${p.pierce || 0}` },
    ];

    const grid = this._buildStatGrid(stats);
    section.appendChild(grid);
    this._body.appendChild(section);
  }

  // -----------------------------------------------------------
  //  Defensive stats
  // -----------------------------------------------------------

  _renderDefensiveStats() {
    const p = this._player;
    const section = this._makeSection('DEFENSIVE STATS');

    const resourceName = p.resourceName
      ? `Max ${p.resourceName.charAt(0).toUpperCase() + p.resourceName.slice(1)}`
      : 'Max Resource';

    const stats = [
      { label: 'Max HP',           value: `${p.maxHP || 100}` },
      { label: 'HP Regen',         value: `${(p.regenRate || 0).toFixed(1)}/s` },
      { label: 'Armor',            value: `${p.totalArmor || 0}` },
      { label: 'Damage Reduction', value: `${((p.damageReduction || 0) * 100).toFixed(1)}%` },
      { label: 'Dodge Chance',     value: `${((p.dodgeChance || 0) * 100).toFixed(1)}%` },
      { label: resourceName,       value: `${p.maxResource || 0}` },
    ];

    const grid = this._buildStatGrid(stats);
    section.appendChild(grid);
    this._body.appendChild(section);
  }

  // -----------------------------------------------------------
  //  Movement stats
  // -----------------------------------------------------------

  _renderMovementStats() {
    const p = this._player;
    const section = this._makeSection('MOVEMENT');

    const stats = [
      { label: 'Movement Speed', value: `${p.speed || 0}` },
    ];

    const grid = this._buildStatGrid(stats);
    section.appendChild(grid);
    this._body.appendChild(section);
  }

  // ===========================================================
  //  Shared builders
  // ===========================================================

  _makeSection(title) {
    const section = _el('div', {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    });

    const heading = _el('div', {
      fontSize: '12px',
      fontWeight: 'bold',
      color: '#888',
      textTransform: 'uppercase',
      letterSpacing: '1px',
      borderBottom: '1px solid #333',
      paddingBottom: '4px',
    }, { textContent: title });

    section.appendChild(heading);
    return section;
  }

  _buildStatGrid(stats) {
    const grid = _el('div', {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '4px 24px',
    });

    for (const stat of stats) {
      const row = _el('div', {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '3px 8px',
        borderRadius: '3px',
        transition: 'background-color 0.2s',
      });
      row.dataset.statLabel = stat.label;

      const labelEl = _el('span', {
        fontSize: '12px',
        color: '#999',
      }, { textContent: stat.label });

      const valueEl = _el('span', {
        fontSize: '12px',
        color: '#eee',
        fontWeight: 'bold',
      }, { textContent: stat.value });

      row.appendChild(labelEl);
      row.appendChild(valueEl);
      grid.appendChild(row);
    }

    return grid;
  }

  // ===========================================================
  //  Stat highlight on attribute hover
  // ===========================================================

  _highlightAffectedStats(attr, highlight) {
    const affected = ATTR_AFFECTED_STATS[attr] || [];
    if (!this._body) return;

    const statRows = this._body.querySelectorAll('[data-stat-label]');
    for (const row of statRows) {
      const label = row.dataset.statLabel;
      if (affected.includes(label)) {
        if (highlight) {
          row.style.backgroundColor = 'rgba(241,196,15,0.12)';
          row.querySelector('span').style.color = '#f1c40f';
        } else {
          row.style.backgroundColor = 'transparent';
          row.querySelector('span').style.color = '#999';
        }
      }
    }
  }

  // ===========================================================
  //  Respec confirmation dialog
  // ===========================================================

  _confirmReset(goldCost, onConfirm) {
    if (this._confirmDialog && this._confirmDialog.parentNode) {
      this._confirmDialog.parentNode.removeChild(this._confirmDialog);
    }
    const dialog = document.createElement('div');
    Object.assign(dialog.style, {
      position: 'fixed', top: '50%', left: '50%',
      transform: 'translate(-50%, -50%)',
      background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)',
      border: '2px solid #e67e22',
      borderRadius: '8px',
      boxShadow: '0 0 40px rgba(230,126,34,0.4)',
      padding: '24px 32px',
      zIndex: '100001',
      color: '#e8d3a8',
      fontFamily: '"Segoe UI", Arial, sans-serif',
      minWidth: '340px',
    });
    const title = document.createElement('div');
    title.textContent = 'Respec Attributes?';
    Object.assign(title.style, { color: '#e67e22', fontSize: '18px', fontWeight: 'bold', marginBottom: '12px', letterSpacing: '1px' });
    const body = document.createElement('div');
    body.innerHTML = `Reset all attribute points and refund them for <b style="color:#f1c40f">${goldCost}g</b>?<br><br><span style="font-size:11px;color:#a89c80">All allocated points will be returned. You can re-spend them however you like.</span>`;
    Object.assign(body.style, { fontSize: '14px', marginBottom: '20px', lineHeight: '1.5' });
    const btnRow = document.createElement('div');
    Object.assign(btnRow.style, { display: 'flex', gap: '12px', justifyContent: 'flex-end' });

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    Object.assign(cancelBtn.style, { background: 'transparent', border: '1px solid #555', color: '#888', padding: '8px 16px', cursor: 'pointer', borderRadius: '4px', fontFamily: 'inherit', fontSize: '13px' });
    cancelBtn.addEventListener('click', () => { dialog.parentNode.removeChild(dialog); this._confirmDialog = null; });

    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = 'Respec';
    Object.assign(confirmBtn.style, { background: 'rgba(230,126,34,0.2)', border: '1px solid #e67e22', color: '#e67e22', padding: '8px 20px', cursor: 'pointer', borderRadius: '4px', fontFamily: 'inherit', fontSize: '13px', fontWeight: 'bold' });
    confirmBtn.addEventListener('click', () => { dialog.parentNode.removeChild(dialog); this._confirmDialog = null; onConfirm(); });

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(confirmBtn);
    dialog.appendChild(title);
    dialog.appendChild(body);
    dialog.appendChild(btnRow);
    document.body.appendChild(dialog);
    this._confirmDialog = dialog;
    return true;
  }

  // ===========================================================
  //  Rebuild after allocation / reset
  // ===========================================================

  _rebuild() {
    // buildInto mode: just re-render content into the container
    if (this._buildIntoContainer) {
      this._buildIntoContainer.innerHTML = '';
      this._body = this._buildIntoContainer;
      this._render();
      return;
    }

    // Overlay mode: rebuild header + body to reflect updated stats
    if (!this._panel) return;

    // Remove old header and body
    this._panel.innerHTML = '';

    const header = this._buildHeader();
    this._panel.appendChild(header);

    this._body = _el('div', {
      display: 'flex',
      flexDirection: 'column',
      padding: '16px',
      gap: '16px',
      overflowY: 'auto',
      flex: '1',
    });
    this._panel.appendChild(this._body);

    this._render();
  }

  // ===========================================================
  //  Global listeners
  // ===========================================================

  _attachGlobalListeners() {
    this._boundKeyHandler = (e) => {
      if (e.key === 'Escape' || e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        e.stopPropagation();
        this.hide();
      }
    };
    document.addEventListener('keydown', this._boundKeyHandler, true);

    // Click overlay background to close
    this._overlay.addEventListener('click', (e) => {
      if (e.target === this._overlay) {
        this.hide();
      }
    });
  }

  // ===========================================================
  //  Teardown
  // ===========================================================

  hide() {
    if (this._boundKeyHandler) {
      document.removeEventListener('keydown', this._boundKeyHandler, true);
      this._boundKeyHandler = null;
    }

    if (this._overlay) {
      this._overlay.remove();
      this._overlay = null;
    }

    this._panel = null;
    this._body = null;
    this._buildIntoContainer = null;
    this._player = null;
    this._onAllocate = null;
    this._onResetAttributes = null;

    if (this._resolve) {
      const r = this._resolve;
      this._resolve = null;
      r();
    }
  }
}
