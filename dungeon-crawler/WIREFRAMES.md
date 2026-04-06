# Dungeon Crawler — UI Wireframes & UX Specification

> Frontend design reference. Diablo 2 inspired HUD with resource globes,
> centered overlay panels, and a persistent bottom action bar.
> All UI is rendered on the HTML Canvas or as HTML overlays on top of the canvas.

---

## 1. DESIGN PRINCIPLES

1. **Information at a glance** — HP and resource always visible as globes. No squinting at tiny numbers.
2. **Hands stay on controls** — Hotkeys for everything. Mouse never needs to leave the game area for core actions.
3. **Panels overlay, never replace** — Inventory, Skills, Character panels slide over the game canvas. The game world stays visible underneath (dimmed). Player is never "teleported" to a menu screen mid-dungeon.
4. **Consistent visual language** — Rarity colors are sacred (Gray/White/Green/Blue/Purple/Orange). Stat changes are Green (up) / Red (down) everywhere.
5. **Responsive to canvas size** — UI scales proportionally. Globes and action bar anchor to bottom; panels anchor to center.
6. **Minimal clicks** — Shift-click for quick-equip. Bulk-sell junk in one button. Potion hotbar always ready.

---

## 2. SCREEN FLOW

```
┌──────────┐    ┌──────────────┐    ┌──────────┐
│  TITLE   │───>│ CLASS PICKER │───>│   CAMP   │<─────────────────────┐
│  SCREEN  │    │              │    │   (HUB)  │                      │
└──────────┘    └──────────────┘    └────┬─────┘                      │
                                         │                            │
                              ┌──────────┼──────────┐                 │
                              │          │          │                 │
                         [Trainer]  [Vendor]  [Waystone]              │
                              │          │          │                 │
                              v          v          v                 │
                        ┌──────────┐ ┌────────┐ ┌──────────┐         │
                        │  SKILL   │ │  SHOP  │ │ WAYSTONE │         │
                        │ VENDOR   │ │   UI   │ │  TRAVEL  │         │
                        └──────────┘ └────────┘ └─────┬────┘         │
                                                      │              │
                                                      v              │
                                               ┌─────────────┐       │
                                               │   DUNGEON   │       │
                                               │  GAMEPLAY   │       │
                                               └──────┬──────┘       │
                                                      │              │
                                         ┌────────────┼────────┐     │
                                         │            │        │     │
                                         v            v        v     │
                                   ┌──────────┐ ┌─────────┐ ┌───┐   │
                                   │  DEATH   │ │  BOSS   │ │WAY│   │
                                   │  SCREEN  │ │ CLEARED │ │STO│   │
                                   └─────┬────┘ │ + LOOT  │ │NE │   │
                                         │      └────┬────┘ └─┬─┘   │
                                         │           │        │     │
                                         └───────────┴────────┴─────┘
```

---

## 3. GAMEPLAY HUD (Primary Screen)

This is the main screen players see 90% of the time. Inspired by Diablo 2's bottom panel with globes.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌─────────┐                                              ┌──────────┐     │
│  │ MINIMAP │                                              │ Floor: 3 │     │
│  │  (Tab)  │                                              │ Lv. 12   │     │
│  └─────────┘                                              │ Gold:342 │     │
│                                                           └──────────┘     │
│                                                                             │
│                                                                             │
│                          ┌─────────────┐                                    │
│                          │  BOSS HP    │ (only during boss fights)          │
│                          │ ▓▓▓▓▓▓░░░░ │                                    │
│                          │ Stoneguard  │                                    │
│                          └─────────────┘                                    │
│                                                                             │
│                                                                             │
│                        (( GAME CANVAS ))                                    │
│                                                                             │
│                                                                             │
│                                                                             │
│                                                                             │
│                                                                             │
│                                                                             │
│                                                                             │
│                                                                             │
│                                                                             │
│                                                                             │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │                         BOTTOM ACTION BAR                              │ │
│ │                                                                       │ │
│ │    ╭─────╮                                              ╭─────╮       │ │
│ │   ╱  HP   ╲    ┌───┐┌───┐┌───┐┌───┐  ┌────┐  ┌────┐  ╱ MANA  ╲      │ │
│ │  │  GLOBE  │   │ 1 ││ 2 ││ 3 ││ 4 │  │ L  │  │ R  │ │  GLOBE  │     │ │
│ │  │         │   │pot││pot││pot││pot│  │CLIK│  │CLIK│ │         │     │ │
│ │  │  120/   │   └───┘└───┘└───┘└───┘  └────┘  └────┘ │   78/  │     │ │
│ │  │   140   │                                          │   100  │     │ │
│ │   ╲       ╱   [C]har  [K]Skills  [I]nv   [M]ap        ╲       ╱      │ │
│ │    ╰─────╯                                              ╰─────╯       │ │
│ │                                                                       │ │
│ │  ┌─ XP BAR ─────────────────────────────────────────────────────────┐ │ │
│ │  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░  4500 / 6000 XP     │ │ │
│ │  └──────────────────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.1 Component Breakdown

#### HP Globe (Bottom-Left)
- **Shape**: Circular/bulb shape rendered on canvas, filled from bottom up proportional to HP%
- **Color**: Deep red fill (#8b0000 → #cc0000 gradient), dark background when empty
- **Text**: Current/Max HP centered in globe (e.g., "120/140")
- **Animation**: Smooth drain/fill on damage/heal. Flash white on hit. Pulse red glow when below 25%.
- **Size**: ~80px diameter

#### Resource Globe (Bottom-Right)
- **Shape**: Same as HP globe, mirrored
- **Color by class**:
  - Rage (Warrior): Orange-red (#cc4400 → #ff6600) — fills UP on attack, drains on skill use
  - Mana (Mage/Necro): Blue (#0044aa → #3388ff)
  - Stamina (Archer): Green-yellow (#668800 → #99cc00)
- **Text**: Current/Max (e.g., "78/100")
- **Animation**: Smooth fill/drain. Mana pulses blue when regenerating. Rage glows brighter as it fills.

#### Potion Hotbar (Bottom-Center-Left)
- **Layout**: 4 square slots in a row, numbered 1–4
- **Size**: ~36px per slot
- **Display**: Potion icon + stack count overlay (bottom-right corner)
- **Empty slot**: Dark gray with dotted border
- **Cooldown**: Radial clock-wipe overlay (dark, semi-transparent) during shared cooldown
- **Interaction**: Press 1–4 to use. Right-click to remove from hotbar. Drag from inventory to assign.

**Potion Hotbar Assignment Flow:**
1. Potions bought or looted go into the **inventory grid** first (as 1x1 stackable items).
2. To assign a potion to the hotbar: open Inventory (I), right-click potion → "Assign to Hotbar" → pick slot 1–4. Or drag potion from grid onto a hotbar slot.
3. Using a potion via hotbar (pressing 1–4) consumes one from the linked inventory stack.
4. If the linked stack runs empty, the hotbar slot shows the potion icon grayed out with a red "0" count.
5. Assigning a new potion type to an occupied slot replaces the old assignment.

#### Skill Slots (Bottom-Center-Right)
- **Layout**: 2 larger square slots side by side, labeled "LMB" and "RMB" (or mouse icons)
- **Size**: ~48px per slot
- **Display**: Skill icon + skill name below in small text
- **Cooldown**: Same radial clock-wipe as potions, plus grayed-out icon
- **Resource cost**: Small text below slot showing cost (e.g., "15 mana")
- **Swap arrows**: Small up-arrow button above each slot. Clicking opens a **quick skill picker** flyout showing all learned active skills. Click one to swap it in. This is the fast in-combat way to swap without opening the full Skill Book.
- **No resource**: If player lacks resource to cast, slot border pulses red briefly on click attempt

#### Quick Skill Picker (Flyout)
```
         ┌──┬──┬──┬──┐
         │🔥│❄️│✨│☄️│        ← Icon-only grid for fast recognition
         ├──┼──┼──┼──┤
         │🔮│  │  │  │        ← Basic attack always bottom-left
         └──┴──┴──┴──┘
               ┌────┐
               │ L  │  ← clicking swap arrow opens the flyout above
               │CLIK│
               └────┘
```
- Appears above the skill slot on click of the swap arrow
- **Icon-only grid layout** (no text) for instant recognition in combat — players learn the icons quickly
- **Hover an icon** → small tooltip shows skill name + resource cost (for when you need a reminder)
- Click icon to assign. ESC or click-away to close.
- Basic Attack icon always in bottom-left position with a subtle "free" badge.
- Game continues running while flyout is open (risk/reward of swapping mid-combat).

#### XP Bar (Very Bottom)
- **Shape**: Thin horizontal bar spanning the full width of the bottom panel
- **Height**: ~12px
- **Color**: Purple-blue gradient fill (#4400aa → #6644cc)
- **Text**: "4500 / 6000 XP" centered, small font
- **Animation**: Smooth fill on XP gain. Flash + particle burst on level up.

#### Info Area (Top-Right)
- **Display**: Floor number, Player level, Gold count
- **Style**: Semi-transparent dark background, right-aligned
- **Gold**: Yellow coin icon + number

#### Minimap (Top-Left)
- **Default**: Small square (120x120px) showing nearby rooms/corridors
- **Style**: Dark background, rooms as colored rectangles, player as white dot
- **Room colors**: Cleared = dark, current = bright, unexplored = hidden, boss = red
- **Tab key**: Expands to full-screen map overlay (semi-transparent background)

#### Boss HP Bar (Top-Center, Conditional)
- Only appears during boss encounters
- **Width**: ~40% of screen width, centered
- **Height**: ~20px
- **Color**: Red fill with dark red background
- **Text**: Boss name + HP value
- **Animation**: Smooth drain. At 50% HP, bar color shifts to angry orange (phase 2 indicator).

### 3.2 HUD Behavior
- All HUD elements render ON TOP of the game canvas (either as canvas overlays or positioned HTML elements)
- Bottom action bar has a dark semi-transparent background (~0.7 alpha) so game is visible but bar is readable
- HUD is always visible except when a full-screen panel (Inventory, Skills, Character) is open — then the bottom bar still shows but the game area is dimmed

---

## 4. INVENTORY + EQUIPMENT PANEL (Hotkey: I)

Opens as a centered overlay panel. Game is dimmed but visible underneath. Player can still be attacked (like Diablo 2 — incentive to use in safe rooms).

```
┌─────────────────────────────────────────────────────────────────────┐
│                         INVENTORY                            [X]   │
│                                                                     │
│  ┌─ EQUIPMENT ─────────────────┐  ┌─ INVENTORY GRID ─────────────┐ │
│  │                             │  │                               │ │
│  │          ┌──────┐           │  │  ┌──┬──┬──┬──┬──┬──┬──┬──┬──┬──┐│
│  │          │ CHEST│           │  │  │  │  │  │  │  │  │  │  │  │  ││
│  │          │ 2x2  │           │  │  ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤│
│  │  ┌────┐  │      │  ┌────┐   │  │  │  │  │  │  │  │  │  │  │  │  ││
│  │  │MAIN│  └──────┘  │ OFF│   │  │  ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤│
│  │  │HAND│            │HAND│   │  │  │  │  │  │  │  │  │  │  │  │  ││
│  │  │1x2 │            │1x2 │   │  │  ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤│
│  │  │    │  ┌──────┐  │    │   │  │  │  │  │  │  │  │  │  │  │  │  ││
│  │  └────┘  │ LEGS │  └────┘   │  │  ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤│
│  │          │ 2x2  │           │  │  │  │  │  │  │  │  │  │  │  │  ││
│  │ ┌──────┐ │      │ ┌────┐    │  │  ├──┼──┼──┼──┼──┼──┼──┼──┼──┼──┤│
│  │ │ BELT │ └──────┘ │BOOT│    │  │  │  │  │  │  │  │  │  │  │  │  ││
│  │ │ 2x1  │          │ S  │    │  │  └──┴──┴──┴──┴──┴──┴──┴──┴──┴──┘│
│  │ └──────┘          │1x2 │    │  │         10 columns x 6 rows     │
│  │                   │    │    │  │                                  │
│  │                   └────┘    │  │  ┌──────────────────────────┐   │
│  │                             │  │  │  Gold: 342  Junk val:12g│   │
│  │ ┌─ PLAYER ───────────────┐  │  │  └──────────────────────────┘   │
│  │ │  Warrior  Lv.12        │  │  │                                  │
│  │ │  STR: 8   INT: 3      │  │  └──────────────────────────────────┘│
│  │ │  AGI: 5   STA: 6      │  │                                     │
│  │ │                        │  │                                     │
│  │ │  Damage: 34  Armor: 12 │  │                                     │
│  │ │  Crit: 8%  Speed: 115  │  │                                     │
│  │ └────────────────────────┘  │                                     │
│  └─────────────────────────────┘                                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.1 Equipment Side (Left)

#### Character Doll
- **Layout**: 6 equipment slots arranged around a silhouette placeholder
- **Chest**: Top center (2x2 slot frame)
- **Main Hand**: Left of chest (1x2 slot frame)
- **Off Hand**: Right of chest (1x2 slot frame)
- **Legs**: Below chest (2x2 slot frame)
- **Belt**: Bottom-left (2x1 slot frame)
- **Boots**: Bottom-right (1x2 slot frame)
- **Empty slot**: Dark border with slot name label, dashed outline
- **Equipped item**: Shows item icon, rarity-colored border glow
- **Hover**: Shows item tooltip (see 4.3)

#### Stat Summary (Below Doll)
- Shows class name, level, all 4 attributes
- Shows computed stats: total Damage, Armor, Crit%, Move Speed
- Updates in real-time when hovering items (preview the change)

### 4.2 Inventory Grid (Right)
- **Grid**: 10x6 cells, each ~36px
- **Items**: Displayed as colored rectangles matching their grid size, with a small icon and rarity-colored border
- **Stack count**: Bottom-right corner of potions/stackables
- **Junk items**: Gray border + small trash icon overlay
- **Drag behavior**: Left-click picks up item (follows cursor). Left-click again to place. Right-click while holding to drop on ground at player position.
- **Grid overflow**: Items that don't fit show a red overlay on hover (can't place)

**Item Swap when Inventory Full:**
When the player walks over a ground item but inventory is full:
1. "Inventory Full" warning floats above player
2. Player opens inventory (I), left-clicks an unwanted item → item attaches to cursor
3. Moves cursor outside the inventory panel area, left-clicks → item drops to ground at player's feet
4. Closes inventory → walks over the desired ground item → auto-pickup
This is the standard drop-then-pickup loop. Simple, predictable, no magic swap mechanic.
- **Gold display**: Bottom bar shows total gold. When NOT at vendor, shows "Junk value: Xg" as passive info. When AT vendor, shows clickable **[Sell Junk: Xg]** button.

### 4.3 Item Tooltip
Appears on hover over any item (in inventory, equipped, on ground, in shop).

```
┌──────────────────────────────────┐
│  Crimson Blade of Agility        │  ← Name in RARITY COLOR
│  ─────────────────────────────── │
│  One-Handed Sword                │  ← Item type
│  Item Level: 14                  │
│                                  │
│  18–24 Damage                    │  ← Base stats
│  1.0 Attacks per Second          │
│                                  │
│  +4% Attack Speed      (Swift)   │  ← Affixes (prefix name in gray)
│  +3 AGI              (of Agility)│  ← Affixes (suffix name in gray)
│                                  │
│  Requires Level 12               │  ← Green if met, red if not
│  Warrior, Archer, Mage           │  ← Classes that can equip
│  ─────────────────────────────── │
│  Sell value: 28g                 │
├──────────────────────────────────┤
│  CURRENTLY EQUIPPED:             │  ← Comparison section
│  Rusty Shortsword                │
│  12–16 Damage                    │
│                                  │
│  ▲ +6 avg Damage     (green)    │  ← Upgrade indicator
│  ▲ +4% Attack Speed  (green)    │
│  ▲ +3 AGI            (green)    │
└──────────────────────────────────┘
```

**Tooltip rules:**
- Tooltip follows cursor but stays within screen bounds (flip side if near edge)
- Comparison section only shows when player has an item equipped in the same slot
- Stat changes: green arrow up = better, red arrow down = worse
- "Cannot Equip" in red replaces comparison if class/level restricted
- Legendary unique effects shown in orange text at bottom of affix list

---

## 5. CHARACTER PANEL (Hotkey: C)

A focused view of attributes and detailed stats. Can also be accessed from the Inventory panel's stat summary area.

```
┌──────────────────────────────────────────────┐
│              CHARACTER                  [X]   │
│                                              │
│  Warrior            Level 12                 │
│  XP: 4500 / 6000   ▓▓▓▓▓▓▓▓░░░░░           │
│                                              │
│  ┌─ ATTRIBUTES ─────────────────────────┐    │
│  │                                      │    │
│  │  STR:  8   [+]     AGI:  5   [+]    │    │
│  │  INT:  3   [+]     STA:  6   [+]    │    │
│  │                                      │    │
│  │  Available points: 1                 │    │
│  │                     [Reset (180g)]   │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  ┌─ OFFENSIVE STATS ───────────────────┐     │
│  │  Damage:         34                 │     │
│  │  Attack Speed:   1.2/s              │     │
│  │  Crit Chance:    8%                 │     │
│  │  Crit Damage:    +50%              │     │
│  │  Lifesteal:      2%                │     │
│  │  Pierce:         0                  │     │
│  └─────────────────────────────────────┘     │
│                                              │
│  ┌─ DEFENSIVE STATS ──────────────────┐      │
│  │  Max HP:         140                │      │
│  │  HP Regen:       1.1/s              │      │
│  │  Armor:          12                 │      │
│  │  Damage Reduction: 6%              │      │
│  │  Dodge Chance:    3%               │      │
│  │  Max Rage:       100               │      │
│  └─────────────────────────────────────┘     │
│                                              │
│  ┌─ MOVEMENT ─────────────────────────┐      │
│  │  Movement Speed:  115              │      │
│  └─────────────────────────────────────┘     │
│                                              │
└──────────────────────────────────────────────┘
```

### 5.1 Attribute Allocation
- **[+] buttons**: Only visible when `attributePointsAvailable > 0`. Click to spend 1 point.
- **Preview on hover**: Hovering [+] shows a yellow highlight on all stats that would change (e.g., hovering STR [+] highlights Damage, Armor).
- **Reset button**: Shows gold cost. Grayed out if not enough gold. Only works at camp (grayed + "Visit Camp" tooltip in dungeon).
- **Primary stat**: The class's primary attribute is highlighted with a star icon and colored text.

---

## 6. SKILL BOOK PANEL (Hotkey: K)

Shows all learned skills and allows slot assignment.

```
┌──────────────────────────────────────────────────────────────────┐
│                       SKILL BOOK                          [X]   │
│                                                                  │
│  ┌─ ACTIVE SKILLS ──────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐ │    │
│  │  │  ⚔ Slash │  │ 🛡 Block │  │ 💨 Charge│  │ 🌀 Whirl│ │    │
│  │  │  Lv.3    │  │  Lv.2    │  │  Lv.2    │  │  Lv.1    │ │    │
│  │  │  Free    │  │  15 rage │  │  25 rage │  │  40 rage │ │    │
│  │  │  0.7s cd │  │  1.5s cd │  │  4.0s cd │  │  8.0s cd │ │    │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘ │    │
│  │                                                          │    │
│  │  Click a skill, then click LMB or RMB slot to assign    │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─ SUMMON TOGGLES (Necro only) ─────────────────────────┐      │
│  │  [ON]  Summon Skeleton (2/2)   30mp/summon   3s cd    │      │
│  │  [OFF] Summon Zombie   (0/1)   40mp/summon   5s cd    │      │
│  └────────────────────────────────────────────────────────┘      │
│                                                                  │
│  ┌─ PASSIVE SKILLS (read-only — invest at Trainer NPC) ─────┐    │
│  │                                                          │    │
│  │  Toughness     ●●●○○  +6% damage reduction              │    │
│  │  Bloodlust     ●●○○○  +2% lifesteal                     │    │
│  │  Fury          ○○○○○  (not invested)                     │    │
│  │  Iron Skin     ●●●●○  +12% armor                        │    │
│  │  Relentless    ○○○○   (not invested)                     │    │
│  │  Vitality      ○○○○○  (not invested)                     │    │
│  │  Berserker Bl. ○○○    (not invested)                     │    │
│  │                                                          │    │
│  │  Points available: 3    Visit Trainer to invest          │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─ CURRENT LOADOUT ────────────────────────────────────────┐    │
│  │                                                          │    │
│  │   ┌────────────┐              ┌────────────┐             │    │
│  │   │  LMB SLOT  │              │  RMB SLOT  │             │    │
│  │   │  ⚔ Slash   │              │ 💨 Charge  │             │    │
│  │   │  Lv.3      │              │  Lv.2      │             │    │
│  │   └────────────┘              └────────────┘             │    │
│  │                                                          │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─ SKILL DETAIL (on hover/select) ─────────────────────────┐   │
│  │  Shield Charge  (Tier 2, Level 2/5)                      │   │
│  │  Dash forward dealing 38 damage with knockback.           │   │
│  │  Cost: 25 rage  |  Cooldown: 3.8s                        │   │
│  │  Next level: 46 damage, 3.6s cooldown (requires Lv.5)    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 6.1 Skill Assignment Flow
1. Player opens Skill Book (K)
2. Clicks an active skill card → card highlights with a gold border
3. Clicks either the LMB or RMB slot in "Current Loadout"
4. Skill is assigned. Old skill returns to the available pool. Done.

Alternative: Drag skill card directly onto LMB/RMB slot.

**Swap Feedback:** On skill assignment, the action bar slot does a quick gold flash (200ms) + "click" sound. The old skill icon slides out left, new one slides in from right (~200ms animation). This gives clear confirmation the swap happened.

### 6.2 Passive Display (Read-Only in Skill Book)
- Skill Book shows passive ranks as filled/empty dots — **view only**
- Click a passive row to see its description and per-rank effects in the detail panel
- To invest passive points, visit the **Trainer NPC at camp** (see section 7)
- Invested dots are highlighted in class color, empty dots are gray

---

## 7. SKILL VENDOR / TRAINER UI

Accessed by interacting with the Trainer NPC at camp. Replaces the old skill tree UI.

```
┌──────────────────────────────────────────────────────────────────┐
│                    SKILL TRAINER                          [X]   │
│  Gold: 342                                                       │
│                                                                  │
│  ┌─ ACTIVE SKILLS FOR SALE ─────────────────────────────────┐    │
│  │                                                          │    │
│  │  ┌──────────────────────────────────────────┐            │    │
│  │  │ ⚔ Shield Block    Tier 1    [OWNED Lv2] │            │    │
│  │  │ Block damage for 1s. 15 rage.            │            │    │
│  │  │ Upgrade to Lv3: 75g               [BUY] │            │    │
│  │  └──────────────────────────────────────────┘            │    │
│  │                                                          │    │
│  │  ┌──────────────────────────────────────────┐            │    │
│  │  │ 💨 Shield Charge   Tier 2   [OWNED Lv2] │            │    │
│  │  │ Dash + damage + knockback. 25 rage.      │            │    │
│  │  │ Upgrade to Lv3: 200g              [BUY] │            │    │
│  │  └──────────────────────────────────────────┘            │    │
│  │                                                          │    │
│  │  ┌──────────────────────────────────────────┐            │    │
│  │  │ 🌀 Whirlwind       Tier 3   [OWNED Lv1] │            │    │
│  │  │ Spin AoE for 2s. 40 rage.               │            │    │
│  │  │ Upgrade to Lv2: 500g              [BUY] │            │    │
│  │  └──────────────────────────────────────────┘            │    │
│  │                                                          │    │
│  │  ┌──────────────────────────────────────────┐            │    │
│  │  │ 📢 War Cry          Tier 3   [NOT OWNED] │            │    │
│  │  │ +20% damage buff for 5s. 30 rage.        │            │    │
│  │  │ Purchase: 400g                    [BUY] │            │    │
│  │  └──────────────────────────────────────────┘            │    │
│  │                                                          │    │
│  │  ┌──────────────────────────────────────────┐            │    │
│  │  │ 🔒 Earthquake       Tier 5   LOCKED      │            │    │
│  │  │ Requires Player Level 30                  │            │    │
│  │  │ Massive AoE stun + damage.               │            │    │
│  │  └──────────────────────────────────────────┘            │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─ PASSIVE SKILLS ─────────────────────────────────────────┐    │
│  │  Points available: 3                                     │    │
│  │                                                          │    │
│  │  Toughness     ●●●○○  [+]   +2% dmg reduction/rank      │    │
│  │  Bloodlust     ●●○○○  [+]   +1% lifesteal/rank          │    │
│  │  Fury          ○○○○○  [+]   +5% rage gen/rank           │    │
│  │  Iron Skin     ●●●●○  [+]   +3% armor/rank              │    │
│  │  Relentless    ○○○○   [+]   +2% attack speed/rank       │    │
│  │  Vitality      ○○○○○  [+]   +15 max HP/rank             │    │
│  │  Berserker Bl. ○○○    [+]   +3% dmg at low HP/rank      │    │
│  │                                                          │    │
│  │  [Respec Passives (240g)]  [Respec Attributes (180g)]    │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 7.1 Vendor States
- **OWNED**: Green badge, shows current level and upgrade cost
- **NOT OWNED**: Available for purchase, shows purchase cost
- **LOCKED**: Grayed out, shows level requirement, no buy button
- **MAX LEVEL**: Gold badge "MAX", no buy button
- **Can't afford**: Buy button grayed out, price in red

---

## 8. ITEM VENDOR UI

Accessed by interacting with the Item Vendor NPC at camp.

```
┌──────────────────────────────────────────────────────────────────┐
│                      ITEM SHOP                           [X]    │
│  Gold: 342                                                       │
│                                                                  │
│  ┌─ VENDOR STOCK ───────────┐  ┌─ YOUR INVENTORY ────────────┐  │
│  │                          │  │                              │  │
│  │  ┌────┐  Iron Sword     │  │   (Same grid as section 4)  │  │
│  │  │    │  12-16 dmg      │  │                              │  │
│  │  │    │  Common          │  │                              │  │
│  │  └────┘  Price: 30g     │  │                              │  │
│  │                          │  │                              │  │
│  │  ┌────┐  Chain Mail     │  │                              │  │
│  │  │    │  Armor: 8       │  │                              │  │
│  │  │    │  +5 HP (Sturdy) │  │                              │  │
│  │  └────┘  Uncommon  45g  │  │                              │  │
│  │                          │  │                              │  │
│  │  ┌──┐  HP Potion x5    │  │                              │  │
│  │  └──┘  30% HP   10g ea  │  │                              │  │
│  │                          │  │                              │  │
│  │  ┌──┐  Rage Tonic x3   │  │                              │  │
│  │  └──┘  +50 rage  15g ea │  │                              │  │
│  │                          │  │                              │  │
│  │  (scroll for more)      │  │                              │  │
│  │                          │  │                              │  │
│  └──────────────────────────┘  │  ┌────────────────────────┐ │  │
│                                │  │ [Sell Junk: 12g total] │ │  │
│  Click item to BUY             │  │ Right-click item: SELL │ │  │
│  Right-click your items: SELL  │  └────────────────────────┘ │  │
│                                └──────────────────────────────┘  │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 8.1 Vendor Interactions
- **Left-click vendor item**: Buy (if affordable, opens confirmation for items > 100g)
- **Right-click inventory item**: Sell instantly (price shown in tooltip)
- **Sell Junk button**: One-click sells ALL gray (junk) items, shows total gold earned
- **Vendor item hover**: Shows full tooltip with comparison to equipped
- **Can't afford**: Item border shown in dark red, price in red text

---

## 9. WAYSTONE TRAVEL UI

Accessed at any waystone (camp or dungeon entrance rooms).

```
┌────────────────────────────────────────────────────┐
│               WAYSTONE TRAVEL                [X]   │
│                                                    │
│  ┌──────────────────────────────────────────────┐  │
│  │                                              │  │
│  │  1.  Dark Cellar       Lv.1    ✓ CLEARED    │  │
│  │  2.  Cursed Crypt      Lv.3    ✓ CLEARED    │  │
│  │  3.  Molten Cavern     Lv.6    ▶ IN PROGRESS│  │
│  │      (3/8 rooms cleared)                     │  │
│  │  4.  Frozen Depths     Lv.10   ● DISCOVERED │  │
│  │  5.  Blighted Sewers   Lv.14   🔒 LOCKED    │  │
│  │      (Requires player level 14)              │  │
│  │  6.  Bone Spire        Lv.18   🔒 LOCKED    │  │
│  │  7.  Shadow Realm      Lv.23   🔒 LOCKED    │  │
│  │  8.  Sunken Temple     Lv.28   🔒 LOCKED    │  │
│  │  9.  Ashen Battlefield Lv.34   🔒 LOCKED    │  │
│  │  10. The Hollow        Lv.42   🔒 LOCKED    │  │
│  │                                              │  │
│  └──────────────────────────────────────────────┘  │
│                                                    │
│  Click a floor to travel.                          │
│  Locked floors require the listed player level.    │
│                                                    │
│           [Return to Camp]                         │
│                                                    │
└────────────────────────────────────────────────────┘
```

### 9.1 Floor States
| State | Visual | Clickable |
|-------|--------|-----------|
| **CLEARED** | Green checkmark, bright text | Yes (can revisit for farming) |
| **IN PROGRESS** | Yellow arrow, shows rooms cleared | Yes |
| **DISCOVERED** | White dot, normal text | Yes (discovered via stairs from previous floor) |
| **LOCKED** | Gray lock icon, dimmed text, shows requirement | No |

### 9.2 Travel Behavior
- From **camp waystone**: Can travel to any non-locked floor. "Enter Dungeon" for floor 1 if first time.
- From **dungeon waystone**: Shows "Return to Camp" prominently. Can also jump to other discovered floors.
- Travel is instant (short fade-to-black transition).

---

## 10. CLASS PICKER SCREEN

Shown once at game start (new character) or when starting a new save.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│                        CHOOSE YOUR CLASS                                │
│                                                                         │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ ┌─────────────┐ │
│  │               │ │               │ │               │ │             │ │
│  │   ⚔ WARRIOR  │ │   🔮 MAGE    │ │   🏹 ARCHER  │ │  💀 NECRO  │ │
│  │               │ │               │ │               │ │             │ │
│  │  Melee        │ │  Ranged       │ │  Ranged       │ │  Summoner   │ │
│  │  bruiser      │ │  glass cannon │ │  precision    │ │  pet army   │ │
│  │               │ │               │ │               │ │             │ │
│  │ ┌───────────┐ │ │ ┌───────────┐ │ │ ┌───────────┐ │ │ ┌─────────┐│ │
│  │ │ HP  ▓▓▓▓▓ │ │ │ HP  ▓▓░░░ │ │ │ HP  ▓▓▓░░ │ │ │ HP  ▓▓▓░│ │
│  │ │ DMG ▓▓▓▓░ │ │ │ DMG ▓▓▓▓▓ │ │ │ DMG ▓▓▓░░ │ │ │ DMG ▓▓░░│ │
│  │ │ SPD ▓▓░░░ │ │ │ SPD ▓▓▓░░ │ │ │ SPD ▓▓▓▓▓ │ │ │ SPD ▓▓▓░│ │
│  │ │ DEF ▓▓▓▓▓ │ │ │ DEF ▓░░░░ │ │ │ DEF ▓▓░░░ │ │ │ DEF ▓▓░░│ │
│  │ └───────────┘ │ │ └───────────┘ │ │ └───────────┘ │ │ └─────────┘│ │
│  │               │ │               │ │               │ │             │ │
│  │  Resource:    │ │  Resource:    │ │  Resource:    │ │  Resource:  │ │
│  │  Rage         │ │  Mana         │ │  Stamina      │ │  Mana       │ │
│  │  (build on    │ │  (regen over  │ │  (fast regen) │ │  (regen,    │ │
│  │   hit/hurt)   │ │   time)       │ │               │ │   summons)  │ │
│  │               │ │               │ │               │ │             │ │
│  │   [SELECT]    │ │   [SELECT]    │ │   [SELECT]    │ │  [SELECT]   │ │
│  └───────────────┘ └───────────────┘ └───────────────┘ └─────────────┘ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 10.1 Interactions
- Hover card → card lifts slightly (scale 1.02), border glows in class color
- Click card → confirmation dialog: "Play as Warrior?" [Confirm] [Back]
- Class color bleeds into background on hover (subtle radial gradient)

---

## 11. DEATH SCREEN

Shown on player death. Dark overlay with solemn tone.

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│                                                     │
│                   YOU HAVE FALLEN                    │
│                                                     │
│               Floor 3 — Molten Cavern               │
│                                                     │
│           ┌───────────────────────────┐             │
│           │  Gold lost:     34g       │             │
│           │  Gold remaining: 308g     │             │
│           │                           │             │
│           │  Rooms cleared this run: 5│             │
│           │  Enemies slain: 23        │             │
│           └───────────────────────────┘             │
│                                                     │
│           Floor progress has been saved.            │
│           Items left on the ground are lost.        │
│                                                     │
│              [Return to Camp]                       │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 12. LOOT PICKUP & GROUND ITEMS

### 12.1 World Item Display
Items on the ground are shown as small glowing rectangles with a name label floating above.

```
        Crimson Blade of Agility          ← Name in BLUE (rare)
              ┌──────┐
              │ ✦✦✦  │                    ← Glow particles match rarity color
              └──────┘

        Broken Hilt                        ← Name in GRAY (junk)
              ┌──┐
              │  │
              └──┘
```

### 12.2 Pickup Behavior
- **Gold**: Auto-pickup when player walks within 48px. Gold count animates up. Small "ching" sound.
- **Items**: Auto-pickup when player walks within 32px (proximity-based). Item flies to inventory with a short animation + pickup sound. No button press required.
- **Inventory full**: Item stays on ground. Red text "Inventory Full" floats for 1.5s. Player must drop/sell something first.
- **Name labels**: Only visible within ~150px of the item. Dense loot shows stacked labels (slight vertical offset so they don't overlap).
- **Alt key (hold)**: Shows ALL ground item labels regardless of distance (Diablo-style loot filter).
- **Left-click / Right-click are never used for pickup** — reserved exclusively for combat skills.

---

## 13. DUNGEON TRAPS (Visual & Interaction Spec)

Traps are environmental hazards placed during dungeon generation. They are visible but subtle — players who pay attention can avoid them.

### 13.1 Trap Visual States

**Idle (unactivated):**
```
   Poison Trap          Fire Trap           Spike Trap
   ·  · ·  ·           ╌╌╌╌╌╌╌╌            ─ ─ ─ ─
    · ·· ·             ╌ (glow) ╌           │cracks│
   · ·  · ·            ╌╌╌╌╌╌╌╌            ─ ─ ─ ─
  (green bubbles)    (orange glow lines)   (thin floor cracks)

   Explosive Trap       Slow Trap           Curse Trap
     ┌───┐              ✦  ✦  ✦             ⬡ ⬡ ⬡
     │(●)│  ← red       ✦    ✦              ⬡   ⬡
     └───┘    blink      ✦  ✦  ✦             ⬡ ⬡ ⬡
  (device, red pulse)  (blue frost runes)  (purple sigil)
```

**Visual properties:**
| Trap | Color | Idle Animation | Size (radius) |
|------|-------|---------------|---------------|
| Poison | Green (#22aa22) | Bubbling particles rise slowly | 24px |
| Fire | Orange (#ff8800) | Faint pulsing glow lines | 20px |
| Spike | Gray (#888888) | None (static cracks) | 20px |
| Explosive | Red (#cc0000) | Red dot blinks every 1.5s | 16px (device), 80px (blast) |
| Slow | Light blue (#88ccff) | Runes shimmer/rotate slowly | 28px |
| Curse | Purple (#8800aa) | Sigil pulses faintly | 24px |

**Distance-based visibility:**
- At 200px+ distance: 30% opacity (very faint, easy to miss)
- At 80-200px: Opacity scales linearly from 30% → 100%
- At < 80px: 100% opacity (fully visible)
- This rewards players who scan ahead before rushing into rooms

### 13.2 Trap Activation Animation

When the player walks within trigger radius (32px):

```
  TRIGGER (0s)          ACTIVATE (0.3s)         RESOLVE (0.5s)
                                                 
    Player              ╔══════════╗            Effect applied
    walks     →         ║ FLASH +  ║     →      Trap disappears
    over trap           ║ PARTICLE ║            Status icon on player
                        ╚══════════╝
```

**Per-trap activation visuals:**
- **Poison**: Green gas cloud expands outward (64px), lingers 0.5s, fades
- **Fire**: Flame burst shoots upward, orange/red particles, brief screen-edge heat shimmer
- **Spike**: Metal spikes shoot up from floor (quick vertical lines), retract after 0.3s
- **Explosive**: 0.5s fuse (red circle grows as warning), then explosion with screen shake + debris particles
- **Slow**: Frost crystals expand outward in ring, ice particles linger on ground 1s
- **Curse**: Dark energy swirls inward toward player, purple flash on player, shadowy particles

### 13.3 Status Effect Indicators (Player HUD)

When a trap applies a status effect, show it near the HP globe:

```
    ╭─────╮
   ╱  HP   ╲
  │  GLOBE  │
  │         │    [🟢 4s] [🔴 3s]     ← Status icons with remaining duration
  │   85/   │    Poisoned  Bleeding
  │   140   │
   ╲       ╱
    ╰─────╯
```

- Status icons appear as small colored squares next to the HP globe
- Each shows an icon/color matching the status + remaining duration in seconds
- Multiple statuses stack horizontally
- Icon pulses when about to expire (< 1s remaining)
- Colors: Green=Poisoned, Orange=Burning, Red=Bleeding, Blue=Slowed/Frozen, Purple=Weakened

### 13.4 Trap Awareness Cues
- When entering a room with traps, a brief **subtle audio cue** plays (quiet hiss/click) — not a loud alarm, just enough to subconsciously trigger alertness
- Traps near the edge of the screen have a faint **shimmer effect** when the camera pans past them
- In the **full map overlay** (Tab), rooms with traps are NOT marked — exploration is the challenge

---

## 14. NOTIFICATION & FEEDBACK SYSTEMS

### 13.1 Floating Combat Text
- **Damage dealt**: Yellow numbers floating up from enemy. Crit = larger + red + "!" suffix.
- **Damage taken**: Red numbers floating up from player.
- **Healing**: Green "+" numbers floating up from player.
- **XP gained**: Small purple "+12 XP" below damage numbers (only on kill).
- **Gold picked up**: Small yellow "+5g" near player feet.

### 13.2 Center Screen Notifications
Large text announcements for major events:
```
             ╔═══════════════════╗
             ║   LEVEL UP! (13)  ║       ← Gold text, particle burst
             ╚═══════════════════╝

             ╔═══════════════════╗
             ║  BOSS DEFEATED!   ║       ← Red text, screen flash
             ╚═══════════════════╝

             ╔═══════════════════╗
             ║   FLOOR 4         ║       ← White text, fade in
             ║  Frozen Depths    ║
             ╚═══════════════════╝
```
- Display for 2 seconds, fade out over 0.5s.
- Queue if multiple fire simultaneously (rare).

### 13.3 Resource Warnings
- **Not enough rage/mana/stamina**: Skill slot border flashes red. Resource globe pulses. Small red text "Not enough mana" near action bar.
- **HP low (below 25%)**: HP globe pulses with red glow. Heartbeat sound effect. Red vignette on screen edges.
- **Inventory full (on loot drop)**: Yellow warning text center-bottom: "Inventory Full — make room to pick up items".

---

## 15. CAMP HUD

The camp uses a simplified HUD since there's no combat.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│                                                    ┌──────────┐        │
│                                                    │ Lv. 12   │        │
│                                                    │ Gold: 342│        │
│                                                    └──────────┘        │
│                                                                         │
│                                                                         │
│                          BASE CAMP                                      │
│                                                                         │
│                                                                         │
│        ⚔ Trainer                🔥                   🛒 Vendor          │
│       "Press E"              Campfire              "Press E"            │
│                                                                         │
│                                                                         │
│                              🔵                                          │
│                           Waystone                                      │
│                           "Press E"                                     │
│                                                                         │
│                              🧍                                          │
│                            (player)                                     │
│                                                                         │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │  [C]haracter   [K] Skills   [I]nventory                            │ │
│ │                                                                    │ │
│ │  HP: 140/140   Rage: 0/100                              Gold: 342 │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

### 15.1 Camp Simplifications
- No potion hotbar (no combat)
- No skill slots (no combat)
- No minimap (single room)
- Resource bars shown as text only (not globes)
- **Rage = 0 at camp** (no combat to generate it). Displays as "Rage: 0/100" — this is correct, not a bug. Rage resets to 30 on dungeon floor entry.
- NPC interaction prompts appear when within range ("Press E to talk")
- Campfire auto-heals when near (visual sparkle effect, full HP + mana/stamina restore)

---

## 16. TITLE SCREEN

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│                                                                 │
│                                                                 │
│                     D U N G E O N                               │
│                     C R A W L E R                               │
│                                                                 │
│                                                                 │
│                                                                 │
│                                                                 │
│                    [  NEW GAME  ]                                │
│                    [ CONTINUE   ]                                │
│                                                                 │
│                                                                 │
│                                                                 │
│                                                                 │
│              (ambient particle effects / torch flicker)          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

- **NEW GAME**: Goes to Class Picker (section 10)
- **CONTINUE**: Only shown if save data exists. Loads directly into Camp.
- Background: Dark with subtle animated particles (embers, fog).

---

## 17. FULL MAP OVERLAY (Hotkey: Tab)

Expands the minimap to cover the full screen with a semi-transparent dark overlay.

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│           Floor 3 — Molten Cavern                                   │
│                                                                     │
│     ┌─────────┐           ┌─────────┐                               │
│     │ COMBAT  │───────────│ COMBAT  │                               │
│     │ cleared │           │ cleared │                               │
│     └────┬────┘           └────┬────┘                               │
│          │                     │                                    │
│     ┌────┴────┐           ┌────┴────┐        ┌─────────┐           │
│     │ENTRANCE │───────────│  SAFE   │────────│ SIDE    │           │
│     │  (WS)   │           │  ROOM   │        │ BOSS    │           │
│     └────┬────┘           └────┬────┘        │ (skull) │           │
│          │                     │             └─────────┘           │
│     ┌────┴────┐           ┌────┴────┐                               │
│     │ COMBAT  │───────────│ ★ YOU   │                               │
│     │         │           │  HERE   │                               │
│     └─────────┘           └────┬────┘                               │
│                                │                                    │
│                           ┌────┴────┐                               │
│                           │  BOSS   │                               │
│                           │  (red)  │                               │
│                           └─────────┘                               │
│                                                                     │
│  Legend:  ■ Cleared  □ Current  ░ Unexplored  💀 Boss  🔵 Waystone  │
│  Press Tab to close                                                 │
└─────────────────────────────────────────────────────────────────────┘
```

### 17.1 Map Features
- Rooms shown as rectangles, corridors as lines
- **Color coding**: Gray = cleared, White = current room, Dark = unexplored (fog), Red = boss room, Blue = waystone
- **Player marker**: Pulsing white dot in current room
- **Room labels**: Show room type icon (skull for boss, chest for treasure, coin for shop)
- **Fog of war**: Unexplored rooms/corridors not drawn at all until adjacent room is entered

---

## 18. RESPONSIVE CONSIDERATIONS

### 18.1 Canvas Sizing
- Game canvas fills the browser window
- UI elements scale proportionally based on canvas height
- Minimum supported resolution: **960x540**
- Globe size: ~8% of canvas height
- Action bar height: ~15% of canvas height
- Overlay panels: Max 80% of canvas width, 85% of canvas height

### 18.2 Touch / Mobile (Future)
> Not in v1 scope. Current design is desktop-first (keyboard + mouse).
> The existing touch joystick system can be preserved but the full ARPG UI
> (inventory grid drag-and-drop, right-click context menus) is desktop-only for now.

---

## 19. UI IMPLEMENTATION APPROACH

### 19.1 Rendering Strategy
| Component | Renderer | Why |
|-----------|----------|-----|
| HP/Resource Globes | Canvas | Need smooth fill animations, blend with game art |
| XP Bar | Canvas | Thin bar, part of bottom panel composite |
| Action Bar (potions, skills) | Canvas | Cooldown clock-wipe is easier in Canvas |
| Minimap | Canvas | Already exists, just needs room-state colors |
| Damage Numbers | Canvas | Already exist, floating world-space text |
| Overlay Panels (Inventory, Skills, Character, Vendor) | HTML/CSS | Complex layouts, scrolling, drag-and-drop, text-heavy |
| Tooltips | HTML/CSS | Rich formatted text, dynamic positioning |
| Notifications (Level Up, etc.) | Canvas | Center-screen with particle effects |
| Title Screen | HTML/CSS | Simple, no game state needed |
| Class Picker | HTML/CSS | Card layout, hover effects |

### 19.2 Z-Order (Bottom to Top)
1. Game Canvas (world, entities, particles, damage numbers)
2. HUD Canvas Layer (globes, action bar, XP bar, minimap, notifications)
3. HTML Overlay Layer (panels, tooltips, vendor UIs, menus)
4. Modal Layer (confirmation dialogs, death screen)

### 19.3 Panel Management
- Only one major panel open at a time (Inventory, Skills, Character, Vendor)
- Opening a new panel closes the current one
- ESC closes any open panel
- Panels animate: slide-in from bottom (150ms ease-out) on open, fade-out (100ms) on close
- Game is **dimmed** (dark overlay at 0.4 alpha) when any panel is open
- Game logic continues running (enemies can still attack — Diablo-style risk)

---

*This document defines the visual and interaction design for every screen in the game.
Reference alongside DESIGN_BRIEF.md during implementation.*
