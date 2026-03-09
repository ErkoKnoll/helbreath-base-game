import type { Scene, GameObjects } from 'phaser';
import type { PivotFrame } from '../Types';
import { convertWorldPosToPixelPos } from './CoordinateUtils';
import { getPivotData } from './RegistryUtils';

/**
 * Configuration for creating a shadow sprite.
 */
export type ShadowConfig = {
    /** The Phaser scene */
    scene: Scene;

    /** The sprite name to use for the shadow (e.g., 'wm' for wm.spr) */
    shadowSpriteName: string;

    /** The sprite sheet index to use for the shadow */
    shadowSpriteSheetIndex: number;

    /** Initial X position in world coordinates */
    worldX: number;

    /** Initial Y position in world coordinates */
    worldY: number;

    /** Optional pixel offset X */
    offsetX?: number;

    /** Optional pixel offset Y */
    offsetY?: number;

    /** Frame rate for shadow animation (default: 10) */
    frameRate?: number;

    /** Whether this is a map object using legacy index-based texture lookup (default: false) */
    mapObject?: boolean;

    /** Specific frame index to display for static shadows (for map objects) */
    frameIndex?: number;
};

/**
 * Manages shadow sprite rendering for game objects.
 * Handles shadow creation, position updates, depth management, and animation.
 */
export class ShadowManager {
    /** The shadow sprite rendered beneath the object */
    private shadowSprite: GameObjects.Sprite | undefined = undefined;

    /** Pivot data for the shadow sprite */
    private shadowPivotData: PivotFrame[] | undefined;

    /** The Phaser scene */
    private scene: Scene;

    /** The shadow sprite name */
    private shadowSpriteName: string;

    /** Current shadow sprite sheet index */
    private shadowSpriteSheetIndex: number;

    /** Current world X position */
    private worldX: number;

    /** Current world Y position */
    private worldY: number;

    /** Current pixel offset X */
    private offsetX = 0;

    /** Current pixel offset Y */
    private offsetY = 0;

    /** Frame rate for shadow animation */
    private frameRate = 10;

    /** Whether this is a map object */
    private mapObject = false;

    /** Specific frame index for static shadows (map objects) */
    private frameIndex?: number;

    /**
     * Creates a new ShadowManager instance.
     * 
     * @param config - Configuration for shadow creation
     */
    constructor(config: ShadowConfig) {
        this.scene = config.scene;
        this.shadowSpriteName = config.shadowSpriteName;
        this.shadowSpriteSheetIndex = config.shadowSpriteSheetIndex;
        this.worldX = config.worldX;
        this.worldY = config.worldY;
        this.offsetX = config.offsetX ?? 0;
        this.offsetY = config.offsetY ?? 0;
        this.frameRate = config.frameRate ?? 10;
        this.mapObject = config.mapObject ?? false;
        this.frameIndex = config.frameIndex;

        this.createShadow();
    }

    /**
     * Creates the shadow sprite.
     * Shadow uses the specified sprite with appropriate transformations.
     */
    private createShadow(): void {
        // Build texture key based on whether this is a map object
        let shadowTextureKey: string;
        let shadowAnimationKey: string;

        if (this.mapObject) {
            // Legacy index-based lookup for map objects
            shadowTextureKey = this.shadowSpriteName;
            shadowAnimationKey = this.shadowSpriteName;
        } else {
            // Standard sprite-sheet based lookup
            shadowTextureKey = `sprite-${this.shadowSpriteName}-${this.shadowSpriteSheetIndex}`;
            shadowAnimationKey = shadowTextureKey;
        }

        // Get pivot data for shadow sprite
        const pivotData = getPivotData(this.scene, shadowTextureKey, this.shadowSpriteName, this.mapObject);
        const pivotIndex = this.mapObject ? 0 : this.shadowSpriteSheetIndex;
        if (pivotData && pivotData.spriteSheetPivots[pivotIndex]) {
            this.shadowPivotData = pivotData.spriteSheetPivots[pivotIndex];
        }

        // Create shadow sprite at initial position
        // For map objects, use specified frameIndex or frame 0 (static); for regular sprites, use texture key
        if (this.mapObject) {
            // Map objects: create static sprite with specified frameIndex or frame 0 (no animation)
            const staticFrameIndex = this.frameIndex ?? 0;
            this.shadowSprite = this.scene.add.sprite(0, 0, shadowTextureKey, staticFrameIndex);
        } else {
            // Regular sprites: create sprite that can be animated
            this.shadowSprite = this.scene.add.sprite(0, 0, shadowTextureKey);
        }

        // Set shadow origin to bottom-center
        // In Phaser: originX = 0.5 (center), originY = 1.0 (bottom)
        this.shadowSprite.setOrigin(0.5, 1.0);

        // Apply shadow transformations
        // Rotation: -π/4 radians (exactly -45 degrees) for isometric projection
        // Scale: Separate X/Y scaling creates flattened isometric shadow
        //   - scaleX: 1.0 (full width)
        //   - scaleY: 0.5 (compressed height for flat-on-ground appearance)
        // Alpha: 50% opacity for semi-transparent shadow
        // Tint: Pure black color
        this.shadowSprite.setRotation(-Math.PI / 4); // Exactly -45 degrees for isometric projection
        this.shadowSprite.setScale(1.0, 0.5);        // Width: 100%, Height: 50% (flattened)
        this.shadowSprite.setAlpha(0.5);             // 50% opacity (semi-transparent)
        this.shadowSprite.setTint(0x000000);         // Pure black

        // Set depth to render below object (will be updated in updateDepth)
        this.shadowSprite.setDepth(0);

        // Play shadow animation only for non-map objects
        if (!this.mapObject && this.scene.anims.exists(shadowAnimationKey)) {
            this.shadowSprite.play({
                key: shadowAnimationKey,
                frameRate: this.frameRate
            });
        }

        // Initial position update
        this.updatePosition();
    }

    /**
     * Updates the shadow to use a different sprite (e.g. when player gender changes).
     * Sets the sprite name and updates the animation to the given sheet index.
     */
    public updateShadowSprite(spriteName: string, shadowSpriteSheetIndex: number): void {
        this.shadowSpriteName = spriteName;
        this.updateAnimation(shadowSpriteSheetIndex);
    }

    /**
     * Updates the shadow sprite animation based on new sprite sheet index.
     * 
     * @param shadowSpriteSheetIndex - New sprite sheet index
     * @param frameRate - Optional frame rate (defaults to current frame rate)
     * @param repeat - Optional repeat count (0 = play once, undefined = loop)
     * @param startFrame - Optional starting frame index (animation range)
     * @param endFrame - Optional ending frame index (animation range)
     * @param playFromFrame - Optional frame to start playing from (keeps shadow in sync with object when switching animations)
     */
    public updateAnimation(shadowSpriteSheetIndex: number, frameRate?: number, repeat?: number, startFrame?: number, endFrame?: number, playFromFrame?: number): void {
        if (!this.shadowSprite) {
            return;
        }

        let shadowAnimationKey = '';
        let shadowTextureKey = '';
        try {
            this.shadowSpriteSheetIndex = shadowSpriteSheetIndex;
            if (frameRate !== undefined) {
                this.frameRate = frameRate;
            }

            // Build animation key and texture key based on whether this is a map object
            if (this.mapObject) {
                shadowTextureKey = this.shadowSpriteName;
                shadowAnimationKey = this.shadowSpriteName;
            } else {
                shadowTextureKey = `sprite-${this.shadowSpriteName}-${shadowSpriteSheetIndex}`;
                shadowAnimationKey = shadowTextureKey;
            }
            // Update pivot data for new spritesheet
            const pivotData = getPivotData(this.scene, shadowTextureKey, this.shadowSpriteName, this.mapObject);
            const pivotIndex = this.mapObject ? 0 : shadowSpriteSheetIndex;
            if (pivotData && pivotData.spriteSheetPivots[pivotIndex]) {
                this.shadowPivotData = pivotData.spriteSheetPivots[pivotIndex];
            }

            // Update shadow animation and frame rate
            if (this.scene.anims.exists(shadowAnimationKey)) {
                const playConfig: Phaser.Types.Animations.PlayAnimationConfig = {
                    key: shadowAnimationKey,
                    frameRate: this.frameRate
                };

                // Set start frame: playFromFrame keeps shadow in sync with object when switching animations,
                // otherwise use animation range startFrame if provided
                const effectiveStartFrame = playFromFrame ?? startFrame ?? 0;
                if (playFromFrame !== undefined) {
                    playConfig.startFrame = playFromFrame;
                } else if (startFrame !== undefined) {
                    playConfig.startFrame = startFrame;
                }

                // Reset to frame 0 when starting from non-zero to avoid carryover from previous animation
                if (effectiveStartFrame > 0) {
                    const anim = this.scene.anims.get(shadowAnimationKey);
                    const firstFrame = anim?.frames?.[0];
                    if (firstFrame?.frame) {
                        this.shadowSprite.anims.setCurrentFrame(firstFrame);
                    }
                }

                // Only set repeat if explicitly provided
                if (repeat !== undefined) {
                    playConfig.repeat = repeat;
                }

                this.shadowSprite.play(playConfig);

                // Frame limit listener only needed for LOOPING animations (e.g. idle 0-3 wrapping back to 0).
                // For repeat: 0 (attack, take damage, death), the animation naturally stops at the last frame.
                if (startFrame !== undefined && endFrame !== undefined && repeat !== 0) {
                    this.shadowSprite.off(Phaser.Animations.Events.ANIMATION_UPDATE);
                    this.shadowSprite.on(Phaser.Animations.Events.ANIMATION_UPDATE, (_anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
                        const frameIndex = typeof frame.index === 'number' ? frame.index : parseInt(String(frame.textureFrame ?? frame.frame?.name ?? frame.index), 10);
                        if (frameIndex > endFrame || frameIndex < startFrame) {
                            const currentAnim = this.shadowSprite?.anims?.currentAnim;
                            const targetFrame = currentAnim?.frames?.find((f: Phaser.Animations.AnimationFrame) => f.index === startFrame) ?? currentAnim?.frames?.[startFrame];
                            if (targetFrame && this.shadowSprite) {
                                this.shadowSprite.anims.setCurrentFrame(targetFrame);
                            }
                        }
                    });
                } else {
                    this.shadowSprite.off(Phaser.Animations.Events.ANIMATION_UPDATE);
                }
            }
        } catch (error) {
            console.warn(
                '[ShadowManager] updateAnimation failed (possible race: animation/texture not ready):',
                {
                    error,
                    shadowSpriteName: this.shadowSpriteName,
                    shadowSpriteSheetIndex,
                    shadowAnimationKey,
                    shadowTextureKey,
                    frameRate: this.frameRate,
                    playFromFrame,
                    startFrame,
                    endFrame,
                    repeat,
                    animExists: this.scene.anims.exists(shadowAnimationKey),
                    mapObject: this.mapObject,
                }
            );
        }
    }

    /**
     * Updates the shadow sprite position to match the object's current position.
     * Calculates position using pivot offsets and frame dimensions.
     */
    private updatePosition(): void {
        if (!this.shadowSprite) {
            return;
        }

        // Get current shadow frame index
        // For map objects (static), use specified frameIndex or frame 0; for animated sprites, get from animation
        let frameIndex: number;
        if (this.mapObject) {
            // Map objects are static, use specified frameIndex or frame 0
            frameIndex = this.frameIndex ?? 0;
        } else {
            const currentFrame = this.shadowSprite.anims.currentFrame;
            if (!currentFrame) {
                // Fallback to frame 0 during animation transitions - prevents shadow from
                // disappearing or jumping when animation briefly has no current frame
                frameIndex = 0;
            } else {
                const frameName = currentFrame.textureFrame ?? currentFrame.frame?.name ?? currentFrame.index;
                frameIndex = typeof frameName === 'number' ? frameName : parseInt(frameName, 10);
            }
        }

        // Get shadow frame dimensions and pivot
        const shadowFrame = this.shadowSprite.frame;
        const shadowFrameWidth = shadowFrame?.width ?? this.shadowSprite.displayWidth;
        const shadowFrameHeight = shadowFrame?.height ?? this.shadowSprite.displayHeight;

        // Get shadow pivot data for current frame
        let shadowPivotX = 0;
        let shadowPivotY = 0;
        if (this.shadowPivotData && this.shadowPivotData[frameIndex]) {
            const pivotFrame = this.shadowPivotData[frameIndex];
            if (pivotFrame.width !== 0 && pivotFrame.height !== 0) {
                shadowPivotX = pivotFrame.pivotX;
                shadowPivotY = pivotFrame.pivotY;
            }
        }

        // Calculate shadow position
        // Base position (object's current position without pivot - using base world coordinates)
        const basePixelX = convertWorldPosToPixelPos(this.worldX) + 16 + this.offsetX;
        const basePixelY = convertWorldPosToPixelPos(this.worldY) + 16 + this.offsetY;

        // Add shadow pivot offset
        const posX = basePixelX + shadowPivotX;
        const posY = basePixelY + shadowPivotY;

        // Add frame-based offset
        // Since shadow origin is at bottom-center (0.5, 1.0), this positions the origin point correctly
        const shadowX = posX + (shadowFrameWidth * 0.5);
        const shadowY = posY + shadowFrameHeight;

        this.shadowSprite.setPosition(shadowX, shadowY);
    }

    /**
     * Updates the shadow sprite position based on the object's sprite position and pivot data.
     * This method should be used when the object's sprite position already includes pivot offsets.
     * 
     * @param objectSpriteX - The object's sprite X position (including pivot offset)
     * @param objectSpriteY - The object's sprite Y position (including pivot offset)
     * @param objectPivotX - The object's pivot X offset (from pivot data)
     * @param objectPivotY - The object's pivot Y offset (from pivot data)
     * @param objectFrameWidth - The object's frame width
     * @param objectFrameHeight - The object's frame height
     */
    public updatePositionFromSprite(
        objectSpriteX: number,
        objectSpriteY: number,
        objectPivotX: number,
        objectPivotY: number,
        objectFrameWidth: number,
        objectFrameHeight: number
    ): void {
        // Note: objectPivotX and objectPivotY are kept for potential future use
        // but are not currently needed since sprite position is already top-left
        void objectPivotX;
        void objectPivotY;
        if (!this.shadowSprite) {
            return;
        }

        // Calculate shadow position relative to object's sprite position
        // Object sprite has origin at (0, 0) - top-left
        // Object sprite position (sprite.x, sprite.y) represents the top-left corner
        // Shadow has origin at (0.5, 1.0) - bottom-center

        // Calculate object's bottom-center position (anchor point for shadow casting)
        // Since sprite origin is (0, 0), sprite position IS the top-left corner
        const objectBottomCenterX = objectSpriteX + (objectFrameWidth * 0.5);
        const objectBottomCenterY = objectSpriteY + objectFrameHeight;

        // Position shadow's bottom-center at object's bottom-center
        // Shadow origin is at (0.5, 1.0) - bottom-center
        // When we call setPosition(x, y), that (x, y) represents the bottom-center point
        this.shadowSprite.setPosition(objectBottomCenterX, objectBottomCenterY);
    }

    /**
     * Updates the shadow depth to render just below the object.
     * 
     * @param objectDepth - The depth of the object to render below
     */
    public updateDepth(objectDepth: number): void {
        if (!this.shadowSprite) {
            return;
        }

        // Shadow should render just below the object
        // Object depth is based on worldY, so shadow depth is object depth - 0.5
        this.shadowSprite.setDepth(objectDepth - 5);
    }

    /**
     * Sets the world position of the shadow.
     * 
     * @param worldX - X coordinate in world grid
     * @param worldY - Y coordinate in world grid
     */
    public setWorldPosition(worldX: number, worldY: number): void {
        this.worldX = worldX;
        this.worldY = worldY;
        this.updatePosition();
    }

    /**
     * Sets the pixel offset for the shadow.
     * 
     * @param offsetX - X offset in pixels
     * @param offsetY - Y offset in pixels
     */
    public setOffset(offsetX: number, offsetY: number): void {
        this.offsetX = offsetX;
        this.offsetY = offsetY;
        this.updatePosition();
    }

    /**
     * Sets the alpha (opacity) of the shadow sprite.
     * 
     * @param alpha - Alpha value (0-1)
     */
    public setAlpha(alpha: number): void {
        if (this.shadowSprite) {
            this.shadowSprite.setAlpha(alpha * 0.5); // Shadow base opacity is 50%
        }
    }

    /**
     * Destroys the shadow sprite and cleans up resources.
     */
    public destroy(): void {
        if (this.shadowSprite) {
            // Remove animation event listener
            this.shadowSprite.off(Phaser.Animations.Events.ANIMATION_UPDATE);
            this.shadowSprite.destroy();
            this.shadowSprite = undefined;
        }
    }
}
