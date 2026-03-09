import type { Scene } from 'phaser';
import { GameObject, GameObjectState } from './GameObject';
import type { GameAssetConfig } from './GameAsset';
import { Direction, convertWorldPosToPixelPos, toDirection } from '../../utils/CoordinateUtils';
import { TILE_SIZE } from '../assets/HBMap';
import type { HBMap } from '../assets/HBMap';
import type { SoundManager } from '../../utils/SoundManager';
import { DEFAULT_ANIMATION_FRAME_RATE } from '../../Config';
import { EventBus } from '../EventBus';
import { NPC_DEAD } from '../../constants/EventNames';
import { ShadowManager } from '../../utils/ShadowManager';
import { createLightRadiusOverlay } from '../../utils/SpriteUtils';

/**
 * Configuration for creating an NPC instance.
 */
type NPCConfig = {
    /** X coordinate in world map position */
    x: number;

    /** Y coordinate in world map position */
    y: number;

    /** Sprite name for the NPC without extension (e.g., 'Shopkpr') */
    spriteName: string;

    /** Display name shown in UI (e.g., 'Shop Keeper') */
    displayName: string;

    /** Direction the NPC is facing (0-7) */
    direction: number;

    /** SoundManager instance (required by GameObject) */
    soundManager: SoundManager;

    /** HBMap instance for collision and occupancy */
    map: HBMap;

    /** Unique NPC ID */
    npcId: number;
};

/**
 * Represents an NPC in the game.
 * Stationary character that displays an idle animation.
 * All NPC animations start from index 0 (8 frames per direction).
 */
export class NPC extends GameObject {
    /** Display name shown in UI */
    private displayName: string;

    /** Unique NPC ID */
    private npcId: number;

    /** Whether the NPC is destroyed */
    private isDead: boolean = false;

    /** Light radius overlay rendered underneath the NPC */
    private lightRadiusOverlay: Phaser.GameObjects.Sprite | undefined;

    /**
     * Creates a new NPC instance.
     *
     * @param scene - The Phaser scene to add the NPC to
     * @param config - Configuration object with position, sprite, direction, and dependencies
     */
    constructor(scene: Scene, config: NPCConfig) {
        // NPC sprite sheet index = direction (0-7). Each sheet has 8 frames starting at index 0.
        const spriteSheetIndex = config.direction;

        // Offset position to center NPC in cell (TILE_SIZE/2 = 16px)
        const pixelX = convertWorldPosToPixelPos(config.x) + TILE_SIZE / 2;
        const pixelY = convertWorldPosToPixelPos(config.y) + TILE_SIZE / 2;

        const assetConfigs: Omit<GameAssetConfig, 'x' | 'y'>[] = [
            {
                spriteName: config.spriteName,
                spriteSheetIndex,
                direction: 0, // Use frames 0-7 within the sprite sheet
                framesPerDirection: 8,
                frameRate: DEFAULT_ANIMATION_FRAME_RATE,
            },
        ];

        super(scene, {
            x: config.x,
            y: config.y,
            assets: assetConfigs,
            soundManager: config.soundManager,
            map: config.map,
        });

        this.displayName = config.displayName;
        this.npcId = config.npcId;
        const dir = toDirection(config.direction);
        this.direction = dir === Direction.None ? Direction.South : dir;

        // Disable movement - NPCs are stationary
        this.movementSpeed = 0;

        // Override asset positions to center NPC in cell
        for (const asset of this.assets) {
            asset.setPosition(pixelX, pixelY);
        }

        // Cast shadow using the NPC's own animation sprite
        this.shadowManager = new ShadowManager({
            scene,
            shadowSpriteName: config.spriteName,
            shadowSpriteSheetIndex: spriteSheetIndex,
            worldX: config.x,
            worldY: config.y,
            frameRate: DEFAULT_ANIMATION_FRAME_RATE,
        });

        // Light radius overlay rendered underneath the NPC
        this.lightRadiusOverlay = createLightRadiusOverlay(scene, pixelX, pixelY);

        this.updateDepth();
        this.updateShadowDepth();
    }

    /** Implements abstract method - NPCs are always idle, no-op. */
    protected switchState(_state: GameObjectState, _forceUpdate?: boolean): void {
        // NPCs are stationary, no state changes
    }

    /**
     * Marks the NPC for killing. Frees the occupied cell and emits NPC_DEAD.
     */
    public kill(): void {
        if (this.isDead) {
            return;
        }
        this.isDead = true;

        // Free the occupied cell
        this.markCurrentTileFree();

        // Emit event to remove from game
        EventBus.emit(NPC_DEAD, { npcId: this.npcId });
    }

    /**
     * Returns true if the NPC is destroyed.
     */
    public getIsDead(): boolean {
        return this.isDead;
    }

    /**
     * Returns the display name of the NPC.
     */
    public getDisplayName(): string {
        return this.displayName;
    }

    /**
     * Gets the NPC's unique ID.
     */
    public getNPCId(): number {
        return this.npcId;
    }

    /**
     * Destroys the NPC and all associated resources.
     */
    public destroy(): void {
        if (!this.isDead) {
            this.markCurrentTileFree();
        }
        if (this.lightRadiusOverlay) {
            this.lightRadiusOverlay.destroy();
            this.lightRadiusOverlay = undefined;
        }
        super.destroy();
    }
}
