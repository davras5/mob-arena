import { Player } from './entities/player.js';
import { Projectile } from './entities/projectile.js';
import { Enemy } from './entities/enemy.js';
import { Minion } from './entities/minion.js';
import { Input } from './input.js';
import { Renderer } from './renderer.js';
import { WaveSystem } from './systems/wave.js';
import { CollisionSystem } from './systems/collision.js';
import { ParticleSystem } from './systems/particles.js';
import { HUD } from './ui/hud.js';
import { BlessingPicker } from './ui/blessingPicker.js';
import { GameOverUI } from './ui/gameOver.js';
import { WorldMap } from './ui/worldMap.js';
import { AudioSystem } from './systems/audio.js';
import { DamageNumbers } from './systems/damageNumbers.js';
import { LevelClearUI } from './ui/levelClear.js';
import { ClassPicker } from './ui/classPicker.js';
import { LayoutManager } from './systems/layout.js';

const MAP_WIDTH = 1600;
const MAP_HEIGHT = 1600;

export class Game {
  constructor(canvas, abilitiesData, wavesData, levelsData, classesData, synergiesData) {
    this.canvas = canvas;
    this.abilitiesData = abilitiesData;
    this.wavesData = wavesData;
    this.levelsData = levelsData || [];
    this.classesData = classesData || {};
    this.synergiesData = synergiesData || [];

    this.input = new Input(canvas);
    this.renderer = new Renderer(canvas);
    this.collision = new CollisionSystem(64);
    this.particles = new ParticleSystem();
    this.hud = new HUD();
    this.blessingPicker = new BlessingPicker();
    this.gameOverUI = new GameOverUI();
    this.audio = new AudioSystem();
    this.damageNumbers = new DamageNumbers();
    this.worldMap = new WorldMap();
    this.levelClearUI = new LevelClearUI();
    this.classPicker = new ClassPicker();

    this.state = 'MENU';
    this.currentLevel = null;
    this.selectedClass = null;
    this.layoutManager = null;
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
    this.isPicking = false;
    this.pendingLevelUp = false;

    // Player trail effect
    this.playerTrail = [];

    // Wave announcement banner
    this.waveAnnouncement = { wave: 0, timer: 0 };

    // Combo system
    this.combo = 0;
    this.comboTimer = 0;
    this.bestCombo = 0;
    this.comboDisplay = { count: 0, timer: 0 };

    // Score & kill tracking
    this.score = 0;
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
    // Reset run state
    this.projectiles = [];
    this.minions = [];
    this.corpses = [];
    this.fireTrails = [];
    this.chainLightnings = [];
    this.particles.particles = [];
    this.isPicking = false;
    this.pendingLevelUp = false;
    this.playerTrail = [];
    this.waveAnnouncement = { wave: 0, timer: 0 };
    this.combo = 0;
    this.comboTimer = 0;
    this.bestCombo = 0;
    this.comboDisplay = { count: 0, timer: 0 };
    this.score = 0;
    this.kills = { grunt: 0, rusher: 0, brute: 0, ranged: 0, splitter: 0, necromancer_enemy: 0, burrower: 0, shielder: 0, bomber: 0, boss: 0 };
    this.clearedLevels = [];
    this.currentLevel = null;
    this.levelClearTimer = 0;
    this.meleeSweep = null;
    this.meteorWarning = null;
    this.rainArrows = [];
    this.echoTarget = null;
    this.gravitonOrbs = [];
    this.bladeHitTimers = new Map();

    document.getElementById('menu-screen').classList.add('hidden');

    // Show class picker
    this.selectedClass = await this.classPicker.show(this.classesData);

    // Create player with chosen class
    this.player = new Player(MAP_WIDTH / 2, MAP_HEIGHT / 2, this.selectedClass);

    this.hud.updateHP(this.player.hp, this.player.maxHP);
    this.hud.updateXP(0, this.player.xpToNext, 1);
    this.hud.updateWave(1);
    this.hud.updateScore(0);
    this.hud.hideBossHP();

    // Show world map to pick first level
    this._showWorldMap();
  }

  _showWorldMap() {
    this.state = 'WORLD_MAP';
    this.worldMap.show(this.levelsData, this.clearedLevels, (level) => {
      this.startLevel(level);
    });
  }

  startLevel(levelConfig) {
    this.currentLevel = levelConfig;

    // Configure renderer theme and map dimensions
    this.renderer.setTheme(levelConfig);

    const mw = levelConfig.mapWidth || MAP_WIDTH;
    const mh = levelConfig.mapHeight || MAP_HEIGHT;

    // Create layout manager
    this.layoutManager = new LayoutManager(mw, mh, levelConfig.layout || null);
    this.renderer.setLayout(this.layoutManager);

    // Reset player position to center of the new map (keep abilities/stats/hp)
    this.player.x = mw / 2;
    this.player.y = mh / 2;

    // If rooms exist, find the start room center
    if (levelConfig.layout && levelConfig.layout.rooms && levelConfig.layout.rooms.length > 0) {
      const startRoom = levelConfig.layout.rooms.find(r => r.id === 'entrance') || levelConfig.layout.rooms[0];
      this.player.x = startRoom.x + startRoom.width / 2;
      this.player.y = startRoom.y + startRoom.height / 2;
    }

    // Clear transient state but keep player abilities/stats/hp/score/kills
    this.projectiles = [];
    this.minions = [];
    this.corpses = [];
    this.fireTrails = [];
    this.chainLightnings = [];
    this.particles.particles = [];
    this.playerTrail = [];
    this.isPicking = false;
    this.pendingLevelUp = false;
    this.meleeSweep = null;
    this.meteorWarning = null;
    this.rainArrows = [];

    // Create wave system with level-specific wave data
    const levelWaves = this._generateLevelWaves(levelConfig);
    this.waveSystem = new WaveSystem(levelWaves);
    this.waveSystem.mapWidth = mw;
    this.waveSystem.mapHeight = mh;
    this.waveSystem.setLevelConfig(levelConfig);
    this.waveSystem.layoutManager = this.layoutManager;

    // Start playing
    this.state = 'PLAYING';
    this.waveAnnouncement = { wave: 1, timer: 2.0 };
    this.hud.updateWave(1);
    this.hud.updateLevelName(levelConfig.name);
    this.hud.hideBossHP();

    this.waveSystem.startWave(1);
  }

  _generateLevelWaves(levelConfig) {
    const waves = [];
    const totalWaves = levelConfig.waves || 5;
    const types = levelConfig.enemyTypes || ['grunt'];

    for (let w = 1; w <= totalWaves; w++) {
      const isFinal = w === totalWaves;
      const enemies = [];

      // Scale enemy count with wave number within the level
      for (const type of types) {
        enemies.push({
          type,
          count: Math.round(3 + w * 1.2 + (levelConfig.difficulty || 1) * 0.5),
        });
      }

      const config = {
        wave: w,
        enemies,
        blessings: isFinal ? 2 : 1,
      };

      if (isFinal && levelConfig.boss) {
        config.boss = levelConfig.boss;
      }

      waves.push(config);
    }

    return waves;
  }

  update(dt) {
    if (this.state !== 'PLAYING' && this.state !== 'WAVE_CLEAR' && this.state !== 'COUNTDOWN' && this.state !== 'LEVEL_CLEAR') return;

    // Handle LEVEL_CLEAR state - just update visuals while UI is showing
    if (this.state === 'LEVEL_CLEAR') {
      if (this.waveAnnouncement.timer > 0) this.waveAnnouncement.timer -= dt;
      this.particles.update(dt);
      return;
    }

    this.time += dt;
    this.input.update();

    const player = this.player;
    const wave = this.waveSystem;

    // Current map dimensions (from level or default)
    const mapW = this.renderer.mapWidth;
    const mapH = this.renderer.mapHeight;

    // Player movement
    player.update(dt, this.input.moveVector, mapW, mapH);

    // Layout-aware clamping for player
    if (this.layoutManager) {
      const clamped = this.layoutManager.clampPosition(player.x, player.y, player.radius);
      player.x = clamped.x;
      player.y = clamped.y;

      // Hazard damage to player
      const hazardDmg = this.layoutManager.getHazardDamage(player.x, player.y);
      if (hazardDmg > 0) {
        player.takeDamage(hazardDmg * dt);
      }
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

    // Combo timer decay
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.combo = 0;
      }
    }
    if (this.comboDisplay.timer > 0) this.comboDisplay.timer -= dt;

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

    // Auto-aim at nearest enemy
    let nearestEnemy = null;
    let nearestDist = Infinity;
    const allTargets = [...wave.enemies.filter(e => !e.dead)];
    if (wave.boss && !wave.boss.dead) allTargets.push(wave.boss);

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

    for (const e of allTargets) {
      const dx = e.x - player.x;
      const dy = e.y - player.y;
      const d = Math.sqrt(dx * dx + dy * dy);

      // Bias toward enemies in movement direction (smart target prioritization)
      let bias = 1.0;
      if (this.input.moveVector.x !== 0 || this.input.moveVector.y !== 0) {
        const dotProduct = (dx / d) * this.input.moveVector.x + (dy / d) * this.input.moveVector.y;
        bias = dotProduct > 0 ? 0.7 : 1.3; // Prefer enemies in front
      }

      const effectiveDist = d * bias;
      if (effectiveDist < nearestDist) {
        nearestDist = effectiveDist;
        nearestEnemy = e;
      }
    }

    if (nearestEnemy) {
      // Lead-target aiming: predict where the enemy will be when the projectile arrives
      const dx = nearestEnemy.x - player.x;
      const dy = nearestEnemy.y - player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const projSpeed = player.projectileSpeed || 300;
      const timeToHit = projSpeed > 0 ? dist / projSpeed : 0;

      // Estimate enemy velocity toward player
      const eSpeed = nearestEnemy.speed || 50;
      const eDx = player.x - nearestEnemy.x;
      const eDy = player.y - nearestEnemy.y;
      const eDist = Math.max(1, Math.sqrt(eDx * eDx + eDy * eDy));
      const eVx = (eDx / eDist) * eSpeed;
      const eVy = (eDy / eDist) * eSpeed;

      // Predicted position
      const predX = nearestEnemy.x + eVx * timeToHit;
      const predY = nearestEnemy.y + eVy * timeToHit;

      player.aimAngle = Math.atan2(predY - player.y, predX - player.x);
    }

    // Unique ability on right tap (replaces dash for classes)
    if (this.input.consumeRightTap()) {
      this._tryUniqueAbility();
    }

    // Auto-attack
    const effectiveRange = player.getAttackRange();
    if (nearestEnemy && player.canAttack() && nearestDist < effectiveRange) {
      if (player.playerClass === 'warrior') {
        this._warriorMeleeAttack();
      } else {
        this._playerShoot(nearestEnemy);
      }
    }

    // Spell echo
    if (player.echoQueued && player.echoTimer <= 0) {
      player.echoQueued = false;
      if (this.echoTarget && !this.echoTarget.dead) {
        this._playerShoot(this.echoTarget, player.echoDamageMult);
      }
    }

    // Mage: meteor auto-trigger
    if (player.meteorCooldown > 0 && player.meteorTimer <= 0 && !this.meteorWarning) {
      this._triggerMeteor();
      player.meteorTimer = player.meteorCooldown;
    }

    // Archer: rain of arrows auto-trigger
    if (player.rainCooldown > 0 && player.rainTimer <= 0) {
      this._triggerRainOfArrows();
      player.rainTimer = player.rainCooldown;
    }

    // Necromancer: dark pact auto-trigger
    if (player.pactCooldown > 0 && player.pactTimer <= 0 && this.minions.length > 0 && !player.pactReady) {
      this._triggerDarkPact();
      player.pactTimer = player.pactCooldown;
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
            this.projectiles.push(new Projectile(
              e.x, e.y,
              (dx / dist) * speed, (dy / dist) * speed,
              e.damage, true
            ));
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
              player.takeDamage(action.damage);
              this.screenShake = 0.3;
            }
            this.particles.emit(action.x, action.y, 20, '#7f8c8d', { speed: 150, life: 0.5 });
          }
          if (action.type === 'summon') {
            wave.addEnemiesFromBoss(action.summonType || 'grunt', action.count, action.x, action.y);
          }
          if (action.type === 'freeze_ray') {
            // Slow player if in radius
            const fdx = player.x - action.x;
            const fdy = player.y - action.y;
            if (Math.sqrt(fdx * fdx + fdy * fdy) < action.radius) {
              // Apply slow effect via a brief invuln-piercing slow
              player.speed *= (1 - action.slow);
              setTimeout(() => { player.speed = player.baseSpeed * player.speedMult; }, action.duration * 1000);
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
                  player.takeDamage(action.damage);
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
            player.takeDamage(rift.damage * dt);
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

    // Collision: projectiles vs enemies
    this._checkProjectileCollisions();

    // Collision: enemies vs player
    this._checkEnemyPlayerCollisions(dt);

    // Collision: boss vs player
    if (wave.boss && !wave.boss.dead) {
      const bDist = this.collision.distanceBetween(player, wave.boss);
      if (bDist < player.radius + wave.boss.radius && wave.boss.contactCooldown <= 0) {
        const dmg = this._applyDamageToPlayer(wave.boss.damage);
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

    // Update blessing timers
    for (const b of wave.blessings) {
      b.update(dt);
    }
    wave.blessings = wave.blessings.filter(b => !b.expired);

    // Collision: player vs blessings on map (collectible anytime)
    for (const b of wave.blessings) {
      if (b.collected) continue;
      const dx = player.x - b.x;
      const dy = player.y - b.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Magnet pull
      if (dist < player.magnetRange) {
        const pull = 200 * dt;
        const pdist = Math.max(1, dist);
        b.x += (dx / pdist) * pull;
        b.y += (dy / pdist) * pull;
      }

      if (dist < b.radius) {
        b.collected = true;
        this.particles.confetti(b.x, b.y);
        this._pickBlessing();
      }
    }

    // Check wave clear — all enemies killed → open blessing picker (end-of-round reward)
    if (this.state === 'PLAYING' && wave.checkWaveClear()) {
      this.state = 'WAVE_CLEAR';
      this.hud.hideBossHP();
      this.hud.updateEnemyCount(0, wave.totalEnemies || 0);
      this.particles.confetti(player.x, player.y);
      this.audio.waveClear();
      this.renderer.flash('#2ecc71', 0.3);
      // Spawn blessings on map
      wave.triggerWaveClear();
      // Also give end-of-round blessing picker
      this._pickBlessing();
    }

    // After blessing is picked, start countdown to next wave
    if (this.state === 'WAVE_CLEAR' && !this.isPicking) {
      this.state = 'COUNTDOWN';
      wave.startCountdown(3);
    }

    // Countdown
    if (this.state === 'COUNTDOWN') {
      this.hud.showCountdown(wave.countdownTimer);
      if (wave.updateCountdown(dt)) {
        this.hud.hideCountdown();

        // Check if this was the last wave of the level
        if (this.currentLevel && wave.currentWave >= this.currentLevel.waves) {
          // Level complete!
          if (!this.clearedLevels.includes(this.currentLevel.id)) {
            this.clearedLevels.push(this.currentLevel.id);
          }
          this.state = 'LEVEL_CLEAR';
          this.waveAnnouncement = { wave: 0, timer: 2.5, text: 'Level Clear!' };
          this.renderer.flash('#f1c40f', 0.5);
          this.particles.levelClear(player.x, player.y);
          this._showLevelClearUI();
        } else {
          const nextWave = wave.currentWave + 1;
          this.hud.updateWave(nextWave);
          wave.startWave(nextWave);
          this.state = 'PLAYING';
          this.waveAnnouncement = { wave: nextWave, timer: 2.0 };
          if (wave.boss) this.audio.bossAppear();
        }
      }
    }

    // Clean up dead
    this.projectiles = this.projectiles.filter(p => !p.dead);
    wave.enemies = wave.enemies.filter(e => !e.dead || this._handleSplitter(e));

    // Screen shake decay
    if (this.screenShake > 0) this.screenShake -= dt;

    // Particles
    this.particles.update(dt);

    // Damage numbers
    this.damageNumbers.update(dt);

    // Player death
    if (player.hp <= 0) {
      this.state = 'GAME_OVER';
      this.audio.gameOver();
      this._showGameOver();
    }

    // HUD
    this.hud.updateHP(player.hp, player.maxHP);

    // Level-up blessing picker
    if (this.pendingLevelUp && !this.isPicking) {
      this.pendingLevelUp = false;
      this._pickBlessing();
    }
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

    const dmg = isCrit ? player.getEffectiveDamage() * 2 : player.getEffectiveDamage();

    // Visual sweep
    this.meleeSweep = { x: player.x, y: player.y, angle, arc: player.sweepAngle, range, timer: 0.15 };

    // Hit all enemies in arc
    const wave = this.waveSystem;
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

    const dmg = isCrit ? baseDmg * 2 : baseDmg;

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
    const wave = this.waveSystem;
    const player = this.player;

    for (const p of this.projectiles) {
      if (p.dead) continue;

      if (p.isEnemy) {
        // Enemy projectile vs player
        const dx = player.x - p.x;
        const dy = player.y - p.y;
        if (Math.sqrt(dx * dx + dy * dy) < player.radius + p.radius) {
          this._applyDamageToPlayer(p.damage);
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
    const wave = this.waveSystem;
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
    const wave = this.waveSystem;
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
          const wave = self.waveSystem;
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
    const wave = this.waveSystem;
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
    const wave = this.waveSystem;
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

  // === CHAIN REACTION ===
  _chainReactionExplosion(x, y, depth) {
    if (depth >= 3) return; // Cap recursion
    const player = this.player;
    const wave = this.waveSystem;
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
  _checkSynergies() {
    const player = this.player;
    const abilityIds = player.abilities.map(a => a.id);
    player.activeSynergies = [];

    for (const syn of this.synergiesData) {
      let active = false;

      if (syn.requires) {
        active = syn.requires.every(id => abilityIds.includes(id));
      } else if (syn.requiresAll && syn.requiresAny) {
        const hasAll = syn.requiresAll.every(id => abilityIds.includes(id));
        const hasAny = syn.requiresAny.some(id => abilityIds.includes(id));
        active = hasAll && hasAny;
      }

      if (active) {
        player.activeSynergies.push(syn.id);
      }
    }
  }

  // === DAMAGE APPLICATION WITH SOUL LINK ===
  _applyDamageToPlayer(amount) {
    const player = this.player;

    // Necromancer soul link: redirect damage to minions
    if (player.soulLinkPercent > 0 && this.minions.length > 0) {
      const redirected = amount * player.soulLinkPercent;
      amount -= redirected;
      const targetMinion = this.minions[Math.floor(Math.random() * this.minions.length)];
      targetMinion.takeDamage(redirected);
    }

    const dmg = player.takeDamage(amount);

    // Frost nova on hit
    if (dmg > 0 && player.novaRadius > 0 && player.novaTimer <= 0) {
      player.novaTimer = player.novaCooldown;
      const wave = this.waveSystem;
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
    const wave = this.waveSystem;

    for (const e of wave.enemies) {
      if (e.dead || e.contactCooldown > 0) continue;

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

        const dmg = this._applyDamageToPlayer(e.damage);
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

    // Score system
    const SCORE_TABLE = { grunt: 10, rusher: 15, brute: 50, ranged: 20, splitter: 25, necromancer_enemy: 30, burrower: 25, shielder: 35, bomber: 20 };
    const isBoss = enemy.constructor.name === 'Boss';
    const basePoints = isBoss ? 500 : (SCORE_TABLE[enemy.type] || 10);
    const waveMultiplier = this.waveSystem ? this.waveSystem.currentWave : 1;
    this.score += basePoints * waveMultiplier;
    this.hud.updateScore(this.score);

    // Kill tracking
    if (isBoss) {
      this.kills.boss++;
    } else if (this.kills.hasOwnProperty(enemy.type)) {
      this.kills[enemy.type]++;
    }

    // Combo system
    this.combo++;
    this.comboTimer = 2.0;
    if (this.combo > this.bestCombo) this.bestCombo = this.combo;
    if (this.combo >= 3) {
      this.comboDisplay = { count: this.combo, timer: 2.0 };
    }

    // XP multiplier from combo
    let xpMultiplier = 1;
    if (this.combo >= 10) xpMultiplier = 3;
    else if (this.combo >= 5) xpMultiplier = 2;
    else if (this.combo >= 3) xpMultiplier = 1.5;

    // Award XP
    const xp = (enemy.xp || 0) * xpMultiplier;
    const leveled = this.player.addXP(xp);
    this.hud.updateXP(this.player.xp, this.player.xpToNext, this.player.level);
    this.hud.updateHP(this.player.hp, this.player.maxHP);
    if (leveled) {
      this.pendingLevelUp = true;
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
        this._applyDamageToPlayer(enemy.damage);
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
        const child = new Enemy(enemy.splitsInto, ex, ey, this.waveSystem.currentWave);
        this.waveSystem.enemies.push(child);
      }
      enemy.splitCount = 0; // Prevent re-splitting
    }
    return false; // Remove dead enemy
  }

  async _pickBlessing() {
    if (this.isPicking) return;
    this.isPicking = true;

    const player = this.player;
    const classConfig = player.classConfig;

    // Build available pool: shared + class-specific, minus excluded
    const excluded = classConfig ? (classConfig.excludeBlessings || []) : [];
    const weights = classConfig ? (classConfig.blessingWeights || {}) : {};

    const available = this.abilitiesData.filter(a => {
      // Skip maxed abilities
      const current = player.getAbilityLevel(a.id);
      if (current >= a.maxLevel) return false;

      // Skip excluded blessings
      if (excluded.includes(a.id)) return false;

      // Skip class-specific blessings for other classes
      if (a.class && a.class !== player.playerClass) return false;

      // Skip dash for classes (they have unique abilities)
      if (a.id === 'dash' && player.playerClass) return false;

      return true;
    });

    if (available.length === 0) {
      this.isPicking = false;
      return;
    }

    // Rarity base weights (scaled by wave number)
    const currentWave = this.waveSystem ? this.waveSystem.currentWave : 1;
    const RARITY_WEIGHTS = {
      common: 60,
      rare: 25 + (currentWave > 5 ? 5 : 0),
      epic: 12 + (currentWave > 10 ? 5 : 0),
      legendary: 3 + (currentWave > 12 ? 2 : 0),
    };

    // Weighted random selection
    const weighted = available.map(a => {
      const rarityWeight = RARITY_WEIGHTS[a.rarity] || RARITY_WEIGHTS.common;
      const classWeight = weights[a.id] || 1.0;
      return {
        ability: a,
        weight: rarityWeight * classWeight,
      };
    });

    const options = [];
    const pool = [...weighted];
    const count = Math.min(3, pool.length);

    for (let i = 0; i < count; i++) {
      const totalWeight = pool.reduce((sum, w) => sum + w.weight, 0);
      let roll = Math.random() * totalWeight;
      let picked = null;
      let pickedIdx = 0;

      for (let j = 0; j < pool.length; j++) {
        roll -= pool[j].weight;
        if (roll <= 0) {
          picked = pool[j];
          pickedIdx = j;
          break;
        }
      }

      if (!picked) {
        picked = pool[pool.length - 1];
        pickedIdx = pool.length - 1;
      }

      options.push(picked.ability);
      pool.splice(pickedIdx, 1);
    }

    const chosen = await this.blessingPicker.show(options, player.abilities);
    this.audio.blessingPick();

    // Apply ability
    player.addAbility(chosen.id, chosen);
    player.recalcAllStats(this.abilitiesData);
    this._checkSynergies();
    this.hud.updateAbilities(player.abilities, this.abilitiesData);

    this.isPicking = false;
  }

  async _showLevelClearUI() {
    const totalKills = Object.values(this.kills).reduce((a, b) => a + b, 0);
    let stars = 1;
    if (this.player.hp > this.player.maxHP * 0.5) stars = 2;
    if (stars === 2 && this.bestCombo >= 5) stars = 3;

    const levelName = this.currentLevel ? this.currentLevel.name : 'Level';
    await this.levelClearUI.show(levelName, this.score, this.bestCombo, totalKills, stars);
    this._showWorldMap();
  }

  async _showGameOver() {
    await this.gameOverUI.show(this.waveSystem.currentWave, this.bestCombo, this.score, this.kills);
    document.getElementById('menu-screen').classList.remove('hidden');
    this.state = 'MENU';
    this.clearedLevels = [];
    this.currentLevel = null;
  }

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

    const wave = this.waveSystem;

    // Blessings on map
    if (wave) {
      r.drawBlessings(wave.blessings.filter(b => !b.collected), this.time);
    }

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

    // Combo display
    if (this.comboDisplay.timer > 0 && this.comboDisplay.count >= 3) {
      r.drawCombo(this.comboDisplay.count, this.comboDisplay.timer);
    }

    // Blessing off-screen indicators
    if (wave) {
      const activeBlessings = wave.blessings.filter(b => !b.collected && !b.expired);
      if (activeBlessings.length > 0) {
        r.drawBlessingIndicators(activeBlessings, this.player);
      }
    }

    // Damage numbers
    this.damageNumbers.render(r.ctx, r.camera);

    // Minimap
    if (wave) {
      r.drawMinimap(
        this.player,
        wave.enemies.filter(e => !e.dead),
        wave.boss && !wave.boss.dead ? wave.boss : null,
        wave.blessings.filter(b => !b.collected && !b.expired)
      );
    }

    // Wave announcement banner
    if (this.waveAnnouncement.timer > 0) {
      const announcementText = this.waveAnnouncement.text || ('WAVE ' + this.waveAnnouncement.wave);
      r.drawWaveAnnouncement(announcementText, this.waveAnnouncement.timer);
    }

    // Screen flash overlay
    r.drawFlash();

    // Joystick
    r.drawJoystick(this.input);
  }
}
