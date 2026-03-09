# Animations & Rendering Dev Guide

This guide explains how sprite rendering works in the sp-client, including the `GameAsset` system, animation types, visual effects, and player appearance composition.

---

## GameAsset Overview

`GameAsset` (`src/game/objects/GameAsset.ts`) is the base drawable object for all sprites in the game. It wraps a Phaser `Sprite` and adds:

- **Pivot-based positioning** — Sprites use per-frame pivot data from `.spr` files for correct placement
- **Animation types** — Different frame playback behaviors (full sheet, directional, sub-frame)
- **Visual effects** — Glare, glow, tint, berserk overlay, chilled tint
- **Shadows** — Optional shadow rendering via `ShadowManager`
- **Debug visualization** — Frame bounds, pivot points, and hover info when debug mode is enabled

---

## GameAsset Configuration

`GameAssetConfig` controls how a sprite is created and animated:

| Option | Type | Description |
|--------|------|-------------|
| `x`, `y` | `number` | Position in pixel coordinates |
| `spriteName` | `string` | Sprite file name (without extension) |
| `spriteSheetIndex` | `number?` | Index of the sprite sheet within the file. Required unless `mapObject` is true |
| `mapObject` | `boolean?` | Legacy index-based texture lookup for map tiles (e.g. `map-tile-100`) |
| `direction` | `number?` | Direction index (0–7) for directional sprites |
| `framesPerDirection` | `number?` | Frames per direction (default: 8) |
| `frameIndex` | `number?` | Fixed frame to display (static mode; no animation) |
| `alpha` | `number?` | Transparency (0–1) |
| `tint` | `number?` | Hex tint color |
| `frameRate` | `number?` | Animation frame rate (default: 10) |
| `animationType` | `AnimationType?` | See [Animation Types](#animation-types) below |
| `animationFrameStartIndex` | `number?` | Start frame for `SubFrame` animations (default: 0) |
| `isLooping` | `boolean?` | Whether animation loops (default: true) |
| `onAnimationFrameChange` | `(relativeFrameIndex: number) => void` | Callback when animation advances to a new frame |
| `effects` | `Effect[]?` | Item effects (glare, glow, tint) for equipped visuals |

---

## Animation Types

`GameAsset` supports three animation behaviors via `AnimationType`:

### FullFrame

Plays the full range of frames in the sprite sheet. Used for:

- Human body (one sprite sheet per state+direction)
- Weapons (one sheet per armament state+direction)
- Accessories (angelic states)

No frame limiting; Phaser animates through all frames in the texture.

### DirectionalSubFrame

Plays only frames within a direction’s range. Used for:

- Player equipment (armor, hauberk, leggings, boots, helm, cape)
- Shield
- Hair
- Underwear

Each direction has 8 frames (configurable via `framesPerDirection`). When the animation advances past the direction’s end frame, it wraps back to the start or stops if non-looping.

### SubFrame

Plays a sub-range with a custom start index. Used for:

- Fire Wyvern attack (frames 4–8 instead of 0–4)

`animationFrameStartIndex` shifts the effective frame range. Frame limiting keeps playback within that range.

---

## Pivot Points

Sprites use pivot data from `.spr` files. Each frame can define `pivotX` and `pivotY` relative to the top-left of the frame. `GameAsset`:

1. Positions the sprite at `(baseX, baseY)`
2. On each frame change, applies `(baseX + pivotX, baseY + pivotY)` as the sprite’s position

This aligns sprites correctly regardless of frame size. Pivot data is loaded via `getPivotData()` from the registry.

---

## Visual Effects

### Item Effects (equipped gear)

- **GLARE** — Additive overlay with oscillating alpha (e.g. Dark Knight Templar Sword). Color via `effectColor` (default `0x0000ff`).
- **GLOW** — Phaser FX glow with oscillating outer strength. Color via `effectColor` (default `0xffffff`).
- **TINT_APPEARANCE** — Multiply tint on the sprite. Color via `effectColor`.

Glare and glow share an oscillation tween (1200ms, sine ease, yoyo). Call `setItemEffects(effects)` when equipped items change.

### Status Effects

- **Berserk** — Red additive overlay (constant alpha). Rendered under glare. Excludes weapon, shield, accessory.
- **Chilled** — Blue tint (`0x88aaff`). Applied after other effects; when removed, restores tint from item effects.

### Ghost Sprite (trail effect)

During movement, `updateGhostSprite(visible, offsetX, offsetY)` creates a semi-transparent copy behind the main sprite. The ghost syncs frame with the main sprite and uses alpha 0.4 and tint `0x666666`.

---

## Shadows

- **ShadowManager** — For sprites in `SPRITES_WITH_SHADOWS` (Config), a shadow is drawn beneath the asset. Position and depth follow the main sprite.
- **Tree shadows** — Trees (sprite indices 100–145) get a dedicated tree shadow `GameAsset` (index + 50), offset by (16, 16) and drawn below the tree.

---

## Playing Animations

Use `playAnimationWithDirection()` to switch animations:

```ts
asset.playAnimationWithDirection(
  animationKey,      // e.g. "sprite-wm-0"
  direction,         // 0–7
  frameRate,
  relativeFrame?,   // Start frame within direction (0–7)
  repeat?,          // 0 = play once, undefined = loop
  framesPerDirection?,
  animationType?,
  animationFrameStartIndex?,
  isLooping?
);
```

This updates direction frame ranges, pivot data, and plays the animation. Overlays (glare, berserk) stay in sync with the main sprite’s frame.

---

## Player Appearance Rendering

`PlayerAppearanceManager` (`src/utils/PlayerAppearanceManager.ts`) composes the player from multiple `GameAsset` layers. Each layer is a separate sprite (human, hair, underwear, armor, weapon, shield, etc.) stacked in a specific order.

### Gear Slots and Render Order

Render order depends on **direction** and **run state**:

- Base layers: `human` → `hair` → `underwear` → `hauberk` → `leggings` → `boots` → `helm` → `armor`
- Cape, weapon, shield order varies by direction (e.g. shield before weapon when facing certain directions)
- Accessory is always last

`getGearRenderOrder(direction, isRunning)` returns the slot order for a given view.

### State-to-Sprite Mapping

Each `PlayerState` maps to sprite sheet indices:

| State | Human base index | Armour base index | Frames |
|-------|-------------------|-------------------|--------|
| IdlePeaceMode | 0 | 0 | 8 |
| IdleCombatMode | 8 | 1 | 8 |
| WalkPeaceMode | 16 | 2 | 8 |
| WalkCombatMode | 24 | 3 | 8 |
| Run | 32 | 4 | 8 |
| BowStance | 40 | 5 | 8 |
| MeleeAttack | 48 | 6 | 8 |
| BowAttack | 56 | 7 | 8 |
| Cast | 64 | 8 | 16 |
| PickUp | 72 | 9 | 4 |
| TakeDamage | 80 | 10 | 4 |
| Die | 88 | 11 | 8 |
| CastReady | 8 | 1 | 8 |

### Per-Slot Animation Config

| Slot | Animation type | Sprite sheet logic |
|------|----------------|--------------------|
| **human** | FullFrame | `HUMAN_SPRITESHEET_BASE[state] + direction` |
| **weapon** | FullFrame | `base + ARMAMENT_STATE_INDEX[state] * 8 + direction` |
| **shield** | DirectionalSubFrame | `base + effectiveStateIndex`; direction selects sub-frames |
| **armor, hauberk, leggings, boots, helm, cape** | DirectionalSubFrame | `ARMOUR_SPRITESHEET_BASE[state]`; direction selects sub-frames |
| **hair** | DirectionalSubFrame | `hairStyleIndex * 12 + ARMOUR_SPRITESHEET_BASE[state]` |
| **underwear** | DirectionalSubFrame | `underwearColorIndex * 12 + ARMOUR_SPRITESHEET_BASE[state]` |
| **accessory** | FullFrame | Angelic state mapping; `angelicState * 8 + direction` |

### Building Player Assets

`PlayerAppearanceManager.buildAssetConfigs(direction, state, gear)` returns:

- `configs` — Array of `GameAssetConfig` (without `x`, `y`) for each visible layer
- `assetIndices` — Indices into `configs` for each slot (weapon, shield, armor, etc.)

The parent (e.g. `Player`) creates `GameAsset` instances from these configs and passes them to `PlayerAppearanceManager`. The manager then drives animations and visibility via `applyStateAppearance()` and `updateAssetPositions()`.

### Appearance Updates

- **applyAppearanceChange()** — Updates gender, skin color, equipped items, underwear/hair indices. Refreshes sprite names, visibility, and effects.
- **applyStateAppearance()** — Switches to a new `PlayerState` and direction. Plays the correct animation on each asset with the right frame rate and repeat.
- **updateAssetPositions()** — Sets position for all assets; optionally enables ghost trail during movement.
- **updateDepth()** — Sets depth from world Y and slot order so layers render correctly.

### Effects on Player

- **setChilledEffect()** — Blue tint on all assets
- **setBerserkEffect()** — Red overlay on body and equipment (not weapon, shield, accessory)
- **setTransparency()** — Alpha 0–100 on all assets

---

## Debug Mode

When debug mode is enabled (registry key), `GameAsset`:

- Makes sprites interactive for hover detection
- Draws a green rectangle around frame bounds
- Draws a red crosshair at sprite position, blue at pivot
- Emits `OUT_UI_HOVER_SPRITE_FRAME_DEBUG` with frame index, pivot, position, sprite name, etc.

The React layer consumes this event to show debug overlays.
