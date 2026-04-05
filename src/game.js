import { Player } from './entities/player.js';
import { Projectile } from './entities/projectile.js';
import { Enemy } from './entities/enemy.js';
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
import { HazardSystem } from './systems/hazards.js';
import { LevelClearUI } from './ui/levelClear.js';
import { Progression } from './systems/progression.js';
import { UpgradeShop } from './ui/upgradeShop.js';

const MAP_WIDTH = 1600;
const MAP_HEIGHT = 1600;

export class Game {
  constructor(canvas, abilitiesData, wavesData, levelsData, weaponsData) {
    this.canvas = canvas;
    this.abilitiesData = abilitiesData;
    this.wavesData = wavesData;
    this.levelsData = levelsData || [];
    this.weaponsData = weaponsData || [];

    this.input = new Input(canvas);
    this.renderer = new Renderer(canvas);
    this.collision = new CollisionSystem(64);
    this.particles = new ParticleSystem();
    this.hud = new HUD();
    this.blessingPicker = new BlessingPicker();
    this.gameOverUI = new GameOverUI();
    this.audio = new AudioSystem();
    this.damageNumbers = new DamageNumbers();
    this.hazardSystem = new HazardSystem();
    this.worldMap = new WorldMap();
    this.levelClearUI = new LevelClearUI();
    this.progression = new Progression();
    this.upgradeShop = new UpgradeShop();

    this.state = 'MENU';
    this.currentLevel = null;
    this.clearedLevels = [];
    this.paused = false;
    this.player = null;
    this.projectiles = [];
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
    this.kills = { grunt: 0, rusher: 0, brute: 0, ranged: 0, splitter: 0, boss: 0 };

    // Weapon pickup system
    this.weaponPickups = [];
    this.laserBeams = [];
  }

  togglePause() {
    if (this.state === 'MENU' || this.state === 'GAME_OVER') return;
    this.paused = !this.paused;
    const overlay = document.getElementById('pause-overlay');
    if (overlay) {
      overlay.classList.toggle('hidden', !this.paused);
    }
  }

  start() {
    // Reset run state
    this.player = new Player(MAP_WIDTH / 2, MAP_HEIGHT / 2);
    this.projectiles = [];
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
    this.kills = { grunt: 0, rusher: 0, brute: 0, ranged: 0, splitter: 0, boss: 0 };
    this.weaponPickups = [];
    this.laserBeams = [];
    this.clearedLevels = [];
    this.currentLevel = null;
    this.levelClearTimer = 0;

    // Set default weapon (pistol)
    const pistol = this.weaponsData.find(w => w.id === 'pistol');
    if (pistol) {
      this.player.setWeapon('pistol', pistol);
      this.hud.updateWeapon(pistol.name, pistol.color);
    }

    // Apply persistent progression upgrades
    this.progression.applyToPlayer(this.player);

    document.getElementById('menu-screen').classList.add('hidden');
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

    // Reset player position to center of the new map (keep abilities/stats/hp)
    this.player.x = mw / 2;
    this.player.y = mh / 2;

    // Clear transient state but keep player abilities/stats/hp/score/kills
    this.projectiles = [];
    this.fireTrails = [];
    this.chainLightnings = [];
    this.particles.particles = [];
    this.playerTrail = [];
    this.weaponPickups = [];
    this.laserBeams = [];
    this.isPicking = false;
    this.pendingLevelUp = false;

    // Create wave system with level-specific wave data
    const levelWaves = this._generateLevelWaves(levelConfig);
    this.waveSystem = new WaveSystem(levelWaves);
    this.waveSystem.mapWidth = mw;
    this.waveSystem.mapHeight = mh;
    this.waveSystem.setLevelConfig(levelConfig);

    // Generate environmental hazards for this level
    this.hazardSystem.generate(levelConfig);

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

    // Auto-aim at nearest enemy
    let nearestEnemy = null;
    let nearestDist = Infinity;
    const allTargets = [...wave.enemies.filter(e => !e.dead)];
    if (wave.boss && !wave.boss.dead) allTargets.push(wave.boss);

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
      const projectileSpeed = (player.weaponDef && player.weaponDef.speed) || 300;
      const timeToHit = dist / projectileSpeed;

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

    // Dash on right tap
    if (this.input.consumeRightTap() && player.dashDistance > 0) {
      player.tryDash(this.input.moveVector);
    }

    // Auto-attack
    if (nearestEnemy && player.canAttack() && nearestDist < 500) {
      this._playerShoot(nearestEnemy);
    }

    // Update enemies
    if (this.state === 'PLAYING') {
      for (const e of wave.enemies) {
        if (e.dead) continue;
        e.update(dt, player.x, player.y);

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

        // Clamp enemies to map
        e.x = Math.max(e.radius, Math.min(mapW - e.radius, e.x));
        e.y = Math.max(e.radius, Math.min(mapH - e.radius, e.y));
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
            wave.addEnemiesFromBoss('grunt', action.count, action.x, action.y);
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
      p.update(dt);
      if (p.isOutOfBounds(mapW, mapH)) p.dead = true;
    }

    // Frost aura
    if (player.frostAuraRadius > 0) {
      for (const e of wave.enemies) {
        if (e.dead) continue;
        const dx = e.x - player.x;
        const dy = e.y - player.y;
        if (Math.sqrt(dx * dx + dy * dy) < player.frostAuraRadius) {
          e.applySlow(player.frostSlowPercent, 0.5);
        }
      }
      if (wave.boss && !wave.boss.dead) {
        const dx = wave.boss.x - player.x;
        const dy = wave.boss.y - player.y;
        if (Math.sqrt(dx * dx + dy * dy) < player.frostAuraRadius) {
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

    // Environmental hazards
    if (this.hazardSystem.hazards.length > 0 && wave) {
      this.hazardSystem.update(dt, player, wave.enemies.filter(e => !e.dead));
    }

    // Collision: projectiles vs enemies
    this._checkProjectileCollisions();

    // Collision: enemies vs player
    this._checkEnemyPlayerCollisions(dt);

    // Collision: boss vs player
    if (wave.boss && !wave.boss.dead) {
      const bDist = this.collision.distanceBetween(player, wave.boss);
      if (bDist < player.radius + wave.boss.radius && wave.boss.contactCooldown <= 0) {
        const dmg = player.takeDamage(wave.boss.damage);
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

    // Weapon pickup collision + timer decay
    for (let i = this.weaponPickups.length - 1; i >= 0; i--) {
      const wp = this.weaponPickups[i];
      wp.timer -= dt;
      if (wp.timer <= 0) {
        this.weaponPickups.splice(i, 1);
        continue;
      }
      const dx = player.x - wp.x;
      const dy = player.y - wp.y;
      if (Math.sqrt(dx * dx + dy * dy) < player.radius + 14) {
        player.setWeapon(wp.weapon.id, wp.weapon);
        this.hud.updateWeapon(wp.weapon.name, wp.weapon.color);
        this.particles.confetti(wp.x, wp.y);
        this.audio.blessingPick();
        this.weaponPickups.splice(i, 1);
      }
    }

    // Laser beam visual decay
    for (const b of this.laserBeams) {
      b.timer -= dt;
      b.alpha = Math.max(0, b.timer / 0.15);
    }
    this.laserBeams = this.laserBeams.filter(b => b.timer > 0);

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

  _playerShoot(nearestEnemy) {
    const player = this.player;
    player.attack();
    this.audio.shoot();

    const angle = player.aimAngle;
    const wdef = player.weaponDef;
    const weaponId = player.weapon;

    let isCrit = false;
    if (player.critChance > 0 && Math.random() < player.critChance) {
      isCrit = true;
    }

    const dmg = isCrit ? player.damage * 2 : player.damage;

    // --- Laser (hitscan) ---
    if (weaponId === 'laser' && wdef) {
      const range = wdef.range || 350;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);

      // Raycast: find the first enemy in line
      const wave = this.waveSystem;
      const targets = [...wave.enemies.filter(e => !e.dead)];
      if (wave.boss && !wave.boss.dead) targets.push(wave.boss);

      let hitTarget = null;
      let hitDist = range;

      for (const e of targets) {
        // Project enemy position onto the ray
        const ex = e.x - player.x;
        const ey = e.y - player.y;
        const dot = ex * dx + ey * dy;
        if (dot < 0 || dot > range) continue;
        // Perpendicular distance from enemy center to ray
        const perpX = ex - dx * dot;
        const perpY = ey - dy * dot;
        const perpDist = Math.sqrt(perpX * perpX + perpY * perpY);
        if (perpDist < e.radius + 4 && dot < hitDist) {
          hitDist = dot;
          hitTarget = e;
        }
      }

      const endX = player.x + dx * hitDist;
      const endY = player.y + dy * hitDist;

      // Laser beam visual
      this.laserBeams.push({
        x1: player.x, y1: player.y,
        x2: endX, y2: endY,
        color: wdef.color || '#e74c3c',
        timer: 0.15, alpha: 1,
      });

      if (hitTarget) {
        const killed = hitTarget.takeDamage(dmg);
        this.damageNumbers.spawn(hitTarget.x, hitTarget.y - hitTarget.radius, dmg, isCrit);
        if (player.lifestealPercent > 0) {
          player.hp = Math.min(player.maxHP, player.hp + dmg * player.lifestealPercent);
        }
        if (player.chainCount > 0) {
          this._chainLightning(hitTarget, player.chainCount, player.chainDamage, player.chainRange);
        }
        if (killed) this._onEnemyDeath(hitTarget);
      }
      return;
    }

    // --- Shotgun ---
    if (weaponId === 'shotgun' && wdef) {
      const pellets = wdef.pellets || 5;
      const spreadDeg = wdef.spread || 30;
      const spreadRad = spreadDeg * Math.PI / 180;
      const speed = wdef.speed || 250;
      const lifetime = wdef.lifetime || 0.6;

      // Also add extra projectiles from abilities
      const totalPellets = pellets + player.extraProjectiles;

      for (let i = 0; i < totalPellets; i++) {
        // Spread pellets evenly across the cone, with a bit of randomness
        let a;
        if (totalPellets === 1) {
          a = angle;
        } else {
          const base = (i / (totalPellets - 1) - 0.5) * spreadRad;
          a = angle + base + (Math.random() - 0.5) * (spreadRad / totalPellets);
        }

        const p = new Projectile(
          player.x + Math.cos(a) * player.radius,
          player.y + Math.sin(a) * player.radius,
          Math.cos(a) * speed,
          Math.sin(a) * speed,
          dmg
        );
        p.pierce = player.pierce;
        p.bounces = player.bounces;
        p.bounceRange = player.bounceRange;
        p.lifetime = lifetime;
        this.projectiles.push(p);
      }
      return;
    }

    // --- Rockets ---
    if (weaponId === 'rockets' && wdef) {
      const speed = wdef.speed || 180;
      const totalProjectiles = 1 + player.extraProjectiles;

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
          dmg
        );
        p.radius = wdef.radius || 6;
        p.pierce = 0; // Rockets explode on first hit, no pierce
        p.bounces = 0;
        p.isRocket = true;
        p.rocketExplosionRadius = wdef.explosionRadius || 80;
        p.rocketExplosionDamage = wdef.explosionDamage || 25;

        if (i > 0 && totalProjectiles > 1 && nearestEnemy) {
          p.homing = 100;
          p.homingTarget = nearestEnemy;
        }

        this.projectiles.push(p);
      }
      return;
    }

    // --- Pistol (default) ---
    const speed = (wdef && wdef.speed) || 300;
    const totalProjectiles = 1 + player.extraProjectiles;

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
        dmg
      );
      p.pierce = player.pierce;
      p.bounces = player.bounces;
      p.bounceRange = player.bounceRange;

      // Extra projectiles (not the center one) get gentle homing
      if (i > 0 && totalProjectiles > 1 && nearestEnemy) {
        p.homing = 150;
        p.homingTarget = nearestEnemy;
      }

      this.projectiles.push(p);
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
          player.takeDamage(p.damage);
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
          const killed = e.takeDamage(p.damage);
          p.hitEnemies.add(e);
          this.damageNumbers.spawn(e.x, e.y - e.radius, p.damage, p.damage > this.player.damage);

          // Lifesteal
          if (player.lifestealPercent > 0) {
            player.hp = Math.min(player.maxHP, player.hp + p.damage * player.lifestealPercent);
          }

          // Rocket explosion (weapon-based AoE)
          if (p.isRocket) {
            this._explosion(p.x, p.y, p.rocketExplosionRadius, p.rocketExplosionDamage, p);
            this.screenShake = 0.15;
            p.dead = true;
            if (killed) this._onEnemyDeath(e);
            break;
          }

          // Explosion (ability-based)
          if (player.explosionRadius > 0) {
            this._explosion(p.x, p.y, player.explosionRadius, player.explosionDamage, p);
          }

          // Chain lightning
          if (player.chainCount > 0) {
            this._chainLightning(e, player.chainCount, player.chainDamage, player.chainRange);
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
                p.vx = (ndx / ndist) * 300;
                p.vy = (ndy / ndist) * 300;
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

  _checkEnemyPlayerCollisions(dt) {
    const player = this.player;
    const wave = this.waveSystem;

    for (const e of wave.enemies) {
      if (e.dead || e.contactCooldown > 0) continue;
      const dx = player.x - e.x;
      const dy = player.y - e.y;
      if (Math.sqrt(dx * dx + dy * dy) < player.radius + e.radius) {
        const dmg = player.takeDamage(e.damage);
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
  }

  _onEnemyDeath(enemy) {
    this.particles.deathBurst(enemy.x, enemy.y, enemy.color);
    this.audio.enemyDeath();

    // Score system
    const SCORE_TABLE = { grunt: 10, rusher: 15, brute: 50, ranged: 20, splitter: 25 };
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

    // Weapon drop (~5% chance)
    if (Math.random() < 0.05) {
      const weapons = this.weaponsData.filter(w => w.id !== this.player.weapon);
      if (weapons.length > 0) {
        const wp = weapons[Math.floor(Math.random() * weapons.length)];
        this.weaponPickups.push({ x: enemy.x, y: enemy.y, weapon: wp, timer: 10 });
      }
    }

    // Award XP
    const xp = (enemy.xp || 0) * xpMultiplier * this.progression.getXPMultiplier();
    const leveled = this.player.addXP(xp);
    this.hud.updateXP(this.player.xp, this.player.xpToNext, this.player.level);
    this.hud.updateHP(this.player.hp, this.player.maxHP);
    if (leveled) {
      this.pendingLevelUp = true;
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

    // Pick 3 random abilities (not already maxed)
    const available = this.abilitiesData.filter(a => {
      const current = this.player.getAbilityLevel(a.id);
      return current < a.maxLevel;
    });

    if (available.length === 0) {
      this.isPicking = false;
      return;
    }

    // Shuffle and pick 3
    const shuffled = [...available].sort(() => Math.random() - 0.5);
    const options = shuffled.slice(0, Math.min(3, shuffled.length));

    const chosen = await this.blessingPicker.show(options, this.player.abilities);
    this.audio.blessingPick();

    // Apply ability
    this.player.addAbility(chosen.id, chosen);
    this.player.recalcAllStats(this.abilitiesData);
    this.hud.updateAbilities(this.player.abilities, this.abilitiesData);

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
    const coinsEarned = this.progression.addCoins(this.score);
    await this.gameOverUI.show(this.waveSystem.currentWave, this.bestCombo, this.score, this.kills, coinsEarned);
    document.getElementById('menu-screen').classList.remove('hidden');
    this._updateMenuCoins();
    this.state = 'MENU';
    this.clearedLevels = [];
    this.currentLevel = null;
  }

  _updateMenuCoins() {
    const el = document.getElementById('menu-coins');
    if (el) el.textContent = `Coins: ${this.progression.coins.toLocaleString()}`;
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

    // Environmental hazards (drawn right after map, under everything else)
    if (this.hazardSystem.hazards.length > 0) {
      r.drawHazards(this.hazardSystem.hazards, this.time);
    }

    if (!this.player) return;

    const wave = this.waveSystem;

    // Blessings on map
    if (wave) {
      r.drawBlessings(wave.blessings.filter(b => !b.collected), this.time);
    }

    // Frost aura
    if (this.player.frostAuraRadius > 0) {
      r.drawFrostAura(this.player, this.player.frostAuraRadius);
    }

    // Fire trails
    r.drawFireTrails(this.fireTrails);

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

    // Weapon pickups
    if (this.weaponPickups.length > 0) {
      r.drawWeaponPickups(this.weaponPickups, this.time);
    }

    // Projectiles
    r.drawProjectiles(this.projectiles);

    // Player trail
    r.drawPlayerTrail(this.playerTrail);

    // Player
    r.drawPlayer(this.player);

    // Weapon indicator near player
    r.drawWeaponIndicator(this.player);

    // Laser beams
    if (this.laserBeams.length > 0) {
      r.drawLaserBeams(this.laserBeams);
    }

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
