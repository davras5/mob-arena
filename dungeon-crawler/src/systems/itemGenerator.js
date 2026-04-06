let _uid = 0;
function uid() { return 'item_' + (++_uid) + '_' + Math.random().toString(36).slice(2, 6); }

const RARITY_WEIGHTS = { common: 55, magic: 30, rare: 12, legendary: 3 };
const RARITY_AFFIXES = { common: 0, magic: [1, 2], rare: [3, 4], legendary: [4, 5] };
const RARITY_COLORS = { common: '#ffffff', magic: '#3498db', rare: '#f1c40f', legendary: '#e67e22' };
const SLOT_WEIGHTS = { weapon: 20, helmet: 12, chest: 12, gloves: 12, boots: 12, amulet: 10, ring: 12, junk: 10 };

const NAME_PREFIXES = {
  common: ['Worn', 'Simple', 'Old', 'Plain'],
  magic: ['Fine', 'Sharp', 'Sturdy', 'Swift'],
  rare: ['Vicious', 'Fierce', 'Mighty', 'Ancient'],
  legendary: ['Legendary', 'Mythic', 'Divine', 'Eternal'],
};

export class ItemGenerator {
  constructor(itemBasesData, affixesData) {
    this.bases = itemBasesData;
    this.affixes = affixesData;
  }

  generate(itemLevel, forcedRarity, forcedSlot, classReq) {
    // Roll rarity
    const rarity = forcedRarity || this._rollRarity();

    // Roll slot
    let slot = forcedSlot || this._weightedPick(SLOT_WEIGHTS);

    // Junk items
    if (slot === 'junk') return this._generateJunk(itemLevel);

    // Ring maps to ring slot
    if (slot === 'ring1' || slot === 'ring2') slot = 'ring';

    // Pick base type
    const base = this._pickBase(slot, classReq);
    if (!base) return this._generateJunk(itemLevel);

    // Scale base stats by item level
    const scaleFactor = 1 + (itemLevel - 1) * 0.12;

    const baseStats = {};
    if (base.damageMin !== undefined) {
      baseStats.damageMin = Math.round(base.damageMin * scaleFactor);
      baseStats.damageMax = Math.round(base.damageMax * scaleFactor);
    }
    if (base.armorMin !== undefined) {
      baseStats.armor = Math.round((base.armorMin + Math.random() * (base.armorMax - base.armorMin)) * scaleFactor);
    }

    // Roll affixes
    const affixCount = this._getAffixCount(rarity);
    const affixes = this._rollAffixes(affixCount, slot, itemLevel);

    // Generate name
    const prefix = NAME_PREFIXES[rarity][Math.floor(Math.random() * NAME_PREFIXES[rarity].length)];
    const name = `${prefix} ${base.name}`;

    // Sell price
    const rarityMult = { common: 1, magic: 2.5, rare: 5, legendary: 10 };
    const sellPrice = Math.round((itemLevel * 2 + affixCount * 5) * (rarityMult[rarity] || 1));

    // Level requirement
    const levelReq = Math.max(1, itemLevel - 2);

    return {
      id: uid(),
      baseTypeId: Object.entries(this._getBaseCategory(slot)).find(([, v]) => v === base)?.[0] || 'unknown',
      name,
      slot: base.slot || slot,
      rarity,
      rarityColor: RARITY_COLORS[rarity],
      itemLevel,
      classReq: base.classReq || null,
      levelReq,
      baseStats,
      affixes,
      uniqueEffect: null,
      sellPrice,
      icon: base.icon || '?',
      speedMod: base.speedMod || 1,
    };
  }

  _generateJunk(itemLevel) {
    const junkTypes = Object.values(this.bases.junk || {});
    if (junkTypes.length === 0) return null;
    const junk = junkTypes[Math.floor(Math.random() * junkTypes.length)];
    const sellPrice = junk.sellMin + Math.floor(Math.random() * (junk.sellMax - junk.sellMin + 1)) + Math.floor(itemLevel * 0.5);

    return {
      id: uid(),
      name: junk.name,
      slot: 'junk',
      rarity: 'common',
      rarityColor: '#888888',
      itemLevel,
      classReq: null,
      levelReq: 0,
      baseStats: {},
      affixes: [],
      uniqueEffect: null,
      sellPrice,
      icon: junk.icon || '?',
    };
  }

  _rollRarity(minRarity) {
    const weights = { ...RARITY_WEIGHTS };
    if (minRarity === 'magic') { weights.common = 0; }
    else if (minRarity === 'rare') { weights.common = 0; weights.magic = 0; }
    else if (minRarity === 'legendary') { return 'legendary'; }
    return this._weightedPick(weights);
  }

  _pickBase(slot, classReq) {
    const category = this._getBaseCategory(slot);
    const options = Object.values(category).filter(b => {
      if (b.slot && b.slot !== slot) return false;
      if (classReq && b.classReq && b.classReq !== classReq) return false;
      return true;
    });
    if (options.length === 0) return Object.values(category)[0] || null;
    return options[Math.floor(Math.random() * options.length)];
  }

  _getBaseCategory(slot) {
    if (slot === 'weapon') return this.bases.weapons || {};
    if (['helmet', 'chest', 'gloves', 'boots'].includes(slot)) return this.bases.armor || {};
    if (['amulet', 'ring'].includes(slot)) return this.bases.jewelry || {};
    return {};
  }

  _getAffixCount(rarity) {
    const range = RARITY_AFFIXES[rarity];
    if (typeof range === 'number') return range;
    return range[0] + Math.floor(Math.random() * (range[1] - range[0] + 1));
  }

  _rollAffixes(count, slot, itemLevel) {
    const applicable = this.affixes.filter(a => a.slots.includes(slot));
    if (applicable.length === 0) return [];

    const result = [];
    const used = new Set();

    for (let i = 0; i < count && applicable.length > used.size; i++) {
      let affix;
      let attempts = 0;
      do {
        affix = applicable[Math.floor(Math.random() * applicable.length)];
        attempts++;
      } while (used.has(affix.id) && attempts < 20);

      if (used.has(affix.id)) continue;
      used.add(affix.id);

      // Scale value by item level
      const scale = itemLevel / 25;
      const range = affix.max - affix.min;
      const value = affix.min + range * scale * (0.8 + Math.random() * 0.4);
      const roundedValue = affix.percent ? Math.round(value * 10) / 10 : Math.round(value);

      result.push({
        id: affix.id,
        name: affix.name,
        statKey: affix.statKey,
        value: roundedValue,
        percent: affix.percent || false,
      });
    }

    return result;
  }

  _weightedPick(weights) {
    const entries = Object.entries(weights);
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let roll = Math.random() * total;
    for (const [key, weight] of entries) {
      roll -= weight;
      if (roll <= 0) return key;
    }
    return entries[entries.length - 1][0];
  }
}
