import { Player } from './entities/player.js';
import { Projectile } from './entities/projectile.js';
import { Enemy } from './entities/enemy.js';
import { Minion } from './entities/minion.js';
import { Pet, PET_DEFS } from './entities/pet.js';
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
import { TrainerUI } from './ui/trainerUI.js';
import { QuickSkillPicker } from './ui/quickSkillPicker.js';
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
import { HelpOverlay } from './ui/helpOverlay.js';

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
      if (panel === 'help') { this.helpOverlay.toggle(); return; }
      if (this.state !== 'PLAYING' && this.state !== 'BASE_CAMP') return;
      if (panel === 'character') this._openCharacterPanel();
      else if (panel === 'skillBook') this._openSkillBook();
      else if (panel === 'inventory') this._openInventory();
    };
    // v3 unified hotbar drop handler. The new HUD calls this with
    // (payload, slotId) where payload = { type: 'attack'|'consumable', id }
    // and slotId is one of 'leftClick','rightClick','slot1'..'slot5'.
    this.hud.onHotbarDrop = (payload, slotId) => {
      if (!this.skillManager || !payload || !slotId) return;
      const ok = this.skillManager.setHotbarSlot(slotId, payload);
      if (ok) this._saveProgress();
    };
    // Click on LMB/RMB → open the in-combat quick skill picker.
    // Keyboard slots are managed via drag-from-inventory.
    this.hud.onSlotClick = (slotId) => {
      if (slotId !== 'leftClick' && slotId !== 'rightClick') return;
      this._openInCombatPicker(slotId);
    };
    // Legacy alias kept so any unsupplied callback path doesn't crash.
    this.hud.onSkillDrop = (skillId, slot) => {
      if (!this.skillManager) return;
      const slotId = slot === 'left' ? 'leftClick' : slot === 'right' ? 'rightClick' : slot;
      this.skillManager.setHotbarSlot(slotId, { type: 'attack', id: skillId });
      this._saveProgress();
    };
    this.gameOverUI = new GameOverUI();
    this.audio = new AudioSystem();
    this.damageNumbers = new DamageNumbers();
    // WorldMap removed (replaced by waystone travel)
    this.levelClearUI = new LevelClearUI();
    this.classPicker = new ClassPicker();
    // SkillTreeUI + SkillVendorUI removed (replaced by skillBookUI + trainerUI)
    this.persistence = new Persistence();
    this.waystoneUI = new WaystoneUI();
    // ShopUI removed (replaced by itemVendorUI)
    this.skillBookUI = new SkillBookUI();
    this.trainerUI = new TrainerUI();
    this.quickSkillPicker = new QuickSkillPicker();
    this.helpOverlay = new HelpOverlay();
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
    // v3 spec-tree pets (Beastmaster + Bone Lord). Distinct from `minions`
    // (which is the legacy blessing-summoned minion array). Pets are
    // persistent across waves but cleared on floor transitions UNLESS
    // they're flagged as `permanent` (capstone-summoned).
    this.pets = [];
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
    this._noWeaponMsgTimer = 0;

    // Active hold-channel state. null when no channel is running. Shape:
    //   { slotId, attackId, attack, costPerSecond, tickInterval, tickTimer }
    // The dispatch loop ticks this each frame; the channel ends when the
    // bound input is released, the player runs out of resource, the slot
    // gets rebound, or the player dies.
    this._channelState = null;

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

    // Active game-time buffs (pause-aware; replaces setTimeout-based buffs)
    this._activeBuffs = [];

    this._campTutorialShown = false;
    this._combatHintsShown = { lmb: false, resource: false };
    this._saveIndicatorTimer = 0;
  }

  togglePause() {
    if (this.state === 'MENU' || this.state === 'GAME_OVER') return;
    this.paused = !this.paused;
    const overlay = document.getElementById('pause-overlay');
    if (overlay) {
      overlay.classList.toggle('hidden', !this.paused);
    }
  }

  async start(presetClassId = null) {
    document.getElementById('menu-screen').classList.add('hidden');

    // Use preset class (Continue) or show class picker (New Game)
    if (presetClassId && this.classesData[presetClassId]) {
      this.selectedClass = this.classesData[presetClassId];
    } else {
      this.selectedClass = await this.classPicker.show(this.classesData);
    }

    // Create player with chosen class
    this.player = new Player(MAP_WIDTH / 2, MAP_HEIGHT / 2, this.selectedClass);

    // Load persisted progress (character + equipment)
    const progress = this.persistence.getCharacter();
    const savedEquipment = this.persistence.getEquipment();
    this.player.loadFromSave({ ...progress, equipment: savedEquipment });
    this.gold = this.persistence.getGold();
    // Restore last visited floor (so waystone UI shows correct in-progress state)
    if (progress && progress.currentFloor) {
      this.currentFloor = progress.currentFloor;
    }

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

    // === Equipment / class validation ===
    // After loading equipment from save, walk every slot and unequip any
    // item whose `classReq` doesn't include the current class. This catches
    // the cross-class scenario where a player equipped a bow as Archer,
    // then started a new Warrior — equipment is persisted independently of
    // class so the bow would otherwise get carried over.
    //
    // Removed items go back to the inventory grid if there's space; if the
    // grid is full they're dropped at the player's feet (proximity pickup
    // will eventually grab them, or the player can sell them).
    this._unequipInvalidGear();

    // Give starter gear if no main hand weapon (new character, broken save,
    // or first load after the validation pass above stripped the wrong weapon)
    if (!this.player.equipment.mainHand) {
      this._giveStarterGear(this.selectedClass.id);
    }

    // Initialize skill manager (v3 spec-tree system).
    // Player owns the authoritative skill state (skillTree, hotbar,
    // skillPointsAvailable, freeRespecUsed) — already loaded via
    // player.loadFromSave above. The manager is constructed against that
    // state and just provides resolution / cooldown management.
    if (this.skillsData) {
      this.skillManager = new SkillManager(
        this.skillsData,
        this.selectedClass.id,
        this.player,
        {
          potionsData: this.potionsData,
          // Inventory gate: refuse to cast a consumable whose stack is 0.
          // The manager calls this from canCast() before starting any
          // cooldown, so the player isn't punished for clicking an empty slot.
          consumableValidator: (id) => this._getConsumableStack(id) > 0,
        }
      );
      // Wire the back-reference so player.recalcAllStats() can pull the
      // resolved player_stat bag from the manager.
      this.player.skillManager = this.skillManager;
      // Initial recalc — folds tree-derived stats into the player.
      this.player.onProgressionChanged();

      // Restore pets from save snapshot (if any). Must run AFTER skill
      // manager is built so we can re-derive pet mods from the current
      // tree state.
      if (progress && progress.pets) {
        this._restorePetsFromSave(progress.pets);
      }
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

  _enterBaseCamp(preserveDungeon = false) {
    this.state = 'BASE_CAMP';
    this.hud.setVisible(true);
    this.dungeonMode = false;

    // Reset per-fight capstones on entering camp
    if (this.player) {
      this.player._aegisUsedThisFight = false;
      this.player._aegisActiveTimer = 0;
      this.player._aegisReflectAmount = 0;
    }
    this._phoenixCooldownUntil = 0;

    if (preserveDungeon) {
      // Stash dungeon state for return-via-portal
      this._savedDungeonState = {
        dungeon: this.dungeon,
        dungeonManager: this.dungeonManager,
        layoutManager: this.layoutManager,
        currentFloor: this.currentFloor,
        playerX: this.player.x,
        playerY: this.player.y,
        renderTheme: { ...this.currentLevel },
        mapWidth: this.renderer.mapWidth,
        mapHeight: this.renderer.mapHeight,
        projectiles: this.projectiles,
        minions: this.minions,
        corpses: this.corpses,
        fireTrails: this.fireTrails,
        trapManager: this.trapManager,
      };
    } else {
      // Normal entry: clear all dungeon state
      this._savedDungeonState = null;
      this.waveSystem = null;
      this._waveShim = null;
      this.dungeonManager = null;
      this.dungeon = null;
      this.projectiles = [];
      this.minions = [];
      // Pets: keep permanent ones (capstones), drop the rest
      this.pets = (this.pets || []).filter(p => p.permanent && !p.dead);
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
    }

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
    if (this.skillManager) this._updateSkillSlotHUD();
    this.waveAnnouncement = { wave: 0, timer: 2.0, text: preserveDungeon ? 'Teleported to Camp' : 'Base Camp' };

    // First-time camp tutorial
    if (!this.persistence.data.tutorialComplete && !this._campTutorialShown) {
      this._campTutorialShown = true;
      this._showCampTutorial();
    }
  }

  _showCampTutorial() {
    const hints = [
      { title: 'Welcome to the Base Camp', body: 'Your sanctuary between dungeon runs. Heal at the campfire, train skills, buy gear, and travel to dungeons.' },
      { title: 'Enter the Dungeon', body: 'Walk to the <b style="color:#5dade2">Way Stone</b> in the center and press <b>E</b> to choose a floor.' },
      { title: 'Visit the NPCs', body: 'The <b style="color:#e67e22">Trainer</b> teaches skills. The <b style="color:#27ae60">Vendor</b> sells gear and potions. Both accept the <b>E</b> key when you walk close.' },
    ];
    let idx = 0;
    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position: 'fixed', top: '0', left: '0', right: '0', bottom: '0',
      background: 'rgba(0,0,0,0.6)', zIndex: '99998',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: '"Segoe UI", Arial, sans-serif',
    });
    const card = document.createElement('div');
    Object.assign(card.style, {
      width: '480px',
      background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)',
      border: '2px solid #c9a84c',
      borderRadius: '8px',
      boxShadow: '0 0 40px rgba(201,168,76,0.3)',
      padding: '24px 28px',
      color: '#e8d3a8',
    });
    const titleEl = document.createElement('div');
    Object.assign(titleEl.style, { color: '#c9a84c', fontSize: '20px', fontWeight: 'bold', marginBottom: '12px', letterSpacing: '1px' });
    const bodyEl = document.createElement('div');
    Object.assign(bodyEl.style, { fontSize: '14px', lineHeight: '1.6', marginBottom: '20px' });
    const counterEl = document.createElement('div');
    Object.assign(counterEl.style, { fontSize: '11px', color: '#a89c80', marginBottom: '12px' });
    const btnRow = document.createElement('div');
    Object.assign(btnRow.style, { display: 'flex', justifyContent: 'space-between', gap: '12px' });

    const skipBtn = document.createElement('button');
    skipBtn.textContent = 'Skip Tutorial';
    Object.assign(skipBtn.style, { background: 'transparent', border: '1px solid #555', color: '#888', padding: '8px 16px', cursor: 'pointer', borderRadius: '4px', fontFamily: 'inherit', fontSize: '12px' });

    const nextBtn = document.createElement('button');
    Object.assign(nextBtn.style, { background: 'rgba(201,168,76,0.15)', border: '1px solid #c9a84c', color: '#c9a84c', padding: '8px 20px', cursor: 'pointer', borderRadius: '4px', fontFamily: 'inherit', fontSize: '13px', fontWeight: 'bold' });

    const finish = () => {
      this.persistence.data.tutorialComplete = true;
      this.persistence.save();
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    };
    skipBtn.addEventListener('click', finish);
    nextBtn.addEventListener('click', () => {
      idx++;
      if (idx >= hints.length) { finish(); return; }
      render();
    });

    const render = () => {
      const h = hints[idx];
      titleEl.textContent = h.title;
      bodyEl.innerHTML = h.body;
      counterEl.textContent = `${idx + 1} / ${hints.length}`;
      nextBtn.textContent = idx === hints.length - 1 ? 'Got it!' : 'Next';
    };

    btnRow.appendChild(skipBtn);
    btnRow.appendChild(nextBtn);
    card.appendChild(titleEl);
    card.appendChild(bodyEl);
    card.appendChild(counterEl);
    card.appendChild(btnRow);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    render();
  }

  _saveProgress() {
    // Snapshot pets so non-permanent ones survive a save/reload during
    // a dungeon run. Permanent capstone pets respawn lazily via the
    // _updatePets capstone check, but non-permanent ones would otherwise
    // be lost. Mods are NOT serialized — they're re-derived from the
    // current tree on load.
    const petSnapshot = (this.pets || []).map(p => ({
      petId: p.petId,
      x: p.x, y: p.y,
      hpFrac: p.hp / p.maxHP,
      permanent: !!p.permanent,
      explodeOnDeath: !!p.explodeOnDeath,
    }));

    this.persistence.saveCharacter({
      class: this.selectedClass?.id,
      level: this.player.level,
      xp: this.player.xp,
      xpToNext: this.player.xpToNext,
      attributes: { ...this.player.attributes },
      attributePointsAvailable: this.player.attributePointsAvailable,
      gold: this.persistence.getGold(),
      // v3 spec-tree skill state — authoritative on the player
      hotbar: JSON.parse(JSON.stringify(this.player.hotbar || {})),
      skillTree: JSON.parse(JSON.stringify(this.player.skillTree || {})),
      skillPointsAvailable: this.player.skillPointsAvailable || 0,
      freeRespecUsed: !!this.player.freeRespecUsed,
      pets: petSnapshot,
      currentFloor: this.currentFloor || 1,
    });
    this.persistence.saveEquipment(JSON.parse(JSON.stringify(this.player.equipment)));
    this.persistence.saveInventory(this.inventory.toSaveData());
    this.persistence.save();
    this._saveIndicatorTimer = 1.8; // 1.8s of "Saved" toast
  }

  /**
   * Restore pets from a save snapshot. Called by the post-load init path.
   * Pet stats are re-derived from the current tree state at load time —
   * if the player respec'd between saves, the pets pick up the new mods
   * automatically.
   */
  _restorePetsFromSave(snapshot) {
    if (!snapshot || !Array.isArray(snapshot) || snapshot.length === 0) return;
    if (!this.skillManager) return;
    const petMods = this.skillManager.getPetMods();
    this.pets = [];
    for (const ps of snapshot) {
      const mods = petMods[ps.petId] || {};
      const pet = new Pet(
        ps.petId,
        ps.x || this.player.x,
        ps.y || this.player.y,
        this.player,
        mods,
        { permanent: !!ps.permanent }
      );
      // Restore the saved HP fraction
      if (typeof ps.hpFrac === 'number') {
        pet.hp = Math.max(1, Math.round(pet.maxHP * ps.hpFrac));
      }
      if (ps.explodeOnDeath) pet.explodeOnDeath = true;
      pet.spawnTimer = 0;
      pet.scale = 1;
      this.pets.push(pet);
    }
  }

  startLevel(levelConfig) {
    this.currentLevel = levelConfig;
    this.dungeonMode = true; // All levels are now dungeon mode
    this.currentFloor = 1;

    this._startDungeonFloor(levelConfig, this.currentFloor);
  }

  _startDungeonFloor(levelConfig, floor) {
    this.persistence.discoverFloor(floor);
    this.dungeonMode = true; // Always in dungeon mode when starting a floor

    // Reset per-fight capstones (Aegis "once per fight")
    if (this.player) {
      this.player._aegisUsedThisFight = false;
      this.player._aegisActiveTimer = 0;
      this.player._aegisReflectAmount = 0;
    }
    this._phoenixCooldownUntil = 0;
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
    // Pets: drop transient pets, keep permanent (capstones). Permanents
    // also follow the player to the new floor's entrance position.
    this.pets = (this.pets || []).filter(p => p.permanent && !p.dead);
    for (const p of this.pets) {
      p.x = this.player.x + (Math.random() - 0.5) * 60;
      p.y = this.player.y + (Math.random() - 0.5) * 60;
      p.hp = p.maxHP; // full heal on floor change
    }
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

    // First-time combat hints
    if (!this.persistence.data.combatTutorialComplete && !this._combatHintsShown.lmb) {
      setTimeout(() => {
        if (this.state === 'PLAYING' && !this._combatHintsShown.lmb) {
          this._combatHintsShown.lmb = true;
          this.waveAnnouncement = { wave: 0, timer: 4.0, text: 'Hold LMB to attack' };
        }
      }, 2000);
    }
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

    // F1 — toggle help overlay
    if (this.input.consumeHelp()) {
      this.helpOverlay.toggle();
    }

    if (this._saveIndicatorTimer > 0) this._saveIndicatorTimer -= dt;

    // === BASE_CAMP UPDATE ===
    if (this.state === 'BASE_CAMP') {
      const player = this.player;
      const mapW = this.campData.mapWidth;
      const mapH = this.campData.mapHeight;

      const playerPrevX = player.x;
      const playerPrevY = player.y;
      player.update(dt, this.input.moveVector, mapW, mapH);

      // Aim toward mouse in camp (so character faces cursor)
      const campMouseX = this.input.mouseX + this.renderer.camera.x;
      const campMouseY = this.input.mouseY + this.renderer.camera.y;
      player.aimAngle = Math.atan2(campMouseY - player.y, campMouseX - player.x);

      // Clamp to camp layout
      if (this.layoutManager) {
        const clamped = this.layoutManager.clampPosition(player.x, player.y, player.radius, playerPrevX, playerPrevY);
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

      // Return portal proximity (after teleport scroll)
      this._nearReturnPortal = false;
      if (this._returnPortalPos && this._teleportPortal) {
        const rdx = player.x - this._returnPortalPos.x;
        const rdy = player.y - this._returnPortalPos.y;
        if (Math.sqrt(rdx * rdx + rdy * rdy) < 50) {
          this._nearReturnPortal = true;
          if (this.input.consumeInteract()) {
            this._returnFromTeleportPortal();
            return;
          }
        }
      }

      // NPC interaction
      if (nearestNPC && this.input.consumeInteract()) {
        this._interactWithNPC(nearestNPC);
      }

      // Campfire auto-heal (proximity-based)
      const cf = this.campData.campfire;
      if (cf) {
        const cdx = player.x - cf.x;
        const cdy = player.y - cf.y;
        const cDist = Math.sqrt(cdx * cdx + cdy * cdy);
        const healRadius = cf.healRadius || 80;
        if (cDist < healRadius) {
          // Heal HP and resource over time near campfire
          const healRate = player.maxHP * 0.5; // 50% max HP per second
          if (player.hp < player.maxHP) {
            player.hp = Math.min(player.maxHP, player.hp + healRate * dt);
            // Sparkle particles
            if (Math.random() < 0.4) {
              this.particles.emit(
                player.x + (Math.random() - 0.5) * player.radius * 2,
                player.y + (Math.random() - 0.5) * player.radius * 2,
                1, '#f1c40f', { speed: 30, life: 0.6 }
              );
            }
          }
          if (player.resource < player.maxResource) {
            player.resource = Math.min(player.maxResource, player.resource + player.maxResource * 0.5 * dt);
          }
        }
      }

      // Update HUD state in camp (same data as dungeon)
      this.hud.updateHP(player.hp, player.maxHP);
      this.hud.updateResource(player.resource, player.maxResource, player.resourceColor, player.resourceName);
      this.hud.updateGold(this.persistence.getGold());
      this.hud.updateXP(player.xp, player.xpToNext, player.level);
      this.hud.updateLevelName('Base Camp');
      // Skill slot icons (LMB/RMB) — must be refreshed in camp too,
      // otherwise the slots are blank until the player enters a dungeon.
      this._updateSkillSlotHUD();

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
        this.audio.doorUnlock();
      }

      // Dungeon waystone interaction
      this._nearWaystone = false;
      if (this.dungeon) {
        const entrance = this.dungeon.rooms.find(r => r.id === this.dungeon.entranceRoomId);
        if (entrance && entrance.waystone) {
          const wdx = player.x - entrance.waystone.x;
          const wdy = player.y - entrance.waystone.y;
          if (Math.sqrt(wdx * wdx + wdy * wdy) < 50) {
            this._nearWaystone = true;
            if (this.input.consumeInteract()) {
              this._openWaystone();
              return;
            }
          }
        }
      }

      // Check stairs
      this._nearStairs = this.dungeonManager && this.dungeonManager.isPlayerNearStairs
        ? this.dungeonManager.isPlayerNearStairs(player.x, player.y)
        : false;
      if (this._nearStairs && this.input.consumeInteract()) {
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

    // Action bar keys 1–5 are handled inside the combat dispatch loop
    // (in update()) so they have access to nearestEnemy. We don't consume
    // them here.

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
            this.inventory.addItem(item);
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

    // Update skill cooldowns (v3 manager API)
    if (this.skillManager) {
      this.skillManager.tickCooldowns(dt);
    }

    // Player movement (runs regardless of wave state)
    const playerPrevX = player.x;
    const playerPrevY = player.y;
    player.update(dt, this.input.moveVector, mapW, mapH);

    // Layout-aware clamping for player
    if (this.layoutManager) {
      const clamped = this.layoutManager.clampPosition(player.x, player.y, player.radius, playerPrevX, playerPrevY);
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

    // Player <-> enemy collision (push out of overlapping mobs).
    // Skipped while dashing so the dash isn't visually halted on contact.
    if (!player.isDashing) {
      const enemyList = (this.waveSystem || this._waveShim)?.enemies;
      if (enemyList && enemyList.length > 0) {
        for (const e of enemyList) {
          if (!e || e.dead) continue;
          const dx = player.x - e.x;
          const dy = player.y - e.y;
          const minDist = (player.radius || 14) + (e.radius || 14);
          const distSq = dx * dx + dy * dy;
          if (distSq < minDist * minDist && distSq > 0.0001) {
            const dist = Math.sqrt(distSq);
            const overlap = minDist - dist;
            const nx = dx / dist;
            const ny = dy / dist;
            // Player takes 70% of the push, enemy 30% — feels solid without
            // letting the player shove tanks across the room.
            player.x += nx * overlap * 0.7;
            player.y += ny * overlap * 0.7;
            e.x      -= nx * overlap * 0.3;
            e.y      -= ny * overlap * 0.3;
          }
        }
        // Re-clamp player after pushback so collision can't shove them through walls.
        if (this.layoutManager) {
          const c2 = this.layoutManager.clampPosition(player.x, player.y, player.radius, playerPrevX, playerPrevY);
          player.x = c2.x;
          player.y = c2.y;
        }
      }
      // Also collide with the boss if present
      const boss = this.dungeonManager?.boss || this.waveSystem?.boss;
      if (boss && !boss.dead) {
        const dx = player.x - boss.x;
        const dy = player.y - boss.y;
        const minDist = (player.radius || 14) + (boss.radius || 30);
        const distSq = dx * dx + dy * dy;
        if (distSq < minDist * minDist && distSq > 0.0001) {
          const dist = Math.sqrt(distSq);
          const overlap = minDist - dist;
          // Boss is heavy — player gets pushed out fully.
          player.x += (dx / dist) * overlap;
          player.y += (dy / dist) * overlap;
          if (this.layoutManager) {
            const c3 = this.layoutManager.clampPosition(player.x, player.y, player.radius, playerPrevX, playerPrevY);
            player.x = c3.x;
            player.y = c3.y;
          }
        }
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
    if (this._noWeaponMsgTimer > 0) this._noWeaponMsgTimer -= dt;

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

    // === v3 SLOT-BASED COMBAT (LMB / RMB / 1–5) ===
    //
    // Slot semantics:
    //   - leftHold / rightHold tracks whether the mouse button is currently down
    //   - One-shot attacks fire on hold (LMB) or single press (RMB)
    //   - HOLD-CHANNEL attacks (e.g. Whirlwind) start on first frame held,
    //     tick every frame while held, end when the button is released or
    //     resource runs out. Cooldown starts on release.
    //
    // _channelState tracks an active channel; if set, we tick it instead of
    // running through canCast/castSlot which would charge cooldown again.

    // Tick the active channel if one is running
    if (this._channelState) {
      const heldNow = this._isChannelInputHeld(this._channelState.slotId);
      if (heldNow) {
        this._tickChannel(dt, nearestEnemy);
      } else {
        this._endChannel();
      }
    }

    // LMB: held to repeat. Skip if a channel is already active so the same
    // input isn't read twice.
    if (!this._channelState && this.input.leftHold && this.skillManager) {
      this._tryFireSlot('leftClick', nearestEnemy, nearestDist);
    }

    // RMB: hold-channel attacks need every-frame "is held?" detection, NOT
    // single-press. We check rightHold first; if the bound attack is a
    // hold-channel and the button just became held, start the channel.
    // Otherwise fall back to single-press semantics.
    if (!this._channelState && this.input.rightHold && this.skillManager) {
      const binding = this.skillManager.getSlotBinding('rightClick');
      if (binding && binding.type === 'attack') {
        const resolved = this.skillManager.getResolvedAttack(binding.id);
        if (resolved && resolved.holdChannel) {
          // Hold-channel: start it. _beginChannel handles canCast checks.
          this._beginChannel('rightClick', nearestEnemy, nearestDist);
          // Drain the rightClick consume so the single-press path below
          // doesn't ALSO fire it.
          if (this.input.consumeRightClick) this.input.consumeRightClick();
        }
      }
    }
    // RMB single-press fallback for non-channel attacks
    if (!this._channelState && this.input.consumeRightClick && this.input.consumeRightClick() && this.skillManager) {
      this._tryFireSlot('rightClick', nearestEnemy, nearestDist);
    }

    // Keyboard slots 1–5: tap-to-fire via Input.consumeHotbar(i).
    // Single-press semantics — holding the key does NOT auto-repeat.
    if (this.skillManager && this.input) {
      for (let i = 0; i < 5; i++) {
        if (this.input.consumeHotbar(i)) {
          this._tryFireSlot('slot' + (i + 1), nearestEnemy, nearestDist);
        }
      }
    }

    // Update enemies
    if (this.state === 'PLAYING') {
      for (const e of wave.enemies) {
        if (e.dead) continue;

        const ePrevX = e.x;
        const ePrevY = e.y;

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

        // Wall collision for enemies
        if (this.layoutManager && this.layoutManager.rooms.length > 0) {
          // Tunneling check for fast-moving enemies
          const moveDist = Math.sqrt((e.x - ePrevX) ** 2 + (e.y - ePrevY) ** 2);
          if (moveDist > 32) {
            const steps = Math.ceil(moveDist / 32);
            for (let s = 1; s < steps; s++) {
              const t = s / steps;
              const mx = ePrevX + (e.x - ePrevX) * t;
              const my = ePrevY + (e.y - ePrevY) * t;
              if (!this.layoutManager.isWalkable(mx, my)) {
                e.x = ePrevX;
                e.y = ePrevY;
                break;
              }
            }
          }
          const clamped = this.layoutManager.clampPosition(e.x, e.y, e.radius, ePrevX, ePrevY);
          e.x = clamped.x;
          e.y = clamped.y;
        } else if (this.layoutManager) {
          const clamped = this.layoutManager.clampPosition(e.x, e.y, e.radius, ePrevX, ePrevY);
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

      // Tile-based wall collision (dungeon walls) — only after projectile has moved away from spawn
      if (!p.dead && this.layoutManager && this.layoutManager.rooms.length > 0) {
        // Skip check if projectile just spawned (within 1 frame of spawn)
        const distFromOrigin = Math.sqrt((p.x - oldX) ** 2 + (p.y - oldY) ** 2);
        if (distFromOrigin > 0 && !this.layoutManager.isWalkable(p.x, p.y)) {
          // Double-check by also testing the previous position — only kill if both are unwalkable
          if (!this.layoutManager.isWalkable(oldX, oldY)) {
            // Both old and new are unwalkable — projectile spawned in wall, ignore
          } else {
            p.dead = true;
          }
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

    // === DoT + status ticks on enemies ===
    // Two systems run side-by-side:
    //   - Legacy blessing DoTs (_burnTimer / _poisonTimer) for the
    //     blessing/passive paths that haven't been migrated yet
    //   - v3 spec-tree status manager (e.statuses) that handles all
    //     attack-applied burning/bleeding/plagued/frozen
    //
    // Both paths route damage through e.takeDamage so death + onKill
    // triggers fire correctly.
    for (const e of wave.enemies) {
      if (e.dead) continue;

      // --- Legacy blessing DoTs (burning from blessings) ---
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

      // v3 pet hawk mark tick
      if (e._petMarkTimer && e._petMarkTimer > 0) {
        e._petMarkTimer -= dt;
        if (e._petMarkTimer <= 0) e._petMarkBonus = 0;
      }
      // v3 pet bear taunt tick — enemy AI checks _tauntTarget to override its
      // movement target. Currently no override is wired into enemy.update(),
      // so taunt is more of a visual hint right now. Phase 8 polish.
      if (e._tauntTimer && e._tauntTimer > 0) {
        e._tauntTimer -= dt;
        if (e._tauntTimer <= 0) e._tauntTarget = null;
      }

      // --- v3 spec-tree status ticks ---
      if (e.tickStatuses && e.statuses) {
        const ticks = e.tickStatuses(dt);
        for (const t of ticks) {
          const killed = e.takeDamage(t.damage);
          this.damageNumbers.spawn(e.x, e.y - e.radius, t.damage, false, this._statusColor(t.status));
          if (killed) {
            // Status-conditional kill triggers fire from _onEnemyDeath itself
            // (single source of truth) — see _onEnemyDeath for the dispatch.
            this._onEnemyDeath(e);
          } else {
            // Status spread (Wildfire, Contagion): on every tick, the
            // status has a per-tick chance to jump to a nearby uninfected
            // enemy. Spread radius is generous (180px) so it feels lively.
            const status = e.statuses[t.status];
            if (status && status.spreadChancePerTick > 0 && Math.random() < status.spreadChancePerTick) {
              this._spreadStatus(e, t.status, status, wave);
            }
          }
        }
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

    // Update minions (Necromancer blessing-summoned)
    this._updateMinions(dt, wave, mapW, mapH);

    // Update v3 spec-tree pets (Beastmaster + Bone Lord)
    this._updatePets(dt, wave, mapW, mapH);

    // Update v3 status clouds (Outbreak lingering plague, etc.)
    this._updateStatusClouds(dt);

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
        // Trap audio
        this.audio.trapTrigger(t.trap.type);
        if (result.damage > 0) {
          this.player.takeDamage(result.damage, 0, { environmental: true });
          this.damageNumbers.spawn(player.x, player.y - player.radius, Math.round(result.damage), false);
          this.audio.playerHit();
        }
        // Screen shake on explosive traps
        if (t.trap.type === 'explosive') {
          this.screenShake = Math.max(this.screenShake || 0, 0.4);
        }
        if (result.status) {
          const totalSta = (this.player.baseAttributes?.sta || 0) + (this.player.attributes?.sta || 0);
          this.statusEffects.apply(result.status.type, result.status.duration, result.status.magnitude || 1, 'trap', totalSta);
          this.audio.statusApplied(result.status.type);
        }
        if (result.knockback) {
          // Push player away from trap
          const dx = player.x - t.trap.x;
          const dy = player.y - t.trap.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          player.x += (dx / dist) * result.knockback;
          player.y += (dy / dist) * result.knockback;
        }
        this.particles.emit(t.trap.x, t.trap.y, 8, t.trap.trapDef?.visual?.color || '#ff0000', { speed: 80, life: 0.4 });
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
          this.audio.goldPickup();
        },
        (item) => {
          if (!this.inventory || this.inventory.isFull()) return false;
          this.inventory.addItem(item);
          this.audio.itemPickup();
          this.waveAnnouncement = { wave: 0, timer: 1.0, text: `${item.name}` };
          return true;
        }
      );
    }

    // HUD
    this.hud.updateHP(player.hp, player.maxHP);
    this.hud.updateResource(player.resource, player.maxResource, player.resourceColor, player.resourceName);
    this.hud.updateGold(this.persistence.getGold());

    // v3 unified hotbar HUD update — populates all 7 slots (LMB/RMB + 1–5)
    // from the skillManager + player.hotbar. This replaces both the legacy
    // setHotbar() potion-row update and the leftSlot/rightSlot cooldown
    // setter — they're all handled by setSlots() inside _updateSkillSlotHUD.
    if (this.skillManager) {
      this._updateSkillSlotHUD();
    }

    // Pet count summary for HUD info panel
    if (this.hud && this.hud.setPetSummary) {
      if (this.pets && this.pets.length > 0) {
        const counts = {};
        for (const p of this.pets) {
          if (p.dead) continue;
          if (!counts[p.petId]) counts[p.petId] = { petId: p.petId, icon: p.icon, count: 0 };
          counts[p.petId].count++;
        }
        this.hud.setPetSummary(Object.values(counts));
      } else {
        this.hud.setPetSummary([]);
      }
    }

    // Potion cooldowns
    for (const key of Object.keys(this.potionCooldowns)) {
      if (this.potionCooldowns[key] > 0) this.potionCooldowns[key] -= dt;
    }

    // Buff timers (game-time)
    if (this._activeBuffs && this._activeBuffs.length > 0) {
      for (let i = this._activeBuffs.length - 1; i >= 0; i--) {
        this._activeBuffs[i].remaining -= dt;
        if (this._activeBuffs[i].remaining <= 0) {
          if (this._activeBuffs[i].remove) this._activeBuffs[i].remove();
          this._activeBuffs.splice(i, 1);
        }
      }
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

          // v3 spec-tree hit-time damage modifiers (Dead Eye vs full-HP, etc.)
          // Note: vsHighHP must be checked BEFORE the damage is applied so the
          // enemy's HP percent reflects pre-hit state, which is what Dead Eye
          // is supposed to gate on.
          hitDmg = this._modifyDamageOnHit(hitDmg, e, p.sourceAttackId || null);

          // Pet hawk mark: target takes +X% damage from any source while marked
          if (e._petMarkTimer && e._petMarkTimer > 0 && e._petMarkBonus) {
            hitDmg = hitDmg * (1 + e._petMarkBonus);
          }

          const killed = e.takeDamage(hitDmg);
          p.hitEnemies.add(e);
          this.damageNumbers.spawn(e.x, e.y - e.radius, hitDmg, hitDmg > player.damage);

          // v3: apply attack-driven status (Flame Bolt → burning, Plague
          // Bolt → plagued, Aimed Shot+Hemorrhage → bleeding, Frost Shard
          // → slowed, Frost Nova → frozen)
          if (p.statusApply && !killed) {
            this._applyStatusFromAttack({ statusApply: p.statusApply }, e);
          }

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

  // === v3 PET MANAGEMENT (Beastmaster + Bone Lord) ===
  _updatePets(dt, wave, mapW, mapH) {
    // Capstone-summoned permanent pets: spawn lazily if the player has the
    // capstone but no instance of the matching pet alive. These survive
    // respec/load/floor changes, so this check effectively reasserts them
    // every frame until the pet exists.
    if (this.skillManager) {
      if (this.skillManager.hasCapstone('beastmaster_spirit_wolf')) {
        const hasWolf = this.pets.some(p => p.petId === 'spirit_wolf' && !p.dead);
        if (!hasWolf) {
          const sw = new Pet('spirit_wolf',
            this.player.x + 30, this.player.y,
            this.player, {}, { permanent: true });
          this.pets.push(sw);
          this.waveAnnouncement = { wave: 0, timer: 1.5, text: '★ SPIRIT WOLF ★' };
        }
      }
      if (this.skillManager.hasCapstone('bone_lord_lich_lord')) {
        const hasGolem = this.pets.some(p => p.petId === 'bone_golem' && !p.dead);
        if (!hasGolem) {
          // Lich Lord also boosts all undead pet stats by 50% — apply via mods
          const mods = { hpPct: 0.5, damagePct: 0.5 };
          const golem = new Pet('bone_golem',
            this.player.x + 30, this.player.y,
            this.player, mods, { permanent: true });
          this.pets.push(golem);
          this.waveAnnouncement = { wave: 0, timer: 1.5, text: '★ LICH LORD ★' };
        }
      }
    }

    if (!this.pets || this.pets.length === 0) return;
    for (let i = this.pets.length - 1; i >= 0; i--) {
      const pet = this.pets[i];
      const result = pet.update(dt, wave.enemies, wave.boss, mapW, mapH);

      // Ranged pet wants to fire a projectile this frame
      if (pet.pendingProjectile) {
        const pp = pet.pendingProjectile;
        const dx = pp.targetX - pp.startX;
        const dy = pp.targetY - pp.startY;
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const speed = 380;
        const proj = new Projectile(
          pp.startX, pp.startY,
          (dx / dist) * speed, (dy / dist) * speed,
          pp.damage
        );
        proj.radius = 5;
        proj.fromPet = pet;
        this.projectiles.push(proj);
        pet.pendingProjectile = null;
      }

      // Damage feedback + death event for melee/tank hits
      if (result && result.killed) {
        this._onEnemyDeath(result.enemy);
      }
      if (result && result.damage > 0) {
        this.damageNumbers.spawn(result.enemy.x, result.enemy.y - result.enemy.radius, result.damage, false);
        // Owner lifesteal from pet damage
        if (pet.ownerLifestealPct > 0) {
          const heal = result.damage * pet.ownerLifestealPct;
          this.player.hp = Math.min(this.player.maxHP, this.player.hp + heal);
        }
      }

      if (pet.dead) {
        // onPetDeath trigger (Wild Heart)
        this._fireCombatEvent('onPetDeath', { pet });
        // Wild Heart node: explode for AoE damage on death
        if (pet.explodeOnDeath) {
          const explDmg = pet.damage * 1.5;
          this._explosion(pet.x, pet.y, 80, explDmg, null);
          if (this.particles) {
            for (let k = 0; k < 12; k++) {
              this.particles.emit(pet.x, pet.y, 1, pet.color, { speed: 200, life: 0.5, size: 4 });
            }
          }
        }
        this.particles.deathBurst(pet.x, pet.y, pet.color);
        this.pets.splice(i, 1);
      }
    }
  }

  /**
   * Spawn the next available pet of a class. Caller is one of the bridge
   * paths that handle Call Beast (Archer) or Raise Dead (Necromancer).
   * Returns the new Pet, or null if at max count for every unlocked type.
   *
   * `priorityList` is the order pets are tried (e.g. for Bone Lord:
   *   [skeleton, zombie] — skeletons first since they're lower-tier).
   *
   * If at max count, returns the special string 'at_max' so the caller
   * can apply the at-max behavior (heal nearest, or sacrifice for AoE
   * if Dark Pact is taken).
   */
  _spawnNextPet(priorityList, ownerSpec) {
    if (!this.skillManager) return null;
    const petMods = this.skillManager.getPetMods();

    for (const petId of priorityList) {
      const mods = petMods[petId];
      if (!mods || !mods.unlocked) continue;
      // How many already alive of this type?
      const currentCount = this.pets.filter(p => p.petId === petId && !p.dead).length;
      const maxCount = (mods.maxCount || 0) + (mods.maxCountBonus || 0);
      if (currentCount < maxCount) {
        // Check Wild Heart for explode-on-death (it's a stat-bag flag)
        const bag = this.skillManager.getPlayerStatBag();
        const hasWildHeart = !!(bag && bag._wildHeart);
        // Spawn at player's feet with a small offset
        const angle = Math.random() * Math.PI * 2;
        const x = this.player.x + Math.cos(angle) * 40;
        const y = this.player.y + Math.sin(angle) * 40;
        const pet = new Pet(petId, x, y, this.player, mods);
        if (hasWildHeart) pet.explodeOnDeath = true;
        this.pets.push(pet);
        return pet;
      }
    }

    // All pet types at max — return sentinel for caller to apply at-max behavior
    return 'at_max';
  }

  /**
   * At-max behavior: heal the nearest pet for X% of its max HP, OR
   * (with Dark Pact) sacrifice the nearest pet for an AoE explosion.
   */
  _atMaxPetBehavior(specKey, healPct) {
    if (!this.pets || this.pets.length === 0) return;
    // Find nearest non-dead pet
    let nearest = null;
    let nearestDist = Infinity;
    for (const p of this.pets) {
      if (p.dead) continue;
      const dx = p.x - this.player.x;
      const dy = p.y - this.player.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = p;
      }
    }
    if (!nearest) return;

    // Dark Pact: sacrifice for AoE
    const hasDarkPact = this.skillManager && this.skillManager.hasCapstone('bone_lord_dark_pact');
    // (Dark Pact is currently a behavior_swap on Raise Dead, not a capstone_hook —
    // we read it via the resolved attack's behaviorModes)
    const raiseDead = this.skillManager && this.skillManager.getResolvedAttack('necromancer_bone_lord_raise_dead');
    const darkPactActive = raiseDead && raiseDead.behaviorModes && raiseDead.behaviorModes.includes('atMaxSacrifice');

    if (darkPactActive && specKey === 'bone_lord') {
      // Sacrifice for AoE
      const sacDmg = nearest.maxHP * 0.6 + (this.player.damageBonus || 0);
      this._explosion(nearest.x, nearest.y, 140, sacDmg, null);
      if (this.particles) {
        for (let k = 0; k < 16; k++) {
          this.particles.emit(nearest.x, nearest.y, 1, '#a020a0', { speed: 220, life: 0.6, size: 5 });
        }
      }
      nearest.dead = true; // killed by sacrifice — onPetDeath fires next frame in _updatePets
      this.waveAnnouncement = { wave: 0, timer: 1.0, text: '☠ DARK PACT ☠' };
    } else {
      // Heal
      nearest.heal(nearest.maxHP * (healPct || 0.30));
      this._spawnHealNumberAt(nearest.x, nearest.y, nearest.maxHP * (healPct || 0.30));
    }
  }

  _spawnHealNumberAt(x, y, amount) {
    if (!this.damageNumbers || amount <= 0) return;
    this.damageNumbers.spawn(x, y - 10, '+' + Math.round(amount), false, '#7be07b');
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

  // === SCROLL OF TELEPORTATION ===
  // Teleport player to camp, leaving an open portal at the dungeon location.
  // The player can return through the camp portal to the saved dungeon location.
  _useScrollOfTeleportation() {
    if (!this.dungeon || !this.layoutManager) {
      // Not in a dungeon — no-op
      this.waveAnnouncement = { wave: 0, timer: 1.5, text: 'Cannot teleport from here' };
      return;
    }

    // Save dungeon position
    const dungeonPortal = {
      x: this.player.x,
      y: this.player.y,
      floor: this.currentFloor,
    };

    // Add a portal obstacle at the player's current dungeon position
    this.layoutManager.obstacles.push({
      type: 'teleport_portal',
      x: dungeonPortal.x,
      y: dungeonPortal.y,
      radius: 28,
    });

    // Audio + visual
    this.audio.waystoneTravel();
    this.particles.emit(this.player.x, this.player.y, 30, '#9b59b6', { speed: 200, life: 0.6 });

    // Enter camp WITH dungeon state preserved
    this._teleportPortal = dungeonPortal;
    this._enterBaseCamp(true);

    // Add a return portal obstacle in the camp near the campfire
    if (this.layoutManager) {
      const cf = this.campData.campfire;
      const portalX = (cf?.x || 608) + 100;
      const portalY = (cf?.y || 550);
      this.layoutManager.obstacles.push({
        type: 'teleport_portal',
        x: portalX,
        y: portalY,
        radius: 28,
        _isReturnPortal: true,
      });
      this._returnPortalPos = { x: portalX, y: portalY };
    }
  }

  // Return to dungeon via the camp portal
  _returnFromTeleportPortal() {
    if (!this._savedDungeonState || !this._teleportPortal) return;
    const s = this._savedDungeonState;

    // Restore dungeon state
    this.state = 'PLAYING';
    this.dungeonMode = true;
    this.dungeon = s.dungeon;
    this.dungeonManager = s.dungeonManager;
    this.layoutManager = s.layoutManager;
    this.currentFloor = s.currentFloor;
    this.projectiles = s.projectiles || [];
    this.minions = s.minions || [];
    this.corpses = s.corpses || [];
    this.fireTrails = s.fireTrails || [];
    this.trapManager = s.trapManager;

    // Restore renderer
    this.renderer.setLayout(this.layoutManager);
    this.renderer.mapWidth = s.mapWidth;
    this.renderer.mapHeight = s.mapHeight;
    this.renderer.setTheme(s.renderTheme);

    // Place player at the saved teleport location
    this.player.x = this._teleportPortal.x;
    this.player.y = this._teleportPortal.y;

    // Remove BOTH portals (used up — round trip)
    this.layoutManager.obstacles = this.layoutManager.obstacles.filter(o => o.type !== 'teleport_portal');

    // Audio + visual
    this.audio.waystoneTravel();
    this.particles.emit(this.player.x, this.player.y, 30, '#9b59b6', { speed: 200, life: 0.6 });

    // Clear teleport state
    this._teleportPortal = null;
    this._savedDungeonState = null;
    this._returnPortalPos = null;

    this.waveAnnouncement = { wave: 0, timer: 1.5, text: `Returned to Floor ${this.currentFloor}` };
  }

  // === STARTER GEAR ===
  //
  // Give a new character a low-quality starter weapon matching their class.
  // We pick a SPECIFIC base type per class instead of letting the random pool
  // hand the player a dagger — daggers are universal which made them eligible
  // for every class, but Bash/Cleave only require sword/axe/dagger so the
  // warrior was OK, while Mage/Necro/Archer attacks all reject daggers via
  // their weaponReq, leaving the player unable to fire their default attack.
  _giveStarterGear(classId) {
    if (!this.itemGenerator) return;
    const STARTER_WEAPONS = {
      warrior:     'sword',  // mid damage, balanced speed
      mage:        'wand',   // one-handed, allows future off-hand
      archer:      'bow',    // two-handed, only weapon Aimed/Quick Shot accept
      necromancer: 'wand',   // one-handed, thematic
    };
    const baseType = STARTER_WEAPONS[classId];
    const weapon = this.itemGenerator.generate(1, classId, {
      forceRarity: 'common',
      forceSlot: 'mainHand',
      forceBaseType: baseType,
    });
    if (weapon) {
      this.player.equipment.mainHand = weapon;
      this.player.recalcAllStats();
      console.info('[starter] Gave', classId, 'a', baseType);
    }
  }

  // === EQUIPMENT VALIDATION ===
  // Walk all 6 equipment slots and unequip anything the current class can't
  // use. Removed items are pushed back into the inventory grid (or dropped
  // at the player's feet if the grid is full).
  //
  // This is the second half of the cross-class bug fix from Phase 1.4 — the
  // persistence migration handles new save fields, but equipment lives
  // independently of class so it has to be re-validated on every load
  // (cheap: 6 slot checks).
  _unequipInvalidGear() {
    if (!this.player || !this.player.equipment) return;
    const classId = this.selectedClass && this.selectedClass.id;
    if (!classId) return;

    const slots = ['mainHand', 'offHand', 'chest', 'legs', 'belt', 'boots'];
    const unequipped = [];

    for (const slot of slots) {
      const item = this.player.equipment[slot];
      if (!item) continue;
      // Items with no classReq array are universal (e.g. junk). Items with
      // a classReq array must include the current class.
      if (Array.isArray(item.classReq) && item.classReq.length > 0 && !item.classReq.includes(classId)) {
        this.player.equipment[slot] = null;
        unequipped.push(item);
      }
    }

    if (unequipped.length === 0) return;

    // Push removed items back into inventory if there's space.
    let droppedCount = 0;
    for (const item of unequipped) {
      let added = false;
      if (this.inventory && typeof this.inventory.addItem === 'function' && !this.inventory.isFull?.()) {
        try {
          added = !!this.inventory.addItem(item);
        } catch {
          added = false;
        }
      }
      if (!added) {
        // Drop at player's feet via the loot system. If that's also unavailable,
        // we silently lose the item — it was unusable by this class anyway.
        if (this.lootSystem && typeof this.lootSystem.dropItem === 'function') {
          try { this.lootSystem.dropItem(item, this.player.x, this.player.y); }
          catch { droppedCount++; }
        } else {
          droppedCount++;
        }
      }
    }

    // Player feedback so they know what happened
    const word = unequipped.length === 1 ? 'item' : 'items';
    const note = droppedCount > 0 ? ' (some were dropped — inventory full)' : '';
    this.waveAnnouncement = {
      wave: 0,
      timer: 3.0,
      text: `Unequipped ${unequipped.length} ${word} not usable by ${this._titleCase(classId)}${note}`,
    };
    console.info('[equipment] Unequipped ' + unequipped.length + ' invalid ' + word + ' for class ' + classId);

    // Recalc since main hand may have changed
    if (this.player.recalcAllStats) this.player.recalcAllStats();
    // Persist the cleaned equipment immediately so the same fix doesn't
    // re-fire on every load.
    if (this.persistence) {
      this.persistence.saveEquipment(JSON.parse(JSON.stringify(this.player.equipment)));
    }
  }

  _titleCase(s) {
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // === SKILL EXECUTION ===
  //
  // _canExecuteSkill removed in v3 — weapon req + cooldown + resource checks
  // are now centralized in skillManager.canCast() which is called from
  // _tryFireSlot before every cast attempt.

  /**
   * v3 slot fire path. Pulls a CastEvent from the skill manager and either
   *   - bridges an attack into _executeSkill() (legacy combat handler)
   *   - bridges a consumable into the inventory.useConsumable flow
   *
   * Provides HUD feedback for blocked casts (red error pulse / no_resource).
   */
  _tryFireSlot(slotId, nearestEnemy, nearestDist) {
    const mgr = this.skillManager;
    if (!mgr) return;

    const check = mgr.canCast(slotId);
    if (!check.ok) {
      // Distinguish between "nothing to fire" (silent) and "cannot fire right now" (feedback)
      if (check.reason === 'empty') return;
      if (this.hud && typeof this.hud.flashSlotError === 'function') {
        this.hud.flashSlotError(slotId, check.reason === 'no_resource' ? 'no_resource' : 'cooldown');
      }
      // Throttled "no weapon" announcement to mirror the old behavior
      if (check.reason === 'no_weapon') {
        if (!this._noWeaponMsgTimer || this._noWeaponMsgTimer <= 0) {
          this.waveAnnouncement = { wave: 0, timer: 1.2, text: 'No weapon equipped!' };
          this._noWeaponMsgTimer = 1.2;
        }
      }
      return;
    }

    const event = mgr.castSlot(slotId);
    if (!event) return;

    if (event.kind === 'attack') {
      // Bridge into legacy _executeSkill: it expects { skill, level, data }
      // where `data` has the per-level numeric stats. The resolved attack
      // already exposes most fields with matching names (damage, range,
      // attackType, etc.) but the legacy combat handlers reference a few
      // older field aliases. We build a flat `data` object that satisfies
      // both shapes.
      const resolved = event.attack;
      const data = {
        ...resolved,
        // Legacy aliases
        aoeArc: resolved.arc != null ? resolved.arc : undefined,
        radius: resolved.aoeRadius != null ? resolved.aoeRadius : (resolved.radius || undefined),
      };
      const bridged = { skill: resolved, level: 1, data };
      this._executeSkill(bridged, nearestEnemy, nearestDist);
    } else if (event.kind === 'consumable') {
      this._useConsumableById(event.consumableId, slotId);
    }
  }

  /**
   * v3 consumable cast path: take a consumable by baseType, decrement the
   * inventory stack, apply the effect, and start the cooldown group.
   *
   * The cooldown is already started by skillManager.castSlot() before this
   * runs (consumable: prefix). So if the inventory stack is empty we
   * shouldn't have gotten here — but we defensively check anyway and
   * refund the cooldown by clearing it.
   */
  _useConsumableById(consumableId, slotId) {
    if (!this.inventory) return;
    const def = this.potionsData?.potionTypes?.find(p => p.id === consumableId) || null;
    if (!def) {
      console.warn('[hotbar] Unknown consumable id:', consumableId);
      return;
    }

    // Class restriction check (mana potions require Mage/Necro, etc.)
    if (def.classRestriction && !def.classRestriction.includes(this.selectedClass.id)) {
      if (this.hud && this.hud.flashSlotError) this.hud.flashSlotError(slotId, 'cooldown');
      // Refund the cooldown the manager just started
      if (this.skillManager) delete this.skillManager.cooldowns['consumable:' + (def.cooldownGroup || consumableId)];
      return;
    }

    // Pull a stack from inventory
    const consumed = this.inventory.consumeOneByBaseType(consumableId);
    if (!consumed) {
      // Stack already empty — refund cooldown so the player isn't punished
      if (this.skillManager) delete this.skillManager.cooldowns['consumable:' + (def.cooldownGroup || consumableId)];
      if (this.hud && this.hud.flashSlotError) this.hud.flashSlotError(slotId, 'cooldown');
      this.waveAnnouncement = { wave: 0, timer: 1.0, text: `Out of ${def.name}` };
      return;
    }

    // Apply the effect (mirrors _usePotion)
    const effect = consumed.effect || def.effect;
    if (effect) {
      if (effect.type === 'heal_percent' && effect.resource === 'hp') {
        this.player.hp = Math.min(this.player.maxHP, this.player.hp + this.player.maxHP * effect.value);
      } else if (effect.type === 'heal_percent' && effect.resource === 'mana') {
        this.player.gainResource(this.player.maxResource * effect.value);
      } else if (effect.type === 'fill_resource') {
        this.player.resource = this.player.maxResource;
      } else if (effect.type === 'add_resource') {
        this.player.gainResource(effect.value);
      } else if (effect.type === 'teleport_to_camp') {
        this._useScrollOfTeleportation();
      }
    }
    if (this.audio && this.audio.potionUse) this.audio.potionUse();
    if (this.hud && this.hud.updateHP) this.hud.updateHP(this.player.hp, this.player.maxHP);
  }

  // ===========================================================
  //  Hold-channel attacks (e.g. Whirlwind)
  // ===========================================================
  //
  // Hold-channel attacks bypass the normal castSlot path because they have
  // no upfront resource cost and no fixed duration. They tick every frame
  // while the bound input is held, draining `costPerSecond` continuously
  // and dealing per-tick AoE damage. Cooldown starts on release.

  /**
   * Whether the input bound to a channel slot is currently held.
   */
  _isChannelInputHeld(slotId) {
    if (!this.input) return false;
    if (slotId === 'leftClick') return !!this.input.leftHold;
    if (slotId === 'rightClick') return !!this.input.rightHold;
    // Keyboard slots: hold-channel via raw keys array
    if (slotId.startsWith('slot')) {
      const idx = parseInt(slotId.slice(4), 10);
      const k = String(idx);
      return !!(this.input.keys && this.input.keys[k]);
    }
    return false;
  }

  _beginChannel(slotId, nearestEnemy, nearestDist) {
    const mgr = this.skillManager;
    if (!mgr) return;

    const binding = mgr.getSlotBinding(slotId);
    if (!binding || binding.type !== 'attack') return;
    const resolved = mgr.getResolvedAttack(binding.id);
    if (!resolved || !resolved.holdChannel) return;

    // Pre-flight: same checks as a normal cast EXCEPT cost (cost is per-second
    // and gets drained on tick). We still want cooldown + weapon checks.
    if (mgr.getCooldownRemaining(slotId) > 0) {
      if (this.hud && this.hud.flashSlotError) this.hud.flashSlotError(slotId, 'cooldown');
      return;
    }
    if (resolved.weaponReq && resolved.weaponReq.length > 0) {
      const weapon = this.player.equipment && this.player.equipment.mainHand;
      if (!weapon || !resolved.weaponReq.includes(weapon.baseType)) {
        if (this.hud && this.hud.flashSlotError) this.hud.flashSlotError(slotId, 'cooldown');
        if (!this._noWeaponMsgTimer || this._noWeaponMsgTimer <= 0) {
          this.waveAnnouncement = { wave: 0, timer: 1.2, text: 'No weapon equipped!' };
          this._noWeaponMsgTimer = 1.2;
        }
        return;
      }
    }
    // Need at least 1 tick worth of resource to start
    const minCost = (resolved.costPerSecond || 0) * (resolved.tickInterval || 0.25);
    if (this.player && this.player.resource < minCost) {
      if (this.hud && this.hud.flashSlotError) this.hud.flashSlotError(slotId, 'no_resource');
      return;
    }

    this._channelState = {
      slotId,
      attackId: binding.id,
      attack: resolved,
      costPerSecond: resolved.costPerSecond || 0,
      tickInterval: resolved.tickInterval || 0.25,
      tickTimer: 0,
      // Counts how many ticks have fired so the HUD can briefly show "active"
      ticks: 0,
    };

    // Fire an immediate first tick so the player gets instant feedback on press
    this._tickChannel(0, nearestEnemy, /*forceTick*/ true);
  }

  _tickChannel(dt, nearestEnemy, forceTick) {
    const ch = this._channelState;
    if (!ch) return;
    const player = this.player;
    if (!player) return;

    // Drain resource by costPerSecond * dt continuously, NOT in chunks. This
    // matches the WoW model where rage drops smoothly.
    const drain = ch.costPerSecond * dt;
    if (drain > 0) {
      if (player.resource < drain) {
        // Out of resource — end immediately
        this._endChannel();
        return;
      }
      player.resource -= drain;
      if (player.resource < 0) player.resource = 0;
    }

    // Per-tick damage burst
    ch.tickTimer -= dt;
    if (forceTick || ch.tickTimer <= 0) {
      ch.tickTimer += ch.tickInterval;
      ch.ticks++;
      // Bridge through the existing _skillMeleeAoE handler. The resolved
      // attack already has `radius` (or aoeRadius), `damage`, knockback, etc.
      const data = {
        ...ch.attack,
        radius: ch.attack.radius || ch.attack.aoeRadius || 100,
      };
      const damage = (data.damage || 0) + player.damageBonus + Math.round(player.getWeaponDamage());
      // Reuse the existing AoE handler — it already does crit, screen shake,
      // damage numbers, and lifesteal.
      this._skillMeleeAoE(damage, data);
      // Audio: play a short tick on every nth tick (don't deafen the player)
      if (ch.ticks % 2 === 0) this.audio.skillCast('melee');
    }
  }

  _endChannel() {
    if (!this._channelState) return;
    const ch = this._channelState;
    const mgr = this.skillManager;
    // Start cooldown on release (uses the resolved attack's cooldown)
    if (mgr && ch.attack && ch.attack.cooldown > 0) {
      mgr.startCooldown('attack:' + ch.attackId, ch.attack.cooldown);
    }
    this._channelState = null;
  }

  _executeSkill(info, nearestEnemy, nearestDist) {
    const { skill, level, data } = info;
    const player = this.player;
    const damage = (data.damage || 0) + player.damageBonus + Math.round(player.getWeaponDamage());

    // Skill cast audio based on attack type
    if (skill.attackType === 'melee' || skill.attackType === 'melee_aoe') {
      this.audio.skillCast('melee');
    } else if (skill.attackType === 'projectile' || skill.attackType === 'projectile_aoe') {
      this.audio.skillCast('arrow');
    } else {
      this.audio.skillCast('spell');
    }

    switch (skill.attackType) {
      case 'melee':
        this._skillMelee(damage, data, nearestEnemy);
        break;
      case 'melee_aoe':
        this._skillMeleeAoE(damage, data);
        break;
      case 'self_aoe':
        // Centered on player; same shape as melee_aoe but applies the
        // attack's statusApply (Frost Nova → frozen) to every enemy hit.
        this._skillSelfAoE(damage, data);
        break;
      case 'projectile':
        this._skillProjectile(damage, data, nearestEnemy);
        break;
      case 'projectile_aoe':
        this._skillProjectileAoE(damage, data, nearestEnemy);
        break;
      case 'projectile_spread':
        // Multi-arrow spread (Multishot). _skillProjectile already supports
        // arrowCount + spreadAngleDeg.
        this._skillProjectile(damage, data, nearestEnemy);
        break;
      case 'ground_aoe':
        // Lingering ground AoE at the cursor position (Outbreak). For now
        // we just spawn a single AoE pulse at the player's aim point.
        this._skillGroundAoE(damage, data);
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

    const attackId = (data && data.id) || null;
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
        // Hit-time damage modifiers (Dead Eye vs high-HP, vs-bleeding, etc.)
        const finalDmg = this._modifyDamageOnHit(dmg, e, attackId);
        const fromAngle = Math.atan2(-dy, -dx);
        const killed = e.takeDamage(finalDmg, fromAngle);
        this.damageNumbers.spawn(e.x, e.y - e.radius, finalDmg, isCrit);
        if (player.lifestealPercent > 0) player.hp = Math.min(player.maxHP, player.hp + finalDmg * player.lifestealPercent);
        if (player.resourceOnHitDeal > 0) player.gainResource(player.resourceOnHitDeal);
        // v3: apply attack-driven status (e.g. Hemorrhage bleed on Aimed Shot)
        if (data && data.statusApply && !killed) {
          this._applyStatusFromAttack(data, e);
        }
        if (killed) this._onEnemyDeath(e);
      }
    }
  }

  _skillMeleeAoE(damage, data) {
    const player = this.player;
    const radius = data.radius || data.aoeRadius || 100;
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

  /**
   * Self-centered AoE that ALSO applies a status to every enemy hit.
   * Used by Frost Nova (freezes everything in radius) and similar attacks.
   * Damage flows through _explosion; status flows through _applyStatusFromAttack.
   */
  _skillSelfAoE(damage, data) {
    const player = this.player;
    const radius = data.aoeRadius || data.radius || 140;
    const isCrit = player.critChance > 0 && Math.random() < player.critChance;
    const dmg = isCrit ? damage * (player.critDamageMultiplier || 1.5) : damage;

    this._explosion(player.x, player.y, radius, dmg, null);
    this.screenShake = 0.18;

    // Apply status to every enemy in radius
    if (data.statusApply) {
      const wave = this.waveSystem || this._waveShim;
      if (wave) {
        const targets = [...wave.enemies.filter(e => !e.dead)];
        if (wave.boss && !wave.boss.dead) targets.push(wave.boss);
        for (const e of targets) {
          const dx = e.x - player.x;
          const dy = e.y - player.y;
          if (Math.sqrt(dx * dx + dy * dy) < radius + e.radius) {
            this._applyStatusFromAttack({ statusApply: data.statusApply }, e);
          }
        }
      }
    }
  }

  /**
   * Ground-targeted AoE (Outbreak): immediate burst at the cursor position,
   * AND spawns a lingering cloud entity that re-applies the status every
   * tickInterval until duration expires.
   */
  _skillGroundAoE(damage, data) {
    const player = this.player;
    const radius = data.aoeRadius || 100;
    // Use the player's aim point as the AoE center
    const range = data.range || 240;
    const cx = player.x + Math.cos(player.aimAngle) * range;
    const cy = player.y + Math.sin(player.aimAngle) * range;
    const isCrit = player.critChance > 0 && Math.random() < player.critChance;
    const dmg = isCrit ? damage * (player.critDamageMultiplier || 1.5) : damage;

    // Immediate burst (damage + status to everyone currently in radius)
    this._explosion(cx, cy, radius, dmg, null);
    if (data.statusApply) {
      const wave = this.waveSystem || this._waveShim;
      if (wave) {
        const targets = [...wave.enemies.filter(e => !e.dead)];
        if (wave.boss && !wave.boss.dead) targets.push(wave.boss);
        for (const e of targets) {
          const dx = e.x - cx;
          const dy = e.y - cy;
          if (Math.sqrt(dx * dx + dy * dy) < radius + e.radius) {
            this._applyStatusFromAttack({ statusApply: data.statusApply }, e);
          }
        }
      }
    }

    // Lingering cloud — every 0.5s, re-apply the status to enemies in the
    // cloud's footprint. Cloud has a fixed `duration` from the attack data
    // (Outbreak: 4s) so it self-cleans up.
    if (data.duration && data.statusApply) {
      if (!this.statusClouds) this.statusClouds = [];
      this.statusClouds.push({
        x: cx, y: cy, radius,
        duration: data.duration,
        elapsed: 0,
        tickInterval: 0.5,
        tickTimer: 0.5,
        statusApply: { ...data.statusApply },
        color: this._statusColor(data.statusApply.status),
      });
    }
  }

  /**
   * Tick lingering status clouds. Called from the main update loop.
   * Each cloud re-applies its statusApply to enemies in radius every
   * tickInterval seconds, then expires when elapsed >= duration.
   */
  _updateStatusClouds(dt) {
    if (!this.statusClouds || this.statusClouds.length === 0) return;
    const wave = this.waveSystem || this._waveShim;
    for (let i = this.statusClouds.length - 1; i >= 0; i--) {
      const cloud = this.statusClouds[i];
      cloud.elapsed += dt;
      cloud.tickTimer -= dt;

      if (cloud.tickTimer <= 0) {
        cloud.tickTimer += cloud.tickInterval;
        if (wave) {
          const targets = [...wave.enemies.filter(e => !e.dead)];
          if (wave.boss && !wave.boss.dead) targets.push(wave.boss);
          for (const e of targets) {
            const dx = e.x - cloud.x;
            const dy = e.y - cloud.y;
            if (dx * dx + dy * dy < cloud.radius * cloud.radius) {
              this._applyStatusFromAttack({ statusApply: cloud.statusApply }, e);
            }
          }
        }
      }

      if (cloud.elapsed >= cloud.duration) {
        this.statusClouds.splice(i, 1);
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
    const count = data.arrowCount || data.arrows || data.count || 1;
    const spread = (data.spreadAngleDeg || data.spread || data.spreadAngle || 0) * (Math.PI / 180);
    const sourceAttackId = (data && data.id) || null;

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
      // Tag with the source attack id so hit-time triggers (Dead Eye, etc.)
      // know which spec-tree triggers apply.
      p.sourceAttackId = sourceAttackId;
      // v3: carry the status payload so on-hit can apply it to the target
      if (data.statusApply) p.statusApply = data.statusApply;
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
      const damageBonus = data.damageBonus;
      const duration = data.duration || 6;
      this._activeBuffs.push({
        type: 'damage',
        amount: damageBonus,
        remaining: duration,
        apply: () => { player.damageBonus += damageBonus; },
        remove: () => { player.damageBonus -= damageBonus; },
      });
      // Apply immediately
      player.damageBonus += damageBonus;
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
    // v3 spec-tree summon attacks (Call Beast, Raise Dead) are dispatched
    // by attack id to the pet system. Legacy summons (Necromancer blessings)
    // fall through to _trySpawnMinion.
    if (data && data.id === 'archer_beastmaster_call_beast') {
      // Beastmaster: spawn next available beast in priority order
      const result = this._spawnNextPet(['wolf', 'hawk', 'bear'], 'beastmaster');
      if (result === 'at_max') {
        const healPct = data.atMaxHealPct || 0.30;
        this._atMaxPetBehavior('beastmaster', healPct);
      }
      return;
    }
    if (data && data.id === 'necromancer_bone_lord_raise_dead') {
      // Bone Lord: spawn next available undead. Skeletons first (cheap),
      // then zombies. Bone Golem comes from the Lich Lord capstone — it's
      // permanent so we don't try to summon another one here.
      const result = this._spawnNextPet(['skeleton', 'zombie'], 'bone_lord');
      if (result === 'at_max') {
        const healPct = data.atMaxHealPct || 0.30;
        this._atMaxPetBehavior('bone_lord', healPct);
      }
      return;
    }
    // Legacy summon path
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

    // === Enemy → pet contact damage ===
    // Pets need to be hittable so the player can lose them. Same contact-
    // damage cycle as the player, but applied per-pet.
    if (this.pets && this.pets.length > 0) {
      for (const e of wave.enemies) {
        if (e.dead || e.contactCooldown > 0 || e.isBurrowed) continue;
        if (e._stunTimer && e._stunTimer > 0) continue;
        for (const pet of this.pets) {
          if (pet.dead) continue;
          const dx = pet.x - e.x;
          const dy = pet.y - e.y;
          if (Math.sqrt(dx * dx + dy * dy) < pet.radius + e.radius) {
            pet.takeDamage(e.damage);
            e.contactCooldown = 0.5;
            break; // one contact per enemy per frame
          }
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

    // Show resource hint after first kill (one-time)
    if (!this.persistence.data.combatTutorialComplete && !this._combatHintsShown.resource) {
      this._combatHintsShown.resource = true;
      const resName = this.player.resourceName || 'Resource';
      const resHint = this.player.resourceType === 'rage' ? `${resName} builds on hit. Spend it on skills!`
                    : this.player.resourceType === 'stamina' ? `${resName} regenerates. Spend it on skills!`
                    : `${resName} regenerates over time. Spend it on skills!`;
      this.waveAnnouncement = { wave: 0, timer: 4.0, text: resHint };
      // Mark tutorial complete after both hints shown
      this.persistence.data.combatTutorialComplete = true;
      this.persistence.save();
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
      this.waveAnnouncement = { wave: 0, timer: 2.5, text: `LEVEL UP!  Level ${this.player.level}` };
      this.audio.levelUp();
      // Particle burst at player position
      this.particles.emit(this.player.x, this.player.y, 30, '#f1c40f', { speed: 250, life: 0.9, size: 4 });
      this.screenShake = 0.2;
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
      const bdx = this.player.x - enemy.x;
      const bdy = this.player.y - enemy.y;
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

    // v3 spec-tree status-conditional kill triggers — fired BEFORE the
    // generic onKill event so capstones and per-status nodes can react to
    // the dying state. Status objects may already be cleared by death, so
    // we read what's still on the enemy at the moment _onEnemyDeath fires.
    if (enemy.hasStatus) {
      if (enemy.hasStatus('burning')) this._fireCombatEvent('onKillBurning', { enemy });
      if (enemy.hasStatus('plagued')) this._fireCombatEvent('onKillPlagued', { enemy });
      if (enemy.hasStatus('frozen'))  this._fireCombatEvent('onKillFrozen',  { enemy });
    }

    // v3 spec-tree onKill event — fires Crimson Surge (heal on kill),
    // Phoenix capstone (on-kill nova), and any future onKill triggers.
    this._fireCombatEvent('onKill', { enemy });
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
    // Death animation: emit particles around player
    for (let i = 0; i < 30; i++) {
      this.particles.emit(
        this.player.x, this.player.y, 1,
        this.player.color || '#cc2222',
        { speed: 200, life: 0.8, size: 4 }
      );
    }
    this.screenShake = 0.5;
    // Brief delay so player sees the death effect before screen shows
    await new Promise(resolve => setTimeout(resolve, 800));
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
        await this._openTrainer();
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

  /**
   * Open the in-combat Quick Skill Picker for an LMB/RMB slot. Anchored to
   * the canvas-rendered slot position.
   */
  async _openInCombatPicker(slotId) {
    if (!this.skillManager || !this.quickSkillPicker) return;
    const layout = this.hud && this.hud._slotLayout && this.hud._slotLayout[slotId];
    if (!layout) return;
    // Convert canvas-space coords to screen-space (for the popup anchor)
    const canvas = this.canvas;
    const rect = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0 };
    const scaleX = canvas ? rect.width / canvas.width : 1;
    const scaleY = canvas ? rect.height / canvas.height : 1;
    const anchorX = rect.left + (layout.x + layout.size / 2) * scaleX;
    const anchorY = rect.top + layout.y * scaleY;
    const attackId = await this.quickSkillPicker.show(this.skillManager, slotId, anchorX, anchorY);
    if (attackId) {
      this.skillManager.setHotbarSlot(slotId, { type: 'attack', id: attackId });
      this._saveProgress();
    }
  }

  _openSkillBook() {
    if (!this.skillManager) return;
    if (this._skillBookWindow && this._skillBookWindow.isOpen) {
      this._skillBookWindow.close();
      this._skillBookWindow = null;
      return;
    }

    const win = new GameWindow({ title: 'Skill Book', width: 700, height: 640, x: 80, y: 30, onClose: () => {
      this._skillBookWindow = null;
      this._saveProgress();
    }});
    this._skillBookWindow = win;

    const buildContent = () => {
      const el = document.createElement('div');
      // v3 signature: (container, skillManager, player, onRefresh)
      this.skillBookUI.buildInto(el, this.skillManager, this.player, () => buildContent());
      win.setContent(el);
    };
    buildContent();
    win.open();
  }

  async _openTrainer() {
    if (!this.skillManager) return;
    this.paused = true;
    // Sync gold from persistence to player object so the UI can read it
    this.player.gold = this.persistence.getGold();
    await this.trainerUI.show(
      this.skillManager,
      this.player,
      {
        // Charge gold for paid respecs. Returns false to abort if the
        // charge can't be made (defensive — UI already gates on affordability).
        onSpendGold: (amount) => {
          if (this.persistence.getGold() < amount) return false;
          this.persistence.spendGold(amount);
          this.player.gold = this.persistence.getGold();
          return true;
        },
        // Reset attributes to class base, refund the spent points.
        onAttributeRespec: () => {
          const baseAttrs = (this.player.classConfig && this.player.classConfig.baseAttributes) || { str: 0, int: 0, agi: 0, sta: 0 };
          const baseTotal = Object.values(baseAttrs).reduce((a, b) => a + (b || 0), 0);
          const currTotal = Object.values(this.player.attributes).reduce((a, b) => a + (b || 0), 0);
          const refunded = currTotal - baseTotal;
          this.player.attributePointsAvailable = (this.player.attributePointsAvailable || 0) + Math.max(0, refunded);
          this.player.attributes = { ...baseAttrs };
          this.player.onProgressionChanged();
        },
        // Auto-open Skill Book after a successful respec (per WIREFRAMES §7.2)
        onAfterRespec: () => {
          // The trainer modal stays open; opening the skill book here would
          // double-stack panels. We just save and let the player close the
          // trainer manually.
          this._saveProgress();
        },
      }
    );
    // Refresh stats after the trainer closes (the manager already called
    // recomputeResolved during refundAll, but the player's recalc may not
    // have flowed through if onAttributeRespec wasn't called).
    this.player.onProgressionChanged();
    this._saveProgress();
    this.paused = false;
  }

  _openInventory() {
    if (this._inventoryWindow && this._inventoryWindow.isOpen) {
      this._inventoryWindow.close();
      this._inventoryWindow = null;
      return;
    }

    // Window must be wide enough for: equipment doll (260px) + gap (16px) +
    // 10-column inventory grid (10*36 = 360px) + content padding (~32px) +
    // GameWindow chrome (~12px). 760px is the safe minimum.
    const win = new GameWindow({ title: 'Inventory', width: 760, height: 580, x: 120, y: 30, onClose: () => {
      this._inventoryWindow = null;
      this._saveProgress();
    }});
    this._inventoryWindow = win;

    const buildContent = () => {
      const el = document.createElement('div');
      this.inventoryUI.buildInto(el, this.player, this.inventory, this.skillManager, {
        atVendor: false,
        onEquip: (item, slot) => {
          // If equipping a 2H weapon to mainHand, auto-unequip the off-hand
          if (slot === 'mainHand' && item.twoHanded) {
            const offHand = this.player.equipment.offHand;
            if (offHand) {
              if (this.inventory.addItem(offHand)) {
                this.player.equipment.offHand = null;
              } else {
                // Inventory full — abort the equip and warn
                this.waveAnnouncement = { wave: 0, timer: 1.5, text: 'Inventory full — cannot unequip off-hand' };
                return;
              }
            }
          }
          // If equipping an off-hand while a 2H weapon is equipped, block it
          if (slot === 'offHand' && this.player.equipment.mainHand && this.player.equipment.mainHand.twoHanded) {
            this.waveAnnouncement = { wave: 0, timer: 1.5, text: 'Two-handed weapon equipped — unequip first' };
            return;
          }
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
          if (this.lootSystem) this.lootSystem.spawnGroundItem(this.player.x, this.player.y, item, { pickupDelay: 2000 });
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
    // Sync gold from persistence so vendor UI can read it
    this.player.gold = this.persistence.getGold();
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
        // Pricing: HP/Mana potions = hpMana, tonics = tonic, scrolls = 4x tonic
        let price;
        if (pt.id.includes('scroll')) {
          price = (bracket?.tonic || 15) * 4;
        } else if (pt.id.includes('potion')) {
          price = bracket?.hpMana || 10;
        } else {
          price = bracket?.tonic || 15;
        }
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
          stackable: true,
          maxStack: pt.maxStack,
          stackCount: 1,
          effect: pt.effect,
          cooldownGroup: pt.cooldownGroup,
          cooldown: pt.cooldown,
          classRestriction: pt.classRestriction || null,
          sellValue: Math.floor(price / 2),
          buyPrice: price,
          description: pt.description,
          rarityColor: pt.color || '#cccccc',
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
          this.player.gold = this.persistence.getGold();
          this.audio.vendorBuy();
        }
      },
      (itemId) => { // onSell
        const info = this.inventory.findItemById(itemId);
        if (info) {
          const sellPrice = info.item.sellValue || 1;
          this.persistence.addGold(sellPrice);
          this.player.gold = this.persistence.getGold();
          this.inventory.remove(itemId);
          this.audio.vendorBuy();
        }
      },
      () => { // onSellJunk
        const value = this.inventory.removeAllJunk();
        if (value > 0) {
          this.persistence.addGold(value);
          this.player.gold = this.persistence.getGold();
        }
      }
    );
    this._saveProgress();
    this.paused = false;
  }

  // _usePotion removed in v3 — consumables are now bound to the unified
  // hotbar (slots 1–5, LMB, RMB) and cast through _useConsumableById which
  // is called from _tryFireSlot. Cooldowns are managed by skillManager
  // (consumable:<group> keys) instead of the old this.potionCooldowns map.

  _applyPassives() {
    // Legacy bridge — the v3 spec-tree system replaces standalone passives
    // with player_stat tree nodes resolved by skillManager.getPlayerStatBag().
    // The single consolidator below recomputes the manager's caches AND
    // recalcs player stats so any tree bonuses flow through.
    if (this.player && this.player.onProgressionChanged) {
      this.player.onProgressionChanged();
    }
  }

  _updateSkillSlotHUD() {
    if (!this.skillManager || !this.hud) return;
    // v3: build the full 7-slot payload from the manager's hotbar +
    // resolved attacks. Cooldowns are pulled per slot.
    const slots = {};
    const SLOT_IDS = ['leftClick', 'rightClick', 'slot1', 'slot2', 'slot3', 'slot4', 'slot5'];
    for (const slotId of SLOT_IDS) {
      const binding = this.skillManager.getSlotBinding(slotId);
      if (!binding) { slots[slotId] = null; continue; }

      if (binding.type === 'attack') {
        const baseDef = this.skillManager.getAttack(binding.id);
        const resolved = this.skillManager.getResolvedAttack(binding.id);
        if (!baseDef || !resolved) { slots[slotId] = null; continue; }
        // Spec mismatch: attack from a spec the player has 0 points in
        const attackSpecKey = this._findSpecForAttack(binding.id);
        const ranks = attackSpecKey ? this.skillManager.getPointsInTree(attackSpecKey) : 0;
        const spec = attackSpecKey ? this.skillManager.getSpec(attackSpecKey) : null;
        const specColor = (spec && spec.specData && spec.specData.color) || null;
        slots[slotId] = {
          binding: { type: 'attack', id: binding.id },
          icon: baseDef.icon || '?',
          name: baseDef.name || '',
          resourceCost: resolved.cost || 0,
          stackCount: null,
          cooldownRemaining: this.skillManager.getCooldownRemaining(slotId),
          cooldownTotal: this.skillManager.getCooldownTotal(slotId) || 0,
          specColor,
          untrained: ranks === 0,
          specMismatchTooltip: ranks === 0 ? 'Untrained — base power only' : null,
        };
      } else if (binding.type === 'consumable') {
        const def = this.potionsData?.potionTypes?.find(p => p.id === binding.id) || null;
        // Stack count from the inventory hotbar (legacy 4-slot store).
        // Phase 4 will introduce a proper inventory→consumable lookup; for
        // now we display 0 if we can't find one and rely on the auto-refill
        // story being wired later.
        const stackCount = this._getConsumableStack(binding.id);
        slots[slotId] = {
          binding: { type: 'consumable', id: binding.id },
          icon: def?.icon || '🧪',
          name: def?.name || binding.id,
          resourceCost: 0,
          stackCount,
          cooldownRemaining: this.skillManager.getCooldownRemaining(slotId),
          cooldownTotal: this.skillManager.getCooldownTotal(slotId) || 0,
          specColor: null,
          untrained: false,
          specMismatchTooltip: null,
        };
      } else {
        slots[slotId] = null;
      }
    }
    this.hud.setSlots(slots);
  }

  // ===========================================================
  //  v3 conditional trigger + capstone dispatcher
  // ===========================================================
  //
  // Single entry point for combat events that fire spec-tree triggers.
  // Game code calls this from canonical hooks (_onEnemyDeath, takeDamage,
  // post-cast). The dispatcher pulls the registered trigger list from the
  // skill manager (pre-bucketed by event name for O(1) lookup) and applies
  // each one's effect via a switch on a small set of effect schemas.
  //
  // Capstone hooks ride the same dispatcher when they fire on a combat
  // event (Phoenix on onKill, Aegis on takeDamage, etc.) — see _checkCapstones.

  /**
   * Fire a named combat event. ctx is an event-specific payload that
   * trigger handlers may read or mutate.
   *
   * Supported events (Phase 5 subset):
   *   onKill          — { enemy }
   *   belowHPPct      — { hpPct } (passive check, called from player.takeDamage)
   *
   * Phase 6 will add:
   *   onHit, onCrit, postParry, vsBleeding, vsFrozen, vsPlagued,
   *   vsSlowedOrFrozen, vsHighHP, fromBurningSource, onKillBurning,
   *   onKillPlagued, onPetDeath, slowMoving, onKillDuringChannel
   */
  _fireCombatEvent(eventName, ctx) {
    if (!this.skillManager) return;
    const triggers = this.skillManager.getTriggersForEvent(eventName);
    for (const trig of triggers) {
      this._applyTrigger(trig, ctx);
    }
    // Also fire any matching capstone hooks
    this._checkCapstones(eventName, ctx);
  }

  /**
   * Apply a single conditional_trigger entry. The trigger schema is open —
   * we switch on the trigger's `effect` keys (or `perRank * rank` keys).
   * Unknown effect keys are silently ignored so the engine can grow without
   * breaking the game.
   */
  _applyTrigger(trig, ctx) {
    const effect = trig.effect || {};
    const perRank = trig.perRank || {};
    const rank = trig.rank || 1;

    // Heal % of max HP (e.g. Crimson Surge)
    if (effect.healPctMaxHP) {
      const healAmount = this.player.maxHP * effect.healPctMaxHP;
      this.player.hp = Math.min(this.player.maxHP, this.player.hp + healAmount);
      this._spawnHealNumber(healAmount);
    }
    if (perRank.healPctMaxHP) {
      const healAmount = this.player.maxHP * perRank.healPctMaxHP * rank;
      this.player.hp = Math.min(this.player.maxHP, this.player.hp + healAmount);
      this._spawnHealNumber(healAmount);
    }

    // Spawn AoE nova at the event location (Combustion, Wild Heart, etc.)
    // Schema: { spawnNova: { radius, damageMult } } where damageMult is a
    // fraction of player damage. Centered on ctx.enemy if present, else player.
    if (effect.spawnNova) {
      const nova = effect.spawnNova;
      const cx = (ctx && ctx.enemy) ? ctx.enemy.x : this.player.x;
      const cy = (ctx && ctx.enemy) ? ctx.enemy.y : this.player.y;
      const baseDmg = (this.player.baseDamage || 15) * (nova.damageMult || 1);
      const totalDmg = baseDmg + (this.player.damageBonus || 0);
      this._explosion(cx, cy, nova.radius || 80, totalDmg, null);
      if (this.particles) {
        for (let i = 0; i < 12; i++) {
          this.particles.emit(cx, cy, 1, '#ff6b1a', { speed: 200, life: 0.5, size: 4 });
        }
      }
    }

    // Pandemic: spread plague from a dying enemy to everything in radius.
    // perRank schema: { spreadRadius, spreadRadiusBase } → final = base + rank*per
    if (perRank.spreadRadius && ctx && ctx.enemy) {
      const radius = (perRank.spreadRadiusBase || 0) + perRank.spreadRadius * rank;
      this._spreadStatusInRadius(ctx.enemy, 'plague', radius);
    }

    // Reanimator: onKill chance to spawn a free pet. perRank schema:
    //   { freePetSpawnChance: { petId, values: [0.08, 0.16, 0.25] } }
    if (perRank.freePetSpawnChance) {
      const fps = perRank.freePetSpawnChance;
      const idx = Math.min(rank - 1, (fps.values || []).length - 1);
      const chance = (fps.values && fps.values[idx]) || 0;
      if (chance > 0 && Math.random() < chance && fps.petId) {
        this._spawnNextPet([fps.petId], 'bone_lord');
      }
    }

    // Damage taken multiplier (e.g. Last Stand: -25% when belowHPPct)
    // This is read directly by player.takeDamage — no imperative work here.
  }

  /**
   * Spread a status from a source enemy to ALL nearby enemies in radius
   * (vs `_spreadStatus` which only hits the nearest single target).
   * Used by Pandemic (onKillPlagued) and Death's Echo (capstone).
   *
   * Inherits the source's status payload so the spread infections retain
   * any tree modifiers (Decay duration, Acidic Plague slow, etc.).
   * Sets duration to half the source so chains don't run forever.
   */
  _spreadStatusInRadius(sourceEnemy, statusType, radius, opts = {}) {
    const wave = this.waveSystem || this._waveShim;
    if (!wave || !radius) return 0;
    const sourcePayload = sourceEnemy.statuses && sourceEnemy.statuses[statusType];
    // If source no longer has the status (already cleared by death), use a
    // minimum-viable payload — the resolveStatusPayload tree mods will still apply.
    const baseDps = sourcePayload?.dps || 0;
    const baseDuration = (sourcePayload?.duration || 0);
    const halveDuration = opts.halfDuration !== false; // default true to break chains
    const newDuration = halveDuration ? Math.max(1.0, baseDuration * 0.5) : baseDuration;

    const r2 = radius * radius;
    let count = 0;
    const candidates = [...wave.enemies];
    if (wave.boss && !wave.boss.dead) candidates.push(wave.boss);
    for (const e of candidates) {
      if (e === sourceEnemy || e.dead) continue;
      const dx = e.x - sourceEnemy.x;
      const dy = e.y - sourceEnemy.y;
      if (dx * dx + dy * dy > r2) continue;
      if (!e.applyStatus) continue;
      e.applyStatus(statusType, {
        dps: baseDps,
        duration: newDuration,
        source: 'spread',
        spreadChancePerTick: sourcePayload?.spreadChancePerTick || 0,
        slowPct: sourcePayload?.slowPct || 0,
      });
      count++;
    }
    if (count > 0 && this.particles) {
      const color = this._statusColor(statusType);
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        this.particles.emit(
          sourceEnemy.x + Math.cos(a) * radius * 0.6,
          sourceEnemy.y + Math.sin(a) * radius * 0.6,
          1, color, { speed: 60, life: 0.4, size: 3 }
        );
      }
    }
    return count;
  }

  /**
   * Capstones are gameplay-changing hard-coded handlers keyed by hookId.
   * They register via tree node `capstone_hook` effects and the manager
   * exposes them via skillManager.hasCapstone(hookId).
   */
  _checkCapstones(eventName, ctx) {
    if (!this.skillManager) return;

    // Phoenix (Pyromancer T5): on killing blow, fire a nova for 200% spell
    // damage in a large radius. 8s internal cooldown.
    if (eventName === 'onKill' && this.skillManager.hasCapstone('pyromancer_phoenix')) {
      const now = performance.now() / 1000;
      if (!this._phoenixCooldownUntil || now > this._phoenixCooldownUntil) {
        this._phoenixCooldownUntil = now + 8.0;
        const enemy = ctx && ctx.enemy;
        const novaX = enemy ? enemy.x : this.player.x;
        const novaY = enemy ? enemy.y : this.player.y;
        const baseDmg = (this.player.baseDamage || 15) * 2.0;  // 200% spell damage
        const totalDmg = baseDmg + this.player.damageBonus;
        this._explosion(novaX, novaY, 180, totalDmg, null);
        if (this.particles) {
          for (let i = 0; i < 30; i++) {
            this.particles.emit(novaX, novaY, 1, '#ff6600', { speed: 280, life: 0.8, size: 5 });
          }
        }
        this.screenShake = Math.max(this.screenShake || 0, 0.3);
        this.waveAnnouncement = { wave: 0, timer: 1.2, text: '★ PHOENIX ★' };
      }
    }

    // Death's Echo (Plaguebringer T5): a plagued enemy that dies releases a
    // corpse explosion (large AoE damage) AND re-applies plague to anything
    // it hits. The re-application has 50% reduced duration to break chains.
    if (eventName === 'onKillPlagued' && this.skillManager.hasCapstone('plaguebringer_deaths_echo')) {
      const enemy = ctx && ctx.enemy;
      if (enemy) {
        const baseDmg = (this.player.baseDamage || 15) * 1.5;
        const totalDmg = baseDmg + (this.player.damageBonus || 0);
        const radius = 150;
        this._explosion(enemy.x, enemy.y, radius, totalDmg, null);
        // Re-apply plague to everything in radius (with halved duration via _spreadStatusInRadius default)
        this._spreadStatusInRadius(enemy, 'plague', radius);
        if (this.particles) {
          for (let i = 0; i < 24; i++) {
            this.particles.emit(enemy.x, enemy.y, 1, '#7aaa30', { speed: 220, life: 0.7, size: 4 });
          }
        }
        this.screenShake = Math.max(this.screenShake || 0, 0.25);
      }
    }

    // Absolute Zero (Cryomancer T5): a frozen enemy that dies explodes in
    // a smaller Frost Nova that chain-freezes nearby enemies. Spec says
    // "killed by Frost Shard" but we accept any kill while frozen for
    // implementation simplicity (the only way to freeze enemies is via
    // Cryomancer attacks anyway).
    if (eventName === 'onKillFrozen' && this.skillManager.hasCapstone('cryomancer_absolute_zero')) {
      const enemy = ctx && ctx.enemy;
      if (enemy) {
        const radius = 110;
        const baseDmg = (this.player.baseDamage || 15) * 0.8;
        const totalDmg = baseDmg + (this.player.damageBonus || 0);
        this._explosion(enemy.x, enemy.y, radius, totalDmg, null);
        // Chain-freeze: apply frozen to every enemy in radius (no chain
        // halving — it's a capstone after all)
        const wave = this.waveSystem || this._waveShim;
        if (wave) {
          const candidates = [...wave.enemies];
          if (wave.boss && !wave.boss.dead) candidates.push(wave.boss);
          for (const e of candidates) {
            if (e === enemy || e.dead || !e.applyStatus) continue;
            const dx = e.x - enemy.x;
            const dy = e.y - enemy.y;
            if (dx * dx + dy * dy < radius * radius) {
              e.applyStatus('frozen', { duration: 1.5, source: 'absolute_zero' });
            }
          }
        }
        if (this.particles) {
          for (let i = 0; i < 20; i++) {
            this.particles.emit(enemy.x, enemy.y, 1, '#5fb8e0', { speed: 200, life: 0.7, size: 4 });
          }
        }
      }
    }
  }

  /**
   * Pull the active damage-taken multiplier from passive triggers.
   *
   * Currently handles:
   *   - Last Stand (Guardian T4): -25% damage taken when below 30% HP
   *
   * Returns a multiplier in [0..1] (1.0 = no reduction).
   */
  _getActiveDamageTakenMult() {
    if (!this.skillManager || !this.player) return 1.0;
    const triggers = this.skillManager.getTriggersForEvent('belowHPPct');
    if (!triggers || triggers.length === 0) return 1.0;
    let mult = 1.0;
    const hpPct = this.player.hp / this.player.maxHP;
    for (const trig of triggers) {
      const effect = trig.effect || {};
      const threshold = effect.hpThreshold;
      const dmgMult = effect.damageTakenMult;
      if (typeof threshold === 'number' && typeof dmgMult === 'number' && hpPct <= threshold) {
        mult *= (1 + dmgMult); // dmgMult is negative for reductions (e.g. -0.25)
      }
    }
    return Math.max(0, mult);
  }

  _spawnHealNumber(amount) {
    if (!this.damageNumbers || amount <= 0) return;
    this.damageNumbers.spawn(this.player.x, this.player.y - this.player.radius - 8, '+' + Math.round(amount), false, '#7be07b');
  }

  _statusColor(type) {
    switch (type) {
      case 'burning':  return '#ff6b1a';
      case 'plagued':  return '#7aaa30';
      case 'bleeding': return '#cc2222';
      case 'frozen':   return '#5fb8e0';
      default:         return '#bbbbbb';
    }
  }

  /**
   * Spread a status from one enemy to a nearby uninfected enemy. Used by
   * Wildfire (burning) and Contagion (plagued). The new infection inherits
   * the same dps/duration/spreadChancePerTick as the source so chains can
   * cascade. Spread radius is fixed at 180px.
   */
  _spreadStatus(sourceEnemy, statusType, payload, wave) {
    if (!wave) return;
    const r2 = 180 * 180;
    let target = null;
    let bestDist = Infinity;
    const candidates = [...wave.enemies];
    if (wave.boss && !wave.boss.dead) candidates.push(wave.boss);
    for (const e of candidates) {
      if (e === sourceEnemy || e.dead) continue;
      if (e.hasStatus && e.hasStatus(statusType)) continue;
      const dx = e.x - sourceEnemy.x;
      const dy = e.y - sourceEnemy.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;
      if (d2 < bestDist) {
        bestDist = d2;
        target = e;
      }
    }
    if (target && target.applyStatus) {
      target.applyStatus(statusType, {
        dps: payload.dps,
        duration: payload.duration,
        source: 'spread',
        spreadChancePerTick: payload.spreadChancePerTick,
        slowPct: payload.slowPct,
      });
      // Visual: small particle trail from source to target
      if (this.particles) {
        const color = this._statusColor(statusType);
        this.particles.emit(target.x, target.y, 6, color, { speed: 80, life: 0.4, size: 3 });
      }
    }
  }

  /**
   * Apply a status payload from an attack to a target enemy. The attack
   * carries the BASE statusApply (e.g. { status: 'burning', dps: 5,
   * duration: 3, chance: 1.0 }); we run it through resolveStatusPayload
   * so any tree node modifiers (Burning Soul +dps%, Decay +duration, etc.)
   * are applied. The chance roll happens here.
   */
  _applyStatusFromAttack(attackOrPayload, target) {
    if (!target || !attackOrPayload) return;
    // Accept either a resolved attack (with statusApply) or a raw payload
    const base = attackOrPayload.statusApply || attackOrPayload;
    if (!base || !base.status) return;

    // Chance roll
    const chance = base.chance != null ? base.chance : 1.0;
    if (chance < 1.0 && Math.random() > chance) return;

    // Resolve through tree modifiers (Burning Soul, Decay, Wildfire, etc.)
    const resolved = this.skillManager
      ? this.skillManager.resolveStatusPayload(base.status, base)
      : base;

    // STA resistance: shorten duration
    const sta = (this.player && this.player.attributes && this.player.attributes.sta) || 0;
    const resistFactor = Math.max(0.2, 1 - sta * 0.005); // light resistance for enemies
    const finalPayload = {
      ...resolved,
      duration: (resolved.duration || base.duration || 0) * resistFactor,
      source: 'player',
    };

    target.applyStatus(base.status, finalPayload);
  }

  /**
   * Hit-time damage modifier — applied to a single damage number against
   * a single target right before it's dealt. Walks all relevant
   * conditional triggers and stacks any that apply to the target's state.
   *
   * Supported triggers:
   *   - vsHighHP        Dead Eye (Marksman T4): +100% vs above 90% HP
   *   - vsBleeding      Hunter's Mark (Marksman T2): +x% to bleeding targets
   *   - vsFrozen        Shatter (Cryomancer T2): +x% crit dmg vs frozen
   *   - vsSlowed        Ice Lance (Cryomancer T2): +x% to slowed targets
   *   - vsSlowedOrFrozen Cold Edge (Cryomancer T1): +x% crit chance
   *   - vsPlagued       Festering Wounds / Necrotic Corrosion (Plaguebringer T2)
   *
   * @param {number} damage    base damage about to be applied
   * @param {object} target    enemy entity
   * @param {string} attackId  optional — only triggers targeting this attack apply
   * @returns {number} modified damage
   */
  _modifyDamageOnHit(damage, target, attackId) {
    if (!this.skillManager || !target) return damage;
    let mult = 1.0;

    const eventChecks = [
      { event: 'vsHighHP',         applies: () => { const pct = target.maxHP > 0 ? target.hp / target.maxHP : 1; return pct; } },
      { event: 'vsBleeding',       applies: () => target.hasStatus && target.hasStatus('bleeding') },
      { event: 'vsFrozen',         applies: () => target.hasStatus && target.hasStatus('frozen') },
      { event: 'vsSlowed',         applies: () => (target.hasStatus && target.hasStatus('slowed')) || (target.slowTimer && target.slowTimer > 0) },
      { event: 'vsSlowedOrFrozen', applies: () => (target.hasStatus && (target.hasStatus('frozen') || target.hasStatus('slowed'))) || (target.slowTimer && target.slowTimer > 0) },
      { event: 'vsPlagued',        applies: () => target.hasStatus && target.hasStatus('plagued') },
    ];

    for (const { event, applies } of eventChecks) {
      const triggers = this.skillManager.getTriggersForEvent(event);
      if (!triggers || triggers.length === 0) continue;
      const condition = applies();
      // For vsHighHP the "applies" function returns the hp pct so per-trigger
      // hpThreshold can be checked. For others it's a boolean.
      for (const trig of triggers) {
        if (trig.target && attackId && trig.target !== attackId) continue;
        const eff = trig.effect || {};
        const perRank = trig.perRank || {};
        const rank = trig.rank || 1;

        if (event === 'vsHighHP') {
          if (typeof eff.hpThreshold === 'number' && condition >= eff.hpThreshold && typeof eff.damageMult === 'number') {
            mult *= (1 + eff.damageMult);
          }
        } else if (condition) {
          // Generic damageDealtMult perRank — used by Hunter's Mark, Festering Wounds, etc.
          if (typeof perRank.damageDealtMult === 'number') {
            mult *= (1 + perRank.damageDealtMult * rank);
          }
          // damageMult perRank — used by Ice Lance
          if (typeof perRank.damageMult === 'number') {
            mult *= (1 + perRank.damageMult * rank);
          }
          // Effect-form damageMult — used by Dead Eye-style triggers
          if (typeof eff.damageMult === 'number') {
            mult *= (1 + eff.damageMult);
          }
        }
      }
    }

    return damage * mult;
  }

  // Helper used by _updateSkillSlotHUD: which spec does an attack belong to?
  _findSpecForAttack(attackId) {
    if (!this.skillManager) return null;
    for (const specKey of this.skillManager.getSpecs()) {
      const spec = this.skillManager.getSpec(specKey);
      if (!spec || !spec.specData) continue;
      if (spec.specData.primary && spec.specData.primary.id === attackId) return specKey;
      if (spec.specData.secondary && spec.specData.secondary.id === attackId) return specKey;
    }
    return null;
  }

  // Count how many of a consumable the player has in inventory. Used by
  // the HUD to render the stack badge on bound action bar slots, and by
  // the consumable cast path to detect "out of stock" before charging
  // the cooldown. Auto-refill is implicit because this is read every frame
  // — when a new stack arrives via addItem(), the next frame's render
  // shows it on the bound slot automatically.
  _getConsumableStack(consumableId) {
    if (!this.inventory || typeof this.inventory.countByBaseType !== 'function') return 0;
    try { return this.inventory.countByBaseType(consumableId) || 0; }
    catch { return 0; }
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
      // The waystone UI already handled the soft "are you sure?" confirmation
      // for overleveled travel. There is NO hard player-level lock — every
      // discovered floor is reachable.
      this.audio.waystoneTravel();
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
      this.hud.render({
        canvasWidth: this.canvas.width,
        canvasHeight: this.canvas.height,
        saveIndicatorTimer: this._saveIndicatorTimer,
      });

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

    // Screen-edge trap warning shimmer
    if (this.trapManager) {
      const allTraps = this.trapManager.activeTraps || [];
      let nearbyTrapCount = 0;
      for (const trap of allTraps) {
        const dx = trap.x - this.player.x;
        const dy = trap.y - this.player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 250) nearbyTrapCount++;
      }
      if (nearbyTrapCount > 0) {
        const ctx = r.ctx;
        ctx.save();
        const pulse = 0.3 + 0.2 * Math.sin(performance.now() / 300);
        ctx.strokeStyle = `rgba(255, 100, 100, ${pulse * Math.min(1, nearbyTrapCount / 3)})`;
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, this.canvas.width - 4, this.canvas.height - 4);
        ctx.restore();
      }
    }

    // Corpses (necromancer)
    r.drawCorpses(this.corpses);

    // v3 status clouds (Outbreak lingering plague, etc.)
    if (this.statusClouds && this.statusClouds.length > 0) {
      const ctx = r.ctx;
      ctx.save();
      for (const cloud of this.statusClouds) {
        const sx = cloud.x - r.camera.x;
        const sy = cloud.y - r.camera.y;
        const fade = Math.min(1, (cloud.duration - cloud.elapsed) / 1.0);
        const pulse = 0.5 + 0.5 * Math.sin(cloud.elapsed * 6);
        // Fill
        ctx.globalAlpha = fade * 0.18;
        ctx.fillStyle = cloud.color;
        ctx.beginPath();
        ctx.arc(sx, sy, cloud.radius, 0, Math.PI * 2);
        ctx.fill();
        // Pulsing border
        ctx.globalAlpha = fade * (0.4 + 0.3 * pulse);
        ctx.strokeStyle = cloud.color;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      ctx.restore();
    }

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

    // Minions (legacy)
    r.drawMinions(this.minions);

    // Pets (v3 spec-tree)
    r.drawPets(this.pets);

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

    // Stairs interaction prompt
    if (this._nearStairs && this.dungeonManager && this.dungeonManager.stairsPosition) {
      const sp = this.dungeonManager.stairsPosition;
      const sx = sp.x - r.camera.x;
      const sy = sp.y - r.camera.y;
      r.ctx.font = 'bold 13px "Segoe UI", sans-serif';
      r.ctx.fillStyle = '#f1c40f';
      r.ctx.textAlign = 'center';
      r.ctx.fillText('[E] Descend to next floor', sx, sy + 45);
    }

    // Waystone interaction prompt (in dungeon)
    if (this._nearWaystone && this.dungeon) {
      const entrance = this.dungeon.rooms.find(r2 => r2.id === this.dungeon.entranceRoomId);
      if (entrance && entrance.waystone) {
        const wx = entrance.waystone.x - r.camera.x;
        const wy = entrance.waystone.y - r.camera.y;
        r.ctx.font = 'bold 13px "Segoe UI", sans-serif';
        r.ctx.fillStyle = '#3498db';
        r.ctx.textAlign = 'center';
        r.ctx.fillText('[E] Use Way Stone', wx, wy + 35);
      }
    }

    // Return portal interaction prompt (in camp after teleport scroll)
    if (this._nearReturnPortal && this._returnPortalPos) {
      const px = this._returnPortalPos.x - r.camera.x;
      const py = this._returnPortalPos.y - r.camera.y;
      r.ctx.font = 'bold 13px "Segoe UI", sans-serif';
      r.ctx.fillStyle = '#d6a8ff';
      r.ctx.textAlign = 'center';
      r.ctx.fillText('[E] Return to Dungeon', px, py + 45);
    }

    // Minimap — show whenever player is in a dungeon (PLAYING state)
    if (this.state === 'PLAYING' && this.dungeon && this.dungeonManager && r.drawDungeonMinimap) {
      r.drawDungeonMinimap(
        this.player,
        this.dungeon,
        this.dungeonManager,
        this.dungeonManager.getActiveEnemies ? this.dungeonManager.getActiveEnemies() : [],
        this.dungeonManager.boss || null
      );
    } else if (this.state === 'PLAYING' && this.dungeon && this.dungeonManager) {
      // Fallback: use generic drawMinimap with dungeon enemies/boss
      r.drawMinimap(
        this.player,
        (this.dungeonManager.getActiveEnemies ? this.dungeonManager.getActiveEnemies() : []).filter(e => !e.dead),
        this.dungeonManager.boss && !this.dungeonManager.boss.dead ? this.dungeonManager.boss : null,
        []
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

    // Low HP vignette overlay
    if (this.player && this.player.hp > 0) {
      const hpPct = this.player.hp / this.player.maxHP;
      if (hpPct < 0.30) {
        const ctx = r.ctx;
        const intensity = (1 - hpPct / 0.30); // 0 at 30% hp, 1 at 0 hp
        const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 200);
        const alpha = intensity * 0.4 * (0.7 + pulse * 0.3);
        ctx.save();
        const grad = ctx.createRadialGradient(
          this.canvas.width / 2, this.canvas.height / 2, this.canvas.width * 0.3,
          this.canvas.width / 2, this.canvas.height / 2, this.canvas.width * 0.7
        );
        grad.addColorStop(0, 'rgba(255, 0, 0, 0)');
        grad.addColorStop(1, `rgba(180, 0, 0, ${alpha})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        ctx.restore();
      }
    }

    // Canvas HUD (Diablo 2-style globes and action bar)
    this.hud.render({
      canvasWidth: this.canvas.width,
      canvasHeight: this.canvas.height,
      saveIndicatorTimer: this._saveIndicatorTimer,
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
