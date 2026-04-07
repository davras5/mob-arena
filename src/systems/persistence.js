const SAVE_KEY = 'dungeon_crawler_save';
const SAVE_VERSION = 3;

// Default hotbar bindings per class. Per DESIGN_BRIEF §5.2 the action bar has
// 7 freely-bindable slots (LMB, RMB, slot1..slot5). Each slot can hold an
// attack OR a consumable. New characters get LMB = Spec1 primary, RMB = Spec2
// primary, slots 1–5 empty (the player binds them as they collect items).
//
// Slot value shape: null (empty) OR { type: 'attack' | 'consumable', id: string }.
// For consumables `id` is the baseType (e.g. 'hp_potion'), so the slot stays
// bound across stack-refill (auto-refill behavior).
//
// Used by:
//   - new character creation
//   - v2 → v3 migration (when old learnedSkills/activeSkills are wiped)
//   - resetCharacterRetainingDungeon (class change)
// Mirrors classes.json defaultEquippedAttacks but defined here so persistence
// has no runtime dependency on classes.json being loaded.
const DEFAULT_HOTBAR_BY_CLASS = {
  warrior: {
    leftClick:  { type: 'attack', id: 'warrior_guardian_bash' },
    rightClick: { type: 'attack', id: 'warrior_berserker_whirlwind' },
    slot1: null, slot2: null, slot3: null, slot4: null, slot5: null,
  },
  mage: {
    leftClick:  { type: 'attack', id: 'mage_pyromancer_flame_bolt' },
    rightClick: { type: 'attack', id: 'mage_cryomancer_frost_nova' },
    slot1: null, slot2: null, slot3: null, slot4: null, slot5: null,
  },
  archer: {
    leftClick:  { type: 'attack', id: 'archer_marksman_aimed_shot' },
    rightClick: { type: 'attack', id: 'archer_beastmaster_call_beast' },
    slot1: null, slot2: null, slot3: null, slot4: null, slot5: null,
  },
  necromancer: {
    leftClick:  { type: 'attack', id: 'necromancer_plaguebringer_plague_bolt' },
    rightClick: { type: 'attack', id: 'necromancer_bone_lord_raise_dead' },
    slot1: null, slot2: null, slot3: null, slot4: null, slot5: null,
  },
};

// Deep-clone a default hotbar so callers can mutate safely.
function _cloneDefaultHotbar(classId) {
  const src = DEFAULT_HOTBAR_BY_CLASS[classId] || DEFAULT_HOTBAR_BY_CLASS.warrior;
  const out = {};
  for (const k of Object.keys(src)) {
    out[k] = src[k] ? { ...src[k] } : null;
  }
  return out;
}

const DEFAULT_BASE_ATTRIBUTES_BY_CLASS = {
  warrior:     { str: 3, int: 1, agi: 1, sta: 3 },
  mage:        { str: 1, int: 3, agi: 2, sta: 1 },
  archer:      { str: 1, int: 1, agi: 3, sta: 2 },
  necromancer: { str: 1, int: 3, agi: 1, sta: 2 },
};

export class Persistence {
  constructor() {
    this.data = this._load();
  }

  _defaultCharacter(classId = 'warrior') {
    return {
      class: classId,
      level: 1,
      xp: 0,
      xpToNext: 100,
      attributes: { ...(DEFAULT_BASE_ATTRIBUTES_BY_CLASS[classId] || DEFAULT_BASE_ATTRIBUTES_BY_CLASS.warrior) },
      attributePointsAvailable: 0,
      gold: 0,
      // NEW v3 spec-tree skill state
      hotbar: _cloneDefaultHotbar(classId),  // { leftClick, rightClick, slot1..slot5 }
      skillTree: {},                          // { "warrior_guardian": { "iron_hide": 3, ... }, ... }
      skillPointsAvailable: 0,
      freeRespecUsed: false,
    };
  }

  _defaultData() {
    return {
      version: SAVE_VERSION,
      character: this._defaultCharacter('warrior'),
      equipment: {
        mainHand: null,
        offHand: null,
        chest: null,
        legs: null,
        belt: null,
        boots: null,
      },
      inventory: {
        grid: [],
        items: {},
        hotbar: [null, null, null, null],
      },
      dungeon: {
        discoveredFloors: [1],
        currentFloor: null,
        floorStates: {},
      },
      settings: { volume: 0.5 },
      // Tutorial / onboarding flags
      introComplete: false,
      tutorialComplete: false,
      combatTutorialComplete: false,
    };
  }

  _load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.version === SAVE_VERSION) {
          return parsed;
        }
        // Migrate older saves where possible.
        if (parsed.version === 2) {
          return this._migrateV2toV3(parsed);
        }
        console.warn(`Save data version ${parsed.version} is not supported — resetting to defaults.`);
        return this._defaultData();
      }
    } catch (e) {
      console.warn('Failed to load save data:', e);
    }
    return this._defaultData();
  }

  /**
   * Migrate v2 (old per-skill leveling system) → v3 (spec-tree system + 7-slot hotbar).
   *
   * Strategy:
   *   - Keep equipment, inventory, dungeon state, settings, intro flags.
   *   - Wipe character.learnedSkills / passiveSkills / activeSkills / summonToggles.
   *   - Seed hotbar from class defaults (LMB/RMB filled, slots 1–5 empty).
   *   - Note: the old inventory.hotbar[] potion array is preserved by the inventory
   *     pass-through but is no longer read by the hotbar system. Players must re-bind
   *     consumables to slots 1–5 after migration.
   *   - Refund (level - 1) skill points so the player can re-spend.
   *   - Mark freeRespecUsed = false so migrated players still get the free respec.
   */
  _migrateV2toV3(oldData) {
    const classId = (oldData.character && oldData.character.class) || 'warrior';
    const defaults = this._defaultCharacter(classId);

    const migratedCharacter = {
      ...defaults,
      // Preserve progression
      class: classId,
      level: oldData.character?.level ?? 1,
      xp: oldData.character?.xp ?? 0,
      xpToNext: oldData.character?.xpToNext ?? Math.floor(100 * Math.pow(oldData.character?.level ?? 1, 1.5)),
      attributes: { ...defaults.attributes, ...(oldData.character?.attributes || {}) },
      attributePointsAvailable: oldData.character?.attributePointsAvailable ?? 0,
      gold: oldData.character?.gold ?? 0,
      // Refund: 1 skill point per level (level 1 = 0, level N = N-1)
      skillPointsAvailable: Math.max(0, (oldData.character?.level ?? 1) - 1),
      // Migrated users have never used a free respec — give them one
      freeRespecUsed: false,
    };

    const migrated = {
      version: SAVE_VERSION,
      character: migratedCharacter,
      equipment: oldData.equipment || this._defaultData().equipment,
      inventory: oldData.inventory || this._defaultData().inventory,
      dungeon: oldData.dungeon || this._defaultData().dungeon,
      settings: oldData.settings || { volume: 0.5 },
      introComplete: oldData.introComplete ?? false,
      tutorialComplete: oldData.tutorialComplete ?? false,
      combatTutorialComplete: oldData.combatTutorialComplete ?? false,
    };

    // Defensive: if the old save was mid-dungeon, kick back to camp.
    if (migrated.dungeon.currentFloor != null) {
      migrated.dungeon.currentFloor = null;
    }

    console.info('[persistence] Migrated v2 → v3 save. Skill state wiped, ' +
                 migratedCharacter.skillPointsAvailable + ' skill points refunded, free respec available.');

    return migrated;
  }

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.warn('Failed to save data:', e);
    }
  }

  // --- Character ---

  getCharacter() {
    return this.data.character;
  }

  saveCharacter(charData) {
    this.data.character = { ...this.data.character, ...charData };
    this.save();
  }

  // --- Gold (convenience, stored inside character) ---

  getGold() {
    return this.data.character.gold || 0;
  }

  addGold(amount) {
    this.data.character.gold = (this.data.character.gold || 0) + amount;
    this.save();
  }

  spendGold(amount) {
    if (this.data.character.gold >= amount) {
      this.data.character.gold -= amount;
      this.save();
      return true;
    }
    return false;
  }

  // --- Equipment ---

  getEquipment() {
    return this.data.equipment;
  }

  saveEquipment(equipData) {
    this.data.equipment = { ...this.data.equipment, ...equipData };
    this.save();
  }

  // --- Inventory ---

  getInventory() {
    return this.data.inventory;
  }

  saveInventory(invData) {
    this.data.inventory = { ...this.data.inventory, ...invData };
    this.save();
  }

  // --- Dungeon ---

  getDungeon() {
    return this.data.dungeon;
  }

  saveDungeon(dungeonData) {
    this.data.dungeon = { ...this.data.dungeon, ...dungeonData };
    this.save();
  }

  discoverFloor(floorId) {
    if (!this.data.dungeon.discoveredFloors.includes(floorId)) {
      this.data.dungeon.discoveredFloors.push(floorId);
      this.save();
    }
  }

  saveFloorState(floorId, state) {
    this.data.dungeon.floorStates[floorId] = { ...state };
    this.save();
  }

  getFloorState(floorId) {
    return this.data.dungeon.floorStates[floorId] || null;
  }

  isFloorCleared(floorId) {
    const state = this.data.dungeon.floorStates[floorId];
    return state ? state.cleared === true : false;
  }

  // --- Skill tree (v3) ---

  getSkillTree() {
    return this.data.character.skillTree || {};
  }

  saveSkillTree(tree) {
    this.data.character.skillTree = tree || {};
    this.save();
  }

  // --- Hotbar (v3) ---
  // Hotbar is a 7-slot map: { leftClick, rightClick, slot1..slot5 }
  // Each slot is null OR { type: 'attack' | 'consumable', id: string }.

  getHotbar() {
    if (!this.data.character.hotbar) {
      this.data.character.hotbar = _cloneDefaultHotbar(this.data.character.class || 'warrior');
    }
    return this.data.character.hotbar;
  }

  saveHotbar(hotbar) {
    this.data.character.hotbar = { ...hotbar };
    this.save();
  }

  /**
   * Bind one slot. slotId is one of 'leftClick', 'rightClick', 'slot1'..'slot5'.
   * binding is null (clear) OR { type, id }.
   */
  setHotbarSlot(slotId, binding) {
    const hotbar = this.getHotbar();
    hotbar[slotId] = binding ? { ...binding } : null;
    this.save();
  }

  getSkillPointsAvailable() {
    return this.data.character.skillPointsAvailable || 0;
  }

  saveSkillPointsAvailable(n) {
    this.data.character.skillPointsAvailable = Math.max(0, n | 0);
    this.save();
  }

  getFreeRespecUsed() {
    return !!this.data.character.freeRespecUsed;
  }

  markFreeRespecUsed() {
    this.data.character.freeRespecUsed = true;
    this.save();
  }

  // --- Reset ---

  resetAll() {
    this.data = this._defaultData();
    this.save();
  }

  /**
   * Reset character + equipment + inventory + per-character flags but PRESERVE
   * dungeon discovery and player settings. Used when the player picks a different
   * class from the class picker (treated as "new character" but preserves world
   * exploration progress).
   */
  resetCharacterRetainingDungeon(newClassId) {
    const preservedDungeon = this.data.dungeon;
    const preservedSettings = this.data.settings;
    const preservedIntro = this.data.introComplete;
    const fresh = this._defaultData();
    fresh.character = this._defaultCharacter(newClassId || 'warrior');
    fresh.dungeon = preservedDungeon;
    fresh.settings = preservedSettings;
    fresh.introComplete = preservedIntro;
    // Tutorial/combat tutorial flags also reset since the new class gets a
    // fresh introduction to its kit.
    fresh.tutorialComplete = false;
    fresh.combatTutorialComplete = false;
    this.data = fresh;
    this.save();
  }
}
