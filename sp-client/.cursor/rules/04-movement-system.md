# Movement System

Grid movement, pathfinding, animation. See `06-core-systems.md` for GameObject/Player. For details: [MOVEMENT_SYSTEM](../../docs/MOVEMENT_SYSTEM.md).

## Coordinates

**World:** integer tiles. **Pixel:** 32px/tile. `convertWorldPosToPixelPos`, `convertPixelPosToWorldPos` (CoordinateUtils.ts). `getDistance()` uses Chebyshev. `Direction` enum 0–7 (N to NW).

**Direction:** `getNextDirection(from,to)` – player-relative. `getDirectionFromScreenSector(cursorX,Y, cameraCenterX,Y)` – camera-relative (prevents zig-zag).

## Movement Modes

**Direct (mouse held):** `getDirectionFromScreenSector`, throttled `MOVEMENT_COMMAND_THROTTLE_MS` (100ms). **Pathfinding:** `getNextDirection`, `findNextMovableDirection()` if blocked.

**Input:** InputManager handles pointer events; GameWorld provides callbacks. Left=move, right=turn when idle.

## GameObject Movement

`setDestination()`, `processMovement()`, `move()`, `canMove()`, `findNextMovableDirection()`. `move()` frees old tile, marks new. `update()` interpolates pixel position; `getAnimatedPixelX/Y()`.

## Helpers

`findMovableLocation(map, startX, startY, maxRadius)` – spiral search for movable+unoccupied tile.

## Movement Speed (Player)

`setMovementSpeed(0–100)` affects duration (500→100ms), frame rate (5→30 FPS), sound speed (0.4→2x). See Player.ts.
