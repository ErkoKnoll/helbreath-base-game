# Sprite File Format

Developer guide for how `.spr` (sprite) files are loaded and parsed in the sp-client. Implementation is in `src/game/assets/HBSprite.ts`.

---

## Format Origin

This format was borrowed from **Vamp's C# Helbreath remake project**, which uses the same binary structure. Some sprites in this project are still from that repository. See: [Helbreath Remake on Bitbucket](https://bitbucket.org/helbreathremake/workspace/repositories/).

The original **.PAK format** used by the classic Helbreath client followed a similar layout (header, metadata, image data per sprite sheet), but stored **DIB bitmap images** without alpha channels. Those bitmaps are uncompressed and not supported by modern browsers. The `.spr` format used here has the original bitmaps converted to **PNG images with alpha channels**, which are compressed and fully supported in the browser. Use the **PakToSprConverter** tool in `tools/PakToSprConverter/` to convert `.pak` files to `.spr`.

---

## Binary Layout

All multi-byte integers are **little-endian**.

### Header

| Offset | Size | Type | Description |
|--------|------|------|-------------|
| 0 | 2 | int16 | Sprite count (number of sprite sheets in the file) |

### Per-Sprite Metadata (repeated for each sprite sheet)

| Offset | Size | Type | Description |
|--------|------|------|-------------|
| +0 | 2 | int16 | Frame count |
| +2 | 4 | int32 | Image length (PNG byte size) |
| +6 | 4 | int32 | Width (unused in parser) |
| +10 | 4 | int32 | Height (unused in parser) |
| +14 | 1 | byte | startLocation placeholder |
| +15 | 12 × N | — | Frame metadata (N = frame count) |

### Per-Frame Metadata (12 bytes each)

| Offset | Size | Type | Description |
|--------|------|------|-------------|
| +0 | 2 | int16 | left (x in sprite sheet) |
| +2 | 2 | int16 | top (y in sprite sheet) |
| +4 | 2 | int16 | width |
| +6 | 2 | int16 | height |
| +8 | 2 | int16 | pivotX |
| +10 | 2 | int16 | pivotY |

### Image Data

After all metadata, each sprite sheet has:

| Offset | Size | Type | Description |
|--------|------|------|-------------|
| +0 | 4 | int32 | startLocation (skipped for sequential read) |
| +4 | imageLength | bytes | Raw PNG data |

The PNG data is a complete, valid PNG image containing the sprite sheet. Each frame is a rectangular region (left, top, width, height) within that image.

---

## Loading Flow

1. **Binary cache**: `.spr` files are loaded as binary assets (e.g. via Phaser's loader or from `assets.zip`). The raw `ArrayBuffer` is stored in the binary cache under the asset key (e.g. `sprite-kennedy`).

2. **HBSpriteFile.load()**: `LoadingScreen` creates an `HBSpriteFile` per sprite asset and calls `load(scene)`:
   ```ts
   const hbFile = new HBSpriteFile(asset.key, asset.spriteType, asset.exportFramesAsDataUrls, asset.tileStartIndex);
   await hbFile.load(this);
   ```

3. **parseSprite()**: Reads the buffer sequentially:
   - Reads sprite count from header
   - For each sprite: reads frame count, image length, dimensions, placeholder, then all frame metadata
   - For each sprite: skips startLocation, slices `imageLength` bytes as PNG data
   - Builds `HBSpriteFrame` instances with (left, top, width, height, pivotX, pivotY, textureKey, frameIndex)

4. **ImageBitmap creation**: Each sprite sheet's PNG data is converted to an `ImageBitmap` via `createImageBitmap(blob)` for efficient GPU upload.

5. **HBSpriteSheet**: A canvas is created, the sprite sheet is drawn onto it, and Phaser's `textures.addCanvas()` registers it. Frames are sliced with `texture.add(frameIndex, 0, x, y, width, height)`. Filter is set to `NEAREST` for pixel-perfect rendering.

6. **Pivot data**: Frame pivot points are stored in Phaser's registry for `GameAsset` to use when rendering (origin alignment).

7. **Animations**: For non-Tiles and non-Interface types, `HBAnimation` registers Phaser animations (one per sprite sheet) with frame rate 10 and repeat -1.

8. **Cleanup**: The sprite buffer is removed from the binary cache after parsing to free memory. `ImageBitmap` is closed after texture creation.

---

## Texture Naming

- **Default**: `{spriteName}-{spriteSheetIndex}` (e.g. `sprite-kennedy-0`)
- **Tiles** (when `tileStartIndex` is set): `map-tile-{tileStartIndex + spriteSheetIndex}` (e.g. `map-tile-0`)

---

## Sprite Types

`SpriteType` in `HBSprite.ts` determines behavior:

| Type | Animations | Notes |
|------|------------|-------|
| Human, Monster, HairAndUndies, Bows, Weapons, Shields, Effect | Yes | Full animation registration |
| Tiles, Interface, EquipmentPack, ItemPack, ItemGround | No | Static frames only |

---

## Sprite Utility Scripts (tools folder)

The `tools` folder contains scripts for working with `.spr` and `.pak` files:

| Tool | Purpose |
|------|---------|
| **PakToSprConverter/** | .NET tool to convert legacy `.pak` sprite files to `.spr` format. Converts DIB bitmaps to PNG with alpha. Usage: `dotnet run -- <file-or-folder-path> [mode] [divergence]`. Modes: `BinaryTransparency` (default), `BlendedTransparency`, `NearTransparency`. See `tools/PakToSprConverter/README.md`. |
| **extract-all-spr.js** | Extracts all sprite sheets from all `.spr` files in a folder. Each sprite file gets a subfolder; each animation index gets a subfolder with individual frame PNGs. |
| **extract-spr-frames.js** | Extracts frames from a single `.spr` file for a given animation index. Usage: `node extract-spr-frames.js <spr-file> <animation-number> <destination-path>` |
| **recompress-sprite-files.js** | Re-compresses PNG data inside `.spr` files using `@jsquash/oxipng`. Usage: `node recompress-sprite-files.js <compression-level> <file-or-folder-path>`. Compression levels 1–6. |

These tools use the same binary layout as `HBSprite.ts` and are useful for conversion, debugging, asset preparation, and reducing file sizes.

---

## Key Classes

| Class | Role |
|-------|------|
| `HBSpriteFile` | Top-level loader; parses binary, creates sheets and animations |
| `HBSpriteSheet` | Holds frames, creates Phaser texture, optionally exports frames as data URLs |
| `HBSpriteFrame` | Single frame: x, y, width, height, pivotX, pivotY, textureKey, frameIndex |
| `HBAnimation` | Registers Phaser animations from sprite frames with pivot custom data |
