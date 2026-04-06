# Dungeon Crawler — Gap Analysis & Implementation Plan

> Gap analysis between the current codebase and the target design (DESIGN_BRIEF.md + WIREFRAMES.md).
> Organized as a multi-stage plan with dependencies, effort estimates, and file-level changes.

---

## 1. GAP ANALYSIS SUMMARY

### What Already Exists (Can Reuse/Adapt)

| System | Current State | Reuse Level |
|--------|--------------|-------------|
| **4 Classes** | Warrior, Mage, Archer, Necromancer fully implemented | High — keep class identities |
| **Resource System** | Rage/Mana/Stamina/Soul Mana with per-class configs in `resources.json` | Medium — formulas need updating to match DESIGN_BRIEF 4.6-4.8 |
| **Skill Definitions** | `skills.json` has 10 skills per class with 5 ranks each | High — rename/remap to DESIGN_BRIEF skills, data format is compatible |
| **Skill Trees** | `skillTrees.json` has 3 branches × 5 tiers per class | Replace — old tree structure replaced by flat passive list + active buy system |
| **Item Base Types** | `itemBases.json` has weapons (9 types), armor (8 types), jewelry (2), junk (4) | Medium — needs slot mapping update (6 slots vs current 7+) |
| **Affix System** | `affixes.json` has 12 affix types with ranges and slot restrictions | Medium — expand/adjust ranges to match DESIGN_BRIEF 6.3 prefix/suffix model |
| **Enemy Types** | 9 enemy types with stats, behaviors, special attacks | High — keep, adjust base stats to DESIGN_BRIEF 7.4 formulas |
| **Boss Types** | 7 bosses with abilities, phase 2 system | High — keep, add missing bosses (Bone Colossus, Crimson General) |
| **Dungeon Generator** | 7×5 grid, room types, corridors, doors, fog of war | High — core algorithm reusable, need trap placement + side boss rooms |
| **Dungeon Room Manager** | Room state tracking, enemy spawning, door locking | High — extend with trap spawning |
| **Collision System** | Spatial grid (64px), circle/AABB collision, raycasting | High — reuse as-is |
| **Particle System** | Generic emit, death burst, confetti, ring effects | High — reuse, add trap/status effects |
| **Damage Numbers** | Yellow/red floating text with crit scaling | High — reuse, add dodge/status text |
| **Audio System** | Procedural Web Audio synthesis | High — reuse, add new sounds |
| **Renderer** | Camera follow, tile grid, fog of war, entity rendering, minimap | Medium — needs globe HUD, trap rendering, status icons |
| **Camp System** | NPC proximity, layout, 3 NPCs | Medium — add Skill Vendor behavior, keep Vendor + Waystone |
| **Persistence** | LocalStorage per-class save/load | Medium — expand save schema (attributes, equipment, inventory grid, floor states) |
| **Class Picker** | 4-card selection with stat bars | Medium — update cards with resource info |
| **Input System** | WASD + mouse + touch joystick | Medium — add hotkeys (I/K/C/1-4/Tab/Alt), rework touch |

### What Needs Major Rework

| System | Current → Target | Effort |
|--------|-----------------|--------|
| **Progression (XP/Leveling)** | `xpToNext = 50 * 1.3^level` → `100 * level^1.5`. Level-up gives skill point → gives attribute point + passive point | Medium |
| **Skill System** | Blessings + skill tree branches → 2-slot action bar + active skills bought with gold + flat passive list | Large |
| **Combat (Damage)** | `baseDmg * (isCrit ? 2 : 1)` → armor DR formula + dodge + crit 1.5x + status effects | Medium |
| **HUD** | HP/XP/Resource bars (rectangles) → Diablo 2 globes + action bar + potion hotbar + skill slots | Large |
| **Dungeon Structure** | 12 separate levels with world map → single 10-floor mega-dungeon with waystone per floor | Medium |

### What Needs to Be Built From Scratch

| System | Description | Effort |
|--------|------------|--------|
| **Attribute System** | STR/INT/AGI/STA with point allocation, stat derivation, respec | Medium |
| **Grid Inventory UI** | 10×6 Diablo-style grid with drag-and-drop, variable item sizes | Large |
| **Equipment Doll** | 6-slot character panel with equip/unequip, stat recalculation | Medium |
| **Item Generation** | Random item creation with rarity rolls, affix selection, iLvl scaling | Medium |
| **Loot Drop System** | World item objects with rarity glow, proximity auto-pickup, ground labels | Medium |
| **Item Tooltips** | Rich tooltips with comparison, affix display, rarity coloring | Medium |
| **Potion Hotbar** | 4-slot consumable bar with cooldown overlays, inventory linking | Small |
| **Skill Book UI** | Active skill cards, passive display, LMB/RMB assignment, summon toggles | Medium |
| **Skill Vendor UI** | Buy/upgrade actives, passive investment, respec buttons | Medium |
| **Item Vendor UI** | Buy/sell split view, rotating stock, bulk junk sell | Medium |
| **Trap System** | 6 trap types, placement in generation, visibility scaling, trigger/effects | Medium |
| **Status Effect System** | Frozen/Slowed/Burning/Poisoned/Weakened/Bleeding with HUD icons | Medium |
| **Death Screen** | Gold penalty, stats display, return to camp | Small |
| **Waystone Travel UI** | 10-floor list with states, replace old world map | Small |
| **Globe Rendering** | Circular HP/resource globes with fill animation | Medium |
| **Quick Skill Picker** | Flyout icon grid above action bar slots | Small |
| **Character Panel (C)** | Attribute allocation UI with stat preview | Medium |
| **Full Map Overlay** | Tab-key full-screen room map with fog/legend | Small |

---

## 2. IMPLEMENTATION STAGES

### Stage 0 — Foundation & Data Migration
> Rip out old systems that conflict, establish new data schemas.
> No gameplay changes yet — the game should still run (possibly broken) after this stage.

**0.1 — New Data Files**
Create new JSON configs matching DESIGN_BRIEF:

| File | Action | Based On |
|------|--------|----------|
| `src/data/skills.json` | **Rewrite** — restructure from 10-skills-per-class to DESIGN_BRIEF 5.6 format (active + passive + summon toggle, with tier/cost/upgrade scaling) | Existing `skills.json` has good rank data to mine |
| `src/data/classes.json` | **Update** — add `resourceType`, `baseAttributes` (str/int/agi/sta starting values), `primaryAttribute`, remove old unique ability configs | Keep base stats |
| `src/data/floors.json` | **New** — 10 floors matching DESIGN_BRIEF 7.3 (theme, levelReq, enemyRange, boss, sideBosses, trapDensity) | Replace `levels.json` |
| `src/data/items.json` | **Rewrite** — merge `itemBases.json` + add grid sizes, slot mapping (6 slots), class restrictions per DESIGN_BRIEF 6.1-6.4 | Existing bases are close |
| `src/data/affixes.json` | **Update** — restructure into prefix/suffix pools with iLvl scaling per DESIGN_BRIEF 6.3 | Existing 12 affixes are a starting point |
| `src/data/lootTables.json` | **New** — per-floor drop rates, boss chest tables per DESIGN_BRIEF 6.6 | |
| `src/data/traps.json` | **New** — 6 trap types with damage/status/radius/floorAppears per DESIGN_BRIEF 7.7 | |
| `src/data/potions.json` | **New** — 4 potion types with effect/cooldown/stackSize per DESIGN_BRIEF 8.1 | |
| `src/data/camp.json` | **Update** — add Skill Vendor NPC (split from Trainer), update interaction types | |
| `src/data/resources.json` | **Update** — adjust formulas to match DESIGN_BRIEF 4.6-4.8 (rage starts at 30, stamina scales with AGI, etc.) | |

**0.2 — Remove Obsolete Systems**
- Remove blessing system (blessingPicker UI, blessing entity, blessing selection logic in game.js)
- Remove world map UI (`worldMap.js` — replaced by waystone travel)
- Remove old skill tree UI (`skillTreeUI.js` — will be rewritten)
- Remove old shop UI (`shopUI.js` — will be rewritten)
- Remove level clear screen stars (replaced by simple floor clear)
- Remove combo/score system (not in ARPG design)
- Remove wave countdown timer (not in room-based dungeon)
- Keep: wave.js as room-combat shim (enemies spawn per room)

**0.3 — Player Data Model Refactor** (`player.js`)
- Add `attributes: { str, int, agi, sta }` with `attributePointsAvailable`
- Add `learnedSkills: {}` (id → level), `passiveSkills: {}` (id → rank)
- Add `activeSkills: { leftClick, rightClick }` (skill IDs)
- Add `passivePointsAvailable`
- Add `equipment: { mainHand, offHand, chest, legs, belt, boots }`
- Add `inventory: { grid[][], items{} }`
- Remove: `blessings[]`, `skillTree{}`, `skillPoints`
- Keep: core movement, collision, radius, position

**Files touched:** ~15 files
**Estimated effort:** 2-3 sessions

---

### Stage 1 — Core Combat & Attributes
> Player can fight with the new stat system. No UI polish yet — console/debug numbers are fine.

**1.1 — Attribute System** (`player.js`)
- Implement `recalcStats()` that computes all derived stats from:
  - Base class stats
  - Attribute bonuses (STR→armor/melee, INT→spell/mana, AGI→dodge/crit/speed, STA→HP/regen)
  - Passive skill bonuses
  - Equipment stat bonuses
- Call `recalcStats()` on: level up, equip/unequip, passive invest, respec
- Wire attribute formulas from DESIGN_BRIEF 3.1-3.2

**1.2 — Combat Formulas** (`game.js`)
- **Armor**: `damageReduction = armor / (armor + 50 + attackerLevel * 5)` (DESIGN_BRIEF 4.2)
- **Dodge**: Roll against `dodgeChance` (cap 30%), show "DODGE" text (DESIGN_BRIEF 4.3)
- **Crit**: Base 2% + AGI * 0.2%, multiplier 1.5x (down from current 2x) (DESIGN_BRIEF 4.4)
- **Damage pipeline**: `raw → armor DR → flat DR → final`
- **Environmental damage** (pits, hazards, traps): bypasses dodge, ignores armor

**1.3 — Status Effect System** (new: `src/systems/statusEffects.js`)
- `StatusEffectManager` class tracking active effects on player
- Each effect: type, source, duration, tickDamage, statModifiers
- Per-frame update: tick damage, decrement duration, apply/remove modifiers
- STA resistance: `duration *= max(0.2, 1 - sta * 0.01)`
- Effects: Frozen, Slowed, Burning, Poisoned, Weakened, Bleeding (DESIGN_BRIEF 4.5)
- Visual: status icons rendered near HP globe (added in Stage 4)

**1.4 — Resource System Update** (`player.js`)
- Warrior Rage: start 30 on floor, Slash generates +10, +5 on skill hit, +3 on take hit, decay -2/s after 4s
- Mage/Necro Mana: `80 + INT * 2` pool, `1.5 + INT * 0.05` regen
- Archer Stamina: `80 + AGI * 1.5` pool, `5 + AGI * 0.15` regen
- Integrate with attribute recalc

**1.5 — XP Curve Update** (`player.js`)
- Change from `50 * 1.3^level` to `Math.floor(100 * level^1.5)`
- Enemy XP: `baseXP * enemyLevel * levelDiffMultiplier` (DESIGN_BRIEF 3.5)
- Level-up grants: +1 attribute point, +1 passive point (not skill point)

**Files touched:** `player.js`, `game.js`, new `statusEffects.js`
**Estimated effort:** 2-3 sessions

---

### Stage 2 — Skill System
> Player can buy, equip, and use skills via the 2-slot action bar.

**2.1 — Skill Engine** (refactor `game.js` combat section)
- Load skill data from new `skills.json`
- Each skill: `{ id, type, tier, class, baseDamage, cooldown, resourceCost, upgradeScaling[], maxLevel }`
- Skill execution: check resource → deduct → apply cooldown → trigger effect
- Basic Attack: always available, no resource cost, class-appropriate behavior
- LMB = continuous fire (hold), RMB = single fire (press) — keep existing input model
- Skill cooldown tracking per skill ID (not per slot)

**2.2 — Necromancer Summon Toggles** (`player.js`, `game.js`)
- Summon skills are NOT action bar skills — they're auto-cast toggles
- When toggle ON + below max count + off cooldown + enough mana → auto-summon
- Deduct mana per summon
- Track toggle state in `summonToggles: { summon_skeleton: true, summon_zombie: false }`
- Existing minion system can be extended (current `minion.js` handles chase/damage/lifetime)

**2.3 — Skill Book UI** (new: `src/ui/skillBookUI.js`)
- HTML overlay panel (per WIREFRAMES section 6)
- Active skills: card grid showing learned skills with icon/level/cost/cooldown
- Click skill → click LMB/RMB slot to assign (or drag)
- Passive skills: read-only dot display (current ranks)
- Summon toggles: ON/OFF switches (Necro only)
- Current loadout: LMB + RMB slot display
- Skill detail panel on hover/select

**2.4 — Skill Vendor UI** (new: `src/ui/skillVendorUI.js`)
- HTML overlay panel (per WIREFRAMES section 7)
- Active skills for sale: list with OWNED/NOT OWNED/LOCKED/MAX states
- Buy button with gold cost, upgrade button with scaling cost (`tierBase * upgradeLevel`)
- Passive skills: [+] buttons to invest points (ONLY here, not in Skill Book)
- Respec buttons: passive respec (level * 20g), attribute respec (level * 15g)

**2.5 — Quick Skill Picker** (new: `src/ui/quickSkillPicker.js`)
- Small icon-grid flyout above LMB/RMB slots on the action bar
- Shows all learned active skills as icons
- Hover → tooltip with name + cost
- Click → assign to that slot, close flyout
- Canvas-rendered (part of HUD layer)

**Files touched:** `game.js` (combat refactor), `player.js`, new UI files × 3
**Estimated effort:** 3-4 sessions

---

### Stage 3 — Items, Inventory & Equipment
> Player can find, pick up, equip, and sell items with the full Diablo-style system.

**3.1 — Item Generator** (new: `src/systems/itemGenerator.js`)
- `generateItem(iLvl, minRarity, rarityBonus)` → returns item object
- Rarity roll: weighted random (DESIGN_BRIEF 6.2 drop weights + bonus)
- Base type selection: random from slot-appropriate pool, class-filtered
- Affix rolling: prefix/suffix selection based on rarity rules (DESIGN_BRIEF 6.3)
- Affix value scaling: `min + (max - min) * (iLvl / 50)` with ±15% variance
- Legendary unique effects: predefined list, selected on legendary roll
- Junk generation: pick random junk type, no stats
- Output: `{ id, baseType, slot, rarity, iLvl, baseStat, affixes[], gridW, gridH, classRestrictions[], sellValue }`

**3.2 — Grid Inventory System** (new: `src/systems/inventory.js`)
- 10×6 2D grid array
- `canPlace(item, gridX, gridY)` → check all cells for item's width×height
- `placeItem(item, gridX, gridY)` → fill cells with item reference
- `removeItem(itemId)` → clear cells
- `autoPlace(item)` → find first fit (top-left scan)
- `getItemAt(gridX, gridY)` → return item
- Potion stacking: same type potions stack in same cell (count overlay)
- Hotbar linking: 4 slots referencing inventory potion stacks

**3.3 — Equipment System** (extend `player.js`)
- 6 slots: mainHand, offHand, chest, legs, belt, boots
- `equip(item, slot)` → validate class restriction + level req → place in slot → `recalcStats()`
- `unequip(slot)` → return item to inventory → `recalcStats()`
- Equipment stat aggregation in `recalcStats()`: sum all equipped item base stats + affix bonuses

**3.4 — Loot Drop System** (new: `src/systems/lootDrop.js`)
- On enemy death: roll drop chance (DESIGN_BRIEF 6.6) → generate item → spawn world object
- `WorldItem` class: position, item data, rarity glow color, name label, pickup radius
- Proximity auto-pickup: player within 32px → `inventory.autoPlace(item)` → pickup animation
- Gold auto-pickup: player within 48px → add to gold counter
- "Inventory Full" detection → show warning text
- Boss chests: interactable object (E key), generates 2 items with rarity bonus
- Alt-key label rendering: show all ground item labels

**3.5 — Grid Inventory UI** (new: `src/ui/inventoryUI.js`)
- HTML overlay panel with two sections (per WIREFRAMES section 4):
  - Left: equipment doll (6 slot frames arranged around silhouette)
  - Right: 10×6 grid rendered as HTML table/div grid
- Item rendering: colored rectangles with rarity border, small icon, stack count
- Drag-and-drop: left-click picks up, left-click places, right-click drops to ground
- Context menu: right-click → Equip / Use / Drop / Mark as Junk
- Shift-click: quick-equip or quick-use
- Stat summary below equipment doll (class, level, attributes, computed stats)
- Junk value / Sell Junk button (context-dependent)

**3.6 — Item Tooltips** (new: `src/ui/itemTooltip.js`)
- HTML tooltip following cursor
- Shows: name (rarity color), type, iLvl, base stats, affixes (prefix/suffix names), level req, class restrictions, sell value
- Comparison section: if item is equippable, show equipped item stats + green/red delta arrows
- "Cannot Equip" in red if class or level restricted
- Appears on hover over: inventory items, equipped items, vendor items, ground items

**3.7 — Item Vendor UI** (new: `src/ui/itemVendorUI.js`)
- HTML overlay panel (per WIREFRAMES section 8)
- Left: vendor stock (scrollable list with item preview + price)
- Right: player inventory grid (same as inventoryUI grid)
- Left-click vendor item → buy (confirmation for > 100g)
- Right-click inventory item → sell instantly
- Sell Junk button → bulk sell all gray items
- Vendor stock generation: `generateItem(playerLevel, "common", 0)` for 6-8 items + potions
- Stock refreshes on return from dungeon

**3.8 — Potion System** (extend `game.js`, `player.js`)
- 4 potion types per DESIGN_BRIEF 8.1
- Hotbar slots 1-4: press key → check cooldown → consume from linked stack → apply effect
- Shared cooldown (HP + Mana: 3s), own cooldown (Stamina/Rage tonics: 5s)
- Class restrictions: Mana only for Mage/Necro, etc.
- Pricing by level bracket (DESIGN_BRIEF 8.1)

**Files touched:** 5+ new files, `player.js`, `game.js`, `renderer.js`
**Estimated effort:** 5-6 sessions (largest stage)

---

### Stage 4 — HUD Overhaul
> Replace the bar-based HUD with the Diablo 2 globe system and full action bar.

**4.1 — Globe Rendering** (refactor `src/ui/hud.js`)
- Replace rectangular HP bar with circular globe (canvas-rendered)
  - Circle clipping mask, filled from bottom proportional to HP%
  - Red gradient (#8b0000 → #cc0000)
  - Flash white on damage, pulse red glow at < 25% HP
- Resource globe (mirrored right side)
  - Orange-red for Rage, blue for Mana, green-yellow for Stamina
  - Rage: fills UP on attack (visually satisfying)
- Approximately 80px diameter, anchored to bottom corners

**4.2 — Bottom Action Bar** (refactor `src/ui/hud.js`)
- Dark semi-transparent bar spanning bottom of screen
- Left: HP globe
- Center-left: 4 potion hotbar slots (36px each) with radial cooldown wipe
- Center-right: 2 skill slots (48px each) with icon + cooldown + resource cost text
- Right: Resource globe
- Below: thin XP bar (full width, 12px, purple-blue gradient)
- Hotkey labels: [C] [K] [I] centered between potions and skills

**4.3 — Skill Slot Rendering** (extend `src/ui/hud.js`)
- Show skill icon in slot
- Radial clock-wipe overlay during cooldown (dark semi-transparent)
- Grayed icon when on cooldown
- Red pulse on border when attempting to use without enough resource
- Swap arrow above each slot (clickable → opens Quick Skill Picker)

**4.4 — Status Effect Icons** (extend `src/ui/hud.js`)
- Small colored squares next to HP globe
- Each: status color + remaining duration text
- Pulse when < 1s remaining
- Colors: Green=Poison, Orange=Burning, Red=Bleeding, Blue=Slowed/Frozen, Purple=Weakened

**4.5 — Info Area** (refactor `src/ui/hud.js`)
- Top-right: Floor number, Player level, Gold count (semi-transparent dark bg)
- Top-center: Boss HP bar (conditional, 40% width, red fill, name + HP text)
- Top-left: Minimap (keep existing, update room-state colors)

**4.6 — Character Panel** (new: `src/ui/characterUI.js`)
- HTML overlay panel (per WIREFRAMES section 5)
- Attribute display with [+] buttons (visible when points available)
- Hover [+] → highlight affected stats in yellow
- Offensive stats block, Defensive stats block, Movement block
- Reset button with gold cost (only active at camp)

**4.7 — Notification System** (new: `src/systems/notifications.js`)
- Center-screen announcements: LEVEL UP, BOSS DEFEATED, FLOOR X (per WIREFRAMES 14)
- Queue system: display 2s, fade 0.5s, sequential if multiple
- Resource warnings: "Not enough mana" near action bar, "Inventory Full" center-bottom
- Low HP: red vignette on screen edges, heartbeat audio

**Files touched:** `hud.js` (major rewrite), new `characterUI.js`, new `notifications.js`
**Estimated effort:** 3-4 sessions

---

### Stage 5 — Dungeon Restructure
> Replace the multi-level world map with a single 10-floor dungeon entered from camp.

**5.1 — Floor Data** (replace `levels.json` usage)
- Load `floors.json` (10 floors with theme/levelReq/enemyRange/boss/sideBosses/trapDensity)
- Each floor: one procedural dungeon generation (existing generator)
- Floor-specific theme colors for renderer
- Enemy level = random within floor's enemy level range

**5.2 — Side Boss Rooms** (extend `dungeonGenerator.js`)
- Add room type `side_boss` generated as branch rooms off the critical path
- Side boss count per floor from `floors.json`
- Side boss room: guaranteed Uncommon+ loot, better chest
- Side boss is a boss entity (existing boss.js) but NOT required to proceed

**5.3 — Trap Placement** (extend `dungeonGenerator.js`, new: `src/systems/traps.js`)
- During room generation: place traps based on floor's trap density + room type multiplier
- Trap types filtered by `floorAppears` (DESIGN_BRIEF 7.7)
- Placement rules: 48px spacing, 96px from doors, not on obstacles
- Corridors: only Poison or Slow traps
- `Trap` class: position, type, triggerRadius (32px), activated flag
- Per-frame: check player distance, if < 32px and !activated → trigger
- Trigger: activation animation (0.3s) → apply damage + status → remove trap
- Visibility: opacity scales with distance (30% at 200px → 100% at 80px)

**5.4 — Trap Rendering** (extend `renderer.js`)
- Per-trap-type visual (colored particles, glow, sigils — per WIREFRAMES section 13)
- Distance-based opacity scaling
- Activation animation (type-specific: gas cloud, flame burst, spikes, explosion, frost, dark energy)

**5.5 — Waystone System** (refactor `waystoneUI.js`)
- Replace world map with simple floor list (per WIREFRAMES section 9)
- States: CLEARED, IN PROGRESS, DISCOVERED, LOCKED
- Floor state persisted in save data
- Travel: click floor → fade-to-black → load floor (or camp)
- "Return to Camp" prominent button

**5.6 — Death & Respawn** (extend `game.js`)
- On player death: show death screen (WIREFRAMES section 11)
- Calculate gold penalty (10% of carried)
- Preserve floor state (roomsCleared, bossesDefeated, chestsOpened)
- Ground items lost (clear worldItems array)
- "Return to Camp" button → load camp, apply penalty

**5.7 — Floor Progression** (`game.js`)
- Stairs spawn after main boss defeated → interact (E) → generate next floor
- Level requirement check at waystone: if player level < floor requirement, show lock
- Auto-discover waystone on first entering a floor

**5.8 — Enemy Level Scaling** (extend `enemy.js`, `boss.js`)
- Each enemy gets an `enemyLevel` from floor's range
- Apply DESIGN_BRIEF 7.4 formulas: HP = base * (1 + 0.12 * (level-1)), etc.
- Boss: 5x HP, 2x damage multiplied by same scaling
- XP reward: baseXP * enemyLevel * levelDiffMultiplier

**Files touched:** `dungeonGenerator.js`, `waystoneUI.js`, `game.js`, `enemy.js`, `boss.js`, `renderer.js`, new `traps.js`
**Estimated effort:** 3-4 sessions

---

### Stage 6 — Camp & Vendor Integration
> Camp feels like a complete hub with all NPCs functional.

**6.1 — Camp NPC Rework** (extend `camp.js`, `npc.js`)
- Trainer/Skill Vendor: proximity + E → open Skill Vendor UI (from Stage 2)
- Item Vendor: proximity + E → open Item Vendor UI (from Stage 3)
- Waystone: proximity + E → open Waystone Travel UI (from Stage 5)
- Campfire: proximity → auto-heal HP + resource to full (sparkle effect)

**6.2 — Camp HUD** (extend `hud.js`)
- Simplified: no globes, no skill slots, no potion bar, no minimap
- Show: Level, Gold, HP/Resource as text, hotkey hints [C] [K] [I]
- NPC interaction prompts: "Press E to talk" when in range

**6.3 — Title Screen** (new: `src/ui/titleScreen.js`)
- "DUNGEON CRAWLER" title with ambient particles
- [NEW GAME] → Class Picker
- [CONTINUE] → Load save → Camp (only if save exists)

**6.4 — Persistence Overhaul** (rewrite `persistence.js`)
- New save schema matching DESIGN_BRIEF 13.1
- Save triggers: after entering camp, after floor clear, after boss defeat
- Load: reconstruct full player state (attributes, skills, equipment, inventory, floor progress)
- Migration: detect old save format → offer fresh start (old format too different to migrate)

**Files touched:** `camp.js`, `npc.js`, `hud.js`, `persistence.js`, new `titleScreen.js`
**Estimated effort:** 2 sessions

---

### Stage 7 — Polish, Balance & Audio
> Everything works — now make it feel good.

**7.1 — UI Animations**
- Globe fill: smooth lerp on damage/heal (not instant)
- Panel open: slide-in from bottom (150ms ease-out)
- Panel close: fade-out (100ms)
- Skill swap: gold flash + slide animation (200ms)
- Loot pickup: item flies to inventory corner
- Gold pickup: "+5g" float text
- XP bar: smooth fill, flash + burst on level up
- Boss HP: smooth drain, color shift at 50% (orange for phase 2)

**7.2 — Audio Additions** (extend `audio.js`)
- `skillCast()`: Per-skill-type tone (melee = low, spell = high, arrow = mid)
- `potionUse()`: Bubble/gulp sound
- `itemPickup()`: Soft chime
- `goldPickup()`: Coin clink
- `trapTrigger()`: Per-type (hiss for poison, whoosh for fire, clang for spikes, boom for explosive)
- `vendorBuy()`: Register ding
- `statusApplied()`: Low tone + type-specific overlay
- `doorUnlock()`: Heavy thud
- `waystoneTravel()`: Ethereal hum

**7.3 — Number Tuning**
Playtest and adjust:
- XP curve: does player hit level gates naturally? (Lvl 3 by floor 2 clear, Lvl 10 by floor 4, etc.)
- Gold economy: can player afford Tier 1 skill after floor 1? Potions affordable without hoarding?
- Damage balance: does floor 1 feel dangerous but fair? Does floor 10 require good gear?
- Trap damage: annoying but not lethal? Spike trap shouldn't one-shot at any floor.
- Boss HP: 2-3 minute fight at appropriate level? Not a 30-second pushover or 10-minute slog?
- Affix ranges: does an Epic iLvl 50 weapon feel meaningfully better than a Common iLvl 50?

**7.4 — Visual Polish**
- Rarity glow on ground items (pulsing particle ring)
- Trap shimmer at screen edge
- Low HP vignette (red edges)
- Screen shake on trap explosions and boss abilities
- Death animation: player circle shrinks + particles

**Files touched:** Many small touches across all files
**Estimated effort:** 2-3 sessions (ongoing)

---

## 3. DEPENDENCY GRAPH

```
Stage 0 (Foundation)
  │
  ├── Stage 1 (Combat & Attributes) ─── requires Stage 0
  │     │
  │     ├── Stage 2 (Skills) ─── requires Stage 1 (stat formulas, resource system)
  │     │     │
  │     │     └── Stage 4 (HUD) ─── requires Stage 2 (skill slots to render)
  │     │
  │     └── Stage 3 (Items & Inventory) ─── requires Stage 1 (equipment affects stats)
  │           │
  │           └── Stage 4 (HUD) ─── requires Stage 3 (potion hotbar, item tooltips)
  │
  └── Stage 5 (Dungeon Restructure) ─── requires Stage 0 (new floor data)
        │                                 benefits from Stage 1 (enemy scaling)
        │                                 benefits from Stage 3 (loot drops)
        │
        └── Stage 6 (Camp & Vendors) ─── requires Stage 2 + 3 + 5
              │
              └── Stage 7 (Polish) ─── requires all above
```

**Critical path:** 0 → 1 → 2 → 4 (playable with skills + HUD)
**Parallel path:** 0 → 5 (dungeon restructure can happen alongside Stage 1)
**Longest chain:** 0 → 1 → 3 → 4 → 6 → 7

---

## 4. STAGE-BY-STAGE FILE IMPACT MAP

### New Files to Create
| File | Stage | Purpose |
|------|-------|---------|
| `src/systems/statusEffects.js` | 1 | Status effect manager |
| `src/systems/itemGenerator.js` | 3 | Random item creation |
| `src/systems/inventory.js` | 3 | Grid inventory logic |
| `src/systems/lootDrop.js` | 3 | World item spawning + pickup |
| `src/systems/traps.js` | 5 | Trap placement + trigger logic |
| `src/systems/notifications.js` | 4 | Center-screen announcements |
| `src/ui/skillBookUI.js` | 2 | Skill book panel |
| `src/ui/skillVendorUI.js` | 2 | Skill vendor panel |
| `src/ui/quickSkillPicker.js` | 2 | Action bar skill swap flyout |
| `src/ui/inventoryUI.js` | 3 | Inventory + equipment panel |
| `src/ui/itemTooltip.js` | 3 | Rich item tooltips |
| `src/ui/itemVendorUI.js` | 3 | Item shop panel |
| `src/ui/characterUI.js` | 4 | Character/attribute panel |
| `src/ui/titleScreen.js` | 6 | Title screen |
| `src/ui/deathScreen.js` | 5 | Death overlay |
| `src/data/floors.json` | 0 | 10-floor definitions |
| `src/data/traps.json` | 0 | Trap type definitions |
| `src/data/lootTables.json` | 0 | Drop rate tables |
| `src/data/potions.json` | 0 | Potion definitions |

### Files to Heavily Modify
| File | Stages | What Changes |
|------|--------|-------------|
| `src/game.js` | 0,1,2,3,5,6 | Combat refactor, skill execution, item pickup, floor transitions, death handling |
| `src/entities/player.js` | 0,1,2,3 | Attributes, stat derivation, equipment, skill slots, resource formulas |
| `src/ui/hud.js` | 4 | Complete rewrite: globes, action bar, potion hotbar, status icons |
| `src/renderer.js` | 3,4,5 | Globe rendering, ground item rendering, trap rendering, status effects |
| `src/systems/dungeonGenerator.js` | 5 | Side boss rooms, trap placement, floor-based generation |
| `src/systems/persistence.js` | 6 | New save schema, migration |
| `src/entities/enemy.js` | 5 | Per-level scaling formulas |
| `src/entities/boss.js` | 5 | Per-level scaling, new boss types |
| `src/input.js` | 2,3,4 | Hotkeys (I/K/C/1-4/Tab/Alt), panel toggle logic |
| `src/main.js` | 0,6 | New data loading, title screen, game state flow |

### Files to Remove/Replace
| File | Reason |
|------|--------|
| `src/ui/worldMap.js` | Replaced by waystone travel UI |
| `src/ui/skillTreeUI.js` | Replaced by skillBookUI + skillVendorUI |
| `src/ui/shopUI.js` | Replaced by itemVendorUI |
| `src/ui/blessingPicker.js` | Blessing system removed (if exists) |
| `src/ui/levelClear.js` | Simplified to notification + boss chest |
| `src/data/levels.json` | Replaced by floors.json |
| `src/data/skillTrees.json` | Replaced by restructured skills.json |
| `src/data/biomes.json` | Merged into floors.json themes |

### Files Largely Unchanged
| File | Why |
|------|-----|
| `src/systems/collision.js` | Spatial grid works as-is |
| `src/systems/particles.js` | Extend but core is fine |
| `src/systems/damageNumbers.js` | Add dodge text, otherwise reuse |
| `src/systems/audio.js` | Add new sounds, core synthesis unchanged |
| `src/entities/projectile.js` | Works as-is for ranged combat |
| `src/entities/minion.js` | Extend for skeleton/zombie types, core AI fine |
| `src/entities/npc.js` | Minor interaction type updates |
| `src/systems/layout.js` | Tile grid, fog of war, obstacle collision all reusable |
| `src/systems/dungeonRoom.js` | Room state tracking reusable, add trap triggering |

---

## 5. RISK ASSESSMENT

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `game.js` is 2800 lines and deeply coupled | High | High | Stage 0 breaks out subsystems early. Refactor combat into separate functions. |
| Grid inventory drag-and-drop is complex in Canvas | Medium | High | Use HTML/CSS overlay for inventory (per WIREFRAMES 19.1). Canvas for HUD only. |
| Old save data incompatible | Certain | Low | Detect old format, offer "New Game" only. No migration needed. |
| Balancing 50 levels of content | High | Medium | Start with rough numbers from DESIGN_BRIEF, iterate in Stage 7. Use debug commands to jump to any floor. |
| Trap visibility too subtle or too obvious | Medium | Low | Tune opacity curve in Stage 7. Start conservative (easier to see). |
| Tooltip positioning edge cases | Medium | Low | Standard flip logic (if near edge, show on opposite side). |
| Performance with many ground items | Low | Medium | Cap ground items per floor at 50. Oldest despawn first. |

---

## 6. MILESTONE CHECKPOINTS

| After Stage | Player Can... | Game Feels Like... |
|-------------|--------------|-------------------|
| **0** | Start game, pick class, enter dungeon (broken progression) | Broken prototype |
| **1** | Fight enemies with new damage formulas, level up, allocate attributes (via debug) | Combat-focused tech demo |
| **2** | Buy skills, equip to LMB/RMB, use skill book, visit trainer | Playable ARPG (no loot yet) |
| **3** | Find items, open inventory, equip gear, sell to vendor, use potions | Diablo-lite with loot loop |
| **4** | See globe HUD, status icons, skill cooldowns, get notifications | Visually polished ARPG |
| **5** | Descend 10 floors, use waystones, avoid traps, die and respawn | Complete dungeon experience |
| **6** | Full camp loop: heal, shop, train, travel, repeat | Complete game loop |
| **7** | Everything feels smooth, balanced, and satisfying | Shippable game |

---

*This plan is the implementation roadmap. Update it as work progresses and scope evolves.
Cross-reference with DESIGN_BRIEF.md for "what" and WIREFRAMES.md for "how it looks."*
