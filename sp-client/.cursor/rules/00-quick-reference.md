# MMORPG Base Game - Quick Reference

Phaser 3 MMORPG client with React + TypeScript. See sub-files for details.

## Common Tasks

**Add sprite:** Add to `constants/Assets.ts` ASSETS (assetType: SPRITE or TILE_SPRITE). Traditional loading: `LoadingScreen.preload()` loads; `create()` parses via `HBSpriteFile`. ZIP loading: `create()` handles fetch, decompress, parse. `getCreatePhaseTotalActivities()` derives total from ASSETS. See `02-sprites-and-assets.md`, [ASSET_LOADING.md](../../docs/ASSET_LOADING.md).

**Add map:** Add to `constants/Assets.ts` ASSETS array (assetType: MAP). Map auto-loads via `getMapNames()`. See `03-map-system.md`, [MAP_RENDERING.md](../../docs/MAP_RENDERING.md).

**Add UI control:** Store in `ui/store/`, emit `IN_UI_*` events, listen in scene. Use `notifyPhaser: false` in OUT_UI listeners. See `05-ui-layer.md`, [UI_LAYER.md](../../docs/UI_LAYER.md).

**Access game state:** `getGameStateManager(game)` from `RegistryUtils.ts`. Never cast with `as`.

**Coordinates:** `convertWorldPosToPixelPos`, `convertPixelPosToWorldPos` (CoordinateUtils.ts). Direction: `getNextDirection`, `getDirectionFromScreenSector`.

**Create game object:** Extend `GameObject`, implement `switchState()`. See `06-core-systems.md`, [PLAYER_MECHANICS.md](../../docs/PLAYER_MECHANICS.md), [MONSTER_MECHANICS.md](../../docs/MONSTER_MECHANICS.md).

**Floating text (damage numbers):** Use `FloatingText` class with `FloatingTextConfig`. Depth: `FLOATING_TEXT_DEPTH`.

**Shadows:** Add sprite name to `SPRITES_WITH_SHADOWS` in Config.ts (static map objects only).

**Spatial audio:** Use `calculateSpatialAudio()` from SpatialAudioUtils.ts. See Monster.ts implementation.

## Key Paths

- **Config:** `Config.ts`, `constants/EventNames.ts`, `constants/Assets.ts`, `constants/Maps.ts`, `constants/RegistryKeys.ts`
- **Scenes:** `Boot.ts`, `LoadingScreen.ts`, `LoginScreen.ts`, `GameWorld.ts`
- **Objects:** `GameObject.ts`, `Player.ts`, `Monster.ts`, `NPC.ts`, `GroundItem.ts`, `GameAsset.ts` (in objects/)
- **Effects:** `CriticalStrikeProjectile.ts`, `FloatingText.ts` (in game/effects/). **Spells:** `game/spells/` (EarthShockWave, LightningBolt, Blizzard, etc.)
- **Assets:** `HBSprite.ts`, `HBMap.ts` (in game/assets/)
- **Utils:** `RegistryUtils.ts`, `CoordinateUtils.ts`, `GameStateManager.ts`, `MapManager.ts`, `CameraManager.ts`, `InputManager.ts`, `SpatialGrid.ts`, `ShadowManager.ts`, `SpatialAudioUtils.ts`, `SoundTracker.ts`, `MusicManager.ts`, `SoundManager.ts`, `InventoryManager.ts`, `LootManager.ts`, `CastManager.ts`
- **UI:** `App.tsx`, `PhaserGame.tsx`, `ui/dialogs/`, `ui/overlays/`, `ui/store/`, `ui/components/`, `ui/rpg-ui.css`

## Architecture

**Stack:** Phaser 3, React, TypeScript, @tanstack/react-store, Vite

**Events:** `IN_UI_*` (React→Phaser), `OUT_UI_*` (Phaser→React), no prefix (intra-Phaser). All in `EventNames.ts`. EventBus in `game/EventBus.ts`. Use EventBus for intra-Phaser—no direct refs.

**Coords:** World = integer tiles. Pixel = 32px/tile (`TILE_SIZE`). Depth: `worldY * DEPTH_MULTIPLIER` (100) for objects; offsets scaled by 10. Tiles: -10000. See Config.ts.

## Config Constants (Config.ts)

`GENERATE_MINIMAP`, `DEFAULT_MOVEMENT_SPEED` (80), `MONSTER_DEFAULT_MOVEMENT_SPEED` (50), `MONSTER_DEFAULT_ATTACK_SPEED` (50), `DEFAULT_PLAYER_ATTACK_SPEED`, `DEFAULT_PLAYER_ATTACK_RANGE`, `PLAYER_STUNLOCK_DURATION_MS` (100), `MONSTER_STUNLOCK_DURATION_MS` (500), `KNOCKBACK_DURATION_MS` (100), `MOVEMENT_COMMAND_THROTTLE_MS` (100), `MAX_SPATIAL_AUDIO_DISTANCE` (20), `MONSTER_MAX_FOLLOW_DISTANCE` (20), `MAX_MONSTER_ATTACK_RANGE` (10), `SPRITES_WITH_SHADOWS`, `DEPTH_MULTIPLIER` (100), `FLOATING_TEXT_DEPTH`, `HIGH_DEPTH`, `LOADING_OVERLAY_DEPTH`, `MAP_OBJECT_COLLISION_*`, `PLAYER_HEALTH_BAR_*`, `DIALOG_*`

## Style Patterns (only patterns—see 01-code-guidelines for full rules)

- Registry: Use helpers from RegistryUtils.ts, never `as` cast
- Fallible operations: Wrap in try-catch, log warning with debugging data
- Events: Use EventNames.ts constants; use typed payloads (interfaces in Types.ts) for EventBus emit/on
- Coordinates: Use CoordinateUtils.ts conversion functions
- Cleanup: EventBus.off → registry.off → destroy objects → clear refs

## Sub-Files

- `01-code-guidelines.md` - Coding standards
- `02-sprites-and-assets.md` - Sprites, GameAsset, HBSprite
- `03-map-system.md` - HBMap, rendering, highlighting
- `04-movement-system.md` - Movement, pathfinding
- `05-ui-layer.md` - React UI, stores, EventBus
- `06-core-systems.md` - GameObject, Player, Monster, managers
- `07-debug-and-troubleshooting.md` - Debug mode, tips

## Dev Guides (sp-client/docs/)

Detailed mechanics: [ASSET_LOADING](../../docs/ASSET_LOADING.md), [SPRITE_FILE_FORMAT](../../docs/SPRITE_FILE_FORMAT.md), [ANIMATIONS_RENDERING](../../docs/ANIMATIONS_RENDERING.md), [MAP_RENDERING](../../docs/MAP_RENDERING.md), [MOVEMENT_SYSTEM](../../docs/MOVEMENT_SYSTEM.md), [CAMERA_SYSTEM](../../docs/CAMERA_SYSTEM.md), [SHADOWS_RENDERING](../../docs/SHADOWS_RENDERING.md), [AUDIO_SYSTEM](../../docs/AUDIO_SYSTEM.md), [UI_LAYER](../../docs/UI_LAYER.md), [INPUT_HANDLING](../../docs/INPUT_HANDLING.md), [PLAYER_MECHANICS](../../docs/PLAYER_MECHANICS.md), [MONSTER_MECHANICS](../../docs/MONSTER_MECHANICS.md), [INVENTORY_AND_LOOT_MECHANICS](../../docs/INVENTORY_AND_LOOT_MECHANICS.md), [SPELLS_AND_EFFECTS_MECHANICS](../../docs/SPELLS_AND_EFFECTS_MECHANICS.md), [GENERATING_MINIMAP_SNAPSHOTS](../../docs/GENERATING_MINIMAP_SNAPSHOTS.md).
