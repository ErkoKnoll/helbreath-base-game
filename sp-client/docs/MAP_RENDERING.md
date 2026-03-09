# Map Loading & Rendering Dev Guide

This guide explains how Helbreath maps (`.amd` files) are loaded, how map tiles and static objects are rendered in multiple passes, and how sprite indexes map to textures.

---

## Map Loading (HBMap.ts)

### File Format (.amd)

The `.amd` format consists of:

1. **Header (256 bytes)** — ASCII text with key-value pairs:
   - `MAPSIZEX = <value>` — Map width in tiles
   - `MAPSIZEY = <value>` — Map height in tiles
   - `TILESIZE = <value>` — Bytes per tile (typically 9)

2. **Tile data** — Sequential tile records in row-major order (Y then X). Each tile is `TILESIZE` bytes.

### Tile Data Layout (per tile)

| Bytes | Type   | Field             | Description                          |
|-------|--------|-------------------|--------------------------------------|
| 0–1   | Int16  | `sprite`          | Ground tile sprite index              |
| 2–3   | Int16  | `spriteFrame`     | Ground tile frame index               |
| 4–5   | Int16  | `objectSprite`    | Object sprite index (0 = none)        |
| 6–7   | Int16  | `objectSpriteFrame` | Object frame index                 |
| 8     | byte   | flags             | Movement, teleport, farming, etc.     |

### Flags (byte 8)

- **Bit 7** (0x80): `1` = blocked, `0` = movement allowed
- **Bit 6** (0x40): `1` = teleport tile
- **Bit 5** (0x20): `1` = farming allowed

### Special Tiles

- **Water**: `sprite === 19`
- **Occupied**: `occupiedByGameObject` — set when a player/monster/NPC stands on the tile (used for collision and highlighting)

### Load Flow

1. `HBMap.load(scene)` — Reads binary from `scene.cache.binary.get(fileName)`
2. `parseMap(buffer)` — Parses header, then iterates Y×X to build `tiles[y][x]` as `HBMapTile` instances
3. Map buffer is removed from cache after parsing to free memory

---

## Map Tile Sprite Lookup

### Texture Key Convention

Map tiles use **legacy index-based** texture lookup. Sprite index `N` maps to texture key:

```
map-tile-{N}
```

Example: sprite index `19` → `map-tile-19`, sprite index `100` → `map-tile-100`.

### Tile Sprite Loading (HBSprite + Assets.ts)

Tile sprites are loaded from `.spr` files with a `tileStartIndex`:

| Asset              | File         | tileStartIndex | Texture range      |
|--------------------|--------------|----------------|--------------------|
| maptiles1          | maptiles1.spr | 0             | map-tile-0 … 49    |
| structures1        | structures1.spr | 50         | map-tile-50 … 69   |
| sinside1           | sinside1.spr | 70             | map-tile-70 … 99   |
| trees1             | trees1.spr   | 100            | map-tile-100 … 145 |
| treeshadows        | treeshadows.spr | 150       | map-tile-150 … 199 |
| objects1           | objects1.spr | 200            | map-tile-200 … 210 |
| …                  | …            | …              | …                  |

Each sprite sheet in a `.spr` file becomes one texture: `map-tile-${tileStartIndex + spriteSheetIndex}`. Frames within that texture are indexed 0, 1, 2, ….

### Tree Sprites

- **Trees**: sprite indices 100–145 (`isTreeSpriteIndex()`)
- **Tree shadows**: sprite index = tree index + 50 (e.g. tree 100 → shadow 150)

---

## Rendering Passes

Map rendering happens in **three passes**, orchestrated by `MapManager` and `GameWorld`:

### Pass 1: Ground Tiles (`renderMapTiles`)

Renders the ground layer using Phaser’s Tilemap API.

1. **Collect unique tiles** — Scan all tiles, build a set of `(sprite, spriteFrame)` pairs.
2. **Build tileset texture** — Create a canvas texture with one 32×32 tile per unique `(sprite, spriteFrame)`. Each tile is drawn from `map-tile-{sprite}` frame `{spriteFrame}`.
3. **Build tilemap data** — 2D array where each cell holds the tileset index (or -1 for empty).
4. **Create Phaser Tilemap** — `scene.make.tilemap()` with the data, add tileset, create layer at depth -1000.

Benefits: batching, culling, and efficient ground rendering.

### Pass 2: Non-Tree Objects (`renderMapObjects(scene, false)`)

Renders static map objects **except trees** (buildings, structures, etc.).

- Iterates all tiles with `objectSprite > 0`
- Skips sprites 6, 7, 9, 24 (legacy/duplicate tiles)
- Skips tree sprites (100–145)
- Creates `GameAsset` for each object:
  - `spriteName: map-tile-{objectSprite}`
  - `mapObject: true`
  - `frameIndex: objectSpriteFrame`
- Sets depth from `y * DEPTH_MULTIPLIER`
- Inserts objects into `SpatialGrid` for collision queries

### Pass 3: Trees (`renderMapObjects(scene, true)`)

Renders tree objects (sprite indices 100–145).

- Same logic as Pass 2, but only for tiles where `isTreeSpriteIndex(objectSprite)` is true
- Trees get a dedicated shadow `GameAsset` (tree index + 50)
- Called from `GameWorld`’s minimap capture callback, after Pass 1 and 2

**Order**: Ground → non-tree objects → trees, so trees render on top.

---

## GameWorld Integration

### Initialization Flow

1. `GameWorld.update()` — First frame: `drawLoadingOverlay()` then `mapManager.startMinimapCapture(callback)`.
2. **MapManager.startMinimapCapture**:
   - `map.renderMapTiles(scene)` — Pass 1
   - `map.renderMapObjects(scene)` — Pass 2 (non-trees)
   - `cameraManager.setBounds()`, `setZoom(1)`
   - Optionally plays map music
   - If minimap generation: `captureMinimap()` (zoom out, snapshot, cache)
   - Calls `finishedCallback(map)` when done
3. **GameWorld callback**:
   - `map.renderMapObjects(this, true)` — Pass 3 (trees)
   - `setupMap(map)` — Player, NPCs, camera, overlay removal
   - `EventBus.emit(OUT_MAP_LOADED)`

### Map Object Collision

When the player moves behind a map object (e.g. tree), that object is made semi-transparent (`MAP_OBJECT_COLLISION_ALPHA`). Uses:

1. **SpatialGrid** — Fast lookup of objects near the player
2. **Distance filter** — Keep only objects within `MAP_OBJECT_COLLISION_RADIUS_CELLS`
3. **Bounds intersection** — Pixel-perfect collision with player cell bounds
4. **Depth comparison** — If player depth < object depth, set object alpha

### Cleanup

On scene shutdown:

- `destroyAllHighlights()` — Removes debug overlays
- `destroyMapTiles(scene)` — Destroys tilemap, layer, and removes tileset texture from cache
- `destroyMapObjects()` — Destroys all `GameAsset` instances and clears `SpatialGrid`

---

## Debug & Highlighting

HBMap supports optional overlays (toggled from Map dialog):

| Overlay        | Color  | Condition                    |
|----------------|--------|------------------------------|
| Non-movable    | Red    | `!tile.isMoveAllowed`        |
| Occupied       | Orange | `tile.occupiedByGameObject && tile.isMoveAllowed` |
| Teleport       | Blue   | `tile.isTeleport`             |
| Water          | Purple | `tile.isWater`               |
| Farmable       | Brown  | `tile.isFarmingAllowed`       |
| Grid           | Black  | Cell boundaries              |
| Hover cell     | Green  | Cell under cursor (when grid enabled) |

Occupied cells are redrawn when occupancy changes; others are drawn once.
