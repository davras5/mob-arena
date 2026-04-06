import { Tooltip } from './tooltip.js';

export class SkillBookUI {
  constructor() {
    this.overlay = null;
    this.selectedSkillId = null;
    this._resolve = null;
    this._keyHandler = null;
    // For buildInto mode
    this._container = null;
    this._onRefresh = null;
  }

  /**
   * Show the Skill Book panel.
   * @param {SkillManager} skillManager
   * @param {string} playerClass - e.g. 'warrior', 'mage', 'ranger', 'necromancer'
   * @returns {Promise} resolves when the panel is closed
   */
  show(skillManager, playerClass) {
    this.selectedSkillId = null;

    // Remove any previous overlay
    this._cleanup();

    return new Promise((resolve) => {
      this._resolve = resolve;
      this._build(skillManager, playerClass);

      // ESC to close
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
   * Render skill book content into a given container (no overlay, no ESC handling).
   * Used by GameWindow to embed the skill book inside a panel.
   * @param {HTMLElement} container - DOM element to render into
   * @param {SkillManager} skillManager
   * @param {string} playerClass
   * @param {Function} onRefresh - called when content needs rebuilding (e.g. after skill assignment)
   */
  buildInto(container, skillManager, playerClass, onRefresh) {
    this.selectedSkillId = null;
    this._container = container;
    this._onRefresh = onRefresh || null;

    // Clear the container
    container.innerHTML = '';

    // Build content directly into the container
    this._buildContentInto(container, skillManager, playerClass);
  }

  /**
   * Shared content builder: appends active skills, passives, summon toggles,
   * and loadout sections into a target element.
   */
  _buildContentInto(target, skillManager, playerClass) {
    // Gather data
    const actives = skillManager.getAllActives().filter(s => s.isLearned);
    const passives = skillManager.getPassives();
    const summons = skillManager.getSummonToggles();
    const isNecro = playerClass === 'necromancer';

    // --- Active Skills Section ---
    target.appendChild(this._buildSectionTitle('ACTIVE SKILLS'));

    const instructionBanner = document.createElement('div');
    instructionBanner.innerHTML = '💡 <b>Drag a skill onto LMB / RMB</b> — or click a skill, then click an empty slot.';
    Object.assign(instructionBanner.style, {
      background: 'rgba(201, 168, 76, 0.10)',
      border: '1px solid rgba(201, 168, 76, 0.35)',
      borderRadius: '4px',
      padding: '10px 14px',
      marginBottom: '12px',
      color: '#e8d3a8',
      fontSize: '12px',
      textAlign: 'center',
      letterSpacing: '0.3px',
    });
    target.appendChild(instructionBanner);

    target.appendChild(this._buildActiveGrid(actives, skillManager));

    // --- Passive Skills Section ---
    if (passives.length > 0) {
      target.appendChild(this._buildSectionTitle('PASSIVE SKILLS'));
      target.appendChild(this._buildPassiveSection(passives));
    }

    // --- Summon Toggles (Necro only) ---
    if (isNecro && summons.length > 0) {
      target.appendChild(this._buildSectionTitle('SUMMON TOGGLES'));
      target.appendChild(this._buildSummonSection(summons, skillManager));
    }

    // --- Current Loadout Section ---
    target.appendChild(this._buildSectionTitle('CURRENT LOADOUT'));
    target.appendChild(this._buildLoadoutSection(skillManager));
  }

  // ---------------------------------------------------------------------------
  // Build
  // ---------------------------------------------------------------------------

  _build(skillManager, playerClass) {
    const overlay = document.createElement('div');
    this.overlay = overlay;
    Object.assign(overlay.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.7)',
      zIndex: '9000',
      fontFamily: "'Segoe UI', Arial, sans-serif",
      color: '#e0ddd5',
    });

    const panel = document.createElement('div');
    Object.assign(panel.style, {
      width: '80%',
      height: '85%',
      backgroundColor: '#1a1a2e',
      border: '2px solid #444',
      borderRadius: '8px',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      boxShadow: '0 0 40px rgba(0,0,0,0.8)',
    });
    overlay.appendChild(panel);

    // --- Header ---
    panel.appendChild(this._buildHeader());

    // --- Scrollable content ---
    const content = document.createElement('div');
    Object.assign(content.style, {
      flex: '1',
      overflowY: 'auto',
      padding: '12px 20px',
    });
    panel.appendChild(content);

    this._buildContentInto(content, skillManager, playerClass);

    document.body.appendChild(overlay);

    // Close if clicking outside the panel
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this._close();
    });
  }

  // ---------------------------------------------------------------------------
  // Header
  // ---------------------------------------------------------------------------

  _buildHeader() {
    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 20px',
      backgroundColor: '#12122a',
      borderBottom: '1px solid #333',
    });

    const title = document.createElement('span');
    title.textContent = 'SKILL BOOK';
    Object.assign(title.style, {
      fontSize: '22px',
      fontWeight: 'bold',
      letterSpacing: '2px',
      color: '#f0c040',
    });
    header.appendChild(title);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '[X]';
    Object.assign(closeBtn.style, {
      background: 'none',
      border: '1px solid #666',
      color: '#ccc',
      fontSize: '16px',
      padding: '4px 10px',
      cursor: 'pointer',
      borderRadius: '4px',
    });
    closeBtn.addEventListener('mouseenter', () => { closeBtn.style.color = '#fff'; closeBtn.style.borderColor = '#aaa'; });
    closeBtn.addEventListener('mouseleave', () => { closeBtn.style.color = '#ccc'; closeBtn.style.borderColor = '#666'; });
    closeBtn.addEventListener('click', () => this._close());
    header.appendChild(closeBtn);

    return header;
  }

  // ---------------------------------------------------------------------------
  // Section title helper
  // ---------------------------------------------------------------------------

  _buildSectionTitle(text) {
    const el = document.createElement('div');
    el.textContent = text;
    Object.assign(el.style, {
      fontSize: '14px',
      fontWeight: 'bold',
      letterSpacing: '1.5px',
      color: '#999',
      borderBottom: '1px solid #333',
      paddingBottom: '4px',
      marginTop: '16px',
      marginBottom: '10px',
    });
    return el;
  }

  // ---------------------------------------------------------------------------
  // Active Skills grid
  // ---------------------------------------------------------------------------

  _buildActiveGrid(actives, skillManager) {
    const grid = document.createElement('div');
    Object.assign(grid.style, {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
      gap: '10px',
    });

    if (actives.length === 0) {
      const empty = document.createElement('div');
      empty.textContent = 'No learned active skills yet.';
      Object.assign(empty.style, { color: '#666', fontStyle: 'italic', padding: '10px 0' });
      grid.appendChild(empty);
      return grid;
    }

    for (const skill of actives) {
      const card = document.createElement('div');
      Object.assign(card.style, {
        backgroundColor: '#222244',
        border: '2px solid #333',
        borderRadius: '6px',
        padding: '10px',
        cursor: 'pointer',
        transition: 'border-color 0.15s, background-color 0.15s',
        userSelect: 'none',
      });

      // Icon
      const icon = document.createElement('div');
      icon.textContent = skill.icon || '?';
      Object.assign(icon.style, { fontSize: '28px', textAlign: 'center', marginBottom: '4px' });
      card.appendChild(icon);

      // Name
      const name = document.createElement('div');
      name.textContent = skill.name;
      Object.assign(name.style, {
        fontSize: '13px',
        fontWeight: 'bold',
        textAlign: 'center',
        color: '#e8e0c8',
        marginBottom: '4px',
      });
      card.appendChild(name);

      // Level
      const lvl = document.createElement('div');
      lvl.textContent = `Lv ${skill.currentLevel} / ${skill.maxLevel}`;
      Object.assign(lvl.style, { fontSize: '11px', textAlign: 'center', color: '#aaa', marginBottom: '4px' });
      card.appendChild(lvl);

      // Resource cost + cooldown
      const stats = document.createElement('div');
      const costText = skill.resourceCost ? `Cost: ${skill.resourceCost}` : 'Free';
      const cdText = skill.cooldown ? `CD: ${skill.cooldown}s` : '';
      stats.textContent = [costText, cdText].filter(Boolean).join('  ');
      Object.assign(stats.style, { fontSize: '10px', textAlign: 'center', color: '#888' });
      card.appendChild(stats);

      // Equipped badge
      if (skill.isEquippedLeft || skill.isEquippedRight) {
        const badge = document.createElement('div');
        const slot = skill.isEquippedLeft ? 'LMB' : 'RMB';
        badge.textContent = slot;
        Object.assign(badge.style, {
          marginTop: '4px',
          textAlign: 'center',
          fontSize: '10px',
          fontWeight: 'bold',
          color: '#4af',
        });
        card.appendChild(badge);
      }

      // Selection behaviour
      card.addEventListener('click', () => {
        this._selectSkillCard(card, skill.id);
      });
      card.addEventListener('mouseenter', () => {
        if (this.selectedSkillId !== skill.id) card.style.borderColor = '#666';
      });
      card.addEventListener('mouseleave', () => {
        if (this.selectedSkillId !== skill.id) card.style.borderColor = '#333';
      });

      // Drag-and-drop support (for dragging skills to HUD action bar slots)
      card.draggable = true;
      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('application/skill', JSON.stringify({ skillId: skill.id, type: 'active' }));
        e.dataTransfer.effectAllowed = 'move';
      });

      card.dataset.skillId = skill.id;
      grid.appendChild(card);
    }

    return grid;
  }

  _selectSkillCard(card, skillId) {
    // Ensure pulse keyframes exist in the document
    if (!document.getElementById('skillbook-pulse-style')) {
      const style = document.createElement('style');
      style.id = 'skillbook-pulse-style';
      style.textContent = `
        @keyframes skillbook-slot-pulse {
          0%, 100% { border-color: #f0c040; box-shadow: 0 0 0 rgba(240,192,64,0); }
          50%      { border-color: #ffd860; box-shadow: 0 0 12px rgba(240,192,64,0.6); }
        }
      `;
      document.head.appendChild(style);
    }

    // Deselect all cards (check both overlay and container modes)
    const root = this.overlay || this._container;
    if (root) {
      for (const c of root.querySelectorAll('[data-skill-id]')) {
        c.style.borderColor = '#333';
        c.style.backgroundColor = '#222244';
      }
    }
    this.selectedSkillId = skillId;
    card.style.borderColor = '#f0c040';
    card.style.backgroundColor = '#2a2a50';

    // Pulse empty loadout slots to indicate valid drop targets
    if (root) {
      for (const slot of root.querySelectorAll('[data-empty-slot="true"]')) {
        slot.style.animation = 'skillbook-slot-pulse 1.2s ease-in-out infinite';
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Passive Skills (read-only dots)
  // ---------------------------------------------------------------------------

  _buildPassiveSection(passives) {
    const container = document.createElement('div');
    Object.assign(container.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    });

    for (const passive of passives) {
      const row = document.createElement('div');
      Object.assign(row.style, {
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '6px 8px',
        backgroundColor: '#1e1e36',
        borderRadius: '4px',
      });

      // Icon
      const icon = document.createElement('span');
      icon.textContent = passive.icon || '';
      Object.assign(icon.style, { fontSize: '18px', width: '24px', textAlign: 'center' });
      row.appendChild(icon);

      // Name
      const name = document.createElement('span');
      name.textContent = passive.name;
      Object.assign(name.style, { fontSize: '13px', fontWeight: 'bold', color: '#d0ccb8', minWidth: '130px' });
      row.appendChild(name);

      // Dots
      const dots = document.createElement('span');
      let dotStr = '';
      for (let i = 0; i < passive.maxRanks; i++) {
        dotStr += i < passive.currentRank ? '\u25cf' : '\u25cb';
      }
      dots.textContent = dotStr;
      Object.assign(dots.style, {
        fontSize: '14px',
        letterSpacing: '2px',
        color: passive.currentRank > 0 ? '#f0c040' : '#555',
      });
      row.appendChild(dots);

      // Effect description + current bonus
      const desc = document.createElement('span');
      let descText = passive.description || '';
      if (passive.currentRank > 0 && passive.effectPerRank) {
        const bonusParts = [];
        for (const [key, val] of Object.entries(passive.effectPerRank)) {
          const total = val * passive.currentRank;
          const formattedName = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
          const formattedVal = Math.abs(val) < 1 ? `${(total * 100).toFixed(0)}%` : total;
          bonusParts.push(`${formattedName}: ${val < 0 ? '' : '+'}${formattedVal}`);
        }
        descText += ` (${bonusParts.join(', ')})`;
      }
      desc.textContent = descText;
      Object.assign(desc.style, { fontSize: '11px', color: '#888', flex: '1' });
      row.appendChild(desc);

      container.appendChild(row);
    }

    // "Visit Trainer" hint
    const hint = document.createElement('div');
    hint.textContent = 'Visit Trainer to invest passive points';
    Object.assign(hint.style, {
      fontSize: '11px',
      color: '#666',
      fontStyle: 'italic',
      textAlign: 'center',
      marginTop: '6px',
    });
    container.appendChild(hint);

    return container;
  }

  // ---------------------------------------------------------------------------
  // Summon Toggles (Necro only)
  // ---------------------------------------------------------------------------

  _buildSummonSection(summons, skillManager) {
    const container = document.createElement('div');
    Object.assign(container.style, {
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
    });

    for (const summon of summons) {
      const isLearned = summon.currentLevel > 0;
      const row = document.createElement('div');
      Object.assign(row.style, {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '8px 10px',
        backgroundColor: isLearned ? '#1e2e1e' : '#1e1e1e',
        borderRadius: '4px',
        opacity: isLearned ? '1' : '0.5',
      });

      // Icon
      const icon = document.createElement('span');
      icon.textContent = summon.icon || '';
      Object.assign(icon.style, { fontSize: '22px', width: '28px', textAlign: 'center' });
      row.appendChild(icon);

      // Name + level
      const info = document.createElement('div');
      Object.assign(info.style, { flex: '1' });

      const name = document.createElement('div');
      name.textContent = `${summon.name} (Lv ${summon.currentLevel})`;
      Object.assign(name.style, { fontSize: '13px', fontWeight: 'bold', color: '#c0e0b0' });
      info.appendChild(name);

      // Stats line: max pets, mana cost, cooldown
      if (isLearned && summon.levelData) {
        const statsLine = document.createElement('div');
        const maxPets = summon.levelData.maxCount || summon.levelData.maxSummons || summon.levelData.maxPets || '?';
        const parts = [];
        parts.push(`Max: ${maxPets}`);
        if (summon.resourceCost) parts.push(`Cost: ${summon.resourceCost}`);
        if (summon.cooldown) parts.push(`CD: ${summon.cooldown}s`);
        statsLine.textContent = parts.join('  |  ');
        Object.assign(statsLine.style, { fontSize: '11px', color: '#889988' });
        info.appendChild(statsLine);
      }

      row.appendChild(info);

      // ON / OFF toggle
      if (isLearned) {
        const toggle = document.createElement('button');
        const isOn = summon.isActive;
        toggle.textContent = isOn ? 'ON' : 'OFF';
        Object.assign(toggle.style, {
          padding: '4px 14px',
          fontSize: '12px',
          fontWeight: 'bold',
          border: '1px solid',
          borderRadius: '4px',
          cursor: 'pointer',
          minWidth: '50px',
          backgroundColor: isOn ? '#2a5a2a' : '#3a2222',
          borderColor: isOn ? '#4a8a4a' : '#6a3333',
          color: isOn ? '#6f6' : '#f66',
        });
        toggle.addEventListener('click', () => {
          skillManager.toggleSummon(summon.id);
          // Re-render toggle state
          const nowOn = !!skillManager.summonStates[summon.id];
          toggle.textContent = nowOn ? 'ON' : 'OFF';
          toggle.style.backgroundColor = nowOn ? '#2a5a2a' : '#3a2222';
          toggle.style.borderColor = nowOn ? '#4a8a4a' : '#6a3333';
          toggle.style.color = nowOn ? '#6f6' : '#f66';
        });
        row.appendChild(toggle);
      } else {
        const locked = document.createElement('span');
        locked.textContent = 'Not Learned';
        Object.assign(locked.style, { fontSize: '11px', color: '#666' });
        row.appendChild(locked);
      }

      container.appendChild(row);
    }

    return container;
  }

  // ---------------------------------------------------------------------------
  // Current Loadout (LMB + RMB)
  // ---------------------------------------------------------------------------

  _buildLoadoutSection(skillManager) {
    const container = document.createElement('div');
    Object.assign(container.style, {
      display: 'flex',
      gap: '20px',
      justifyContent: 'center',
      padding: '10px 0',
    });

    const leftInfo = skillManager.getLeftSkill();
    const rightInfo = skillManager.getRightSkill();

    container.appendChild(this._buildSlotBox('LMB', leftInfo, () => {
      if (this.selectedSkillId) {
        skillManager.equipToLeft(this.selectedSkillId);
        this._refresh(skillManager);
      }
    }));

    container.appendChild(this._buildSlotBox('RMB', rightInfo, () => {
      if (this.selectedSkillId) {
        skillManager.equipToRight(this.selectedSkillId);
        this._refresh(skillManager);
      }
    }));

    return container;
  }

  _buildSlotBox(label, skillInfo, onClick) {
    const box = document.createElement('div');
    Object.assign(box.style, {
      width: '160px',
      height: '100px',
      backgroundColor: '#222244',
      border: '2px solid #444',
      borderRadius: '8px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      transition: 'border-color 0.15s',
      userSelect: 'none',
    });

    // Label
    const lbl = document.createElement('div');
    lbl.textContent = label;
    Object.assign(lbl.style, {
      fontSize: '11px',
      fontWeight: 'bold',
      color: '#888',
      letterSpacing: '1px',
      marginBottom: '4px',
    });
    box.appendChild(lbl);

    let isEmptySlot = false;
    if (skillInfo) {
      const icon = document.createElement('div');
      icon.textContent = skillInfo.skill.icon || '?';
      Object.assign(icon.style, { fontSize: '28px' });
      box.appendChild(icon);

      const name = document.createElement('div');
      name.textContent = skillInfo.skill.name;
      Object.assign(name.style, { fontSize: '12px', color: '#e8e0c8', fontWeight: 'bold' });
      box.appendChild(name);
    } else {
      isEmptySlot = true;
      const empty = document.createElement('div');
      empty.textContent = '[ Empty ]';
      Object.assign(empty.style, {
        fontSize: '14px',
        color: '#c9a84c',
        fontWeight: 'bold',
        letterSpacing: '0.5px',
      });
      box.appendChild(empty);
    }

    // Hint when a skill is selected
    const hint = document.createElement('div');
    hint.textContent = 'Click to assign';
    Object.assign(hint.style, {
      fontSize: isEmptySlot ? '13px' : '9px',
      color: isEmptySlot ? '#c9a84c' : '#666',
      fontWeight: isEmptySlot ? 'bold' : 'normal',
      marginTop: '4px',
    });
    box.appendChild(hint);

    // Mark empty slots so we can pulse them when a skill is selected
    if (isEmptySlot) {
      box.dataset.emptySlot = 'true';
    }

    box.addEventListener('mouseenter', () => { box.style.borderColor = '#f0c040'; });
    box.addEventListener('mouseleave', () => { box.style.borderColor = '#444'; });
    box.addEventListener('click', onClick);

    return box;
  }

  // ---------------------------------------------------------------------------
  // Refresh (re-render in place)
  // ---------------------------------------------------------------------------

  _refresh(skillManager) {
    // Re-read playerClass from skillManager
    const playerClass = skillManager.playerClass;

    // If in buildInto mode, call the onRefresh callback so the parent rebuilds
    if (this._container && this._onRefresh) {
      this._onRefresh();
      return;
    }

    // Overlay mode: tear down and rebuild
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    this._build(skillManager, playerClass);
  }

  // ---------------------------------------------------------------------------
  // Close / cleanup
  // ---------------------------------------------------------------------------

  _close() {
    this._cleanup();
    if (this._resolve) {
      const resolve = this._resolve;
      this._resolve = null;
      resolve();
    }
  }

  _cleanup() {
    if (this.overlay && this.overlay.parentNode) {
      this.overlay.parentNode.removeChild(this.overlay);
    }
    this.overlay = null;
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler);
      this._keyHandler = null;
    }
  }
}
