# Dungeon Crawler — Action RPG Design Brief

> A Diablo-inspired action RPG built on the existing wave-survival dungeon crawler.
> Canvas-based, vanilla JavaScript, procedurally generated dungeons.

---

## 1. CORE IDENTITY

**Genre:** Top-down Action RPG (Diablo-lite)
**Camera:** Fixed top-down 2D, Canvas rendered
**Input:** WASD movement, Left-click (primary skill), Right-click (secondary skill), E (interact/NPC), proximity-based loot pickup
**Feel:** Fast combat, meaningful loot, satisfying progression

---

## 2. CHARACTER CLASSES

Four classes, each with a primary resource, distinct playstyle, and class-restricted equipment.

| Class | Resource | Regen Model | Fantasy |
|-------|----------|-------------|---------|
| **Warrior** | **Rage** | Builds on dealing/taking damage. Primary attacks (Bash / Cleave) generate rage per swing. Decays at -2/sec after 4s out of combat. Starts at 30 on floor entry, max 100. | Guardian (defensive) or Berserker (AoE bruiser) |
| **Mage** | **Mana** | Regenerates over time: 1.5 + (INT * 0.05)/sec. Mana potions restore 30% of max. Base max = 80 + (INT * 2). | Glass cannon, AoE spells |
| **Archer** | **Stamina** | Regenerates passively: 5 + (AGI * 0.15)/sec. Fast spender/regen cycle. Base max = 80 + (AGI * 1.5). | Kiting, precision, traps |
| **Necromancer** | **Mana** | Same as Mage. Summoning is the primary mana sink. Base max = 80 + (INT * 2). | Pet army (zombies & skeletons), curses |

### 2.1 Necromancer Pets (Bone Lord Spec)
The Necromancer's **Bone Lord** specialization summons undead via the **Raise Dead** secondary attack (RMB). Pets are **persistent** — they remain until killed or until the player leaves the dungeon floor — but they are NOT auto-summoned. The player actively casts Raise Dead to spawn each pet.

- **Skeleton Warrior**: Melee, moderate HP. Unlocked by the "Bone Army" tree node. Max count scales with node ranks and the "Army of the Dead" tier-4 keystone.
- **Zombie**: Slow, tanky, explodes on death for AoE. Unlocked by the "Shambling Horde" tree node. Max count scales with node ranks.
- **Bone Golem**: Single permanent tank, granted by the **Lich Lord** capstone node.
- Pets persist until killed or player leaves the dungeon floor.
- Pets scale with player INT and Bone Lord tree investment.
- Each Raise Dead cast costs 30 mana (base) and summons one pet of the next available type.

**Raise Dead Behavior at Max Pet Count:**
- **Default**: At max count, Raise Dead heals the nearest pet for 30% of its max HP (no new summon, but the cast still costs mana).
- **With "Dark Pact" node** (Tier 4 Bone Lord): At max count, Raise Dead instead sacrifices the nearest pet for a large AoE explosion (replaces the heal behavior).

The same active-summon pattern is used by the **Archer's Beastmaster** spec via the **Call Beast** secondary attack (RMB), which summons Wolves, Hawks, and Bears unlocked through tree nodes.

---

## 3. ATTRIBUTES & LEVELING

### 3.1 Core Attributes
Every class has the same 4 attributes. Players gain **1 attribute point per level** to freely assign.

| Attribute | Abbr | Effect |
|-----------|------|--------|
| **Strength** | STR | +melee damage, +block effectiveness, +armor (+0.5 per STR) |
| **Intelligence** | INT | +spell damage, +mana pool, +mana regen, +pet damage |
| **Agility** | AGI | +attack speed, +dodge (+0.3%/pt, cap 30%), +movement speed, +crit chance (+0.2%/pt), +stamina pool (Archer) |
| **Stamina** | STA | +max HP (+10/pt), +HP regen (+0.1/s per pt), +status resistance (-1% duration/pt) |

### 3.2 Primary Attribute by Class
Each class has a "primary" attribute that grants bonus damage:
- **Warrior** → STR (+1% melee damage per point)
- **Mage** → INT (+1% spell damage per point)
- **Archer** → AGI (+1% ranged damage per point)
- **Necromancer** → INT (+1% spell & pet damage per point)

### 3.3 Leveling
- XP from killing enemies (scales with enemy level vs player level).
- Each level grants: **+1 attribute point**, **+1 skill point** (spent in spec trees, see Section 5), small base stat increases.
- Max player level: **50** (for initial release). Total at cap: 50 attribute points + 50 skill points.
- **Attribute respec** and **skill tree respec** both available at the Camp Trainer NPC for gold cost (scales with level). First skill respec is free.

### 3.4 XP Curve
XP required to reach next level follows a polynomial curve:

| Level | XP to Next | Cumulative XP |
|-------|-----------|---------------|
| 1→2 | 100 | 100 |
| 5→6 | 400 | 1,200 |
| 10→11 | 1,200 | 5,500 |
| 15→16 | 2,500 | 16,000 |
| 20→21 | 4,500 | 36,000 |
| 25→26 | 7,500 | 70,000 |
| 30→31 | 11,500 | 125,000 |
| 35→36 | 16,500 | 205,000 |
| 40→41 | 22,500 | 315,000 |
| 45→46 | 30,000 | 465,000 |
| 49→50 | 38,000 | 640,000 |

**Formula:** `xpToNext = Math.floor(100 * (level ^ 1.5))`

### 3.5 Enemy XP Rewards

**Base XP per enemy type:**
| Enemy Type | Base XP (at enemy level 1) |
|-----------|---------------------------|
| Grunt | 10 |
| Rusher | 12 |
| Brute | 18 |
| Ranged | 14 |
| Splitter | 15 (no XP from split children) |
| Necromancer | 16 |
| Burrower | 16 |
| Shielder | 18 |
| Bomber | 12 |
| Side Boss | 150 |
| Main Boss | 500 |

**XP scaling formula:** `xpReward = baseXP * enemyLevel * levelDiffMultiplier`

**Level difference multiplier** (prevents farming low-level enemies):
| Player level vs Enemy level | Multiplier |
|-----------------------------|-----------|
| 5+ levels below player | 0.1 (near zero) |
| 3–4 levels below | 0.5 |
| 1–2 levels below | 0.8 |
| Equal level | 1.0 |
| 1–2 levels above | 1.2 |
| 3+ levels above | 1.5 |

---

## 4. RESOURCE SYSTEM

### 4.1 HP (All Classes)
- Base HP = class base + (STA * 10)
- HP regen = 0.5 + (STA * 0.1) per second out of combat, halved in combat
- Death = respawn at camp with penalty (see 7.6)

### 4.2 Armor & Damage Reduction
Armor reduces incoming damage using a diminishing returns formula:
- `damageReduction = armor / (armor + 50 + (attackerLevel * 5))`
- Example: 50 armor vs level 10 attacker → 50 / (50 + 50 + 50) = 33% reduction
- Armor sources: STR bonus (+0.5 armor per STR), equipment, passives (Iron Skin, etc.)
- Armor applies to all damage types (melee, projectile, AoE). Environmental damage (pits, hazards) ignores armor.
- Final damage formula: `damageTaken = rawDamage * (1 - damageReduction) * (1 - flatDamageReduction%)`
  - `flatDamageReduction%` comes from passives like Toughness, applied after armor

### 4.3 Dodge
- Base dodge chance = 0% + (AGI * 0.3%)
- Additional dodge from passives (Nimble) and gear affixes
- **Dodge cap: 30%** (cannot exceed regardless of sources)
- On dodge: **full damage avoidance**. "DODGE" text floats above player in white. Quick translucent flash on player.
- **Dodgeable**: Melee contact damage, enemy projectiles
- **Not dodgeable**: AoE abilities (boss stomp, fire breath cone), environmental damage (pits, hazards), DoT ticks

### 4.4 Critical Hits
- Base crit chance = 2% + (AGI * 0.2%)
- Additional crit from passives (Steady Aim) and gear affixes
- **Base crit damage multiplier: 1.5x** (+50% bonus damage)
- Additional crit damage from passives (Overcharge) and gear
- On crit: larger damage number in red with "!" suffix. Brief screen shake on melee crits.

### 4.5 Status Effects
Skills and enemies can apply status effects. STA provides resistance: **-1% status duration per STA point**.

| Status | Source | Effect | Base Duration |
|--------|--------|--------|--------------|
| **Frozen** | Frost Nova (Cryomancer), Frost Lich | Cannot move or attack | 2s |
| **Slowed** | Frost Shard (Cryomancer), Shielder | -40% movement speed | 3s |
| **Burning** | Flame Bolt / Fireball (Pyromancer), Infernal Wyrm | 5 damage/sec tick | 3s |
| **Plague** | Plague Bolt / Outbreak (Plaguebringer), Plague King | 8 damage/sec tick, can spread via Contagion / Pandemic nodes | 6s |
| **Poisoned** | Poison Trap | 3 damage/sec tick, -20% healing | 4s |
| **Bleeding** | Hemorrhage node (Marksman), Spike Trap | 2 damage/sec tick (3+ from Hemorrhage rank), movement leaves blood trail | 5s |
| **Weakened** | Curse Trap | +25% damage taken | 4s |

> Note: **Plague** is a distinct status from **Poisoned**. Plague has a longer duration, higher tick damage, and can chain via Plaguebringer tree nodes (Wildfire / Pandemic). Both share STA resistance scaling.
> Note: **Festering Wounds** (Plaguebringer Tier 2 node) is a *damage amplifier on plagued enemies*, not a separate status — it stacks with Plague rather than replacing it.

`effectiveDuration = baseDuration * max(0.2, 1 - STA * 0.01)`
Minimum 20% duration (status effects always apply for at least a fraction).

### 4.6 Rage (Warrior Only)
- Starts at **30** each dungeon floor (enough for one opener skill)
- **Bash** (Guardian primary) generates **+10 rage** per swing; **Cleave** (Berserker primary) generates **+8 rage** per swing
- +5 rage on hitting an enemy with any attack, +3 rage on taking a hit
- Decays at -2/sec when out of combat for 4 seconds
- Max 100 rage
- Secondary attacks cost rage (Parry Stance = 25 rage, Whirlwind = 40 rage)

### 4.7 Mana (Mage & Necromancer)
- Base mana = 80 + (INT * 2)
- Regen = 1.5 + (INT * 0.05) per second
- Mana potions restore 30% of max mana
- Secondary attacks cost mana (e.g., Fireball = 18 mana, Frost Nova = 22 mana, Outbreak = 25 mana, Raise Dead = 30 mana). See §5.4 for full attack reference.
- Primary attacks (Flame Bolt, Frost Shard, Plague Bolt, Bone Spear) have low mana cost (5–8) so they remain spammable as the main resource generator/spender loop.

### 4.8 Stamina (Archer)
- Base max stamina = 80 + (AGI * 1.5)
- Regen = 5 + (AGI * 0.15) per second
- Secondary attacks cost stamina (e.g., Multishot = 18, Call Beast = 25). See §5.4 for full attack reference.
- Primary attacks (Aimed Shot, Quick Shot) cost 0 stamina — free to spam.

---

## 5. SKILL SYSTEM

### 5.1 Specialization Overview
Every class has **two specializations**, each defined by:
- A **primary attack** (fast, low/no resource cost)
- A **secondary attack** (slower, higher impact, resource cost)
- A **passive skill tree** of ~16 nodes that improves the primary attack, the secondary attack, and grants passive bonuses

There is **no Skill Vendor**. Players do not buy skills with gold. All progression happens in the **Skill Book (K)** by spending **skill points** earned on level up.

**Hybrid is allowed.** A player can spend points across both specializations of their class. All four attacks (both specs' primary + secondary) are unlocked from level 1 and can be assigned to LMB/RMB freely. This enables mixed builds (e.g., a Mage running Flame Bolt LMB + Frost Nova RMB and splitting points between Pyromancer and Cryomancer trees).

### 5.2 Two-Slot Action Bar
Players assign exactly **2 attacks** at a time:
- **Left-click slot**: Any of the 4 attacks available to your class
- **Right-click slot**: Any of the 4 attacks available to your class

Both slots can hold the same spec's attacks (pure build) or be mixed across specs (hybrid). The action bar contains nothing else — there is no third slot, no separate ultimate slot. Tree nodes upgrade specific attacks individually, so investment in one tree is wasted if you never assign that spec's attacks to a slot.

### 5.3 The Eight Specializations

| Class | Spec 1 | Spec 2 |
|-------|--------|--------|
| Warrior | **Guardian** — defensive, parry, reflect damage, high survival | **Berserker** — high damage, AoE, fragile, attack-speed scaling |
| Mage | **Pyromancer** — fire DoTs, AoE, burning spread | **Cryomancer** — single-target nukes, freeze chains, crowd control |
| Archer | **Marksman** — precision, bleed, multishot, kiting | **Beastmaster** — animal companions, pet army |
| Necromancer | **Plaguebringer** — disease that spreads target-to-target | **Bone Lord** — undead summons (skeletons, zombies) |

### 5.4 Class Attack Reference
All four attacks per class are available from level 1. Numbers below are **base values** before any tree investment.

**Warrior**
| Spec | Slot | Attack | Cost | Cooldown | Description |
|------|------|--------|------|----------|-------------|
| Guardian | Primary | **Bash** | Generates +10 rage | 0.7s | Heavy single-target swing. |
| Guardian | Secondary | **Parry Stance** | 25 rage | 6s | Channel for 2s: blocks all frontal damage and reflects 50% back. |
| Berserker | Primary | **Cleave** | Generates +8 rage | 0.8s | Wide-arc swing, hits all enemies in a frontal cone. |
| Berserker | Secondary | **Whirlwind** | 40 rage | 6s | Spin in place for 2s, AoE damage to all surrounding enemies. |

**Mage**
| Spec | Slot | Attack | Cost | Cooldown | Description |
|------|------|--------|------|----------|-------------|
| Pyromancer | Primary | **Flame Bolt** | 5 mana | 0.6s | Fast projectile, applies Burning DoT. |
| Pyromancer | Secondary | **Fireball** | 18 mana | 2.0s | Exploding projectile with AoE. |
| Cryomancer | Primary | **Frost Shard** | 5 mana | 0.6s | Piercing projectile, slows on hit. |
| Cryomancer | Secondary | **Frost Nova** | 22 mana | 6s | AoE freeze around the player. |

**Archer**
| Spec | Slot | Attack | Cost | Cooldown | Description |
|------|------|--------|------|----------|-------------|
| Marksman | Primary | **Aimed Shot** | 0 stamina | 1.0s | Slow, high-damage single arrow. |
| Marksman | Secondary | **Multishot** | 18 stamina | 2.5s | 3-arrow spread. |
| Beastmaster | Primary | **Quick Shot** | 0 stamina | 0.5s | Fast, low-damage arrow. |
| Beastmaster | Secondary | **Call Beast** | 25 stamina | 4s | Summons next available beast companion. At max count, heals nearest beast for 30% HP. |

**Necromancer**
| Spec | Slot | Attack | Cost | Cooldown | Description |
|------|------|--------|------|----------|-------------|
| Plaguebringer | Primary | **Plague Bolt** | 8 mana | 0.8s | Projectile, applies Plague (8 dmg/s for 6s). |
| Plaguebringer | Secondary | **Outbreak** | 25 mana | 5s | AoE cloud at target location, infects all enemies inside with Plague. |
| Bone Lord | Primary | **Bone Spear** | 8 mana | 0.8s | Piercing projectile, passes through enemies. |
| Bone Lord | Secondary | **Raise Dead** | 30 mana | 4s | Summons next available undead. At max count, behavior depends on tree (heals nearest pet by default; sacrifices nearest pet for AoE if **Dark Pact** is taken). |

### 5.4.1 Cooldown Philosophy
Every attack has a cooldown — there is no truly "free" spam attack. The cooldown ranges create a deliberate two-tempo combat loop:

| Attack Class | Cooldown Range | Feel | UX rule |
|--------------|---------------|------|---------|
| **Primary** (Bash, Flame Bolt, Aimed Shot, Bone Spear, etc.) | **0.5 – 1.0s** | Spammable. Cooldown = animation/cast rate. Player click-mashes or holds LMB and the attack repeats as fast as possible. | Cooldown wipe is brief and subtle — should not interrupt the player's attack rhythm. |
| **Secondary** (Whirlwind, Fireball, Multishot, Raise Dead, etc.) | **2 – 6s** | Punctuated. Player must time these around fights — not every-tick spam. | Cooldown wipe is prominent (full radial sweep + grayscale icon). When ready, slot border flashes class color briefly. |
| **Capstone effects** (Aegis, Phoenix on-kill nova, etc.) | **8s+ internal cooldown** | Once-per-fight or once-per-rotation moments. | Capstone effects are passive triggers, not action bar slots, so they don't show on the LMB/RMB icons. They get a small floating "READY" indicator above the player when off cooldown (TBD in WIREFRAMES). |

**Cooldown Visualization (HUD)**
Both LMB and RMB action bar slots MUST display cooldown progress visually whenever the attack is on cooldown. The visualization is identical to the potion cooldown clock-wipe (see [WIREFRAMES §3 Skill Slots](dungeon-crawler/WIREFRAMES.md#L144)):
1. **Radial clock-wipe** sweeping clockwise from 12 o'clock, dark overlay covering the unsweep portion
2. **Icon desaturated** to grayscale while on cooldown
3. **Numeric remaining time** in small white text centered on the icon (only shown if cooldown > 1.5s, to avoid clutter on primaries)
4. **Ready flash** — when cooldown completes, a brief 150ms class-color border flash + soft "ready" tick sound (only for secondary attacks; primaries are too frequent)
5. **Click-while-on-cooldown** — slot border pulses red briefly + soft error tick. No action consumed.

**Cooldown reduction sources**
- Tree node ranks (e.g., "Vigilant — Parry Stance cooldown -0.6s per rank")
- Equipment affixes (future, not in v1)
- All cooldown reductions stack additively, with a minimum cooldown floor of 0.3s for primaries and 1.0s for secondaries (so cooldown reduction can never reduce a skill below the animation duration).

### 5.5 Skill Points & Budget
- Players gain **1 skill point per level**. Total at max level (50): **50 skill points**.
- Skill points are spent in the Skill Book on tree nodes.
- A fully maxed single tree costs **~33 points**; the remaining ~17 can be invested in the off-tree, or saved.
- **Skill points are separate from attribute points** (1 of each per level).
- There is no longer a separate "passive points" pool — passives live inside the trees.

**Example budgets:**
| Build Style | Spec 1 Investment | Spec 2 Investment | Outcome |
|-------------|------------------|-------------------|---------|
| Pure focus | ~33 (full clear, capstone) | ~17 (shallow dabble) | Strong identity, light off-spec utility |
| Heavy hybrid | ~25 | ~25 | Both trees medium-deep, neither capstone reached |
| Lopsided hybrid | ~30 | ~20 | Capstone in main tree + Tier-4 keystone in off-tree |

### 5.6 Tree Structure
Each spec tree has **5 tiers**. Higher tiers are **gated by points spent in that specific tree** (not class total). Hybrid players unlock tiers in both trees independently.

| Tier | Gate (points in this tree) | Layout |
|------|---------------------------|--------|
| Tier 1 | 0 | 3 ranked nodes (5 ranks each, 1 point per rank). Stat boosters and starter modifiers. |
| Tier 2 | 3 | 3 ranked nodes (3 ranks each). Stronger modifiers. |
| Tier 3 | 8 | 2 mutually-exclusive choice nodes (3 ranks each). Player picks one branch. |
| Tier 4 | 15 | 2 single-rank "keystone" nodes. Gameplay-changing effects. |
| Tier 5 | 20 | 1 capstone node (single rank). Spec-defining ultimate. |

- **Total nodes per tree:** ~16
- **Total points to fully clear one tree:** ~33
- A hybrid player with 18 points in each tree has unlocked Tier 4 in both, but neither capstone.

### 5.7 Tree Node Reference
Numbers below are starting values; expect tuning during balance. Each node lists its rank count and per-rank effect.

#### Warrior — Guardian
| Tier | Node | Ranks | Per-Rank Effect |
|------|------|-------|-----------------|
| 1 | Iron Hide | 5 | +3% armor |
| 1 | Stalwart | 5 | +15 max HP |
| 1 | Heavy Hands | 5 | Bash damage +8% |
| 2 | Reinforced Stance | 3 | Parry Stance duration +0.4s |
| 2 | Spiked Plating | 3 | Reflect damage +10% |
| 2 | Counterattack | 3 | After a successful parry, next Bash deals +30% damage |
| 3a | Hold the Line | 3 | -8% damage taken while moving < 50% speed |
| 3b | Vigilant | 3 | Parry Stance cooldown -0.6s |
| 4 | Taunting Strike | 1 | Bash forces nearby enemies to attack you for 3s |
| 4 | Last Stand | 1 | Below 30% HP, take 25% less damage |
| 5 | **CAPSTONE — Aegis** | 1 | Once per fight, when reduced below 20% HP, become invulnerable for 3s and reflect 100% damage taken back at attackers |

#### Warrior — Berserker
| Tier | Node | Ranks | Per-Rank Effect |
|------|------|-------|-----------------|
| 1 | Brutal Edge | 5 | Cleave damage +10% |
| 1 | Whirling Steel | 5 | Whirlwind damage +10% |
| 1 | Bloodthirst | 5 | +1% lifesteal |
| 2 | Frenzy | 3 | +4% attack speed per enemy hit in last 3s (max 5 stacks) |
| 2 | Wide Arc | 3 | Cleave hits 15% wider |
| 2 | Tornado | 3 | Whirlwind moves with you, +0.3s duration |
| 3a | Reckless | 3 | +12% damage, -5% damage reduction |
| 3b | Endless Carnage | 3 | Kills during Whirlwind extend its duration by 0.5s |
| 4 | Unstoppable | 1 | Immune to slow and root |
| 4 | Crimson Surge | 1 | Killing an enemy heals 5% max HP |
| 5 | **CAPSTONE — Endless Rage** | 1 | While Whirlwind is active, kills refresh its full duration. Effectively no max duration if you keep killing. |

#### Mage — Pyromancer
| Tier | Node | Ranks | Per-Rank Effect |
|------|------|-------|-----------------|
| 1 | Burning Soul | 5 | Burning DoT +15% |
| 1 | Kindling | 5 | Flame Bolt damage +10% |
| 1 | Hot Hands | 5 | Pyromancer skills cost -1 mana (min 1) |
| 2 | Wildfire | 3 | Burning has 10% chance per tick to spread to nearest enemy |
| 2 | Conflagration | 3 | Fireball leaves a +1s burning patch on impact |
| 2 | Heat Wave | 3 | -7% damage taken from burning enemies |
| 3a | Inferno | 3 | Fireball radius +15% |
| 3b | Meteor | 3 | Fireball is replaced by a falling Meteor: slower travel, +damage, +radius |
| 4 | Combustion | 1 | Killing a burning enemy triggers a small fire nova |
| 4 | Eternal Flame | 1 | Burning duration +50% |
| 5 | **CAPSTONE — Phoenix** | 1 | On killing blow, ignite into a fire nova dealing 200% spell damage in a large radius. 8s internal cooldown. |

#### Mage — Cryomancer
| Tier | Node | Ranks | Per-Rank Effect |
|------|------|-------|-----------------|
| 1 | Frostbite | 5 | Frost Shard damage +10% |
| 1 | Glacial Will | 5 | +20 max mana |
| 1 | Cold Edge | 5 | +2% crit chance vs. slowed/frozen enemies |
| 2 | Deep Freeze | 3 | Freeze duration +0.4s |
| 2 | Shatter | 3 | +25% crit damage vs. frozen enemies |
| 2 | Ice Lance | 3 | Frost Shard +15% damage to slowed targets |
| 3a | Cryostasis | 3 | Frost Nova radius +12% |
| 3b | Ice Spear | 3 | Frost Nova fires a piercing ice spear in your facing direction |
| 4 | Arcane Blink | 1 | Out-of-combat right-click blinks 200px (3s cooldown) — utility, doesn't replace your assigned RMB attack in combat |
| 4 | Permafrost | 1 | Slowed enemies have their slow effect duration doubled |
| 5 | **CAPSTONE — Absolute Zero** | 1 | Frozen enemies killed by Frost Shard explode in a smaller Frost Nova that can chain freeze nearby enemies |

#### Archer — Marksman
| Tier | Node | Ranks | Per-Rank Effect |
|------|------|-------|-----------------|
| 1 | Sharpshooter | 5 | Aimed Shot damage +8% |
| 1 | Steady Aim | 5 | +2% crit chance |
| 1 | Quiver | 5 | +6 max stamina |
| 2 | Hemorrhage | 3 | Aimed Shot inflicts Bleeding (3 dmg/s for 5s, +1 dmg/rank) |
| 2 | Hunter's Mark | 3 | Bleeding enemies take +8% damage from all sources |
| 2 | Volley | 3 | Multishot fires +1 arrow |
| 3a | Piercing Aim | 3 | Aimed Shot pierces +1 target |
| 3b | Cripple | 3 | Bleeding enemies are slowed 15% |
| 4 | Dead Eye | 1 | Aimed Shot deals +100% damage vs. full-HP enemies |
| 4 | Hail Pattern | 1 | Multishot's spread arc doubles, covering a wider cone |
| 5 | **CAPSTONE — Phantom Archer** | 1 | When you crit, summon a phantom that mirrors your next 3 attacks for free |

#### Archer — Beastmaster
| Tier | Node | Ranks | Per-Rank Effect |
|------|------|-------|-----------------|
| 1 | Loyal Hound | 5 | Unlocks Wolf companion. +10% wolf damage and HP per rank. Max 1 wolf at rank 1, max 2 at rank 5. |
| 1 | Pack Leader | 5 | All pets +5% damage |
| 1 | Tame the Wild | 5 | All pets +6% HP |
| 2 | Sky Hunter | 3 | Unlocks Hawk companion (ranged attacker, marks targets for +10% damage taken). Max 1. |
| 2 | Apex Predator | 3 | Unlocks Bear companion (tank, taunts in radius). Max 1. |
| 2 | Wild Bond | 3 | Pets heal you for +2% of their damage dealt |
| 3a | Bestial Fury | 3 | Pets gain +4% attack speed |
| 3b | Hunter's Discipline | 3 | Call Beast cooldown -0.4s |
| 4 | Beast Within | 1 | +1 max of each beast type unlocked |
| 4 | Wild Heart | 1 | Pets explode for AoE damage on death |
| 5 | **CAPSTONE — Spirit Wolf** | 1 | Permanent legendary Spirit Wolf companion (massive damage, persistent across floor transitions, no upkeep cost) |

#### Necromancer — Plaguebringer
| Tier | Node | Ranks | Per-Rank Effect |
|------|------|-------|-----------------|
| 1 | Virulent | 5 | Plague DoT +12% |
| 1 | Foul Reach | 5 | Plague Bolt range +6% |
| 1 | Decay | 5 | Plague duration +0.5s |
| 2 | Contagion | 3 | Plague has 10% chance per tick to spread to nearest uninfected enemy (max 30%) |
| 2 | Festering Wounds | 3 | Plagued enemies take +6% damage from all sources |
| 2 | Necrotic Corrosion | 3 | Plague reduces enemy armor by 10% |
| 3a | Pandemic | 3 | Killing a plagued enemy spreads Plague to all enemies within 100/150/200px |
| 3b | Acidic Plague | 3 | Plague also slows enemies by 5% |
| 4 | Outbreak Mastery | 1 | Outbreak radius +30% |
| 4 | Patient Zero | 1 | Plague never expires on the closest infected enemy in your line of sight |
| 5 | **CAPSTONE — Death's Echo** | 1 | A plagued enemy that dies releases a Corpse Explosion (large AoE that re-applies Plague to anything it hits) |

#### Necromancer — Bone Lord
| Tier | Node | Ranks | Per-Rank Effect |
|------|------|-------|-----------------|
| 1 | Bone Army | 5 | Unlocks Skeleton Warriors. Max +1 at ranks 1, 3, 5 (max 3 total). +6% pet damage per rank. |
| 1 | Marrow Edge | 5 | Bone Spear damage +8% |
| 1 | Soul Tether | 5 | Pet HP +10% |
| 2 | Shambling Horde | 3 | Unlocks Zombies (slow, tanky, explode on death). Max 1 / 2 / 2 by rank. |
| 2 | Necrotic Aura | 3 | Pet damage +6% (additive with other pet bonuses) |
| 2 | Bone Spike | 3 | Bone Spear pierces +1 target |
| 3a | Reanimator | 3 | Killing an enemy has 8 / 16 / 25% chance to spawn a free skeleton |
| 3b | Plague Carriers | 3 | Pets apply a small DoT on hit (synergy with Plaguebringer hybrid) |
| 4 | Army of the Dead | 1 | +1 max of every pet type |
| 4 | **Dark Pact** | 1 | Modifies Raise Dead: when at max pet count, sacrifices nearest pet for huge AoE explosion (instead of healing) |
| 5 | **CAPSTONE — Lich Lord** | 1 | All pets become elite undead with +50% HP and +50% damage. Permanently summons one Bone Golem (huge persistent tank). |

### 5.8 Respec
- **Skill tree respec**: Available at the **Trainer NPC** in camp. Cost = `playerLevel * 25g`. Refunds all spent skill points instantly so the player can re-allocate.
- **First skill respec is free** (one-time, encourages experimentation in early game).
- **Attribute respec**: Same Trainer NPC. Cost = `playerLevel * 15g`.
- Respec does not affect equipped attacks (LMB/RMB assignments are preserved across respec).

### 5.9 Skill Book UI (Hotkey: K)
The Skill Book is the central screen for all skill management:
- **Top section — Action Bar**: Two large slots showing currently equipped LMB and RMB attacks. Click a slot to open a picker showing all 4 attacks with descriptions. Drag-and-drop also supported.
- **Left tab — Spec 1 tree**: Visual tree of nodes with tier gates. Click a node to spend a point. Hover for full description and per-rank preview.
- **Right tab — Spec 2 tree**: Same layout for the other specialization.
- **Footer**: Skill points remaining, total invested per tree, "Respec at Trainer" hint.

There is no separate "passive skills" panel — all passives live inside the trees.

### 5.10 Removed / Replaced Mechanics
The following systems from earlier drafts no longer exist:
- **Skill Vendor NPC** (gold-cost skill purchases) — replaced by free, point-based tree progression in the Skill Book
- **Tier-gated active skill list** (Tiers 1–5 with gold costs and player-level requirements) — replaced by 4 attacks per class unlocked at level 1
- **Free Basic Attack** (Slash, Wand Bolt, Shoot, Necrotic Bolt as separate "default" skills) — folded into the spec primary attacks (Bash, Cleave, Flame Bolt, Frost Shard, Aimed Shot, Quick Shot, Plague Bolt, Bone Spear)
- **Separate "passive points" pool** — merged into unified skill points (1 per level)
- **Necromancer auto-summon toggles** — replaced by the **Raise Dead** secondary attack (RMB), which is actively cast
- **Standalone tier-3+ active skills** (Whirlwind, Meteor, Phantom Archer, Corpse Explosion, Dark Pact, Earthquake, Cleave-as-active, Curse of Weakness, etc.) — folded into tree nodes that modify primary or secondary attacks, or repurposed as capstones
- **5-level skill upgrade system** (Lv1–5 per skill with gold upgrade cost) — replaced by node ranks within the trees

---

## 6. ITEMS & EQUIPMENT

### 6.1 Equipment Slots (6 total)
| Slot | Examples |
|------|---------|
| **Main Hand** | Sword, Axe, Staff, Bow, Wand, Dagger |
| **Off Hand** | Shield, Quiver, Orb, Tome, Dagger |
| **Chest** | Plate, Robe, Leather Vest, Chain Mail |
| **Legs** | Greaves, Leggings, Pants |
| **Belt** | Sash, War Belt, Leather Belt |
| **Boots** | Plate Boots, Sandals, Leather Boots |

### 6.1.1 Weapon Requirements & Starter Gear
- **All four spec attacks require a matching weapon equipped in main hand**:
  - Warrior (`Bash`, `Parry Stance`, `Cleave`, `Whirlwind`) requires **sword / axe / dagger**
  - Mage (`Flame Bolt`, `Fireball`, `Frost Shard`, `Frost Nova`) requires **wand / staff**
  - Archer (`Aimed Shot`, `Multishot`, `Quick Shot`, `Call Beast`) requires **bow / crossbow**
  - Necromancer (`Plague Bolt`, `Outbreak`, `Bone Spear`, `Raise Dead`) requires **wand / staff**
- Without a matching weapon, attacks will not fire and a "No weapon equipped!" message displays.
- **Every new character starts with a low-quality (Common) main-hand weapon** matching their class, generated at iLvl 1. This is given automatically on first character creation if `equipment.mainHand` is null.

### 6.2 Rarity Tiers
| Rarity | Color | Affix Count | Drop Weight |
|--------|-------|-------------|-------------|
| **Junk** | Gray | 0 (no stats, sell only) | 15% |
| **Common** | White | 0 (base stats only) | 45% |
| **Uncommon** | Green | 1 random affix | 25% |
| **Rare** | Blue | 2 random affixes | 10% |
| **Epic** | Purple | 3 random affixes + higher rolls | 4% |
| **Legendary** | Orange | 3 affixes + 1 unique effect | 1% |

### 6.3 Item Affixes (Random Properties)
Affixes are rolled when an item drops. Each affix has a value range that scales with item level.

**Prefix pool (one prefix max per item):**
| Prefix | Stat | Range (iLvl 1) | Range (iLvl 50) |
|--------|------|----------------|-----------------|
| Sturdy | +max HP | +5 | +50 |
| Arcane | +max mana | +3 | +30 |
| Swift | +% attack speed | +2% | +12% |
| Deadly | +% crit chance | +1% | +8% |
| Vampiric | +% lifesteal | +0.5% | +4% |
| Fortified | +% damage reduction | +1% | +10% |
| Vigorous | +% stamina regen | +3% | +20% |
| Enraged | +% rage generation | +3% | +20% |

**Suffix pool (one suffix max per item, two for Epic+):**
| Suffix | Stat | Range (iLvl 1) | Range (iLvl 50) |
|--------|------|----------------|-----------------|
| of Strength | +STR | +1 | +8 |
| of Intellect | +INT | +1 | +8 |
| of Agility | +AGI | +1 | +8 |
| of Vitality | +STA | +1 | +8 |
| of the Bear | +max HP | +8 | +60 |
| of Haste | +% movement speed | +2% | +15% |
| of the Owl | +mana regen/s | +0.2 | +1.5 |
| of Thorns | +% reflect damage | +1% | +8% |

**Affix scaling formula:** `value = minValue + (maxValue - minValue) * (iLvl / 50)` with ±15% roll variance.

**Affix rules by rarity:**
- **Uncommon**: 1 prefix OR 1 suffix
- **Rare**: 1 prefix + 1 suffix
- **Epic**: 1 prefix + 2 suffixes (or 2 prefix + 1 suffix), rolls in top 70% of ranges
- **Legendary**: Same as Epic + 1 unique effect (class-specific or universal)

### 6.4 Class Restrictions
| Equipment Type | Warrior | Mage | Archer | Necromancer |
|---------------|---------|------|--------|-------------|
| Swords/Axes | Yes | — | — | — |
| Shields | Yes | — | — | — |
| Staves/Wands | — | Yes | — | Yes |
| Orbs/Tomes | — | Yes | — | Yes |
| Bows/Crossbows | — | — | Yes | — |
| Quivers | — | — | Yes | — |
| Daggers | Yes | Yes | Yes | Yes |
| Plate Armor | Yes | — | — | — |
| Leather Armor | Yes | — | Yes | — |
| Robes | — | Yes | — | Yes |
| Cloth/Light | — | Yes | Yes | Yes |

### 6.5 Item Level
Every item has an **item level (iLvl)** equal to the **enemy level** that dropped it (not the floor number). This provides granular iLvl from 1–50 across the game.

- Enemies on Floor 5 (level range 14–18) drop items at iLvl 14–18.
- Boss chests roll iLvl = boss level (usually top of floor range).
- Vendor items use iLvl = player level.
- **Equipment requirement**: Player level must be >= iLvl - 2.

### 6.6 Loot Drops
Items drop as **world objects** on the ground. They glow with their rarity color.

**Pickup behavior:**
- **Gold**: Auto-picked up when player walks within 48px. No button press needed.
- **Items**: Auto-picked up when player walks within 32px (proximity-based, no click needed). Item flies to inventory with a short animation + pickup sound.
- **Inventory full**: When player is near an item but inventory is full, item stays on ground. Red text "Inventory Full" floats briefly. Player must drop or sell something first.
- **Ground items despawn when leaving the floor** — pick up loot before using stairs or waystone!
- **Left-click and right-click are reserved for combat skills only** — never used for pickup or interaction.

**Drop chances per enemy type:**
| Source | Item Drop Chance | Min Rarity | Gold Drop |
|--------|-----------------|-----------|-----------|
| Regular enemy | 8% | Junk | 1–3g * enemyLevel |
| Elite enemy (future) | 25% | Common | 3–8g * enemyLevel |
| Side boss | 100% (guaranteed) | Uncommon | 15–30g * enemyLevel |
| Main boss chest | 100% x2 items | Rare | 30–60g * enemyLevel |
| Treasure chest | 100% | Common | 5–15g * enemyLevel |

**Boss chest rarity bonus:** Main boss chests roll rarity with +15% weight shift toward higher tiers. Side boss chests get +8%.

### 6.7 Junk Items
- Gray-colored items with no combat stats — broken weapons, bones, rags, rusty chains
- Sole purpose: sell to vendor for gold (1–3g base, scales slightly with floor)
- Auto-tagged as junk in inventory (gray border)
- **Bulk sell junk** button at Item Vendor for convenience

---

## 7. DUNGEON STRUCTURE

### 7.1 Overview
One mega-dungeon with **10 floors**, entered from camp. Each floor is procedurally generated with rooms, corridors, and fog of war.

### 7.2 Floor Layout
Each floor contains:
- **Entrance room** (safe, **always contains a Way Stone**, no traps, player spawns here when entering or after death)
- **Combat rooms** (regular enemies + random traps)
- **Side boss rooms** (optional, off critical path, extra rewards, no traps)
- **Treasure rooms** (chests + higher trap density — risk/reward)
- **Shop room** (wandering merchant — limited stock, higher prices than camp, no traps)
- **Corridors** (connect rooms, may contain low-damage traps)
- **Main boss room** (must defeat to unlock stairs down, no traps)
- **Stairs** (spawn in the boss room after the main boss is defeated; player must walk to them and **press E to descend** — no auto-teleport)

### 7.3 Floor Progression & Recommended Levels

**There are NO hard player-level locks on floors.** Once a floor has been **discovered** (by descending stairs from the previous floor), the player can travel to it from any waystone regardless of their current level. The "Recommended Level" is purely advisory — the player can ignore it if they want a challenge or are returning to farm low-level content.

| Floor | Theme | Recommended Lvl | Enemy Lvl Range | Main Boss | Side Bosses |
|-------|-------|-----------------|-----------------|-----------|-------------|
| 1 | Dark Cellar | 1 | 1–3 | Stoneguard | 0 |
| 2 | Cursed Crypt | 3 | 3–6 | Voidlord | 1 |
| 3 | Molten Cavern | 6 | 6–9 | Swarmmother | 1 |
| 4 | Frozen Depths | 10 | 10–14 | Frost Lich | 1 |
| 5 | Blighted Sewers | 14 | 14–18 | Plague King | 2 |
| 6 | Bone Spire | 18 | 18–23 | Bone Colossus | 2 |
| 7 | Shadow Realm | 23 | 23–28 | Voidlord (Empowered) | 2 |
| 8 | Sunken Temple | 28 | 28–34 | Infernal Wyrm | 2 |
| 9 | Ashen Battlefield | 34 | 34–42 | Crimson General | 3 |
| 10 | The Hollow | 42 | 42–50 | Hollow King | 3 |

**Discovery rule**: Floor N is **discovered** the first time the player descends the stairs from Floor N-1. Floor 1 is discovered automatically on character creation. **Discovery is permanent** — once discovered, a floor remains accessible from any waystone forever (including after death and respawn).

**Underleveled travel warning**: When the player attempts to travel to a floor whose Recommended Level is more than **3 levels above** their current level, the Waystone Travel UI shows a non-blocking warning ("⚠ This floor is recommended for level X. You are currently level Y. Enemies will be much stronger.") and the destination row shows a yellow caution icon. The player can still confirm and travel — the warning exists to prevent accidents, not to block exploration.

**Overleveled travel**: There is no warning or penalty for traveling to floors below your level. Players may want to revisit lower floors to complete side bosses, hunt for specific items, or help a hybrid build catch up — though the level-difference XP multiplier (§3.5) heavily reduces the value of farming low-level enemies.

### 7.4 Enemy Scaling Formulas

**Base stats per enemy type (at level 1):**
| Enemy | HP | Damage | Speed | Attack Cooldown |
|-------|-----|--------|-------|----------------|
| Grunt | 30 | 5 | 70 | 1.0s |
| Rusher | 20 | 4 | 120 | 0.8s |
| Brute | 80 | 12 | 45 | 1.5s |
| Ranged | 25 | 6 | 60 | 1.2s |
| Splitter | 35 | 5 | 65 | 1.0s |
| Necromancer | 40 | 7 | 55 | 1.3s |
| Burrower | 35 | 8 | 75 | 1.0s |
| Shielder | 50 | 6 | 50 | 1.2s |
| Bomber | 15 | 3 (+25 explosion) | 80 | — |

**Per-level scaling:**
- `HP = baseHP * (1 + 0.12 * (level - 1))` → +12% per level
- `Damage = baseDamage * (1 + 0.10 * (level - 1))` → +10% per level
- `Speed = baseSpeed * (1 + 0.01 * (level - 1))` → +1% per level (slight)
- Attack cooldown does not scale (stays fixed)

**Boss scaling:** Bosses use 5x base enemy HP, 2x base enemy damage, and follow the same per-level multipliers.

### 7.4.1 Enemy Threat Tiers
In addition to type and level, every non-boss enemy has a **threat tier** that determines how dangerous the individual is. Tiers are rolled at spawn time with a per-floor weighting. This is separate from enemy level and adds variety within a room — a room can mix minions, elites, and an occasional champion.

| Tier | Spawn Weight | HP Multiplier | Damage Multiplier | Affixes | XP Multiplier | Loot |
|------|--------------|---------------|-------------------|---------|---------------|------|
| **Minion** | ~88% | 1.0× | 1.0× | 0 | 1.0× | Regular drop table (8% item chance) |
| **Elite** | ~10% | 1.5× | 1.25× | 1 random modifier | 1.8× | Bumped drop table (18% item chance, min Uncommon) |
| **Champion** | ~2% | 2.5× | 1.5× | 2 random modifiers | 3.0× | Guaranteed drop (100%, min Rare), small gold shower |
| **Boss** | scripted | 5.0× (base) | 2.0× (base) | scripted | scripted | Boss chest (see §6.6) |

**Tier Modifiers (Affixes)** — drawn from a pool at spawn:
| Modifier | Effect | Visual Tell |
|----------|--------|------------|
| **Vicious** | +25% damage | Red aura around sprite |
| **Swift** | +30% move speed, +20% attack speed | Speed-lines trailing behind |
| **Armored** | +50% armor, -20% incoming damage | Gray metallic sheen |
| **Vampiric** | Heals for 10% of damage dealt | Dark red glow on hit |
| **Explosive** | Deals AoE damage on death (1 enemy-tile radius) | Orange-red body glow |
| **Frenzied** | Gains stacking attack speed when below 50% HP | Red pulse when enraged |
| **Enchanted** | Projectile attacks; resists physical (-25%), weak to magic (+25%) | Blue magic particles |
| **Regenerating** | Regenerates 2% HP/sec out of combat | Faint green pulse |

**Tier Naming**: Elite and Champion enemies get a prefix in front of their type name based on their modifier(s):
- Regular: `Grunt` → Elite with Vicious: `Vicious Grunt` → Champion with Vicious + Swift: `Vicious Swift Grunt` (or a curated name from a small table for flavor — e.g., "Bloodrage Grunt").
- Champion names displayed in **gold** color in the nameplate; Elite names in **silver**.

**Tier Spawn Rules**:
- Minimum 1 Elite per combat room starting Floor 2.
- Minimum 1 Champion per 3 combat rooms starting Floor 4.
- Treasure rooms are guaranteed to contain at least 1 Elite as a "guardian".
- Side boss rooms spawn 2–3 Elite guards alongside the side boss.
- Corridors only spawn Minions (never Elite/Champion — corridors are transitional).

**Tier Scaling by Floor**: Spawn weights shift as the player descends — later floors see more Elites and Champions:
| Floor | Minion | Elite | Champion |
|-------|--------|-------|----------|
| 1–2 | 92% | 7% | 1% |
| 3–5 | 88% | 10% | 2% |
| 6–8 | 82% | 14% | 4% |
| 9–10 | 75% | 19% | 6% |


### 7.5 Waystones
- **Every floor has exactly one Way Stone**, placed in the **entrance room** (the room where the player spawns when entering or descending).
- The Way Stone is a visible blue glowing object — players must walk near it and **press E** to interact.
- Interacting opens the Waystone Travel UI: travel to camp, return to discovered floors, or close.
- Floor state (cleared rooms, opened chests, defeated bosses) persists until the player fully clears the floor.
- Waystone discovery is automatic on first entering a floor (`persistence.discoverFloor()`).
- Camp also has a Way Stone NPC that opens the same UI.

### 7.5.1 Stairs (Floor Descent)
- Stairs spawn in the **center of the boss room** after the main boss is defeated.
- Stairs are **interactive, not auto-teleport** — player must walk to them and press **E** to descend.
- A "[E] Descend to next floor" prompt appears when the player is in proximity.
- On descent: player transitions to the next floor's entrance room (where the new floor's Way Stone is located).

### 7.6 Death Penalty
On death:
- Player respawns at **camp** (not at floor waystone).
- **Lose 10% of carried gold** (minimum 0).
- **Dungeon floor state preserved** — rooms you cleared stay cleared.
- **Items on the ground are lost** — pick up loot before dying!
- Player does **NOT** lose XP. Gold loss is the sole progression penalty.

### 7.7 Dungeon Traps
Traps spawn randomly in combat rooms, corridors, and treasure rooms. They add environmental danger and reward observant players who learn to spot and avoid them.

#### Trap Visibility
- Traps are **visible but subtle** — observant players can see them before triggering.
- Each trap type has a distinct visual tell (see WIREFRAMES.md for visual spec).
- Traps become easier to see as the player gets closer (opacity increases from 30% at 200px to 100% at 80px).
- Traps are **not shown on the minimap** — players must watch the ground.

#### Trap Activation
- Traps activate when the player (or a pet) walks within their **trigger radius** (32px center-to-center).
- Once triggered, the trap plays an activation animation (0.3s) then applies its effect.
- **Traps are single-use** — they disappear after triggering.
- Traps do NOT affect enemies (only the player and player pets).
- Dodge does NOT apply to trap damage (environmental source, not dodgeable).
- Armor DOES reduce trap damage (except for status-only traps like Slow Trap).

#### Trap Types

| Trap | Visual Tell | Trigger Effect | Damage | Status | Floor Appears |
|------|-----------|----------------|--------|--------|--------------|
| **Poison Trap** | Small green bubbling puddle | Cloud of poison gas (64px AoE) | 3 dmg/sec * floor tier | Poisoned (4s) | Floor 1+ |
| **Fire Trap** | Faint orange glow lines on floor | Flame burst (48px AoE) | 15 + (5 * floor tier) instant | Burning (3s) | Floor 2+ |
| **Spike Trap** | Thin line cracks in floor tiles | Spikes shoot up | 20 + (8 * floor tier) instant | Bleeding: 2 dmg/sec for 5s | Floor 3+ |
| **Explosive Trap** | Small round device with red blink | Explosion (80px AoE, 0.5s delay after trigger) | 30 + (10 * floor tier) instant | Knockback (pushes player 60px) | Floor 4+ |
| **Slow Trap** | Faint blue frost runes on ground | Frost burst (64px AoE) | 0 | Slowed (5s, -50% speed) | Floor 2+ |
| **Curse Trap** | Dark purple sigil on floor | Dark energy pulse | 0 | Weakened (6s, +25% damage taken) | Floor 6+ |

**Floor tier** = `Math.ceil(floorNumber / 2)` → Floors 1-2 = tier 1, Floors 3-4 = tier 2, etc.

#### Bleeding Status (New — Trap-Specific)
| Status | Source | Effect | Base Duration |
|--------|--------|--------|--------------|
| **Bleeding** | Spike Trap | 2 damage/sec tick, movement leaves blood trail | 5s |

Bleeding is reduced by STA resistance like other statuses. Added to section 4.5 status table.

#### Trap Density Per Floor
| Floor Range | Traps Per Room (avg) | Traps Per Corridor (avg) |
|------------|---------------------|-------------------------|
| 1–3 | 1–2 | 0–1 |
| 4–6 | 2–3 | 1 |
| 7–10 | 3–5 | 1–2 |

Treasure rooms have **higher trap density** (+50%) as a risk/reward tradeoff for loot. Boss rooms have **no traps** (boss fight is the challenge). Entrance rooms (waystones) and safe rooms have **no traps**.

#### Trap Placement Rules
- Traps are placed during procedural generation (seeded RNG, same as room layout).
- Minimum 48px spacing between traps (no overlapping trigger zones).
- Traps never spawn within 96px of a door/entrance (player always has a safe step into a room).
- Traps never spawn on top of obstacles (pillars, walls).
- Corridors only get Poison or Slow traps (low-damage/utility — corridors are narrow, unavoidable traps would be unfair).

---

## 8. POTIONS & CONSUMABLES

### 8.1 Potion & Scroll Types
| Item | Effect | Cooldown | Stack Size | Buy Price | Grid Size |
|--------|--------|----------|-----------|-----------|-----------|
| **HP Potion** | Restore 30% of max HP | 3s (shared) | 5 | See pricing table | 1x1 |
| **Mana Potion** | Restore 30% of max mana | 3s (shared) | 5 | See pricing table | 1x1 |
| **Stamina Tonic** | Instant full stamina refill | 5s (own cd) | 3 | See pricing table | 1x1 |
| **Rage Tonic** | Instantly gain 50 rage | 5s (own cd) | 3 | See pricing table | 1x1 |
| **Scroll of Teleportation** | Open a return portal to camp | 1s | 5 | 4× tonic price | 1x1 |

**Potion pricing by player level bracket:**
| Player Level | HP/Mana Potion | Stamina/Rage Tonic | Scroll of Teleport |
|-------------|---------------|-------------------|-------------------|
| 1–10 | 10g | 15g | 60g |
| 11–20 | 25g | 35g | 140g |
| 21–35 | 50g | 65g | 260g |
| 36–50 | 80g | 100g | 400g |

### 8.2 Potion Rules
- **Shared cooldown**: HP and Mana potions share a 3-second cooldown (can't chug both instantly).
- **Class-appropriate potions**: Mana potions only usable by Mage/Necro. Stamina Tonics only by Archer. Rage Tonics only by Warrior.
- **Stacking**: All consumables stack to their `maxStack` value (HP/Mana 5, tonics 3, scrolls 5). Same-type items merge into existing stacks via `inventory.addItem()`.
- **Hotbar**: Slots 1–4 for quick-use consumables. Drag from inventory to assign.
- **Sources**: Buy from Item Vendor, drop from enemies (low chance), found in treasure chests.
- Potions occupy inventory grid space (1x1 each, stacks shown as count overlay).

### 8.3 Scroll of Teleportation
A powerful consumable that creates a two-way portal between the dungeon and camp.

**Use flow:**
1. **In dungeon**: Player uses scroll from hotbar (or assigned slot 1-4)
2. A swirling purple **portal** spawns at the player's current dungeon position
3. Player is instantly teleported to camp
4. A matching **return portal** appears in camp near the campfire
5. Player can shop, train, repair, etc. in camp as normal — dungeon state (room progress, enemies, loot, traps) is fully preserved
6. **To return**: Walk to the camp return portal and press **E**
7. Player teleports back to the exact dungeon position; both portals vanish (one scroll = one round trip)

**Rules:**
- Can only be used while in a dungeon (no-op in camp or menus)
- Dungeon state is stashed in `_savedDungeonState` and fully restored on return
- The scroll is consumed when used (decreases stack count by 1)
- Round-trip mechanic: each scroll = one camp visit + one return; using a second scroll mid-portal creates a new portal pair
- Visual: Pulsing purple radial gradient with spinning ring and white center sparkle
- Audio: `waystoneTravel` sound on both teleport and return

**Why use it:**
- Stash loot mid-dungeon without losing room progress
- Buy more potions/scrolls before a tough boss
- Train new skills/passives between rooms
- Heal at the campfire when health potions run out

**Sources:**
- Item Vendor (4× tonic price — premium item)
- Optional rare drop from treasure chests (future)

---

## 9. INVENTORY SYSTEM

### 9.1 Grid-Based Inventory (Diablo-Style)
- Grid size: **10 columns x 6 rows** (60 cells)
- Items occupy different cell sizes:

| Item Type | Grid Size |
|-----------|-----------|
| Weapons (2H: Staff, Bow) | 1x3 |
| Weapons (1H: Sword, Axe, Wand, Dagger) | 1x2 |
| Shields | 1x2 |
| Chest, Legs | 2x2 |
| Boots | 1x2 |
| Belt | 2x1 |
| Orbs, Quivers, Tomes | 1x1 |
| Potions | 1x1 (stackable, count overlay) |
| Junk | 1x1 |
| Gold | Not in inventory (currency counter) |

### 9.2 Inventory Interactions
- **Hover item** → Show tooltip (stats, affixes, comparison to equipped)
- **Left-click item** → Pick up / place item (drag mode). Click outside panel to drop at player's feet.
- **Right-click item** → Context menu: Equip / Use / Drop / Mark as Junk
- **Shift-click** → Quick-equip (if equipment) or quick-use (if consumable)
- **Ground pickup** → Proximity-based (walk within 32px), no click needed. See section 6.6.

### 9.3 Equipment Comparison
When hovering an inventory item, show side-by-side comparison with currently equipped item in that slot:
- **Green** numbers = upgrade
- **Red** numbers = downgrade
- Show net stat change (e.g., "+12 HP, -3% speed")
- Show "Cannot Equip" in red if class-restricted or level too low

### 9.4 Stash (Future)
> Placeholder for a future camp stash chest (shared storage). Not in v1.

---

## 10. ECONOMY & VENDORS

### 10.1 Gold
- **Earned from**: Enemy kills (auto-pickup), selling items, chest loot
- **Spent on**: Skill tree respec (first free, then `level * 25g`), attribute respec (`level * 15g`), vendor equipment, potions and scrolls
- **Death penalty**: Lose 10% on death

> Note: With skill purchases removed, gold demand is significantly lower than in earlier drafts. Vendor prices, drop rates, and respec costs may need rebalancing during Phase 5.

### 10.2 Item Vendor (Camp NPC)
- Sells a rotating stock of equipment (refreshes when returning from a dungeon run)
- Stocks items appropriate to player level (iLvl = player level, Common–Rare rarity)
- **Buy prices**: 2x the sell value
- **Sell prices**: Base value scales with rarity and iLvl
- **Bulk sell junk** button for convenience
- Also sells potions at fixed prices (see 8.1)

| Rarity | Base Sell Value (iLvl 1) | Base Sell Value (iLvl 50) |
|--------|-------------------------|--------------------------|
| Junk (Gray) | 1g | 5g |
| Common | 5g | 25g |
| Uncommon | 15g | 60g |
| Rare | 40g | 150g |
| Epic | 100g | 400g |
| Legendary | 300g | 750g |

**Sell formula:** `sellValue = baseSellForRarity * (0.5 + 0.5 * (iLvl / 50))`

### 10.3 Trainer (Camp NPC — Respec Only)
The Trainer no longer sells or upgrades skills. All skill progression happens in the Skill Book (K) by spending skill points earned at level-up. The Trainer's only function is **respec**:
- **Reset skill tree** (refund all skill points): cost = `playerLevel * 25g`. **First respec is free.**
- **Reset attribute points**: cost = `playerLevel * 15g`.
- The Trainer NPC may also display a read-only summary of the player's current spec investment for convenience.

---

## 11. CAMP (HUB)

### 11.1 NPCs
| NPC | Function | Icon |
|-----|----------|------|
| **Trainer** | Respec skill tree (first free, then gold) and attribute points (gold). No skill purchases — all progression happens in the Skill Book. | ⚔ |
| **Item Vendor** | Buy/sell equipment, buy potions, sell junk | 🛒 |
| **Waystone** | Travel to discovered dungeon floors, enter dungeon | 🔵 |
| **Campfire** | Full HP/resource restore (approach to heal) | 🔥 |

### 11.2 Camp Actions
- Manage inventory (always accessible via I hotkey)
- Manage equipment (always accessible via I hotkey — same panel)
- Open skill book (always accessible via K hotkey)
- Interact with NPCs (walk within range + press E)

---

## 12. UI LAYOUT

> Full wireframes, interaction specs, and rendering strategy are in **WIREFRAMES.md**.
> This section is a summary of the key UI decisions.

### 12.1 HUD Design (Diablo 2 Inspired)
- **HP Globe** (bottom-left): Circular, fills from bottom proportional to HP%. Deep red.
- **Resource Globe** (bottom-right): Same shape, color per class (orange=Rage, blue=Mana, green=Stamina).
- **Potion Hotbar** (bottom-center-left): 4 slots, keys 1–4, radial cooldown overlay.
- **Skill Slots** (bottom-center-right): 2 larger slots (LMB/RMB), swap arrows open quick picker flyout.
- **Panel Buttons** (bottom-center, below hotbars): 3 clickable buttons — `Char` (C), `Skills` (K), `Inv` (I) — that toggle their respective overlay panels. Primary interaction method; keyboard shortcuts are secondary.
- **XP Bar**: Thin bar spanning full bottom panel width.
- **Minimap** (top-left): Small, expands to full map on Tab.
- **Info** (top-right): Floor, Level, Gold.
- **Boss HP Bar** (top-center): Only visible during boss fights.
- **Enemy Nameplates** (above each enemy): Name, level (color-coded vs player level), and thin health bar rendered above every non-boss enemy. Always visible while alive and on-screen.

### 12.2 Overlay Panels
- **Inventory + Equipment** (I): Left side = equipment doll (6 slots), right side = 10x6 grid. Item tooltips with comparison.
- **Character** (C): Attributes with [+] buttons, full stat breakdown.
- **Skill Book** (K): Two specialization tabs with tier-gated tree nodes (Tier 1–5), action bar at top showing currently equipped LMB/RMB attacks, hover detail for any node, and skill points remaining counter. All skill progression happens here — no separate vendor.
- **Trainer**: Respec skill tree (first free, then gold) and attribute points (gold). No skill purchases.
- **Item Vendor**: Buy/sell split view, bulk sell junk.
- **Waystone Travel**: Floor list with states (Cleared / In Progress / New / Undiscovered). Recommended Level shown per floor; no hard locks. Warning dialog on underleveled travel (>3 levels above player).
- Panels overlay the game (dimmed background). Only one panel open at a time. ESC closes.

### 12.3 Hotkeys
| Key | Action |
|-----|--------|
| WASD | Move |
| Left Click | Primary action (equipped skill) |
| Right Click | Secondary action (equipped skill) |
| C | Toggle Character panel |
| I | Toggle Inventory + Equipment |
| K | Toggle Skill Book |
| E | Interact (NPC / Chest / Waystone) |
| 1–4 | Use consumable from hotbar |
| Alt (hold) | Show all ground item labels |
| Tab | Toggle full map |
| ESC | Close panel / Pause |

---

## 13. PERSISTENCE (LocalStorage)

### 13.1 Save Data Structure
```json
{
  "character": {
    "class": "warrior",
    "level": 12,
    "xp": 4500,
    "xpToNext": 6000,
    "attributes": { "str": 8, "int": 3, "agi": 5, "sta": 6 },
    "attributePointsAvailable": 0,
    "gold": 342,
    "equippedAttacks": { "leftClick": "warrior_guardian_bash", "rightClick": "warrior_berserker_whirlwind" },
    "skillTree": {
      "warrior_guardian": { "iron_hide": 3, "heavy_hands": 5, "counterattack": 2 },
      "warrior_berserker": { "whirling_steel": 5, "tornado": 3, "endless_carnage": 1 }
    },
    "skillPointsAvailable": 1,
    "freeRespecUsed": false
  },
  "equipment": {
    "mainHand": null,
    "offHand": null,
    "chest": null,
    "legs": null,
    "belt": null,
    "boots": null
  },
  "inventory": {
    "grid": [                          // 10x6 2D array, each cell = null or itemId
      [null, "item_1", "item_1", null, ...],
      [null, "item_1", "item_1", null, ...],
      ...
    ],
    "items": {                         // Dictionary of item data keyed by itemId
      "item_1": { "baseType": "chainmail", "rarity": "uncommon", "iLvl": 8, "affixes": [...], "gridX": 1, "gridY": 0, "gridW": 2, "gridH": 2 },
      "item_2": { ... }
    },
    "hotbar": ["item_3", null, null, null]  // 4 slots, references itemId of potion stacks
  },
  "dungeon": {
    "discoveredFloors": [1, 2, 3],
    "currentFloor": 3,
    "floorStates": {
      "1": { "cleared": true },
      "2": { "cleared": true },
      "3": { "roomsCleared": [0, 1, 4, 7], "bossesDefeated": [], "chestsOpened": [] }
    }
  },
  "settings": { "volume": 0.5 }
}
```

---

## 14. IMPLEMENTATION PHASES

### Phase 1 — Core Systems Overhaul
1. **Attribute System**: STR/INT/AGI/STA data model, point allocation, stat formulas
2. **Resource System**: HP + Rage/Mana/Stamina per class, regen logic, resource bar rendering
3. **HUD Overhaul**: HP bar + resource bar, level display, gold counter, action bar slots

### Phase 2 — Skill System (Spec Trees)
4. **Spec & Attack Data**: Define all 8 specs in JSON — for each spec, primary attack, secondary attack, and tree node list with rank counts and effects
5. **Two-Slot Action Bar**: LMB/RMB attack assignment from the 4 class attacks (all unlocked at level 1), execution with resource costs and cooldowns
6. **Skill Tree System**: Tier-gated nodes (gates check points spent in same tree), ranked nodes, point spend/refund, capstone unlock at 20+ points
7. **Skill Book UI**: Action bar slots at top, two spec tree tabs below, hover tooltips with per-rank previews, skill points remaining indicator
8. **Trainer NPC (Respec)**: Skill tree respec (first free, then `level * 25g`), attribute respec (`level * 15g`)
9. **Tree Node Effect Engine**: Generic system to apply node effects to specific attacks (damage modifiers, behavior modifiers like "Fireball leaves burning patch", capstone hooks)

### Phase 3 — Items & Inventory
10. **Item Data Model**: Item generation with rarity, affixes, iLvl, grid size, class restrictions
11. **Grid Inventory UI**: Drag-and-drop, tooltips, comparison, junk marking
12. **Equipment System**: 6 slots, stat bonuses applied to player, class restriction checks
13. **Loot Drops**: World item objects, proximity auto-pickup, gold auto-pickup, drop tables
14. **Potion System**: HP/Mana/Stamina/Rage potions, hotbar slots 1–4, shared cooldowns
15. **Item Vendor NPC**: Buy/sell, junk bulk-sell, rotating stock, potion sales

### Phase 4 — Dungeon Restructure
16. **Single Dungeon, 10 Floors**: Replace multi-dungeon with one deep dungeon, themed floors
17. **Recommended Level + Discovery System**: No hard floor locks. Floor becomes accessible once discovered (descending stairs from previous floor). Display Recommended Level on waystone UI. Show non-blocking warning + confirmation dialog when traveling to a floor whose recommended level is >3 above the player's current level.
18. **Side Boss Rooms**: Optional boss encounters off critical path with better loot
19. **Waystone System**: Per-floor fast travel, camp return, progress save
20. **Death & Respawn**: Gold penalty, camp respawn, preserved floor state, lost ground items
21. **Boss Chests**: Loot containers after boss defeat with rarity bonuses
22. **Enemy Scaling**: Apply per-level HP/damage/speed formulas from section 7.4
23. **Dungeon Traps**: 6 trap types, visibility scaling, trigger/activation, placement rules per section 7.7

### Phase 5 — Polish & Balance
24. **XP Tuning**: Verify XP curve feels right across all 10 floors, adjust enemy XP values
25. **Gold Economy**: Verify gold income vs respec/item costs, adjust vendor prices and drop rates (skill purchases removed — likely needs rebalancing)
26. **Item Balance**: Verify affix ranges don't create OP combinations at any iLvl
27. **Spec Balance**: Tune tree node values across all 8 specs; verify capstones aren't runaway-OP; verify hybrid builds remain viable
28. **UI Polish**: Smooth transitions, loot pickup effects, inventory sounds, minimap fog
29. **Audio**: New SFX for spec attacks, tree node investment, capstone unlock, loot drop/pickup, potion use, level up, vendor interaction

---

## 15. DATA FILE CHANGES NEEDED

| File | Changes |
|------|---------|
| `classes.json` | Add resource type, base resource stats, base attributes, the 4 attack IDs available to the class (2 per spec) |
| `skills.json` | **Restructure entirely** around the 8 specializations. Schema: `{ warrior: { guardian: { primary: {...}, secondary: {...}, tree: [nodes] }, berserker: {...} }, mage: {...}, ... }`. Each tree node has `id`, `tier` (1-5), `maxRank`, `effect` descriptor, and optional `mutuallyExclusiveWith` for tier-3 choice nodes. |
| `levels.json` | **Replace** with `floors.json` (10 floors, level reqs, enemy level ranges, boss defs, theme) |
| `camp.json` | Trainer NPC: respec-only role (skill tree + attributes), no skill purchases |
| **NEW** `items.json` | Item base types, affix pools, rarity weights, class restrictions, grid sizes |
| **NEW** `lootTables.json` | Per-floor drop tables, boss chest tables, treasure chest tables |
| **NEW** `potions.json` | Potion definitions (type, effect, cooldown, stack size, price) |

---

## 16. KEY TECHNICAL DECISIONS

1. **Item generation is server-less** — all RNG is client-side with seeded generators for reproducibility.
2. **Inventory uses a 2D grid array** — each cell stores null or a reference to the item occupying it. Items store their top-left grid position.
3. **Skills are data-driven** — every spec's primary attack, secondary attack, and tree nodes are defined in JSON. Tree nodes use a small effect-descriptor DSL (e.g. `{type: "damage_pct", target: "bash", value: 0.08}`) that the engine applies generically. Capstones and other bespoke nodes (behavior swaps, conditional triggers) register named hooks in code.
4. **Dungeon floors are regenerated on entry** unless floor state is saved (rooms cleared, etc.). Seed = floor number + character class for consistency.
5. **Equipment stats are computed** — base class stats + attribute bonuses + passive bonuses + all equipped item stats = final stats. Recalculated on any equip/unequip/level/respec event.
6. **Pets are actively summoned via the secondary attack** — Bone Lord (Necromancer) uses **Raise Dead** on RMB to summon undead; Beastmaster (Archer) uses **Call Beast** on RMB to summon companions. Pets are persistent (until killed or floor exit), have independent AI, and scale with player INT/AGI and tree investment. At max pet count, the secondary attack heals the nearest pet (default) or sacrifices it for AoE damage if the **Dark Pact** node is taken (Bone Lord only).
7. **Item level = enemy level** (not floor number) — provides 50 granular iLvl tiers instead of 10.
8. **Single death penalty** — gold loss only. No XP loss. Keeps progression feeling forward-moving while still punishing carelessness.

---

*This document is the source of truth for the dungeon crawler ARPG redesign. Update it as decisions evolve.*
