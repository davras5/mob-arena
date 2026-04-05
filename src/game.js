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

const MAP_WIDTH = 1600;
const MAP_HEIGHT = 1600;

export class Game {
  constructor(canvas, abilitiesData, wavesData) {
    this.canvas = canvas;
    this.abilitiesData = abilitiesData;
    this.wavesData = wavesData;

    this.input = new Input(canvas);
    this.renderer = new Renderer(canvas);
    this.collision = new CollisionSystem(64);
    this.particles = new ParticleSystem();
    this.hud = new HUD();
    this.blessingPicker = new BlessingPicker();
    this.gameOverUI = new GameOverUI();

    this.state = 'MENU';
    this.player = null;
    this.projectiles = [];
    this.waveSystem = null;
    this.time = 0;
    this.fireTrails = [];
    this.chainLightnings = [];
    this.screenShake = 0;
    this.isPicking = false;
  }

  start() {
    this.state = 'PLAYING';
    this.player = new Player(MAP_WIDTH / 2, MAP_HEIGHT / 2);
    this.projectiles = [];
    this.fireTrails = [];
    this.chainLightnings = [];
    this.waveSystem = new WaveSystem(this.wavesData);
    this.waveSystem.mapWidth = MAP_WIDTH;
    this.waveSystem.mapHeight = MAP_HEIGHT;
    this.particles.particles = [];
    this.isPicking = false;

    document.getElementById('menu-screen').classList.add('hidden');
    this.hud.updateHP(this.player.hp, this.player.maxHP);
    this.hud.updateWave(1);
    this.hud.hideBossHP();

    // Start wave 1
    this.waveSystem.startWave(1);
  }

  update(dt) {
    if (this.state !== 'PLAYING' && this.state !== 'WAVE_CLEAR' && this.state !== 'COUNTDOWN') return;

    this.time += dt;
    this.input.update();

    const player = this.player;
    const wave = this.waveSystem;

    // Player movement
    player.update(dt, this.input.moveVector, MAP_WIDTH, MAP_HEIGHT);

    // Auto-aim at nearest enemy
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

    if (nearestEnemy) {
      player.aimAngle = Math.atan2(nearestEnemy.y - player.y, nearestEnemy.x - player.x);
    }

    // Dash on right tap
    if (this.input.consumeRightTap() && player.dashDistance > 0) {
      player.tryDash(this.input.moveVector);
    }

    // Auto-attack
    if (nearestEnemy && player.canAttack() && nearestDist < 500) {
      this._playerShoot();
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
        e.x = Math.max(e.radius, Math.min(MAP_WIDTH - e.radius, e.x));
        e.y = Math.max(e.radius, Math.min(MAP_HEIGHT - e.radius, e.y));
      }

      // Update boss
      if (wave.boss && !wave.boss.dead) {
        const action = wave.boss.update(dt, player.x, player.y, MAP_WIDTH, MAP_HEIGHT);
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
      if (p.isOutOfBounds(MAP_WIDTH, MAP_HEIGHT)) p.dead = true;
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

    // Collision: player vs blessings
    if (this.state === 'WAVE_CLEAR' && !this.isPicking) {
      for (const b of wave.blessings) {
        if (b.collected) continue;
        const dx = player.x - b.x;
        const dy = player.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Magnet effect
        if (dist < player.magnetRange) {
          const pull = 200 * dt;
          const pdx = player.x - b.x;
          const pdy = player.y - b.y;
          const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
          if (pdist > 1) {
            b.x += (pdx / pdist) * pull;
            b.y += (pdy / pdist) * pull;
          }
        }

        if (dist < b.radius) {
          b.collected = true;
          this.particles.confetti(b.x, b.y);
          this._pickBlessing();
        }
      }
    }

    // Check wave clear
    if (this.state === 'PLAYING' && wave.checkWaveClear()) {
      wave.triggerWaveClear();
      this.state = 'WAVE_CLEAR';
      this.hud.hideBossHP();
      // Confetti in center
      this.particles.confetti(MAP_WIDTH / 2, MAP_HEIGHT / 2);
    }

    // Check all blessings collected
    if (this.state === 'WAVE_CLEAR' && !this.isPicking && wave.allBlessingsCollected()) {
      this.state = 'COUNTDOWN';
      wave.startCountdown(3);
    }

    // Countdown
    if (this.state === 'COUNTDOWN') {
      this.hud.showCountdown(wave.countdownTimer);
      if (wave.updateCountdown(dt)) {
        this.hud.hideCountdown();
        const nextWave = wave.currentWave + 1;
        this.hud.updateWave(nextWave);
        wave.startWave(nextWave);
        this.state = 'PLAYING';
      }
    }

    // Clean up dead
    this.projectiles = this.projectiles.filter(p => !p.dead);
    wave.enemies = wave.enemies.filter(e => !e.dead || this._handleSplitter(e));

    // Screen shake decay
    if (this.screenShake > 0) this.screenShake -= dt;

    // Particles
    this.particles.update(dt);

    // Player death
    if (player.hp <= 0) {
      this.state = 'GAME_OVER';
      this._showGameOver();
    }

    // HUD
    this.hud.updateHP(player.hp, player.maxHP);
  }

  _playerShoot() {
    const player = this.player;
    player.attack();

    const angle = player.aimAngle;
    const speed = 300;
    const totalProjectiles = 1 + player.extraProjectiles;

    let isCrit = false;
    if (player.critChance > 0 && Math.random() < player.critChance) {
      isCrit = true;
    }

    const dmg = isCrit ? player.damage * 2 : player.damage;

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

          // Lifesteal
          if (player.lifestealPercent > 0) {
            player.hp = Math.min(player.maxHP, player.hp + p.damage * player.lifestealPercent);
          }

          // Explosion
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

    for (const e of targets) {
      if (sourceProjectile && sourceProjectile.hitEnemies.has(e)) continue;
      const dx = e.x - x;
      const dy = e.y - y;
      if (Math.sqrt(dx * dx + dy * dy) < radius + e.radius) {
        const killed = e.takeDamage(damage);
        if (killed) this._onEnemyDeath(e);
      }
    }
  }

  _chainLightning(source, chains, damage, range) {
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

        if (player.thornsDamage > 0) {
          const killed = e.takeDamage(player.thornsDamage);
          if (killed) this._onEnemyDeath(e);
        }
      }
    }
  }

  _onEnemyDeath(enemy) {
    this.particles.deathBurst(enemy.x, enemy.y, enemy.color);
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

    // Apply ability
    this.player.addAbility(chosen.id, chosen);
    this.player.recalcAllStats(this.abilitiesData);
    this.hud.updateAbilities(this.player.abilities, this.abilitiesData);

    this.isPicking = false;
  }

  async _showGameOver() {
    await this.gameOverUI.show(this.waveSystem.currentWave);
    document.getElementById('menu-screen').classList.remove('hidden');
    this.state = 'MENU';
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

    // Blessings
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

    // Projectiles
    r.drawProjectiles(this.projectiles);

    // Player
    r.drawPlayer(this.player);

    // Chain lightning
    r.drawChainLightning(this.chainLightnings);

    // Particles
    r.drawParticles(this.particles.particles);

    // Joystick
    r.drawJoystick(this.input);
  }
}
