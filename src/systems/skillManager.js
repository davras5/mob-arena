/* ---------------------------------------------------------------
 *  SkillManager — runtime owner of the player's spec-tree skill state
 *
 *  Responsibilities:
 *    1. Hold the player's current skill tree, hotbar, and resolved attack cache
 *    2. Mediate point spending / refunds via skillTreeEngine
 *    3. Manage cooldowns (keyed by attack id, so multi-bound slots share)
 *    4. Resolve "what does pressing slot X do?" for game.js
 *    5. Provide save/load round-trip via player + persistence
 *
 *  This module owns NO world state — it doesn't spawn projectiles or apply
 *  damage. game.js consumes the CastEvent returned by castSlot() and runs
 *  the actual combat.
 *
 *  Cooldowns are stored per attack id (not per slot), so binding the same
 *  attack to LMB and slot 3 makes both slots share cooldown. Consumable
 *  cooldowns are stored per cooldownGroup (e.g. "shared" for HP+Mana
 *  potions, "scroll" for teleport scrolls).
 * --------------------------------------------------------------- */

import * as engine from './skillTreeEngine.js';

const HOTBAR_SLOTS = ['leftClick', 'rightClick', 'slot1', 'slot2', 'slot3', 'slot4', 'slot5'];

export class SkillManager {
  /**
   * @param {object} skillsData       - parsed skills.json
   * @param {string} playerClass      - 'warrior' | 'mage' | 'archer' | 'necromancer'
   * @param {object} player           - reference to the player entity (skillTree, hotbar, skillPoints live here)
   * @param {object} [opts]
   * @param {object} [opts.potionsData]          - parsed potions.json (used for cooldown groups + consumable lookup)
   * @param {function} [opts.consumableValidator] - (consumableId) => boolean. Optional gate that
   *                                                returns false if the player has no stack of this
   *                                                consumable. If omitted, canCast() always lets
   *                                                consumables through and the caller must check
   *                                                inventory itself before invoking castSlot().
   */
  constructor(skillsData, playerClass, player, opts = {}) {
    this.skillsData = skillsData;
    this.playerClass = playerClass;
    this.player = player;

    // --- Optional injections ---
    // potionsData is technically optional but heavily expected: without it, we
    // can't look up cooldown groups so consumables fall back to per-id cooldowns.
    this.potionsData = opts.potionsData || null;
    // consumableValidator lets the caller (game.js) refuse a cast for an empty
    // stack BEFORE the cooldown is started. Strongly recommended in production.
    this.consumableValidator = typeof opts.consumableValidator === 'function'
      ? opts.consumableValidator
      : null;

    // --- Runtime state ---
    // Cooldowns: keyed by a generic key. Attack cooldowns use 'attack:<id>';
    // consumable cooldowns use 'consumable:<cooldownGroup>' so multiple
    // potions in the same group share.
    this.cooldowns = {};

    // Cache of resolved attacks: { attackId: ResolvedAttack }
    this.resolvedAttacks = {};
    // Cache of resolved player stats: { stat: value }
    this.resolvedPlayerStats = {};
    // Cache of conditional triggers + capstone hooks
    this.conditionalTriggers = [];
    // Pre-bucketed triggers by event name for O(1) lookup
    this._triggersByEvent = new Map();
    this.capstoneHooks = new Set();
    // Cache of pet mods (for Beastmaster / Bone Lord)
    this.petMods = {};

    // --- Indices ---
    this._attackIndex = this._buildAttackIndex();   // by attack id
    this._specIndex   = this._buildSpecIndex();     // by spec key AND tree key
    this._potionIndex = this._buildPotionIndex();   // by consumable id

    // --- Defensive: ensure player.hotbar has all 7 keys (B3) ---
    // This used to live in getHotbar() and ran every call. Hoisted here so
    // getHotbar() stays a pure getter and we don't mutate state from a getter.
    if (!this.player) {
      // No player attached (test harness?). Skip hotbar prep.
    } else {
      if (!this.player.hotbar) this.player.hotbar = _emptyHotbar();
      for (const k of HOTBAR_SLOTS) {
        if (!(k in this.player.hotbar)) this.player.hotbar[k] = null;
      }
    }

    // Initial resolution
    this.recomputeResolved();
  }

  // ===========================================================
  //  Index builders
  // ===========================================================

  _buildAttackIndex() {
    const out = {};
    const classData = this.skillsData[this.playerClass];
    if (!classData) return out;
    for (const [specKey, specData] of Object.entries(classData)) {
      if (typeof specData !== 'object' || !specData.tree) continue;
      if (specData.primary) {
        out[specData.primary.id] = { specKey, specData, baseDef: specData.primary };
      }
      if (specData.secondary) {
        out[specData.secondary.id] = { specKey, specData, baseDef: specData.secondary };
      }
    }
    return out;
  }

  _buildSpecIndex() {
    const out = {};
    const classData = this.skillsData[this.playerClass];
    if (!classData) return out;
    for (const [specKey, specData] of Object.entries(classData)) {
      if (typeof specData !== 'object' || !specData.tree) continue;
      const treeKey = engine.makeTreeKey(this.playerClass, specKey);
      out[specKey] = { treeKey, specData };
      out[treeKey] = { treeKey, specData };
    }
    return out;
  }

  _buildPotionIndex() {
    const out = {};
    if (!this.potionsData || !this.potionsData.potionTypes) return out;
    for (const p of this.potionsData.potionTypes) {
      out[p.id] = p;
    }
    return out;
  }

  // ===========================================================
  //  Public — class data lookups
  // ===========================================================

  /**
   * Return the list of spec keys for this player's class (e.g. ['guardian', 'berserker']).
   */
  getSpecs() {
    const classData = this.skillsData[this.playerClass];
    if (!classData) return [];
    return Object.keys(classData).filter(
      k => typeof classData[k] === 'object' && classData[k].tree
    );
  }

  /**
   * Return the spec data for a spec key or tree key.
   */
  getSpec(specIdOrKey) {
    return this._specIndex[specIdOrKey] || null;
  }

  /**
   * Return all attack ids for this class (4 total).
   */
  getAllAttackIds() {
    return Object.keys(this._attackIndex);
  }

  /**
   * Look up the BASE attack definition by id (no resolved values).
   */
  getAttack(attackId) {
    const entry = this._attackIndex[attackId];
    return entry ? entry.baseDef : null;
  }

  /**
   * Look up a RESOLVED attack by id (post-tree-effects). Returns null if
   * the id isn't part of this player's class.
   */
  getResolvedAttack(attackId) {
    return this.resolvedAttacks[attackId] || null;
  }

  // ===========================================================
  //  Hotbar
  // ===========================================================

  /**
   * Return a READ-ONLY snapshot of the player's hotbar (7 slots).
   *
   * The returned object is frozen — direct mutation throws in strict mode and
   * silently fails otherwise. Use `setHotbarSlot()` to make changes. This
   * preserves the validation invariant for attack/consumable bindings.
   *
   * Internal manager code should NOT call this — it should use `_hotbarRef()`
   * for direct mutable access.
   */
  getHotbar() {
    const ref = this._hotbarRef();
    return Object.freeze({ ...ref });
  }

  /**
   * Internal accessor: returns the live mutable hotbar object.
   * NEVER expose this externally — UIs and game.js must use getHotbar().
   */
  _hotbarRef() {
    if (!this.player) return _emptyHotbar();
    return this.player.hotbar;
  }

  /**
   * Bind a slot to an attack OR consumable. Pass null to clear.
   *
   * @param {string} slotId   - 'leftClick' | 'rightClick' | 'slot1'..'slot5'
   * @param {object|null} binding  - null OR { type: 'attack'|'consumable', id: string }
   * @returns {boolean} true if accepted, false if invalid
   */
  setHotbarSlot(slotId, binding) {
    if (!HOTBAR_SLOTS.includes(slotId)) return false;
    if (binding != null) {
      // M8: type sanity first, before any other validation
      if (!binding.type || !binding.id) return false;
      if (binding.type !== 'attack' && binding.type !== 'consumable') return false;
      // Attack must exist in this class
      if (binding.type === 'attack' && !this._attackIndex[binding.id]) return false;
      // D3: consumable validation is loose. We accept any consumable id and
      // defer to the inventory layer (via consumableValidator) at cast time.
      // The only thing skillManager cares about is "is this consumable in
      // potions.json so we can find its cooldown group". If it's NOT in
      // potions.json, we still accept the binding — the cooldown will fall
      // back to a per-id key (`consumable:<id>`).
    }
    this._hotbarRef()[slotId] = binding ? { ...binding } : null;
    return true;
  }

  /**
   * Return the binding currently in a slot (or null).
   */
  getSlotBinding(slotId) {
    return this._hotbarRef()[slotId] || null;
  }

  /**
   * Return the resolved attack currently bound to a slot, or null if the slot
   * is empty or holds a consumable.
   */
  getResolvedSlot(slotId) {
    const binding = this.getSlotBinding(slotId);
    if (!binding || binding.type !== 'attack') return null;
    return this.getResolvedAttack(binding.id);
  }

  // ===========================================================
  //  Cooldowns
  // ===========================================================

  // Cooldowns are stored under namespaced keys so a future attack id starting
  // with "consumable:" can never collide with a consumable group.
  _attackCooldownKey(attackId) {
    return 'attack:' + attackId;
  }

  _consumableCooldownKey(consumableId) {
    const def = this._potionIndex[consumableId];
    const group = def ? (def.cooldownGroup || consumableId) : consumableId;
    return 'consumable:' + group;
  }

  getCooldownRemaining(slotId) {
    const binding = this.getSlotBinding(slotId);
    if (!binding) return 0;
    const key = binding.type === 'attack'
      ? this._attackCooldownKey(binding.id)
      : this._consumableCooldownKey(binding.id);
    return this.cooldowns[key] || 0;
  }

  /**
   * Return the slot's TOTAL cooldown duration (the denominator for the radial
   * wipe). For an attack, that's the resolved cooldown including any tree CDR.
   *
   * Returns:
   *   - 0      for empty slots
   *   - null   if the slot is bound but the underlying def can't be resolved
   *            (corrupted save, wrong class, etc.) — caller should render an
   *            error indicator instead of treating it as ready.
   */
  getCooldownTotal(slotId) {
    const binding = this.getSlotBinding(slotId);
    if (!binding) return 0;
    if (binding.type === 'attack') {
      const resolved = this.getResolvedAttack(binding.id);
      return resolved ? (resolved.cooldown || 0) : null;
    }
    if (binding.type === 'consumable') {
      const def = this._potionIndex[binding.id];
      // Unknown consumable: caller should still render the slot but cooldown
      // viz won't work — return null so the HUD can decide.
      return def ? (def.cooldown || 0) : null;
    }
    return null;
  }

  isSlotReady(slotId) {
    return this.getCooldownRemaining(slotId) <= 0;
  }

  /**
   * Tick all cooldowns by `dt` seconds. Returns the list of cooldown keys
   * that just hit zero this tick (so the HUD can play ready-flash effects).
   *
   * Hot path: called every frame. We use `for...in` to avoid the per-frame
   * `Object.keys()` allocation in the common (mostly empty) case.
   */
  tickCooldowns(dt) {
    const justReady = [];
    for (const key in this.cooldowns) {
      const remaining = this.cooldowns[key] - dt;
      if (remaining <= 0) {
        delete this.cooldowns[key];
        justReady.push(key);
      } else {
        this.cooldowns[key] = remaining;
      }
    }
    return justReady;
  }

  /**
   * Manually start a cooldown (used by castSlot internally and by callers
   * who execute attacks via a non-slot path).
   */
  startCooldown(key, seconds) {
    if (seconds > 0) this.cooldowns[key] = seconds;
  }

  // ===========================================================
  //  Casting
  // ===========================================================

  /**
   * Pre-flight check: can the player fire what's bound to this slot right now?
   *
   * Returns { ok, reason } where reason is one of:
   *   'empty'        - slot is unbound
   *   'on_cooldown'  - the bound attack/consumable is still on cooldown
   *   'no_resource'  - attack costs more rage/mana/stamina than the player has
   *   'no_weapon'    - attack's weaponReq is not satisfied by the equipped main hand
   *   'no_stack'     - consumable validator says inventory has 0 of this id
   *   'unknown_attack'    - bound attack id doesn't exist in this class (corrupt save)
   *   'unknown_consumable'- bound consumable id doesn't exist (corrupt save)
   *   'unknown_binding'   - binding.type is neither 'attack' nor 'consumable'
   *
   * IMPORTANT: castSlot() runs canCast() again internally — there is no race
   * window between them as long as the caller does not mutate state in between.
   */
  canCast(slotId) {
    const binding = this.getSlotBinding(slotId);
    if (!binding) return { ok: false, reason: 'empty' };

    if (this.getCooldownRemaining(slotId) > 0) {
      return { ok: false, reason: 'on_cooldown' };
    }

    if (binding.type === 'attack') {
      const resolved = this.getResolvedAttack(binding.id);
      if (!resolved) return { ok: false, reason: 'unknown_attack' };

      // Weapon requirement
      if (resolved.weaponReq && resolved.weaponReq.length > 0 && this.player) {
        const weapon = this.player.equipment && this.player.equipment.mainHand;
        if (!weapon || !resolved.weaponReq.includes(weapon.baseType)) {
          return { ok: false, reason: 'no_weapon' };
        }
      }

      // Resource cost
      const cost = resolved.cost || 0;
      if (cost > 0 && this.player) {
        const have = _getPlayerResource(this.player);
        if (have < cost) return { ok: false, reason: 'no_resource' };
      }

      return { ok: true };
    }

    if (binding.type === 'consumable') {
      // If a consumableValidator was injected, ask it whether the inventory
      // has any stack of this consumable. If it returns false, refuse the
      // cast BEFORE starting the cooldown — that's the whole point of the
      // injection (D4 in the review).
      if (this.consumableValidator && !this.consumableValidator(binding.id)) {
        return { ok: false, reason: 'no_stack' };
      }
      return { ok: true };
    }

    return { ok: false, reason: 'unknown_binding' };
  }

  /**
   * Build a CastEvent describing what should happen when the slot fires.
   * Does NOT spawn projectiles or apply damage — that's game.js's job.
   *
   * On success: starts the cooldown, deducts resource cost, returns the event.
   * On failure: returns null (and `canCast()` will report why).
   */
  castSlot(slotId) {
    const check = this.canCast(slotId);
    if (!check.ok) return null;

    const binding = this.getSlotBinding(slotId);

    if (binding.type === 'attack') {
      const resolved = this.getResolvedAttack(binding.id);

      // Deduct resource cost
      const cost = resolved.cost || 0;
      if (cost > 0 && this.player) {
        _spendPlayerResource(this.player, cost);
      }

      // Generate resource (rage primaries)
      if (resolved.resourceGenerated && this.player) {
        _addPlayerResource(this.player, resolved.resourceGenerated);
      }

      // Start cooldown (keyed by attack id, so all bound slots share)
      this.startCooldown(this._attackCooldownKey(binding.id), resolved.cooldown);

      return {
        kind: 'attack',
        slotId,
        attackId: binding.id,
        attack: resolved,
        spec: this._attackIndex[binding.id]?.specKey,
        cost,
      };
    }

    if (binding.type === 'consumable') {
      const def = this._potionIndex[binding.id];
      const cd = def ? (def.cooldown || 0) : 0;
      this.startCooldown(this._consumableCooldownKey(binding.id), cd);
      return {
        kind: 'consumable',
        slotId,
        consumableId: binding.id,
        def,
      };
    }

    return null;
  }

  // ===========================================================
  //  Skill points / spending
  // ===========================================================

  getSkillPointsAvailable() {
    return (this.player && this.player.skillPointsAvailable) || 0;
  }

  /**
   * Total points spent in a single tree (gate check).
   */
  getPointsInTree(specIdOrKey) {
    const spec = this.getSpec(specIdOrKey);
    if (!spec) return 0;
    return engine.getPointsInTree(this.player.skillTree, spec.treeKey);
  }

  /**
   * Total points spent across both trees.
   */
  getTotalPointsSpent() {
    return engine.getTotalPointsSpent(this.player ? this.player.skillTree : {});
  }

  /**
   * Attempt to spend a skill point on a tree node.
   *
   * @param {string} specIdOrKey - 'guardian' | 'warrior_guardian'
   * @param {string} nodeId      - 'iron_hide', etc.
   * @returns {{ok: boolean, reason?: string}}
   */
  spendPoint(specIdOrKey, nodeId) {
    const spec = this.getSpec(specIdOrKey);
    if (!spec) return { ok: false, reason: 'unknown_spec' };

    const nodeDef = spec.specData.tree.find(n => n.id === nodeId);
    if (!nodeDef) return { ok: false, reason: 'unknown_node' };

    const pointsAvail = this.getSkillPointsAvailable();
    const can = engine.canSpend(
      this.player.skillTree,
      spec.treeKey,
      nodeDef,
      spec.specData.tree,
      pointsAvail
    );
    if (!can.ok) return can;

    // Mutate player's skill tree
    this.player.skillTree = engine.spendPoint(this.player.skillTree, spec.treeKey, nodeDef);
    this.player.skillPointsAvailable = Math.max(0, pointsAvail - 1);

    // Recompute resolved values now that the tree changed
    this.recomputeResolved();

    return { ok: true };
  }

  /**
   * Refund all spent skill points. Used by Trainer respec.
   *
   * @param {object} [opts]
   * @param {boolean} [opts.free=false] - if true, mark `player.freeRespecUsed`. The
   *                                      Trainer should pass `free: !player.freeRespecUsed`
   *                                      so the first respec consumes the free flag.
   *                                      Gold deduction is the Trainer's responsibility.
   * @returns {number} the number of points refunded
   */
  refundAll(opts = {}) {
    const before = this.getTotalPointsSpent();
    const r = engine.refundAll(this.player.skillTree);
    this.player.skillTree = r.newTree;
    this.player.skillPointsAvailable = (this.player.skillPointsAvailable || 0) + r.totalPointsRefunded;
    if (opts.free && !this.player.freeRespecUsed) {
      this.player.freeRespecUsed = true;
    }
    this.recomputeResolved();
    return before;
  }

  // ===========================================================
  //  Resolution / cache invalidation
  // ===========================================================

  /**
   * Recompute every cached resolved value. Call after:
   *   - spendPoint
   *   - refundAll
   *   - level up (player stats may have changed)
   *   - equipment change (weapon req re-validation)
   *   - load from save
   *
   * Active cooldowns are PRESERVED (not zeroed) so the player can't
   * cheese cooldowns by respeccing.
   */
  recomputeResolved() {
    const tree = (this.player && this.player.skillTree) || {};
    this.resolvedAttacks = engine.resolveAllClassAttacks(tree, this.skillsData, this.playerClass);
    this.resolvedPlayerStats = engine.resolvePlayerStats(tree, this.skillsData, this.playerClass);
    this.conditionalTriggers = engine.resolveConditionalTriggers(tree, this.skillsData, this.playerClass);
    this.capstoneHooks = engine.resolveCapstoneHooks(tree, this.skillsData, this.playerClass);
    this.petMods = engine.resolvePetMods(tree, this.skillsData, this.playerClass);

    // Pre-bucket triggers by event name for O(1) lookup at combat time.
    // Phase 4 game.js will call getTriggersForEvent('onKill') etc. on every
    // combat event — we don't want to filter the flat list each time.
    this._triggersByEvent.clear();
    for (const trig of this.conditionalTriggers) {
      const evt = trig.trigger;
      if (!evt) continue;
      if (!this._triggersByEvent.has(evt)) this._triggersByEvent.set(evt, []);
      this._triggersByEvent.get(evt).push(trig);
    }
  }

  /**
   * Resolve a status payload for a status type, applying any status_modify
   * nodes the player has invested in. Game code calls this whenever it
   * applies a status from a player attack.
   */
  resolveStatusPayload(statusId, baseStatus) {
    const tree = (this.player && this.player.skillTree) || {};
    return engine.resolveStatusPayload(statusId, tree, this.skillsData, this.playerClass, baseStatus);
  }

  // ===========================================================
  //  Trigger / hook accessors
  // ===========================================================

  hasCapstone(hookId) {
    return this.capstoneHooks.has(hookId);
  }

  getConditionalTriggers() {
    return this.conditionalTriggers;
  }

  /**
   * Return all conditional triggers registered for a given event name (e.g.
   * 'onKill', 'onHit', 'belowHPPct', 'postParry'). Game code calls this on
   * every combat event and iterates the returned array, applying each
   * trigger's effect. Returns an empty array if no triggers are registered
   * for the event — never null.
   *
   * Triggers are pre-bucketed at recomputeResolved time so this is O(1).
   */
  getTriggersForEvent(eventName) {
    return this._triggersByEvent.get(eventName) || [];
  }

  getPetMods() {
    return this.petMods;
  }

  getPlayerStatBag() {
    return this.resolvedPlayerStats;
  }

  // ===========================================================
  //  Save / load notifications
  // ===========================================================

  /**
   * Notification hook called by game.js after `player.loadFromSave()` finishes.
   * Authoritative state (skillTree, hotbar) lives on the player; this just
   * tells the manager to invalidate its caches.
   */
  onSaveLoaded() {
    this.recomputeResolved();
  }
}

// ---------------------------------------------------------------
//  Helpers — player resource access
// ---------------------------------------------------------------
//
// The player exposes its resource pool under different field names depending
// on class (rage / mana / stamina). The functions below paper over the
// difference so castSlot() can deduct cost generically.
// ---------------------------------------------------------------

// Player exposes a single resource pool via `this.resource` (current) and
// `this.maxResource` (max). resourceType is 'rage' | 'mana' | 'stamina',
// only used by other systems (regen, UI). The skillManager doesn't care
// what the resource is called — it just deducts cost from `resource`.
function _getPlayerResource(player) {
  if (typeof player.resource === 'number') return player.resource;
  return 0;
}

function _spendPlayerResource(player, amount) {
  if (typeof player.resource === 'number') {
    player.resource = Math.max(0, player.resource - amount);
  }
}

function _addPlayerResource(player, amount) {
  if (typeof player.resource === 'number') {
    const cap = (typeof player.maxResource === 'number') ? player.maxResource : 100;
    player.resource = Math.min(cap, player.resource + amount);
  }
}

function _emptyHotbar() {
  return {
    leftClick: null,
    rightClick: null,
    slot1: null, slot2: null, slot3: null, slot4: null, slot5: null,
  };
}
