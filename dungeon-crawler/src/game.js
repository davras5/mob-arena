import { Player } from './entities/player.js';
import { Projectile } from './entities/projectile.js';
import { Enemy } from './entities/enemy.js';
import { Minion } from './entities/minion.js';
import { Input } from './input.js';
import { Renderer } from './renderer.js';

import { CollisionSystem } from './systems/collision.js';
import { ParticleSystem } from './systems/particles.js';
import { HUD } from './ui/hud.js';

import { GameOverUI } from './ui/gameOver.js';
import { AudioSystem } from './systems/audio.js';
import { DamageNumbers } from './systems/damageNumbers.js';
import { LevelClearUI } from './ui/levelClear.js';
import { ClassPicker } from './ui/classPicker.js';
import { LayoutManager } from './systems/layout.js';
import { DungeonGenerator } from './systems/dungeonGenerator.js';
import { DungeonRoomManager } from './systems/dungeonRoom.js';
import { Persistence } from './systems/persistence.js';
import { CampManager } from './systems/camp.js';
import { WaystoneUI } from './ui/waystoneUI.js';
import { SkillManager } from './systems/skillManager.js';
import { SkillBookUI } from './ui/skillBookUI.js';
import { SkillVendorUI } from './ui/skillVendorUI.js';
import { FloorConfig } from './systems/floorConfig.js';
import { ItemGenerator } from './systems/itemGenerator.js';
import { Inventory } from './systems/inventory.js';
import { LootDrop } from './systems/lootDrop.js';
import { InventoryUI } from './ui/inventoryUI.js';
import { ItemVendorUI } from './ui/itemVendorUI.js';
import { StatusEffectManager } from './systems/statusEffects.js';
import { CharacterUI } from './ui/characterUI.js';
import { TrapManager } from './systems/traps.js';
import { DeathScreen } from './ui/deathScreen.js';
import { GameWindow } from './ui/gameWindow.js';

const MAP_WIDTH = 1600;
const MAP_HEIGHT = 1600;

export class Game {
  constructor(canvas, floorsData, classesData, campData, resourcesData, skillsData, itemBasesData, affixesData, trapsData, potionsData, lootTablesData) {
    this.canvas = canvas;
    this.floorsData = floorsData || [];
    this.classesData = classesData || {};
    this.campData = campData || null;
    this.resourcesData = resourcesData || {};
    this.skillsData = skillsData || {};
    this.floorConfig = new FloorConfig(floorsData || []);
    this.itemBasesData = itemBasesData || {};
    this.affixesData = affixesData || [];
    this.trapsData = trapsData || {};
    this.potionsData = potionsData || {};
    this.lootTablesData = lootTablesData || {};

    this.input = new Input(canvas);
    this.renderer = new Renderer(canvas);
    this.collision = new CollisionSystem(64);
    this.particles = new ParticleSystem();
    this.statusEffects = new StatusEffectManager();
    this.hud = new HUD(canvas);
    this.hud.onPanelClick = (panel) => {
      if (this.state !== 'PLAYING' && this.state !== 'BASE_CAMP') return;
      if (panel === 'character') this._openCharacterPanel();
      else if (panel === 'skillBook') this._openSkillBook();
      else if (panel === 'inventory') this._openInventory();
    };
    // Drag-and-drop: skill → HUD action bar
    this.hud.onSkillDrop = (skillId, slot) => {
      if (!this.skillManager) return;
      if (slot === 'left') this.skillManager.equipToLeft(skillId);
      else if (slot === 'right') this.skillManager.equipToRight(skillId);
      this.player.activeSkills = { leftClick: this.skillManager.leftSlot, rightClick: this.skillManager.rightSlot };
      this._saveProgress();
    };
    // Drag-and-drop: potion → HUD hotbar
    this.hud.onHotbarDrop = (itemId, slot) => {
      if (!this.inventory) return;
      this.inventory.assignToHotbar(itemId, slot);
      this._saveProgress();
    };
    this.gameOverUI = new GameOverUI();
    this.audio = new AudioSystem();
    this.damageNumbers = new DamageNumbers();
    // WorldMap removed (replaced by waystone travel)
    this.levelClearUI = new LevelClearUI();
    this.classPicker = new ClassPicker();
    // SkillTreeUI removed (replaced by skillBookUI + skillVendorUI)
    this.persistence = new Persistence();
    this.waystoneUI = new WaystoneUI();
    // ShopUI removed (replaced by itemVendorUI)
    this.skillBookUI = new SkillBookUI();
    this.skillVendorUI = new SkillVendorUI();
    this.campManager = null;
    this.skillManager = null;
    this.itemGenerator = null;
    this.inventory = new Inventory();
    this.inventoryUI = new InventoryUI();
    this.itemVendorUI = new ItemVendorUI();
    this.characterUI = new CharacterUI();
    // Window instances for non-modal panels
    this._characterWindow = null;
    this._skillBookWindow = null;
    this._inventoryWindow = null;
    this.lootSystem = null;
    this.trapManager = null; // Created per floor
    this.deathScreen = new DeathScreen();

    this.state = 'MENU';
    this.currentLevel = null;
    this.selectedClass = null;
    this.layoutManager = null;

    // Dungeon mode
    this.dungeonMode = false;
    this.dungeonGenerator = new DungeonGenerator();
    this.dungeon = null;
    this.dungeonManager = null;
    this.currentFloor = 1;
    this.gold = 0;
    this.clearedLevels = [];
    this.paused = false;
    this.player = null;
    this.projectiles = [];
    this.minions = [];
    this.corpses = []; // { x, y, timer } for necromancer corpse walk
    this.waveSystem = null;
    this.time = 0;
    this.fireTrails = [];
    this.chainLightnings = [];
    this.screenShake = 0;

    // Player trail effect
    this.playerTrail = [];

    // Wave announcement banner
    this.waveAnnouncement = { wave: 0, timer: 0 };

    // Combo/score system removed for ARPG redesign

    // Kill tracking
    this.kills = { grunt: 0, rusher: 0, brute: 0, ranged: 0, splitter: 0, necromancer_enemy: 0, burrower: 0, shielder: 0, bomber: 0, boss: 0 };

    // Melee sweep visual
    this.meleeSweep = null; // { x, y, angle, arc, range, timer }

    // Meteor warning visual
    this.meteorWarning = null; // { x, y, radius, timer }

    // Rain of arrows visual
    this.rainArrows = []; // { x, y, timer }

    // Spell echo pending
    this.echoTarget = null;

    // Graviton orbs
    this.gravitonOrbs = []; // { x, y, timer, pullRadius, pullForce }

    // Spectral blades hit cooldowns
    this.bladeHitTimers = new Map();

    this.potionCooldowns = { shared: 0, stamina_tonic: 0, rage_tonic: 0 };
  }

  togglePause() {
    if (this.state === 'MENU' || this.state === 'GAME_OVER') return;
    this.paused = !this.paused;
    const overlay = document.getElementById('pause-overlay');
    if (overlay) {
      overlay.classList.toggle('hidden', !this.paused);
    }
  }

  async start() {
    document.getElementById('menu-screen').classList.add('hidden');

    // Show class picker
    this.selectedClass = await this.classPicker.show(this.classesData);

    // Create player with chosen class
    this.player = new Player(MAP_WIDTH / 2, MAP_HEIGHT / 2, this.selectedClass);

    // Load persisted progress
    const progress = this.persistence.getCharacter();
    this.player.loadFromSave(progress);
    this.gold = this.persistence.getGold();

    // Initialize resource system
    const resConfig = this.resourcesData[this.selectedClass.id];
    if (resConfig) {
      this.player.initResource(resConfig);
      this.hud.setResourceColor(resConfig.colors?.bar || [resConfig.color || '#3498db', resConfig.color || '#3498db']);
    }

    // Initialize item generator and loot system
    this.itemGenerator = new ItemGenerator(this.itemBasesData, this.affixesData);
    this.lootSystem = new LootDrop(this.itemGenerator, this.lootTablesData);

    // Load inventory
    const savedInv = this.persistence.getInventory();
    if (this.inventory && savedInv && Object.keys(savedInv.items || {}).length > 0) {
      this.inventory.loadFromSave(savedInv);
    }

    // Initialize skill manager
    if (this.skillsData) {
      this.skillManager = new SkillManager(this.skillsData, this.selectedClass.id);
      // Load persisted skill data (full skill manager state)
      const skillSave = this.persistence.data.skillManagerData;
      if (skillSave) this.skillManager.loadFromSave(skillSave);

      // Sync skill state to player
      this.player.learnedSkills = { ...this.skillManager.learnedSkills };
      this.player.activeSkills = { leftClick: this.skillManager.leftSlot, rightClick: this.skillManager.rightSlot };
      this.player.passiveSkills = { ...this.skillManager.passiveRanks };

      // Apply passive effects to stats
      this._applyPassives();
    }

    // _applySkillTree() removed — stats now handled by recalcAllStats() in player.js

    this.hud.updateHP(this.player.hp, this.player.maxHP);
    this.hud.updateXP(this.player.xp, this.player.xpToNext, this.player.level);
    this.hud.hideBossHP();

    // Check if intro is needed
    if (!this.persistence.data.introComplete) {
      await this._showIntro();
      this.persistence.data.introComplete = true;
      this.persistence.save();
    }

    // Go to base camp
    this._enterBaseCamp();
  }

  async _showIntro() {
    const introEl = document.getElementById('intro-screen');
    introEl.classList.remove('hidden');

    const panels = [
      'The storm came without warning...',
      'The ship broke apart on the rocks...',
      'You awake on a strange shore...',
      'A signal fire burns on the distant peak.\nYou must find the base camp.',
    ];

    for (const text of panels) {
      introEl.innerHTML = `<div class="intro-text">${text.replace('\n', '<br>')}</div><div class="intro-hint">Click to continue</div>`;
      this.renderer.flash('#fff', 0.3);
      await new Promise(resolve => {
        const handler = () => { introEl.removeEventListener('click', handler); resolve(); };
        introEl.addEventListener('click', handler);
      });
    }

    introEl.classList.add('hidden');
  }

  _enterBaseCamp() {
    this.state = 'BASE_CAMP';
    this.hud.setVisible(true);
    this.dungeonMode = false;
    this.waveSystem = null;
    this._waveShim = null;
    this.dungeonManager = null;
    this.dungeon = null;

    // Reset transient state
    this.projectiles = [];
    this.minions = [];
    this.corpses = [];
    this.fireTrails = [];
    this.chainLightnings = [];
    this.particles.particles = [];
    this.playerTrail = [];
    this.meleeSweep = null;
    this.meteorWarning = null;
    this.rainArrows = [];
    this.gravitonOrbs = [];
    this.bladeHitTimers = new Map();
    if (this.lootSystem) this.lootSystem.clear();
    if (this.trapManager) this.trapManager.clear();

    // Setup camp
    this.campManager = new CampManager(this.campData);
    this.layoutManager = this.campManager.layoutManager;
    this.renderer.setTheme({ ...this.campData, ...this.campData.theme });
    this.renderer.setLayout(this.layoutManager);
    this.renderer.mapWidth = this.campData.mapWidth;
    this.renderer.mapHeight = this.campData.mapHeight;

    // Place player
    const spawn = this.campManager.getPlayerSpawn();
    this.player.x = spawn.x;
    this.player.y = spawn.y;
    this.player.hp = this.player.maxHP; // Full heal at camp

    // Save progress
    this._saveProgress();

    this.hud.updateHP(this.player.hp, this.player.maxHP);
    this.hud.updateLevelName('Base Camp');
    this.hud.hideBossHP();
    this.waveAnnouncement = { wave: 0, timer: 2.0, text: 'Base Camp' };
  }

  _saveProgress() {
    this.persistence.saveCharacter({
      class: this.selectedClass?.id,
      level: this.player.level,
      xp: this.player.xp,
      xpToNext: this.player.xpToNext,
      attributes: { ...this.player.attributes },
      attributePointsAvailable: this.player.attributePointsAvailable,
      gold: this.persistence.getGold(),
      activeSkills: { leftClick: this.skillManager?.leftSlot, rightClick: this.skillManager?.rightSlot },
      learnedSkills: this.skillManager ? { ...this.skillManager.learnedSkills } : {},
      passiveSkills: { ...this.player.passiveSkills },
      passivePointsAvailable: this.player.passivePointsAvailable,
      summonToggles: this.skillManager ? { ...this.skillManager.summonStates } : {},
    });
    this.persistence.saveEquipment(JSON.parse(JSON.stringify(this.player.equipment)));
    this.persistence.saveInventory(this.inventory.toSaveData());
    if (this.skillManager) {
      this.persistence.data.skillManagerData = this.skillManager.toSaveData();
      this.persistence.save();
    }
  }

  startLevel(levelConfig) {
    this.currentLevel = levelConfig;
    this.dungeonMode = true; // All levels are now dungeon mode
    this.currentFloor = 1;

    this._startDungeonFloor(levelConfig, this.currentFloor);
  }

  _startDungeonFloor(levelConfig, floor) {
    // Configure renderer theme
    this.renderer.setTheme(levelConfig);

    // Generate dungeon
    const seed = Date.now() + floor * 997;
    this.dungeon = this.dungeonGenerator.generate(floor, seed, levelConfig);
    this.dungeon.bossType = levelConfig.boss || 'stoneguard';

    // Convert to layout data
    const layoutData = this.dungeonGenerator.toLayoutData(this.dungeon);
    const mw = this.dungeon.mapWidth;
    const mh = this.dungeon.mapHeight;

    // Create layout manager with fog of war
    this.layoutManager = new LayoutManager(mw, mh, layoutData);
    this.layoutManager.enableFog();
    this.renderer.setLayout(this.layoutManager);
    this.renderer.mapWidth = mw;
    this.renderer.mapHeight = mh;

    // Create dungeon room manager
    this.dungeonManager = new DungeonRoomManager(this.dungeon, this.layoutManager);
    this.dungeonManager._getBossType = () => levelConfig.boss || 'stoneguard';

    // Reveal entrance room and corridors
    const entrance = this.dungeon.rooms.find(r => r.id === this.dungeon.entranceRoomId);
    if (entrance) {
      this.layoutManager.revealRoom(entrance);
      // Reveal corridors from entrance
      for (const c of this.dungeon.corridors) {
        if (c.fromRoomId === entrance.id || c.toRoomId === entrance.id) {
          for (const seg of c.segments) this.layoutManager.revealCorridorSegment(seg);
        }
      }
    }

    // Place player in entrance
    if (entrance) {
      this.player.x = entrance.x + entrance.width / 2;
      this.player.y = entrance.y + entrance.height / 2;
    } else {
      // Fallback: center of map
      this.player.x = mw / 2;
      this.player.y = mh / 2;
      console.warn('No entrance room found in dungeon');
    }

    // Clear transient state
    this.projectiles = [];
    this.minions = [];
    this.corpses = [];
    this.fireTrails = [];
    this.chainLightnings = [];
    this.particles.particles = [];
    this.playerTrail = [];
    this.meleeSweep = null;
    this.meteorWarning = null;
    this.rainArrows = [];
    this.gravitonOrbs = [];
    this.bladeHitTimers = new Map();

    // No wave system in dungeon mode - reset shim so it captures new dungeonManager
    this.waveSystem = null;
    this._waveShim = null;

    // Clear loot from previous floor
    if (this.lootSystem) this.lootSystem.clear();
    if (this.trapManager) this.trapManager.clear();

    // Generate traps for this floor
    if (this.trapsData) {
      this.trapManager = new TrapManager(this.trapsData);
      const floorData = this.floorConfig.getFloor(this.currentFloor);
      this.trapManager.generateTraps(
        this.dungeon.rooms,
        this.dungeon.corridors || [],
        this.currentFloor,
        floorData?.trapDensity,
        floorData?.trapTypes
      );
    }

    // Start playing
    this.state = 'PLAYING';
    this.hud.setVisible(true);
    this.waveAnnouncement = { wave: 0, timer: 2.0, text: `Floor ${floor} - ${levelConfig.name}` };
    this.hud.updateLevelName(`${levelConfig.name} - Floor ${floor}`);
    this.hud.hideBossHP();
  }

  _transitionToNextFloor() {
    this.currentFloor++;
    const totalFloors = this.floorConfig.getTotalFloors();

    // Unlock waystone for the new floor
    this.persistence.discoverFloor(this.currentFloor);
    this._saveProgress();

    if (this.currentFloor > totalFloors) {
      // All 25 floors complete!
      this.state = 'LEVEL_CLEAR';
      this.waveAnnouncement = { wave: 0, timer: 2.5, text: 'Dungeon Complete!' };
      this.renderer.flash('#f1c40f', 0.5);
      this.particles.levelClear(this.player.x, this.player.y);
      this._showLevelClearUI();
    } else {
      // Next floor - get new biome config
      const levelConfig = this.floorConfig.toLevelConfig(this.currentFloor);
      this.renderer.flash('#fff', 0.3);
      this.waveAnnouncement = { wave: 0, timer: 2.0, text: `Floor ${this.currentFloor}` };
      this._startDungeonFloor(levelConfig, this.currentFloor);
    }
  }

  update(dt) {
    if (this.state !== 'PLAYING' && this.state !== 'LEVEL_CLEAR' && this.state !== 'BASE_CAMP') return;

    // Handle LEVEL_CLEAR state - just update visuals while UI is showing
    if (this.state === 'LEVEL_CLEAR') {
      if (this.waveAnnouncement.timer > 0) this.waveAnnouncement.timer -= dt;
      this.particles.update(dt);
      return;
    }

    this.time += dt;
    this.input.update();

    // === BASE_CAMP UPDATE ===
    if (this.state === 'BASE_CAMP') {
      const player = this.player;
      const mapW = this.campData.mapWidth;
      const mapH = this.campData.mapHeight;

      player.update(dt, this.input.moveVector, mapW, mapH);

      // Aim toward mouse in camp (so character faces cursor)
      const campMouseX = this.input.mouseX + this.renderer.camera.x;
      const campMouseY = this.input.mouseY + this.renderer.camera.y;
      player.aimAngle = Math.atan2(campMouseY - player.y, campMouseX - player.x);

      // Clamp to camp layout
      if (this.layoutManager) {
        const clamped = this.layoutManager.clampPosition(player.x, player.y, player.radius);
        player.x = clamped.x;
        player.y = clamped.y;
      }

      // Player trail
      if (this.input.moveVector.x !== 0 || this.input.moveVector.y !== 0) {
        this.playerTrail.push({ x: player.x, y: player.y, alpha: 0.5 });
        if (this.playerTrail.length > 10) this.playerTrail.shift();
      }
      for (const t of this.playerTrail) t.alpha -= dt * 1.5;
      this.playerTrail = this.playerTrail.filter(t => t.alpha > 0);

      // NPC proximity
      const nearestNPC = this.campManager.update(player.x, player.y);

      // NPC interaction
      if (nearestNPC && this.input.consumeInteract()) {
        this._interactWithNPC(nearestNPC);
      }

      // Update HUD state in camp (same data as dungeon)
      this.hud.updateHP(player.hp, player.maxHP);
      this.hud.updateResource(player.resource, player.maxResource, player.resourceColor, player.resourceName);
      this.hud.updateGold(this.persistence.getGold());
      this.hud.updateXP(player.xp, player.xpToNext, player.level);
      this.hud.updateLevelName('Base Camp');

      // Announcement decay
      if (this.waveAnnouncement.timer > 0) this.waveAnnouncement.timer -= dt;
      this.renderer.updateFlash(dt);
      this.particles.update(dt);
      return;
    }

    const player = this.player;

    // === DUNGEON MODE: room transitions and fog of war ===
    if (this.dungeonMode && this.dungeonManager) {
      // Check room transition
      const transition = this.dungeonManager.checkRoomTransition(player.x, player.y);
      if (transition) {
        if (transition.type === 'combat_start') {
          this.waveAnnouncement = { wave: 0, timer: 1.5, text: 'Enemies!' };
          this.audio.bossAppear();
        } else if (transition.type === 'safe_room') {
          this.waveAnnouncement = { wave: 0, timer: 1.5, text: 'Safe Room' };
        } else if (transition.type === 'shop_room') {
          this.waveAnnouncement = { wave: 0, timer: 1.5, text: 'Shop' };
        } else if (transition.type === 'treasure_room') {
          this.waveAnnouncement = { wave: 0, timer: 1.5, text: 'Treasure!' };
        }

        // Reveal room and connecting corridors
        if (transition.room) {
          this.layoutManager.revealRoom(transition.room);
          for (const c of this.dungeon.corridors) {
            if (c.fromRoomId === transition.room.id || c.toRoomId === transition.room.id) {
              for (const seg of c.segments) this.layoutManager.revealCorridorSegment(seg);
            }
          }
        }
      }

      // Check room cleared
      const currentRoom = this.dungeonManager.currentRoom;
      if (currentRoom && !currentRoom.cleared && this.dungeonManager.isRoomCleared()) {
        const result = this.dungeonManager.onRoomCleared(currentRoom);
        if (result && result.type === 'boss_defeated') {
          this.waveAnnouncement = { wave: 0, timer: 2.0, text: 'Boss Defeated!' };
          this.renderer.flash('#f1c40f', 0.5);
          this.particles.levelClear(player.x, player.y);
        } else {
          this.waveAnnouncement = { wave: 0, timer: 1.0, text: 'Room Cleared!' };
          this.renderer.flash('#2ecc71', 0.2);
        }
      }

      // Check stairs
      if (this.dungeonManager.isPlayerOnStairs(player.x, player.y)) {
        this._transitionToNextFloor();
        return;
      }

      // Fog of war: reveal around player
      this.layoutManager.revealAroundPoint(player.x, player.y, 3);
    }

    // Current map dimensions (from level or default)
    const mapW = this.renderer.mapWidth;
    const mapH = this.renderer.mapHeight;

    // === Unified enemy/boss access for both modes ===
    // In dungeon mode, create a wave-like shim so existing combat code works
    if (this.dungeonMode && this.dungeonManager && !this._waveShim) {
      const dm = this.dungeonManager;
      const game = this;
      this._waveShim = {
        get enemies() { return dm.enemies; },
        set enemies(v) { dm.enemies = v; },
        get boss() { return dm.boss; },
        set boss(v) { dm.boss = v; },
        blessings: [], // empty, no blessing system
        checkWaveClear: () => false,
        get currentWave() { return game.currentFloor; },
        get totalEnemies() { return dm.enemies.length + (dm.boss ? 1 : 0); },
        triggerWaveClear: () => {},
        startCountdown: () => {},
        updateCountdown: () => false,
        countdownTimer: 0,
        setLevelConfig: () => {},
        addEnemiesFromBoss: (type, count, x, y) => {
          for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = 40 + Math.random() * 30;
            dm.enemies.push(new Enemy(type, x + Math.cos(angle) * dist, y + Math.sin(angle) * dist, game.currentFloor));
          }
        },
      };
    }

    // Hotkeys during gameplay
    if (this.input.consumeTab()) {
      this._openSkillBook();
    }
    // Inventory (I key)
    if (this.input.consumeInventory() && (this.state === 'PLAYING' || this.state === 'BASE_CAMP')) {
      this._openInventory();
    }

    // Potion hotbar (1-4 keys)
    for (let i = 0; i < 4; i++) {
      if (this.input.consumeHotbar(i)) {
        this._usePotion(i);
      }
    }

    // Skill Book (K key)
    if (this.input.consumeSkillBook() && (this.state === 'PLAYING' || this.state === 'BASE_CAMP')) {
      this._openSkillBook();
    }
    // Character panel (C key)
    if (this.input.consumeCharacter() && (this.state === 'PLAYING' || this.state === 'BASE_CAMP')) {
      this._openCharacterPanel();
    }
    // Boss chest interaction
    if (this.input.consumeInteract() && this.lootSystem && this.lootSystem.bossChest && !this.lootSystem.bossChest.opened) {
      const chest = this.lootSystem.bossChest;
      const dx = player.x - chest.x;
      const dy = player.y - chest.y;
      if (Math.sqrt(dx * dx + dy * dy) < 40) {
        chest.opened = true;
        this.persistence.addGold(chest.gold);
        for (const item of chest.items) {
          if (this.inventory && !this.inventory.isFull()) {
            this.inventory.addToBag(item);
            this.waveAnnouncement = { wave: 0, timer: 1.5, text: `${item.name}!` };
          } else {
            this.lootSystem.spawnGroundItem(chest.x, chest.y, item);
          }
        }
        this.particles.confetti(chest.x, chest.y);
        this.audio.levelUp();
      }
    }
    if (this.input.consumePotion()) {
      if (this.player.usePotion()) {
        this.hud.updateHP(this.player.hp, this.player.maxHP);
        this.particles.emit(this.player.x, this.player.y, 8, '#e74c3c', { speed: 40, life: 0.3 });
      }
    }

    // Update skill cooldowns
    if (this.skillManager) {
      this.skillManager.update(dt, this.player);

      // Process pending summons from summon toggles (Necromancer)
      if (this.skillManager.pendingSummons && this.skillManager.pendingSummons.length > 0) {
        for (const summon of this.skillManager.pendingSummons) {
          this.skillManager.confirmSummon(summon.id, this.player);
          // Actually spawn the minion
          this._spawnMinionFromSummon(summon);
        }
        this.skillManager.pendingSummons = [];
      }
    }

    // Player movement (runs regardless of wave state)
    player.update(dt, this.input.moveVector, mapW, mapH);

    // Layout-aware clamping for player
    if (this.layoutManager) {
      const clamped = this.layoutManager.clampPosition(player.x, player.y, player.radius);
      player.x = clamped.x;
      player.y = clamped.y;

      // Hazard damage/healing to player
      const hazardDmg = this.layoutManager.getHazardDamage(player.x, player.y);
      if (hazardDmg > 0) {
        player.takeDamage(hazardDmg * dt, 0, { environmental: true, dot: true });
      } else if (hazardDmg < 0) {
        // Negative damage = healing (safe room fountains)
        player.hp = Math.min(player.maxHP, player.hp + Math.abs(hazardDmg) * dt);
      }
    }

    // === MOUSE-BASED AIMING (ARPG style) ===
    // Player always faces the mouse cursor — runs before wave check so it works even without enemies
    const mouseWorldX = this.input.mouseX + this.renderer.camera.x;
    const mouseWorldY = this.input.mouseY + this.renderer.camera.y;
    player.aimAngle = Math.atan2(mouseWorldY - player.y, mouseWorldX - player.x);

    // Wave/enemy system reference
    const wave = this.waveSystem || this._waveShim;
    if (!wave) {
      // No enemy system yet - still allow movement, timers, rendering
      if (this.waveAnnouncement.timer > 0) this.waveAnnouncement.timer -= dt;
      this.renderer.updateFlash(dt);
      this.particles.update(dt);
      this.damageNumbers.update(dt);
      this.hud.updateHP(player.hp, player.maxHP);
      this.hud.updateResource(player.resource, player.maxResource, player.resourceColor, player.resourceName);
      return;
    }

    // Player trail effect
    if (this.input.moveVector.x !== 0 || this.input.moveVector.y !== 0) {
      this.playerTrail.push({ x: player.x, y: player.y, alpha: 0.5 });
      if (this.playerTrail.length > 10) this.playerTrail.shift();
    }
    for (const t of this.playerTrail) {
      t.alpha -= dt * 1.5;
    }
    this.playerTrail = this.playerTrail.filter(t => t.alpha > 0);

    // Wave announcement decay
    if (this.waveAnnouncement.timer > 0) this.waveAnnouncement.timer -= dt;

    // Flash effect decay
    this.renderer.updateFlash(dt);

    // Melee sweep visual decay
    if (this.meleeSweep) {
      this.meleeSweep.timer -= dt;
      if (this.meleeSweep.timer <= 0) this.meleeSweep = null;
    }

    // Meteor warning visual
    if (this.meteorWarning) {
      this.meteorWarning.timer -= dt;
      if (this.meteorWarning.timer <= 0) {
        // Meteor lands!
        this._meteorLand(this.meteorWarning.x, this.meteorWarning.y, this.meteorWarning.radius);
        this.meteorWarning = null;
      }
    }

    // Rain arrows visual
    for (const r of this.rainArrows) {
      r.timer -= dt;
    }
    this.rainArrows = this.rainArrows.filter(r => r.timer > 0);

    // Find nearest enemy (for targeting info, not for aiming)
    let nearestEnemy = null;
    let nearestDist = Infinity;
    const allTargets = [...wave.enemies.filter(e => !e.dead)];
    if (wave.boss && !wave.boss.dead) allTargets.push(wave.boss);

    for (const e of allTargets) {
      const dx = e.x - player.x;
      const dy = e.y - player.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < nearestDist) {
        nearestDist = d;
        nearestEnemy = e;
      }
    }

    // Mage decoy: enemies near decoy target it instead
    if (player.decoy) {
      for (const e of wave.enemies) {
        if (e.dead) continue;
        const dx = e.x - player.decoy.x;
        const dy = e.y - player.decoy.y;
        if (Math.sqrt(dx * dx + dy * dy) < player.decoy.radius) {
          e._decoyTarget = player.decoy;
        }
      }
    }

    // === SKILL-BASED COMBAT (LMB / RMB) ===
    // Player must click to attack - no auto-attack

    // LMB: primary skill (fires toward cursor while held)
    if (this.input.leftHold && this.skillManager) {
      const leftInfo = this.skillManager.getLeftSkill();
      if (leftInfo && this.skillManager.canUseSkill(this.skillManager.leftSlot, player)) {
        const info = this.skillManager.useSkill(this.skillManager.leftSlot, player);
        if (info) this._executeSkill(info, nearestEnemy, nearestDist);
      }
    }

    // RMB: secondary skill (single press, fires toward cursor)
    if (this.input.consumeRightClick() && this.skillManager) {
      const rightInfo = this.skillManager.getRightSkill();
      if (rightInfo && this.skillManager.canUseSkill(this.skillManager.rightSlot, player)) {
        const info = this.skillManager.useSkill(this.skillManager.rightSlot, player);
        if (info) this._executeSkill(info, nearestEnemy, nearestDist);
      }
    }

    // Fallback: if no skill manager or no skills, basic click-to-attack
    if (!this.skillManager || (!this.skillManager.leftSlot && !this.skillManager.rightSlot)) {
      if (this.input.leftHold && player.canAttack()) {
        if (player.playerClass === 'warrior') {
          this._warriorMeleeAttack();
        } else {
          this._playerShoot({ x: mouseWorldX, y: mouseWorldY });
        }
      }
    }

    // Update enemies
    if (this.state === 'PLAYING') {
      for (const e of wave.enemies) {
        if (e.dead) continue;

        // Mage decoy override target
        if (e._decoyTarget && player.decoy) {
          e.update(dt, player.decoy.x, player.decoy.y);
          e._decoyTarget = null;
        } else {
          e.update(dt, player.x, player.y);
        }

        // Ranged enemy shooting
        if (e.canShoot()) {
          e.shoot();
          const dx = player.x - e.x;
          const dy = player.y - e.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 0) {
            const speed = e.projectileSpeed;
            const enemyProj = new Projectile(
              e.x, e.y,
              (dx / dist) * speed, (dy / dist) * speed,
              e.damage, true
            );
            enemyProj.sourceLevel = e.level || 1;
            this.projectiles.push(enemyProj);
          }
        }

        // Clamp enemies to map / obstacles
        if (this.layoutManager) {
          const clamped = this.layoutManager.clampPosition(e.x, e.y, e.radius);
          e.x = clamped.x;
          e.y = clamped.y;
        } else {
          e.x = Math.max(e.radius, Math.min(mapW - e.radius, e.x));
          e.y = Math.max(e.radius, Math.min(mapH - e.radius, e.y));
        }
      }

      // Update boss
      if (wave.boss && !wave.boss.dead) {
        const action = wave.boss.update(dt, player.x, player.y, mapW, mapH);
        if (action) {
          if (action.type === 'stomp') {
            const dx = player.x - action.x;
            const dy = player.y - action.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < action.radius) {
              player.takeDamage(action.damage, wave.boss.level || 1, { isAoE: true });
              this.screenShake = 0.3;
            }
            this.particles.emit(action.x, action.y, 20, '#7f8c8d', { speed: 150, life: 0.5 });
          }
          if (action.type === 'summon') {
            wave.addEnemiesFromBoss(action.summonType || 'grunt', action.count, action.x, action.y);
          }
          if (action.type === 'freeze_ray') {
            // Slow player if in radius using a frame-based debuff timer
            const fdx = player.x - action.x;
            const fdy = player.y - action.y;
            if (Math.sqrt(fdx * fdx + fdy * fdy) < action.radius) {
              player._freezeSlowPct = action.slow;
              player._freezeSlowTimer = action.duration;
            }
            this.particles.emit(action.x, action.y, 15, '#85c1e9', { speed: 100, life: 0.5 });
          }
          if (action.type === 'fire_breath') {
            // Cone damage in front of boss
            const halfArc = Math.PI / 4;
            for (const target of [player]) {
              const dx2 = target.x - action.x;
              const dy2 = target.y - action.y;
              const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
              if (dist2 < action.radius) {
                const angle2 = Math.atan2(dy2, dx2);
                let diff = angle2 - action.angle;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                if (Math.abs(diff) < halfArc) {
                  player.takeDamage(action.damage, wave.boss.level || 1, { isAoE: true });
                  this.screenShake = 0.2;
                }
              }
            }
            this.particles.emit(action.x + Math.cos(action.angle) * 40, action.y + Math.sin(action.angle) * 40, 20, '#e74c3c', { speed: 150, life: 0.4 });
          }
        }

        // Boss rifts damage
        for (const rift of wave.boss.rifts) {
          const dx = player.x - rift.x;
          const dy = player.y - rift.y;
          if (Math.sqrt(dx * dx + dy * dy) < rift.radius) {
            player.takeDamage(rift.damage * dt, wave.boss.level || 1, { environmental: true, dot: true });
          }
        }

        this.hud.showBossHP(wave.boss.name, wave.boss.hp, wave.boss.maxHP);
      }
    }

    // Update projectiles
    for (const p of this.projectiles) {
      const oldX = p.x, oldY = p.y;
      p.update(dt);
      if (p.isOutOfBounds(mapW, mapH)) p.dead = true;

      // Projectile wall collision
      if (!p.dead && this.layoutManager && this.layoutManager.obstacles.length > 0) {
        const hit = this.layoutManager.raycast(oldX, oldY, p.x, p.y);
        if (hit) {
          p.dead = true;
          this.particles.emit(hit.x, hit.y, 4, '#888', { speed: 40, life: 0.2 });
        }
      }
    }

    // Frost aura
    if (player.frostAuraRadius > 0) {
      const auraRadius = player.frostAuraRadius * (player.aoeRadiusMult || 1);
      for (const e of wave.enemies) {
        if (e.dead) continue;
        const dx = e.x - player.x;
        const dy = e.y - player.y;
        if (Math.sqrt(dx * dx + dy * dy) < auraRadius) {
          e.applySlow(player.frostSlowPercent, 0.5);
        }
      }
      if (wave.boss && !wave.boss.dead) {
        const dx = wave.boss.x - player.x;
        const dy = wave.boss.y - player.y;
        if (Math.sqrt(dx * dx + dy * dy) < auraRadius) {
          wave.boss.applySlow(player.frostSlowPercent, 0.5);
        }
      }
    }

    // Fire trail
    if (player.fireTrailDamage > 0 && player.fireTrailTimer <= 0) {
      if (this.input.moveVector.x !== 0 || this.input.moveVector.y !== 0) {
        this.fireTrails.push({
          x: player.x,
          y: player.y,
          damage: player.fireTrailDamage,
          timer: player.fireTrailDuration,
          alpha: 1,
          hitTimer: 0,
        });
        player.fireTrailTimer = 0.1;
      }
    }

    // Update fire trails
    for (const t of this.fireTrails) {
      t.timer -= dt;
      t.alpha = Math.max(0, t.timer / player.fireTrailDuration || 0.5);
      t.hitTimer -= dt;
      if (t.hitTimer <= 0) {
        t.hitTimer = 0.3;
        for (const e of wave.enemies) {
          if (e.dead) continue;
          const dx = e.x - t.x;
          const dy = e.y - t.y;
          if (Math.sqrt(dx * dx + dy * dy) < 15) {
            e.takeDamage(t.damage);
            this.damageNumbers.spawn(e.x, e.y - e.radius, t.damage, false);
            if (e.dead) this._onEnemyDeath(e);
          }
        }
      }
    }
    this.fireTrails = this.fireTrails.filter(t => t.timer > 0);

    // Chain lightning visuals
    for (const c of this.chainLightnings) {
      c.timer -= dt;
      c.alpha = Math.max(0, c.timer / 0.2);
    }
    this.chainLightnings = this.chainLightnings.filter(c => c.timer > 0);

    // Poison ticks on enemies
    for (const e of wave.enemies) {
      if (e.dead) continue;
      if (e._burnTimer && e._burnTimer > 0) {
        e._burnTimer -= dt;
        e._burnAccum = (e._burnAccum || 0) + (e._burnDamage || 3) * dt;
        if (e._burnAccum >= 1) {
          const dmg = Math.floor(e._burnAccum);
          e._burnAccum -= dmg;
          const killed = e.takeDamage(dmg);
          this.damageNumbers.spawn(e.x, e.y - e.radius, dmg, false);
          if (killed) this._onEnemyDeath(e);
        }
      }
      if (e._poisonTimer && e._poisonTimer > 0) {
        e._poisonTimer -= dt;
        e._poisonAccum = (e._poisonAccum || 0) + (e._poisonDPS || 0) * dt;
        if (e._poisonAccum >= 1) {
          const dmg = Math.floor(e._poisonAccum);
          e._poisonAccum -= dmg;
          const killed = e.takeDamage(dmg);
          this.damageNumbers.spawn(e.x, e.y - e.radius, dmg, false);
          if (killed) this._onEnemyDeath(e);
        }
      }
      // Mark decay
      if (e._markTimer && e._markTimer > 0) {
        e._markTimer -= dt;
        if (e._markTimer <= 0) e._markStacks = 0;
      }
    }

    // Graviton orb
    if (player.orbCooldown > 0 && player.orbTimer <= 0 && wave.enemies.some(e => !e.dead)) {
      this.gravitonOrbs.push({
        x: player.x, y: player.y,
        timer: player.orbDuration,
        pullRadius: player.pullRadius,
        pullForce: player.pullForce,
      });
      player.orbTimer = player.orbCooldown;
    }
    for (let i = this.gravitonOrbs.length - 1; i >= 0; i--) {
      const orb = this.gravitonOrbs[i];
      orb.timer -= dt;
      if (orb.timer <= 0) { this.gravitonOrbs.splice(i, 1); continue; }
      for (const e of wave.enemies) {
        if (e.dead) continue;
        const dx = e.x - orb.x;
        const dy = e.y - orb.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < orb.pullRadius && dist > 5) {
          e.x -= (dx / dist) * orb.pullForce * dt;
          e.y -= (dy / dist) * orb.pullForce * dt;
        }
      }
    }

    // Spectral blades
    if (player.bladeCount > 0) {
      const bladeAngleStep = (Math.PI * 2) / player.bladeCount;
      const bladeSpeed = 2; // radians per second
      for (let i = 0; i < player.bladeCount; i++) {
        const angle = (this.time * bladeSpeed) + i * bladeAngleStep;
        const bx = player.x + Math.cos(angle) * player.bladeRadius;
        const by = player.y + Math.sin(angle) * player.bladeRadius;
        for (const e of wave.enemies) {
          if (e.dead) continue;
          const dx = e.x - bx;
          const dy = e.y - by;
          if (Math.sqrt(dx * dx + dy * dy) < e.radius + 8) {
            const key = e;
            const lastHit = this.bladeHitTimers.get(key) || 0;
            if (this.time - lastHit > 0.5) {
              this.bladeHitTimers.set(key, this.time);
              const killed = e.takeDamage(player.bladeDamage);
              this.damageNumbers.spawn(e.x, e.y - e.radius, player.bladeDamage, false);
              if (killed) this._onEnemyDeath(e);
            }
          }
        }
      }
    }

    // Temporal field (slow all enemies)
    if (player.fieldActive) {
      for (const e of wave.enemies) {
        if (e.dead) continue;
        e.applySlow(player.fieldSlowPercent, 0.5);
      }
      if (wave.boss && !wave.boss.dead) {
        wave.boss.applySlow(player.fieldSlowPercent, 0.5);
      }
    }

    // Update minions (Necromancer)
    this._updateMinions(dt, wave, mapW, mapH);

    // Update corpses (Necromancer)
    this._updateCorpses(dt);

    // Necromancer soul harvest zone
    if (player.soulHarvestActive) {
      this._updateSoulHarvest(dt, wave);
    }

    // Trap system
    if (this.trapManager && this.state === 'PLAYING') {
      const triggered = this.trapManager.update(dt, player.x, player.y);
      for (const t of triggered) {
        const result = this.trapManager.applyTrigger(t.trap, this.currentFloor);
        if (result.damage > 0) {
          this.player.takeDamage(result.damage, 0, { environmental: true });
          this.damageNumbers.spawn(player.x, player.y - player.radius, Math.round(result.damage), false);
          this.audio.playerHit();
        }
        if (result.status) {
          const totalSta = (this.player.baseAttributes?.sta || 0) + (this.player.attributes?.sta || 0);
          this.statusEffects.apply(result.status.type, result.status.duration, result.status.magnitude || 1, 'trap', totalSta);
        }
        if (result.knockback) {
          // Push player away from trap
          const dx = player.x - t.trap.x;
          const dy = player.y - t.trap.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          player.x += (dx / dist) * result.knockback;
          player.y += (dy / dist) * result.knockback;
        }
        this.particles.emit(t.trap.x, t.trap.y, t.trap.trapDef?.visual?.color || '#ff0000', 8);
      }
      this.trapManager.removeActivated();
    }

    // Collision: projectiles vs enemies
    this._checkProjectileCollisions();

    // Collision: enemies vs player
    this._checkEnemyPlayerCollisions(dt);

    // Collision: boss vs player
    if (wave.boss && !wave.boss.dead) {
      const bDist = this.collision.distanceBetween(player, wave.boss);
      if (bDist < player.radius + wave.boss.radius && wave.boss.contactCooldown <= 0) {
        const dmg = this._applyDamageToPlayer(wave.boss.damage, wave.boss.level || 1);
        wave.boss.contactCooldown = 1.0;
        this.screenShake = 0.2;
        if (player.thornsDamage > 0) {
          wave.boss.takeDamage(player.thornsDamage);
        }
      }
    }

    // Update enemy counter
    const aliveEnemies = wave.enemies.filter(e => !e.dead).length + (wave.boss && !wave.boss.dead ? 1 : 0);
    this.hud.updateEnemyCount(aliveEnemies, wave.totalEnemies || 0);

    // Dungeon room clears handled in the dungeon transition block above

    // Clean up dead
    this.projectiles = this.projectiles.filter(p => !p.dead);
    wave.enemies = wave.enemies.filter(e => !e.dead || this._handleSplitter(e));

    // Screen shake decay
    if (this.screenShake > 0) this.screenShake -= dt;

    // Particles
    this.particles.update(dt);

    // Damage numbers
    this.damageNumbers.update(dt);

    // Player death check
    if (this.player.hp <= 0 && !this.player.dead) {
      this.player.dead = true;
      this._handlePlayerDeath();
    }

    // Loot system update
    if (this.lootSystem) {
      this.lootSystem.update(dt, player.x, player.y, player.radius, player.magnetRange,
        (goldAmount) => {
          this.persistence.addGold(goldAmount);
        },
        (item) => {
          if (!this.inventory || this.inventory.isFull()) return false;
          this.inventory.addToBag(item);
          this.waveAnnouncement = { wave: 0, timer: 1.0, text: `${item.name}` };
          return true;
        }
      );
    }

    // HUD
    this.hud.updateHP(player.hp, player.maxHP);
    this.hud.updateResource(player.resource, player.maxResource, player.resourceColor, player.resourceName);
    this.hud.updateGold(this.persistence.getGold());

    // Update HUD hotbar display
    if (this.inventory) {
      const hotbarState = [];
      for (let i = 0; i < 4; i++) {
        const item = this.inventory.getHotbarItem(i);
        if (item) {
          const cdGroup = item.cooldownGroup || 'shared';
          const cdRemaining = Math.max(0, this.potionCooldowns[cdGroup] || 0);
          const cdTotal = item.cooldown || 3;
          hotbarState.push({
            icon: item.icon || '?',
            stackCount: item.stackCount || 1,
            cooldownPct: cdRemaining > 0 ? cdRemaining / cdTotal : 0,
          });
        } else {
          hotbarState.push(null);
        }
      }
      this.hud.setHotbar(hotbarState);
    }

    // Update HUD skill slot cooldowns
    if (this.skillManager) {
      const leftId = this.skillManager.leftSlot;
      const rightId = this.skillManager.rightSlot;
      const leftCd = leftId ? { remaining: this.skillManager.cooldowns[leftId] || 0, total: this.skillManager.getSkill(leftId)?.cooldown || 1 } : null;
      const rightCd = rightId ? { remaining: this.skillManager.cooldowns[rightId] || 0, total: this.skillManager.getSkill(rightId)?.cooldown || 1 } : null;
      this.hud.setSkillCooldowns(leftCd, rightCd);
    }

    // Potion cooldowns
    for (const key of Object.keys(this.potionCooldowns)) {
      if (this.potionCooldowns[key] > 0) this.potionCooldowns[key] -= dt;
    }

    // Status effects
    if (this.statusEffects) {
      this.statusEffects.update(dt);

      // Apply DoT damage from status effects (environmental — bypasses dodge, but armor applies)
      const dotDmg = this.statusEffects.getDotDamage(dt);
      if (dotDmg > 0) {
        this.player.takeDamage(dotDmg, 0, { dot: true, environmental: true });
      }
    }
    this.hud.setStatusEffects(this.statusEffects.getActiveEffects());

  }

  // === WARRIOR MELEE ATTACK ===
  _warriorMeleeAttack() {
    const player = this.player;
    player.attack();
    this.audio.shoot();

    const angle = player.aimAngle;
    const range = player.getMeleeRange();
    const halfArc = (player.sweepAngle / 2) * (Math.PI / 180);
    const knockback = player.getMeleeKnockback();

    let isCrit = false;
    if (player.critChance > 0 && Math.random() < player.critChance) {
      isCrit = true;
    }

    const dmg = isCrit ? player.getEffectiveDamage() * (player.critDamageMultiplier || 1.5) : player.getEffectiveDamage();

    // Visual sweep
    this.meleeSweep = { x: player.x, y: player.y, angle, arc: player.sweepAngle, range, timer: 0.15 };

    // Hit all enemies in arc
    const wave = this.waveSystem || this._waveShim;
    const targets = [...wave.enemies.filter(e => !e.dead)];
    if (wave.boss && !wave.boss.dead) targets.push(wave.boss);

    for (const e of targets) {
      const dx = e.x - player.x;
      const dy = e.y - player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > range + e.radius) continue;

      // Check angle
      const enemyAngle = Math.atan2(dy, dx);
      let angleDiff = enemyAngle - angle;
      // Normalize to [-PI, PI]
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

      if (Math.abs(angleDiff) <= halfArc) {
        const killed = e.takeDamage(dmg);
        this.damageNumbers.spawn(e.x, e.y - e.radius, dmg, isCrit);

        // Knockback
        if (dist > 0) {
          e.x += (dx / dist) * knockback;
          e.y += (dy / dist) * knockback;
        }

        // Lifesteal
        if (player.lifestealPercent > 0) {
          player.hp = Math.min(player.maxHP, player.hp + dmg * player.lifestealPercent);
        }

        // Resource on hit deal
        if (player.resourceOnHitDeal > 0) {
          player.gainResource(player.resourceOnHitDeal);
        }

        // Explosion (from blessing)
        if (player.explosionRadius > 0) {
          this._explosion(e.x, e.y, player.explosionRadius, player.explosionDamage, null);
        }

        // Chain lightning
        if (player.chainCount > 0) {
          this._chainLightning(e, player.chainCount, player.chainDamage, player.chainRange);
        }

        if (killed) {
          this._onEnemyDeath(e);
        }
      }
    }

    this.particles.emit(player.x + Math.cos(angle) * range * 0.5, player.y + Math.sin(angle) * range * 0.5, 6, player.color, { speed: 80, life: 0.2 });
  }

  // === RANGED ATTACK (Mage, Archer, Necromancer, default) ===
  _playerShoot(nearestEnemy, damageMult) {
    const player = this.player;
    player.attack();
    this.audio.shoot();

    const angle = player.aimAngle;
    const speed = player.projectileSpeed || 300;
    const totalProjectiles = 1 + player.extraProjectiles;
    const projRadius = (player.classConfig && player.classConfig.projectileRadius) || 4;

    let isCrit = false;
    if (player.critChance > 0 && Math.random() < player.critChance) {
      isCrit = true;
    }

    let baseDmg = player.getEffectiveDamage();

    // Soul harvest passive stacks bonus
    if (player.harvestStacks > 0) {
      baseDmg += player.harvestStacks * player.harvestDmgPerStack;
    }

    if (damageMult) baseDmg = Math.round(baseDmg * damageMult);

    // Overcharge
    let isOvercharged = false;
    if (player.overchargeEvery > 0 && !damageMult) {
      player.overchargeCounter++;
      if (player.overchargeCounter >= player.overchargeEvery) {
        player.overchargeCounter = 0;
        isOvercharged = true;
        baseDmg = Math.round(baseDmg * player.overchargeDamageMult);
      }
    }

    const dmg = isCrit ? baseDmg * (player.critDamageMultiplier || 1.5) : baseDmg;

    // Archer quickdraw damage bonus
    const quickdrawBonus = (player.quickdrawCounter > 0 && player.quickdrawDamageBonus > 0) ? player.quickdrawDamageBonus : 0;

    for (let i = 0; i < totalProjectiles; i++) {
      let a = angle;
      if (totalProjectiles > 1) {
        const offset = (i - (totalProjectiles - 1) / 2) * (player.spreadAngle * Math.PI / 180);
        a = angle + offset;
      }
      const p = new Projectile(
        player.x + Math.cos(a) * player.radius,
        player.y + Math.sin(a) * player.radius,
        Math.cos(a) * speed,
        Math.sin(a) * speed,
        dmg + quickdrawBonus
      );
      p.radius = projRadius;
      p.pierce = player.pierce;
      p.bounces = player.bounces;
      p.bounceRange = player.bounceRange;

      // Archer innate pierce
      if (player.classConfig && player.classConfig.innatePierce) {
        p.pierce += player.classConfig.innatePierce;
      }

      // Archer first-hit bonus flag
      if (player.classConfig && player.classConfig.firstHitBonus) {
        p.firstHitBonus = player.classConfig.firstHitBonus;
      }

      // Mage innate explosion
      if (player.classConfig && player.classConfig.innateExplosionRadius) {
        p.innateExplosionRadius = player.classConfig.innateExplosionRadius * (player.aoeRadiusMult || 1);
        p.innateExplosionDamage = Math.floor(dmg * (player.classConfig.innateExplosionDamagePct || 0.4)) * (player.aoeDamageMult || 1);
      }

      // Mage elemental mastery coloring
      if (player.elementCycle && player.elementCycle.length > 0) {
        p.element = player.elementCycle[player.elementIndex % player.elementCycle.length];
      }

      // Archer splitting arrow data
      if (player.splitCount > 0) {
        p.splitCount = player.splitCount;
        p.splitDamagePct = player.splitDamagePct;
      }

      // Necromancer drain flag
      if (player.playerClass === 'necromancer') {
        p.isDrain = true;
        p.innateLifesteal = player.classConfig.innateLifesteal || 0.15;
      }

      // Overcharge size
      if (isOvercharged) {
        p.radius = Math.round(p.radius * player.overchargeSizeMult);
        p.isOvercharged = true;
      }

      // Homing salvo blessing
      if (player.homingPower > 0 && nearestEnemy) {
        p.homing = player.homingPower;
        p.homingTarget = nearestEnemy;
      } else if (i > 0 && totalProjectiles > 1 && nearestEnemy) {
        // Extra projectiles (not the center one) get gentle homing
        p.homing = 150;
        p.homingTarget = nearestEnemy;
      }

      this.projectiles.push(p);
    }

    // Mage element index advance
    if (player.elementCycle) {
      player.elementIndex++;
    }

    // Necromancer hit counter for summon
    if (player.playerClass === 'necromancer') {
      player.hitCounter++;
    }

    // Spell echo check
    if (player.echoChance > 0 && Math.random() < player.echoChance && !damageMult) {
      player.echoQueued = true;
      player.echoTimer = player.echoDelay;
      this.echoTarget = nearestEnemy;
    }
  }

  _checkProjectileCollisions() {
    const wave = this.waveSystem || this._waveShim;
    const player = this.player;

    for (const p of this.projectiles) {
      if (p.dead) continue;

      if (p.isEnemy) {
        // Enemy projectile vs player
        const dx = player.x - p.x;
        const dy = player.y - p.y;
        if (Math.sqrt(dx * dx + dy * dy) < player.radius + p.radius) {
          this._applyDamageToPlayer(p.damage, p.sourceLevel || 1);
          p.dead = true;
          this.screenShake = 0.1;
          this.renderer.flash('#e74c3c', 0.2);
        }
        continue;
      }

      // Player projectile vs enemies
      const targets = [...wave.enemies.filter(e => !e.dead)];
      if (wave.boss && !wave.boss.dead) targets.push(wave.boss);

      for (const e of targets) {
        if (p.hitEnemies.has(e)) continue;
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        if (Math.sqrt(dx * dx + dy * dy) < e.radius + p.radius) {
          let hitDmg = p.damage;

          // Archer first-hit bonus
          if (p.firstHitBonus && p.hitEnemies.size === 0) {
            hitDmg = Math.round(hitDmg * (1 + p.firstHitBonus));
          }

          // Archer marked for death
          if (player.markMaxStacks > 0) {
            if (!e._markStacks) e._markStacks = 0;
            if (!e._markTimer) e._markTimer = 0;
            hitDmg += e._markStacks * player.markDamagePerStack;
            e._markStacks = Math.min(e._markStacks + 1, player.markMaxStacks);
            e._markTimer = player.markDuration;
          }

          const killed = e.takeDamage(hitDmg);
          p.hitEnemies.add(e);
          this.damageNumbers.spawn(e.x, e.y - e.radius, hitDmg, hitDmg > player.damage);

          // Lifesteal
          if (player.lifestealPercent > 0) {
            player.hp = Math.min(player.maxHP, player.hp + hitDmg * player.lifestealPercent);
          }

          // Necromancer innate drain
          if (p.isDrain && p.innateLifesteal) {
            player.hp = Math.min(player.maxHP, player.hp + hitDmg * p.innateLifesteal);
          }

          // Mage innate explosion
          if (p.innateExplosionRadius) {
            this._explosion(p.x, p.y, p.innateExplosionRadius, p.innateExplosionDamage, p);
          }

          // Blessing explosion
          if (player.explosionRadius > 0) {
            const expRadius = player.explosionRadius * (player.aoeRadiusMult || 1);
            const expDmg = player.explosionDamage * (player.aoeDamageMult || 1);
            this._explosion(p.x, p.y, expRadius, expDmg, p);
          }

          // Chain lightning
          if (player.chainCount > 0) {
            this._chainLightning(e, player.chainCount, player.chainDamage, player.chainRange);
          }

          // Mage elemental on-hit effects
          if (p.element) {
            this._applyElementEffect(p.element, e);
          }

          // Poison application
          if (player.poisonDamage > 0) {
            e._poisonDPS = player.poisonDamage;
            e._poisonTimer = player.poisonDuration;
            e._poisonAccum = e._poisonAccum || 0;
          }

          // Archer splitting arrow
          if (p.splitCount && p.splitCount > 0) {
            this._splitArrow(p, e);
          }

          // Necromancer: check for minion summon
          if (player.playerClass === 'necromancer' && player.hitCounter % (player.classConfig.summonEveryNHits || 5) === 0) {
            this._trySpawnMinion(e.x, e.y);
          }

          if (killed) {
            this._onEnemyDeath(e);
          }

          // Pierce: continue through
          if (p.pierce > 0) {
            p.pierce--;
          } else if (p.bounces > 0) {
            // Ricochet to nearest un-hit enemy
            p.bounces--;
            const nextTarget = this._findNearestUnhit(p, targets);
            if (nextTarget) {
              const ndx = nextTarget.x - p.x;
              const ndy = nextTarget.y - p.y;
              const ndist = Math.sqrt(ndx * ndx + ndy * ndy);
              if (ndist > 0 && ndist < p.bounceRange) {
                p.vx = (ndx / ndist) * (player.projectileSpeed || 300);
                p.vy = (ndy / ndist) * (player.projectileSpeed || 300);
              } else {
                p.dead = true;
              }
            } else {
              p.dead = true;
            }
          } else {
            p.dead = true;
          }
          break;
        }
      }
    }
  }

  _explosion(x, y, radius, damage, sourceProjectile) {
    const wave = this.waveSystem || this._waveShim;
    const targets = [...wave.enemies.filter(e => !e.dead)];
    if (wave.boss && !wave.boss.dead) targets.push(wave.boss);

    this.particles.emit(x, y, 12, '#e67e22', { speed: 120, life: 0.3 });
    this.audio.explosion();

    for (const e of targets) {
      if (sourceProjectile && sourceProjectile.hitEnemies.has(e)) continue;
      const dx = e.x - x;
      const dy = e.y - y;
      if (Math.sqrt(dx * dx + dy * dy) < radius + e.radius) {
        const killed = e.takeDamage(damage);
        this.damageNumbers.spawn(e.x, e.y - e.radius, damage, false);
        if (killed) this._onEnemyDeath(e);
      }
    }
  }

  _chainLightning(source, chains, damage, range) {
    this.audio.chainLightning();
    const wave = this.waveSystem || this._waveShim;
    const hit = new Set([source]);
    let current = source;

    for (let i = 0; i < chains; i++) {
      const targets = wave.enemies.filter(e => !e.dead && !hit.has(e));
      let nearest = null;
      let nearestDist = range;

      for (const t of targets) {
        const dx = t.x - current.x;
        const dy = t.y - current.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = t;
        }
      }

      if (!nearest) break;

      this.chainLightnings.push({
        x1: current.x, y1: current.y,
        x2: nearest.x, y2: nearest.y,
        timer: 0.2, alpha: 1,
      });

      const killed = nearest.takeDamage(damage);
      this.damageNumbers.spawn(nearest.x, nearest.y - nearest.radius, damage, false);
      if (killed) this._onEnemyDeath(nearest);
      hit.add(nearest);
      current = nearest;
    }
  }

  _findNearestUnhit(projectile, targets) {
    let nearest = null;
    let nearestDist = Infinity;
    for (const t of targets) {
      if (t.dead || projectile.hitEnemies.has(t)) continue;
      const dx = t.x - projectile.x;
      const dy = t.y - projectile.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = t;
      }
    }
    return nearest;
  }

  // === UNIQUE ABILITIES ===
  _tryUniqueAbility() {
    const player = this.player;
    const moveVec = this.input.moveVector;

    if (!player.classConfig) {
      // No class - use basic dash
      if (player.dashDistance > 0) player.tryDash(moveVec);
      return;
    }

    switch (player.playerClass) {
      case 'warrior':
        this._warriorShieldCharge(moveVec);
        break;
      case 'mage':
        this._mageArcaneBlink(moveVec);
        break;
      case 'archer':
        this._archerEvasiveRoll(moveVec);
        break;
      case 'necromancer':
        this._necromancerSoulHarvest();
        break;
      default:
        if (player.dashDistance > 0) player.tryDash(moveVec);
    }
  }

  _warriorShieldCharge(moveVec) {
    const player = this.player;
    if (player.uniqueAbilityTimer > 0 || player.isDashing) return;
    if (moveVec.x === 0 && moveVec.y === 0) return;

    const ability = player.classConfig.uniqueAbility;
    player.uniqueAbilityTimer = ability.cooldown;
    player.isDashing = true;
    player.dashVx = moveVec.x;
    player.dashVy = moveVec.y;
    player.dashRemaining = ability.duration;
    player.invulnTimer = ability.duration;

    // Damage enemies along charge path (handled each frame while dashing via collision)
    // We'll flag it so collision code knows to deal charge damage
    player._isCharging = true;
    player._chargeDamage = ability.damage + player.damageBonus;
    player._chargeKnockback = ability.knockback;
    player._chargeHitEnemies = new Set();

    // Override dash speed
    const origUpdate = player.update.bind(player);
    const chargeSpeed = ability.speed;
    const self = this;

    // Store original for restoration
    player._origDashEnd = () => {
      player._isCharging = false;
      // Ground slam on charge end
      if (player.slamRadius > 0) {
        self._explosion(player.x, player.y, player.slamRadius, player.slamDamage, null);
        self.screenShake = 0.2;
        if (player.slamStunDuration > 0) {
          const wave = self.waveSystem || self._waveShim;
          if (!wave) return;
          for (const e of wave.enemies) {
            if (e.dead) continue;
            const dx = e.x - player.x;
            const dy = e.y - player.y;
            if (Math.sqrt(dx * dx + dy * dy) < player.slamRadius) {
              e._stunTimer = player.slamStunDuration;
            }
          }
        }
      }
    };
  }

  _mageArcaneBlink(moveVec) {
    const player = this.player;
    if (player.uniqueAbilityTimer > 0) return;
    if (moveVec.x === 0 && moveVec.y === 0) return;

    const ability = player.classConfig.uniqueAbility;
    player.uniqueAbilityTimer = ability.cooldown;

    // Teleport
    const dist = ability.distance;
    const oldX = player.x;
    const oldY = player.y;
    player.x += moveVec.x * dist;
    player.y += moveVec.y * dist;

    // Clamp to map
    const mapW = this.renderer.mapWidth;
    const mapH = this.renderer.mapHeight;
    player.x = Math.max(player.radius, Math.min(mapW - player.radius, player.x));
    player.y = Math.max(player.radius, Math.min(mapH - player.radius, player.y));

    player.invulnTimer = ability.invulnTime;

    // Leave decoy at old position
    player.decoy = {
      x: oldX,
      y: oldY,
      timer: ability.decoyDuration,
      radius: ability.decoyRadius,
    };

    // Visual
    this.particles.emit(oldX, oldY, 10, player.color, { speed: 100, life: 0.3 });
    this.particles.emit(player.x, player.y, 10, player.color, { speed: 100, life: 0.3 });
  }

  _archerEvasiveRoll(moveVec) {
    const player = this.player;
    if (player.uniqueAbilityTimer > 0 || player.isDashing) return;
    if (moveVec.x === 0 && moveVec.y === 0) return;

    const ability = player.classConfig.uniqueAbility;
    player.uniqueAbilityTimer = ability.cooldown;
    player.isDashing = true;
    player.dashVx = moveVec.x;
    player.dashVy = moveVec.y;
    player.dashRemaining = ability.duration;
    player.invulnTimer = ability.duration;

    // Fire backward arrows
    const backAngle = Math.atan2(-moveVec.y, -moveVec.x);
    const spread = (ability.spreadAngle * Math.PI / 180);
    const arrowCount = ability.backwardArrows;
    const dmg = Math.round(player.damage * ability.backwardDamagePct);

    for (let i = 0; i < arrowCount; i++) {
      const offset = (i - (arrowCount - 1) / 2) * spread / arrowCount;
      const a = backAngle + offset;
      const speed = player.projectileSpeed || 450;
      const proj = new Projectile(
        player.x, player.y,
        Math.cos(a) * speed, Math.sin(a) * speed,
        dmg
      );
      proj.radius = 3;
      this.projectiles.push(proj);
    }

    // Quickdraw: set counter for instant next shots
    if (player.quickdrawShots > 0) {
      player.quickdrawCounter = player.quickdrawShots;
    }
  }

  _necromancerSoulHarvest() {
    const player = this.player;
    if (player.uniqueAbilityTimer > 0) return;

    const ability = player.classConfig.uniqueAbility;
    player.uniqueAbilityTimer = ability.cooldown;
    player.soulHarvestActive = true;
    player.soulHarvestTimer = ability.duration;
    player.soulHarvestX = player.x;
    player.soulHarvestY = player.y;

    this.particles.emit(player.x, player.y, 15, player.color, { speed: 60, life: 0.4 });
  }

  _updateSoulHarvest(dt, wave) {
    const player = this.player;
    const ability = player.classConfig.uniqueAbility;
    const radius = ability.radius;
    let healAmount = 0;

    for (const e of wave.enemies) {
      if (e.dead) continue;
      const dx = e.x - player.soulHarvestX;
      const dy = e.y - player.soulHarvestY;
      if (Math.sqrt(dx * dx + dy * dy) < radius) {
        const dmg = ability.damagePerSec * dt;
        const killed = e.takeDamage(dmg);
        e.applySlow(ability.slowPercent, 0.5);
        healAmount += ability.healPerEnemyPerSec * dt;
        if (killed) {
          this._onEnemyDeath(e);
          // Guaranteed minion spawn on death in harvest
          this._trySpawnMinion(e.x, e.y);
        }
      }
    }

    if (healAmount > 0) {
      player.hp = Math.min(player.maxHP, player.hp + healAmount);
    }
  }

  // === MINION MANAGEMENT ===
  _updateMinions(dt, wave, mapW, mapH) {
    for (let i = this.minions.length - 1; i >= 0; i--) {
      const m = this.minions[i];
      const result = m.update(dt, wave.enemies, wave.boss, mapW, mapH);

      if (result && result.killed) {
        this._onEnemyDeath(result.enemy);
      }
      if (result && result.damage > 0) {
        this.damageNumbers.spawn(result.enemy.x, result.enemy.y - result.enemy.radius, result.damage, false);
      }

      if (m.dead) {
        // Death explosion blessing
        if (this.player.minionExplosionRadius > 0) {
          this._explosion(m.x, m.y, this.player.minionExplosionRadius, this.player.minionExplosionDamage, null);
        }
        this.particles.deathBurst(m.x, m.y, m.color);
        this.minions.splice(i, 1);
      }
    }
  }

  _trySpawnMinion(x, y) {
    const player = this.player;
    if (this.minions.length >= player.maxMinions) return;

    const config = {
      hp: (player.classConfig.minionHP || 30) + player.minionHPBonus,
      damage: (player.classConfig.minionDamage || 5) + player.minionDamageBonus,
      speed: player.classConfig.minionSpeed || 80,
      duration: (player.classConfig.minionDuration || 8) + player.minionDurationBonus,
      slowPercent: player.minionSlowPercent,
      slowDuration: player.minionSlowDuration,
      pullRange: player.minionPullRange,
      pullStrength: player.minionPullStrength,
    };

    this.minions.push(new Minion(x, y, config));
    this.particles.emit(x, y, 8, '#2e86c1', { speed: 60, life: 0.3 });
  }

  _spawnMinionFromSummon(summonInfo) {
    const player = this.player;
    const data = summonInfo.data;
    if (!data) return;
    if (this.minions.length >= (player.maxMinions || 5)) return;

    const x = player.x + (Math.random() - 0.5) * 40;
    const y = player.y + (Math.random() - 0.5) * 40;
    const config = {
      hp: data.petHP || 30,
      damage: data.petDamage || 5,
      speed: data.petSpeed || 80,
      duration: data.petDuration || 15,
    };

    this.minions.push(new Minion(x, y, config));
    this.particles.emit(x, y, 10, '#8e44ad', { speed: 50, life: 0.4 });
  }

  _updateCorpses(dt) {
    const player = this.player;
    if (player.corpseBuffDuration <= 0) return;

    for (let i = this.corpses.length - 1; i >= 0; i--) {
      const c = this.corpses[i];
      c.timer -= dt;
      if (c.timer <= 0) {
        this.corpses.splice(i, 1);
        continue;
      }

      // Check if player is near corpse
      const dx = player.x - c.x;
      const dy = player.y - c.y;
      if (Math.sqrt(dx * dx + dy * dy) < 30) {
        // Consume corpse
        player.corpseSpeedTimer = player.corpseBuffDuration;
        if (player.corpseHeal > 0) {
          player.hp = Math.min(player.maxHP, player.hp + player.corpseHeal);
        }
        if (Math.random() < player.corpseSpawnChance) {
          this._trySpawnMinion(c.x, c.y);
        }
        this.corpses.splice(i, 1);
        this.particles.emit(c.x, c.y, 6, '#2e86c1', { speed: 40, life: 0.2 });
      }
    }
  }

  // === MAGE ABILITIES ===
  _triggerMeteor() {
    const wave = this.waveSystem || this._waveShim;
    const player = this.player;
    const enemies = wave.enemies.filter(e => !e.dead);
    if (enemies.length === 0) return;

    // Find densest cluster
    let bestPos = null;
    let bestCount = 0;
    const checkRadius = 80;

    for (const e of enemies) {
      let count = 0;
      for (const other of enemies) {
        const dx = other.x - e.x;
        const dy = other.y - e.y;
        if (Math.sqrt(dx * dx + dy * dy) < checkRadius) count++;
      }
      if (count > bestCount) {
        bestCount = count;
        bestPos = { x: e.x, y: e.y };
      }
    }

    if (bestPos) {
      const radius = player.meteorRadius * (player.aoeRadiusMult || 1);
      this.meteorWarning = { x: bestPos.x, y: bestPos.y, radius, timer: 0.5 };
    }
  }

  _meteorLand(x, y, radius) {
    const player = this.player;
    const damage = player.meteorDamage * (player.aoeDamageMult || 1);
    this._explosion(x, y, radius, damage, null);
    this.screenShake = 0.3;
    this.particles.emit(x, y, 25, '#e67e22', { speed: 200, life: 0.5 });
  }

  // === ARCHER ABILITIES ===
  _triggerRainOfArrows() {
    const player = this.player;
    const wave = this.waveSystem || this._waveShim;
    const count = player.rainArrows;
    const radius = player.rainRadius;
    const damage = player.rainDamage;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * radius;
      const ax = player.x + Math.cos(angle) * dist;
      const ay = player.y + Math.sin(angle) * dist;

      // Visual
      this.rainArrows.push({ x: ax, y: ay, timer: 0.3 });

      // Damage enemies near impact
      const targets = [...wave.enemies.filter(e => !e.dead)];
      if (wave.boss && !wave.boss.dead) targets.push(wave.boss);

      for (const e of targets) {
        const dx = e.x - ax;
        const dy = e.y - ay;
        if (Math.sqrt(dx * dx + dy * dy) < 15 + e.radius) {
          const killed = e.takeDamage(damage);
          this.damageNumbers.spawn(e.x, e.y - e.radius, damage, false);
          if (killed) this._onEnemyDeath(e);
        }
      }
    }

    this.particles.emit(player.x, player.y, 10, '#27ae60', { speed: 80, life: 0.3 });
  }

  _splitArrow(projectile, hitEnemy) {
    const player = this.player;
    const count = projectile.splitCount;
    const damagePct = projectile.splitDamagePct;
    const splitDmg = Math.round(projectile.damage * damagePct);
    const speed = player.projectileSpeed || 450;

    // Fan outward from impact
    const baseAngle = Math.atan2(projectile.vy, projectile.vx);
    const spreadArc = (120 * Math.PI / 180);

    for (let i = 0; i < count; i++) {
      const offset = (i - (count - 1) / 2) * (spreadArc / Math.max(count - 1, 1));
      const a = baseAngle + offset + Math.PI; // Reverse direction (spread outward)
      const p = new Projectile(
        hitEnemy.x, hitEnemy.y,
        Math.cos(a) * speed, Math.sin(a) * speed,
        splitDmg
      );
      p.radius = 2;
      p.lifetime = 1.0;
      p.hitEnemies.add(hitEnemy);
      this.projectiles.push(p);
    }
  }

  // === ELEMENT EFFECTS ===
  _applyElementEffect(element, enemy) {
    switch (element) {
      case 'fire':
        enemy._burnDamage = 3;
        enemy._burnTimer = 2;
        break;
      case 'ice':
        enemy.applySlow(0.3, 2);
        break;
      case 'lightning':
        // Mini chain to 2 enemies
        this._chainLightning(enemy, 2, 8, 80);
        break;
      // 'arcane' is default, no extra effect
    }
  }

  // === DARK PACT ===
  _triggerDarkPact() {
    const player = this.player;
    if (this.minions.length === 0) return;

    // Sacrifice oldest minion
    const sacrificed = this.minions.shift();
    this.particles.emit(sacrificed.x, sacrificed.y, 12, '#2e86c1', { speed: 80, life: 0.3 });

    // If death explosion is active, trigger it
    if (player.minionExplosionRadius > 0) {
      this._explosion(sacrificed.x, sacrificed.y, player.minionExplosionRadius, player.minionExplosionDamage, null);
    }

    player.pactReady = true;
  }

  // === SKILL EXECUTION ===
  _executeSkill(info, nearestEnemy, nearestDist) {
    const { skill, level, data } = info;
    const player = this.player;
    const damage = (data.damage || 0) + player.damageBonus + Math.round(player.getWeaponDamage());

    this.audio.shoot();

    switch (skill.attackType) {
      case 'melee':
        this._skillMelee(damage, data, nearestEnemy);
        break;
      case 'melee_aoe':
        this._skillMeleeAoE(damage, data);
        break;
      case 'projectile':
        this._skillProjectile(damage, data, nearestEnemy);
        break;
      case 'projectile_aoe':
        this._skillProjectileAoE(damage, data, nearestEnemy);
        break;
      case 'aoe':
        this._skillAoE(damage, data);
        break;
      case 'self_buff':
        this._skillBuff(data);
        break;
      case 'dash':
        this._skillDash(damage, data);
        break;
      case 'teleport':
        this._skillTeleport(data);
        break;
      case 'summon':
        this._skillSummon(data);
        break;
      case 'debuff':
        this._skillDebuff(data, nearestEnemy);
        break;
      case 'toggle':
        // Toggle handled in skillManager.useSkill
        break;
      case 'channel':
        this._skillProjectile(damage, data, nearestEnemy); // Simplified: treat as rapid projectile
        break;
      case 'placed':
        this._skillPlaced(damage, data);
        break;
      default:
        // Fallback to projectile
        if (nearestEnemy) this._playerShoot(nearestEnemy);
    }
  }

  _skillMelee(damage, data, target) {
    const player = this.player;
    const range = data.range || player.getMeleeRange();
    const arc = data.aoeArc || player.sweepAngle;
    const halfArc = (arc / 2) * (Math.PI / 180);
    const angle = player.aimAngle;

    let isCrit = player.critChance > 0 && Math.random() < player.critChance;
    const dmg = isCrit ? damage * (player.critDamageMultiplier || 1.5) : damage;

    this.meleeSweep = { x: player.x, y: player.y, angle, arc, range, timer: 0.15 };

    const wave = this.waveSystem || this._waveShim;
    if (!wave) return;
    const targets = [...wave.enemies.filter(e => !e.dead)];
    if (wave.boss && !wave.boss.dead) targets.push(wave.boss);

    for (const e of targets) {
      const dx = e.x - player.x;
      const dy = e.y - player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > range + e.radius) continue;
      const enemyAngle = Math.atan2(dy, dx);
      let angleDiff = enemyAngle - angle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      if (Math.abs(angleDiff) <= halfArc) {
        const fromAngle = Math.atan2(-dy, -dx);
        const killed = e.takeDamage(dmg, fromAngle);
        this.damageNumbers.spawn(e.x, e.y - e.radius, dmg, isCrit);
        if (player.lifestealPercent > 0) player.hp = Math.min(player.maxHP, player.hp + dmg * player.lifestealPercent);
        if (player.resourceOnHitDeal > 0) player.gainResource(player.resourceOnHitDeal);
        if (killed) this._onEnemyDeath(e);
      }
    }
  }

  _skillMeleeAoE(damage, data) {
    const player = this.player;
    const radius = data.radius || 100;
    const isCrit = player.critChance > 0 && Math.random() < player.critChance;
    const dmg = isCrit ? damage * (player.critDamageMultiplier || 1.5) : damage;

    this._explosion(player.x, player.y, radius, dmg, null);
    this.screenShake = 0.2;
    if (data.stunDuration) {
      const wave = this.waveSystem || this._waveShim;
      if (wave) for (const e of wave.enemies) {
        if (e.dead) continue;
        const dx = e.x - player.x;
        const dy = e.y - player.y;
        if (Math.sqrt(dx * dx + dy * dy) < radius) e._stunTimer = data.stunDuration;
      }
    }
  }

  _skillProjectile(damage, data, _target) {
    const player = this.player;
    const isCrit = player.critChance > 0 && Math.random() < player.critChance;
    const dmg = isCrit ? damage * (player.critDamageMultiplier || 1.5) : damage;

    // Always fire toward cursor (aimAngle), not toward a specific target
    const angle = player.aimAngle;
    const speed = player.projectileSpeed || 300;
    const count = data.arrows || data.count || 1;
    const spread = (data.spread || data.spreadAngle || 0) * (Math.PI / 180);

    for (let i = 0; i < count; i++) {
      let a = angle;
      if (count > 1) {
        const offset = (i - (count - 1) / 2) * (spread / Math.max(count - 1, 1));
        a = angle + offset;
      }
      const p = new Projectile(
        player.x + Math.cos(a) * player.radius,
        player.y + Math.sin(a) * player.radius,
        Math.cos(a) * speed, Math.sin(a) * speed, dmg
      );
      p.radius = (player.classConfig && player.classConfig.projectileRadius) || 4;
      p.pierce = data.pierce || player.pierce || 0;
      if (data.lifestealPercent) p.isDrain = true;
      if (data.lifestealPercent) p.innateLifesteal = data.lifestealPercent;
      this.projectiles.push(p);
    }
  }

  _skillProjectileAoE(damage, data, target) {
    // Fire a projectile that explodes on hit
    this._skillProjectile(damage, data, target);
    // The explosion is handled via innate explosion on the projectile
    if (this.projectiles.length > 0) {
      const last = this.projectiles[this.projectiles.length - 1];
      last.innateExplosionRadius = data.explosionRadius || data.radius || 50;
      last.innateExplosionDamage = Math.round(damage * (data.splashPercent || 0.6));
    }
  }

  _skillAoE(damage, data) {
    const player = this.player;
    const radius = data.radius || 100;
    this._explosion(player.x, player.y, radius, damage, null);
    if (data.slowPercent) {
      const wave = this.waveSystem || this._waveShim;
      if (wave) for (const e of wave.enemies) {
        if (e.dead) continue;
        const dx = e.x - player.x;
        const dy = e.y - player.y;
        if (Math.sqrt(dx * dx + dy * dy) < radius) {
          e.applySlow(data.slowPercent / 100, data.slowDuration || 2);
        }
      }
    }
    this.screenShake = 0.15;
  }

  _skillBuff(data) {
    const player = this.player;
    if (data.damageBonus) {
      player._buffDamage = (player._buffDamage || 0) + data.damageBonus;
      const dur = data.duration || 6;
      setTimeout(() => { player._buffDamage = Math.max(0, (player._buffDamage || 0) - data.damageBonus); }, dur * 1000);
    }
    if (data.shieldPercent) {
      player.shieldHP = player.maxHP * data.shieldPercent / 100;
      player.shieldMaxHP = player.shieldHP;
    }
    if (data.absorb) {
      player.shieldHP = data.absorb;
      player.shieldMaxHP = data.absorb;
    }
    this.particles.emit(player.x, player.y, 10, player.color, { speed: 60, life: 0.3 });
  }

  _skillDash(damage, data) {
    const player = this.player;
    const moveVec = this.input.moveVector;
    if (moveVec.x === 0 && moveVec.y === 0) return;
    player.isDashing = true;
    player.dashVx = moveVec.x;
    player.dashVy = moveVec.y;
    player.dashRemaining = 0.15;
    player.invulnTimer = data.invulnTime || 0.15;
    player._isCharging = damage > 0;
    player._chargeDamage = damage;
    player._chargeKnockback = 30;
    player._chargeHitEnemies = new Set();
  }

  _skillTeleport(data) {
    const player = this.player;
    const moveVec = this.input.moveVector;
    if (moveVec.x === 0 && moveVec.y === 0) return;
    const dist = data.distance || 150;
    const oldX = player.x, oldY = player.y;
    player.x += moveVec.x * dist;
    player.y += moveVec.y * dist;
    const mapW = this.renderer.mapWidth, mapH = this.renderer.mapHeight;
    player.x = Math.max(player.radius, Math.min(mapW - player.radius, player.x));
    player.y = Math.max(player.radius, Math.min(mapH - player.radius, player.y));
    player.invulnTimer = data.invulnTime || 0.3;
    this.particles.emit(oldX, oldY, 10, player.color, { speed: 100, life: 0.3 });
    this.particles.emit(player.x, player.y, 10, player.color, { speed: 100, life: 0.3 });
  }

  _skillSummon(data) {
    this._trySpawnMinion(this.player.x + (Math.random() - 0.5) * 60, this.player.y + (Math.random() - 0.5) * 60);
  }

  _skillDebuff(data, target) {
    if (!target) return;
    if (data.vulnerabilityPercent) {
      target._vulnMult = 1 + (data.vulnerabilityPercent || 20) / 100;
      target._vulnTimer = data.duration || 5;
    }
    if (data.damageReductionPercent) {
      target._weakenMult = 1 - (data.damageReductionPercent || 15) / 100;
      target._weakenTimer = data.duration || 5;
    }
    this.particles.emit(target.x, target.y, 6, '#9b59b6', { speed: 40, life: 0.3 });
  }

  _skillPlaced(damage, data) {
    // Place a trap at player position
    const player = this.player;
    const trap = { x: player.x, y: player.y, damage, radius: data.radius || 60, timer: 15, triggered: false };
    if (!this._traps) this._traps = [];
    this._traps.push(trap);
  }

  // === CHAIN REACTION ===
  _chainReactionExplosion(x, y, depth) {
    if (depth >= 3) return; // Cap recursion
    const player = this.player;
    const wave = this.waveSystem || this._waveShim;
    const radius = player.deathExplosionRadius;
    const damage = player.deathExplosionDamage;

    this.particles.emit(x, y, 10, '#e74c3c', { speed: 100, life: 0.3 });

    const targets = wave.enemies.filter(e => !e.dead);
    for (const e of targets) {
      const dx = e.x - x;
      const dy = e.y - y;
      if (Math.sqrt(dx * dx + dy * dy) < radius + e.radius) {
        const killed = e.takeDamage(damage);
        this.damageNumbers.spawn(e.x, e.y - e.radius, damage, false);

        // Synergy: Death's Cascade - chain lightning from explosion
        if (player.activeSynergies.includes('deaths_cascade') && player.chainCount > 0) {
          this._chainLightning(e, 2, 8, 80);
        }

        if (killed) {
          this.particles.deathBurst(e.x, e.y, e.color);
          this.audio.enemyDeath();
          this._chainReactionExplosion(e.x, e.y, depth + 1);
        }
      }
    }
  }

  // === SYNERGY DETECTION ===
  // === DAMAGE APPLICATION WITH SOUL LINK ===
  _applyDamageToPlayer(amount, attackerLevel = 1, options = {}) {
    const player = this.player;

    // Necromancer soul link: redirect damage to minions
    if (player.soulLinkPercent > 0 && this.minions.length > 0) {
      const redirected = amount * player.soulLinkPercent;
      amount -= redirected;
      const targetMinion = this.minions[Math.floor(Math.random() * this.minions.length)];
      targetMinion.takeDamage(redirected);
    }

    const dmg = player.takeDamage(amount, attackerLevel, options);

    // Resource on hit take (warrior rage)
    if (dmg > 0 && player.resourceOnHitTake > 0) {
      player.gainResource(player.resourceOnHitTake);
    }

    // Frost nova on hit
    if (dmg > 0 && player.novaRadius > 0 && player.novaTimer <= 0) {
      player.novaTimer = player.novaCooldown;
      const wave = this.waveSystem || this._waveShim;
      for (const e of wave.enemies) {
        if (e.dead) continue;
        const dx = e.x - player.x;
        const dy = e.y - player.y;
        if (Math.sqrt(dx * dx + dy * dy) < player.novaRadius) {
          e.applySlow(player.novaSlow, player.novaDuration);
        }
      }
      this.particles.emit(player.x, player.y, 15, '#5dade2', { speed: 150, life: 0.3 });
    }

    // Dodge proc: show "DODGE" text
    if (player._lastDodged) {
      this.damageNumbers.spawn(player.x, player.y - player.radius - 10, 'DODGE', false);
    }

    return dmg;
  }

  _checkEnemyPlayerCollisions(dt) {
    const player = this.player;
    const wave = this.waveSystem || this._waveShim;

    for (const e of wave.enemies) {
      if (e.dead || e.contactCooldown > 0 || e.isBurrowed) continue;

      // Stun check
      if (e._stunTimer && e._stunTimer > 0) {
        e._stunTimer -= dt;
        continue;
      }

      const dx = player.x - e.x;
      const dy = player.y - e.y;
      if (Math.sqrt(dx * dx + dy * dy) < player.radius + e.radius) {
        // Warrior shield charge damage
        if (player._isCharging && !player._chargeHitEnemies.has(e)) {
          const killed = e.takeDamage(player._chargeDamage);
          player._chargeHitEnemies.add(e);
          this.damageNumbers.spawn(e.x, e.y - e.radius, player._chargeDamage, false);
          // Knockback
          const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
          e.x -= (dx / dist) * player._chargeKnockback;
          e.y -= (dy / dist) * player._chargeKnockback;
          if (killed) this._onEnemyDeath(e);
          continue;
        }

        const dmg = this._applyDamageToPlayer(e.damage, e.level || 1);
        e.contactCooldown = 0.5;
        this.screenShake = 0.1;
        this.audio.playerHit();
        this.renderer.flash('#e74c3c', 0.2);

        if (player.thornsDamage > 0) {
          const killed = e.takeDamage(player.thornsDamage);
          if (killed) this._onEnemyDeath(e);
        }
      }
    }

    // Check warrior charge end
    if (player._isCharging && !player.isDashing) {
      if (player._origDashEnd) player._origDashEnd();
    }
  }

  _onEnemyDeath(enemy) {
    this.particles.deathBurst(enemy.x, enemy.y, enemy.color);
    this.audio.enemyDeath();

    // Kill tracking
    const isBoss = enemy.constructor.name === 'Boss';
    if (isBoss) {
      this.kills.boss++;
    } else if (this.kills.hasOwnProperty(enemy.type)) {
      this.kills[enemy.type]++;
    }

    // Resource on kill
    if (this.player.resourceOnKill > 0) {
      this.player.gainResource(this.player.resourceOnKill);
    }

    // Loot drops
    if (this.lootSystem) {
      if (isBoss) {
        this.lootSystem.createBossChest(enemy.x, enemy.y, this.currentFloor || 1, this.player.playerClass);
      } else {
        this.lootSystem.rollEnemyDrop(enemy, this.currentFloor || 1, this.player.playerClass);
      }
    }

    // XP with level difference multiplier
    const enemyLevel = enemy.level || 1;
    const playerLevel = this.player.level;
    const levelDiff = playerLevel - enemyLevel;
    let levelDiffMult = 1.0;
    if (levelDiff >= 5) levelDiffMult = 0.1;
    else if (levelDiff >= 3) levelDiffMult = 0.5;
    else if (levelDiff >= 1) levelDiffMult = 0.8;
    else if (levelDiff <= -3) levelDiffMult = 1.5;
    else if (levelDiff <= -1) levelDiffMult = 1.2;

    const baseXP = enemy.xp || 10;
    const xp = Math.floor(baseXP * enemyLevel * levelDiffMult);
    const leveled = this.player.addXP(xp);
    this.hud.updateXP(this.player.xp, this.player.xpToNext, this.player.level);
    this.hud.updateHP(this.player.hp, this.player.maxHP);
    if (leveled) {
      this.waveAnnouncement = { wave: 0, timer: 1.5, text: `Level Up! (${this.player.level}) +1 Attribute, +1 Passive` };
      this.renderer.flash('#f1c40f', 0.2);
      // _applySkillTree() removed — stats now handled by recalcAllStats() in player.js
    }

    // Warrior: blood rage kill buff
    if (this.player.killBuffDuration > 0) {
      this.player.killBuffTimer = this.player.killBuffDuration;
    }

    // Mage: spell siphon cooldown reduction
    if (this.player.siphonCooldownReduction > 0) {
      this.player.uniqueAbilityTimer = Math.max(0, this.player.uniqueAbilityTimer - this.player.siphonCooldownReduction);
      this.player.meteorTimer = Math.max(0, this.player.meteorTimer - this.player.siphonCooldownReduction);
      if (this.player.siphonAttackSpeedBurst > 0) {
        this.player.attackTimer = Math.max(0, this.player.attackTimer - this.player.siphonAttackSpeedBurst);
      }
    }

    // Necromancer: corpse drop
    if (this.player.playerClass === 'necromancer' && this.player.corpseBuffDuration > 0) {
      this.corpses.push({ x: enemy.x, y: enemy.y, timer: 5 });
    }

    // Bomber: explode on death, damaging player and nearby enemies
    if (enemy.explodeOnDeath && enemy.explosionRadius > 0) {
      const bdx = player.x - enemy.x;
      const bdy = player.y - enemy.y;
      if (Math.sqrt(bdx * bdx + bdy * bdy) < enemy.explosionRadius) {
        this._applyDamageToPlayer(enemy.damage, enemy.level || 1);
        this.screenShake = 0.2;
      }
      this._explosion(enemy.x, enemy.y, enemy.explosionRadius, Math.round(enemy.damage * 0.5), null);
      this.particles.emit(enemy.x, enemy.y, 15, '#c0392b', { speed: 120, life: 0.4 });
    }

    // Chain reaction: death explosion
    if (this.player.deathExplosionRadius > 0) {
      this._chainReactionExplosion(enemy.x, enemy.y, 0);
    }

    // Soul harvest passive: kill stacks
    if (this.player.harvestMaxStacks > 0) {
      this.player.harvestStacks = Math.min(this.player.harvestStacks + 1, this.player.harvestMaxStacks);
      this.player.harvestTimer = this.player.harvestDuration;
    }
  }

  _handleSplitter(enemy) {
    if (!enemy.dead) return true; // Keep alive
    if (enemy.splitsInto && enemy.splitCount > 0) {
      for (let i = 0; i < enemy.splitCount; i++) {
        const angle = (i / enemy.splitCount) * Math.PI * 2;
        const ex = enemy.x + Math.cos(angle) * 20;
        const ey = enemy.y + Math.sin(angle) * 20;
        const wave = this.waveSystem || this._waveShim;
        const child = new Enemy(enemy.splitsInto, ex, ey, wave ? wave.currentWave : this.currentFloor);
        if (wave) wave.enemies.push(child);
      }
      enemy.splitCount = 0; // Prevent re-splitting
    }
    return false; // Remove dead enemy
  }

  // _applySkillTree() removed — replaced by recalcAllStats() in player.js

  async _showLevelClearUI() {
    const totalKills = Object.values(this.kills).reduce((a, b) => a + b, 0);
    let stars = 1;
    if (this.player.hp > this.player.maxHP * 0.5) stars = 2;
    // bestCombo check removed (combo system removed for ARPG redesign)

    // Mark dungeon as cleared
    if (this.currentLevel) {
      this.persistence.saveFloorState(this.currentFloor, { cleared: true });
      if (!this.clearedLevels.includes(this.currentLevel.id)) {
        this.clearedLevels.push(this.currentLevel.id);
      }
    }
    this._saveProgress();

    const levelName = this.currentLevel ? this.currentLevel.name : 'Dungeon';
    await this.levelClearUI.show(levelName, 0, 0, totalKills, stars);
    this._enterBaseCamp();
  }

  async _showGameOver() {
    const floor = this.currentFloor || 1;
    await this.gameOverUI.show(floor, 0, 0, this.kills);
    // Save progress (keep XP, skill points, lose dungeon progress)
    this._saveProgress();
    this._enterBaseCamp();
  }

  async _handlePlayerDeath() {
    this.audio.gameOver();
    this.renderer.flash('#ff0000', 0.3);

    // Calculate gold penalty (10%)
    const currentGold = this.persistence.getGold();
    const goldLost = Math.floor(currentGold * 0.10);
    this.persistence.spendGold(goldLost);

    // Count stats
    const totalKills = Object.values(this.kills).reduce((a, b) => a + b, 0);
    const roomsCleared = this.dungeonManager ? this.dungeonManager.roomsCleared || 0 : 0;

    // Show death screen
    const floorName = this.floorConfig.getFloor(this.currentFloor)?.name || 'Unknown';
    await this.deathScreen.show(
      this.currentFloor,
      floorName,
      goldLost,
      currentGold - goldLost,
      roomsCleared,
      totalKills
    );

    // Return to camp (floor state is preserved)
    this._saveProgress();
    this._enterBaseCamp();
  }

  // === NPC INTERACTION ===
  async _interactWithNPC(npc) {
    switch (npc.type) {
      case 'trainer':
      case 'skill_vendor':
        await this._openSkillVendor();
        break;
      case 'vendor':
      case 'item_vendor':
        await this._openItemVendor();
        break;
      case 'waystone':
        await this._openWaystone();
        break;
    }
  }

  _openSkillBook() {
    if (!this.skillManager) return;
    if (this._skillBookWindow && this._skillBookWindow.isOpen) {
      this._skillBookWindow.close();
      this._skillBookWindow = null;
      return;
    }

    const win = new GameWindow({ title: 'Skill Book', width: 520, height: 550, x: 100, y: 40, onClose: () => {
      this.player.activeSkills = { leftClick: this.skillManager?.leftSlot, rightClick: this.skillManager?.rightSlot };
      this._skillBookWindow = null;
      this._saveProgress();
    }});
    this._skillBookWindow = win;

    const buildContent = () => {
      const el = document.createElement('div');
      this.skillBookUI.buildInto(el, this.skillManager, this.selectedClass.id, () => buildContent());
      win.setContent(el);
    };
    buildContent();
    win.open();
  }

  async _openSkillVendor() {
    if (!this.skillManager) return;
    this.paused = true;
    await this.skillVendorUI.show(
      this.skillManager,
      this.player,
      (amount) => { this.persistence.spendGold(amount); }, // onSpendGold
      () => { // onRespecPassives
        const refunded = this.skillManager.respecPassives();
        this.player.passivePointsAvailable += refunded;
        this.player.passiveSkills = {};
      },
      () => { // onRespecAttributes
        const totalPoints = Object.values(this.player.attributes).reduce((a, b) => a + b, 0);
        this.player.attributePointsAvailable += totalPoints;
        this.player.attributes = { str: 0, int: 0, agi: 0, sta: 0 };
        this.player.recalcAllStats();
      }
    );
    // Sync after vendor closes
    this.player.learnedSkills = { ...this.skillManager.learnedSkills };
    this.player.activeSkills = { leftClick: this.skillManager.leftSlot, rightClick: this.skillManager.rightSlot };
    // Apply passive effects
    this._applyPassives();
    this._saveProgress();
    this.paused = false;
  }

  _openInventory() {
    if (this._inventoryWindow && this._inventoryWindow.isOpen) {
      this._inventoryWindow.close();
      this._inventoryWindow = null;
      return;
    }

    const win = new GameWindow({ title: 'Inventory', width: 680, height: 560, x: 150, y: 30, onClose: () => {
      this._inventoryWindow = null;
      this._saveProgress();
    }});
    this._inventoryWindow = win;

    const buildContent = () => {
      const el = document.createElement('div');
      this.inventoryUI.buildInto(el, this.player, this.inventory, this.skillManager, {
        atVendor: false,
        onEquip: (item, slot) => {
          const current = this.player.equipment[slot];
          if (current) this.inventory.addItem(current);
          this.inventory.remove(item.id);
          this.player.equipment[slot] = item;
          this.player.recalcAllStats();
          this._applyPassives();
          buildContent();
        },
        onUnequip: (slot) => {
          const item = this.player.equipment[slot];
          if (item && this.inventory.addItem(item)) {
            this.player.equipment[slot] = null;
            this.player.recalcAllStats();
            this._applyPassives();
            buildContent();
          }
        },
        onDrop: (item) => {
          this.inventory.remove(item.id);
          if (this.lootSystem) this.lootSystem.spawnGroundItem(this.player.x, this.player.y, item);
          buildContent();
        },
        onAssignHotbar: (itemId, slot) => {
          this.inventory.assignToHotbar(itemId, slot);
          buildContent();
        },
      });
      win.setContent(el);
    };
    buildContent();
    win.open();
  }

  async _openItemVendor() {
    // Generate vendor stock (6-8 items appropriate to player level)
    const stock = [];
    for (let i = 0; i < 7; i++) {
      const item = this.itemGenerator.generate(this.player.level, this.selectedClass.id, {
        minRarity: 'common',
        rarityBonus: 3,
      });
      if (item) stock.push(item);
    }
    // Add potions to stock
    if (this.potionsData) {
      for (const pt of this.potionsData.potionTypes) {
        if (pt.classRestriction && !pt.classRestriction.includes(this.selectedClass.id)) continue;
        const bracket = this.potionsData.pricingBrackets.find(b => this.player.level >= b.minLevel && this.player.level <= b.maxLevel);
        const price = pt.id.includes('potion') ? (bracket?.hpMana || 10) : (bracket?.tonic || 15);
        stock.push({
          id: `vendor_${pt.id}`,
          baseType: pt.id,
          name: pt.name,
          icon: pt.icon,
          slot: null,
          rarity: 'common',
          iLvl: 1,
          gridW: 1, gridH: 1,
          isConsumable: true,
          isStackable: true,
          maxStack: pt.maxStack,
          stackCount: 1,
          effect: pt.effect,
          cooldownGroup: pt.cooldownGroup,
          cooldown: pt.cooldown,
          sellValue: Math.floor(price / 2),
          buyPrice: price,
          description: pt.description,
        });
      }
    }

    this.paused = true;
    await this.itemVendorUI.show(
      stock,
      this.inventory,
      this.player,
      (item) => { // onBuy
        const price = item.buyPrice || item.sellValue * 2;
        if (this.persistence.spendGold(price)) {
          const buyItem = { ...item, id: `item_${Date.now()}_${Math.random().toString(36).substr(2,5)}` };
          delete buyItem.buyPrice;
          this.inventory.addItem(buyItem);
        }
      },
      (itemId) => { // onSell
        const info = this.inventory.findItemById(itemId);
        if (info) {
          this.persistence.addGold(info.item.sellValue || 1);
          this.inventory.remove(itemId);
        }
      },
      () => { // onSellJunk
        const value = this.inventory.removeAllJunk();
        if (value > 0) this.persistence.addGold(value);
      }
    );
    this._saveProgress();
    this.paused = false;
  }

  _usePotion(slot) {
    if (this.state !== 'PLAYING') return;
    const item = this.inventory.getHotbarItem(slot);
    if (!item || !item.isConsumable) return;

    // Check cooldown
    const cdGroup = item.cooldownGroup || 'shared';
    if ((this.potionCooldowns[cdGroup] || 0) > 0) return;
    if (cdGroup !== 'shared' && (this.potionCooldowns.shared || 0) > 0) return;

    // Check class restriction
    if (item.classRestriction && !item.classRestriction.includes(this.selectedClass.id)) return;

    // Use the potion
    const used = this.inventory.useHotbarItem(slot);
    if (!used) return;

    // Apply effect
    const effect = item.effect || used.effect;
    if (effect) {
      if (effect.type === 'heal_percent' && effect.resource === 'hp') {
        this.player.hp = Math.min(this.player.maxHP, this.player.hp + this.player.maxHP * effect.value);
      } else if (effect.type === 'heal_percent' && effect.resource === 'mana') {
        this.player.gainResource(this.player.maxResource * effect.value);
      } else if (effect.type === 'fill_resource') {
        this.player.resource = this.player.maxResource;
      } else if (effect.type === 'add_resource') {
        this.player.gainResource(effect.value);
      }
    }

    // Start cooldown
    this.potionCooldowns[cdGroup] = item.cooldown || 3;
    if (cdGroup === 'shared') {
      // Shared cooldown also blocks other shared items
    }

    this.audio.shoot(); // placeholder potion sound
    this.hud.updateHP(this.player.hp, this.player.maxHP);
  }

  _applyPassives() {
    if (!this.skillManager) return;
    // Sync passive ranks from skill manager to player
    const passiveRanks = {};
    for (const p of this.skillManager.getPassives()) {
      if (p.currentRank > 0) passiveRanks[p.id] = p.currentRank;
    }
    this.player.passiveSkills = passiveRanks;
    // Recalc stats with passives
    this.player.recalcAllStats();
    this.player.applyPassiveEffects(this.skillManager.passives);
  }

  _updateSkillSlotHUD() {
    if (this.skillManager) {
      const leftInfo = this.skillManager.getLeftSkill();
      const rightInfo = this.skillManager.getRightSkill();
      this.hud.updateSkillSlots(
        leftInfo ? { icon: leftInfo.skill.icon, name: leftInfo.skill.name, resourceCost: leftInfo.skill.resourceCost } : null,
        rightInfo ? { icon: rightInfo.skill.icon, name: rightInfo.skill.name, resourceCost: rightInfo.skill.resourceCost } : null
      );
    }
  }

  _openCharacterPanel() {
    if (this._characterWindow && this._characterWindow.isOpen) {
      this._characterWindow.close();
      this._characterWindow = null;
      return;
    }

    const win = new GameWindow({ title: 'Character', width: 380, height: 520, x: 50, y: 50, onClose: () => { this._characterWindow = null; this._saveProgress(); } });
    this._characterWindow = win;

    const buildContent = () => {
      const el = document.createElement('div');
      this.characterUI.buildInto(el, this.player,
        (attrName) => { // onAllocate
          if (this.player.attributePointsAvailable > 0) {
            this.player.attributes[attrName] = (this.player.attributes[attrName] || 0) + 1;
            this.player.attributePointsAvailable--;
            this.player.recalcAllStats();
            this._applyPassives();
            buildContent(); // rebuild
          }
        },
        (goldCost) => { // onResetAttributes
          if (this.persistence.spendGold(goldCost)) {
            const totalPoints = Object.values(this.player.attributes).reduce((a, b) => a + b, 0);
            this.player.attributePointsAvailable += totalPoints;
            this.player.attributes = { str: 0, int: 0, agi: 0, sta: 0 };
            this.player.recalcAllStats();
            this._applyPassives();
            buildContent(); // rebuild
          }
        }
      );
      win.setContent(el);
    };
    buildContent();
    win.open();
  }

  // _openShop() removed — replaced by itemVendorUI

  async _openWaystone() {
    const floorList = [];
    for (let f = 1; f <= this.floorConfig.getTotalFloors(); f++) {
      const fc = this.floorConfig.getFloor(f);
      floorList.push({
        id: f,
        icon: fc.icon || '',
        name: fc.name || `Floor ${f}`,
        description: fc.description || '',
        floor: f,
        levelReq: fc.playerLevelReq || f,
      });
    }

    this.paused = true;
    const result = await this.waystoneUI.show(floorList, this.player.level, this.persistence);
    this.paused = false;

    if (result.action === 'travel') {
      const fc = this.floorConfig.getFloor(result.floor);
      const reqLevel = fc.playerLevelReq || result.floor;
      if (this.player.level < reqLevel) {
        this.waveAnnouncement = { wave: 0, timer: 2.0, text: `Requires Level ${reqLevel}!` };
        return;
      }
      this.currentFloor = result.floor;
      this.persistence.discoverFloor(result.floor);
      const levelConfig = this.floorConfig.toLevelConfig(result.floor);
      this._startDungeonFloor(levelConfig, result.floor);
    } else if (result.action === 'camp') {
      this._enterBaseCamp();
    }
  }

  // _showFloorPicker removed — now handled by WaystoneUI.show()

  render() {
    const r = this.renderer;

    // Screen shake offset
    let shakeX = 0, shakeY = 0;
    if (this.screenShake > 0) {
      shakeX = (Math.random() - 0.5) * this.screenShake * 20;
      shakeY = (Math.random() - 0.5) * this.screenShake * 20;
    }

    if (this.player) {
      r.updateCamera(this.player);
      r.camera.x += shakeX;
      r.camera.y += shakeY;
    }

    r.clear();
    r.drawMap();

    if (!this.player) return;

    // === BASE CAMP RENDERING ===
    if (this.state === 'BASE_CAMP' && this.campManager) {
      // Campfire
      r.drawCampfire(this.campData.campfire, this.time);

      // NPCs
      r.drawNPCs(this.campManager.npcs, this.campManager.nearestNPC, this.time);

      // Player trail
      r.drawPlayerTrail(this.playerTrail, this.player.color);

      // Player
      r.drawPlayer(this.player);

      // Particles
      r.drawParticles(this.particles.particles);

      // Announcement
      if (this.waveAnnouncement.timer > 0) {
        const text = this.waveAnnouncement.text || '';
        r.drawWaveAnnouncement(text, this.waveAnnouncement.timer);
      }

      r.drawFlash();

      // Full HUD in camp (same as dungeon)
      this.hud.render({ canvasWidth: this.canvas.width, canvasHeight: this.canvas.height });

      // Crosshair handled below (no early return)
    }

    // === DUNGEON / PLAYING RENDERING ===
    const wave = this.waveSystem || this._waveShim;

    if (this.state !== 'BASE_CAMP') {
    // Frost aura
    if (this.player.frostAuraRadius > 0) {
      r.drawFrostAura(this.player, this.player.frostAuraRadius * (this.player.aoeRadiusMult || 1));
    }

    // Soul harvest zone
    if (this.player.soulHarvestActive) {
      r.drawSoulHarvest(this.player.soulHarvestX, this.player.soulHarvestY, this.player.classConfig.uniqueAbility.radius, this.player.color);
    }

    // Meteor warning
    if (this.meteorWarning) {
      r.drawMeteorWarning(this.meteorWarning.x, this.meteorWarning.y, this.meteorWarning.radius, this.meteorWarning.timer);
    }

    // Rain arrows impact
    r.drawRainArrows(this.rainArrows);

    // Fire trails
    r.drawFireTrails(this.fireTrails);

    // Render traps
    if (this.trapManager) {
      const visibleTraps = this.trapManager.getVisibleTraps(
        this.renderer.camera.x, this.renderer.camera.y,
        this.canvas.width, this.canvas.height,
        this.player.x, this.player.y
      );
      for (const t of visibleTraps) {
        const sx = t.x - this.renderer.camera.x;
        const sy = t.y - this.renderer.camera.y;
        const ctx = this.renderer.ctx;
        ctx.save();
        ctx.globalAlpha = t.opacity;
        ctx.fillStyle = t.trapDef?.visual?.color || '#ff0000';
        ctx.beginPath();
        ctx.arc(sx, sy, t.trapDef?.visual?.idleRadius || 16, 0, Math.PI * 2);
        ctx.fill();
        // Pulsing animation for visible traps
        ctx.globalAlpha = t.opacity * 0.3 * (0.5 + 0.5 * Math.sin(performance.now() / 500));
        ctx.beginPath();
        ctx.arc(sx, sy, (t.trapDef?.visual?.idleRadius || 16) * 1.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    // Corpses (necromancer)
    r.drawCorpses(this.corpses);

    // Graviton orbs
    r.drawGravitonOrbs(this.gravitonOrbs);

    // Spectral blades
    if (this.player.bladeCount > 0) {
      r.drawSpectralBlades(this.player, this.time);
    }

    // Enemies
    if (wave) {
      r.drawEnemies(wave.enemies.filter(e => !e.dead));

      // Boss rifts
      if (wave.boss && !wave.boss.dead) {
        const ctx = r.ctx;
        for (const rift of wave.boss.rifts) {
          const sx = rift.x - r.camera.x;
          const sy = rift.y - r.camera.y;
          ctx.globalAlpha = 0.3;
          ctx.fillStyle = '#9b59b6';
          ctx.beginPath();
          ctx.arc(sx, sy, rift.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
        r.drawBoss(wave.boss);
      }
    }

    // Loot on ground
    if (this.lootSystem) {
      r.drawGoldDrops(this.lootSystem.goldDrops);
      r.drawGroundItems(this.lootSystem.groundItems, this.time);
      r.drawBossChest(this.lootSystem.bossChest, this.time);
    }

    // Minions
    r.drawMinions(this.minions);

    // Projectiles
    r.drawProjectiles(this.projectiles, this.player);

    // Player trail
    r.drawPlayerTrail(this.playerTrail, this.player.color);

    // Melee sweep visual
    if (this.meleeSweep) {
      r.drawMeleeSweep(this.meleeSweep, this.player.color);
    }

    // Mage decoy
    if (this.player.decoy) {
      r.drawDecoy(this.player.decoy, this.player);
    }

    // Player
    r.drawPlayer(this.player);

    // Chain lightning
    r.drawChainLightning(this.chainLightnings);

    // Particles
    r.drawParticles(this.particles.particles);

    // Damage numbers
    this.damageNumbers.render(r.ctx, r.camera);

    // Minimap
    if (this.dungeonMode && this.dungeon && this.dungeonManager) {
      r.drawDungeonMinimap(
        this.player,
        this.dungeon,
        this.dungeonManager,
        this.dungeonManager.getActiveEnemies(),
        this.dungeonManager.boss
      );
    } else if (wave) {
      r.drawMinimap(
        this.player,
        wave.enemies.filter(e => !e.dead),
        wave.boss && !wave.boss.dead ? wave.boss : null,
        []
      );
    }

    // Wave announcement banner
    if (this.waveAnnouncement.timer > 0) {
      const announcementText = this.waveAnnouncement.text || ('WAVE ' + this.waveAnnouncement.wave);
      r.drawWaveAnnouncement(announcementText, this.waveAnnouncement.timer);
    }

    // Screen flash overlay
    r.drawFlash();

    } // end if (state !== 'BASE_CAMP') — dungeon rendering

    // Canvas HUD (Diablo 2-style globes and action bar)
    this.hud.render({
      canvasWidth: this.canvas.width,
      canvasHeight: this.canvas.height,
    });

    // Mouse crosshair (ARPG cursor)
    if ((this.state === 'PLAYING' || this.state === 'BASE_CAMP') && this.input.mouseX > 0) {
      const cx = this.input.mouseX;
      const cy = this.input.mouseY;
      const ctx = r.ctx;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1.5;
      const sz = 8;
      ctx.beginPath();
      ctx.moveTo(cx - sz, cy); ctx.lineTo(cx + sz, cy);
      ctx.moveTo(cx, cy - sz); ctx.lineTo(cx, cy + sz);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.beginPath();
      ctx.arc(cx, cy, 12, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Joystick
    r.drawJoystick(this.input);
  }
}
