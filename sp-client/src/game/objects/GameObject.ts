import type { Scene } from 'phaser';
import { GameAsset, type GameAssetConfig } from './GameAsset';
import { FloatingText } from '../effects/FloatingText';
import { convertWorldPosToPixelPos, Direction, getDirectionOffset, getNextDirection, getDirectionFromScreenSector, isCellMovable, toDirection } from '../../utils/CoordinateUtils';
import { TILE_SIZE } from '../assets/HBMap';
import { SoundManager } from '../../utils/SoundManager';
import { SoundTracker } from '../../utils/SoundTracker';
import { DEFAULT_MOVEMENT_SPEED, DEPTH_MULTIPLIER, KNOCKBACK_DURATION_MS } from '../../Config';
import { HBMap } from '../assets/HBMap';
import type { ShadowManager } from '../../utils/ShadowManager';

export enum GameObjectState {
    Idle = 0,
    Move = 1,
}

/**
 * Configuration for creating a GameObject instance.
 */
type GameObjectConfig = {
    /** X coordinate in world map position (will be converted to pixels) */
    x: number;
    
    /** Y coordinate in world map position (will be converted to pixels) */
    y: number;
    
    /** List of GameAsset configurations to render at this GameObject's position (x and y will be set automatically) */
    assets: Omit<GameAssetConfig, 'x' | 'y'>[];
    
    /** SoundManager instance for playing sound effects */
    soundManager: SoundManager;
    
    /** HBMap instance for collision checking and occupancy tracking */
    map: HBMap;
    
    /** Stunlock duration in ms when TakeDamageOnMove completes at cell. 0 disables stunlock. Default 0. */
    stunlockDurationMs?: number;
};

/**
 * Represents a game object that can contain multiple GameAssets.
 * Position is specified in world map coordinates and converted to pixels for rendering.
 */
export abstract class GameObject {
    /** The Phaser scene this object belongs to */
    protected scene: Scene;
    
    /** World X coordinate */
    protected worldX: number;
    
    /** World Y coordinate */
    protected worldY: number;
    
    /** List of GameAssets associated with this GameObject */
    protected assets: GameAsset[];
    
    /** SoundTracker instance for tracking sounds per state */
    protected soundTracker: SoundTracker;

    /** Current direction the GameObject is facing */
    protected direction: Direction;

    /** Destination in world grid coordinates */
    protected destinationX: number = -1;
    protected destinationY: number = -1;

    /** Whether the GameObject is currently moving */
    protected isMoving: boolean = false;

    /** Whether the GameObject is ready to move */
    protected moveReady: boolean = true;

    /** Whether to automatically switch to Idle state when reaching destination (can be overridden by subclasses) */
    protected autoSwitchToIdle: boolean = true;

    /** Whether direct movement mode is enabled (move cell-by-cell towards mouse) */
    protected isDirectMovementMode: boolean = false;

    /** Reference point (e.g. player anchor) in world pixels for screen sector calculation */
    protected cameraCenterPixelX: number = 0;
    protected cameraCenterPixelY: number = 0;

    /** Cursor position in world pixels for direct movement direction (avoids cell top-left offset) */
    protected cursorPixelX: number = 0;
    protected cursorPixelY: number = 0;
    protected hasCursorPixel: boolean = false;

    /** Current pixel offset from grid position for smooth animation */
    protected offsetX: number = 0;
    protected offsetY: number = 0;

    /** Time elapsed during current movement in milliseconds */
    protected movementElapsedTime: number = 0;

    /** Movement speed (0-100) */
    protected movementSpeed: number = DEFAULT_MOVEMENT_SPEED;

    /** Total duration for one tile movement in milliseconds */
    /** Calculated from DEFAULT_MOVEMENT_SPEED: 500ms (min/slow) to 100ms (max/fast) */
    protected movementSpeedDurationMs: number = 500 - (DEFAULT_MOVEMENT_SPEED / 100) * (500 - 100);

    /** Previous move X coordinate (for blocked move tracking) */
    protected prevMoveX: number = -1;
    
    /** Previous move Y coordinate (for blocked move tracking) */
    protected prevMoveY: number = -1;

    /** Whether the previous move was blocked */
    protected isPrevMoveBlocked: boolean = false;

    /** Player turn direction (0 = forward search, 1 = backward search) */
    protected playerTurn: number = 0;

    /** Map instance for collision checking */
    protected map: HBMap;

    /** Optional shadow manager for rendering shadow beneath the GameObject */
    protected shadowManager?: ShadowManager;

    /** Knockback animation elapsed time in milliseconds */
    protected knockbackElapsedMs: number = 0;

    /** World coordinates of knockback source cell (for visual interpolation). -1 when not active. */
    protected knockbackStartWorldX: number = -1;
    protected knockbackStartWorldY: number = -1;

    /** Estimated height in pixels. Set by subclasses (e.g. Monster). Used for damage indicator positioning and other purposes. Defaults to 2 cell heights when undefined. */
    protected height: number | undefined;

    /** Hit points. When reduced below 1 by acceptDamage, announceDeath is called. */
    protected hp: number = 100;

    /** Maximum hit points. Defaults to 100. */
    protected maxHp: number = 100;

    /** Stunlock elapsed time in ms (-1 = not active). Used when TakeDamageOnMove completes at cell. */
    protected stunlockElapsedMs: number = -1;

    /** When true, start stunlock when movement completes after TakeDamageOnMove. */
    protected pendingStunlockAfterMovement: boolean = false;

    /** Stunlock duration in ms. 0 disables stunlock. Set via constructor config. */
    protected stunlockDurationMs: number = 0;

    /**
     * Creates a new GameObject instance.
     * 
     * @param scene - The Phaser scene to add the object to
     * @param config - Configuration object specifying world position and assets
     * @param config.x - X coordinate in world map position (will be converted to pixels for GameAssets)
     * @param config.y - Y coordinate in world map position (will be converted to pixels for GameAssets)
     * @param config.soundManager - SoundManager instance for playing sound effects
     * @param config.map - HBMap instance for collision checking and occupancy tracking
     */
    constructor(scene: Scene, config: GameObjectConfig) {
        this.scene = scene;
        this.worldX = config.x;
        this.worldY = config.y;
        this.assets = [];
        this.map = config.map;

        // Convert world coordinates to pixel coordinates
        const pixelX = convertWorldPosToPixelPos(config.x);
        const pixelY = convertWorldPosToPixelPos(config.y);

        // Create GameAssets at the pixel position
        for (const assetConfig of config.assets) {
            const asset = new GameAsset(scene, {
                ...assetConfig,
                x: pixelX,
                y: pixelY,
            });
            
            // Set depth based on world position Y (world Y coordinate * DEPTH_MULTIPLIER)
            asset.setDepth(this.worldY * DEPTH_MULTIPLIER);
            
            this.assets.push(asset);
        }
        
        // Create SoundTracker instance for tracking sounds per state
        this.soundTracker = new SoundTracker(config.soundManager);

        this.stunlockDurationMs = config.stunlockDurationMs ?? 0;
        
        // Mark initial spawn location as occupied
        this.markCurrentTileOccupied();
    }

    /**
     * Marks the current tile as occupied in the map.
     * Should be called after map is set and when GameObject spawns.
     */
    protected markCurrentTileOccupied(): void {
        if (this.map) {
            this.map.setTileOccupied(this.worldX, this.worldY, true);
        }
    }

    /**
     * Marks the current tile as free in the map.
     * Should be called before moving or destroying the GameObject.
     */
    protected markCurrentTileFree(): void {
        if (this.map) {
            this.map.setTileOccupied(this.worldX, this.worldY, false);
        }
    }

    /**
     * Gets the world X coordinate
     */
    public getWorldX(): number {
        return this.worldX;
    }

    /**
     * Gets the world Y coordinate
     */
    public getWorldY(): number {
        return this.worldY;
    }

    /**
     * Gets the estimated height of this GameObject in pixels (sprite height).
     * Used for effect positioning (e.g., centering projectiles on target).
     *
     * @returns Height in pixels, or 2 * TILE_SIZE when undefined
     */
    public getHeight(): number {
        return this.height ?? 2 * TILE_SIZE;
    }

    /**
     * Gets the bounding rectangle of the primary asset in world coordinates.
     * Used for hit testing (e.g., click detection on monsters).
     *
     * @returns Bounds object or undefined if no assets
     */
    public getBounds(): { x: number; y: number; width: number; height: number } | undefined {
        return this.assets[0]?.getBounds();
    }

    /**
     * Returns true if the given asset's animation is currently playing.
     *
     * @param asset - The GameAsset to check
     * @returns True when the asset's animation is playing
     */
    protected isAssetAnimationPlaying(asset: GameAsset): boolean {
        return asset.isAnimationPlaying();
    }

    /**
     * Returns true if the primary (first) asset's animation is currently playing.
     * Returns false when there are no assets.
     *
     * @returns True when the primary asset's animation is playing
     */
    protected isPrimaryAssetAnimationPlaying(): boolean {
        const primaryAsset = this.assets[0];
        return primaryAsset ? this.isAssetAnimationPlaying(primaryAsset) : false;
    }

    /**
     * Gets the pixel X coordinate
     */
    public getPixelX(): number {
        return convertWorldPosToPixelPos(this.worldX);
    }

    /**
     * Gets the pixel Y coordinate
     */
    public getPixelY(): number {
        return convertWorldPosToPixelPos(this.worldY);
    }

    /**
     * Gets the animated pixel X coordinate including movement offset.
     * This returns the actual visual position during movement animation.
     * Centers the object in the cell by adding 16 pixels (half of 32px cell size).
     * 
     * @returns The animated pixel X coordinate
     */
    public getAnimatedPixelX(): number {
        const basePixelX = convertWorldPosToPixelPos(this.worldX);
        // Add 16 to center the object in the 32x32 cell
        return basePixelX + 16 + this.offsetX;
    }

    /**
     * Gets the animated pixel Y coordinate including movement offset.
     * This returns the actual visual position during movement animation.
     * Centers the object in the cell by adding 16 pixels (half of 32px cell size).
     * 
     * @returns The animated pixel Y coordinate
     */
    public getAnimatedPixelY(): number {
        const basePixelY = convertWorldPosToPixelPos(this.worldY);
        // Add 16 to center the object in the 32x32 cell
        return basePixelY + 16 + this.offsetY;
    }

    /**
     * Gets the current depth of this GameObject based on world Y position.
     * 
     * @returns The depth value (worldY * DEPTH_MULTIPLIER)
     */
    public getDepth(): number {
        return this.worldY * DEPTH_MULTIPLIER;
    }

    /**
     * Sets the destination for the GameObject to move towards.
     * Called when a target location is set.
     * If the GameObject is currently moving, the new destination will be processed
     * when it reaches the next cell boundary.
     * 
     * @param destinationX - Target X coordinate in world grid
     * @param destinationY - Target Y coordinate in world grid
     * @param useDirectMovement - If true, moves cell-by-cell in direction of destination (default: false for pathfinding)
     * @param cameraCenterPixelX - Reference point X in world pixels (e.g. player anchor)
     * @param cameraCenterPixelY - Reference point Y in world pixels
     * @param cursorPixelX - Cursor X in world pixels (for accurate direction; uses cell top-left if omitted)
     * @param cursorPixelY - Cursor Y in world pixels
     */
    public setDestination(
        destinationX: number,
        destinationY: number,
        useDirectMovement: boolean = false,
        cameraCenterPixelX?: number,
        cameraCenterPixelY?: number,
        cursorPixelX?: number,
        cursorPixelY?: number
    ): void {
        this.destinationX = destinationX;
        this.destinationY = destinationY;
        this.isDirectMovementMode = useDirectMovement;
        
        if (cameraCenterPixelX !== undefined && cameraCenterPixelY !== undefined) {
            this.cameraCenterPixelX = cameraCenterPixelX;
            this.cameraCenterPixelY = cameraCenterPixelY;
        }
        if (cursorPixelX !== undefined && cursorPixelY !== undefined) {
            this.cursorPixelX = cursorPixelX;
            this.cursorPixelY = cursorPixelY;
            this.hasCursorPixel = true;
        } else {
            this.hasCursorPixel = false;
        }
        
        // Try to start moving immediately if ready
        if (this.moveReady) {
            this.processMovement();
        }
    }

    /**
     * Cancels movement by clearing the destination.
     * The GameObject will continue moving until it reaches its next intended cell and then stops.
     * This allows the current movement animation to complete smoothly.
     */
    public cancelMovement(): void {
        // Clear destination - GameObject will stop after reaching next cell
        this.destinationX = -1;
        this.destinationY = -1;
    }

    /**
     * Checks if the GameObject is currently moving.
     * 
     * @returns True if the GameObject is moving, false otherwise
     */
    public getIsMoving(): boolean {
        return this.isMoving;
    }

    /**
     * Updates the depth of all assets based on current world Y position.
     * Should be called when the GameObject's world Y position changes.
     */
    protected updateDepth(): void {
        const depth = this.worldY * DEPTH_MULTIPLIER;
        for (const asset of this.assets) {
            asset.setDepth(depth);
        }
    }

    /**
     * Updates the shadow sprite position to match the GameObject's current position.
     */
    protected updateShadowPosition(): void {
        this.shadowManager?.setWorldPosition(this.worldX, this.worldY);
        this.shadowManager?.setOffset(this.offsetX, this.offsetY);
    }

    /**
     * Updates the shadow depth to render just below the GameObject.
     */
    protected updateShadowDepth(): void {
        if (!this.shadowManager || this.assets.length === 0) {
            return;
        }
        
        // Shadow should render just below the GameObject
        this.shadowManager.updateDepth(this.getDepth());
    }

    /**
     * Computes the knockback destination cell (1 cell away from attacker).
     * Returns undefined if knockback is not possible (same cell, invalid direction, or destination not movable).
     *
     * @param attackerWorldX - Attacker's world X coordinate
     * @param attackerWorldY - Attacker's world Y coordinate
     * @returns Destination coordinates or undefined if knockback cannot be applied
     */
    protected computeKnockbackDestination(
        attackerWorldX: number,
        attackerWorldY: number
    ): { destX: number; destY: number } | undefined {
        const knockbackDirection = getNextDirection(attackerWorldX, attackerWorldY, this.worldX, this.worldY);
        if (knockbackDirection === Direction.None) {
            return undefined;
        }
        const [dx, dy] = getDirectionOffset(knockbackDirection);
        const destX = this.worldX + dx;
        const destY = this.worldY + dy;
        return isCellMovable(this.map, destX, destY) ? { destX, destY } : undefined;
    }

    /**
     * Applies knockback movement: moves this GameObject to the destination cell.
     * Cancels any in-progress movement, updates tile occupancy, and starts knockback visual interpolation.
     * Caller must switch to TakeDamageWithKnockback state and play take damage sound.
     *
     * @param destX - Knockback destination world X
     * @param destY - Knockback destination world Y
     */
    protected applyKnockbackMovement(destX: number, destY: number): void {
        const sourceX = this.worldX;
        const sourceY = this.worldY;

        if (this.isMoving) {
            this.cancelMovement();
            this.isMoving = false;
            this.moveReady = true;
            this.offsetX = 0;
            this.offsetY = 0;
        }

        this.markCurrentTileFree();
        this.worldX = destX;
        this.worldY = destY;
        this.markCurrentTileOccupied();

        this.knockbackStartWorldX = sourceX;
        this.knockbackStartWorldY = sourceY;
        this.knockbackElapsedMs = 0;

        this.onPositionChanged(this.worldX, this.worldY);
    }

    /**
     * Returns true if knockback visual interpolation is currently active.
     */
    protected isKnockbackActive(): boolean {
        return this.knockbackStartWorldX >= 0;
    }

    /**
     * Updates knockback visual interpolation. Call from subclass update() when in TakeDamageWithKnockback state.
     * Returns true when knockback animation is complete (progress reached 100%).
     *
     * @param delta - Time elapsed since last frame in milliseconds
     * @returns True when knockback is complete
     */
    protected updateKnockbackVisual(delta: number): boolean {
        if (this.knockbackStartWorldX < 0) {
            return false;
        }
        this.knockbackElapsedMs += delta;
        const progress = Math.min(1, this.knockbackElapsedMs / KNOCKBACK_DURATION_MS);
        const pixelOffsetPerCell = TILE_SIZE;
        this.offsetX = (this.knockbackStartWorldX - this.worldX) * pixelOffsetPerCell * (1 - progress);
        this.offsetY = (this.knockbackStartWorldY - this.worldY) * pixelOffsetPerCell * (1 - progress);
        this.updatePixelPosition();

        if (progress >= 1) {
            this.knockbackStartWorldX = -1;
            this.knockbackStartWorldY = -1;
            this.offsetX = 0;
            this.offsetY = 0;
            this.updatePixelPosition();
            this.onKnockbackComplete();
            return true;
        }
        return false;
    }

    /**
     * Hook called when knockback visual interpolation completes.
     * Subclasses can override (e.g. Player starts stunlock).
     */
    protected onKnockbackComplete(): void {
        // Default implementation does nothing
    }

    /**
     * Checks if moving in the specified direction from the current position is allowed.
     * 
     * @param direction - Direction to check
     * @returns True if movement is allowed, false otherwise
     */
    protected canMove(direction: Direction): boolean {
        if (direction === Direction.None) {
            return false;
        }
        const [dx, dy] = getDirectionOffset(direction);
        const nextX = this.worldX + dx;
        const nextY = this.worldY + dy;

        // Check bounds
        if (nextX < 0 || nextX >= this.map.sizeX || nextY < 0 || nextY >= this.map.sizeY) {
            return false;
        }
        
        // Check if tile allows movement
        const tile = this.map.getTile(nextX, nextY);
        if (!tile) {
            return false;
        }
        
        // Check if tile is occupied by another game object
        if (tile.occupiedByGameObject) {
            return false;
        }
        
        return tile.isMoveAllowed;
    }

    /**
     * Abstract method to switch the GameObject's state.
     * Subclasses should implement this to map GameObjectState to their specific state enum.
     * 
     * @param state - The GameObjectState to switch to
     * @param forceUpdate - If true, updates animation even if state hasn't changed (for direction changes)
     */
    protected abstract switchState(state: GameObjectState, forceUpdate?: boolean): void;

    /**
     * Hook method called when the GameObject's position changes during movement.
     * Subclasses can override this to handle position updates (e.g., updating GameStateManager).
     *
     * @param newX - New world X coordinate
     * @param newY - New world Y coordinate
     */
    protected onPositionChanged(_newX: number, _newY: number): void {
        // Default implementation does nothing
        // Subclasses can override to handle position updates
    }

    /**
     * Returns true when in TakeDamageOnMove state (damage received while moving between cells).
     * Subclasses override to report their take-damage-on-move state.
     */
    protected isInTakeDamageOnMoveState(): boolean {
        return false;
    }

    /**
     * Returns true if stunlocked (cannot move, attack, or perform actions).
     */
    protected isStunlocked(): boolean {
        return this.stunlockDurationMs > 0 && this.stunlockElapsedMs >= 0 && this.stunlockElapsedMs < this.stunlockDurationMs;
    }

    /**
     * Starts the stunlock timer. Call when TakeDamageOnMove completes at a cell.
     */
    protected startStunlock(): void {
        this.stunlockElapsedMs = 0;
    }

    /**
     * Marks that stunlock should start when the next cell is reached (TakeDamageOnMove during movement).
     */
    protected setPendingStunlockAfterMovement(): void {
        this.pendingStunlockAfterMovement = true;
    }

    /**
     * Hook called when a destination cell is reached (each cell along the path, not just the final one).
     * Handles stunlock: when in TakeDamageOnMove or pending, starts stunlock.
     * Subclasses may override and call super.onCellReached() for additional behavior.
     */
    protected onCellReached(): void {
        if (this.isInTakeDamageOnMoveState() || this.pendingStunlockAfterMovement) {
            this.pendingStunlockAfterMovement = false;
            this.startStunlock();
        }
    }

    /**
     * Returns true if movement should pause when a cell is reached instead of continuing.
     * Default: pause when in TakeDamageOnMove or pending stunlock.
     * Subclasses may override and call super for additional conditions.
     */
    protected shouldPauseMovementWhenCellReached(): boolean {
        return this.isInTakeDamageOnMoveState() || this.pendingStunlockAfterMovement;
    }

    /**
     * Ticks the stunlock timer. Call from subclass update().
     * When stunlock completes, calls onStunlockComplete().
     *
     * @param delta - Time elapsed since last frame in milliseconds
     */
    protected updateStunlock(delta: number): void {
        if (this.stunlockElapsedMs < 0) {
            return;
        }
        this.stunlockElapsedMs += delta;
        if (this.stunlockElapsedMs >= this.stunlockDurationMs) {
            this.stunlockElapsedMs = -1;
            this.onStunlockComplete();
        }
    }

    /**
     * Hook called when stunlock timer completes. Subclasses override (e.g. Player clears destination).
     */
    protected onStunlockComplete(): void {
        // Default implementation does nothing
    }

    /**
     * Initiates movement in the specified direction.
     * 
     * @param direction - Direction to move
     */
    protected move(direction: Direction): void {
        if (direction === Direction.None) {
            return;
        }
        const [dx, dy] = getDirectionOffset(direction);

        // Free the current tile before moving
        this.markCurrentTileFree();

        this.worldX += dx;
        this.worldY += dy;

        // Mark the new tile as occupied
        this.markCurrentTileOccupied();
        
        // Notify subclass of position change
        this.onPositionChanged(this.worldX, this.worldY);
        
        // Update direction if it changed
        const directionChanged = this.direction !== direction;
        if (directionChanged) {
            this.direction = direction;
        }
        
        // Switch to Move state, forcing update if direction changed
        this.switchState(GameObjectState.Move, directionChanged);
        
        // Start movement animation
        this.isMoving = true;
        this.moveReady = false;
        this.movementElapsedTime = 0;
        
        // Set initial offset to starting position (-TILE_SIZE pixels in opposite direction of movement)
        // This ensures smooth transition when continuing from one tile to the next
        switch (direction) {
            case Direction.North:
                this.offsetX = 0;
                this.offsetY = TILE_SIZE; // Moving up, start from below
                break;
            case Direction.NorthEast:
                this.offsetX = -TILE_SIZE; // Moving right, start from left
                this.offsetY = TILE_SIZE; // Moving up, start from below
                break;
            case Direction.East:
                this.offsetX = -TILE_SIZE; // Moving right, start from left
                this.offsetY = 0;
                break;
            case Direction.SouthEast:
                this.offsetX = -TILE_SIZE; // Moving right, start from left
                this.offsetY = -TILE_SIZE; // Moving down, start from above
                break;
            case Direction.South:
                this.offsetX = 0;
                this.offsetY = -TILE_SIZE; // Moving down, start from above
                break;
            case Direction.SouthWest:
                this.offsetX = TILE_SIZE; // Moving left, start from right
                this.offsetY = -TILE_SIZE; // Moving down, start from above
                break;
            case Direction.West:
                this.offsetX = TILE_SIZE; // Moving left, start from right
                this.offsetY = 0;
                break;
            case Direction.NorthWest:
                this.offsetX = TILE_SIZE; // Moving left, start from right
                this.offsetY = TILE_SIZE; // Moving up, start from below
                break;
        }
    }

    /**
     * Processes movement logic - determines next step and initiates movement.
     * Called when destination is set or when current movement completes.
     */
    protected processMovement(): void {
        // Check if we've reached the destination
        if (this.destinationX === -1 || this.destinationY === -1) {
            return;
        }
        
        if (this.worldX === this.destinationX && this.worldY === this.destinationY) {
            // Reached destination
            this.destinationX = -1;
            this.destinationY = -1;
            this.isDirectMovementMode = false;
            
            // Ensure GameObject is in idle state
            this.isMoving = false;
            this.moveReady = true;
            this.switchState(GameObjectState.Idle);
            
            return;
        }
        
        // Not ready to move yet
        if (!this.moveReady) {
            return;
        }
        
        // Calculate direction to move
        let nextDirection: Direction;
        
        // Direct movement mode: calculate direction based on screen sectors (cursor position relative to player anchor)
        // Use actual cursor pixel position when available; otherwise fall back to destination cell top-left
        if (this.isDirectMovementMode) {
            const cursorPixelX = this.hasCursorPixel
                ? this.cursorPixelX
                : convertWorldPosToPixelPos(this.destinationX);
            const cursorPixelY = this.hasCursorPixel
                ? this.cursorPixelY
                : convertWorldPosToPixelPos(this.destinationY);

            nextDirection = getDirectionFromScreenSector(
                cursorPixelX,
                cursorPixelY,
                this.cameraCenterPixelX,
                this.cameraCenterPixelY
            );
        } else {
            // Pathfinding mode: calculate direction based on player position relative to destination
            nextDirection = getNextDirection(
                this.worldX,
                this.worldY,
                this.destinationX,
                this.destinationY
            );
        }
        
        if (nextDirection === Direction.None) {
            return;
        }
        
        // Direct movement mode: try to move directly in the calculated direction
        // If blocked, switch to pathfinding mode
        if (this.isDirectMovementMode) {
            if (this.canMove(nextDirection)) {
                // Direct path is clear, move in that direction
                this.move(nextDirection);
                return;
            } else {
                // Direct path is blocked, switch to pathfinding mode
                this.isDirectMovementMode = false;
                // Recalculate direction relative to player for pathfinding
                nextDirection = getNextDirection(
                    this.worldX,
                    this.worldY,
                    this.destinationX,
                    this.destinationY
                );
                // Continue to pathfinding logic below
            }
        }
        
        // Pathfinding mode: find the next movable direction (may be different if original direction is blocked)
        const movableDirection = this.findNextMovableDirection(nextDirection);
        
        if (movableDirection === Direction.None) {
            // Cannot move in any direction - mark as blocked and alternate playerTurn
            this.isPrevMoveBlocked = true;
            this.prevMoveX = this.worldX;
            this.prevMoveY = this.worldY;
            
            // Alternate playerTurn to change search order next time
            this.playerTurn = this.playerTurn === 0 ? 1 : 0;
            
            // Stop trying to reach destination
            this.destinationX = -1;
            this.destinationY = -1;
            this.isDirectMovementMode = false;
            
            // Stop movement and switch back to idle animation
            this.isMoving = false;
            this.moveReady = true;
            this.switchState(GameObjectState.Idle);
            
            return;
        }
        
        // Clear blocked move tracking when we find a valid direction
        this.isPrevMoveBlocked = false;
        this.prevMoveX = -1;
        this.prevMoveY = -1;
        
        // Hook for subclasses to intercept before move (e.g. dash mode)
        if (this.beforeMove(movableDirection)) {
            return;
        }
        // Start running in that direction
        this.move(movableDirection);
    }

    /**
     * Hook called before move() is invoked. Subclasses may override to handle special movement
     * (e.g. dash attack). Return true to indicate the move was handled and base should not call move().
     */
    protected beforeMove(_direction: Direction): boolean {
        return false;
    }

    /**
     * Finds the next movable direction.
     * Checks the preferred direction and up to 2 adjacent directions based on playerTurn.
     * 
     * @param direction - Preferred direction to move
     * @returns A movable direction, or Direction.None if no direction is movable
     */
    protected findNextMovableDirection(direction: Direction): Direction {
        // If already at destination, return None
        if (this.worldX === this.destinationX && this.worldY === this.destinationY) {
            return Direction.None;
        }
        
        // Direction offset arrays mapping directly to TypeScript Direction enum (0-7)
        // Direction.North (0), NorthEast (1), East (2), SouthEast (3), South (4), SouthWest (5), West (6), NorthWest (7)
        const dirOffsetX = [0, 1, 1, 1, 0, -1, -1, -1];
        const dirOffsetY = [-1, -1, 0, 1, 1, 1, 0, -1];
        
        // Check directions based on playerTurn
        // playerTurn 0: check from direction to direction+2 (forward)
        // playerTurn 1: check from direction to direction-2 (backward)
        const startDir = direction;
        const endDir = this.playerTurn === 0 ? direction + 2 : direction - 2;
        const step = this.playerTurn === 0 ? 1 : -1;
        
        for (let i = startDir; this.playerTurn === 0 ? i <= endDir : i >= endDir; i += step) {
            let tmpDir = i;
            
            // Wrap around
            if (tmpDir > 7) {
                tmpDir -= 8;
            } else if (tmpDir < 0) {
                tmpDir += 8;
            }
            
            const dirX = dirOffsetX[tmpDir];
            const dirY = dirOffsetY[tmpDir];
            const nextX = this.worldX + dirX;
            const nextY = this.worldY + dirY;
            
            // Check if this is the previous blocked move
            if (nextX === this.prevMoveX && nextY === this.prevMoveY && this.isPrevMoveBlocked) {
                // Clear the blocked flag and skip this direction
                this.isPrevMoveBlocked = false;
                continue;
            }
            
            // Check if location is locateable (movable)
            const direction = toDirection(tmpDir);
            if (this.canMove(direction)) {
                // If it's a teleport location, we still allow movement
                return direction;
            }
        }
        
        // No movable direction found
        return Direction.None;
    }

    /**
     * Updates the pixel position of all assets based on current world position and offset.
     */
    protected updatePixelPosition(): void {
        const finalPixelX = this.getAnimatedPixelX();
        const finalPixelY = this.getAnimatedPixelY();
        
        // Update depth based on current world Y position
        this.updateDepth();
        
        // Update all assets to the new pixel position
        // Skip position updates for static map objects
        for (const asset of this.assets) {
            if (!asset.isMapObject()) {
                asset.setPosition(finalPixelX, finalPixelY);
            }
        }
        
        // Update shadow position and depth
        this.updateShadowPosition();
        this.updateShadowDepth();
    }

    /**
     * Updates the GameObject's position during movement animation.
     * Should be called every frame by the scene's update loop.
     * 
     * @param delta - Time elapsed since last frame in milliseconds
     */
    public update(delta: number): void {
        if (!this.isMoving) {
            return;
        }
        
        // Accumulate elapsed time
        this.movementElapsedTime += delta;
        
        // Calculate progress as a value from 0 to 1
        const progress = Math.min(this.movementElapsedTime / this.movementSpeedDurationMs, 1.0);
        
        // Calculate pixel offset based on progress (smooth interpolation)
        // Progress goes from 0 to 1, we need offset from -TILE_SIZE to 0
        const totalOffset = -TILE_SIZE * (1 - progress);
        
        // Apply offset based on direction
        // Offsets are in the OPPOSITE direction of movement (to animate from old to new position)
        // totalOffset is negative (e.g., -32 at progress 0, moving toward 0 at progress 1)
        this.offsetX = 0;
        this.offsetY = 0;
        
        switch (this.direction) {
            case Direction.North:
                // Moving up (Y--), offset moves from +32 to 0
                this.offsetY = -totalOffset;
                break;
            case Direction.NorthEast:
                // Moving up-right (Y--, X++), offset moves from (+32, -32) to (0, 0)
                this.offsetX = totalOffset;
                this.offsetY = -totalOffset;
                break;
            case Direction.East:
                // Moving right (X++), offset moves from -32 to 0
                this.offsetX = totalOffset;
                break;
            case Direction.SouthEast:
                // Moving down-right (Y++, X++), offset moves from (-32, -32) to (0, 0)
                this.offsetX = totalOffset;
                this.offsetY = totalOffset;
                break;
            case Direction.South:
                // Moving down (Y++), offset moves from -32 to 0
                this.offsetY = totalOffset;
                break;
            case Direction.SouthWest:
                // Moving down-left (Y++, X--), offset moves from (-32, +32) to (0, 0)
                this.offsetX = -totalOffset;
                this.offsetY = totalOffset;
                break;
            case Direction.West:
                // Moving left (X--), offset moves from +32 to 0
                this.offsetX = -totalOffset;
                break;
            case Direction.NorthWest:
                // Moving up-left (Y--, X--), offset moves from (+32, +32) to (0, 0)
                this.offsetX = -totalOffset;
                this.offsetY = -totalOffset;
                break;
        }
        
        // Update pixel position with offset
        this.updatePixelPosition();
        
        // Check if movement animation is complete (progress reached 100%)
        if (progress >= 1.0) {
            this.moveReady = true;
            this.movementElapsedTime = 0;
            this.offsetX = 0;
            this.offsetY = 0;

            // Capture pause decision before onCellReached (which may modify subclass state)
            const shouldPause = this.shouldPauseMovementWhenCellReached();
            this.onCellReached();

            // Check if destination was cleared (cancelMovement was called)
            if (this.destinationX === -1 || this.destinationY === -1) {
                // Destination was cancelled - stop moving
                this.isMoving = false;

                // Switch to idle state
                this.switchState(GameObjectState.Idle);

                // Update pixel position to final grid position
                this.updatePixelPosition();
            } else if (this.worldX === this.destinationX && this.worldY === this.destinationY) {
                // Final destination reached - stop moving
                this.isMoving = false;
                this.destinationX = -1;
                this.destinationY = -1;

                // Clear previous move tracking
                this.isPrevMoveBlocked = false;
                this.prevMoveX = -1;
                this.prevMoveY = -1;

                // Switch to idle state only if autoSwitchToIdle is enabled
                // This allows subclasses (like Monster) to defer state management to their AI logic
                if (this.autoSwitchToIdle) {
                    this.switchState(GameObjectState.Idle);
                }

                // Update pixel position to final grid position
                this.updatePixelPosition();
            } else if (shouldPause) {
                // Subclass requested pause (e.g. stunlock) - stop at this cell
                this.isMoving = false;

                this.switchState(GameObjectState.Idle);

                // Update pixel position to final grid position
                this.updatePixelPosition();
            } else {
                // Continue moving towards destination
                // processMovement() will call move() which sets up the next movement with correct initial offset
                this.processMovement();

                // Update pixel position with new movement's initial offset
                this.updatePixelPosition();
            }
        }
    }

    /** Returns current hit points. */
    public getHp(): number {
        return this.hp;
    }

    /** Returns maximum hit points. */
    public getMaxHp(): number {
        return this.maxHp;
    }

    /**
     * Overridable hook called when hp drops below 1 after taking damage.
     * Subclasses can override to handle death (e.g. switch to Dead state).
     */
    protected announceDeath(): void {
        // Default: no-op
    }

    /**
     * Creates a floating damage indicator above the GameObject.
     * Subclasses can call this from acceptDamage with a custom originY for positioning.
     *
     * @param damage - The damage amount (displayed as negative, e.g. 30 → -30)
     * @param originY - Y position in pixels where the text originates (travels upward from here)
     */
    protected createDamageFloatingText(damage: number, originY: number): void {
        new FloatingText(this.scene, {
            text: String(-damage),
            x: this.getAnimatedPixelX(),
            y: originY,
            fontSize: 16,
            color: '#ff0000',
            bold: true,
            horizontalOffset: -2,
            upwardTravelPxPerSec: 30,
            totalDurationMs: 2000,
            fadeDurationMs: 1000,
        });
    }

    /**
     * Accepts damage and displays a floating damage indicator above the GameObject.
     * Subtracts damage from hp; when hp < 1, calls announceDeath.
     *
     * @param damage - The damage amount taken (displayed as negative, e.g. 30 → -30)
     */
    public acceptDamage(damage: number): void {
        this.hp -= damage;
        if (this.hp < 1) {
            this.announceDeath();
        }
        const offsetY = this.height ?? 2 * TILE_SIZE;
        this.createDamageFloatingText(damage, this.getAnimatedPixelY() - offsetY);
    }

    /**
     * Destroys the GameObject and all associated GameAssets.
     */
    public destroy(): void {
        // Free the current tile before destroying
        this.markCurrentTileFree();
        
        // Destroy shadow manager if it exists
        if (this.shadowManager) {
            this.shadowManager.destroy();
        }
        
        for (const asset of this.assets) {
            asset.destroy();
        }
        this.assets = [];
    }
}
