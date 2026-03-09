# Input Handling

This document describes how mouse/pointer input flows through the game, from `InputManager` to `GameWorld` and `Player`. Input handling is **mouse-only** (no keyboard); game-specific logic is delegated via callbacks.

---

## Overview

| Component | Role |
|-----------|------|
| **InputManager** | Low-level: listens to Phaser pointer events, tracks button state, throttles movement commands, emits UI events |
| **GameWorld** | High-level: interprets input as game actions (move, attack, pickup, spell targeting) and calls `Player` methods |
| **Player** | Executes commands; does not receive input directly |

---

## InputManager

**Location:** `src/utils/InputManager.ts`

### Responsibilities

- Subscribes to Phaser's `pointermove`, `pointerdown`, `pointerup`, `pointerout`
- Tracks `isLeftMouseDown` and `isRightMouseDown`
- **Movement throttle:** Limits how often movement commands are accepted (see `MOVEMENT_COMMAND_THROTTLE_MS` in `Config.ts`, default 100ms) to avoid overshooting when holding the mouse button
- Emits `OUT_UI_MOUSE_POSITION_UPDATE` with world pixel and tile coordinates for UI (e.g. cursor tooltips)
- Disables the browser context menu on right-click
- Invokes optional callbacks: `onPointerMove`, `onPointerDown`, `onPointerUp`

### Configuration

```ts
interface InputManagerConfig {
    scene: Scene;
    isEnabled?: () => boolean;  // When false, input handlers skip processing (e.g. during map load)
    onPointerMove?: (worldPixelX, worldPixelY, worldX, worldY) => void;
    onPointerDown?: (pointer: Phaser.Input.Pointer) => void;
    onPointerUp?: (pointer: Phaser.Input.Pointer) => void;
}
```

### Key Methods

| Method | Purpose |
|--------|---------|
| `getIsLeftMouseDown()` | Whether left mouse button is currently held |
| `getIsRightMouseDown()` | Whether right mouse button is currently held |
| `getActivePointer()` | Current Phaser pointer (for cursor position) |
| `canAcceptMovementCommand()` | True if throttle allows a new movement command |
| `recordMovementCommand()` | Updates throttle timestamp after a movement command |
| `resetMovementThrottle()` | Called on left mouse down so the first move is immediate |

### Coordinate Conversion

Pointer coordinates are in **world space** (accounting for camera scroll). `convertPixelPosToWorldPos()` maps pixel coordinates to tile/cell coordinates (32px per cell).

---

## GameWorld Integration

**Location:** `src/game/scenes/GameWorld.ts`

### Setup

`setupInputManager()` is called from `init()`. The InputManager is created with:

- **`isEnabled`:** `() => !this.loadingMap` — input is ignored while the map is loading
- **`onPointerMove`:** Updates the map hover cell via `getCurrentMap().updateHoverCell()`
- **`onPointerDown`:** Immediate actions (attack monster, cancel spell, cancel movement)
- **`onPointerUp`:** Click-release actions (pickup, move to cell, attack monster)

### Update Loop

Each frame, after `player.update(delta)`:

```ts
this.handleLeftMouseButton();
this.handleRightMouseButton();
```

These methods read `inputManager.getIsLeftMouseDown()` / `getIsRightMouseDown()` and `getActivePointer()` to handle **held** input (continuous movement, attack-while-holding, turn-while-holding).

---

## Input → Action Flow

### Left Mouse Button

| Phase | Condition | Action |
|-------|-----------|--------|
| **Down** (onPointerDown) | Monster under cursor | `player.attack(monster)` |
| **Down** | Pending spell | Skip (handled on up) |
| **Down** | Pending effect | Skip |
| **Down** | Right-click context | `player.cancelMovement()` |
| **Held** (handleLeftMouseButton) | Casting | Skip |
| **Held** | Pending spell + left click | `player.onLeftClickAt()` (confirm spell target) |
| **Held** | Pending effect | `castManager.tryPlaceEffect()` |
| **Held** | Monster under cursor | `player.attack()` or pathfind toward monster |
| **Held** | Empty ground | `player.setDestination()` (throttled) |
| **Up** (onPointerUp) | Monster under cursor | `player.attack()` or pathfind |
| **Up** | Click on own cell | `player.requestPickUp()` |
| **Up** | Adjacent cell | `player.cancelMovement()` |
| **Up** | Other cell | `player.setDestination()` |

### Right Mouse Button

| Phase | Condition | Action |
|-------|-----------|--------|
| **Down** | Pending effect | `castManager.clearPendingEffect()` |
| **Down** | Pending spell | `player.onRightClick()` (cancel spell) |
| **Down** | Otherwise | `player.cancelMovement()` |
| **Held** (handleRightMouseButton) | Not moving | `player.turnTowardsDirection()` toward cursor |

---

## Player API (Input-Related)

**Location:** `src/game/objects/Player.ts`

The Player does **not** subscribe to input events. GameWorld calls these methods in response to input:

| Method | Called When | Notes |
|--------|-------------|-------|
| `setDestination(x, y, useDirectMovement, ...)` | Left-click or release on ground | Rejected when attacking, casting, in take-damage, etc. |
| `attack(monster)` | Left-click or release on monster | Stores target when out of range; pathfinds then attacks |
| `cancelMovement()` | Right-click | Also cancels pending spell when applicable |
| `turnTowardsDirection(direction)` | Right-click held (idle) | Only when not moving |
| `requestPickUp()` | Left-click release on own cell | Plays pickup animation, emits `ITEM_PICKUP_ATTEMPTED` |
| `onLeftClickAt(pixelX, pixelY)` | Left-click with pending spell | Confirms spell target |
| `onRightClick()` | Right-click with pending spell | Cancels spell |

### State Checks That Block Input

GameWorld and Player use these to avoid invalid commands:

- `player.isCasting()` — cast animation playing
- `player.hasPendingSpell()` — spell targeting or cast ready
- `player.isAttacking()` / `player.isInBowStance()` — attack in progress
- `player.getIsDead()` — no input accepted
- `player.isStunlocked()` — after take-damage
- `castManager?.getPendingEffectKey()` — effect placement mode
- `castManager?.getCastReady()` — effect just placed (one-frame cooldown)

---

## Movement Throttle

Holding the left mouse button would otherwise send a movement command every frame. The throttle (`MOVEMENT_COMMAND_THROTTLE_MS`) limits how often `setDestination` is called:

1. **Left mouse down** → `resetMovementThrottle()` so the first command is accepted immediately
2. **Before each movement command** → `canAcceptMovementCommand()` must be true
3. **After accepting** → `recordMovementCommand()` updates the throttle timestamp

This reduces overshooting when the player clicks and holds to move.

---

## Pointer Position and Coordinates

- **Phaser pointer:** `pointer.x`, `pointer.y` are in **camera/viewport** space
- **World pixel:** `pointer.worldX`, `pointer.worldY` or `pointer.x + camera.scrollX`, `pointer.y + camera.scrollY`
- **World cell:** `convertPixelPosToWorldPos(pixel)` — divides by 32 (TILE_SIZE)

GameWorld uses world pixel coordinates when calling `player.setDestination()`, `player.onLeftClickAt()`, and when resolving monsters/ground items under the cursor via `getMonsterUnderPointer()` and `getGroundItemUnderPointer()`.

---

## Lifecycle

- **Setup:** `InputManager.setup()` registers Phaser listeners in `GameWorld.init()` → `setupInputManager()`
- **Teardown:** `InputManager.destroy()` in `GameWorld.shutdown()` removes listeners and context-menu handler

---

## Extending Input

To add new input behavior:

1. **New pointer callback:** Add a new optional callback to `InputManagerConfig` and invoke it from the appropriate handler
2. **New game action:** Implement logic in `handleLeftMouseButton`, `handleRightMouseButton`, or the `onPointerDown`/`onPointerUp` callbacks in `setupInputManager()`
3. **New Player command:** Add a public method on `Player` and call it from GameWorld when the input condition is met
