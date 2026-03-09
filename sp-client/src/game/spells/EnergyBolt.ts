import type { Scene } from 'phaser';
import { GameAsset } from '../objects/GameAsset';
import { convertWorldPosToPixelPos, convertPixelPosToWorldPos } from '../../utils/CoordinateUtils';
import { TILE_SIZE } from '../assets/HBMap';
import { getTextureKeyFromEffectConfig, ensureEffectAnimation } from '../../utils/EffectUtils';
import { ENERGY_BOLT_PROJECTILE, getEffectByKey } from '../../constants/Effects';
import { ENERGY_BOLT_LAUNCH_SOUND } from '../../constants/SoundFileNames';
import { calculateSpatialAudio } from '../../utils/SpatialAudioUtils';
import type { SoundManager } from '../../utils/SoundManager';
import type { CameraManager } from '../../utils/CameraManager';
import { LightningBlast } from './LightningBlast';

export type EnergyBoltConfig = {
    /** Projectile speed in pixels per second */
    projectileSpeed: number;
    /** Sound manager for E1 launch sound */
    soundManager?: SoundManager;
    /** Player world X for spatial audio */
    playerWorldX?: number;
    /** Player world Y for spatial audio */
    playerWorldY?: number;
    /** Camera manager for shake effect on impact */
    cameraManager?: CameraManager;
};

/** Y offset from player position for projectile origin (above player) */
const ENERGY_BOLT_ORIGIN_OFFSET_Y = 50;

/**
 * Energy Bolt spell. Fires a single projectile from origin (pixels) to target (world cell).
 * Uses Energy Bolt Projectile effect (sprite effect index 0, frames 2-5). On arrival, plays Energy Bolt Explosion.
 */
export class EnergyBolt {
    private scene: Scene;
    private config: EnergyBoltConfig;
    private asset: GameAsset;
    private originX: number;
    private originY: number;
    private destPixelX: number;
    private destPixelY: number;
    private totalDistance: number;
    private traveledDistance: number = 0;
    private updateCallback: (time: number, delta: number) => void;

    constructor(
        scene: Scene,
        originPixelX: number,
        originPixelY: number,
        targetWorldX: number,
        targetWorldY: number,
        config: EnergyBoltConfig
    ) {
        this.scene = scene;
        this.config = config;
        this.originX = originPixelX;
        this.originY = originPixelY - ENERGY_BOLT_ORIGIN_OFFSET_Y;
        this.destPixelX = convertWorldPosToPixelPos(targetWorldX) + TILE_SIZE / 2;
        this.destPixelY = convertWorldPosToPixelPos(targetWorldY) + TILE_SIZE / 2;

        this.totalDistance = Phaser.Math.Distance.Between(
            this.originX,
            this.originY,
            this.destPixelX,
            this.destPixelY
        );

        const projectileConfig = getEffectByKey(ENERGY_BOLT_PROJECTILE);
        const textureKey = getTextureKeyFromEffectConfig(projectileConfig!);
        const [startFrame, endFrame] = projectileConfig!.animationFrames ?? [2, 5];
        const frameRate = projectileConfig!.frameRate ?? 20;

        const animKey = ensureEffectAnimation(this.scene, textureKey, {
            frameRate,
            repeat: -1,
            startFrame,
            endFrame,
            animKey: `${textureKey}-projectile-${startFrame}-${endFrame}`,
        });

        this.asset = new GameAsset(scene, {
            x: this.originX,
            y: this.originY,
            spriteName: 'effect',
            spriteSheetIndex: 0,
            frameIndex: startFrame,
        });

        this.asset.sprite.anims.play(animKey);

        this.playLaunchSound();

        this.updateCallback = (_time: number, delta: number) => this.update(delta);
        this.scene.events.on('update', this.updateCallback);
    }

    private playLaunchSound(): void {
        const { soundManager, playerWorldX, playerWorldY } = this.config;
        if (soundManager && playerWorldX !== undefined && playerWorldY !== undefined) {
            const originWorldX = convertPixelPosToWorldPos(this.originX);
            const originWorldY = convertPixelPosToWorldPos(this.originY);
            const spatialConfig = calculateSpatialAudio({
                sourceX: originWorldX,
                sourceY: originWorldY,
                listenerX: playerWorldX,
                listenerY: playerWorldY,
            });
            soundManager.playOnce(ENERGY_BOLT_LAUNCH_SOUND, undefined, spatialConfig);
        }
    }

    private update(delta: number): void {
        const speedPxPerMs = this.config.projectileSpeed / 1000;
        const moveDistance = speedPxPerMs * delta;
        this.traveledDistance += moveDistance;

        if (this.traveledDistance >= this.totalDistance) {
            this.onReachDestination();
            return;
        }

        const progress = this.traveledDistance / this.totalDistance;
        const currentX = this.originX + (this.destPixelX - this.originX) * progress;
        const currentY = this.originY + (this.destPixelY - this.originY) * progress;

        this.asset.setPosition(currentX, currentY);
    }

    private onReachDestination(): void {
        const destWorldX = convertPixelPosToWorldPos(this.destPixelX);
        const destWorldY = convertPixelPosToWorldPos(this.destPixelY);

        LightningBlast.spawn(this.scene, destWorldX, destWorldY, {
            soundManager: this.config.soundManager,
            playerWorldX: this.config.playerWorldX,
            playerWorldY: this.config.playerWorldY,
            cameraManager: this.config.cameraManager,
        });

        this.destroy();
    }

    public destroy(): void {
        this.scene.events.off('update', this.updateCallback);
        this.asset.destroy();
    }
}
