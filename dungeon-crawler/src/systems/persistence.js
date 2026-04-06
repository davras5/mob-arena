const SAVE_KEY = 'dungeon_crawler_save';
const SAVE_VERSION = 2;

export class Persistence {
  constructor() {
    this.data = this._load();
  }

  _defaultData() {
    return {
      version: SAVE_VERSION,
      character: {
        class: 'warrior',
        level: 1,
        xp: 0,
        xpToNext: 100,
        attributes: { str: 3, int: 1, agi: 1, sta: 3 },
        attributePointsAvailable: 0,
        gold: 0,
        activeSkills: { leftClick: 'slash', rightClick: 'slash' },
        learnedSkills: {},
        passiveSkills: {},
        passivePointsAvailable: 0,
        summonToggles: {},
      },
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
    };
  }

  _load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.version !== SAVE_VERSION) {
          console.warn('Save data version mismatch — resetting to defaults.');
          return this._defaultData();
        }
        return parsed;
      }
    } catch (e) {
      console.warn('Failed to load save data:', e);
    }
    return this._defaultData();
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

  // --- Reset ---

  resetAll() {
    this.data = this._defaultData();
    this.save();
  }
}
