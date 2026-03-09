import type { Scene } from 'phaser';
import { GameAsset } from '../objects/GameAsset';
import { getEffectByKey } from '../../constants/Effects';
import { CHILL_WIND_DROPLET } from '../../constants/Effects';
import { convertPixelPosToWorldPos } from '../../utils/CoordinateUtils';
import { calculateSpatialAudio } from '../../utils/SpatialAudioUtils';
import { getTextureKeyFromEffectConfig, ensureEffectAnimation } from '../../utils/EffectUtils';
import { DEPTH_MULTIPLIER } from '../../Config';
import { createLightRadiusOverlay } from '../../utils/SpriteUtils';
import type { SoundManager } from '../../utils/SoundManager';

/** Overlay darkens from this frame onward (Chill Wind effect only) */
const OVERLAY_DARKEN_START_FRAME = 6;

export type ChillWindDropletConfig = {
    /** Effect key for sprite/sound (default: CHILL_WIND_DROPLET) */
    effectKey?: string;
    /** Distance (in pixels) the droplet drops from above the target */
    dropDistance: number;
    /** Fall speed in pixels per second */
    projectileSpeed: number;
    soundManager?: SoundManager;
    playerWorldX?: number;
    playerWorldY?: number;
};

/**
 * A droplet effect for Chill Wind or Mass Chill Wind spells.
 * Uses effect config for sprite, frame rate, and optional overlay.
 * Overlay (when drawLightRadius) darkens from frame 6 onward.
 */
export class ChillWindDroplet {
    private scene: Scene;
    private config: ChillWindDropletConfig;
    private pixelX: number;
    private pixelY: number;

    private mainAsset: GameAsset | undefined;
    private overlaySprite: Phaser.GameObjects.Sprite | undefined;

    constructor(
        scene: Scene,
        pixelX: number,
        pixelY: number,
        config: ChillWindDropletConfig
    ) {
        this.scene = scene;
        this.config = config;
        this.pixelX = pixelX;
        this.pixelY = pixelY;

        this.spawn();
    }

    private spawn(): void {
        try {
            const dropDistance = this.config.dropDistance;
            const projectileSpeed = this.config.projectileSpeed;
            const dropDurationMs = (dropDistance / projectileSpeed) * 1000;
            const startY = this.pixelY - dropDistance;

            const effectKey = this.config.effectKey ?? CHILL_WIND_DROPLET;
            const dropletConfig = getEffectByKey(effectKey);
            if (!dropletConfig) {
                console.warn('[ChillWindDroplet] Effect config not found:', effectKey);
                return;
            }

            const textureKey = getTextureKeyFromEffectConfig(dropletConfig);
            const frameRate = dropletConfig.frameRate ?? 20;
            const [startFrame = 0, endFrame] = dropletConfig.animationFrames ?? [];

            if (dropletConfig.drawLightRadius) {
                this.overlaySprite = createLightRadiusOverlay(this.scene, this.pixelX, startY);
            }

            // Create main droplet animation
            const dropletAnimKey = ensureEffectAnimation(this.scene, textureKey, {
                frameRate,
                repeat: 0,
                startFrame,
                endFrame,
                animKey: `chill-wind-droplet-${effectKey}-${textureKey}`,
            });

            this.mainAsset = new GameAsset(this.scene, {
                x: this.pixelX,
                y: startY,
                spriteName: dropletConfig.sprite,
                spriteSheetIndex: dropletConfig.spriteSheetIndex,
                frameIndex: 0,
                isLooping: false,
            });

            const worldY = convertPixelPosToWorldPos(startY);
            this.mainAsset.setDepth(worldY * DEPTH_MULTIPLIER);

            this.mainAsset.sprite.anims.stop();
            this.mainAsset.sprite.play(dropletAnimKey);

            // Play E45 sound
            if (dropletConfig.sound && this.config.soundManager && this.config.playerWorldX !== undefined && this.config.playerWorldY !== undefined) {
                const effectWorldX = convertPixelPosToWorldPos(this.pixelX);
                const effectWorldY = convertPixelPosToWorldPos(this.pixelY);
                const spatialConfig = calculateSpatialAudio({
                    sourceX: effectWorldX,
                    sourceY: effectWorldY,
                    listenerX: this.config.playerWorldX,
                    listenerY: this.config.playerWorldY,
                });
                this.config.soundManager.playOnce(dropletConfig.sound, undefined, spatialConfig);
            }

            // Schedule overlay darkening from frame 6 (when overlay exists).
            const frameTimeMs = 1000 / frameRate;
            const totalFrames = endFrame !== undefined ? endFrame - startFrame + 1 : 15;
            const darkenStartMs = OVERLAY_DARKEN_START_FRAME * frameTimeMs;
            const totalDurationMs = totalFrames * frameTimeMs;

            if (this.overlaySprite) {
                this.scene.time.delayedCall(darkenStartMs, () => {
                    if (this.overlaySprite) {
                        const darkenDuration = totalDurationMs - darkenStartMs;
                        this.scene.tweens.add({
                            targets: this.overlaySprite,
                            alpha: 0,
                            duration: darkenDuration,
                        });
                    }
                });
            }

            // Projectile drop from startY to pixelY
            this.scene.tweens.addCounter({
                from: 0,
                to: 1,
                duration: dropDurationMs,
                onUpdate: (tween) => {
                    const progress = tween.progress;
                    const currentY = startY + progress * dropDistance;
                    if (this.mainAsset) {
                        this.mainAsset.setPosition(this.pixelX, currentY);
                        const worldY = convertPixelPosToWorldPos(currentY);
                        this.mainAsset.setDepth(worldY * DEPTH_MULTIPLIER);
                    }
                    if (this.overlaySprite) {
                        this.overlaySprite.setPosition(this.pixelX, currentY);
                        const worldY = convertPixelPosToWorldPos(currentY);
                        this.overlaySprite.setDepth(worldY * DEPTH_MULTIPLIER - 10);
                    }
                },
            });

            this.mainAsset.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
                this.destroy();
            });
        } catch (error) {
            console.warn('[ChillWindDroplet] spawn failed:', { error, pixelX: this.pixelX, pixelY: this.pixelY });
            this.destroy();
        }
    }

    public destroy(): void {
        if (this.mainAsset) {
            this.mainAsset.destroy();
            this.mainAsset = undefined;
        }
        if (this.overlaySprite) {
            this.overlaySprite.destroy();
            this.overlaySprite = undefined;
        }
    }
}
