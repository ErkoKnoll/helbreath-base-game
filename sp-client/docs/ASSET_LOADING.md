# Asset Loading System

This project supports two methods for loading game assets:

## 1. ZIP-based Loading (Default, Recommended)

Assets are bundled into a single `assets.zip` file for faster loading, especially over slow network connections.

**🚀 Performance Optimization:** Audio files are loaded using HTML5 Audio elements (same as Phaser's normal loading), which stream and don't require upfront decoding. This keeps file sizes small (MP3) while maintaining fast loading performance.

### How to use:

1. **Generate the assets.zip file:**
   ```bash
   pnpm compress-assets
   ```

   This will:
   - Compress all assets (including MP3 audio as-is) into `public/assets.zip`
   - Uses compression level 1 (recommended)

   **Note on Compression Levels:**
   - Game assets (MP3s, binary sprites/maps) are already compressed or don't compress well
   - Higher levels (6-9) only save ~3-5% file size
   - BUT cause significantly slower decompression in the browser
   - **Level 1 is recommended** for best balance (fast decompress, minimal size penalty)

   Optional: Try different compression levels:
   ```bash
   npm run compress-assets:fast   # Level 1 (recommended)
   npm run compress-assets:best   # Level 9 (slower decompress, ~3-5% smaller)
   node compress-assets.js --ratio=3  # Custom level
   ```

2. **Run the game normally:**
   ```bash
   npm run dev
   ```

The game will automatically load from `assets.zip` located in the `public/` folder.

### How it works:
- **0-25%**: Fetching `assets.zip` with streaming progress
- **25-50%**: Decompressing files with per-file progress tracking
- **50-100%**: Processing sprites and maps

### Benefits:
- **Fewer HTTP requests** (1 instead of 150+)
- **Better compression** across all assets
- **Faster loading** on slow connections
- **Small file sizes** (MP3 compression)
- **Fast audio loading** (HTML5 Audio, same as Phaser's normal loading)
- **Automatic fallback** to traditional loading on error

### How it Works:

**Build time (compress-assets.js):**
1. Reads all assets including MP3 files as-is
2. Compresses everything into a single zip file (level 1 - fast compression/decompression)

**Runtime (LoadingScreen.ts):**
1. Downloads zip file with streaming progress (0-25%)
2. Decompresses with fflate (25-35%) - very fast at level 1
3. Decodes audio in parallel using Web Audio API (35-50%)
4. Processes sprites and maps (50-100%)

## 2. Traditional Loading (Backward Compatible)

Load assets individually, one file at a time. Useful for development, debugging, or when ZIP loading is not suitable.

**When to use per-file loading:**
- **Local development:** Set `IGNORE_ZIP_ASSETS` to `true` in `src/Config.ts` to disable ZIP loading globally. This is recommended for local development, since per-file loading can be faster—there is no decompression overhead in memory, and Phaser's native audio loading is faster when loading files directly.
- **CDN limitations:** Some CDNs don't support large files (e.g. multi-megabyte `assets.zip`). In those cases, per-file loading must be used.

### How to use:

**Option A:** Set `IGNORE_ZIP_ASSETS` to `true` in `src/Config.ts` (disables ZIP loading globally).

**Option B:** Add `?ignoreZip=true` to the URL (runtime override when `IGNORE_ZIP_ASSETS` is `false`):
```
http://localhost:5173/?ignoreZip=true
```

### How it works:
- Each asset is loaded individually via HTTP request
- Progress tracked per-file through Phaser's loader
- Same as the original loading method

## Automatic Fallback

If ZIP loading fails for any reason (missing file, corrupt archive, etc.), the system will automatically:
1. Log the error to console
2. Switch to traditional loading mode
3. Restart the loading scene
4. Continue loading normally

## Performance Notes

### Audio Loading Performance:

**ZIP-based loading (HTML5 Audio):**
- Loading time: ~5-10ms per file (loading metadata only, actual audio streams)
- Total audio loading: ~50-150ms for all files
- File size: Small (MP3 compression)
- Same performance as Phaser's normal loading

**Why HTML5 Audio is Fast:**
- Only loads audio metadata, not the full file
- Actual audio data streams on-demand when played
- No upfront decoding required

## Troubleshooting

### "Missing files in assets.zip" error:

This means some assets in `Assets.ts` are not present in `public/assets/`. Check:
1. All required files exist in their respective folders (`public/assets/maps/`, `public/assets/sprites/`, etc.)
2. Filenames match exactly (case-sensitive)
3. Run `npm run compress-assets` to regenerate the zip

The error will list which files are missing.

### ZIP file not found:

Make sure `public/assets.zip` exists. If not, run:
```bash
npm run compress-assets
```

### Slow loading during development:

For faster iteration during development, set `IGNORE_ZIP_ASSETS` to `true` in `src/Config.ts`, or add `?ignoreZip=true` to the URL:
```
http://localhost:5173/?ignoreZip=true
```

Or use fast compression when regenerating the zip:
```bash
npm run compress-assets:fast
```
