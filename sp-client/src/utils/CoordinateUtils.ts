import type { Game } from 'phaser';
import type { HBMap } from '../game/assets/HBMap';
import { TILE_SIZE } from '../game/assets/HBMap';

/**
 * Converts canvas/viewport coordinates to screen (DOM) coordinates.
 * Handles both normal and fullscreen modes. In fullscreen, the canvas is scaled
 * and centered; in normal mode, coordinates are offset by the canvas bounding rect.
 *
 * @param canvasX - X coordinate in canvas/viewport space
 * @param canvasY - Y coordinate in canvas/viewport space
 * @param game - Phaser game instance (provides config, scale, canvas)
 * @returns Screen position { screenX, screenY } in DOM pixels
 */
export function canvasToScreenPosition(
    canvasX: number,
    canvasY: number,
    game: Game
): { screenX: number; screenY: number } {
    const canvas = game.canvas;
    const rect = canvas.getBoundingClientRect();

    if (game.scale.isFullscreen) {
        const baseWidth = Number(game.config.width);
        const baseHeight = Number(game.config.height);
        const scale = Math.min(window.innerWidth / baseWidth, window.innerHeight / baseHeight);
        const canvasCenterX = window.innerWidth / 2;
        const canvasCenterY = window.innerHeight / 2;
        return {
            screenX: canvasCenterX + (canvasX - baseWidth / 2) * scale,
            screenY: canvasCenterY + (canvasY - baseHeight / 2) * scale,
        };
    }

    return {
        screenX: rect.left + canvasX,
        screenY: rect.top + canvasY,
    };
}

/**
 * Converts pixel coordinate to world coordinate based on tile size (32x32 pixels).
 * Uses bitwise right shift (>> 5) for optimized division by 32.
 *
 * @param pixelCoordinate - Coordinate in pixels
 * @returns World coordinate
 */
export function convertPixelPosToWorldPos(pixelCoordinate: number): number {
    return pixelCoordinate >> 5; // Divide by 32 using bitwise right shift (2^5 = 32)
}

/**
 * Converts world coordinate to pixel coordinate based on tile size (32x32 pixels).
 * Uses bitwise left shift (<< 5) for optimized multiplication by 32.
 *
 * @param worldCoordinate - World coordinate
 * @returns Coordinate in pixels
 */
export function convertWorldPosToPixelPos(worldCoordinate: number): number {
    return worldCoordinate << 5; // Multiply by 32 using bitwise left shift (2^5 = 32)
}

/**
 * Returns a random pixel offset (dx, dy) within the given radius in cells.
 * Uses polar coordinates for uniform distribution in a circle.
 */
export function randomPixelInRadius(radiusCells: number): { dx: number; dy: number } {
    if (radiusCells <= 0) {
        return { dx: 0, dy: 0 };
    }
    const radiusPx = radiusCells * TILE_SIZE;
    const angle = Phaser.Math.FloatBetween(0, 2 * Math.PI);
    const r = Math.sqrt(Phaser.Math.FloatBetween(0, 1)) * radiusPx;
    return {
        dx: Math.cos(angle) * r,
        dy: Math.sin(angle) * r,
    };
}

/**
 * Direction enumeration matching the 8 directional sprites.
 */
export enum Direction {
    None = -1,
    North = 0,
    NorthEast = 1,
    East = 2,
    SouthEast = 3,
    South = 4,
    SouthWest = 5,
    West = 6,
    NorthWest = 7,
}

/**
 * Validates and converts a number to a Direction enum value.
 * Returns Direction.None if the value is not a valid direction.
 * 
 * @param value - The numeric value to convert (0-7)
 * @returns The corresponding Direction enum value
 */
export function toDirection(value: number): Direction {
    if (value >= 0 && value <= 7) {
        return value as Direction;
    }
    return Direction.None;
}

/**
 * Delta offsets for each direction (dx, dy).
 * North = (0, -1), NorthEast = (1, -1), East = (1, 0), etc.
 * Used for knockback and movement calculations.
 */
const DIRECTION_OFFSET: Record<Direction, [number, number]> = {
    [Direction.North]: [0, -1],
    [Direction.NorthEast]: [1, -1],
    [Direction.East]: [1, 0],
    [Direction.SouthEast]: [1, 1],
    [Direction.South]: [0, 1],
    [Direction.SouthWest]: [-1, 1],
    [Direction.West]: [-1, 0],
    [Direction.NorthWest]: [-1, -1],
    [Direction.None]: [0, 0],
};

/**
 * Gets the cell offset for a direction (for knockback: 1 cell in that direction).
 *
 * @param direction - The direction to get offset for
 * @returns [dx, dy] offset for one cell in that direction
 */
export function getDirectionOffset(direction: Direction): [number, number] {
    return DIRECTION_OFFSET[direction] ?? [0, 0];
}

/**
 * Calculates the next direction from source to destination in grid coordinates.
 *
 * @param sourceX - Source X coordinate in world grid
 * @param sourceY - Source Y coordinate in world grid
 * @param destinationX - Destination X coordinate in world grid
 * @param destinationY - Destination Y coordinate in world grid
 * @returns Direction to move towards destination
 */
export function getNextDirection(
    sourceX: number,
    sourceY: number,
    destinationX: number,
    destinationY: number,
): Direction {
    const x = sourceX - destinationX;
    const y = sourceY - destinationY;

    if (x === 0 && y === 0) {
        return Direction.None;
    }

    if (x === 0) {
        if (y > 0) {
            return Direction.North;
        }
        if (y < 0) {
            return Direction.South;
        }
    }
    if (y === 0) {
        if (x > 0) {
            return Direction.West;
        }
        if (x < 0) {
            return Direction.East;
        }
    }
    if (x > 0 && y > 0) {
        return Direction.NorthWest;
    }
    if (x < 0 && y > 0) {
        return Direction.NorthEast;
    }
    if (x > 0 && y < 0) {
        return Direction.SouthWest;
    }
    if (x < 0 && y < 0) {
        return Direction.SouthEast;
    }

    return Direction.None;
}

/**
 * Calculates direction based on screen sectors (8 equal 45-degree sectors).
 * Divides the screen into 8 sectors centered on the camera, regardless of player position.
 * This prevents zig-zagging when cursor is near sector boundaries.
 * 
 * Sector layout (degrees from positive X-axis, counter-clockwise):
 * - East: -22.5° to 22.5°
 * - NorthEast: 22.5° to 67.5°
 * - North: 67.5° to 112.5°
 * - NorthWest: 112.5° to 157.5°
 * - West: 157.5° to -157.5° (wraps around at 180°/-180°)
 * - SouthWest: -157.5° to -112.5°
 * - South: -112.5° to -67.5°
 * - SouthEast: -67.5° to -22.5°
 *
 * @param cursorPixelX - Cursor X position in world pixels
 * @param cursorPixelY - Cursor Y position in world pixels
 * @param cameraCenterPixelX - Camera center X position in world pixels
 * @param cameraCenterPixelY - Camera center Y position in world pixels
 * @returns Direction sector the cursor is in
 */
export function getDirectionFromScreenSector(
    cursorPixelX: number,
    cursorPixelY: number,
    cameraCenterPixelX: number,
    cameraCenterPixelY: number,
): Direction {
    // Calculate vector from camera center to cursor
    const dx = cursorPixelX - cameraCenterPixelX;
    const dy = cursorPixelY - cameraCenterPixelY;
    
    // If cursor is at camera center, no direction
    if (dx === 0 && dy === 0) {
        return Direction.None;
    }
    
    // Calculate angle in radians from positive X-axis, counter-clockwise.
    // In screen coordinates Y increases downward, so we use (dx, -dy) for correct angle.
    const angleRadians = Phaser.Math.Angle.Between(0, 0, dx, -dy);
    
    // Convert to degrees
    let angleDegrees = angleRadians * (180 / Math.PI);
    
    // Normalize to 0-360 range
    if (angleDegrees < 0) {
        angleDegrees += 360;
    }
    
    // Map angle to direction (8 sectors of 45 degrees each, offset by 22.5° so East centers on 0°)
    const sector = Math.floor((angleDegrees + 22.5) / 45) % 8;
    switch (sector) {
        case 0:
            return Direction.East;
        case 1:
            return Direction.NorthEast;
        case 2:
            return Direction.North;
        case 3:
            return Direction.NorthWest;
        case 4:
            return Direction.West;
        case 5:
            return Direction.SouthWest;
        case 6:
            return Direction.South;
        case 7:
            return Direction.SouthEast;
        default:
            return Direction.SouthEast;
    }
}

/**
 * Finds the nearest movable location by spiraling outward from the initial position.
 * Checks tiles in expanding square patterns until a movable tile is found.
 * 
 * @param map - The HBMap instance to check tiles against
 * @param startX - Starting X coordinate in world grid
 * @param startY - Starting Y coordinate in world grid
 * @param maxRadius - Maximum radius to search (default: 50 tiles)
 * @returns Object with x and y coordinates of the first movable location found, or undefined if none found
 */
export function findMovableLocation(
    map: HBMap,
    startX: number,
    startY: number,
    maxRadius = 50
): { x: number; y: number } | undefined {
    // First check if the starting position is movable and not occupied
    const startTile = map.getTile(startX, startY);
    if (startTile && startTile.isMoveAllowed && !startTile.occupiedByGameObject) {
        return { x: startX, y: startY };
    }

    // Spiral outward from the starting position
    // We check tiles in expanding square patterns: 1x1, 3x3, 5x5, etc.
    for (let radius = 1; radius <= maxRadius; radius++) {
        // Check all tiles in the square at this radius
        // Top edge (left to right)
        for (let x = startX - radius; x <= startX + radius; x++) {
            const y = startY - radius;
            if (y >= 0 && y < map.sizeY && x >= 0 && x < map.sizeX) {
                const tile = map.getTile(x, y);
                if (tile && tile.isMoveAllowed && !tile.occupiedByGameObject) {
                    return { x, y };
                }
            }
        }
        
        // Right edge (top to bottom, excluding corners already checked)
        for (let y = startY - radius + 1; y <= startY + radius; y++) {
            const x = startX + radius;
            if (y >= 0 && y < map.sizeY && x >= 0 && x < map.sizeX) {
                const tile = map.getTile(x, y);
                if (tile && tile.isMoveAllowed && !tile.occupiedByGameObject) {
                    return { x, y };
                }
            }
        }
        
        // Bottom edge (right to left, excluding corners already checked)
        for (let x = startX + radius - 1; x >= startX - radius; x--) {
            const y = startY + radius;
            if (y >= 0 && y < map.sizeY && x >= 0 && x < map.sizeX) {
                const tile = map.getTile(x, y);
                if (tile && tile.isMoveAllowed && !tile.occupiedByGameObject) {
                    return { x, y };
                }
            }
        }
        
        // Left edge (bottom to top, excluding corners already checked)
        for (let y = startY + radius - 1; y >= startY - radius + 1; y--) {
            const x = startX - radius;
            if (y >= 0 && y < map.sizeY && x >= 0 && x < map.sizeX) {
                const tile = map.getTile(x, y);
                if (tile && tile.isMoveAllowed && !tile.occupiedByGameObject) {
                    return { x, y };
                }
            }
        }
    }

    // No movable location found within maxRadius
    return undefined;
}

/**
 * Checks if a cell is movable (allows movement and is not occupied by another game object).
 *
 * @param map - The HBMap instance to check tiles against
 * @param x - X coordinate in world grid
 * @param y - Y coordinate in world grid
 * @returns True if the cell can be moved to
 */
export function isCellMovable(map: HBMap, x: number, y: number): boolean {
    const tile = map.getTile(x, y);
    return !!(tile && tile.isMoveAllowed && !tile.occupiedByGameObject);
}

/**
 * Calculates the Chebyshev distance between two points in world coordinates.
 * Uses Chebyshev distance (max of absolute differences in x and y), which is appropriate
 * for diagonal movement in grid-based games.
 * 
 * @param x1 - First point X coordinate
 * @param y1 - First point Y coordinate
 * @param x2 - Second point X coordinate
 * @param y2 - Second point Y coordinate
 * @returns Chebyshev distance between the two points
 */
export function getDistance(x1: number, y1: number, x2: number, y2: number): number {
    const dx = Math.abs(x1 - x2);
    const dy = Math.abs(y1 - y2);
    
    // Use Chebyshev distance (diagonal movement)
    return Math.max(dx, dy);
}
