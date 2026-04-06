export class SkillVendorUI {
  constructor() {
    this.overlay = null;
    this._escHandler = null;
    this._resolve = null;
  }

  /**
   * Show the Skill Vendor / Trainer panel.
   * @param {object} skillManager - SkillManager instance
   * @param {object} player - player object with level, gold, passivePointsAvailable, attributePointsAvailable, passiveInvestments
   * @param {function} onSpendGold - callback(amount) to deduct gold
   * @param {function} onRespecPassives - callback() for passive respec
   * @param {function} onRespecAttributes - callback() for attribute respec
   * @returns {Promise} resolves when panel is closed
   */
  show(skillManager, player, onSpendGold, onRespecPassives, onRespecAttributes) {
    this.skillManager = skillManager;
    this.player = player;
    this.onSpendGold = onSpendGold;
    this.onRespecPassives = onRespecPassives;
    this.onRespecAttributes = onRespecAttributes;

    return new Promise((resolve) => {
      this._resolve = resolve;
      this._build();
      this._escHandler = (e) => {
        if (e.key === 'Escape') this._close();
      };
      window.addEventListener('keydown', this._escHandler);
    });
  }

  // --- Internal: build/rebuild the entire overlay ---
  _build() {
    if (this.overlay) this.overlay.remove();

    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'fixed',
      top: '0', left: '0', width: '100%', height: '100%',
      background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: '9999',
      fontFamily: "'Segoe UI', Arial, sans-serif",
    });
    this.overlay = overlay;

    const panel = document.createElement('div');
    Object.assign(panel.style, {
      width: '80%', height: '85%',
      background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)',
      border: '2px solid #c9a84c',
      borderRadius: '12px',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
      color: '#e0e0e0',
      boxShadow: '0 0 40px rgba(201,168,76,0.3)',
    });

    // --- Header ---
    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 24px',
      borderBottom: '2px solid #c9a84c',
      background: 'rgba(201,168,76,0.08)',
      flexShrink: '0',
    });

    const title = document.createElement('h2');
    title.textContent = 'SKILL TRAINER';
    Object.assign(title.style, {
      margin: '0', fontSize: '24px', fontWeight: 'bold',
      color: '#c9a84c', letterSpacing: '3px',
      textShadow: '0 0 10px rgba(201,168,76,0.4)',
    });

    const headerRight = document.createElement('div');
    Object.assign(headerRight.style, { display: 'flex', alignItems: 'center', gap: '16px' });

    const goldLabel = document.createElement('span');
    goldLabel.textContent = `Gold: ${this.player.gold}`;
    Object.assign(goldLabel.style, { color: '#ffd700', fontSize: '16px', fontWeight: 'bold' });

    const levelLabel = document.createElement('span');
    levelLabel.textContent = `Level: ${this.player.level}`;
    Object.assign(levelLabel.style, { color: '#aaa', fontSize: '14px' });

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

    // --- Body (scrollable, two sections) ---
    const body = document.createElement('div');
    Object.assign(body.style, {
      flex: '1', overflowY: 'auto', padding: '16px 24px',
    });

    // Build active skills section
    this._buildActiveSection(body);

    // Build passive skills section
    this._buildPassiveSection(body);

    panel.append(header, body);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
  }

  // --- Active Skills Section ---
  _buildActiveSection(parent) {
    const section = document.createElement('div');
    section.style.marginBottom = '24px';

    const sectionTitle = document.createElement('h3');
    sectionTitle.textContent = 'ACTIVE SKILLS FOR SALE';
    Object.assign(sectionTitle.style, {
      color: '#c9a84c', fontSize: '16px', letterSpacing: '2px',
      borderBottom: '1px solid #333', paddingBottom: '8px', marginBottom: '12px',
      margin: '0 0 12px 0',
    });
    section.appendChild(sectionTitle);

    const skills = this.skillManager.getAllSkills();
    const playerLevel = this.player.level;
    const gold = this.player.gold;

    for (const skill of skills) {
      if (skill.type !== 'active') continue;

      const currentLevel = skill.currentLevel;
      const maxLevel = skill.levels.length;
      const isOwned = currentLevel > 0;
      const isMaxed = currentLevel >= maxLevel;

      // Determine level requirement: tier-based (tier * 2) or from level data
      const tierLevelReq = (skill.tier || 0) * 2;

      // Determine gold cost for next action
      let nextGoldCost = 0;
      let nextLevelReq = tierLevelReq;
      if (!isMaxed) {
        const nextLevelData = skill.levels[currentLevel];
        // Use level data cost if available, otherwise derive from goldCost + upgrade multiplier
        if (nextLevelData && nextLevelData.cost !== undefined) {
          nextGoldCost = nextLevelData.cost;
        } else if (currentLevel === 0) {
          nextGoldCost = skill.goldCost || 0;
        } else {
          // Upgrade cost: base goldCost * (currentLevel + 1) * 0.6
          nextGoldCost = Math.round((skill.goldCost || 50) * (currentLevel + 1) * 0.6);
        }
        if (nextLevelData && nextLevelData.levelReq !== undefined) {
          nextLevelReq = nextLevelData.levelReq;
        } else {
          nextLevelReq = tierLevelReq + currentLevel;
        }
      }

      const meetsLevel = playerLevel >= nextLevelReq;
      const canAfford = gold >= nextGoldCost;
      const isLocked = !meetsLevel && !isOwned && !isMaxed;

      // Determine state
      let state, stateLabel, stateColor;
      if (isMaxed) {
        state = 'maxed'; stateLabel = 'MAX LEVEL'; stateColor = '#ffd700';
      } else if (isLocked) {
        state = 'locked'; stateLabel = `Lv ${nextLevelReq} req`; stateColor = '#666';
      } else if (isOwned) {
        state = 'owned'; stateLabel = `Lv ${currentLevel}/${maxLevel}`; stateColor = '#4caf50';
      } else {
        state = 'available'; stateLabel = 'Available'; stateColor = '#4fc3f7';
      }

      const row = document.createElement('div');
      Object.assign(row.style, {
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '10px 14px', marginBottom: '6px',
        background: isLocked ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)',
        borderRadius: '8px',
        border: isMaxed ? '1px solid rgba(255,215,0,0.3)' : '1px solid rgba(255,255,255,0.08)',
        opacity: isLocked ? '0.5' : '1',
        transition: 'background 0.15s',
      });

      // Icon
      const iconEl = document.createElement('span');
      iconEl.textContent = skill.icon || '?';
      Object.assign(iconEl.style, { fontSize: '28px', width: '36px', textAlign: 'center', flexShrink: '0' });

      // Info column
      const info = document.createElement('div');
      Object.assign(info.style, { flex: '1', minWidth: '0' });

      const nameRow = document.createElement('div');
      Object.assign(nameRow.style, { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' });

      const nameEl = document.createElement('span');
      nameEl.textContent = skill.name;
      Object.assign(nameEl.style, { fontWeight: 'bold', fontSize: '15px', color: '#fff' });

      const tierBadge = document.createElement('span');
      tierBadge.textContent = `T${skill.tier || 0}`;
      Object.assign(tierBadge.style, {
        fontSize: '11px', padding: '1px 6px', borderRadius: '3px',
        background: 'rgba(201,168,76,0.2)', color: '#c9a84c', fontWeight: 'bold',
      });

      const stateBadge = document.createElement('span');
      stateBadge.textContent = stateLabel;
      Object.assign(stateBadge.style, {
        fontSize: '11px', padding: '1px 6px', borderRadius: '3px',
        background: isMaxed ? 'rgba(255,215,0,0.2)' : 'rgba(255,255,255,0.08)',
        color: stateColor, fontWeight: 'bold',
      });

      nameRow.append(nameEl, tierBadge, stateBadge);

      const descEl = document.createElement('div');
      descEl.textContent = skill.description;
      Object.assign(descEl.style, { fontSize: '12px', color: '#999', marginBottom: '2px' });

      const costInfo = document.createElement('div');
      const resourceText = skill.resourceCost ? `Cost: ${skill.resourceCost} | ` : '';
      const cdText = skill.cooldown ? `CD: ${skill.cooldown}s` : '';
      costInfo.textContent = resourceText + cdText;
      Object.assign(costInfo.style, { fontSize: '11px', color: '#777' });

      info.append(nameRow, descEl, costInfo);

      // Action column
      const actionCol = document.createElement('div');
      Object.assign(actionCol.style, {
        display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
        flexShrink: '0', gap: '4px',
      });

      if (!isMaxed && !isLocked) {
        const buyBtn = document.createElement('button');
        const actionLabel = isOwned ? 'Upgrade' : 'Buy';
        buyBtn.textContent = `${actionLabel} - ${nextGoldCost}g`;
        const canBuy = canAfford && meetsLevel;

        Object.assign(buyBtn.style, {
          padding: '6px 14px', borderRadius: '4px', fontWeight: 'bold',
          fontSize: '13px', cursor: canBuy ? 'pointer' : 'default',
          border: 'none',
          background: canBuy ? 'linear-gradient(180deg, #4caf50 0%, #388e3c 100%)' : '#444',
          color: canBuy ? '#fff' : (canAfford ? '#aaa' : '#ff6666'),
          opacity: canBuy ? '1' : '0.7',
        });

        if (!canAfford) {
          buyBtn.textContent = `${actionLabel} - ${nextGoldCost}g`;
          buyBtn.style.color = '#ff6666';
        }

        if (canBuy) {
          buyBtn.addEventListener('mouseenter', () => { buyBtn.style.filter = 'brightness(1.2)'; });
          buyBtn.addEventListener('mouseleave', () => { buyBtn.style.filter = 'none'; });
          buyBtn.addEventListener('click', () => {
            this._buySkill(skill.id, nextGoldCost);
          });
        }

        actionCol.appendChild(buyBtn);

        if (!meetsLevel && isOwned) {
          const reqLabel = document.createElement('span');
          reqLabel.textContent = `Requires Lv ${nextLevelReq}`;
          Object.assign(reqLabel.style, { fontSize: '10px', color: '#ff6666' });
          actionCol.appendChild(reqLabel);
        }
      }

      row.append(iconEl, info, actionCol);
      section.appendChild(row);
    }

    parent.appendChild(section);
  }

  // --- Passive Skills Section ---
  _buildPassiveSection(parent) {
    const section = document.createElement('div');

    const sectionHeader = document.createElement('div');
    Object.assign(sectionHeader.style, {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      borderBottom: '1px solid #333', paddingBottom: '8px', marginBottom: '12px',
    });

    const sectionTitle = document.createElement('h3');
    sectionTitle.textContent = 'PASSIVE SKILLS';
    Object.assign(sectionTitle.style, {
      color: '#c9a84c', fontSize: '16px', letterSpacing: '2px', margin: '0',
    });

    const pointsLabel = document.createElement('span');
    const passivePoints = this.player.passivePointsAvailable || 0;
    pointsLabel.textContent = `Points available: ${passivePoints}`;
    Object.assign(pointsLabel.style, {
      color: passivePoints > 0 ? '#4caf50' : '#888',
      fontSize: '14px', fontWeight: 'bold',
    });

    sectionHeader.append(sectionTitle, pointsLabel);
    section.appendChild(sectionHeader);

    // Get passives from the skill data
    const classData = this.skillManager.allSkills;
    // passives are stored separately on the source data; try player's class from raw data
    // We rely on the structure: skillManager has allSkills (actives), and the original data has passives
    // The player object should carry passives info or we read from skillManager
    const passives = this.player.passives || this.skillManager.passives || [];
    const investments = this.player.passiveInvestments || {};

    for (const passive of passives) {
      const currentRanks = investments[passive.id] || 0;
      const maxRanks = passive.maxRanks || 5;
      const isMaxed = currentRanks >= maxRanks;

      const row = document.createElement('div');
      Object.assign(row.style, {
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '8px 14px', marginBottom: '4px',
        background: 'rgba(255,255,255,0.04)',
        borderRadius: '6px',
        border: '1px solid rgba(255,255,255,0.06)',
      });

      // Icon + Name
      const nameCol = document.createElement('div');
      Object.assign(nameCol.style, { display: 'flex', alignItems: 'center', gap: '8px', minWidth: '160px' });

      const icon = document.createElement('span');
      icon.textContent = passive.icon || '?';
      icon.style.fontSize = '20px';

      const name = document.createElement('span');
      name.textContent = passive.name;
      Object.assign(name.style, { fontWeight: 'bold', fontSize: '14px', color: '#ddd' });

      nameCol.append(icon, name);

      // Dots
      const dotsCol = document.createElement('div');
      Object.assign(dotsCol.style, { display: 'flex', gap: '3px', alignItems: 'center' });

      for (let i = 0; i < maxRanks; i++) {
        const dot = document.createElement('span');
        dot.textContent = i < currentRanks ? '\u25CF' : '\u25CB';
        Object.assign(dot.style, {
          color: i < currentRanks ? '#4caf50' : '#555',
          fontSize: '14px',
        });
        dotsCol.appendChild(dot);
      }

      // [+] button
      const plusBtn = document.createElement('button');
      plusBtn.textContent = '+';
      Object.assign(plusBtn.style, {
        width: '26px', height: '26px', borderRadius: '4px',
        border: '1px solid #4caf50', background: 'rgba(76,175,80,0.15)',
        color: '#4caf50', fontWeight: 'bold', fontSize: '16px',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        visibility: (passivePoints > 0 && !isMaxed) ? 'visible' : 'hidden',
        padding: '0', lineHeight: '1',
      });
      if (passivePoints > 0 && !isMaxed) {
        plusBtn.addEventListener('mouseenter', () => { plusBtn.style.background = 'rgba(76,175,80,0.3)'; });
        plusBtn.addEventListener('mouseleave', () => { plusBtn.style.background = 'rgba(76,175,80,0.15)'; });
        plusBtn.addEventListener('click', () => {
          this._investPassive(passive.id);
        });
      }

      // Description
      const descEl = document.createElement('span');
      descEl.textContent = passive.description;
      Object.assign(descEl.style, { fontSize: '12px', color: '#999', flex: '1' });

      row.append(nameCol, dotsCol, plusBtn, descEl);
      section.appendChild(row);
    }

    // --- Respec buttons ---
    const respecRow = document.createElement('div');
    Object.assign(respecRow.style, {
      display: 'flex', gap: '12px', marginTop: '16px',
      paddingTop: '12px', borderTop: '1px solid #333',
    });

    const passiveRespecCost = (this.player.level || 1) * 20;
    const attrRespecCost = (this.player.level || 1) * 15;

    const respecPassiveBtn = this._createRespecButton(
      `Respec Passives (${passiveRespecCost}g)`,
      this.player.gold >= passiveRespecCost,
      () => {
        if (this.player.gold >= passiveRespecCost) {
          if (this.onSpendGold) this.onSpendGold(passiveRespecCost);
          if (this.onRespecPassives) this.onRespecPassives();
          this._build(); // rebuild UI
        }
      }
    );

    const respecAttrBtn = this._createRespecButton(
      `Respec Attributes (${attrRespecCost}g)`,
      this.player.gold >= attrRespecCost,
      () => {
        if (this.player.gold >= attrRespecCost) {
          if (this.onSpendGold) this.onSpendGold(attrRespecCost);
          if (this.onRespecAttributes) this.onRespecAttributes();
          this._build(); // rebuild UI
        }
      }
    );

    respecRow.append(respecPassiveBtn, respecAttrBtn);
    section.appendChild(respecRow);

    parent.appendChild(section);
  }

  _createRespecButton(text, canAfford, onClick) {
    const btn = document.createElement('button');
    btn.textContent = text;
    Object.assign(btn.style, {
      padding: '8px 18px', borderRadius: '4px', fontWeight: 'bold',
      fontSize: '13px',
      cursor: canAfford ? 'pointer' : 'default',
      border: canAfford ? '1px solid #ff9800' : '1px solid #555',
      background: canAfford ? 'rgba(255,152,0,0.12)' : 'rgba(255,255,255,0.03)',
      color: canAfford ? '#ff9800' : '#666',
    });
    if (canAfford) {
      btn.addEventListener('mouseenter', () => { btn.style.background = 'rgba(255,152,0,0.25)'; });
      btn.addEventListener('mouseleave', () => { btn.style.background = 'rgba(255,152,0,0.12)'; });
      btn.addEventListener('click', onClick);
    }
    return btn;
  }

  // --- Actions ---
  _buySkill(skillId, cost) {
    const result = this.skillManager.learnSkill(skillId, this.player.level, this.player.gold);
    if (result && result.success) {
      const actualCost = result.cost !== undefined ? result.cost : cost;
      if (this.onSpendGold) this.onSpendGold(actualCost);
      this.skillManager.applyLearnSkill(skillId);
      this._build(); // rebuild to reflect changes
    }
  }

  _investPassive(passiveId) {
    if ((this.player.passivePointsAvailable || 0) <= 0) return;
    if (!this.player.passiveInvestments) this.player.passiveInvestments = {};
    const passive = (this.player.passives || this.skillManager.passives || []).find(p => p.id === passiveId);
    if (!passive) return;
    const current = this.player.passiveInvestments[passiveId] || 0;
    if (current >= (passive.maxRanks || 5)) return;
    this.player.passiveInvestments[passiveId] = current + 1;
    this.player.passivePointsAvailable--;
    this._build(); // rebuild
  }

  _close() {
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
