# Camera System Developer Guide

This guide describes how the camera system works in the sp-client. The system manages the main Phaser camera: follow target, zoom, bounds, UI-driven movement, and camera shake effects.

---

## Architecture Overview

The camera system centers on **CameraManager**, which coordinates with the Phaser main camera, the React UI layer via EventBus, and other managers (MapManager, CastManager, GameStateManager).

| Component | Purpose |
|-----------|---------|
| **CameraManager** | Follow target, zoom, bounds, UI-driven pan, camera shake |
| **MapManager** | Sets camera bounds and zoom during map load; uses `isCapturingMinimap` to avoid persisting zoom during minimap capture |
| **CastManager** | Passes CameraManager to spells that trigger camera shake on impact |
| **GameStateManager** | Persists camera zoom (20–200%) to localStorage |

```
┌─────────────────┐     ┌─────────────────┐     ┌──────────────────────┐
│  React UI       │────▶│  EventBus       │────▶│  CameraManager       │
│  (sliders,      │     │  (IN_UI_*)      │     │  (follow, zoom,      │
│   buttons)      │     │                 │     │   pan, shake)        │
└─────────────────┘     └─────────────────┘     └──────────┬──────────┘
                                                           │
                                                           ▼
┌─────────────────┐     ┌─────────────────┐     ┌──────────────────────┐
│  Spells/Effects │────▶│  setCameraShake  │────▶│  Phaser main camera   │
│  (EarthShockWave│     │  (effect pos)    │     │  (scrollX/Y, zoom)   │
│   LightningBolt)     └─────────────────┘     └──────────────────────┘
└─────────────────┘
```

---

## CameraManager

**File:** `src/utils/CameraManager.ts`

Manages the main Phaser camera: follow target, zoom, bounds, UI-driven pan, and camera shake.

### Configuration

```typescript
interface CameraManagerConfig {
    scene: Scene;
    /** When true, setZoom skips updating GameStateManager (e.g. during minimap capture) */
    isCapturingMinimap?: () => boolean;
    /** Returns pixel position for follow target, or undefined if no target */
    getFollowTarget?: () => { x: number; y: number } | undefined;
}
```

- **scene** – Phaser scene containing the main camera
- **isCapturingMinimap** – When returning `true`, `setZoom` does not update GameStateManager (avoids saving minimap zoom)
- **getFollowTarget** – Callback returning the pixel position to follow (e.g. player anchor). When follow mode is on, the camera centers on this point each frame.

### API

| Method | Description |
|--------|-------------|
| `setupEventListeners()` | Subscribes to EventBus camera events (zoom, pan, follow, shake toggle) |
| `destroyEventListeners()` | Unsubscribes from EventBus camera events |
| `update()` | Called each frame from GameWorld; applies follow and camera shake |
| `setZoom(zoom: number)` | Sets main camera zoom; persists to GameStateManager unless minimap capture is active |
| `setFollowPlayer(enabled: boolean)` | Enables/disables follow mode; when enabled, camera centers on follow target |
| `getFollowPlayer()` | Returns whether follow mode is enabled |
| `moveCamera(deltaX, deltaY)` | Pans camera by pixel deltas; disables follow and emits `OUT_UI_CAMERA_FOLLOW_PLAYER_CHANGED` |
| `setBounds(width, height)` | Sets camera scroll bounds (world pixels) |
| `centerOn(x, y)` | Centers camera on world pixel position |
| `setCameraShake(effectPixelX, effectPixelY, multiplier?)` | Triggers camera shake based on effect position; intensity decreases with distance from screen center |

### Event Listeners (IN_UI_*)

| Event | Payload | Action |
|-------|---------|--------|
| `IN_UI_CAMERA_MOVE_UP` | — | Pan up by `TILE_SIZE` |
| `IN_UI_CAMERA_MOVE_DOWN` | — | Pan down by `TILE_SIZE` |
| `IN_UI_CAMERA_MOVE_LEFT` | — | Pan left by `TILE_SIZE` |
| `IN_UI_CAMERA_MOVE_RIGHT` | — | Pan right by `TILE_SIZE` |
| `IN_UI_CHANGE_CAMERA_ZOOM` | `zoom: number` | Set camera zoom |
| `IN_UI_CHANGE_CAMERA_FOLLOW_PLAYER` | `enabled: boolean` | Toggle follow mode |
| `IN_UI_CHANGE_CAMERA_SHAKE` | `enabled: boolean` | Enable/disable camera shake globally |

### Outgoing Events (OUT_UI_*)

| Event | Payload | When |
|-------|---------|------|
| `OUT_UI_CAMERA_FOLLOW_PLAYER_CHANGED` | `false` | When user pans camera manually (follow is turned off) |

---

## Follow Mode

When follow mode is enabled, the camera centers on the follow target each frame:

```typescript
camera.scrollX = target.x - camera.width / 2;
camera.scrollY = target.y - camera.height / 2;
```

The target comes from `getFollowTarget()`. In GameWorld, this is the player’s animated pixel position (`getAnimatedPixelX()`, `getAnimatedPixelY()`).

Manual panning (via `moveCamera` or UI move events) disables follow and emits `OUT_UI_CAMERA_FOLLOW_PLAYER_CHANGED` so the UI can update its state.

---

## Camera Shake

Shake is driven by effect position and distance from the screen center.

### Formula

- Camera center: `(scrollX + width/2, scrollY + height/2)`
- Distance in pixels: `max(|effectX - centerX|, |effectY - centerY|)`
- Distance in tiles: `sDist = distPixels / TILE_SIZE`
- Base degree: `(5 - sDist) * 2` (clamped to ≥ 0)
- Optional `multiplier` scales the degree
- Shake is skipped if degree ≤ 2

Effects near the center produce stronger shake; distant effects produce weaker or no shake.

### Applying Shake

Each frame, if `cameraShakingDegree > 0`:

- Add random offset to `scrollX` and `scrollY` in `[-degree, degree)`
- Decrease `cameraShakingDegree` by 1 per frame

### Triggering Shake from Spells

Spells receive `cameraManager` in their config and call `setCameraShake` at impact:

```typescript
// Example: EarthShockWave when projectile reaches destination
this.config.cameraManager?.setCameraShake(pixelX, pixelY);
```

Spells that use camera shake include: EarthShockWave, BloodyShockWave, LightningBolt, LightningStrike, EnergyStrike, EnergyBolt, FireBall, FireStrike, MeteorStrike, EarthwormStrike, Blizzard, IceStrike, MassIceStrike.

### Disabling Shake

The UI can emit `IN_UI_CHANGE_CAMERA_SHAKE` with `false` to disable shake globally. When disabled, `setCameraShake` returns immediately.

---

## Zoom and Persistence

- Zoom is stored in GameStateManager as a percentage (20–200, where 100 = 1.0).
- `setZoom` converts to Phaser zoom and persists via `getGameStateManager(scene.game).setCameraZoom(zoom * 100)`.
- During minimap capture, `isCapturingMinimap()` returns `true`, so `setZoom` does not update GameStateManager. This avoids saving the temporary zoom used for the minimap snapshot.

---

## MapManager Integration

MapManager uses CameraManager for:

1. **Bounds** – `setBounds(map.sizeX * TILE_SIZE, map.sizeY * TILE_SIZE)` when the map loads.
2. **Minimap capture** – Temporarily sets zoom to fit the full map, takes a snapshot, then restores scroll and zoom. `isCapturingMinimap` is `true` during this so zoom changes are not persisted.

---

## Lifecycle (GameWorld)

1. **init** – `setupCameraManager()` creates CameraManager with `isCapturingMinimap` and `getFollowTarget` callbacks, calls `setupEventListeners()`, and passes it to MapManager.
2. **update** – `cameraManager?.update()` runs each frame (after player update).
3. **setupMap** – After minimap capture, saved zoom is applied via `cameraManager?.setZoom(savedCameraZoom / 100)`.
4. **initializeGameObjects** – Camera is centered on the player with `cameraManager?.centerOn(...)`.
5. **shutdown** – `cameraManager?.destroyEventListeners()` and `cameraManager = undefined`.

---

## Related Files

| File | Role |
|------|------|
| `src/utils/CameraManager.ts` | Camera logic |
| `src/constants/EventNames.ts` | `IN_UI_CAMERA_*`, `OUT_UI_CAMERA_*` |
| `src/game/scenes/GameWorld.ts` | Setup, update, shutdown |
| `src/utils/MapManager.ts` | Bounds, minimap zoom |
| `src/utils/CastManager.ts` | Passes CameraManager to spells |
| `src/utils/GameStateManager.ts` | Persists camera zoom |
| `src/game/spells/*.ts` | Call `setCameraShake` on impact |
