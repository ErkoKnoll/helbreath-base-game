import type { Scene } from 'phaser';
import { GameAsset } from '../objects/GameAsset';
import { getEffectByKey } from '../../constants/Effects';
import { EFFECT_ICE_STRIKE_SHARD_IMPACT_FRACTION } from '../../constants/Effects';
import { convertPixelPosToWorldPos } from '../../utils/CoordinateUtils';
import { calculateSpatialAudio } from '../../utils/SpatialAudioUtils';
import { getTextureKeyFromEffectConfig, ensureEffectAnimation } from '../../utils/EffectUtils';
import { calculateFrameRateFromDuration } from '../../utils/AnimationUtils';
import type { SoundManager } from '../../utils/SoundManager';
import { DEPTH_MULTIPLIER } from '../../Config';
import type { CameraManager } from '../../utils/CameraManager';

export type IceStrikeShardConfig = {
    /** Minimum height (in pixels) the shard starts before dropping */
    dropDistanceMin: number;
    /** Maximum height (in pixels) the shard starts before dropping */
    dropDistanceMax: number;
    /** Minimum milliseconds for the shard to fall to the ground */
    dropSpeedMin: number;
    /** Maximum milliseconds for the shard to fall to the ground */
    dropSpeedMax: number;
    /** Milliseconds for the shard to fade in from 0% to 100% opacity */
    fadeInDuration: number;
    /** Milliseconds for the impact animation to fade out from 100% to 0% */
    impactFadeOutDuration: number;
    /** Frame rate for the impact animation (frames per second) */
    impactAnimationSpeed: number;
    /** Effect key for the falling shard */
    shardEffectKey: string;
    soundManager?: SoundManager;
    playerWorldX?: number;
    playerWorldY?: number;
    /** Camera manager for shake effect on impact (25% chance) */
    cameraManager?: CameraManager;
};

/**
 * An ice strike shard projectile that drops from above, fades in during the fall,
 * and spawns an impact effect on landing. The impact fades out and is destroyed when complete.
 */
export class IceStrikeShard {
    private scene: Scene;
    private config: IceStrikeShardConfig;
    private destPixelX: number;
    private destPixelY: number;
    private dropDistance: number;
    private dropSpeed: number;

    private shardAsset: GameAsset | undefined;
    private impactAsset: GameAsset | undefined;

    constructor(
        scene: Scene,
        destPixelX: number,
        destPixelY: number,
        config: IceStrikeShardConfig
    ) {
        this.scene = scene;
        this.config = config;
        this.destPixelX = destPixelX;
        this.destPixelY = destPixelY;
        this.dropDistance = Phaser.Math.Between(config.dropDistanceMin, config.dropDistanceMax);
        this.dropSpeed = Phaser.Math.Between(config.dropSpeedMin, config.dropSpeedMax);

        this.spawnShard();
    }

    private spawnShard(): void {
        const { fadeInDuration } = this.config;
        const dropDistance = this.dropDistance;
        const dropSpeed = this.dropSpeed;

        try {
            const effectKey = this.config.shardEffectKey;
            const shardConfig = getEffectByKey(effectKey);
            if (!shardConfig) {
                console.warn(`[IceStrikeShard] Effect config not found: ${effectKey}`);
                return;
            }

            const textureKey = getTextureKeyFromEffectConfig(shardConfig);
            const texture = this.scene.textures.get(textureKey);
            const defaultEndFrame = texture ? Object.keys(texture.frames).length - 1 : 0;
            const [startFrame, endFrame] = shardConfig.animationFrames ?? [0, Math.max(0, defaultEndFrame)];
            const frameCount = endFrame - startFrame + 1;

            const shardFrameRate = frameCount > 0 ? calculateFrameRateFromDuration(frameCount, dropSpeed) : 20;

            const shardAnimKey = ensureEffectAnimation(this.scene, textureKey, {
                frameRate: shardFrameRate,
                repeat: 0,
                startFrame,
                endFrame,
                animKey: `ice-strike-shard-${effectKey}-${startFrame}-${endFrame}`,
            });

            const startY = this.destPixelY - dropDistance;
            this.shardAsset = new GameAsset(this.scene, {
                x: this.destPixelX,
                y: startY,
                spriteName: shardConfig.sprite,
                spriteSheetIndex: shardConfig.spriteSheetIndex,
                frameIndex: startFrame,
                alpha: 0,
                isLooping: false,
            });

            const worldY = convertPixelPosToWorldPos(this.destPixelY);
            this.shardAsset.setDepth(worldY * DEPTH_MULTIPLIER);

            this.shardAsset.sprite.anims.stop();
            this.shardAsset.sprite.play(shardAnimKey);

            if (shardConfig.sound && this.config.soundManager && this.config.playerWorldX !== undefined && this.config.playerWorldY !== undefined) {
                const effectWorldX = convertPixelPosToWorldPos(this.destPixelX);
                const effectWorldY = convertPixelPosToWorldPos(this.destPixelY);
                const spatialConfig = calculateSpatialAudio({
                    sourceX: effectWorldX,
                    sourceY: effectWorldY,
                    listenerX: this.config.playerWorldX,
                    listenerY: this.config.playerWorldY,
                });
                this.config.soundManager.playOnce(shardConfig.sound, undefined, spatialConfig);
            }

            this.scene.tweens.add({
                targets: this.shardAsset.sprite,
                alpha: 1,
                duration: fadeInDuration,
            });

            this.scene.tweens.addCounter({
                from: 0,
                to: 1,
                duration: dropSpeed,
                onUpdate: (tween) => {
                    if (this.shardAsset) {
                        const progress = tween.progress;
                        const currentY = startY + progress * dropDistance;
                        this.shardAsset.setPosition(this.destPixelX, currentY);
                    }
                },
                onComplete: () => {
                    this.onShardLanded();
                },
            });
        } catch (error) {
            console.warn('[IceStrikeShard] spawnShard failed:', { error, destPixelX: this.destPixelX, destPixelY: this.destPixelY });
        }
    }

    private onShardLanded(): void {
        if (this.shardAsset) {
            this.shardAsset.destroy();
            this.shardAsset = undefined;
        }

        this.spawnImpact();
    }

    private spawnImpact(): void {
        if (this.config.cameraManager && Phaser.Math.Between(0, 3) === 1) {
            this.config.cameraManager.setCameraShake(this.destPixelX, this.destPixelY);
        }

        try {
            const impactConfig = getEffectByKey(EFFECT_ICE_STRIKE_SHARD_IMPACT_FRACTION);
            if (!impactConfig) {
                console.warn('[IceStrikeShard] Impact effect config not found');
                this.destroy();
                return;
            }

            const { impactAnimationSpeed, impactFadeOutDuration } = this.config;
            const textureKey = getTextureKeyFromEffectConfig(impactConfig);

            const impactAnimKey = ensureEffectAnimation(this.scene, textureKey, {
                frameRate: impactAnimationSpeed,
                repeat: 0,
                animKey: `ice-strike-impact-${textureKey}-fr${impactAnimationSpeed}`,
            });

            this.impactAsset = new GameAsset(this.scene, {
                x: this.destPixelX,
                y: this.destPixelY,
                spriteName: impactConfig.sprite,
                spriteSheetIndex: impactConfig.spriteSheetIndex,
                frameIndex: 0,
                isLooping: false,
            });

            const worldY = convertPixelPosToWorldPos(this.destPixelY);
            this.impactAsset.setDepth(worldY * DEPTH_MULTIPLIER);

            this.impactAsset.sprite.anims.stop();
            this.impactAsset.sprite.play(impactAnimKey);

            if (impactConfig.sound && this.config.soundManager && this.config.playerWorldX !== undefined && this.config.playerWorldY !== undefined) {
                const effectWorldX = convertPixelPosToWorldPos(this.destPixelX);
                const effectWorldY = convertPixelPosToWorldPos(this.destPixelY);
                const spatialConfig = calculateSpatialAudio({
                    sourceX: effectWorldX,
                    sourceY: effectWorldY,
                    listenerX: this.config.playerWorldX,
                    listenerY: this.config.playerWorldY,
                });
                this.config.soundManager.playOnce(impactConfig.sound, undefined, spatialConfig);
            }

            this.impactAsset.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
                this.onImpactAnimationComplete(impactFadeOutDuration);
            });
        } catch (error) {
            console.warn('[IceStrikeShard] spawnImpact failed:', { error, destPixelX: this.destPixelX, destPixelY: this.destPixelY });
            this.destroy();
        }
    }

    private onImpactAnimationComplete(impactFadeOutDuration: number): void {
        if (!this.impactAsset) {
            this.destroy();
            return;
        }

        this.scene.tweens.add({
            targets: this.impactAsset.sprite,
            alpha: 0,
            duration: impactFadeOutDuration,
            onComplete: () => {
                this.destroy();
            },
        });
    }

    public destroy(): void {
        if (this.shardAsset) {
            this.shardAsset.destroy();
            this.shardAsset = undefined;
        }
        if (this.impactAsset) {
            this.impactAsset.destroy();
            this.impactAsset = undefined;
        }
    }
}
