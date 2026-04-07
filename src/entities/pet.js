/* ---------------------------------------------------------------
 *  Pet — companion entity owned by Beastmaster (Archer) or Bone Lord (Necro).
 *
 *  Distinct from the legacy Minion class:
 *    - Pets are PERSISTENT (no lifetime decay; only die when killed)
 *    - Pets have an owner reference (player) for leashing + lifesteal
 *    - Pets support ranged AI (Hawk) and tank/taunt AI (Bear)
 *    - Pets carry their petId so the engine can apply pet_stat mods
 *    - Pets fire onPetDeath when they die (Wild Heart node)
 *
 *  Pet definitions live in PET_DEFS at the bottom and are looked up by
 *  pet id. Tree node modifiers (Pack Leader, Tame the Wild, Soul Tether,
 *  Lich Lord) are applied at spawn time from skillManager.getPetMods().
 * --------------------------------------------------------------- */

export class Pet {
  /**
   * @param {string} petId       e.g. 'wolf', 'hawk', 'bear', 'skeleton', 'zombie', 'bone_golem'
   * @param {number} x
   * @param {number} y
   * @param {object} player      owning player entity (for leash + lifesteal callbacks)
   * @param {object} mods        from skillManager.getPetMods()[petId] — { damagePct, hpPct, ... }
   * @param {object} [opts]      { permanent: true } for capstone pets that survive floors
   */
  constructor(petId, x, y, player, mods = {}, opts = {}) {
    const def = PET_DEFS[petId];
    if (!def) throw new Error('Unknown pet id: ' + petId);

    this.petId = petId;
    this.def = def;
    this.x = x; this.y = y;
    this.radius = def.radius || 12;
    this.player = player;
    this.permanent = !!opts.permanent;

    // Apply tree mods to base stats
    const hpMult = 1 + (mods.hpPct || 0);
    const dmgMult = 1 + (mods.damagePct || 0);
    const asMult = 1 + (mods.attackSpeedPct || 0);

    this.maxHP = Math.round(def.hp * hpMult);
    this.hp = this.maxHP;
    this.damage = Math.round(def.damage * dmgMult);
    this.speed = def.speed;
    this.attackCooldown = def.attackCooldown / Math.max(0.1, asMult);
    this.attackTimer = 0;
    this.attackRange = def.attackRange;     // 0 = melee
    this.aggroRange = def.aggroRange || 400;
    this.color = def.color;
    this.icon = def.icon || '?';
    this.role = def.role;                    // 'melee' | 'ranged' | 'tank'

    // Owner-effect mods (lifesteal back to owner from pet damage)
    this.ownerLifestealPct = mods.ownerLifestealPct || 0;
    // On-hit status (e.g. Plague Carriers tree node)
    this.onHitStatus = mods.onHitStatus || null;
    // Taunt aura (Bear)
    this.tauntRadius = def.tauntRadius || 0;
    this.tauntCooldown = 0;
    // Marks targets for +X% damage taken (Hawk)
    this.markBonus = def.markBonus || 0;

    // State
    this.targetEnemy = null;
    this.dead = false;
    this.contactCooldown = 0;
    this.hitFlashTimer = 0;
    this.spawnTimer = 0.3;
    this.scale = 0;
    // Wild Heart: explode on death for AoE damage
    this.explodeOnDeath = !!mods._wildHeart;
  }

  // -----------------------------------------------------------
  // Update — runs every frame
  // -----------------------------------------------------------

  /**
   * @param {number} dt
   * @param {Array} enemies
   * @param {Object|null} boss
   * @param {number} mapW
   * @param {number} mapH
   * @returns {Object|null} hit event { enemy, damage, killed, projectile? } or null
   */
  update(dt, enemies, boss, mapW, mapH) {
    // Spawn animation
    if (this.spawnTimer > 0) {
      this.spawnTimer -= dt;
      this.scale = Math.min(1, 1 - this.spawnTimer / 0.3);
      return null;
    }
    this.scale = 1;

    if (this.contactCooldown > 0) this.contactCooldown -= dt;
    if (this.hitFlashTimer > 0) this.hitFlashTimer -= dt;
    if (this.attackTimer > 0) this.attackTimer -= dt;
    if (this.tauntCooldown > 0) this.tauntCooldown -= dt;

    // === Target acquisition ===
    //
    // Aggro range is evaluated relative to the PLAYER, not the pet — this is
    // how WoW-style minions work. The pet sees what its owner sees, which
    // means a wolf hanging back near you still notices the goblin charging
    // from across the room.
    let nearest = null;
    let nearestDist = Infinity;
    const allTargets = enemies.filter(e => !e.dead);
    if (boss && !boss.dead) allTargets.push(boss);

    for (const e of allTargets) {
      const pdx = e.x - this.player.x;
      const pdy = e.y - this.player.y;
      const playerDist = Math.sqrt(pdx * pdx + pdy * pdy);
      if (playerDist > this.aggroRange) continue;

      // Among the player-aggro candidates, prefer the one closest to the PET
      // (so each pet picks a slightly different target when there are several).
      const dx = e.x - this.x;
      const dy = e.y - this.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = e;
      }
    }
    this.targetEnemy = nearest;

    // === Idle follow ===
    //
    // When no target is engaged, close-follow the player at a comfortable
    // distance. This is how WoW pets behave — they walk near you when out
    // of combat, NOT just stand wherever they last killed something.
    //
    // Each pet keeps a small persistent offset around the player so multiple
    // pets don't all stack on the same point.
    if (!nearest) {
      if (!this._followOffset) {
        const angle = Math.random() * Math.PI * 2;
        this._followOffset = {
          x: Math.cos(angle) * 38,
          y: Math.sin(angle) * 38,
        };
      }
      const desiredX = this.player.x + this._followOffset.x;
      const desiredY = this.player.y + this._followOffset.y;
      const fdx = desiredX - this.x;
      const fdy = desiredY - this.y;
      const fDist = Math.sqrt(fdx * fdx + fdy * fdy);
      // Only move if not already close — avoids jittering on the spot
      if (fDist > 6) {
        // Sprint if the player is far away (catch-up speed)
        const ownerDx = this.player.x - this.x;
        const ownerDy = this.player.y - this.y;
        const ownerDist = Math.sqrt(ownerDx * ownerDx + ownerDy * ownerDy);
        const speedMult = ownerDist > 200 ? 2.0 : 1.0;
        this.x += (fdx / fDist) * this.speed * speedMult * dt;
        this.y += (fdy / fDist) * this.speed * speedMult * dt;
      }
      // Clamp + return — no combat work this frame
      this.x = Math.max(this.radius, Math.min(mapW - this.radius, this.x));
      this.y = Math.max(this.radius, Math.min(mapH - this.radius, this.y));
      return null;
    }

    // === Hard leash ===
    //
    // Even with a target, if the pet has wandered way too far from the
    // player (e.g. chasing a runner across half the map), break off and
    // walk back. The previous 480px leash was too generous.
    const ownerDx = this.player.x - this.x;
    const ownerDy = this.player.y - this.y;
    const ownerDist = Math.sqrt(ownerDx * ownerDx + ownerDy * ownerDy);
    const hardLeash = 360;
    if (ownerDist > hardLeash) {
      const nx = ownerDx / ownerDist;
      const ny = ownerDy / ownerDist;
      this.x += nx * this.speed * 2.0 * dt;
      this.y += ny * this.speed * 2.0 * dt;
      this.targetEnemy = null;
      return null;
    }

    let hitResult = null;

    if (nearest) {
      const dx = nearest.x - this.x;
      const dy = nearest.y - this.y;
      const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));

      if (this.role === 'ranged') {
        // Ranged: shoot from distance, retreat if too close
        if (dist < this.attackRange && this.attackTimer <= 0) {
          // Fire — caller (game.js) reads `pendingProjectile` to spawn the projectile
          this.pendingProjectile = {
            startX: this.x, startY: this.y,
            targetX: nearest.x, targetY: nearest.y,
            damage: this.damage,
          };
          this.attackTimer = this.attackCooldown;
          // Hawk's mark: tag the target so it takes +X% damage
          if (this.markBonus > 0) {
            nearest._petMarkBonus = this.markBonus;
            nearest._petMarkTimer = 4.0;
          }
          hitResult = { enemy: nearest, damage: 0, killed: false, ranged: true };
        } else if (dist < this.attackRange * 0.5) {
          // Too close — back off
          this.x -= (dx / dist) * this.speed * dt;
          this.y -= (dy / dist) * this.speed * dt;
        } else if (dist > this.attackRange * 0.85) {
          // Approach to optimal range
          this.x += (dx / dist) * this.speed * dt;
          this.y += (dy / dist) * this.speed * dt;
        }
      } else {
        // Melee / tank: walk to target and contact-damage
        if (dist > this.radius + nearest.radius) {
          this.x += (dx / dist) * this.speed * dt;
          this.y += (dy / dist) * this.speed * dt;
        } else if (this.contactCooldown <= 0 && this.attackTimer <= 0) {
          const killed = nearest.takeDamage(this.damage);
          this.contactCooldown = 0.4;
          this.attackTimer = this.attackCooldown;

          // On-hit status from tree (Plague Carriers)
          if (this.onHitStatus && !killed && nearest.applyStatus) {
            nearest.applyStatus(this.onHitStatus.status, {
              dps: this.onHitStatus.dps || 0,
              duration: this.onHitStatus.duration || 0,
              source: 'pet:' + this.petId,
            });
          }

          hitResult = { enemy: nearest, damage: this.damage, killed };
        }
      }

      // Tank taunt aura — pulses every 2s to draw aggro
      if (this.tauntRadius > 0 && this.tauntCooldown <= 0) {
        this.tauntCooldown = 2.0;
        for (const e of allTargets) {
          const edx = e.x - this.x;
          const edy = e.y - this.y;
          if (edx * edx + edy * edy < this.tauntRadius * this.tauntRadius) {
            // Mark the enemy as preferring this pet — enemy AI checks _tauntTarget
            e._tauntTarget = this;
            e._tauntTimer = 3.0;
          }
        }
      }
    }

    // Clamp to map
    this.x = Math.max(this.radius, Math.min(mapW - this.radius, this.x));
    this.y = Math.max(this.radius, Math.min(mapH - this.radius, this.y));

    return hitResult;
  }

  takeDamage(amount) {
    this.hp -= amount;
    this.hitFlashTimer = 0.1;
    if (this.hp <= 0) {
      this.dead = true;
      return true;
    }
    return false;
  }

  /** Heal this pet by an absolute amount, clamped to maxHP. */
  heal(amount) {
    this.hp = Math.min(this.maxHP, this.hp + amount);
  }
}

// ===========================================================
//  Pet definitions
// ===========================================================
//
// Each entry defines BASE stats. Tree mods (damagePct, hpPct,
// attackSpeedPct, ownerLifestealPct, onHitStatus) are applied at spawn
// time via the constructor.
//
// role:
//   'melee'  — wades into combat, contact damage
//   'ranged' — keeps distance, fires projectiles via game.js spawn
//   'tank'   — tank with taunt aura
//
// damage / hp values intentionally modest — Beastmaster + Bone Lord
// derive their power from STACKING multiple pets, not single high-stat pets.

export const PET_DEFS = {
  // === Beastmaster pets ===
  wolf: {
    name: 'Wolf', icon: '🐺', color: '#8b6a3e', role: 'melee',
    hp: 60, damage: 12, speed: 130, attackCooldown: 0.7, attackRange: 0,
    aggroRange: 380, radius: 13,
  },
  hawk: {
    name: 'Hawk', icon: '🦅', color: '#a89060', role: 'ranged',
    hp: 35, damage: 8, speed: 160, attackCooldown: 1.0, attackRange: 320,
    aggroRange: 450, radius: 9,
    markBonus: 0.10, // Mark target for +10% damage taken
  },
  bear: {
    name: 'Bear', icon: '🐻', color: '#5a3a1a', role: 'tank',
    hp: 200, damage: 18, speed: 70, attackCooldown: 1.2, attackRange: 0,
    aggroRange: 320, radius: 18,
    tauntRadius: 140,
  },

  // === Bone Lord pets ===
  skeleton: {
    name: 'Skeleton Warrior', icon: '💀', color: '#d8d2b8', role: 'melee',
    hp: 50, damage: 10, speed: 100, attackCooldown: 0.8, attackRange: 0,
    aggroRange: 360, radius: 12,
  },
  zombie: {
    name: 'Zombie', icon: '🧟', color: '#6a8a30', role: 'tank',
    hp: 140, damage: 14, speed: 60, attackCooldown: 1.5, attackRange: 0,
    aggroRange: 300, radius: 16,
    // explodeOnDeath is set per-instance via the Wild Heart tree node, not here
  },
  bone_golem: {
    name: 'Bone Golem', icon: '🗿', color: '#e0d8b0', role: 'tank',
    hp: 350, damage: 24, speed: 65, attackCooldown: 1.4, attackRange: 0,
    aggroRange: 320, radius: 22,
    tauntRadius: 120,
  },

  // === Capstone pets ===
  spirit_wolf: {
    name: 'Spirit Wolf', icon: '🌟', color: '#a0c8ff', role: 'melee',
    hp: 220, damage: 32, speed: 150, attackCooldown: 0.6, attackRange: 0,
    aggroRange: 440, radius: 15,
  },
};
