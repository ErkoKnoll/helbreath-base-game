import Phaser from 'phaser';
import type { Scene } from 'phaser';
import { DEPTH_MULTIPLIER } from '../../Config';
import { convertPixelPosToWorldPos } from '../../utils/CoordinateUtils';
import { GameAsset } from '../objects/GameAsset';
import { isTreeSpriteIndex } from '../../utils/SpriteUtils';
import { SpatialGrid } from '../../utils/SpatialGrid';

export const TILE_SIZE = 32; // Each tile is 32x32 pixels
/**
 * Represents a single tile in the map grid.
 * Contains information about sprites, movement, teleports, farming, and tile type.
 */
export class HBMapTile {
    /** The ground sprite/tile index (Int16 at bytes 0-1) */
    public readonly sprite: number;

    /** The ground sprite frame (Int16 at bytes 2-3) */
    public readonly spriteFrame: number;

    /** The object sprite index (Int16 at bytes 4-5) */
    public readonly objectSprite: number;

    /** The object sprite frame (Int16 at bytes 6-7) */
    public readonly objectSpriteFrame: number;

    /** Whether movement is allowed on this tile */
    public readonly isMoveAllowed: boolean;

    /** Whether this tile is a teleport location */
    public readonly isTeleport: boolean;

    /** Whether farming is allowed on this tile */
    public readonly isFarmingAllowed: boolean;

    /** Whether this tile is water */
    public readonly isWater: boolean;

    /** Whether this tile is occupied by a game object */
    public occupiedByGameObject: boolean = false;

    /**
     * Creates a new HBMapTile instance by parsing tile data.
     * 
     * @param data - The raw tile data bytes from the .amd file
     */
    constructor(data: Uint8Array) {

        // Parse sprite indices (little-endian Int16)
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        this.sprite = view.getInt16(0, true);
        this.spriteFrame = view.getInt16(2, true);
        this.objectSprite = view.getInt16(4, true);
        this.objectSpriteFrame = view.getInt16(6, true);

        // Parse flags from byte 8
        const flags = data[8];
        this.isMoveAllowed = (flags & 0x80) === 0;    // Bit 7: 1 = blocked, 0 = allowed
        this.isTeleport = (flags & 0x40) !== 0;       // Bit 6: 1 = teleport
        this.isFarmingAllowed = (flags & 0x20) !== 0; // Bit 5: 1 = blocked, 0 = allowed

        // Tile sprite 19 indicates water
        this.isWater = this.sprite === 19;
    }
}

/**
 * Represents a Helbreath map loaded from an .amd file.
 * Contains map dimensions, tile data, and provides methods to load and access map information.
 */
export class HBMap {
    /** The name of the map file (without path) */
    public readonly fileName: string;

    /** Width of the map in tiles */
    public sizeX = 0;

    /** Height of the map in tiles */
    public sizeY = 0;

    /** Size of each tile data in bytes */
    public tileSize = 0;

    /** 2D array of map tiles [y][x] */
    public tiles: HBMapTile[][] = [];

    /** Whether the map has been successfully loaded */
    private isLoaded = false;

    /** Graphics objects for static non-movable cell highlights (drawn once) */
    private staticNonMovableCellGraphics: Phaser.GameObjects.Graphics[] = [];

    /** Graphics objects for occupied cell highlights (redrawn on changes) */
    private occupiedCellGraphics: Phaser.GameObjects.Graphics[] = [];

    /** Whether non-movable cell highlighting is currently enabled */
    private isNonMovableCellsHighlightEnabled = false;

    /** Graphics objects for teleport cell highlights */
    private teleportCellGraphics: Phaser.GameObjects.Graphics[] = [];

    /** Whether teleport cell highlighting is currently enabled */
    private isTeleportCellsHighlightEnabled = false;

    /** Graphics objects for water cell highlights */
    private waterCellGraphics: Phaser.GameObjects.Graphics[] = [];

    /** Whether water cell highlighting is currently enabled */
    private isWaterCellsHighlightEnabled = false;

    /** Graphics objects for farmable cell highlights */
    private farmableCellGraphics: Phaser.GameObjects.Graphics[] = [];

    /** Whether farmable cell highlighting is currently enabled */
    private isFarmableCellsHighlightEnabled = false;

    /** Graphics object for grid lines */
    private gridLinesGraphics: Phaser.GameObjects.Graphics | undefined = undefined;

    /** Scene reference for refreshing highlights when occupancy changes */
    private sceneRef: Scene | undefined = undefined;

    /** Graphics object for hover cell highlight */
    private hoverCellGraphics: Phaser.GameObjects.Graphics | undefined = undefined;

    /** Whether grid display is currently enabled */
    private isGridDisplayEnabled = false;

    /** Current hover cell world coordinates */
    private hoverCellWorldX: number | undefined = undefined;
    private hoverCellWorldY: number | undefined = undefined;

    /** Spatial grid for efficient object queries (collision detection, etc.) */
    private spatialGrid: SpatialGrid = new SpatialGrid(TILE_SIZE);

    /** The tilemap object created by renderMapTiles */
    private tilemap: Phaser.Tilemaps.Tilemap | undefined = undefined;

    /** The tilemap layer created by renderMapTiles */
    private tilemapLayer: Phaser.Tilemaps.TilemapLayer | undefined = undefined;

    /** The GameAsset instances created by renderMapObjects */
    private mapObjects: GameAsset[] = [];

    /**
     * Creates a new HBMap instance.
     * 
     * @param fileName - The name of the map file (must exist in Phaser's binary cache)
     */
    constructor(fileName: string) {
        this.fileName = fileName;
    }

    /**
     * Loads the map from Phaser's binary cache and parses the .amd file format.
     * The .amd file format consists of:
     * 1. Header (256 bytes): ASCII text containing MAPSIZEX, MAPSIZEY, and TILESIZE values
     * 2. Tile data: Sequential tile data for each tile (row-major order: Y then X)
     * 
     * @param scene - The Phaser scene with access to the binary cache
     * @throws Error if the map buffer is not found in cache or parsing fails
     */
    public load(scene: Scene): void {
        // Load binary from cache using fileName
        const buffer = scene.cache.binary.get(this.fileName) as ArrayBuffer | undefined;

        if (!buffer) {
            throw new Error(`Missing map buffer in cache for ${this.fileName}`);
        }

        // Parse the map file
        this.parseMap(buffer);

        // Remove map file from cache to free up memory (no longer needed after parsing)
        scene.cache.binary.remove(this.fileName);

        this.isLoaded = true;
        console.log(`Map loaded: ${this.fileName} (${this.sizeX}x${this.sizeY}, tileSize: ${this.tileSize})`, this);
    }


    /**
     * Parses the .amd map file format.
     * 
     * @param buffer - The binary data of the .amd file
     */
    private parseMap(buffer: ArrayBuffer): void {
        const view = new Uint8Array(buffer);
        let offset = 0;

        // Read header (256 bytes)
        const headerBytes = view.slice(offset, offset + 256);
        offset += 256;

        // Convert header to ASCII string and parse
        const headerText = new TextDecoder('ascii').decode(headerBytes);
        this.parseHeader(headerText);

        // Validate map dimensions
        if (this.sizeX <= 0 || this.sizeY <= 0 || this.tileSize <= 0) {
            throw new Error(`Invalid map dimensions: ${this.sizeX}x${this.sizeY}, tileSize: ${this.tileSize}`);
        }

        // Initialize tiles array
        this.tiles = [];

        // Read tile data (row-major order: Y then X)
        for (let y = 0; y < this.sizeY; y++) {
            const row: HBMapTile[] = [];

            for (let x = 0; x < this.sizeX; x++) {
                // Read tile data
                const tileData = view.slice(offset, offset + this.tileSize);
                offset += this.tileSize;

                // Create tile
                const tile = new HBMapTile(tileData);
                row.push(tile);
            }

            this.tiles.push(row);
        }
    }

    /**
     * Parses the ASCII header to extract map dimensions and tile size.
     * Header format: "MAPSIZEX = <value> MAPSIZEY = <value> TILESIZE = <value>"
     * 
     * @param headerText - The ASCII header text
     */
    private parseHeader(headerText: string): void {
        // Remove null characters and split by whitespace
        const tokens = headerText.replace(/\0/g, ' ').split(/\s+/).filter(token => token.length > 0);

        // Parse header tokens
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];

            switch (token) {
                case 'MAPSIZEX':
                    // Next token should be '=', value after that
                    if (i + 2 < tokens.length) {
                        this.sizeX = parseInt(tokens[i + 2], 10);
                    }
                    break;

                case 'MAPSIZEY':
                    if (i + 2 < tokens.length) {
                        this.sizeY = parseInt(tokens[i + 2], 10);
                    }
                    break;

                case 'TILESIZE':
                    if (i + 2 < tokens.length) {
                        this.tileSize = parseInt(tokens[i + 2], 10);
                    }
                    break;
            }
        }
    }

    /**
     * Gets a tile at the specified coordinates.
     * 
     * @param x - The x coordinate (column)
     * @param y - The y coordinate (row)
     * @returns The tile at the specified coordinates, or undefined if out of bounds
     */
    public getTile(x: number, y: number): HBMapTile | undefined {
        if (y < 0 || y >= this.sizeY || x < 0 || x >= this.sizeX) {
            return undefined;
        }
        return this.tiles[y][x];
    }

    /**
     * Sets the occupied state of a tile at the specified coordinates.
     * Automatically refreshes non-movable cells highlighting if enabled.
     * 
     * @param x - The x coordinate (column)
     * @param y - The y coordinate (row)
     * @param occupied - Whether the tile is occupied by a game object
     */
    public setTileOccupied(x: number, y: number, occupied: boolean): void {
        const tile = this.getTile(x, y);
        if (tile) {
            const wasOccupied = tile.occupiedByGameObject;
            tile.occupiedByGameObject = occupied;
            
            // Refresh highlighting if occupancy changed and highlighting is enabled
            if (wasOccupied !== occupied && this.isNonMovableCellsHighlightEnabled && this.sceneRef) {
                this.refreshNonMovableCellsHighlight(this.sceneRef);
            }
        }
    }

    /**
     * Checks if a tile is occupied by a game object.
     * 
     * @param x - The x coordinate (column)
     * @param y - The y coordinate (row)
     * @returns True if the tile is occupied, false otherwise (including out of bounds)
     */
    public isTileOccupied(x: number, y: number): boolean {
        const tile = this.getTile(x, y);
        return tile ? tile.occupiedByGameObject : false;
    }

    /**
     * Checks if the map has been successfully loaded.
     * 
     * @returns True if the map is loaded, false otherwise
     */
    public getIsLoaded(): boolean {
        return this.isLoaded;
    }

    /**
     * Paints all map tiles to the scene by creating an optimized tileset and using Phaser's Tilemap API.
     * This method:
     * 1. Identifies unique tiles (sprite+frame combinations) to avoid duplication
     * 2. Creates a compact tileset texture containing only unique tiles
     * 3. Uses Phaser's Tilemap system to efficiently render the map with proper culling and batching
     * 
     * This is a first pass implementation that renders ground tiles only.
     * 
     * @param scene - The Phaser scene to render tiles into
     * @returns The created tilemap object
     * @throws Error if the map is not loaded or required textures are missing
     */
    public renderMapTiles(scene: Phaser.Scene): Phaser.Tilemaps.Tilemap {
        if (!this.isLoaded) {
            throw new Error('Map must be loaded before painting tiles');
        }

        // Step 1: Identify unique tiles (sprite+frame combinations)
        const uniqueTilesMap = new Map<string, UniqueTile>();
        const tileKeys: string[] = []; // Ordered list of tile keys

        // Scan all map tiles to find unique sprite+frame combinations
        for (let y = 0; y < this.sizeY; y++) {
            for (let x = 0; x < this.sizeX; x++) {
                const tile = this.tiles[y][x];

                // Skip tiles with invalid sprite indices
                if (tile.sprite < 0) {
                    continue;
                }

                const tileKey = `${tile.sprite}-${tile.spriteFrame}`;

                if (!uniqueTilesMap.has(tileKey)) {
                    uniqueTilesMap.set(tileKey, {
                        sprite: tile.sprite,
                        spriteFrame: tile.spriteFrame,
                        tilesetIndex: tileKeys.length
                    });
                    tileKeys.push(tileKey);
                }
            }
        }

        const uniqueTileCount = tileKeys.length;
        console.log(`Found ${uniqueTileCount} unique tiles out of ${this.sizeX * this.sizeY} total tiles`);

        // Step 2: Create a compact tileset texture (or reuse if already exists)
        const tilesetKey = `${this.fileName}-tileset`;

        // Check if tileset texture already exists
        if (!scene.textures.exists(tilesetKey)) {
            // Calculate tileset dimensions (arrange tiles in a grid)
            const tilesPerRow = Math.ceil(Math.sqrt(uniqueTileCount));
            const tilesetRows = Math.ceil(uniqueTileCount / tilesPerRow);
            const tilesetWidth = tilesPerRow * TILE_SIZE;
            const tilesetHeight = tilesetRows * TILE_SIZE;

            const tilesetTexture = scene.textures.createCanvas(
                tilesetKey,
                tilesetWidth,
                tilesetHeight
            );

            if (!tilesetTexture) {
                throw new Error('Failed to create tileset texture');
            }

            const tilesetSource = tilesetTexture.getSourceImage();
            if (!(tilesetSource instanceof HTMLCanvasElement)) {
                throw new Error('Tileset texture source is not a canvas');
            }
            
            const tilesetCtx = tilesetSource.getContext('2d');
            if (!tilesetCtx) {
                throw new Error('Failed to get canvas context for tileset');
            }

            // Disable image smoothing for pixel-perfect rendering
            tilesetCtx.imageSmoothingEnabled = false;

            // Draw each unique tile into the tileset
            tileKeys.forEach((tileKey, index) => {
                const uniqueTile = uniqueTilesMap.get(tileKey)!;
                const textureKey = `map-tile-${uniqueTile.sprite}`;

                // Calculate position in tileset (row-major order)
                const tilesetCol = index % tilesPerRow;
                const tilesetRow = Math.floor(index / tilesPerRow);
                const destX = tilesetCol * TILE_SIZE;
                const destY = tilesetRow * TILE_SIZE;

                if (!scene.textures.exists(textureKey)) {
                    console.warn(`Texture not found: ${textureKey}`);
                    return;
                }

                const texture = scene.textures.get(textureKey);
                const frameKey = String(uniqueTile.spriteFrame);

                if (!texture.has(frameKey)) {
                    console.warn(`Frame ${frameKey} not found in texture ${textureKey}`);
                    return;
                }

                const frame = texture.get(frameKey);
                const textureSource = texture.source[0];

                if (!textureSource) {
                    console.warn(`Texture source not found for texture ${textureKey}`);
                    return;
                }

                const sourceImage = textureSource.source;

                if (!sourceImage) {
                    console.warn(`Source image not found for texture ${textureKey}`);
                    return;
                }

                // Verify source is a valid image source for canvas drawImage
                if (!(sourceImage instanceof HTMLCanvasElement || sourceImage instanceof HTMLImageElement || sourceImage instanceof HTMLVideoElement)) {
                    console.warn(`Source for texture ${textureKey} is not a valid image source`);
                    return;
                }

                try {
                    tilesetCtx.drawImage(
                        sourceImage,
                        frame.cutX,
                        frame.cutY,
                        frame.cutWidth,
                        frame.cutHeight,
                        destX,
                        destY,
                        TILE_SIZE,
                        TILE_SIZE
                    );
                } catch (error) {
                    console.warn(`Failed to draw tile ${tileKey} to tileset:`, error);
                }
            });

            tilesetTexture.refresh();

            console.log(`Created tileset: ${tilesetWidth}x${tilesetHeight} pixels (${tilesPerRow}x${tilesetRows} tiles)`);
        } else {
            console.log(`Reusing existing tileset texture: ${tilesetKey}`);
        }

        // Step 3: Create a 2D array for tilemap data
        const mapDataArray: number[][] = [];
        for (let y = 0; y < this.sizeY; y++) {
            const row: number[] = [];
            for (let x = 0; x < this.sizeX; x++) {
                const tile = this.tiles[y][x];

                if (tile.sprite < 0) {
                    row.push(-1); // -1 means no tile
                } else {
                    const tileKey = `${tile.sprite}-${tile.spriteFrame}`;
                    const uniqueTile = uniqueTilesMap.get(tileKey);

                    if (uniqueTile) {
                        // Phaser tilemap indices are 0-based when using ARRAY_2D format
                        // -1 means empty, 0+ are tile indices
                        row.push(uniqueTile.tilesetIndex);
                    } else {
                        row.push(-1);
                    }
                }
            }
            mapDataArray.push(row);
        }

        // Create a tilemap from 2D array
        const tilemap = scene.make.tilemap({
            data: mapDataArray,
            tileWidth: TILE_SIZE,
            tileHeight: TILE_SIZE,
            width: this.sizeX,
            height: this.sizeY
        });

        // Add the tileset to the tilemap
        const tileset = tilemap.addTilesetImage(
            tilesetKey, // tileset name (can be anything, we use the texture key)
            tilesetKey, // texture key in the cache
            TILE_SIZE,
            TILE_SIZE,
            0, // margin
            0  // spacing
        );

        if (!tileset) {
            throw new Error('Failed to add tileset to tilemap');
        }

        // Create a layer using the tileset
        const layer = tilemap.createLayer(0, tileset, 0, 0);

        if (!layer) {
            throw new Error('Failed to create tilemap layer');
        }

        // Set depth to lowest level to ensure tiles render behind all game objects
        layer.setDepth(-1000);

        // Store references for later destruction
        this.tilemap = tilemap;
        this.tilemapLayer = layer;

        console.log(`Map tiles painted: ${this.sizeX}x${this.sizeY} tiles using ${uniqueTileCount} unique tiles`);

        return tilemap;
    }

    /**
     * Renders all map objects (objectSprite and objectSpriteFrame) from the map data.
     * This method iterates through all tiles and creates GameAsset instances for tiles
     * that have valid object sprites (objectSprite >= 0).
     * 
     * NOTE: This method may be called multiple times (once for trees, once for non-trees).
     * Objects are accumulated in the mapObjects array and spatial grid across calls.
     * Call destroyMapObjects() to clear all objects before re-rendering.
     * 
     * @param scene - The Phaser scene to render objects into
     * @param drawTree - If true, only tree objects (sprite 100-145) will be created. If false, all objects except trees will be created.
     * @returns An array of GameAsset instances that were created
     * @throws Error if the map is not loaded
     */
    public renderMapObjects(scene: Phaser.Scene, drawTree = false): GameAsset[] {
        if (!this.isLoaded) {
            throw new Error('Map must be loaded before rendering objects');
        }

        // Clear spatial grid on first call (when mapObjects is empty)
        // This ensures we start fresh when rendering a new set of objects
        if (this.mapObjects.length === 0) {
            this.spatialGrid.clear();
        }

        const gameAssets: GameAsset[] = [];
        let objectCount = 0;

        // Iterate through all map tiles
        for (let y = 0; y < this.sizeY; y++) {
            for (let x = 0; x < this.sizeX; x++) {
                const tile = this.tiles[y][x];

                // Skip tiles without valid object sprites (< 0 or 0)
                if (tile.objectSprite <= 0) {
                    continue;
                }

                // Skip creating these static map objects. Middleland seems to be littered with these, which can cause WebGL canvas to run out of memory.
                // Besides these are placed in map tile layers anyway, original developers probably changed their minds how these tiles should be placed and didn't clean up after.
                if (tile.objectSprite === 6 || tile.objectSprite === 7 || tile.objectSprite === 9 || tile.objectSprite === 24) {
                    continue;
                }

                // Check if this is a tree object (sprite 100-145 = Trees1)
                const isTree = isTreeSpriteIndex(tile.objectSprite);

                // Filter based on drawTree parameter
                if (drawTree && !isTree) {
                    continue; // If drawTree is true, skip non-tree objects
                }
                if (!drawTree && isTree) {
                    continue; // If drawTree is false, skip tree objects
                }

                // Calculate world position in pixels
                const worldX = x * TILE_SIZE;
                const worldY = y * TILE_SIZE;

                try {
                    // Create GameAsset for this object using legacy map object format
                    const gameAsset = new GameAsset(scene, {
                        x: worldX,
                        y: worldY,
                        spriteName: `map-tile-${tile.objectSprite}`,
                        mapObject: true, // Use legacy index-based texture lookup
                        frameIndex: tile.objectSpriteFrame
                    });

                    // Set depth based on world position Y (tile Y coordinate * DEPTH_MULTIPLIER)
                    gameAsset.setDepth(y * DEPTH_MULTIPLIER);

                    gameAssets.push(gameAsset);
                    objectCount++;
                } catch (error) {
                    console.warn(
                        `Failed to create object at (${x}, ${y}) with sprite ${tile.objectSprite}, frame ${tile.objectSpriteFrame}:`,
                        error
                    );
                }
            }
        }

        console.log(`Map objects rendered: ${objectCount} objects created`);

        // Store references for later destruction
        this.mapObjects.push(...gameAssets);

        // Add objects to spatial grid for efficient collision detection
        // NOTE: Do NOT clear the grid here - renderMapObjects may be called multiple times
        // (once for trees, once for non-trees) and we want to keep all objects in the grid
        for (const gameAsset of gameAssets) {
            this.spatialGrid.insert(gameAsset);
        }

        console.log(`Spatial grid updated: ${this.spatialGrid.getOccupiedCellCount()} cells occupied, ${this.spatialGrid.getTotalObjectCount()} objects indexed`);

        return gameAssets;
    }

    /**
     * Gets all map objects that were created by renderMapObjects.
     * 
     * @returns An array of GameAsset instances representing map objects
     */
    public getMapObjects(): GameAsset[] {
        return this.mapObjects;
    }

    /**
     * Gets the spatial grid for efficient object queries.
     * Use this for collision detection and other spatial queries instead of iterating all map objects.
     * 
     * @returns The SpatialGrid instance containing all map objects
     */
    public getSpatialGrid(): SpatialGrid {
        return this.spatialGrid;
    }

    /**
     * Returns the tilemap layer for rendering.
     * 
     * @returns The Phaser TilemapLayer instance, or undefined if not yet rendered
     */
    public getTilemapLayer(): Phaser.Tilemaps.TilemapLayer | undefined {
        return this.tilemapLayer;
    }

    /**
     * Disables and destroys all highlight graphics (non-movable, teleport, water, farmable, grid).
     * Call before destroyMapObjects to ensure no orphaned graphics remain in the scene.
     */
    public destroyAllHighlights(): void {
        this.disableNonMovableCellsHighlight();
        this.disableTeleportCellsHighlight();
        this.disableWaterCellsHighlight();
        this.disableFarmableCellsHighlight();
        this.disableGridDisplay();
    }

    /**
     * Destroys all map objects created by renderMapObjects.
     */
    public destroyMapObjects(): void {
        // Destroy all GameAsset instances (if they still exist)
        // Note: Objects may already be destroyed by Phaser when scene shuts down
        this.mapObjects.forEach(gameAsset => {
            try {
                if (gameAsset && gameAsset.scene) {
                    gameAsset.destroy();
                }
            } catch (error) {
                // Ignore errors if object is already destroyed
                console.warn('Error destroying map object (may already be destroyed):', error);
            }
        });

        // Clear the array
        this.mapObjects = [];

        // Clear the spatial grid
        this.spatialGrid.clear();

        console.log('Map objects destroyed');
    }

    /**
     * Enables highlighting of non-movable cells by drawing red, semi-transparent rectangles.
     * Also highlights cells occupied by game objects with orange color.
     * Static non-movable cells are drawn once, occupied cells are redrawn on changes.
     * If highlighting is already enabled, this method does nothing to avoid re-rendering.
     * 
     * @param scene - The Phaser scene to render highlights into
     */
    public enableNonMovableCellsHighlight(scene: Scene): void {
        if (!this.isLoaded) {
            throw new Error('Map must be loaded before enabling non-movable cell highlighting');
        }

        // Store scene reference for automatic refresh on occupancy changes
        this.sceneRef = scene;

        // If already enabled, don't re-render
        if (this.isNonMovableCellsHighlightEnabled) {
            return;
        }

        // Draw static non-movable cells (only cells that are permanently blocked by map data)
        for (let y = 0; y < this.sizeY; y++) {
            for (let x = 0; x < this.sizeX; x++) {
                const tile = this.tiles[y][x];

                // Only draw permanently non-movable tiles (red)
                if (!tile.isMoveAllowed) {
                    // Calculate world position in pixels
                    const worldX = x * TILE_SIZE;
                    const worldY = y * TILE_SIZE;

                    // Create a graphics object for this cell
                    const graphics = scene.add.graphics();

                    // Red for non-movable tiles
                    graphics.fillStyle(0xff0000, 0.5);

                    // Draw a rectangle covering the entire cell
                    graphics.fillRect(worldX, worldY, TILE_SIZE, TILE_SIZE);

                    // Set depth to render above tiles but below objects
                    graphics.setDepth(1);

                    // Store the graphics object for later cleanup
                    this.staticNonMovableCellGraphics.push(graphics);
                }
            }
        }

        this.isNonMovableCellsHighlightEnabled = true;
        console.log(`Non-movable cell highlighting enabled: ${this.staticNonMovableCellGraphics.length} static cells highlighted`);
        
        // Draw initial occupied cells (orange)
        this.updateOccupiedCellsHighlight(scene);
    }

    /**
     * Updates only the occupied cells highlighting (orange rectangles).
     * This is much more efficient than redrawing all cells since typically
     * there are far fewer occupied cells than static non-movable cells.
     * 
     * @param scene - The Phaser scene to render highlights into
     */
    private updateOccupiedCellsHighlight(scene: Scene): void {
        // Destroy all existing occupied cell graphics
        this.occupiedCellGraphics.forEach(graphics => {
            graphics.destroy();
        });
        this.occupiedCellGraphics = [];

        // Redraw only occupied cells
        for (let y = 0; y < this.sizeY; y++) {
            for (let x = 0; x < this.sizeX; x++) {
                const tile = this.tiles[y][x];

                // Only draw occupied cells that are otherwise movable (orange)
                if (tile.occupiedByGameObject && tile.isMoveAllowed) {
                    // Calculate world position in pixels
                    const worldX = x * TILE_SIZE;
                    const worldY = y * TILE_SIZE;

                    // Create a graphics object for this cell
                    const graphics = scene.add.graphics();

                    // Orange for occupied tiles
                    graphics.fillStyle(0xff8800, 0.5);

                    // Draw a rectangle covering the entire cell
                    graphics.fillRect(worldX, worldY, TILE_SIZE, TILE_SIZE);

                    // Set depth to render above tiles but below objects
                    graphics.setDepth(1);

                    // Store the graphics object for later cleanup
                    this.occupiedCellGraphics.push(graphics);
                }
            }
        }
    }

    /**
     * Disables highlighting of non-movable cells by destroying all previously created graphics objects.
     */
    public disableNonMovableCellsHighlight(): void {
        if (!this.isNonMovableCellsHighlightEnabled) {
            return;
        }

        // Destroy all static non-movable cell graphics
        this.staticNonMovableCellGraphics.forEach(graphics => {
            graphics.destroy();
        });
        this.staticNonMovableCellGraphics = [];

        // Destroy all occupied cell graphics
        this.occupiedCellGraphics.forEach(graphics => {
            graphics.destroy();
        });
        this.occupiedCellGraphics = [];

        this.isNonMovableCellsHighlightEnabled = false;
        this.sceneRef = undefined;

        console.log('Non-movable cell highlighting disabled');
    }

    /**
     * Refreshes only the occupied cells highlighting to reflect current occupancy state.
     * This is much more efficient than redrawing all cells.
     * 
     * @param scene - The Phaser scene to render highlights into
     */
    public refreshNonMovableCellsHighlight(scene: Scene): void {
        if (!this.isNonMovableCellsHighlightEnabled) {
            return;
        }

        // Only update occupied cells, not static non-movable cells
        this.updateOccupiedCellsHighlight(scene);
    }

    /**
     * Enables highlighting of teleport cells by drawing blue, semi-transparent rectangles.
     * If highlighting is already enabled, this method does nothing to avoid re-rendering.
     * 
     * @param scene - The Phaser scene to render highlights into
     */
    public enableTeleportCellsHighlight(scene: Scene): void {
        if (!this.isLoaded) {
            throw new Error('Map must be loaded before enabling teleport cell highlighting');
        }

        // If already enabled, don't re-render
        if (this.isTeleportCellsHighlightEnabled) {
            return;
        }

        // Iterate through all map tiles and highlight teleport ones
        for (let y = 0; y < this.sizeY; y++) {
            for (let x = 0; x < this.sizeX; x++) {
                const tile = this.tiles[y][x];

                // Check if this tile is a teleport location
                if (tile.isTeleport) {
                    // Calculate world position in pixels
                    const worldX = x * TILE_SIZE;
                    const worldY = y * TILE_SIZE;

                    // Create a graphics object for this cell
                    const graphics = scene.add.graphics();

                    // Set fill style: blue color with 50% transparency (0x80 = 128/255 ≈ 50%)
                    graphics.fillStyle(0x0000ff, 0.5);

                    // Draw a rectangle covering the entire cell
                    graphics.fillRect(worldX, worldY, TILE_SIZE, TILE_SIZE);

                    // Set depth to render above tiles but below objects (or adjust as needed)
                    graphics.setDepth(1);

                    // Store the graphics object for later cleanup
                    this.teleportCellGraphics.push(graphics);
                }
            }
        }

        this.isTeleportCellsHighlightEnabled = true;
        console.log(`Teleport cell highlighting enabled: ${this.teleportCellGraphics.length} cells highlighted`);
    }

    /**
     * Disables highlighting of teleport cells by destroying all previously created graphics objects.
     */
    public disableTeleportCellsHighlight(): void {
        if (!this.isTeleportCellsHighlightEnabled) {
            return;
        }

        // Destroy all graphics objects
        this.teleportCellGraphics.forEach(graphics => {
            graphics.destroy();
        });

        // Clear the array
        this.teleportCellGraphics = [];
        this.isTeleportCellsHighlightEnabled = false;

        console.log('Teleport cell highlighting disabled');
    }

    /**
     * Enables highlighting of water cells by drawing purple, semi-transparent rectangles.
     * If highlighting is already enabled, this method does nothing to avoid re-rendering.
     * 
     * @param scene - The Phaser scene to render highlights into
     */
    public enableWaterCellsHighlight(scene: Scene): void {
        if (!this.isLoaded) {
            throw new Error('Map must be loaded before enabling water cell highlighting');
        }

        // If already enabled, don't re-render
        if (this.isWaterCellsHighlightEnabled) {
            return;
        }

        // Iterate through all map tiles and highlight water ones
        for (let y = 0; y < this.sizeY; y++) {
            for (let x = 0; x < this.sizeX; x++) {
                const tile = this.tiles[y][x];

                // Check if this tile is water
                if (tile.isWater) {
                    // Calculate world position in pixels
                    const worldX = x * TILE_SIZE;
                    const worldY = y * TILE_SIZE;

                    // Create a graphics object for this cell
                    const graphics = scene.add.graphics();

                    // Set fill style: purple color with 50% transparency (0x80 = 128/255 ≈ 50%)
                    graphics.fillStyle(0x8000ff, 0.5);

                    // Draw a rectangle covering the entire cell
                    graphics.fillRect(worldX, worldY, TILE_SIZE, TILE_SIZE);

                    // Set depth to render above tiles but below objects (or adjust as needed)
                    graphics.setDepth(1);

                    // Store the graphics object for later cleanup
                    this.waterCellGraphics.push(graphics);
                }
            }
        }

        this.isWaterCellsHighlightEnabled = true;
        console.log(`Water cell highlighting enabled: ${this.waterCellGraphics.length} cells highlighted`);
    }

    /**
     * Disables highlighting of water cells by destroying all previously created graphics objects.
     */
    public disableWaterCellsHighlight(): void {
        if (!this.isWaterCellsHighlightEnabled) {
            return;
        }

        // Destroy all graphics objects
        this.waterCellGraphics.forEach(graphics => {
            graphics.destroy();
        });

        // Clear the array
        this.waterCellGraphics = [];
        this.isWaterCellsHighlightEnabled = false;

        console.log('Water cell highlighting disabled');
    }

    /**
     * Enables highlighting of farmable cells by drawing brown, semi-transparent rectangles.
     * If highlighting is already enabled, this method does nothing to avoid re-rendering.
     * 
     * @param scene - The Phaser scene to render highlights into
     */
    public enableFarmableCellsHighlight(scene: Scene): void {
        if (!this.isLoaded) {
            throw new Error('Map must be loaded before enabling farmable cell highlighting');
        }

        // If already enabled, don't re-render
        if (this.isFarmableCellsHighlightEnabled) {
            return;
        }

        // Iterate through all map tiles and highlight farmable ones
        for (let y = 0; y < this.sizeY; y++) {
            for (let x = 0; x < this.sizeX; x++) {
                const tile = this.tiles[y][x];

                // Check if farming is allowed on this tile
                if (tile.isFarmingAllowed) {
                    // Calculate world position in pixels
                    const worldX = x * TILE_SIZE;
                    const worldY = y * TILE_SIZE;

                    // Create a graphics object for this cell
                    const graphics = scene.add.graphics();

                    // Set fill style: brown color with 50% transparency (0x80 = 128/255 ≈ 50%)
                    graphics.fillStyle(0x8b4513, 0.5);

                    // Draw a rectangle covering the entire cell
                    graphics.fillRect(worldX, worldY, TILE_SIZE, TILE_SIZE);

                    // Set depth to render above tiles but below objects (or adjust as needed)
                    graphics.setDepth(1);

                    // Store the graphics object for later cleanup
                    this.farmableCellGraphics.push(graphics);
                }
            }
        }

        this.isFarmableCellsHighlightEnabled = true;
        console.log(`Farmable cell highlighting enabled: ${this.farmableCellGraphics.length} cells highlighted`);
    }

    /**
     * Disables highlighting of farmable cells by destroying all previously created graphics objects.
     */
    public disableFarmableCellsHighlight(): void {
        if (!this.isFarmableCellsHighlightEnabled) {
            return;
        }

        // Destroy all graphics objects
        this.farmableCellGraphics.forEach(graphics => {
            graphics.destroy();
        });

        // Clear the array
        this.farmableCellGraphics = [];
        this.isFarmableCellsHighlightEnabled = false;

        console.log('Farmable cell highlighting disabled');
    }

    /**
     * Enables grid display by drawing black grid lines at cell boundaries.
     * Grid lines run at the intersection points of cells to highlight cell boundaries.
     * Also sets up hover cell highlighting that updates on mouse movement.
     * 
     * @param scene - The Phaser scene to render grid into
     */
    public enableGridDisplay(scene: Scene): void {
        if (!this.isLoaded) {
            throw new Error('Map must be loaded before enabling grid display');
        }

        // If already enabled, don't re-render
        if (this.isGridDisplayEnabled) {
            return;
        }

        // Create graphics object for grid lines
        this.gridLinesGraphics = scene.add.graphics();
        this.gridLinesGraphics.setDepth(2); // Render above tiles but below objects

        // Set line style once for all lines
        this.gridLinesGraphics.lineStyle(1, 0x000000, 1); // Black, fully opaque

        // Draw vertical grid lines
        for (let x = 0; x <= this.sizeX; x++) {
            const pixelX = x * TILE_SIZE;
            this.gridLinesGraphics.lineBetween(pixelX, 0, pixelX, this.sizeY * TILE_SIZE);
        }

        // Draw horizontal grid lines
        for (let y = 0; y <= this.sizeY; y++) {
            const pixelY = y * TILE_SIZE;
            this.gridLinesGraphics.lineBetween(0, pixelY, this.sizeX * TILE_SIZE, pixelY);
        }

        // Create graphics object for hover cell highlight
        this.hoverCellGraphics = scene.add.graphics();
        this.hoverCellGraphics.setDepth(3); // Render above grid lines

        this.isGridDisplayEnabled = true;
        console.log('Grid display enabled');
    }

    /**
     * Disables grid display by destroying grid graphics objects.
     */
    public disableGridDisplay(): void {
        if (!this.isGridDisplayEnabled) {
            return;
        }

        // Destroy grid lines graphics
        if (this.gridLinesGraphics) {
            this.gridLinesGraphics.destroy();
            this.gridLinesGraphics = undefined;
        }

        // Destroy hover cell graphics
        if (this.hoverCellGraphics) {
            this.hoverCellGraphics.destroy();
            this.hoverCellGraphics = undefined;
        }

        this.hoverCellWorldX = undefined;
        this.hoverCellWorldY = undefined;
        this.isGridDisplayEnabled = false;

        console.log('Grid display disabled');
    }

    /**
     * Updates the hover cell highlight based on mouse world coordinates.
     * Should be called whenever the mouse moves.
     * 
     * @param scene - The Phaser scene (needed to recreate graphics if destroyed)
     * @param worldX - Mouse world X coordinate in pixels
     * @param worldY - Mouse world Y coordinate in pixels
     */
    public updateHoverCell(scene: Scene, worldX: number, worldY: number): void {
        if (!this.isGridDisplayEnabled) {
            return;
        }

        // Convert pixel coordinates to world grid coordinates
        const gridX = convertPixelPosToWorldPos(worldX);
        const gridY = convertPixelPosToWorldPos(worldY);

        // Check if hover cell changed
        if (this.hoverCellWorldX === gridX && this.hoverCellWorldY === gridY) {
            return; // No change, skip update
        }

        // Recreate hover graphics if it was destroyed
        if (!this.hoverCellGraphics) {
            this.hoverCellGraphics = scene.add.graphics();
            this.hoverCellGraphics.setDepth(3);
        }

        // Clear previous hover cell
        this.hoverCellGraphics.clear();

        // Check if mouse is within map bounds
        if (gridX >= 0 && gridX < this.sizeX && gridY >= 0 && gridY < this.sizeY) {
            // Calculate pixel position of the cell
            const cellPixelX = gridX * TILE_SIZE;
            const cellPixelY = gridY * TILE_SIZE;

            // Draw green rectangle highlighting the cell
            this.hoverCellGraphics.fillStyle(0x00ff00, 0.3); // Green, 30% opacity
            this.hoverCellGraphics.fillRect(cellPixelX, cellPixelY, TILE_SIZE, TILE_SIZE);

            // Draw green border
            this.hoverCellGraphics.lineStyle(2, 0x00ff00, 1); // Green, fully opaque
            this.hoverCellGraphics.strokeRect(cellPixelX, cellPixelY, TILE_SIZE, TILE_SIZE);
        }

        this.hoverCellWorldX = gridX;
        this.hoverCellWorldY = gridY;
    }

    /**
     * Destroys the tilemap and layer created by renderMapTiles, and removes the tileset texture
     * from the Phaser texture cache to prevent memory leaks when switching maps.
     *
     * @param scene - The Phaser scene (needed to access texture cache for cleanup)
     */
    public destroyMapTiles(scene: Phaser.Scene): void {
        if (this.tilemapLayer) {
            try {
                this.tilemapLayer.destroy();
            } catch (error) {
                // Ignore errors if layer is already destroyed
                console.warn('Error destroying tilemap layer (may already be destroyed):', error);
            }
            this.tilemapLayer = undefined;
        }

        if (this.tilemap) {
            try {
                this.tilemap.destroy();
            } catch (error) {
                // Ignore errors if tilemap is already destroyed
                console.warn('Error destroying tilemap (may already be destroyed):', error);
            }
            this.tilemap = undefined;
        }

        // Remove tileset texture from cache to prevent memory leak when switching maps
        const tilesetKey = `${this.fileName}-tileset`;
        if (scene.textures.exists(tilesetKey)) {
            try {
                scene.textures.remove(tilesetKey);
            } catch (error) {
                console.warn('Error removing tileset texture from cache:', error);
            }
        }

        console.log('Map tiles destroyed');
    }
}

interface UniqueTile {
    sprite: number;
    spriteFrame: number;
    tilesetIndex: number; // Index in our new tileset (0-based)
}
