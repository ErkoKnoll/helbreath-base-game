import type { Scene } from 'phaser';
import { GameAsset } from '../objects/GameAsset';
import type { EffectConfig } from '../../constants/Effects';
import type { SoundManager } from '../../utils/SoundManager';
import { calculateSpatialAudio } from '../../utils/SpatialAudioUtils';
import { convertPixelPosToWorldPos } from '../../utils/CoordinateUtils';
import { getTextureKeyFromEffectConfig, ensureEffectAnimation } from '../../utils/EffectUtils';
import { DEPTH_MULTIPLIER } from '../../Config';
import { createLightRadiusOverlay } from '../../utils/SpriteUtils';

const DEFAULT_FRAME_RATE = 10;

export type EffectCreateConfig = {
    /** Effect config from Effects.ts */
    config: EffectConfig;
    /** X position in pixel coordinates */
    pixelX: number;
    /** Y position in pixel coordinates */
    pixelY: number;
    /** Sound manager for optional effect sound */
    soundManager?: SoundManager;
    /** Player world X for spatial audio (listener position) */
    playerWorldX?: number;
    /** Player world Y for spatial audio (listener position) */
    playerWorldY?: number;
    /** When true, animation loops infinitely and effect is not destroyed on completion */
    infiniteLoop?: boolean;
    /** Called when effect is destroyed (e.g. animation complete) */
    onDestroy?: () => void;
    /** Frame rate for the effect animation (frames per second) */
    frameRate?: number;
    /** Optional frame index at which to start the animation. Clamped to [startFrame, endFrame] if specified. */
    startAnimationFrame?: number;
    /** Override depth offset (added to worldY * DEPTH_MULTIPLIER). Use higher values to draw on top of player. */
    depthOffset?: number;
    /** When true, use playerWorldY for depth instead of effect position. Requires playerWorldY. Used for effects that float above the player. */
    usePlayerDepthForDepth?: boolean;
};

/**
 * A visual effect that plays a sprite animation at a position.
 * Destroys when the animation reaches its end frame.
 */
export class Effect {
    private asset: GameAsset;
    private overlaySprite: Phaser.GameObjects.Sprite | undefined;
    private onDestroyCallback?: () => void;
    private depthOffset: number;
    private fadeOutUnsubscribe?: () => void;
    private readonly offsetX: number;
    private readonly offsetY: number;

    constructor(scene: Scene, createConfig: EffectCreateConfig) {
        const { config, pixelX, pixelY, soundManager, playerWorldX, playerWorldY, infiniteLoop, onDestroy, frameRate: providedFrameRate, startAnimationFrame: providedStartFrame, depthOffset: providedDepthOffset, usePlayerDepthForDepth } = createConfig;
        this.onDestroyCallback = onDestroy;
        this.depthOffset = providedDepthOffset ?? config.depthOffset ?? 80;
        this.offsetX = config.offsetX ?? 0;
        this.offsetY = config.offsetY ?? 0;

        const drawX = pixelX + this.offsetX;
        const drawY = pixelY + this.offsetY;

        const frameRate = providedFrameRate ?? (config.frameRate ?? DEFAULT_FRAME_RATE);
        const textureKey = getTextureKeyFromEffectConfig(config);

        // Determine frame range
        let startFrame: number;
        let endFrame: number;

        if (config.animationFrames) {
            [startFrame, endFrame] = config.animationFrames;
        } else {
            // Use entire sprite sheet - find the actual maximum frame index
            const texture = scene.textures.get(textureKey);
            let maxFrameIndex = -1;
            if (texture) {
                const frameKeys = Object.keys(texture.frames);
                for (const key of frameKeys) {
                    const frameNum = parseInt(key, 10);
                    if (!isNaN(frameNum) && frameNum > maxFrameIndex) {
                        maxFrameIndex = frameNum;
                    }
                }
            }
            startFrame = 0;
            endFrame = Math.max(0, maxFrameIndex);
        }

        // Resolve initial frame: clamp providedStartFrame to [startFrame, endFrame] if specified
        const initialTextureFrame = providedStartFrame != null
            ? Math.max(startFrame, Math.min(endFrame, Math.floor(providedStartFrame)))
            : startFrame;

        // Create GameAsset with first frame (static) to avoid auto-play
        this.asset = new GameAsset(scene, {
            x: drawX,
            y: drawY,
            spriteName: config.sprite,
            spriteSheetIndex: config.spriteSheetIndex,
            frameIndex: initialTextureFrame,
        });

        // Use world Y position for depth (same as Player, Monster, map objects)
        const worldY = usePlayerDepthForDepth && playerWorldY != null ? playerWorldY : convertPixelPosToWorldPos(drawY);
        this.asset.setDepth(worldY * DEPTH_MULTIPLIER + this.depthOffset);

        if (config.drawLightRadius) {
            this.overlaySprite = createLightRadiusOverlay(scene, drawX, drawY);
        }

        // Create animation with our frame range (cached by key for reuse)
        const repeatCount = infiniteLoop ? -1 : 0;
        const effectAnimKey = ensureEffectAnimation(scene, textureKey, {
            frameRate,
            repeat: repeatCount,
            startFrame,
            endFrame,
            animKey: `${textureKey}-range-${startFrame}-${endFrame}-repeat-${repeatCount}`,
        });

        // Stop default animation and play our custom one (from initial frame if specified)
        // Phaser's startFrame is the index within the animation's frames array (0-based), NOT the texture frame index
        const animationFrameIndex = initialTextureFrame - startFrame;
        this.asset.sprite.anims.stop();
        try {
            this.asset.sprite.play({
                key: effectAnimKey,
                startFrame: animationFrameIndex,
            });
        } catch (err) {
            console.warn('[Effect] Failed to play animation, keeping static frame:', { effectAnimKey, config: config.key, err });
        }

        // Destroy when animation completes (only for non-looping effects)
        if (!infiniteLoop) {
            this.asset.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
                this.destroy();
            });
        }

        // Fade out from fadeOutStartAnimationIndex: linearly interpolate alpha 1→0 over remaining frames
        const fadeOutStart = config.fadeOutStartAnimationIndex;
        if (fadeOutStart !== undefined && fadeOutStart <= endFrame) {
            const remainingFrames = endFrame - fadeOutStart;
            const onFrameUpdate = (_anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
                const frameIndex = frame.frame?.name != null ? parseInt(String(frame.frame.name), 10) : frame.index;
                if (frameIndex >= fadeOutStart) {
                    const progress = remainingFrames > 0 ? (frameIndex - fadeOutStart) / remainingFrames : 1;
                    this.asset.sprite.setAlpha(1 - progress);
                }
            };
            this.asset.sprite.on(Phaser.Animations.Events.ANIMATION_UPDATE, onFrameUpdate);
            this.fadeOutUnsubscribe = () => {
                this.asset.sprite.off(Phaser.Animations.Events.ANIMATION_UPDATE, onFrameUpdate);
            };
        }

        // Play sound if configured (spatially aware, no duration modification)
        if (config.sound && soundManager && playerWorldX !== undefined && playerWorldY !== undefined) {
            const effectWorldX = convertPixelPosToWorldPos(pixelX);
            const effectWorldY = convertPixelPosToWorldPos(pixelY);
            const spatialConfig = calculateSpatialAudio({
                sourceX: effectWorldX,
                sourceY: effectWorldY,
                listenerX: playerWorldX,
                listenerY: playerWorldY,
            });
            soundManager.playOnce(config.sound, undefined, spatialConfig);
        }
    }

    /**
     * Updates the position of the effect.
     * Also updates depth based on the new Y position.
     *
     * @param pixelX - New X coordinate in pixels
     * @param pixelY - New Y coordinate in pixels
     */
    public setPosition(pixelX: number, pixelY: number): void {
        const drawX = pixelX + this.offsetX;
        const drawY = pixelY + this.offsetY;
        this.asset.setPosition(drawX, drawY);
        const worldY = convertPixelPosToWorldPos(drawY);
        this.asset.setDepth(worldY * DEPTH_MULTIPLIER + this.depthOffset);
        if (this.overlaySprite) {
            this.overlaySprite.setPosition(drawX, drawY);
            this.overlaySprite.setDepth(worldY * DEPTH_MULTIPLIER - 50);
        }
    }

    public destroy(): void {
        this.fadeOutUnsubscribe?.();
        this.fadeOutUnsubscribe = undefined;
        this.onDestroyCallback?.();
        this.onDestroyCallback = undefined;
        if (this.overlaySprite) {
            this.overlaySprite.destroy();
            this.overlaySprite = undefined;
        }
        this.asset.destroy();
    }
}
