import type { GameAsset } from '../game/objects/GameAsset';
import { TILE_SIZE } from '../game/assets/HBMap';

/**
 * Spatial grid data structure for efficient spatial queries.
 * Divides space into uniform grid cells and stores objects by their grid coordinates.
 * Enables fast lookups of nearby objects without checking every object in the scene.
 */
export class SpatialGrid {
    private readonly cellSize: number;
    private readonly grid: Map<string, GameAsset[]> = new Map();

    /**
     * Creates a new SpatialGrid instance.
     * 
     * @param cellSize - Size of each grid cell in pixels (defaults to TILE_SIZE)
     */
    constructor(cellSize = TILE_SIZE) {
        this.cellSize = cellSize;
    }

    /**
     * Converts world coordinates to a grid cell key.
     * 
     * @param x - X coordinate in pixels
     * @param y - Y coordinate in pixels
     * @returns Grid cell key as "cellX,cellY"
     */
    private getKey(x: number, y: number): string {
        const cellX = Math.floor(x / this.cellSize);
        const cellY = Math.floor(y / this.cellSize);
        return `${cellX},${cellY}`;
    }

    /**
     * Inserts a GameAsset into the spatial grid based on its sprite position.
     * 
     * @param object - GameAsset to insert
     */
    public insert(object: GameAsset): void {
        const key = this.getKey(object.sprite.x, object.sprite.y);
        
        if (!this.grid.has(key)) {
            this.grid.set(key, []);
        }
        
        this.grid.get(key)!.push(object);
    }

    /**
     * Gets all objects within a specified grid cell radius of a point.
     * This method only checks cells within the radius - it does NOT calculate exact distances.
     * Use this as a first pass to filter objects, then perform accurate collision detection.
     * 
     * @param x - X coordinate in pixels
     * @param y - Y coordinate in pixels
     * @param radiusInCells - Radius in grid cells (not pixels)
     * @returns Array of GameAssets in nearby grid cells
     */
    public getNearby(x: number, y: number, radiusInCells: number): GameAsset[] {
        const results: GameAsset[] = [];
        
        // Calculate the center cell coordinates
        const centerCellX = Math.floor(x / this.cellSize);
        const centerCellY = Math.floor(y / this.cellSize);
        
        // Check all cells within the radius
        for (let dy = -radiusInCells; dy <= radiusInCells; dy++) {
            for (let dx = -radiusInCells; dx <= radiusInCells; dx++) {
                const key = `${centerCellX + dx},${centerCellY + dy}`;
                const objects = this.grid.get(key);
                
                if (objects) {
                    results.push(...objects);
                }
            }
        }
        
        return results;
    }

    /**
     * Clears all objects from the spatial grid.
     */
    public clear(): void {
        this.grid.clear();
    }

    /**
     * Gets the total number of objects stored in the spatial grid.
     * 
     * @returns Total object count
     */
    public getTotalObjectCount(): number {
        let count = 0;
        for (const objects of this.grid.values()) {
            count += objects.length;
        }
        return count;
    }

    /**
     * Gets the number of occupied grid cells.
     * 
     * @returns Number of cells containing at least one object
     */
    public getOccupiedCellCount(): number {
        return this.grid.size;
    }
}

/**
 * Builds a spatial grid from objects and returns candidates near a query point.
 * Used for cursor hit testing to avoid linear scan over all objects.
 * Builds the grid on each call; efficient when the result set is much smaller than the full list.
 *
 * @param objects - Objects to index
 * @param getPixelPosition - Returns pixel (x, y) for each object
 * @param queryPixelX - Cursor X in world pixels
 * @param queryPixelY - Cursor Y in world pixels
 * @param radiusInCells - Radius in grid cells (1 = 3x3 cells, 2 = 5x5)
 * @param cellSize - Grid cell size in pixels (default TILE_SIZE)
 * @returns Objects in cells within radius of the query point
 */
export function getObjectsNearPixel<T>(
    objects: T[],
    getPixelPosition: (obj: T) => { x: number; y: number },
    queryPixelX: number,
    queryPixelY: number,
    radiusInCells: number,
    cellSize = TILE_SIZE
): T[] {
    const grid = new Map<string, T[]>();
    for (const obj of objects) {
        const { x, y } = getPixelPosition(obj);
        const cellX = Math.floor(x / cellSize);
        const cellY = Math.floor(y / cellSize);
        const key = `${cellX},${cellY}`;
        if (!grid.has(key)) {
            grid.set(key, []);
        }
        grid.get(key)!.push(obj);
    }
    const centerCellX = Math.floor(queryPixelX / cellSize);
    const centerCellY = Math.floor(queryPixelY / cellSize);
    const results: T[] = [];
    for (let dy = -radiusInCells; dy <= radiusInCells; dy++) {
        for (let dx = -radiusInCells; dx <= radiusInCells; dx++) {
            const key = `${centerCellX + dx},${centerCellY + dy}`;
            const list = grid.get(key);
            if (list) {
                results.push(...list);
            }
        }
    }
    return results;
}

/**
 * Builds a cell map from objects and returns objects at the exact world cell.
 * Used for ground item cursor lookup (cell-based, not pixel bounds).
 *
 * @param objects - Objects to index
 * @param getWorldCell - Returns world (x, y) cell for each object
 * @param queryCellX - Query cell X
 * @param queryCellY - Query cell Y
 * @returns Objects at the query cell
 */
export function getObjectsAtWorldCell<T>(
    objects: T[],
    getWorldCell: (obj: T) => { worldX: number; worldY: number },
    queryCellX: number,
    queryCellY: number
): T[] {
    const grid = new Map<string, T[]>();
    for (const obj of objects) {
        const { worldX, worldY } = getWorldCell(obj);
        const key = `${worldX},${worldY}`;
        if (!grid.has(key)) {
            grid.set(key, []);
        }
        grid.get(key)!.push(obj);
    }
    return grid.get(`${queryCellX},${queryCellY}`) ?? [];
}
