/* ---------------------------------------------------------------
 *  skillTreeEngine — pure-function effect engine for the spec-tree skill system
 *
 *  Responsibilities (all stateless):
 *    1. Tree state queries  (points-in-tree, gates, branch lock, can-spend)
 *    2. Tree state mutators (spend, refund) — return NEW state objects
 *    3. Resolution: walk a player's skillTree + skillsData and produce
 *       resolved combat values (per-attack stats, player stat bag, status
 *       payloads, conditional triggers, capstone hooks, pet mods).
 *
 *  This module reads `skills.json` shape (see DESIGN_BRIEF §5.7 for the
 *  effect DSL). It does NOT mutate global state, does not import any other
 *  game system, and must remain side-effect free.
 *
 *  Tree gate constants are defined here so they live in one place.
 * --------------------------------------------------------------- */

// Tier gate thresholds: tier N requires this many points spent in the same tree.
// (Tier 1 = unlocked from the start.)
export const TIER_GATES = { 1: 0, 2: 3, 3: 8, 4: 15, 5: 20 };

// Cooldown floors after CDR — primary attacks cannot fall below 0.3s,
// secondaries cannot fall below 1.0s. See DESIGN_BRIEF §5.4.1.
export const COOLDOWN_FLOORS = { primary: 0.3, secondary: 1.0 };

// ---------------------------------------------------------------
//  Tree key format
// ---------------------------------------------------------------
//
// Tree keys are opaque strings used as dictionary keys in `player.skillTree`.
// We use `/` as the separator to avoid collisions with class or spec ids
// that may legitimately contain underscores (e.g. spec key "bone_lord", or
// a future class "dark_knight"). NO code should split a tree key — they are
// opaque. Use `getSpec(specIdOrKey)` on the manager to resolve aliases.
//
// Examples: "warrior/guardian", "necromancer/bone_lord", "archer/marksman".
// ---------------------------------------------------------------

const TREE_KEY_SEPARATOR = '/';

// ---------------------------------------------------------------
//  Internal helpers
// ---------------------------------------------------------------

function _clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Return a flat list of every spec the player's class owns, as
 * { treeKey, specData, ranks }.
 */
function _allSpecsForClass(skillsData, classId, skillTree) {
  const out = [];
  const classData = skillsData[classId];
  if (!classData) return out;
  for (const [specKey, specData] of Object.entries(classData)) {
    if (typeof specData !== 'object' || !specData.tree) continue;
    const treeKey = makeTreeKey(classId, specKey);
    out.push({
      treeKey,
      specKey,
      specData,
      ranks: (skillTree && skillTree[treeKey]) || {},
    });
  }
  return out;
}

// ---------------------------------------------------------------
//  Tree state — queries
// ---------------------------------------------------------------

export function getNodeRank(skillTree, treeKey, nodeId) {
  if (!skillTree || !skillTree[treeKey]) return 0;
  return skillTree[treeKey][nodeId] || 0;
}

export function getPointsInTree(skillTree, treeKey) {
  if (!skillTree || !skillTree[treeKey]) return 0;
  let total = 0;
  for (const v of Object.values(skillTree[treeKey])) total += v || 0;
  return total;
}

export function getTotalPointsSpent(skillTree) {
  if (!skillTree) return 0;
  let total = 0;
  for (const tree of Object.values(skillTree)) {
    for (const v of Object.values(tree || {})) total += v || 0;
  }
  return total;
}

export function isTierUnlocked(skillTree, treeKey, tier) {
  const gate = TIER_GATES[tier];
  if (gate == null) return false;
  return getPointsInTree(skillTree, treeKey) >= gate;
}

/**
 * For a Tier 3 node with `branchGroup`, return true if the OTHER branch in
 * the same group has any rank invested — meaning this branch is locked.
 */
export function isBranchLocked(skillTree, treeKey, nodeDef, allTreeNodes) {
  if (!nodeDef.branchGroup) return false;
  const myRank = getNodeRank(skillTree, treeKey, nodeDef.id);
  if (myRank > 0) return false; // already mine — not locked
  for (const sibling of allTreeNodes) {
    if (sibling.id === nodeDef.id) continue;
    if (sibling.branchGroup !== nodeDef.branchGroup) continue;
    if (getNodeRank(skillTree, treeKey, sibling.id) > 0) return true;
  }
  return false;
}

/**
 * Can the player spend a point on the given node right now?
 *
 * Returns { ok, reason }. `reason` is one of:
 *   'no_points', 'unknown_node', 'maxed', 'tier_locked', 'branch_locked'
 */
export function canSpend(skillTree, treeKey, nodeDef, allTreeNodes, pointsAvailable) {
  if (pointsAvailable <= 0) return { ok: false, reason: 'no_points' };
  if (!nodeDef) return { ok: false, reason: 'unknown_node' };

  const currentRank = getNodeRank(skillTree, treeKey, nodeDef.id);
  if (currentRank >= nodeDef.maxRank) return { ok: false, reason: 'maxed' };

  if (!isTierUnlocked(skillTree, treeKey, nodeDef.tier)) {
    return { ok: false, reason: 'tier_locked' };
  }

  if (isBranchLocked(skillTree, treeKey, nodeDef, allTreeNodes)) {
    return { ok: false, reason: 'branch_locked' };
  }

  return { ok: true };
}

// ---------------------------------------------------------------
//  Tree state — mutators (return NEW state)
// ---------------------------------------------------------------

/**
 * Spend a single rank on the given node. Caller is responsible for checking
 * canSpend() first; this function is permissive but will refuse to exceed
 * maxRank.
 *
 * Returns the NEW skillTree object (does not mutate input).
 */
export function spendPoint(skillTree, treeKey, nodeDef) {
  const next = _clone(skillTree || {});
  if (!next[treeKey]) next[treeKey] = {};
  const currentRank = next[treeKey][nodeDef.id] || 0;
  if (currentRank >= nodeDef.maxRank) return next;
  next[treeKey][nodeDef.id] = currentRank + 1;
  return next;
}

/**
 * Refund all spent points across all trees. Returns
 * { newTree: {}, totalPointsRefunded: N }.
 */
export function refundAll(skillTree) {
  const total = getTotalPointsSpent(skillTree);
  return { newTree: {}, totalPointsRefunded: total };
}

// ---------------------------------------------------------------
//  Effect resolution — single attack
// ---------------------------------------------------------------

/**
 * Resolve a single attack against a player's tree state. Walks every node in
 * the spec the attack belongs to and applies effects targeting this attack.
 *
 * @param {object} attackDef       — base attack definition from skills.json
 * @param {object} specData        — full spec data (label, color, tree[], primary, secondary)
 * @param {object} ranksForSpec    — { nodeId: rank } for THIS spec only
 * @returns {object} resolved attack with combat-ready values
 */
export function resolveAttack(attackDef, specData, ranksForSpec) {
  if (!attackDef) return null;

  const resolved = _clone(attackDef);

  // Initialize aggregators
  let damageBonusPct = 0;       // additive sum of damage_pct effects
  let cooldownDelta = 0;        // sum of cooldown_flat effects (negative = faster)
  let costDelta = 0;            // sum of cost_flat effects
  let costMinFloor = 0;         // highest minValue floor among cost_flat effects
  const statSets = {};          // explicit set: { statKey: finalValue } from attack_stat with `value`
  const statAdds = {};          // additive: { statKey: sumOfDeltas } from perRank
  const statMults = {};         // multiplicative pct: { statKey: 1 + sumOfPcts }
  const behaviorModes = new Set();
  let statusApplyOverride = null; // from status_apply_attack, replaces base statusApply
  const conditionalTriggers = []; // attack-targeted conditional triggers

  for (const node of specData.tree) {
    const rank = ranksForSpec[node.id] || 0;
    if (rank <= 0) continue;
    if (!Array.isArray(node.effects)) continue;

    for (const eff of node.effects) {
      // Most effects target a specific attack id; skip if not us
      if (eff.target && eff.target !== attackDef.id) continue;

      switch (eff.type) {
        case 'damage_pct': {
          damageBonusPct += (eff.perRank || 0) * rank;
          break;
        }
        case 'cooldown_flat': {
          cooldownDelta += (eff.perRank || 0) * rank;
          break;
        }
        case 'cost_flat': {
          costDelta += (eff.perRank || 0) * rank;
          if (typeof eff.minValue === 'number' && eff.minValue > costMinFloor) {
            costMinFloor = eff.minValue;
          }
          break;
        }
        case 'attack_stat': {
          // Several modes: perRank (additive int/float), perRankPct (multiplicative), value (set), valuePct (multiplicative)
          if (typeof eff.perRank === 'number') {
            statAdds[eff.stat] = (statAdds[eff.stat] || 0) + eff.perRank * rank;
          } else if (typeof eff.perRankPct === 'number') {
            statMults[eff.stat] = (statMults[eff.stat] || 1) + eff.perRankPct * rank;
          } else if (typeof eff.valuePct === 'number') {
            statMults[eff.stat] = (statMults[eff.stat] || 1) + eff.valuePct;
          } else if (eff.value !== undefined) {
            statSets[eff.stat] = eff.value;
          }
          break;
        }
        case 'status_apply_attack': {
          // Add or override the attack's statusApply payload entirely
          const baseDps = eff.baseDps || 0;
          const perRankDps = eff.perRankDps || 0;
          statusApplyOverride = {
            status: eff.status,
            dps: baseDps + perRankDps * rank,
            duration: eff.duration || 0,
            chance: eff.chance != null ? eff.chance : 1.0,
          };
          break;
        }
        case 'behavior_swap': {
          if (eff.mode) behaviorModes.add(eff.mode);
          // Some behavior_swap effects also include a perRank payload (e.g. patchDuration);
          // we surface that via statAdds keyed by `behavior_${stat}` so consumers can read it.
          if (eff.perRank && typeof eff.perRank === 'object') {
            for (const [k, v] of Object.entries(eff.perRank)) {
              statAdds[`behavior_${k}`] = (statAdds[`behavior_${k}`] || 0) + v * rank;
            }
          }
          break;
        }
        case 'conditional_trigger': {
          // Only collect attack-targeted triggers here. Untargeted triggers
          // (player-wide like onKill heal, belowHPPct dr) are handled by
          // resolveConditionalTriggers().
          conditionalTriggers.push({
            sourceNode: node.id,
            target: eff.target,
            trigger: eff.trigger,
            rank,
            perRank: eff.perRank,
            effect: eff.effect,
          });
          break;
        }
        // Other effect types (player_stat, status_modify, capstone_hook,
        // unlock_pet, pet_stat) are NOT applied to the attack itself.
        default:
          break;
      }
    }
  }

  // ----- Apply aggregators to resolved attack -----
  //
  // After this block, the resolved object has CANONICAL fields:
  //   damage, cooldown, cost
  // The base* fields are stripped so callers don't accidentally read the
  // unmodified values from the resolved object. (Use `getAttack(id)` for the
  // base def if you need it for tooltips.)

  const baseDamage   = typeof resolved.baseDamage   === 'number' ? resolved.baseDamage   : null;
  const baseCooldown = typeof resolved.baseCooldown === 'number' ? resolved.baseCooldown : 0;
  const baseCost     = typeof resolved.baseCost     === 'number' ? resolved.baseCost     : 0;

  delete resolved.baseDamage;
  delete resolved.baseCooldown;
  delete resolved.baseCost;

  // Damage — non-damaging attacks (Parry Stance, Raise Dead, Call Beast,
  // Outbreak's cloud) intentionally have baseDamage === 0 OR omitted. Only
  // emit a `damage` field for attacks that actually do damage.
  if (baseDamage != null && baseDamage > 0) {
    resolved.damage = Math.round(baseDamage * (1 + damageBonusPct) * 10) / 10;
  }

  // Cooldown — apply delta. Floor only applies to NEGATIVE deltas (CDR), so
  // a future "slow attack" node with positive cooldown_flat doesn't get
  // clamped up to the floor.
  const candidate = baseCooldown + cooldownDelta;
  if (cooldownDelta < 0) {
    const isPrimary = (resolved.slotHint || '').toLowerCase() === 'primary';
    const floor = isPrimary ? COOLDOWN_FLOORS.primary : COOLDOWN_FLOORS.secondary;
    resolved.cooldown = Math.round(Math.max(floor, candidate) * 100) / 100;
  } else {
    resolved.cooldown = Math.round(Math.max(0, candidate) * 100) / 100;
  }

  // Cost — apply delta + minValue floor (e.g. Hot Hands' min 1 mana for Fireball)
  resolved.cost = Math.max(costMinFloor, baseCost + costDelta);

  // Stat overrides — first set explicit values, then additive, then multiplicative
  for (const [k, v] of Object.entries(statSets)) {
    resolved[k] = v;
  }

  // Always emit `behavior` as an object so consumers don't need null checks.
  resolved.behavior = {};

  for (const [k, v] of Object.entries(statAdds)) {
    if (k.startsWith('behavior_')) {
      resolved.behavior[k.slice('behavior_'.length)] = v;
      continue;
    }
    resolved[k] = (resolved[k] || 0) + v;
  }
  for (const [k, v] of Object.entries(statMults)) {
    resolved[k] = Math.round((resolved[k] || 0) * v * 100) / 100;
  }

  if (statusApplyOverride) {
    resolved.statusApply = statusApplyOverride;
  }

  // Behavior modes from `behavior_swap` effects (e.g. ['meteor', 'leavesBurningPatch'])
  resolved.behaviorModes = behaviorModes.size > 0 ? [...behaviorModes] : [];

  // Attack-targeted conditional triggers (collected separately from player-wide
  // ones — those are returned by resolveConditionalTriggers).
  resolved.attackTriggers = conditionalTriggers;

  return resolved;
}

// ---------------------------------------------------------------
//  Effect resolution — player-wide aggregations
// ---------------------------------------------------------------

/**
 * Walk all of the player class's spec trees and aggregate every player_stat
 * effect into a flat key→value bag. Effects use additive stacking.
 *
 * @param {object} skillTree   — full player skillTree
 * @param {object} skillsData  — parsed skills.json
 * @param {string} classId     — 'warrior' | 'mage' | 'archer' | 'necromancer'
 * @returns {object}           — { armorPct: 0.15, maxHP: 75, lifestealPct: 0.05, ... }
 */
export function resolvePlayerStats(skillTree, skillsData, classId) {
  const bag = {};
  const specs = _allSpecsForClass(skillsData, classId, skillTree);

  for (const { specData, ranks } of specs) {
    for (const node of specData.tree) {
      const rank = ranks[node.id] || 0;
      if (rank <= 0) continue;
      for (const eff of node.effects || []) {
        if (eff.type !== 'player_stat') continue;
        if (eff.target) continue; // player_stat with target is treated as attack-scoped
        if (typeof eff.perRank === 'number') {
          bag[eff.stat] = (bag[eff.stat] || 0) + eff.perRank * rank;
        } else if (eff.value !== undefined) {
          // Boolean / one-shot values: take the value if any rank is invested
          bag[eff.stat] = eff.value;
        }
      }
    }
  }

  return bag;
}

/**
 * Resolve a status type's payload by walking the player's tree for any
 * status_modify nodes that target it. Returns the modified status descriptor
 * (or null if the status isn't referenced anywhere).
 *
 * Game code calls this when applying a status to an enemy.
 *
 * @param {string} statusId  — 'burning' | 'plague' | 'frozen' | 'slowed' | 'bleeding' | 'poisoned'
 * @param {object} skillTree
 * @param {object} skillsData
 * @param {string} classId
 * @param {object} baseStatus — the base status payload from the attack (dps, duration, etc.)
 * @returns {object} resolved status payload
 */
export function resolveStatusPayload(statusId, skillTree, skillsData, classId, baseStatus) {
  const out = baseStatus ? { ..._clone(baseStatus) } : { status: statusId };
  if (!out.status) out.status = statusId;

  const specs = _allSpecsForClass(skillsData, classId, skillTree);

  let dpsPctSum = 0;
  let durationPctSum = 0;
  let durationDeltaSum = 0;
  let spreadChancePerTickSum = 0;
  let slowPctSum = 0;

  for (const { specData, ranks } of specs) {
    for (const node of specData.tree) {
      const rank = ranks[node.id] || 0;
      if (rank <= 0) continue;
      for (const eff of node.effects || []) {
        if (eff.type !== 'status_modify') continue;
        if (eff.status !== statusId) continue;
        switch (eff.stat) {
          case 'dpsPct':
            dpsPctSum += (eff.perRank || 0) * rank;
            break;
          case 'durationPct':
            // Two flavors: perRank * rank, or value (one-shot)
            if (typeof eff.perRank === 'number') durationPctSum += eff.perRank * rank;
            else if (typeof eff.value === 'number') durationPctSum += eff.value;
            break;
          case 'duration':
            durationDeltaSum += (eff.perRank || 0) * rank;
            break;
          case 'spreadChancePerTick':
            spreadChancePerTickSum += (eff.perRank || 0) * rank;
            break;
          case 'slowPct':
            slowPctSum += (eff.perRank || 0) * rank;
            break;
          default:
            break;
        }
      }
    }
  }

  if (out.dps !== undefined) out.dps = Math.round(out.dps * (1 + dpsPctSum) * 10) / 10;
  if (out.duration !== undefined) out.duration = Math.round((out.duration * (1 + durationPctSum) + durationDeltaSum) * 10) / 10;
  if (spreadChancePerTickSum > 0) out.spreadChancePerTick = spreadChancePerTickSum;
  if (slowPctSum > 0) out.slowPct = (out.slowPct || 0) + slowPctSum;

  return out;
}

/**
 * Aggregate every conditional_trigger effect across the player's class trees.
 * Game code reads this list and registers handlers for each trigger event.
 *
 * Each entry: { sourceNode, target?, trigger, rank, perRank?, effect? }
 */
export function resolveConditionalTriggers(skillTree, skillsData, classId) {
  const triggers = [];
  const specs = _allSpecsForClass(skillsData, classId, skillTree);

  for (const { specKey, specData, ranks } of specs) {
    for (const node of specData.tree) {
      const rank = ranks[node.id] || 0;
      if (rank <= 0) continue;
      for (const eff of node.effects || []) {
        if (eff.type !== 'conditional_trigger') continue;
        triggers.push({
          sourceSpec: specKey,
          sourceNode: node.id,
          target: eff.target || null,
          trigger: eff.trigger,
          rank,
          perRank: eff.perRank,
          effect: eff.effect,
        });
      }
    }
  }

  return triggers;
}

/**
 * Return the Set of capstone hookIds the player has invested in. Game code
 * checks membership and runs the corresponding hard-coded handler.
 */
export function resolveCapstoneHooks(skillTree, skillsData, classId) {
  const hooks = new Set();
  const specs = _allSpecsForClass(skillsData, classId, skillTree);

  for (const { specData, ranks } of specs) {
    for (const node of specData.tree) {
      const rank = ranks[node.id] || 0;
      if (rank <= 0) continue;
      for (const eff of node.effects || []) {
        if (eff.type !== 'capstone_hook') continue;
        if (eff.hookId) hooks.add(eff.hookId);
      }
    }
  }

  return hooks;
}

/**
 * Aggregate pet unlocks and pet stat bonuses across the class. Returns a map
 * keyed by petId (e.g. 'wolf', 'skeleton', 'zombie', 'hawk', 'bear', 'bone_golem').
 *
 * Each entry: {
 *   unlocked: bool,
 *   maxCount: number,        // base max count
 *   maxCountBonus: number,   // additive bonus from generic 'maxCountBonus' effects
 *   damagePct: number,       // additive percent
 *   hpPct: number,
 *   attackSpeedPct: number,
 *   ownerLifestealPct: number,
 *   onHitStatus: object | null,
 *   ...
 * }
 *
 * Wildcard petId='*' effects apply to every unlocked pet.
 */
export function resolvePetMods(skillTree, skillsData, classId) {
  const pets = {};
  const wildcards = []; // collect wildcard effects to apply after we know which pets exist
  const specs = _allSpecsForClass(skillsData, classId, skillTree);

  function ensure(petId) {
    if (!pets[petId]) {
      pets[petId] = {
        unlocked: false,
        maxCount: 0,
        maxCountBonus: 0,
        damagePct: 0,
        hpPct: 0,
        attackSpeedPct: 0,
        ownerLifestealPct: 0,
        onHitStatus: null,
      };
    }
    return pets[petId];
  }

  for (const { specData, ranks } of specs) {
    for (const node of specData.tree) {
      const rank = ranks[node.id] || 0;
      if (rank <= 0) continue;
      for (const eff of node.effects || []) {
        if (eff.type === 'unlock_pet') {
          if (rank >= (eff.unlockAtRank || 1)) {
            ensure(eff.petId).unlocked = true;
          }
          continue;
        }
        if (eff.type !== 'pet_stat') continue;

        if (eff.petId === '*') {
          wildcards.push({ eff, rank });
          continue;
        }

        const pet = ensure(eff.petId);
        _applyPetStatEffect(pet, eff, rank);
      }
    }
  }

  // Apply wildcard effects to every pet entry that already exists
  for (const { eff, rank } of wildcards) {
    for (const pet of Object.values(pets)) {
      _applyPetStatEffect(pet, eff, rank);
    }
  }

  return pets;
}

function _applyPetStatEffect(pet, eff, rank) {
  if (typeof eff.perRank === 'number') {
    pet[eff.stat] = (pet[eff.stat] || 0) + eff.perRank * rank;
  } else if (eff.values && Array.isArray(eff.values)) {
    // Per-rank discrete values like maxCountByRank: [1,1,2,2,3]
    const idx = Math.min(rank - 1, eff.values.length - 1);
    if (idx >= 0) {
      // For "maxCountByRank" style we set the absolute value rather than add
      const baseStat = eff.stat.replace(/ByRank$/, '');
      pet[baseStat === 'maxCount' ? 'maxCount' : baseStat] = eff.values[idx];
    }
  } else if (eff.value !== undefined) {
    pet[eff.stat] = eff.value;
  } else if (eff.perRank && typeof eff.perRank === 'object') {
    // e.g. { dps: 1 } increment to onHitStatus
    if (eff.stat === 'onHitStatus' && pet.onHitStatus) {
      for (const [k, v] of Object.entries(eff.perRank)) {
        pet.onHitStatus[k] = (pet.onHitStatus[k] || 0) + v * rank;
      }
    }
  }
}

// ---------------------------------------------------------------
//  Convenience: build a full ResolvedAttacks map for a class
// ---------------------------------------------------------------

/**
 * Resolve every attack the player's class owns (4 attacks: 2 specs × primary + secondary)
 * against the current tree state. Returns a map keyed by attack id.
 *
 * @returns {object} { [attackId]: resolvedAttack }
 */
export function resolveAllClassAttacks(skillTree, skillsData, classId) {
  const out = {};
  const classData = skillsData[classId];
  if (!classData) return out;

  for (const [specKey, specData] of Object.entries(classData)) {
    if (typeof specData !== 'object' || !specData.tree) continue;
    const treeKey = makeTreeKey(classId, specKey);
    const ranks = (skillTree && skillTree[treeKey]) || {};
    if (specData.primary) {
      out[specData.primary.id] = resolveAttack(specData.primary, specData, ranks);
    }
    if (specData.secondary) {
      out[specData.secondary.id] = resolveAttack(specData.secondary, specData, ranks);
    }
  }

  return out;
}

/**
 * Look up an attack definition by id, returning the spec data and base attack
 * def. Useful when you have an attackId but not its spec key.
 */
export function findAttackById(skillsData, attackId) {
  for (const [classId, classData] of Object.entries(skillsData)) {
    if (classId.startsWith('_')) continue;
    if (typeof classData !== 'object') continue;
    for (const [specKey, specData] of Object.entries(classData)) {
      if (typeof specData !== 'object' || !specData.tree) continue;
      if (specData.primary && specData.primary.id === attackId) {
        return { classId, specKey, specData, attackDef: specData.primary };
      }
      if (specData.secondary && specData.secondary.id === attackId) {
        return { classId, specKey, specData, attackDef: specData.secondary };
      }
    }
  }
  return null;
}

/**
 * Find a node by id within a class. Returns { specKey, specData, nodeDef, treeKey } or null.
 */
export function findNodeById(skillsData, classId, nodeId) {
  const classData = skillsData[classId];
  if (!classData) return null;
  for (const [specKey, specData] of Object.entries(classData)) {
    if (typeof specData !== 'object' || !specData.tree) continue;
    const nodeDef = specData.tree.find(n => n.id === nodeId);
    if (nodeDef) return { specKey, specData, nodeDef, treeKey: makeTreeKey(classId, specKey) };
  }
  return null;
}

// ---------------------------------------------------------------
//  Tree-key helpers exposed for callers (skillManager, UI)
// ---------------------------------------------------------------

/**
 * Return the canonical tree key (e.g. "warrior/guardian") for a class+spec pair.
 * The separator (`/`) is intentional — see TREE_KEY_SEPARATOR doc above.
 */
export function makeTreeKey(classId, specKey) {
  return classId + TREE_KEY_SEPARATOR + specKey;
}

/**
 * Resolve specId aliases: caller may pass either "guardian" (spec key) or
 * "warrior/guardian" (tree key). Returns the canonical tree key.
 *
 * We deliberately do NOT split the input string — that's how `bone_lord`-style
 * spec keys would break. Instead we look up by checking both forms against the
 * actual class data.
 */
export function normalizeTreeKey(skillsData, classId, specIdOrKey) {
  if (!specIdOrKey) return null;
  const classData = skillsData[classId];
  if (!classData) return null;
  // Spec key alias?
  if (classData[specIdOrKey] && typeof classData[specIdOrKey] === 'object' && classData[specIdOrKey].tree) {
    return makeTreeKey(classId, specIdOrKey);
  }
  // Already a canonical tree key for some spec of this class?
  for (const specKey of Object.keys(classData)) {
    if (makeTreeKey(classId, specKey) === specIdOrKey) return specIdOrKey;
  }
  return null;
}
