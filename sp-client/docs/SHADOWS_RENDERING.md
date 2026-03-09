# Shadows Rendering Dev Guide

This guide explains how shadows are rendered beneath game objects using `ShadowManager`, including static map objects, the player, and monsters.

---

## Overview

Shadows provide depth visualization by rendering a flattened, semi-transparent sprite beneath objects. The system supports:

- **Static map objects** — Shadows for map tiles (e.g. objects, trees) via `GameAsset`
- **Player** — Animated shadow synced with movement, combat, and idle states
- **Monsters** — Animated shadow synced with idle, move, attack, and take-damage states

All shadows use the same `ShadowManager` utility with two modes: **map objects** (static, legacy texture lookup) and **animated sprites** (sprite-sheet based, synced with object animation).

---

## ShadowManager (`src/utils/ShadowManager.ts`)

### Configuration

```typescript
type ShadowConfig = {
    scene: Scene;
    shadowSpriteName: string;      // e.g. 'wm', 'ettin', 'map-tile-223'
    shadowSpriteSheetIndex: number;
    worldX: number;
    worldY: number;
    offsetX?: number;
    offsetY?: number;
    frameRate?: number;            // default 10
    mapObject?: boolean;           // default false — legacy index-based lookup
    frameIndex?: number;           // for static map object shadows
};
```

### Shadow Appearance

Shadows are created with these transformations:

| Property | Value | Purpose |
|----------|-------|---------|
| Rotation | -π/4 (-45°) | Isometric projection (flat on ground) |
| Scale | (1.0, 0.5) | Flattened height for ground appearance |
| Alpha | 0.5 | Semi-transparent |
| Tint | 0x000000 | Pure black |
| Origin | (0.5, 1.0) | Bottom-center anchor |

### Texture and Animation

- **Map objects** (`mapObject: true`): Texture key = `shadowSpriteName` (e.g. `map-tile-223`). Static frame via `frameIndex`; no animation.
- **Animated sprites** (`mapObject: false`): Texture key = `sprite-${shadowSpriteName}-${shadowSpriteSheetIndex}`. Plays animation synced with object.

### Position Updates

Two methods:

1. **`setWorldPosition(worldX, worldY)`** — Uses world grid coordinates plus pivot data. Called by `GameObject` subclasses (Player, Monster).
2. **`updatePositionFromSprite(spriteX, spriteY, pivotX, pivotY, frameWidth, frameHeight)`** — Positions shadow at object’s bottom-center. Called by `GameAsset` for map objects.

### Depth

`updateDepth(objectDepth)` sets shadow depth to `objectDepth - 5` so it renders just below the object.

### Animation Sync

For animated objects, `updateAnimation()`:

- Switches sprite sheet index (state/direction)
- Optionally sets `startFrame`, `endFrame`, `repeat`, `playFromFrame`
- Keeps shadow in sync with object when switching animations (e.g. Idle ↔ Move)

---

## Static Map Objects (GameAsset)

### Where Shadows Are Created

Map objects are `GameAsset` instances created by `HBMap.renderMapObjects()`. Shadows are created in `GameAsset.drawShadowIfNecessary()` when the sprite name is in `SPRITES_WITH_SHADOWS` (see `Config.ts`).

### Configuration

```typescript
// Config.ts
export const SPRITES_WITH_SHADOWS: readonly string[] = ['map-tile-223'] as const;
```

Add sprite names to this array to enable shadows for map objects.

### Creation Flow

1. `HBMap.renderMapObjects()` creates `GameAsset` with `mapObject: true`, `spriteName: map-tile-${tile.objectSprite}`, `frameIndex: tile.objectSpriteFrame`.
2. `GameAsset` constructor calls `drawShadowIfNecessary()`.
3. If `spriteName` is in `SPRITES_WITH_SHADOWS`, a `ShadowManager` is created with:
   - `mapObject: true`
   - `shadowSpriteSheetIndex: 0`
   - `frameIndex` from the tile

### Position and Depth

`GameAsset` calls `updateShadowPosition()` and `updateShadowDepth()` when:

- The asset’s position changes (`setPosition`)
- The asset’s depth changes (`setDepth`)

`updateShadowPosition()` uses `updatePositionFromSprite()` with the sprite’s current position and frame dimensions.

---

## Player (`src/game/objects/Player.ts`)

### Creation

```typescript
this.shadowManager = new ShadowManager({
    scene,
    shadowSpriteName: this.appearanceManager.getHumanSpriteName(),
    shadowSpriteSheetIndex: initialShadowSpriteSheetIndex,
    worldX,
    worldY,
    frameRate: this.IDLE_FRAME_RATE,
});
```

### State Sync

`PlayerAppearanceManager.updateShadow()` is called from `switchPlayerState()`:

```typescript
this.appearanceManager.updateShadow(this.shadowManager, this.currentState, this.direction, {
    movementFrameRate: this.frameRate,
    attackSpeed: effectiveAttackSpeed,
    castSpeed: this.castSpeed,
    idleFrameRate: this.IDLE_FRAME_RATE,
});
```

This updates the shadow’s sprite sheet index and frame rate to match the current player state (Idle, Run, MeleeAttack, etc.) and direction.

### Position and Depth

`Player` overrides `updatePixelPosition()` and calls `updateShadowPosition()` and `updateShadowDepth()` after updating asset positions. The base `GameObject.updateShadowPosition()` uses `setWorldPosition()` and `setOffset()` with the player’s world coordinates and movement offset.

### Gender / Appearance Changes

When gender or skin color changes, `PlayerAppearanceManager.applyAppearanceChange()` calls `shadowManager.updateShadowSprite(spriteName, shadowSpriteSheetIndex)` to switch the shadow sprite.

### Death and Resurrection

- On death: `shadowManager.destroy()` and `shadowManager = undefined`.
- On resurrection: a new `ShadowManager` is created with the current human sprite and idle state.

---

## Monster (`src/game/objects/Monster.ts`)

### Creation

Monsters create a shadow only when `MonsterShadow.BodyShadow` is used (default):

```typescript
if (shadowOption === MonsterShadow.BodyShadow) {
    const initialShadowSpriteSheetIndex = MONSTER_SPRITESHEET[MonsterState.Idle] + config.direction;
    this.shadowManager = new ShadowManager({
        scene,
        shadowSpriteName: config.spriteName,
        shadowSpriteSheetIndex: initialShadowSpriteSheetIndex,
        worldX: config.x,
        worldY: config.y,
        frameRate: idleFrameRate,
    });
}
```

Use `MonsterShadow.NoShadow` in config to disable shadows.

### State Sync

`updateShadow()` is called from `switchMonsterState()`:

- Computes `shadowSpriteSheetIndex` from `getStateAnimationConfig()` + direction
- Uses `getAnimationFrameRate()` for the current state
- Sets `repeat: 0` for Attack, Dead, TakeDamage, TakeDamageOnMove, TakeDamageWithKnockback
- Uses `playFromFrame` from the monster’s current relative frame to avoid flicker when switching Idle ↔ Move

### Position and Depth

Monsters use the base `GameObject` flow: `updatePixelPosition()` → `updateShadowPosition()` → `updateShadowDepth()`.

### Death

On death, `startDeathAnimation()` destroys the shadow manager before switching to the death animation.

---

## GameObject Integration

`GameObject` provides the shared shadow plumbing:

| Member | Purpose |
|--------|---------|
| `protected shadowManager?: ShadowManager` | Optional shadow manager |
| `protected updateShadowPosition()` | `setWorldPosition(worldX, worldY)` + `setOffset(offsetX, offsetY)` |
| `protected updateShadowDepth()` | `updateDepth(getDepth())` |

`updatePixelPosition()` calls both, so any `GameObject` with a `shadowManager` gets its shadow updated during movement and position changes.

`GameObject.destroy()` calls `shadowManager.destroy()` when present.

---

## Adding Shadows to New Objects

### For a new GameObject subclass (e.g. NPC)

1. In the constructor, create a `ShadowManager` with the appropriate `shadowSpriteName` and `shadowSpriteSheetIndex`.
2. Assign it to `this.shadowManager`.
3. Call `updatePixelPosition()` after creation (or ensure it’s called in your update flow).
4. When state/direction changes, call `shadowManager.updateAnimation()` with the new sprite sheet index and frame rate.
5. In `destroy()`, call `super.destroy()` so `GameObject` cleans up the shadow.

### For a new map object sprite

1. Add the sprite name (e.g. `map-tile-XXX`) to `SPRITES_WITH_SHADOWS` in `Config.ts`.
2. Map objects using that sprite will automatically get shadows via `GameAsset.drawShadowIfNecessary()`.

---

## Coordinate and Pivot Notes

- World coordinates use the map grid (cells). Pixel coordinates use `convertWorldPosToPixelPos()` (×32).
- Shadow position accounts for pivot data from the sprite’s `.act` file via `getPivotData()`.
- Shadow origin is bottom-center (0.5, 1.0); the shadow is positioned so its bottom-center aligns with the object’s bottom-center.
