const EQUIPMENT_SLOTS = ['weapon', 'helmet', 'chest', 'gloves', 'boots', 'amulet', 'ring1', 'ring2'];
const BAG_SIZE = 48;

export class Inventory {
  constructor() {
    this.equipment = {
      weapon: null,
      helmet: null,
      chest: null,
      gloves: null,
      boots: null,
      amulet: null,
      ring1: null,
      ring2: null,
    };
    this.bag = new Array(BAG_SIZE).fill(null);
  }

  // Add item to first free bag slot. Returns slot index or -1 if full.
  addToBag(item) {
    for (let i = 0; i < this.bag.length; i++) {
      if (this.bag[i] === null) {
        this.bag[i] = item;
        return i;
      }
    }
    return -1; // Bag full
  }

  // Remove item from bag slot
  removeFromBag(slotIndex) {
    const item = this.bag[slotIndex];
    this.bag[slotIndex] = null;
    return item;
  }

  // Equip item from bag to equipment slot. Returns previously equipped item (or null).
  equip(bagSlotIndex) {
    const item = this.bag[bagSlotIndex];
    if (!item) return null;

    let targetSlot = item.slot;
    // Ring can go in ring1 or ring2
    if (targetSlot === 'ring') {
      targetSlot = this.equipment.ring1 === null ? 'ring1' : 'ring2';
    }

    if (!EQUIPMENT_SLOTS.includes(targetSlot)) return null;

    const prev = this.equipment[targetSlot];
    this.equipment[targetSlot] = item;
    this.bag[bagSlotIndex] = prev; // Swap: old equipped goes to bag slot

    return prev;
  }

  // Unequip item to bag. Returns true if successful.
  unequip(equipSlot) {
    const item = this.equipment[equipSlot];
    if (!item) return false;

    const bagSlot = this.addToBag(item);
    if (bagSlot === -1) return false; // Bag full

    this.equipment[equipSlot] = null;
    return true;
  }

  // Get total stats from all equipped items
  getEquipmentStats() {
    const stats = {
      weaponDamageMin: 0,
      weaponDamageMax: 0,
      totalArmor: 0,
      damageBonus: 0,
      maxHPBonus: 0,
      maxResourceBonus: 0,
      armorBonus: 0,
      critChanceBonus: 0,
      attackSpeedBonus: 0,
      moveSpeedBonus: 0,
      lifestealBonus: 0,
      goldFindBonus: 0,
      xpBonusPercent: 0,
      hpRegenBonus: 0,
      resourceRegenBonus: 0,
      speedMod: 1,
    };

    for (const slot of EQUIPMENT_SLOTS) {
      const item = this.equipment[slot];
      if (!item) continue;

      // Base stats
      if (item.baseStats) {
        if (item.baseStats.damageMin) stats.weaponDamageMin = item.baseStats.damageMin;
        if (item.baseStats.damageMax) stats.weaponDamageMax = item.baseStats.damageMax;
        if (item.baseStats.armor) stats.totalArmor += item.baseStats.armor;
      }

      if (item.speedMod) stats.speedMod *= item.speedMod;

      // Affixes
      for (const affix of (item.affixes || [])) {
        if (stats[affix.statKey] !== undefined) {
          stats[affix.statKey] += affix.value;
        }
      }
    }

    // Armor bonus from affixes adds to total
    stats.totalArmor += stats.armorBonus;

    return stats;
  }

  // Is bag full?
  isFull() {
    return this.bag.every(slot => slot !== null);
  }

  // Count items in bag
  bagCount() {
    return this.bag.filter(s => s !== null).length;
  }

  // Serialization
  toSaveData() {
    return {
      equipment: { ...this.equipment },
      bag: [...this.bag],
    };
  }

  loadFromSave(data) {
    if (!data) return;
    if (data.equipment) {
      for (const slot of EQUIPMENT_SLOTS) {
        this.equipment[slot] = data.equipment[slot] || null;
      }
    }
    if (data.bag) {
      for (let i = 0; i < BAG_SIZE; i++) {
        this.bag[i] = data.bag[i] || null;
      }
    }
  }
}
