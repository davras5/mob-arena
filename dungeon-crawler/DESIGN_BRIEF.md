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
| **Warrior** | **Rage** | Builds on dealing/taking damage. Basic attack "Slash" generates +10 rage per swing. Decays at -2/sec after 4s out of combat. Starts at 30 on floor entry, max 100. | Melee bruiser, cleave & charge |
| **Mage** | **Mana** | Regenerates over time: 1.5 + (INT * 0.05)/sec. Mana potions restore 30% of max. Base max = 80 + (INT * 2). | Glass cannon, AoE spells |
| **Archer** | **Stamina** | Regenerates passively: 5 + (AGI * 0.15)/sec. Fast spender/regen cycle. Base max = 80 + (AGI * 1.5). | Kiting, precision, traps |
| **Necromancer** | **Mana** | Same as Mage. Summoning is the primary mana sink. Base max = 80 + (INT * 2). | Pet army (zombies & skeletons), curses |

### 2.1 Necromancer Pets
Pets are **persistent summons** — they do NOT occupy action bar slots. Once the player owns a summoning skill, pets are summoned automatically when below max count and off cooldown. The two action bar slots are free for combat skills (Corpse Explosion, Dark Pact, Necrotic Bolt, etc.).

- **Skeleton Warrior**: Melee, moderate HP, auto-summoned. Max count scales with skill level + "Army of the Dead" passive.
- **Zombie**: Slow, tanky, explodes on death for AoE. Auto-summoned. Max count scales with skill level.
- Pets persist until killed or player leaves dungeon floor.
- Pets scale with player INT and summoning skill level.
- Summoning still costs mana per pet summoned (deducted automatically when a summon triggers).
- If player lacks mana, summon is delayed until mana is available.

**Pet Summon Behavior:**
- Summon cooldown per skill (e.g., Skeleton = 3s, Zombie = 5s).
- When a pet dies and count < max, the cooldown begins automatically.
- Player can toggle auto-summon on/off per pet type via the Skill Book.

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
- Each level grants: **+1 attribute point**, **+1 passive skill point**, small base stat increases.
- Max player level: **50** (for initial release).
- **Attribute respec** available at Camp Trainer NPC for gold cost (scales with level).

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
| **Frozen** | Frost Nova, Frost Lich | Cannot move or attack | 2s |
| **Slowed** | Frost abilities, Shielder | -40% movement speed | 3s |
| **Burning** | Fireball Lv5, Infernal Wyrm | 5 damage/sec tick | 3s |
| **Poisoned** | Poison Arrow, Plague King | 3 damage/sec tick, -20% healing | 4s |
| **Weakened** | Curse of Weakness (Necro), Curse Trap | +25% damage taken | 4s |
| **Bleeding** | Spike Trap | 2 damage/sec tick | 5s |

`effectiveDuration = baseDuration * max(0.2, 1 - STA * 0.01)`
Minimum 20% duration (status effects always apply for at least a fraction).

### 4.6 Rage (Warrior Only)
- Starts at **30** each dungeon floor (enough for one opener skill)
- **Slash** (basic attack) generates **+10 rage** per swing
- +5 rage on hitting an enemy with any skill, +3 rage on taking a hit
- Decays at -2/sec when out of combat for 4 seconds
- Max 100 rage
- Skills cost rage (e.g., Shield Charge = 25 rage, Whirlwind = 40 rage)

### 4.7 Mana (Mage & Necromancer)
- Base mana = 80 + (INT * 2)
- Regen = 1.5 + (INT * 0.05) per second
- Mana potions restore 30% of max mana
- Skills cost mana (e.g., Fireball = 15 mana, Summon Skeleton = 30 mana)

### 4.8 Stamina (Archer)
- Base max stamina = 80 + (AGI * 1.5)
- Regen = 5 + (AGI * 0.15) per second
- Skills cost stamina (e.g., Evasive Roll = 25, Rain of Arrows = 40)
- Basic attacks cost 0 stamina (free to shoot)

---

## 5. SKILL SYSTEM

### 5.1 Two-Slot Action Bar
Players equip exactly **2 skills** at a time:
- **Left-click slot**: Any skill (attack, spell, block, etc.)
- **Right-click slot**: Any skill

A default "Basic Attack" is always available — it is class-appropriate (sword swing, wand bolt, arrow, necrotic bolt) and costs no resource. Players can assign Basic Attack to either slot, or replace both with learned skills.

**Exception — Necromancer Summons:** Summoning skills (Summon Skeleton, Summon Zombie, Undead Army) are **passive toggles**, not action bar skills. They auto-cast when below max pet count and mana is available. This frees both action bar slots for combat skills.

### 5.2 Skill Book (UI — Hotkey: K)
The Skill Book is an inventory-like UI that shows all skills the player has learned:
- **Active Skills**: Assigned to L/R click slots via drag or click-to-assign
- **Passive Skills**: Displayed read-only (current ranks and effects). Investment happens at the Trainer NPC only.
- **Summon Toggles** (Necro): On/off switch per summon type
- Shows skill level, description, resource cost, cooldown, damage, and next-level preview

### 5.3 Skill Acquisition
| Type | How to Get | Leveling |
|------|-----------|----------|
| **Active Skills** | Buy from Skill Vendor NPC at camp using gold | Upgrade with gold + requires min player level per tier |
| **Passive Skills** | Gain 1 passive point per level-up, spend at Trainer NPC | Each passive has max ranks, costs 1 point per rank |

### 5.4 Skill Level Requirements
Active skills have level gates for purchase/upgrade:

| Skill Tier | Min Player Level | Gold Cost (buy) | Gold Cost (upgrade) |
|------------|-----------------|-----------------|-------------------|
| Tier 1 | 1 | 50 | 75 |
| Tier 2 | 5 | 150 | 200 |
| Tier 3 | 10 | 400 | 500 |
| Tier 4 | 20 | 1000 | 1200 |
| Tier 5 (Ultimate) | 30 | 2500 | 3000 |

### 5.5 Skill Upgrade Scaling
Every active skill has **5 upgrade levels**. Each level improves the skill along predictable axes:

| Upgrade Level | Damage Increase | Cooldown Reduction | Cost Reduction | Bonus Effect |
|---------------|----------------|-------------------|---------------|--------------|
| Lv 1 (base) | 100% | 0% | 0% | — |
| Lv 2 | +20% | -5% | 0% | — |
| Lv 3 | +45% | -10% | -5% | Minor (e.g., +0.5s duration) |
| Lv 4 | +75% | -15% | -10% | Moderate (e.g., +1 target) |
| Lv 5 (max) | +110% | -20% | -15% | Major (e.g., stun, extra hit) |

Upgrade cost scales with both tier and upgrade level: `upgradeCost = tierBaseUpgradeCost * upgradeLevel`.
Example: Upgrading a Tier 2 skill from Lv2→3 costs 200 * 3 = 600g. Lv4→5 costs 200 * 5 = 1000g.
This ensures skill upgrades remain a meaningful gold sink at all stages of the game.

**Example — Fireball (Tier 1, Mage):**
| Level | Damage | Mana Cost | Cooldown | Bonus |
|-------|--------|-----------|----------|-------|
| 1 | 25 | 15 | 2.0s | — |
| 2 | 30 | 15 | 1.9s | — |
| 3 | 36 | 14 | 1.8s | +10% explosion radius |
| 4 | 44 | 14 | 1.7s | Hits +1 extra target |
| 5 | 53 | 13 | 1.6s | Leaves burning ground (2s) |

### 5.6 Starting Skills Per Class

**Warrior:**
| Skill | Type | Tier | Cost | Cooldown | Resource | Description |
|-------|------|------|------|----------|----------|-------------|
| Slash | Active | — | Free (default) | 0.7s | Generates +10 rage | Basic melee sweep. Hits in arc. |
| Shield Block | Active | 1 | 50g | 1.5s | 15 rage | Block incoming damage for 1s. |
| Shield Charge | Active | 2 | 150g | 4s | 25 rage | Dash forward, deal damage + knockback. |
| Whirlwind | Active | 3 | 400g | 8s | 40 rage | Spin AoE for 2s. |
| War Cry | Active | 3 | 400g | 12s | 30 rage | Buff: +20% damage for 5s. |
| Cleave | Active | 4 | 1000g | 6s | 35 rage | Wide-arc melee hitting all enemies in front. |
| Earthquake | Active | 5 | 2500g | 20s | 60 rage | Massive AoE stun + damage. |
| Toughness | Passive | — | Level-up | — | — | +2% damage reduction per rank (max 5) |
| Bloodlust | Passive | — | Level-up | — | — | +1% lifesteal per rank (max 5) |
| Fury | Passive | — | Level-up | — | — | +5% rage generation per rank (max 5) |
| Iron Skin | Passive | — | Level-up | — | — | +3% armor per rank (max 5) |
| Relentless | Passive | — | Level-up | — | — | +2% attack speed per rank (max 4) |
| Vitality | Passive | — | Level-up | — | — | +15 max HP per rank (max 5) |
| Berserker Blood | Passive | — | Level-up | — | — | +3% damage when below 40% HP per rank (max 3) |

**Mage:**
| Skill | Type | Tier | Cost | Cooldown | Resource | Description |
|-------|------|------|------|----------|----------|-------------|
| Wand Bolt | Active | — | Free (default) | 1.0s | 0 mana | Ranged magic projectile. |
| Fireball | Active | 1 | 50g | 2s | 15 mana | Exploding projectile. AoE. |
| Frost Nova | Active | 2 | 150g | 6s | 20 mana | AoE freeze around player. |
| Arcane Blink | Active | 2 | 150g | 5s | 15 mana | Teleport short distance. |
| Chain Lightning | Active | 3 | 400g | 5s | 25 mana | Bolt bounces between 3 enemies. |
| Meteor | Active | 4 | 1000g | 15s | 50 mana | Targeted AoE nuke. |
| Arcane Singularity | Active | 5 | 2500g | 25s | 70 mana | Black hole pulls + damages. |
| Arcane Potency | Passive | — | Level-up | — | — | +3% spell damage per rank (max 5) |
| Mana Flow | Passive | — | Level-up | — | — | +0.3 mana regen/s per rank (max 5) |
| Glass Cannon | Passive | — | Level-up | — | — | +5% damage, -2% max HP per rank (max 3) |
| Elemental Mastery | Passive | — | Level-up | — | — | +2% elemental effect duration per rank (max 5) |
| Spell Shield | Passive | — | Level-up | — | — | +3% magic damage reduction per rank (max 4) |
| Quick Cast | Passive | — | Level-up | — | — | -2% cooldown on all spells per rank (max 5) |
| Overcharge | Passive | — | Level-up | — | — | +4% crit damage per rank (max 3) |

**Archer:**
| Skill | Type | Tier | Cost | Cooldown | Resource | Description |
|-------|------|------|------|----------|----------|-------------|
| Shoot | Active | — | Free (default) | 0.5s | 0 stamina | Basic ranged arrow. |
| Multishot | Active | 1 | 50g | 2s | 15 stamina | Fire 3 arrows in a spread. |
| Evasive Roll | Active | 2 | 150g | 3s | 25 stamina | Dodge roll with i-frames. |
| Poison Arrow | Active | 2 | 150g | 4s | 20 stamina | DoT arrow. |
| Explosive Trap | Active | 3 | 400g | 8s | 30 stamina | Place a trap that detonates when enemies walk over it. |
| Rain of Arrows | Active | 4 | 1000g | 12s | 40 stamina | Targeted AoE barrage. |
| Phantom Archer | Active | 5 | 2500g | 20s | 60 stamina | Clone mirrors attacks for 5s. |
| Steady Aim | Passive | — | Level-up | — | — | +2% crit chance per rank (max 5) |
| Fleet Foot | Passive | — | Level-up | — | — | +3% movement speed per rank (max 5) |
| Piercing Shots | Passive | — | Level-up | — | — | +1 pierce per rank (max 3) |
| Nimble | Passive | — | Level-up | — | — | +2% dodge chance per rank (max 5) |
| Marksman | Passive | — | Level-up | — | — | +3% ranged damage per rank (max 4) |
| Stamina Reserve | Passive | — | Level-up | — | — | +10 max stamina per rank (max 3) |
| Lethal Tempo | Passive | — | Level-up | — | — | Kill grants +5% attack speed for 3s per rank (max 3) |

**Necromancer:**
| Skill | Type | Tier | Cost | Cooldown | Resource | Description |
|-------|------|------|------|----------|----------|-------------|
| Necrotic Bolt | Active | — | Free (default) | 1.0s | 0 mana | Dark magic projectile. |
| Bone Spear | Active | 1 | 50g | 1.5s | 15 mana | Piercing projectile, passes through enemies. |
| Summon Skeleton | Summon Toggle | 1 | 50g | 3s cd | 30 mana/summon | Auto-summon melee skeleton. Max 2 (+passive). |
| Summon Zombie | Summon Toggle | 2 | 150g | 5s cd | 40 mana/summon | Auto-summon tanky zombie. Max 1 (+passive). |
| Corpse Explosion | Active | 2 | 150g | 4s | 20 mana | Detonate nearby corpses for AoE. |
| Dark Pact | Active | 3 | 400g | 8s | 25 mana | Sacrifice a pet for massive AoE. |
| Curse of Weakness | Active | 4 | 1000g | 10s | 35 mana | AoE debuff: enemies take +25% damage for 4s. |
| Undead Army | Summon Toggle | 5 | 2500g | 30s cd | 80 mana/cast | Summon 5 skeletons + 3 zombies at once. |
| Soul Tether | Passive | — | Level-up | — | — | +5% pet HP per rank (max 5) |
| Dark Harvest | Passive | — | Level-up | — | — | +2% mana on kill per rank (max 5) |
| Army of the Dead | Passive | — | Level-up | — | — | +1 max pet count per rank (max 3) |
| Necrotic Aura | Passive | — | Level-up | — | — | Pets deal +3% damage per rank (max 5) |
| Life Tap | Passive | — | Level-up | — | — | +1% lifesteal from pet damage per rank (max 4) |
| Bone Barrier | Passive | — | Level-up | — | — | +2% damage reduction per active pet per rank (max 3) |
| Corpse Mastery | Passive | — | Level-up | — | — | Corpses last +2s longer, +10% corpse explosion damage per rank (max 3) |

**Passive Point Budget:**
- Each class has 7 passives with a combined max investment of ~30 points
- 50 levels = 50 passive points → player can max ~5 of 7 passives, forcing meaningful choices
- Respec at Trainer NPC for gold (cost = player level * 20g)

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

### 7.3 Floor Progression & Level Requirements

| Floor | Theme | Player Lvl Req | Enemy Lvl Range | Main Boss | Side Bosses |
|-------|-------|---------------|-----------------|-----------|-------------|
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

### 8.1 Potion Types
| Potion | Effect | Cooldown | Stack Size | Buy Price | Grid Size |
|--------|--------|----------|-----------|-----------|-----------|
| **HP Potion** | Restore 30% of max HP | 3s (shared) | 5 | See pricing table | 1x1 |
| **Mana Potion** | Restore 30% of max mana | 3s (shared) | 5 | See pricing table | 1x1 |
| **Stamina Tonic** | Instant full stamina refill | 5s (own cd) | 3 | See pricing table | 1x1 |
| **Rage Tonic** | Instantly gain 50 rage | 5s (own cd) | 3 | See pricing table | 1x1 |

**Potion pricing by player level bracket:**
| Player Level | HP/Mana Potion | Stamina/Rage Tonic |
|-------------|---------------|-------------------|
| 1–10 | 10g | 15g |
| 11–20 | 25g | 35g |
| 21–35 | 50g | 65g |
| 36–50 | 80g | 100g |

### 8.2 Potion Rules
- **Shared cooldown**: HP and Mana potions share a 3-second cooldown (can't chug both instantly).
- **Class-appropriate potions**: Mana potions only usable by Mage/Necro. Stamina Tonics only by Archer. Rage Tonics only by Warrior.
- **Hotbar**: Slots 1–4 for quick-use consumables.
- **Sources**: Buy from Item Vendor, drop from enemies (low chance), found in treasure chests.
- Potions occupy inventory grid space (1x1 each, stacks shown as count overlay).

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
- **Spent on**: Active skills, skill upgrades, attribute/passive respec, vendor items, potions
- **Death penalty**: Lose 10% on death

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

### 10.3 Skill Vendor (Camp NPC — Trainer)
- Shows all class skills available at your level
- Locked skills shown grayed out with level requirement
- Buy new active skills with gold
- Upgrade existing skills with gold (requires min player level per tier)
- Spend passive skill points on passives (no gold cost for passives)
- Reset passive points for gold (cost = player level * 20g)
- Reset attribute points for gold (cost = player level * 15g)

---

## 11. CAMP (HUB)

### 11.1 NPCs
| NPC | Function | Icon |
|-----|----------|------|
| **Trainer / Skill Vendor** | Buy/upgrade active skills, spend passive points, respec attributes/passives | ⚔ |
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
- **Skill Book** (K): Active skills, passive ranks, summon toggles (Necro), current LMB/RMB loadout.
- **Skill Vendor**: Buy/upgrade actives, spend passive points, respec.
- **Item Vendor**: Buy/sell split view, bulk sell junk.
- **Waystone Travel**: Floor list with states (Cleared/In Progress/Discovered/Locked).
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
    "activeSkills": { "leftClick": "slash", "rightClick": "shield_charge" },
    "learnedSkills": { "slash": 3, "shield_charge": 2, "whirlwind": 1 },
    "passiveSkills": { "toughness": 3, "bloodlust": 2 },
    "passivePointsAvailable": 1,
    "summonToggles": {}
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

### Phase 2 — Skill System
4. **Skill Data**: Define all skills per class in JSON (active + passive + summon toggles)
5. **Two-Slot Action Bar**: Left/right click skill assignment, basic attack fallback, skill execution with resource costs and cooldowns
6. **Skill Book UI**: View learned skills, assign to slots, toggle summons
7. **Skill Vendor NPC**: Buy/upgrade actives, spend passive points, respec (attributes + passives)
8. **Skill Upgrade Scaling**: Per-level damage/cooldown/cost/bonus progression

### Phase 3 — Items & Inventory
9. **Item Data Model**: Item generation with rarity, affixes, iLvl, grid size, class restrictions
10. **Grid Inventory UI**: Drag-and-drop, tooltips, comparison, junk marking
11. **Equipment System**: 6 slots, stat bonuses applied to player, class restriction checks
12. **Loot Drops**: World item objects, proximity auto-pickup, gold auto-pickup, drop tables
13. **Potion System**: HP/Mana/Stamina/Rage potions, hotbar slots 1–4, shared cooldowns
14. **Item Vendor NPC**: Buy/sell, junk bulk-sell, rotating stock, potion sales

### Phase 4 — Dungeon Restructure
15. **Single Dungeon, 10 Floors**: Replace multi-dungeon with one deep dungeon, themed floors
16. **Floor Level Requirements**: Gate access by player level, show lock on waystone UI
17. **Side Boss Rooms**: Optional boss encounters off critical path with better loot
18. **Waystone System**: Per-floor fast travel, camp return, progress save
19. **Death & Respawn**: Gold penalty, camp respawn, preserved floor state, lost ground items
20. **Boss Chests**: Loot containers after boss defeat with rarity bonuses
21. **Enemy Scaling**: Apply per-level HP/damage/speed formulas from section 7.4
22. **Dungeon Traps**: 6 trap types, visibility scaling, trigger/activation, placement rules per section 7.7

### Phase 5 — Polish & Balance
22. **XP Tuning**: Verify XP curve feels right across all 10 floors, adjust enemy XP values
23. **Gold Economy**: Verify gold income vs skill/item costs, adjust vendor prices
24. **Item Balance**: Verify affix ranges don't create OP combinations at any iLvl
25. **UI Polish**: Smooth transitions, loot pickup effects, inventory sounds, minimap fog
26. **Audio**: New SFX for skill cast, loot drop/pickup, potion use, level up, vendor interaction

---

## 15. DATA FILE CHANGES NEEDED

| File | Changes |
|------|---------|
| `classes.json` | Add resource type, base resource stats, base attributes, starting skill IDs |
| `skillTrees.json` | **Replace entirely** with `skills.json` (active + passive + summon per class, with upgrade scaling) |
| `levels.json` | **Replace** with `floors.json` (10 floors, level reqs, enemy level ranges, boss defs, theme) |
| `camp.json` | Rename Trainer → Skill Vendor, add interaction types per NPC |
| **NEW** `items.json` | Item base types, affix pools, rarity weights, class restrictions, grid sizes |
| **NEW** `lootTables.json` | Per-floor drop tables, boss chest tables, treasure chest tables |
| **NEW** `potions.json` | Potion definitions (type, effect, cooldown, stack size, price) |

---

## 16. KEY TECHNICAL DECISIONS

1. **Item generation is server-less** — all RNG is client-side with seeded generators for reproducibility.
2. **Inventory uses a 2D grid array** — each cell stores null or a reference to the item occupying it. Items store their top-left grid position.
3. **Skills are data-driven** — all skill effects defined in JSON with per-level scaling tables. `game.js` reads and applies them generically where possible.
4. **Dungeon floors are regenerated on entry** unless floor state is saved (rooms cleared, etc.). Seed = floor number + character class for consistency.
5. **Equipment stats are computed** — base class stats + attribute bonuses + passive bonuses + all equipped item stats = final stats. Recalculated on any equip/unequip/level/respec event.
6. **Necromancer summons are autonomous** — pet AI runs independently, summoning is automatic based on toggle state and mana availability. No action bar slot consumed.
7. **Item level = enemy level** (not floor number) — provides 50 granular iLvl tiers instead of 10.
8. **Single death penalty** — gold loss only. No XP loss. Keeps progression feeling forward-moving while still punishing carelessness.

---

*This document is the source of truth for the dungeon crawler ARPG redesign. Update it as decisions evolve.*
