# Core Systems

Managers, GameObject hierarchy, utilities. See `04-movement-system.md` for movement. For details: [CAMERA_SYSTEM](../../docs/CAMERA_SYSTEM.md), [SHADOWS_RENDERING](../../docs/SHADOWS_RENDERING.md), [AUDIO_SYSTEM](../../docs/AUDIO_SYSTEM.md), [INPUT_HANDLING](../../docs/INPUT_HANDLING.md), [PLAYER_MECHANICS](../../docs/PLAYER_MECHANICS.md), [MONSTER_MECHANICS](../../docs/MONSTER_MECHANICS.md), [INVENTORY_AND_LOOT_MECHANICS](../../docs/INVENTORY_AND_LOOT_MECHANICS.md), [SPELLS_AND_EFFECTS_MECHANICS](../../docs/SPELLS_AND_EFFECTS_MECHANICS.md).

## MapManager, CameraManager, InputManager

**MapManager:** Map loading, rendering, minimap capture. `getCurrentMap()`, `startMinimapCapture()`, `getIsCapturingMinimap()`, `setCameraManager()`. Created in GameWorld.

**CameraManager:** Camera follow, zoom, bounds, UI-driven movement. Listens for `IN_UI_CAMERA_*` events. `setupEventListeners()`, `destroyEventListeners()`, `update()` (call from scene update loop).

**InputManager:** Pointer input, movement throttle, emits `OUT_UI_MOUSE_POSITION_UPDATE`. `setup()`, `destroy()`, `getIsLeftMouseDown()`, `getIsRightMouseDown()`. Callbacks: `onPointerMove`, `onPointerDown`, `onPointerUp`.

## GameObject

Base in `game/objects/GameObject.ts`. Movement, collision, `switchState()`, multi-asset rendering. `autoSwitchToIdle` (default true); Monster sets false for AI control. Tile occupancy automatic via `map` in config.

**Knockback (take damage movement):** Shared logic for InterruptKnockback. Use `computeKnockbackDestination(attackerWorldX, attackerWorldY)` → `{ destX, destY } | null`. If non-null, call `applyKnockbackMovement(destX, destY)` then switch to TakeDamageWithKnockback state. In `update()`, when in that state and `isKnockbackActive()`, call `updateKnockbackVisual(delta)`. Override `onKnockbackComplete()` for post-knockback behavior (e.g. Player stunlock).

## Player

Extends GameObject. Equipment layers, `PlayerState` (Idle/Run). `setMovementSpeed()`, `turnTowardsDirection()`. Integrates GameStateManager. `takeDamage(attackType, attackerWorldX, attackerWorldY)`—uses GameObject knockback helpers for InterruptKnockback. See Player.ts.

## Monster

Extends GameObject. AI priority: Attack > Follow > Wander. `MonsterState`: Idle, Move, Attack. Config: `movementSpeed`, `attackSpeed`, `followDistance`, `attackDistance` in Monster constructor. `constants/Monsters.ts` for per-type data (sounds, opacity, temporalCoefficient). `updatePlayerPosition()` for spatial audio (no direct Player ref). `takeDamage(attackType)`—uses `playerX`/`playerY` as attacker position for knockback via GameObject helpers. Wyverns: see `02-sprites-and-assets.md`.

## NPC, GroundItem

`NPC.ts`: Extends GameObject. Summonable via NPCDialog. Emits `NPC_DEAD`. `GroundItem.ts`: Extends GameObject. Renders items on ground. Listens for `IN_UI_CHANGE_GENDER`, `IN_UI_TOGGLE_DISPLAY_LARGE_ITEMS`. Integrates with LootManager.

## FloatingText

`FloatingText.ts`. Renders damage numbers or text that travels upward and fades. Config: `text`, `x`, `y`, `fontSize`, `color`, `upwardTravelPxPerSec`, `totalDurationMs`, `fadeDurationMs`, `bold`, `horizontalOffset`. Depth: `FLOATING_TEXT_DEPTH`. Cleanup: `destroy()` removes update listener and text object.

## CriticalStrikeProjectile

`game/effects/CriticalStrikeProjectile.ts`. Projectile effect from source to target. Uses effect.spr sheet 8 (3 frames). Depth: `HIGH_DEPTH`. Destroys on arrival.

## SpatialGrid

`SpatialGrid.ts`. Cell size TILE_SIZE. `insert()`, `getNearby()`, `clear()`. Used for map object collision.

## ShadowManager

`ShadowManager.ts`. `setWorldPosition()`, `setOffset()`, `updateDepth()`, `updateAnimation()`. Tree shadows via GameAsset.

## GameStateManager

`GameStateManager.ts`. `getWorldX/Y()`, `setWorldPos()`, `getMap()`, `setMap()`, `getMovementSpeed()`, `setMovementSpeed()`, `saveGameState()`, `loadGameState()`. Access: `getGameStateManager(game)`. Creation: `createGameStateManager(game)` (in LoginScreen).

## MusicManager, SoundManager, SoundTracker

`MusicManager`: `playMusic(fileName)`, `stopMusic()`, `setVolume()`. `SoundManager`: `playInLoop()`, `playOnce()`, `setSpatialConfig()`, `setPlaybackSpeed()`. `SoundTracker`: `playInLoop(state, fileName, ...)`, `playOnce()`, `setSpatialConfig()`, `stopAllSounds()`.

## SpatialAudio

`SpatialAudioUtils.ts`: `calculateSpatialAudio({ sourceX/Y, listenerX/Y })` for pan and distanceVolume.

## Registry, Coordinates

`RegistryUtils.ts`: `getMap()`, `createGameStateManager()`, `getGameStateManager()`, `getMusicManager()`, `getInventoryManager()`, `getLootManager()`, `getPivotData()`, `setPivotDataByTextureKey()`, `setPivotDataBySpriteName()`, `getCachedMinimap()`, `setCachedMinimap()`, `isDebugModeEnabled()`, `setDebugModeEnabled()`, `getLoadingBgKey()`, `getLoginScreenBgKey()`, `getIgnoreZip()`, `setIgnoreZip()`, `getBinaryBuffer()`. Registry keys in `constants/RegistryKeys.ts`. `CoordinateUtils.ts`: conversion, `getNextDirection()`, `getDirectionFromScreenSector()`, `findMovableLocation()`, `getDirectionOffsets()`.

## Cleanup

`destroy()`: EventBus.off → registry.off → destroy Phaser objects → clear refs.
