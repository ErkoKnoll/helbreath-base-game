# Movement System

This document describes how the grid-based movement system works for `GameObject`, `Player`, and `Monster` entities. Movement is cell-by-cell with smooth pixel interpolation, tile occupancy tracking, and two pathfinding modes.

---

## Overview

- **Grid-based:** Entities occupy discrete world cells (32×32 pixels). Movement happens one cell at a time.
- **Smooth animation:** Visual position interpolates from the previous cell to the current cell over a configurable duration.
- **Tile occupancy:** The map tracks which cells are occupied; entities mark tiles on move and free them before leaving.
- **Two modes:** Direct movement (cursor direction) and pathfinding (toward a destination cell).

---

## Core Classes

| Class | Role |
|------|------|
| `GameObject` | Base class. Handles destination, movement state, animation, tile occupancy, knockback, stunlock. |
| `Player` | Extends `GameObject`. Adds run/walk, dash attack, attack target pathfinding, cast queuing, position sync with `GameStateManager`. |
| `Monster` | Extends `GameObject`. Adds AI-driven movement (follow, attack, wander), movement sounds, `autoSwitchToIdle: false`. |

---

## Key State Variables (GameObject)

| Variable | Purpose |
|----------|---------|
| `worldX`, `worldY` | Current cell in world grid. |
| `destinationX`, `destinationY` | Target cell (-1 when none). |
| `isMoving` | True while animating between cells. |
| `moveReady` | True when ready to start the next move. |
| `direction` | Current facing (0–7, see `Direction` enum). |
| `offsetX`, `offsetY` | Pixel offset from cell center for smooth animation. |
| `movementElapsedTime` | Time elapsed for current move. |
| `movementSpeedDurationMs` | Duration of one tile move (e.g. 100–500 ms for player). |
| `isDirectMovementMode` | Use cursor direction vs pathfinding. |
| `playerTurn` | 0 or 1; alternates search order when blocked. |
| `prevMoveX`, `prevMoveY`, `isPrevMoveBlocked` | Track last blocked move to avoid retrying it. |

---

## Movement Flow

### 1. Setting a Destination

```ts
setDestination(destinationX, destinationY, useDirectMovement?, cameraCenterPixelX?, cameraCenterPixelY?, cursorPixelX?, cursorPixelY?)
```

- Stores `destinationX`, `destinationY` and optional pixel coords for direct movement.
- If `moveReady`, calls `processMovement()` immediately.
- **Player:** Rejects when attacking, casting, picking up, taking damage, or stunlocked.
- **Monster:** Does not call `setDestination` directly; AI uses `moveOneStepTowards()`.

### 2. Processing Movement (`processMovement`)

1. **At destination?** If `worldX === destinationX && worldY === destinationY`, clear destination and switch to Idle.
2. **Not ready?** If `!moveReady`, return (still animating).
3. **Direction:**
   - **Direct mode:** `getDirectionFromScreenSector(cursorPixel, cameraCenter)` → 8 sectors around camera center.
   - **Pathfinding mode:** `getNextDirection(worldX, worldY, destinationX, destinationY)` → direction toward destination.
4. **Direct mode blocked?** If direct move fails, switch to pathfinding and recalculate.
5. **Pathfinding:** `findNextMovableDirection(direction)` checks preferred direction and up to 2 adjacent directions (based on `playerTurn`).
6. **Blocked?** If no valid direction, clear destination, set `isPrevMoveBlocked`, alternate `playerTurn`, switch to Idle.
7. **Before move hook:** Subclasses can override `beforeMove(direction)` (e.g. Player dash attack).
8. **Execute:** Call `move(direction)`.

### 3. Executing a Move (`move`)

1. Free current tile: `markCurrentTileFree()`.
2. Update world position: `worldX += dx`, `worldY += dy`.
3. Mark new tile occupied: `markCurrentTileOccupied()`.
4. Call `onPositionChanged(worldX, worldY)` (Player syncs `GameStateManager`, emits `PLAYER_POSITION_CHANGED`).
5. Update `direction` if changed.
6. Switch to Move state (triggers run/walk animation).
7. Set `isMoving = true`, `moveReady = false`, `movementElapsedTime = 0`.
8. Set initial `offsetX`, `offsetY` so the sprite starts at the previous cell (e.g. moving East: `offsetX = -TILE_SIZE`).

### 4. Per-Frame Update (`update`)

When `isMoving`:

1. `movementElapsedTime += delta`.
2. `progress = min(movementElapsedTime / movementSpeedDurationMs, 1)`.
3. Interpolate `offsetX`, `offsetY` from start offset to 0 based on `progress` and `direction`.
4. Call `updatePixelPosition()` to move sprites.
5. When `progress >= 1`:
   - Set `moveReady = true`, reset offsets.
   - Call `onCellReached()` (stunlock, footsteps, etc.).
   - If destination cancelled → Idle.
   - If at final destination → Idle (unless `autoSwitchToIdle` is false, e.g. Monster).
   - If `shouldPauseMovementWhenCellReached()` (e.g. stunlock) → Idle.
   - Otherwise → `processMovement()` for next cell.

---

## Direction and Pathfinding

### Direction Enum (`CoordinateUtils.ts`)

```
North=0, NorthEast=1, East=2, SouthEast=3, South=4, SouthWest=5, West=6, NorthWest=7
```

### Direction Calculation

- **Pathfinding:** `getNextDirection(sourceX, sourceY, destX, destY)` returns the 8-direction vector from source to destination.
- **Direct movement:** `getDirectionFromScreenSector(cursorPixelX, cursorPixelY, cameraCenterX, cameraCenterY)` maps cursor angle to one of 8 sectors.

### Finding a Movable Direction

`findNextMovableDirection(direction)`:

- Checks preferred direction and up to 2 adjacent directions.
- Order depends on `playerTurn` (0: forward, 1: backward).
- Skips the previous blocked cell if `isPrevMoveBlocked`.
- Uses `canMove(direction)` for validation.

### Collision Checks (`canMove`)

A move is allowed if:

- In bounds.
- Tile exists and `tile.isMoveAllowed`.
- Tile not occupied (`!tile.occupiedByGameObject`).

---

## Player-Specific Behavior

### Run vs Walk

- **Run:** Full speed, run animation, `runMovementSpeedDurationMs`.
- **Walk:** Half speed (`movementSpeedDurationMs * 2`), walk animation.

### Direct Movement

- Right-click sets destination with `useDirectMovement: true`.
- Uses cursor pixel and camera center for `getDirectionFromScreenSector`.
- If blocked, falls back to pathfinding.

### Attack Target Pathfinding

- `attackTarget` stores a monster when out of range.
- `processMovement` checks distance when reaching a cell; if in range, calls `startAttack()` instead of moving.
- `beforeMove` can trigger dash attack when one cell away from target (run mode, melee, dash enabled).

### Dash Attack

- When moving one cell toward attack target in run mode with melee weapon and dash enabled:
  - `beforeMove` returns true, calls `move()` directly, sets `dashMode = true`.
  - Uses MeleeAttack animation instead of Run.
  - Damage at weapon frame 2; on cell reach, if still in range, starts full attack.

### Cancelling Movement

- `cancelMovement()` clears destination; current move finishes, then stops.
- Blocked during attack or bow stance.

---

## Monster-Specific Behavior

### AI-Driven Movement

- `autoSwitchToIdle = false` so Monster state is controlled by AI, not by reaching destination.
- `evaluateAI()` runs when not moving and not attacking:
  1. **Attack:** If in attack range → `startAttack()`.
  2. **Follow:** If in follow range and player alive → `moveOneStepTowards(playerX, playerY)`.
  3. **Wander:** Otherwise → pick random destination, `moveOneStepTowards(targetDestinationX, targetDestinationY)`.

### One-Step Movement

- `moveOneStepTowards(targetX, targetY)`:
  - Gets direction via `getNextDirection`.
  - If blocked, uses `findNextMovableDirection`.
  - Calls `move()` for one cell only (no long path).

### Movement Speed

- `movementSpeedDurationMs = 1000 - (movementSpeed/100) * 800` (200–1000 ms per cell).
- Movement sound played once per step in `move()` override.

---

## Knockback

- **Trigger:** `AttackType.InterruptKnockback` on damage.
- **Direction:** `getNextDirection(attackerX, attackerY, victimX, victimY)` → 1 cell away from attacker.
- **Execution:** `applyKnockbackMovement(destX, destY)`:
  - Cancels current movement.
  - Updates world position and tile occupancy.
  - Starts knockback visual interpolation (`knockbackStartWorldX/Y`, `knockbackElapsedMs`).
- **Visual:** `updateKnockbackVisual(delta)` interpolates offset over `KNOCKBACK_DURATION_MS` (100 ms).
- **Fallback:** If destination not movable, uses normal TakeDamage/TakeDamageOnMove.

---

## Stunlock

- **When:** After TakeDamage or TakeDamageOnMove finishes (or when reaching cell with pending stunlock).
- **Duration:** `PLAYER_STUNLOCK_DURATION_MS` (100 ms) or `MONSTER_STUNLOCK_DURATION_MS` (500 ms).
- **Effect:** No movement, attack, or other actions during stunlock.
- **Player:** `onStunlockComplete()` clears destination so the player stays put.

---

## Tile Occupancy

- `markCurrentTileOccupied()`: Call on spawn and when entering a cell.
- `markCurrentTileFree()`: Call before leaving a cell or on destroy.
- `HBMap.setTileOccupied(x, y, occupied)` updates `tile.occupiedByGameObject`.

---

## Pixel Position

- **Base:** `convertWorldPosToPixelPos(worldX/Y)` → cell top-left in pixels.
- **Animated:** `getAnimatedPixelX/Y()` = base + 16 (cell center) + `offsetX/Y`.
- **Depth:** `worldY * DEPTH_MULTIPLIER` for correct layering.

---

## Configuration (Config.ts)

| Constant | Default | Purpose |
|----------|---------|---------|
| `DEFAULT_MOVEMENT_SPEED` | 80 | Player movement speed (0–100). |
| `MONSTER_DEFAULT_MOVEMENT_SPEED` | 50 | Monster movement speed (0–100). |
| `PLAYER_STUNLOCK_DURATION_MS` | 100 | Player stunlock after damage. |
| `MONSTER_STUNLOCK_DURATION_MS` | 500 | Monster stunlock after damage. |
| `KNOCKBACK_DURATION_MS` | 100 | Knockback animation duration. |

---

## Related Files

- `src/game/objects/GameObject.ts` – Base movement logic.
- `src/game/objects/Player.ts` – Player movement, dash, attack target.
- `src/game/objects/Monster.ts` – Monster AI and one-step movement.
- `src/utils/CoordinateUtils.ts` – Direction, pathfinding helpers.
- `src/Config.ts` – Movement and stunlock constants.
