# Debug and Troubleshooting

For system mechanics and implementation details, see [sp-client/docs/](../../docs/) (MAP_RENDERING, MOVEMENT_SYSTEM, PLAYER_MECHANICS, etc.).

## Debug Mode

Toggle via Map Dialog. Registry key from `constants/RegistryKeys.ts`: `DEBUG_KEY`. `isDebugModeEnabled(scene)`, `setDebugModeEnabled(scene, enabled)`. GameAsset shows frame bounds (green), sprite position (red), pivot (blue) on hover. AssetDebugOverlay shows debug info panel. Depth 20000.

## Map Debug

Cell highlights: non-movable (red/orange), teleport (blue), water (purple), farmable (brown). Grid display. Hover cell. See `03-map-system.md`.

## Quick Checks

**Sprite not rendering:** `textures.exists()`, depth, LoadingScreen preload, pivot data.

**Animation not playing:** `anims.exists()`, sprite type (not Tiles/Interface), frame rate, paused.

**Player can't move:** `tile.isMoveAllowed`, bounds, `findMovableLocation()`.

**Events not firing:** EventNames constant, listener timing, cleanup.

**Memory leak:** EventBus.off, registry.off, destroy(), clear refs.

**Position wrong:** GameAsset, pivot data, CoordinateUtils.ts conversion.

**State not persisting:** `saveGameState()` called, localStorage, load in init.

**Transparency wrong:** SpatialGrid, collision radius, depth.

## Console Access

`window.game`, `scene.registry.get()`, `map.getTile()`, `map.enableNonMovableCellsHighlight(scene)`. Use Registry helpers (`getMap()`, `getGameStateManager()`, etc.) instead of raw registry when possible.
