# Map System

Map loading, rendering, interaction. See `00-quick-reference.md` for add flow. For details: [MAP_RENDERING](../../docs/MAP_RENDERING.md), [GENERATING_MINIMAP_SNAPSHOTS](../../docs/GENERATING_MINIMAP_SNAPSHOTS.md).

## MapManager

`MapManager.ts` manages map loading, rendering, and minimap capture. Created in GameWorld. `getCurrentMap()`, `startMinimapCapture(finishedCallback)`, `getIsCapturingMinimap()`, `resetCapturingState()`. Uses `getMap()`, `getCachedMinimap()`, `setCachedMinimap()` from Registry. Integrates with CameraManager for bounds/zoom during minimap capture.

## HBMap (.amd format)

Header: MAPSIZEX, MAPSIZEY, TILESIZE. Tiles: 9 bytes each (ground sprite/frame, object sprite/frame, flags). Flags: bit 7 = blocked, bit 6 = teleport, bit 5 = farmable. Water = sprite 19.

**HBMap** (`game/assets/HBMap.ts`): `getTile(x,y)`, `isTileOccupied()`, `setTileOccupied()`. Tile occupancy managed by GameObject lifecycle.

## Rendering

- **Ground:** `renderMapTiles(scene)` – tileset texture `{mapFileName}-tileset`, tilemap layer depth -1000
- **Objects:** `renderMapObjects(scene, includeTrees?)` – GameAssets, SpatialGrid registration
- **Destruction:** `destroyMapTiles()`, `destroyMapObjects()`
- MapManager orchestrates load → render → minimap capture (if `GENERATE_MINIMAP`)

## Cell Highlighting

`enableNonMovableCellsHighlight()` (red=blocked, orange=occupied), `enableTeleportCellsHighlight()` (blue), `enableWaterCellsHighlight()` (purple), `enableFarmableCellsHighlight()` (brown), `enableGridDisplay()`, `updateHoverCell()`. Static vs dynamic split for perf (~600x improvement).

## SpatialGrid, Depth, Transparency

SpatialGrid: `getNearby(pixelX, pixelY, radius)`. Y-based depth. Map object transparency when player behind—see `handleMapObjectCollisions` in GameWorld.

## Maps Source

Maps from `constants/Assets.ts` ASSETS array (assetType: MAP). `getMapNames()` in Maps.ts. Map files in `public/maps/`.
