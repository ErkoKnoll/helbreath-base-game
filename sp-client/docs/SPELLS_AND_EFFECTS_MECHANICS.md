# Spells and Effects Mechanics

This guide covers the spells and visual effects system: how spells are defined, how effects are configured, how `CastManager` orchestrates casting, and how to add new spells or effects.

---

## Overview

- **Spells** are identified by numeric ID and cast at world coordinates. They are defined in `constants/Spells.ts` and implemented in `game/spells/`.
- **Effects** are visual sprite animations (explosions, projectiles, buffs, etc.) defined in `constants/Effects.ts` and instantiated via the `Effect` class in `game/effects/Effect.ts`.
- **CastManager** (`utils/CastManager.ts`) listens for spell target confirmation, executes the appropriate spell class, and manages effect lifecycle (placement, cleanup).

---

## Spell Definitions

### `constants/Spells.ts`

Spells are defined by a numeric ID and display name:

```ts
export interface SpellConfig {
    id: number;
    name: string;
}

export const SPELL_ENERGY_BOLT_ID = 1;
export const SPELL_FIRE_BALL_ID = 2;
// ... more IDs

export const SPELLS: SpellConfig[] = [
    { id: SPELL_ENERGY_BOLT_ID, name: 'Energy Bolt' },
    { id: SPELL_FIRE_BALL_ID, name: 'Fire Ball' },
    // ...
];

export function getSpellById(id: number): SpellConfig | undefined;
```

Spells are cast at **world coordinates** (grid cells). The client receives `spellId`, `originPixelX/Y`, and `targetPixelX/Y` when the player confirms a target.

---

## Effect Definitions

### `constants/Effects.ts`

Effects are visual animations with a unique key, sprite reference, and optional sound/depth/fade settings:

```ts
export interface EffectConfig {
    name: string;
    key: string;                    // Unique lookup key (e.g. 'energy-bolt-explosion')
    sprite: string;                 // Sprite file name without extension (e.g. 'effect11')
    spriteSheetIndex: number;       // Index within the sprite file
    frameRate?: number;            // Default: 10
    animationFrames?: [number, number];  // [start, end] frame range
    sound?: string;                 // Sound file to play when effect spawns (spatial audio)
    depthOffset?: number;           // Added to depth (default +80). Negative = render behind
    fadeOutStartAnimationIndex?: number;  // Frame at which to start fading out
    drawLightRadius?: boolean;      // Draw light-radius overlay behind effect
    offsetX?: number;
    offsetY?: number;
}

export function getEffectByKey(key: string): EffectConfig | undefined;
```

Effect keys are exported as constants (e.g. `EFFECT_FIRE_BALL_EXPLOSION`, `ENERGY_BOLT_PROJECTILE`). Use `getEffectByKey(key)` to resolve config at runtime.

---

## Effect Class

### `game/effects/Effect.ts`

`Effect` plays a sprite animation at a pixel position and destroys when the animation completes (or loops forever if `infiniteLoop` is true).

**Create config:**

```ts
export type EffectCreateConfig = {
    config: EffectConfig;
    pixelX: number;
    pixelY: number;
    soundManager?: SoundManager;
    playerWorldX?: number;         // For spatial audio
    playerWorldY?: number;
    infiniteLoop?: boolean;        // Loop forever, don't auto-destroy
    onDestroy?: () => void;
    frameRate?: number;
    startAnimationFrame?: number;
    depthOffset?: number;
    usePlayerDepthForDepth?: boolean;  // For floating effects above player
};
```

**Key behavior:**

- Uses `EffectUtils.ensureEffectAnimation()` to create/cache Phaser animations from the effect config.
- Depth is `worldY * DEPTH_MULTIPLIER + depthOffset` (same as Player/Monster).
- Optional `fadeOutStartAnimationIndex` linearly fades alpha from 1→0 over remaining frames.
- `drawLightRadius` draws a light overlay (effect sheet 0 frame 1) behind the main effect.
- `setPosition(pixelX, pixelY)` updates position and depth for moving effects.

---

## EffectUtils

### `utils/EffectUtils.ts`

- **`drawEffect(scene, worldX, worldY, effectKey, options?)`** — Draws effect at world cell center (converts to pixel coords).
- **`drawEffectAtPixelCoords(scene, pixelX, pixelY, effectKey, options?)`** — Draws effect at exact pixel position.
- **`getTextureKeyFromEffectConfig(config)`** — Builds texture key `sprite-{sprite}-{spriteSheetIndex}`.
- **`ensureEffectAnimation(scene, textureKey, options)`** — Creates/caches Phaser animation for a frame range; returns anim key.

---

## CastManager

### `utils/CastManager.ts`

`CastManager` is the central orchestrator for casting and effects:

1. **Event listeners**
   - `IN_UI_CAST_EFFECT` — Sets a pending effect (effectKey + infiniteLoop) for placement on click.
   - `IN_UI_KILL_ALL_EFFECTS` — Destroys all tracked effects.
   - `PLAYER_CONFIRM_SPELL_TARGET` — Executes the spell when the player confirms a target.

2. **Pending effect flow**
   - UI emits `IN_UI_CAST_EFFECT` with `{ effectKey, infiniteLoop }`.
   - CastManager stores `pendingEffectKey` and `pendingEffectInfiniteLoop`, emits `OUT_UI_CAST_READY`.
   - When the player clicks in the world, `tryPlaceEffect(worldX, worldY)` is called.
   - If a pending effect exists, it draws the effect at that cell, registers it, clears pending, emits `OUT_UI_CAST_REMOVED`.

3. **Spell execution**
   - `PlayerConfirmSpellTargetEvent` contains: `spellId`, `originPixelX/Y`, `targetPixelX/Y`.
   - `executeSpell()` switches on `spellId` and instantiates the corresponding spell class with these coordinates and shared config (soundManager, playerWorldX/Y, cameraManager).

4. **Effect tracking**
   - Effects created by spells (e.g. Fire Wall, Poison Cloud) are registered via `getOnEffectCreated()`.
   - Each effect’s `onDestroy` callback removes it from the internal `effects` array.
   - `killAllEffects()` destroys all tracked effects (e.g. on map change).

---

## Spell Implementation Patterns

Spells in `game/spells/` follow several patterns:

### 1. Projectile spells (origin → target)

Examples: **EnergyBolt**, **FireBall**, **FireStrike**, **TripleEnergyBolt**, **MeteorStrike**

- Move a sprite or projectile from origin to target.
- On arrival, spawn an impact effect (e.g. `LightningBlast`, `EFFECT_FIRE_BALL_EXPLOSION`).
- Use `DirectionalProjectile` base class for directional sprites (Fire Ball, Fire Strike).
- Use custom logic for Energy Bolt (looping projectile frames) or Meteor (falling projectile).

### 2. Instant / beam spells (no projectile travel)

Examples: **LightningBolt**, **LightningStrike**, **MassLightningStrike**

- Draw procedural graphics (e.g. jagged lightning) or spawn effects immediately.
- Use timers for arc redraw and duration.

### 3. Area / field spells (target-only)

Examples: **ChillWind**, **MassChillWind**, **PoisonCloud**, **SpikeField**, **IceStorm**, **IceStrike**, **MassIceStrike**

- Target is a single cell; spell creates multiple effects in a pattern (droplets, 3×3 field, scattered shards).
- Some use `onEffectCreated` to register effects with CastManager for cleanup.

### 4. Line / cone spells (origin + target)

Examples: **Blizzard**, **MassBlizzard**, **EarthShockWave**, **BloodyShockWave**

- Compute a line or cone from origin toward target.
- Emit effects along the path ( shock wave nodes, blizzard shards) or at intervals.

### 5. Persistent effects

Examples: **FireWall**, **PoisonCloud**, **SpikeField**, **IceStorm**

- Use `infiniteLoop: true` for the effect animation.
- Use a duration timer to destroy the effect (e.g. 30 seconds).
- Pass `onEffectCreated` so CastManager tracks them for `killAllEffects()`.

---

## Adding a New Spell

1. **Define the spell** in `constants/Spells.ts`:
   - Add `SPELL_MY_SPELL_ID` and an entry in `SPELLS`.

2. **Add effect configs** in `constants/Effects.ts` (if needed):
   - Add keys and `EffectConfig` entries for any new visual effects.

3. **Implement the spell class** in `game/spells/`:
   - Create a class that takes `scene`, origin/target coords, and a config object.
   - Use `drawEffect`, `drawEffectAtPixelCoords`, or `new Effect()` for visuals.
   - For persistent effects, accept `onEffectCreated` and call it when creating each effect.

4. **Wire into CastManager** in `utils/CastManager.ts`:
   - Import the spell class and spell ID.
   - Add a `case SPELL_MY_SPELL_ID:` in `executeSpell()` that instantiates your spell with the event data.

---

## Adding a New Effect

1. **Add the effect config** in `constants/Effects.ts`:
   - Export a key constant (e.g. `EFFECT_MY_EFFECT = 'my-effect'`).
   - Add an `EffectConfig` to the `EFFECTS` array with `sprite`, `spriteSheetIndex`, `frameRate`, etc.

2. **Use the effect**:
   - Call `drawEffect(scene, worldX, worldY, EFFECT_MY_EFFECT, options)` or `drawEffectAtPixelCoords(...)`.
   - Or instantiate `new Effect(scene, { config: getEffectByKey(EFFECT_MY_EFFECT), pixelX, pixelY, ... })`.

---

## Coordinate Conventions

- **World coordinates** — Grid cell indices (integers). Used for spell targets, map cells.
- **Pixel coordinates** — Screen pixels. Used for drawing, projectiles, effects.
- Conversion: `convertWorldPosToPixelPos(worldX)` gives top-left of cell; add `TILE_SIZE / 2` for center.
- Conversion: `convertPixelPosToWorldPos(pixelX)` gives world cell containing that pixel.

---

## Shared Config Passed to Spells

Most spells receive:

- `soundManager` — For spatial audio.
- `playerWorldX`, `playerWorldY` — Listener position for spatial audio.
- `cameraManager` — For camera shake on impact (optional).
- `onEffectCreated` — For persistent spells, callback to register effects with CastManager.

---

## Related Files

| File | Purpose |
|------|---------|
| `constants/Spells.ts` | Spell IDs and config |
| `constants/Effects.ts` | Effect keys and config |
| `game/effects/Effect.ts` | Effect instance class |
| `game/effects/DirectionalProjectile.ts` | Base for directional projectile spells |
| `utils/EffectUtils.ts` | `drawEffect`, animation helpers |
| `utils/CastManager.ts` | Spell execution, effect placement, cleanup |
| `game/spells/*.ts` | Individual spell implementations |
| `Types.ts` | `PlayerConfirmSpellTargetEvent` |
