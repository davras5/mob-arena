// =============================================================================
// StatusEffectManager — Manages debuffs and status effects applied to the player
// =============================================================================

const STATUS_DEFS = {
  frozen: {
    description: 'Cannot move or attack',
    baseDuration: 2,
    isDot: false,
    stacks: false,
    maxStacks: 1,
  },
  slowed: {
    description: '-40% movement speed',
    baseDuration: 3,
    isDot: false,
    stacks: false,
    maxStacks: 1,
    speedMultiplier: 0.6,
  },
  burning: {
    description: '5 damage/sec tick',
    baseDuration: 3,
    isDot: true,
    baseDamagePerSec: 5,
    stacks: true,
    maxStacks: 3,
  },
  poisoned: {
    description: '3 damage/sec tick, -20% healing',
    baseDuration: 4,
    isDot: true,
    baseDamagePerSec: 3,
    stacks: true,
    maxStacks: 3,
    healingMultiplier: 0.8,
  },
  weakened: {
    description: '+25% damage taken',
    baseDuration: 4,
    isDot: false,
    stacks: false,
    maxStacks: 1,
    damageTakenMultiplier: 1.25,
  },
  bleeding: {
    description: '2 damage/sec tick',
    baseDuration: 5,
    isDot: true,
    baseDamagePerSec: 2,
    stacks: false,
    maxStacks: 1,
  },
};

class StatusEffectManager {
  constructor() {
    /** @type {Array<{type: string, remaining: number, maxDuration: number, magnitude: number, source: string}>} */
    this.activeEffects = [];
    this.statusDefs = STATUS_DEFS;
  }

  // ---------------------------------------------------------------------------
  // Apply a status effect with STA-based resistance
  // ---------------------------------------------------------------------------

  /**
   * Apply a status effect to the player.
   *
   * - Non-stacking effects refresh their duration if already active.
   * - Stacking effects (burning, poisoned) stack from different sources up to
   *   maxStacks. Same-source applications refresh the existing stack's duration.
   *
   * @param {string}  type      - One of the keys in STATUS_DEFS
   * @param {number}  duration  - Base duration in seconds (falls back to statusDefs default)
   * @param {number}  magnitude - Multiplier for the effect strength (default 1)
   * @param {string}  source    - Identifier for the source (e.g. enemy id)
   * @param {number}  [sta=0]   - Player's total STA attribute for resistance calc
   */
  apply(type, duration, magnitude = 1, source = 'unknown', sta = 0) {
    const def = this.statusDefs[type];
    if (!def) return;

    // Resistance formula: effectiveDuration = baseDuration * max(0.2, 1 - sta * 0.01)
    const baseDur = duration ?? def.baseDuration;
    const resistFactor = Math.max(0.2, 1 - sta * 0.01);
    const effectiveDuration = baseDur * resistFactor;

    if (def.stacks) {
      // Stacking effects — stack from different sources, refresh same source
      const existing = this.activeEffects.find(
        (e) => e.type === type && e.source === source
      );

      if (existing) {
        // Same source — refresh duration
        existing.remaining = effectiveDuration;
        existing.maxDuration = effectiveDuration;
        existing.magnitude = magnitude;
      } else {
        // Different source — add new stack up to max
        const currentStacks = this.activeEffects.filter(
          (e) => e.type === type
        );
        if (currentStacks.length < def.maxStacks) {
          this.activeEffects.push({
            type,
            remaining: effectiveDuration,
            maxDuration: effectiveDuration,
            magnitude,
            source,
          });
        }
      }
    } else {
      // Non-stacking — refresh duration if already active
      const existing = this.activeEffects.find((e) => e.type === type);
      if (existing) {
        existing.remaining = effectiveDuration;
        existing.maxDuration = effectiveDuration;
        existing.magnitude = magnitude;
        existing.source = source;
      } else {
        this.activeEffects.push({
          type,
          remaining: effectiveDuration,
          maxDuration: effectiveDuration,
          magnitude,
          source,
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Per-frame update
  // ---------------------------------------------------------------------------

  /**
   * Tick all active effects: apply DoT damage, decrement timers, remove expired.
   *
   * @param {number} dt     - Delta time in seconds
   * @param {object} player - Player object (must expose `hp`, `speed`, etc.)
   */
  update(dt) {
    if (this.activeEffects.length === 0) return;

    // Decrement durations and remove expired effects
    // DoT damage is NOT applied here — game.js handles it via getDotDamage() + takeDamage()
    for (let i = this.activeEffects.length - 1; i >= 0; i--) {
      this.activeEffects[i].remaining -= dt;
      if (this.activeEffects[i].remaining <= 0) {
        this.activeEffects.splice(i, 1);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Removal helpers
  // ---------------------------------------------------------------------------

  /** Remove all active instances of a given status type. */
  remove(type) {
    this.activeEffects = this.activeEffects.filter((e) => e.type !== type);
  }

  /** Clear every active status effect. */
  removeAll() {
    this.activeEffects = [];
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  /** Returns true if the player currently has at least one instance of this status. */
  has(type) {
    return this.activeEffects.some((e) => e.type === type);
  }

  /**
   * Returns a snapshot of all active effects for HUD rendering.
   * @returns {Array<{type: string, remainingDuration: number, maxDuration: number, magnitude: number}>}
   */
  getActiveEffects() {
    return this.activeEffects.map((e) => ({
      type: e.type,
      remainingDuration: e.remaining,
      maxDuration: e.maxDuration,
      magnitude: e.magnitude,
    }));
  }

  // ---------------------------------------------------------------------------
  // Stat modifiers — consumed by the game loop to alter player behaviour
  // ---------------------------------------------------------------------------

  /**
   * Combined speed multiplier from movement-impairing effects.
   * Frozen = 0 (complete halt). Slowed stacks multiplicatively with magnitude.
   * @returns {number} Multiplier to apply to base movement speed.
   */
  getSpeedMultiplier() {
    if (this.has('frozen')) return 0;

    let multiplier = 1;
    for (const effect of this.activeEffects) {
      if (effect.type === 'slowed') {
        const def = this.statusDefs.slowed;
        // Base slow is 0.6x speed; magnitude scales the penalty
        const penalty = (1 - def.speedMultiplier) * effect.magnitude;
        multiplier *= 1 - penalty;
      }
    }
    return Math.max(0, multiplier);
  }

  /**
   * Multiplier for incoming damage while weakened.
   * @returns {number} 1.0 normally, 1.25 (or higher with magnitude) when weakened.
   */
  getDamageTakenMultiplier() {
    let multiplier = 1;
    for (const effect of this.activeEffects) {
      if (effect.type === 'weakened') {
        const def = this.statusDefs.weakened;
        const bonus = (def.damageTakenMultiplier - 1) * effect.magnitude;
        multiplier += bonus;
      }
    }
    return multiplier;
  }

  /**
   * Multiplier for healing received while poisoned.
   * @returns {number} 1.0 normally, 0.8 (or lower with stacking) when poisoned.
   */
  getHealingMultiplier() {
    let multiplier = 1;
    for (const effect of this.activeEffects) {
      if (effect.type === 'poisoned') {
        const def = this.statusDefs.poisoned;
        multiplier *= def.healingMultiplier;
      }
    }
    return multiplier;
  }

  /**
   * Total damage-over-time to apply this frame from all active DoT effects.
   * @param {number} dt - Delta time in seconds
   * @returns {number} Total damage for this tick
   */
  getDotDamage(dt) {
    let total = 0;
    for (const effect of this.activeEffects) {
      const def = this.statusDefs[effect.type];
      if (def && def.isDot) {
        total += def.baseDamagePerSec * effect.magnitude * dt;
      }
    }
    return total;
  }

  /** Shorthand: is the player currently frozen? */
  isFrozen() {
    return this.has('frozen');
  }
}

export { StatusEffectManager };
