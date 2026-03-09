# Sprites and Assets

Sprite loading, animation, and rendering. See `00-quick-reference.md` for quick add flow. For details: [ASSET_LOADING](../../docs/ASSET_LOADING.md), [SPRITE_FILE_FORMAT](../../docs/SPRITE_FILE_FORMAT.md), [ANIMATIONS_RENDERING](../../docs/ANIMATIONS_RENDERING.md), [GENERATING_MINIMAP_SNAPSHOTS](../../docs/GENERATING_MINIMAP_SNAPSHOTS.md).

## HBSprite (.spr format)

Binary format: header (sprite count), per-sheet: frame count, image length, dimensions, frame metadata (left, top, width, height, pivotX, pivotY), PNG data. Converted from .pak via `PakToSprConverter`; compressed with `recompress-sprite-files.js`.

**Loading:** `HBSpriteFile(cacheKey, SpriteType, false, tileStartIndex?).load(scene)` in LoadingScreen.create(). Texture key: `sprite-{name}-{sheetIndex}` or `map-tile-{index}` for tiles. Pivot data: `getPivotData(scene, textureKey, spriteName, isMapObject)`.

**SpriteType enum:** Human, Monster, EquipmentPack, HairAndUndies, Bows, Weapons, Shields, Effect, Tiles, Interface, ItemPack, ItemGround.

## GameAsset

Located in `game/objects/GameAsset.ts`. Renders sprites with pivot handling, directional animations, shadows.

**AnimationType:** FullFrame (default), DirectionalSubFrame (equipment), SubFrame (custom frame range, e.g. wyverns).

**Key methods:** `playAnimationWithDirection()`, `setPosition()`, `setDepth()`, `setAlpha()`, `setTint()`, `destroy()`, `animationFinished()` (protected).

**Config:** `mapObject: true` for legacy tile texture lookup. Add to `SPRITES_WITH_SHADOWS` in Config.ts for shadows. Trees (indices 100–145) get auto shadows at index+50.

**Wyvern family:** firewyvern, wyvern, uglywyvern use SubFrame (idle 0–3, attack 4–7). See Monster.ts and `constants/Monsters.ts`.

## Shadow System

See `06-core-systems.md`. Tree shadows: index+50, 16px offset, 50% opacity.

## Memory

Sprite buffers removed from cache after parsing. ImageBitmap closed after texture creation.
