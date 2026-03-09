# Generating Minimap Snapshots

This guide explains how to capture full-resolution map images for creating pre-generated minimaps. Pre-generated minimaps load faster and are of better quality than on-demand generated ones and can be optimized for file size.

---

## Overview

Maps can use one of three minimap sources (see `constants/Assets.ts`):

| Source | Description |
|-------|-------------|
| `Minimap.ON_DEMAND_GENERATED` | Minimap is generated at runtime when the map loads (default) |
| `Minimap.PRE_GENERATED` | Minimap image is loaded from assets (faster, smaller) |
| `Minimap.NONE` | No minimap |

To create a pre-generated minimap, you capture the map as an image during load, post-process it, then add it to your assets.

---

## Step 1: Enable Map Snapshot Download

In `src/Config.ts`, set:

```ts
export const DOWNLOAD_MAP_SNAPSHOT = true;
export const MAP_SNAPSHOT_SHRINK_MULTIPLIER = 2;  // Use 3 for very large maps
```

| Config key | Purpose |
|------------|---------|
| `DOWNLOAD_MAP_SNAPSHOT` | When `true`, during minimap capture the scene (map tiles + objects) is rendered at higher resolution and downloaded as a PNG. |
| `MAP_SNAPSHOT_SHRINK_MULTIPLIER` | Shrinks the capture to avoid WebGL framebuffer size limits. Output size is `(mapWidth / multiplier) × (mapHeight / multiplier)`. Use `2` for most maps; use `3` for very large maps that exceed GPU limits. |

---

## Step 2: Load the Map

1. Ensure the map uses `Minimap.ON_DEMAND_GENERATED` in `constants/Assets.ts` (or omit `minimap`—it defaults to on-demand). If the map already has `Minimap.PRE_GENERATED`, temporarily change it to `ON_DEMAND_GENERATED` so the capture runs.
2. Run the client (`pnpm dev`).
3. Select a character and enter the game.
4. Travel to the map you want to capture (or ensure that map loads on login).
5. When the map loads, the browser will automatically download a file named `map-<mapName>-full.png`.

The snapshot is taken during the minimap capture phase, before the player or other entities are rendered.

---

## Step 3: Post-Process the Image

The raw PNG can be large. To create an optimized minimap image:

1. Upload the downloaded image to [Squoosh](https://squoosh.app/editor).
2. Set **MozJPEG Quality** to `50`.
3. Resize using the **Triangle (bilinear)** method to `1500×1500` (or your desired dimensions).
4. Export and save the result.

---

## Step 4: Add the Minimap to Assets

1. Place the processed image in `public/assets/images/minimaps/` as `<mapname>.jpg` (e.g. `aresden.jpg` for map `aresden.amd`).
2. Update the map's `minimap` field in `constants/Assets.ts` to `Minimap.PRE_GENERATED` so the client loads your image instead of generating one at runtime.
3. Set `DOWNLOAD_MAP_SNAPSHOT` back to `false` in `Config.ts` when done capturing.

---

## Notes

- **GENERATE_MINIMAP:** When `false` in `Config.ts`, minimap capture is skipped entirely. Keep it `true` when capturing snapshots.
- The snapshot captures map tiles and static objects (trees, etc.) but not the player or dynamic entities.
- Very large maps may require `MAP_SNAPSHOT_SHRINK_MULTIPLIER = 3` to stay within WebGL framebuffer limits.
