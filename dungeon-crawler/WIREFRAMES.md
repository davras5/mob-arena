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
                        │ TRAINER  │ │  SHOP  │ │ WAYSTONE │         │
                        │ (RESPEC) │ │   UI   │ │  TRAVEL  │         │
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
│ │   ╲       ╱   ┌─────┐ ┌──────┐ ┌─────┐  [M]ap        ╲       ╱      │ │
│ │    ╰─────╯    │ Char │ │Skills│ │ Inv │               ╰─────╯       │ │
│ │               │  (C) │ │ (K)  │ │ (I) │                              │ │
│ │               └─────┘ └──────┘ └─────┘                              │ │
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
- **Swap arrows**: Small up-arrow button above each slot. Clicking opens a **quick skill picker** flyout showing all 4 of the class's attacks (both specs' primary + secondary). Click one to swap it in. This is the fast in-combat way to swap without opening the full Skill Book.
- **No resource**: If player lacks resource to cast, slot border pulses red briefly on click attempt

#### Panel Buttons (Bottom-Center, Below Hotbars)
- **Layout**: 3 rectangular buttons in a row between the globes, positioned below the potion/skill slots
- **Buttons**: `Char` (C), `Skills` (K), `Inv` (I)
- **Size**: ~50×24px each, small gap between them
- **Style**: Dark semi-transparent background (#1a1a2e at 80% opacity), light border (#555), white text. Keyboard shortcut shown in parentheses as secondary label.
- **Hover**: Border brightens to gold (#c9a84c), slight scale-up
- **Active state**: When the corresponding panel is open, button stays highlighted with gold border
- **Click**: Toggles the corresponding overlay panel (Character, Skill Book, Inventory). Clicking the same button again closes the panel.
- **Purpose**: Primary interaction method for most users — keyboard shortcuts (C/K/I) remain as alternatives

#### Quick Skill Picker (Flyout)
```
         ┌──────────────┐
         │ SPEC 1 (Pyro)│
         ├──────┬───────┤
         │  🔥  │  💥   │   ← Primary  |  Secondary
         │ Bolt │ Ball  │
         ├──────┴───────┤
         │ SPEC 2 (Cryo)│
         ├──────┬───────┤
         │  ❄️  │  🌨   │   ← Primary  |  Secondary
         │ Shard│ Nova  │
         └──────┴───────┘
               ┌────┐
               │ L  │  ← clicking swap arrow opens the flyout above
               │CLIK│
               └────┘
```
- Appears above the skill slot on click of the swap arrow
- **Always shows exactly 4 attacks** (both specs' primary + secondary) in a fixed 2×2 layout, grouped by spec — instant muscle memory
- Icons currently equipped in the OTHER slot are shown with a thin gold border (so you don't double-equip the same attack to both slots — but you CAN if you want)
- **Hover an icon** → small tooltip shows attack name, resource cost, cooldown, and how many tree points the player has invested in that spec
- Click icon to assign. ESC or click-away to close.
- Game continues running while flyout is open (risk/reward of swapping mid-combat).
- Attacks for which the spec tree has zero investment are still selectable (the attack still works at base power) — they're just dimmed slightly to indicate "untrained".

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

#### Enemy Nameplates (Above Each Enemy)
Floating nameplate rendered above every enemy in combat, showing name, level, and health at a glance.

```
        Brute  Lv.8
      ▓▓▓▓▓▓▓▓░░░░
        (enemy sprite)
```

- **Position**: Centered above the enemy sprite, offset ~8px above the top edge
- **Name**: Enemy type name in white, small font (~10px). Bold for elites/champions.
- **Level**: "Lv.X" displayed right of the name, same font size. Color-coded relative to player level:
  - Green: ≥3 levels below player (easy)
  - White: within 2 levels (normal)
  - Yellow: 3–5 levels above player (challenging)
  - Red: ≥6 levels above player (dangerous)
- **Health bar**: Thin bar (~40px wide, 4px tall) below the name text
  - **Fill color**: Green >50%, Yellow 25–50%, Red <25%
  - **Background**: Dark gray (#333)
  - **Border**: 1px black outline for readability against any floor theme
- **Visibility**: Always visible while the enemy is alive and on-screen. Fades out on death.
- **Boss exception**: Bosses use the large top-center HP bar instead; no floating nameplate on bosses.

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

The Skill Book is the central screen for spending skill points, viewing both spec trees, and assigning attacks to LMB/RMB. There is **no Skill Vendor** — all progression happens here.

### 6.0 Layout Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│  SKILL BOOK — Warrior, Lv 17                                    [X]   │
│  Skill Points: 4 available     Invested:  Guardian 12  •  Berserker 6 │
│                                                                        │
│  ┌─ ACTION BAR ───────────────────────────────────────────────────┐    │
│  │                                                                │    │
│  │     ┌────────────────┐              ┌────────────────┐         │    │
│  │     │  LMB           │              │  RMB           │         │    │
│  │     │  ⚔  Bash       │              │  🌀 Whirlwind  │         │    │
│  │     │  Guardian      │              │  Berserker     │         │    │
│  │     │  +10 rage/hit  │              │  40 rage  6s   │         │    │
│  │     └────────────────┘              └────────────────┘         │    │
│  │                                                                │    │
│  │   Click a slot → picker shows all 4 class attacks. Drag also.  │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                        │
│  ╔═[ ⛨ GUARDIAN  (12 pts) ]══╗  ┌─[ ⚔ BERSERKER  (6 pts) ]──────┐     │
│  ║                                                               ║│    │
│  ║   PRIMARY: ⚔ Bash         SECONDARY: 🛡 Parry Stance         ║│    │
│  ║   ────────────────────────────────────────────────────       ║│    │
│  ║                                                               ║│    │
│  ║   ┌─ Tier 1  (gate 0)  ─────────────────────────────────┐   ║│    │
│  ║   │  ◉◉◉◯◯   Iron Hide      3/5    +9% armor            │   ║│    │
│  ║   │  ◉◉◯◯◯   Stalwart       2/5    +30 max HP           │   ║│    │
│  ║   │  ◉◉◉◉◉   Heavy Hands    5/5    Bash dmg +40%  [MAX] │   ║│    │
│  ║   └──────────────────────────────────────────────────────┘   ║│    │
│  ║                                                               ║│    │
│  ║   ┌─ Tier 2  (gate 3)  ✓ unlocked ──────────────────────┐   ║│    │
│  ║   │  ◉◉◯     Reinforced Stance   2/3                    │   ║│    │
│  ║   │  ◯◯◯     Spiked Plating      0/3                    │   ║│    │
│  ║   │  ◯◯◯     Counterattack       0/3                    │   ║│    │
│  ║   └──────────────────────────────────────────────────────┘   ║│    │
│  ║                                                               ║│    │
│  ║   ┌─ Tier 3  (gate 8)  ✓ unlocked  — choose ONE branch ─┐   ║│    │
│  ║   │   ┌────────────────────┐    ┌────────────────────┐  │   ║│    │
│  ║   │   │  ⮞ Hold the Line   │    │     Vigilant       │  │   ║│    │
│  ║   │   │       ◯◯◯          │ OR │       ◯◯◯          │  │   ║│    │
│  ║   │   │  -8% dmg taken     │    │  Parry cd -0.6s    │  │   ║│    │
│  ║   │   │  while slow-moving │    │  per rank          │  │   ║│    │
│  ║   │   └────────────────────┘    └────────────────────┘  │   ║│    │
│  ║   │   (picking one locks the other until respec)        │   ║│    │
│  ║   └──────────────────────────────────────────────────────┘   ║│    │
│  ║                                                               ║│    │
│  ║   ┌─ Tier 4  (gate 15)  🔒  need 3 more pts in Guardian ─┐  ║│    │
│  ║   │   🔒 Taunting Strike   (1 rank) — keystone            │  ║│    │
│  ║   │   🔒 Last Stand        (1 rank) — keystone            │  ║│    │
│  ║   └───────────────────────────────────────────────────────┘  ║│    │
│  ║                                                               ║│    │
│  ║   ┌─ Tier 5  (gate 20)  🔒  CAPSTONE ────────────────────┐  ║│    │
│  ║   │                                                       │  ║│    │
│  ║   │       ★  AEGIS  ★                                     │  ║│    │
│  ║   │       Once per fight, when reduced below 20% HP,      │  ║│    │
│  ║   │       become invulnerable for 3s and reflect          │  ║│    │
│  ║   │       100% damage.                                    │  ║│    │
│  ║   │       Available at 20 points in Guardian.             │  ║│    │
│  ║   │                                                       │  ║│    │
│  ║   └───────────────────────────────────────────────────────┘  ║│    │
│  ╚═══════════════════════════════════════════════════════════════╝│    │
│                                                                        │
│  ┌─ NODE DETAIL (hover/select) ───────────────────────────────────┐    │
│  │  Heavy Hands  •  Guardian Tier 1  •  Rank 5/5  [MAXED]         │    │
│  │  Increases Bash damage by 8% per rank.                         │    │
│  │  Current bonus: +40% Bash damage                               │    │
│  │  Next rank: — (already maxed)                                  │    │
│  │                                                                │    │
│  │  Bash base damage: 14    →  with this node: 19.6              │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                        │
│  4 Skill Points available     [Respec Skill Tree at Trainer (425g)]   │
└────────────────────────────────────────────────────────────────────────┘
```

### 6.1 Visual Language
- **Spec tabs** — The active spec tab uses double-line borders (`╔══╗`) and highlight color matching the spec (Guardian = steel blue, Berserker = blood red, Pyromancer = orange, Cryomancer = ice blue, Marksman = forest green, Beastmaster = bark brown, Plaguebringer = sickly green, Bone Lord = bone white). The inactive tab uses single-line borders.
- **Node ranks** — Filled circle ◉ = invested rank, empty circle ◯ = available rank. A `[MAX]` badge appears next to fully-maxed nodes.
- **Tier gates** — Locked tiers display 🔒 with the unlock requirement ("need N more pts in this tree"). The tier header is dimmed gray. Once unlocked, the header turns class color and shows ✓ unlocked.
- **Tier 3 choice nodes** — Shown as a side-by-side pair joined by an "OR" divider. Once a player invests in one, the other is grayed out with a "Locked by branch choice" tooltip until respec.
- **Capstone (Tier 5)** — Always rendered as a single large card with a gold star ★, full description visible even when locked. The unlock condition ("20 pts in tree") is bold-prominent.
- **Cross-tab indicator** — When the player has unspent skill points, BOTH spec tabs show a small green pulse dot to remind them they can invest in either tree.

### 6.2 Action Bar Section (Top)
- **Two large slots**: LMB and RMB. Each shows the currently equipped attack's icon, name, spec, and a one-line summary of cost/cooldown.
- **Click a slot** → Opens a 4-attack picker (same layout as the in-combat Quick Skill Picker, but bigger and with full descriptions). Player picks any of the 4 class attacks.
- **Drag-and-drop** → Player can drag any of the 4 attack icons (shown beneath the spec tree as a small reference row) directly onto either slot.
- **Spec mismatch warning** — If the player equips an attack from a spec they have ZERO points in, a small ⚠ icon appears next to the slot and a hover tooltip says "You haven't invested in [Spec Name] — this attack will work at base power. Spend points in the [Spec Name] tree to scale it." Non-blocking.

### 6.3 Tree Investment Flow
1. Player opens Skill Book (K)
2. Player clicks the spec tab they want to invest in (Guardian or Berserker)
3. Player clicks any unlocked node with rank < maxRank
4. **Confirmation**: a "+1" floats up from the node, the rank dot fills with the spec color, the "Skill Points available" counter decrements, and a soft chime plays
5. Tier gates are re-evaluated immediately — if the new total unlocks Tier 2/3/4/5, those tiers visually "light up" with a brief gold sweep animation
6. **No undo** outside of a Trainer respec. The first respec is free, so early experimentation is encouraged.

### 6.4 Tier 3 Branch Choice
- Player clicks one of the two side-by-side cards
- Confirmation popup: "Choose [Hold the Line] as your Tier 3 branch? You can only invest in one branch per spec until you respec."
- On confirm: chosen branch activates, other branch grays out with a "🔒 Branch locked" label
- Players can still see the locked branch's description (read-only) so they know what they passed up
- Respec at the Trainer fully resets the choice

### 6.5 Capstone Unlock
- When the player reaches 20 points in a tree, the capstone card pulses gold for 2 seconds and a center-screen notification appears: "★ CAPSTONE UNLOCKED — Aegis ★ — Available to invest in the Skill Book"
- The capstone is a single rank, costs 1 point, and has a dramatic visual effect when invested (screen flash + sound)
- Capstones are spec-defining; investing one usually changes how the player thinks about combat

### 6.6 Hover Detail Panel (Bottom)
Shown whenever the player hovers a node, an attack slot, or the capstone:
- **Title**: Node name • Spec • Tier • Current rank
- **Description**: Short flavor + per-rank effect
- **Current bonus**: What the player gets right now (e.g., "+40% Bash damage")
- **Next rank**: What investing one more point would give (e.g., "→ +48% Bash damage")
- **Synergy hint** (optional, for nodes that interact with other tree nodes): "Synergizes with: Counterattack, Reinforced Stance"
- **For attack slots**: Shows the attack's full damage formula INCLUDING all current tree bonuses, so the player can see the effect of their investment without doing math

### 6.7 Footer
- **Left**: "N Skill Points available" — pulses green if N > 0
- **Right**: "[Respec Skill Tree at Trainer (425g)]" link — clicking it shows a tooltip "Visit the Trainer NPC in camp. First respec is free." The link is informational only; the actual respec happens at the Trainer.

### 6.8 Empty / New Character State
A brand-new level-1 character has 0 invested points in either tree. The Skill Book shows:
- Both spec tabs at "(0 pts)"
- All 4 attack slots already populated with the class's spec primaries (LMB defaults to Spec 1 primary, RMB defaults to Spec 2 primary, so the player can immediately try both spec attack styles before deciding)
- A small banner at the top: "Welcome! You earn 1 skill point per level. Spend them in either tree — try both attacks first to see which playstyle you prefer. Your first respec is free."

### 6.9 Hybrid Build Visualization
For a hybrid player (points in both trees), the inactive tab still shows the invested point count in its label (e.g., `[ ⚔ BERSERKER (6 pts) ]`), so the player always knows their split at a glance without switching tabs.

---

## 7. TRAINER UI (Respec Only)

Accessed by interacting with the Trainer NPC at camp. The Trainer **does not sell or upgrade skills** — all skill progression happens in the Skill Book (K) by spending skill points earned at level-up. The Trainer's only function is **respec**.

```
┌──────────────────────────────────────────────────────────────────┐
│                       TRAINER                            [X]    │
│  Gold: 342                                                       │
│                                                                  │
│  "Need a fresh start? I can help you re-allocate your points.   │
│   To learn and improve skills, open your Skill Book (K)."       │
│                                                                  │
│  ┌─ SKILL TREE RESPEC ──────────────────────────────────────┐   │
│  │                                                          │   │
│  │  Refunds all spent skill points. Your action bar         │   │
│  │  attack assignments are preserved.                       │   │
│  │                                                          │   │
│  │  Current investment:                                     │   │
│  │    ⛨  Guardian:    12 points                             │   │
│  │    ⚔  Berserker:    6 points                             │   │
│  │       Available:    4 points                             │   │
│  │       ─────────────────────                              │   │
│  │       Total:       22 points  (Lv 17)                    │   │
│  │                                                          │   │
│  │  Cost: 425g     ( player level × 25 )                    │   │
│  │  ★ FIRST RESPEC IS FREE ★                                │   │
│  │                                                          │   │
│  │                                       [ RESPEC TREE ]    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─ ATTRIBUTE RESPEC ───────────────────────────────────────┐   │
│  │                                                          │   │
│  │  Refunds all spent attribute points so you can           │   │
│  │  re-allocate STR / INT / AGI / STA.                      │   │
│  │                                                          │   │
│  │  Current attributes:                                     │   │
│  │     STR  8        INT  3                                 │   │
│  │     AGI  5        STA  6                                 │   │
│  │                                                          │   │
│  │  Cost: 255g     ( player level × 15 )                    │   │
│  │                                                          │   │
│  │                                  [ RESPEC ATTRIBUTES ]   │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─ INFO ───────────────────────────────────────────────────┐   │
│  │  💡 To learn new skills or improve attacks, open your    │   │
│  │     Skill Book (K). You earn 1 skill point per level.    │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### 7.1 Respec Confirmation
Both respec buttons trigger a confirmation popup before charging gold:

```
┌──────────────────────────────────────┐
│         CONFIRM RESPEC               │
│                                      │
│  This will refund all 22 spent       │
│  skill points. You'll need to        │
│  re-spend them in the Skill Book.    │
│                                      │
│  Cost: 425g                          │
│                                      │
│       [ CANCEL ]   [ CONFIRM ]       │
└──────────────────────────────────────┘
```

If `freeRespecUsed === false`, the cost line shows `Cost: FREE (one-time)` and the confirm button is highlighted gold.

### 7.2 Trainer States
- **No points spent**: The "Skill Tree Respec" section shows "Nothing to refund yet — spend some points in the Skill Book first." The button is grayed out.
- **Cannot afford**: Button text turns red and shows "Need 425g (have 342g)". Disabled.
- **Free respec available**: Gold star badge ★ on the Tree Respec section, button highlighted gold.
- **After confirming**: Gold deducted (or `freeRespecUsed` flag set), all tree nodes refunded, brief gold-coin animation flying to the player's gold counter, screen briefly dims, Skill Book opens automatically so the player can immediately re-spend.
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
