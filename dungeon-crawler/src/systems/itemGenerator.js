/* ---------------------------------------------------------------
 *  ItemGenerator — procedural random item factory for the ARPG
 *  Reads itemBasesData (itemBases.json) and affixesData (affixes.json).
 * --------------------------------------------------------------- */

const RARITY_ORDER = ['junk', 'common', 'uncommon', 'rare', 'epic', 'legendary'];

const BASE_RARITY_WEIGHTS = {
  junk:      15,
  common:    45,
  uncommon:  25,
  rare:      10,
  epic:       4,
  legendary:  1,
};

const RARITY_COLORS = {
  junk:      '#888888',
  common:    '#ffffff',
  uncommon:  '#3498db',
  rare:      '#f1c40f',
  epic:      '#9b59b6',
  legendary: '#e67e22',
};

const SELL_VALUE_MULT = {
  junk:      1,
  common:    2,
  uncommon:  4,
  rare:      8,
  epic:      16,
  legendary: 40,
};

const LEGENDARY_UNIQUE_EFFECTS = [
  'Attacks have 10% chance to chain lightning',
  'On kill, restore 5% of max HP',
  'Critical hits freeze enemies for 1s',
  'Gain a shield equal to 8% of damage dealt every 5s',
  'Enemies near you take 3% of their max HP as damage per second',
  'Every 4th hit deals double damage',
  'Kills grant +15% move speed for 3s',
  'Taking fatal damage instead heals 30% HP (60s cooldown)',
  'Summon a spectral ally for 5s on elite kill',
  'Mana costs reduced by 20% while above 80% HP',
];

// ---------------------------------------------------------------
//  Helpers
// ---------------------------------------------------------------

function _uid() {
  return `item_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
}

function _clamp(val, lo, hi) {
  return Math.max(lo, Math.min(hi, val));
}

function _pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function _weightedPick(weightMap) {
  const entries = Object.entries(weightMap);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let roll = Math.random() * total;
  for (const [key, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

// ---------------------------------------------------------------
//  ItemGenerator
// ---------------------------------------------------------------

export class ItemGenerator {
  /**
   * @param {object} itemBasesData  – parsed itemBases.json
   * @param {object} affixesData    – parsed affixes.json
   */
  constructor(itemBasesData, affixesData) {
    this.itemBasesData = itemBasesData;
    this.affixesData   = affixesData;

    // Build flat list of equippable bases (weapons + offHands + armor)
    this.equippableBases = [];
    for (const category of ['weapons', 'offHands', 'armor']) {
      const group = itemBasesData[category] || {};
      for (const [baseTypeId, base] of Object.entries(group)) {
        this.equippableBases.push({ ...base, _baseTypeId: baseTypeId, _category: category });
      }
    }

    // Junk list
    this.junkBases = Object.values(itemBasesData.junk || {});

    // Affix pools
    this.prefixes = affixesData.prefixes || [];
    this.suffixes = affixesData.suffixes || [];
  }

  // ===========================================================
  //  Public API
  // ===========================================================

  /**
   * Generate a random item.
   *
   * @param {number} iLvl         – item level (drives stat scaling)
   * @param {string} playerClass  – e.g. 'warrior', 'mage', 'archer', 'necromancer'
   * @param {object} [options]
   * @param {string} [options.minRarity='junk']
   * @param {number} [options.rarityBonus=0]    – percentage shift toward higher tiers
   * @param {string} [options.forceSlot]
   * @param {string} [options.forceRarity]
   * @param {string} [options.forceBaseType]    – pick this exact base type id
   *                                              (e.g. 'bow', 'sword'). Bypasses
   *                                              the random pool. Used by starter
   *                                              gear so the wrong class doesn't
   *                                              get a dagger.
   * @returns {object} complete item object
   */
  generate(iLvl, playerClass, options = {}) {
    const {
      minRarity   = 'junk',
      rarityBonus = 0,
      forceSlot,
      forceRarity,
      forceBaseType,
    } = options;

    // 1. Roll rarity
    const rarity = forceRarity || this._rollRarity(minRarity, rarityBonus);

    // 2. Junk shortcut
    if (rarity === 'junk') {
      return this._generateJunk(iLvl);
    }

    // 3. Pick a base that matches playerClass (and optionally forceSlot/forceBaseType)
    const base = this._pickBase(playerClass, forceSlot, forceBaseType);
    if (!base) {
      // Fallback to junk if no valid base found
      return this._generateJunk(iLvl);
    }

    // 4. Scale base stats by iLvl
    const scaled = this._scaleBaseStats(base, iLvl);

    // 5-6. Roll affixes
    const affixes = this._rollAffixesForRarity(rarity, base.slot, iLvl);

    // 7. Unique id
    const id = _uid();

    // 8. Sell value
    const sellValue = this._computeSellValue(rarity, iLvl, affixes.length);

    // 9. Build name
    const prefixAffix = affixes.find(a => this.prefixes.some(p => p.id === a.id));
    const suffixAffix = affixes.find(a => this.suffixes.some(s => s.id === a.id));
    const prefixName  = prefixAffix ? prefixAffix.name + ' ' : '';
    const suffixName  = suffixAffix ? ' ' + suffixAffix.name : '';
    const name = `${prefixName}${base.name}${suffixName}`;

    // Legendary unique effect
    const uniqueEffect = rarity === 'legendary' ? _pick(LEGENDARY_UNIQUE_EFFECTS) : null;

    // Level requirement
    const levelReq = Math.max(1, iLvl - 2);

    // baseStat for display
    let baseStat = null;
    if (scaled.damageMin !== undefined) {
      baseStat = { type: 'damage', min: scaled.damageMin, max: scaled.damageMax };
    } else if (scaled.armor !== undefined) {
      baseStat = { type: 'armor', value: scaled.armor };
    }

    return {
      id,
      baseType:    base._baseTypeId,
      name,
      icon:        base.icon || '?',
      slot:        base.slot,
      rarity,
      rarityColor: RARITY_COLORS[rarity],
      iLvl,
      levelReq,
      classReq:    base.classReq || null,
      gridW:       base.gridW || 1,
      gridH:       base.gridH || 1,
      // Base stats
      damageMin:   scaled.damageMin ?? 0,
      damageMax:   scaled.damageMax ?? 0,
      armor:       scaled.armor ?? 0,
      baseStat,
      // Affixes
      affixes,
      sellValue,
      uniqueEffect,
      // Preserve extra base fields (speedMod, blockChance, manaBonus, etc.)
      ...(base.speedMod          !== undefined ? { speedMod: base.speedMod } : {}),
      ...(base.twoHanded         !== undefined ? { twoHanded: base.twoHanded } : {}),
      ...(base.blockChance       !== undefined ? { blockChance: base.blockChance } : {}),
      ...(base.critBonus         !== undefined ? { critBonus: base.critBonus } : {}),
      ...(base.manaBonus         !== undefined ? { manaBonus: base.manaBonus } : {}),
      ...(base.cooldownReduction !== undefined ? { cooldownReduction: base.cooldownReduction } : {}),
      ...(base.moveSpeedBonus    !== undefined ? { moveSpeedBonus: base.moveSpeedBonus } : {}),
    };
  }

  /**
   * Generate a gold drop amount.
   * @param {number} enemyLevel
   * @param {number[]} range – [min, max]
   * @returns {number}
   */
  generateGold(enemyLevel, range) {
    return Math.floor(range[0] + Math.random() * (range[1] - range[0])) * enemyLevel;
  }

  // ===========================================================
  //  Private — rarity
  // ===========================================================

  _rollRarity(minRarity, rarityBonus) {
    const minIdx = RARITY_ORDER.indexOf(minRarity);

    // Build adjusted weights
    const weights = {};
    for (const r of RARITY_ORDER) {
      if (RARITY_ORDER.indexOf(r) < minIdx) {
        weights[r] = 0;
      } else {
        weights[r] = BASE_RARITY_WEIGHTS[r];
      }
    }

    // Apply rarityBonus: shift weight from lower tiers toward higher tiers
    if (rarityBonus > 0) {
      const factor = _clamp(rarityBonus / 100, 0, 1);
      // Steal from the two lowest eligible rarities, give to the higher ones
      for (let i = 0; i < RARITY_ORDER.length; i++) {
        const r = RARITY_ORDER[i];
        if (weights[r] === 0) continue;
        // lower half loses, upper half gains
        if (i < RARITY_ORDER.length / 2) {
          const steal = weights[r] * factor;
          weights[r] -= steal;
          // Distribute stolen weight to epic + legendary
          weights.epic      = (weights.epic || 0) + steal * 0.6;
          weights.legendary = (weights.legendary || 0) + steal * 0.4;
        }
      }
    }

    return _weightedPick(weights);
  }

  // ===========================================================
  //  Private — base selection
  // ===========================================================

  _pickBase(playerClass, forceSlot, forceBaseType) {
    // Direct pick by base type id (e.g. 'bow', 'sword') — used by starter
    // gear so the random pool doesn't accidentally hand the wrong class
    // a dagger.
    if (forceBaseType) {
      const direct = this.equippableBases.find(b => b._baseTypeId === forceBaseType);
      if (direct) return direct;
      // Fall through to normal selection if the requested base doesn't exist
    }

    let pool = this.equippableBases.filter(b => {
      if (b.classReq && !b.classReq.includes(playerClass)) return false;
      if (forceSlot && b.slot !== forceSlot) return false;
      return true;
    });

    if (pool.length === 0) return null;
    return _pick(pool);
  }

  // ===========================================================
  //  Private — stat scaling
  // ===========================================================

  _scaleBaseStats(base, iLvl) {
    const result = {};

    // Weapon-style damage scaling: baseDamage * (1 + 0.04 * (iLvl - 1))
    if (base.damageMin !== undefined && base.damageMax !== undefined) {
      const dmgScale = 1 + 0.04 * (iLvl - 1);
      result.damageMin = Math.round(base.damageMin * dmgScale);
      result.damageMax = Math.round(base.damageMax * dmgScale);
    }

    // Off-hand spell damage (treated like weapon damage)
    if (base.spellDamageMin !== undefined && base.spellDamageMax !== undefined) {
      const dmgScale = 1 + 0.04 * (iLvl - 1);
      result.damageMin = Math.round(base.spellDamageMin * dmgScale);
      result.damageMax = Math.round(base.spellDamageMax * dmgScale);
    }

    // Armor scaling: baseArmor * (1 + 0.03 * (iLvl - 1))
    if (base.armorMin !== undefined && base.armorMax !== undefined) {
      const armorScale = 1 + 0.03 * (iLvl - 1);
      const rawArmor = base.armorMin + Math.random() * (base.armorMax - base.armorMin);
      result.armor = Math.round(rawArmor * armorScale);
    }

    return result;
  }

  // ===========================================================
  //  Private — affixes
  // ===========================================================

  _rollAffixesForRarity(rarity, slot, iLvl) {
    switch (rarity) {
      case 'common':
        return [];

      case 'uncommon': {
        // 1 affix: prefix OR suffix
        const usePrefix = Math.random() < 0.5;
        const pool = usePrefix
          ? this.prefixes.filter(a => a.slots.includes(slot))
          : this.suffixes.filter(a => a.slots.includes(slot));
        if (pool.length === 0) return [];
        return [this._rollOneAffix(_pick(pool), iLvl, false)];
      }

      case 'rare': {
        // 1 prefix + 1 suffix
        const pPool = this.prefixes.filter(a => a.slots.includes(slot));
        const sPool = this.suffixes.filter(a => a.slots.includes(slot));
        const result = [];
        if (pPool.length > 0) result.push(this._rollOneAffix(_pick(pPool), iLvl, false));
        if (sPool.length > 0) result.push(this._rollOneAffix(_pick(sPool), iLvl, false));
        return result;
      }

      case 'epic':
      case 'legendary': {
        // 3 total: 1-2 prefix + 1-2 suffix, rolls in top 70% of ranges
        const prefixCount = Math.random() < 0.5 ? 1 : 2;
        const suffixCount = 3 - prefixCount;
        const result = [];
        const usedIds = new Set();

        const pickUnique = (pool, count, highRoll) => {
          const available = pool.filter(a => a.slots.includes(slot));
          for (let i = 0; i < count && available.length > 0; i++) {
            let attempts = 0;
            let affix;
            do {
              affix = _pick(available);
              attempts++;
            } while (usedIds.has(affix.id) && attempts < 20);
            if (usedIds.has(affix.id)) continue;
            usedIds.add(affix.id);
            result.push(this._rollOneAffix(affix, iLvl, highRoll));
          }
        };

        pickUnique(this.prefixes, prefixCount, true);
        pickUnique(this.suffixes, suffixCount, true);
        return result;
      }

      default:
        return [];
    }
  }

  /**
   * Roll a single affix value.
   *
   * Formula: value = min + (max - min) * (iLvl / 50) with +/-15% variance.
   * If highRoll is true (epic/legendary), the roll is in the top 70% of the range.
   *
   * @param {object} affix
   * @param {number} iLvl
   * @param {boolean} highRoll
   * @returns {object}
   */
  _rollOneAffix(affix, iLvl, highRoll) {
    if (affix.min === undefined || affix.max === undefined) {
      return { id: affix.id, name: affix.name, statKey: affix.statKey, value: 0 };
    }
    const range = affix.max - affix.min;
    const iLvlFactor = _clamp(iLvl / 50, 0, 1);
    let baseValue = affix.min + range * iLvlFactor;

    // ±15% variance
    const variance = 0.85 + Math.random() * 0.30; // 0.85 .. 1.15
    baseValue *= variance;

    // Epic / legendary: clamp to top 70% of possible range
    if (highRoll) {
      const floor = affix.min + range * 0.3;
      baseValue = Math.max(baseValue, floor);
    }

    // Clamp within affix boundaries
    baseValue = _clamp(baseValue, affix.min, affix.max);

    // Round: integers for values >= 1, otherwise keep 2-3 decimals for percentages
    let value;
    if (affix.max >= 1 && Number.isInteger(affix.min) && Number.isInteger(affix.max)) {
      value = Math.round(baseValue);
    } else {
      value = Math.round(baseValue * 1000) / 1000;
    }

    return {
      id:      affix.id,
      name:    affix.name,
      statKey: affix.statKey,
      value,
    };
  }

  // ===========================================================
  //  Private — sell value
  // ===========================================================

  _computeSellValue(rarity, iLvl, affixCount) {
    const mult = SELL_VALUE_MULT[rarity] || 1;
    return Math.round((iLvl * 2 + affixCount * 5) * mult);
  }

  // ===========================================================
  //  Private — junk
  // ===========================================================

  _generateJunk(iLvl) {
    if (this.junkBases.length === 0) return null;

    const junk = _pick(this.junkBases);
    const sellRange = (junk.sellMax || 1) - (junk.sellMin || 0);
    const sellValue = (junk.sellMin || 0)
      + Math.floor(Math.random() * (sellRange + 1))
      + Math.floor(iLvl / 10);

    return {
      id:          _uid(),
      baseType:    'junk',
      name:        junk.name,
      icon:        junk.icon || '?',
      slot:        'junk',
      rarity:      'junk',
      rarityColor: RARITY_COLORS.junk,
      iLvl,
      levelReq:    0,
      classReq:    null,
      gridW:       junk.gridW || 1,
      gridH:       junk.gridH || 1,
      damageMin:   0,
      damageMax:   0,
      armor:       0,
      baseStat:    null,
      affixes:     [],
      sellValue,
      uniqueEffect: null,
    };
  }
}
