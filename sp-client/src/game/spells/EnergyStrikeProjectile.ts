import type { Scene } from 'phaser';
import { GameAsset } from '../objects/GameAsset';
import { convertWorldPosToPixelPos, convertPixelPosToWorldPos } from '../../utils/CoordinateUtils';
import { TILE_SIZE } from '../assets/HBMap';
import { drawEffect } from '../../utils/EffectUtils';
import { EFFECT_EXPLOSION_3, EFFECT_EXPLOSION_4 } from '../../constants/Effects';
import { ENERGY_STRIKE_SOUND } from '../../constants/SoundFileNames';
import { calculateSpatialAudio } from '../../utils/SpatialAudioUtils';
import type { SoundManager } from '../../utils/SoundManager';
import type { CameraManager } from '../../utils/CameraManager';

export type EnergyStrikeProjectileConfig = {
    /** Projectile speed in pixels per second */
    projectileSpeed: number;
    /** Sound manager for E1 launch sound */
    soundManager?: SoundManager;
    /** Player world X for spatial audio */
    playerWorldX?: number;
    /** Player world Y for spatial audio */
    playerWorldY?: number;
    /** Camera manager for shake on explosion */
    cameraManager?: CameraManager;
};

/**
 * Energy Strike projectile. Travels from origin (pixels) to target (world cell).
 * Uses effect sprite index 0, frame 0. No animation. On arrival, plays Explosion 3 and 4.
 */
export class EnergyStrikeProjectile {
    private scene: Scene;
    private config: EnergyStrikeProjectileConfig;
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
        config: EnergyStrikeProjectileConfig
    ) {
        this.scene = scene;
        this.config = config;
        this.originX = originPixelX;
        this.originY = originPixelY;
        this.destPixelX = convertWorldPosToPixelPos(targetWorldX) + TILE_SIZE / 2;
        this.destPixelY = convertWorldPosToPixelPos(targetWorldY) + TILE_SIZE / 2;

        this.totalDistance = Phaser.Math.Distance.Between(
            originPixelX,
            originPixelY,
            this.destPixelX,
            this.destPixelY
        );

        this.asset = new GameAsset(scene, {
            x: originPixelX,
            y: originPixelY,
            spriteName: 'effect',
            spriteSheetIndex: 0,
            frameIndex: 0,
        });

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
            soundManager.playOnce(ENERGY_STRIKE_SOUND, undefined, spatialConfig);
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

        this.config.cameraManager?.setCameraShake(this.destPixelX, this.destPixelY);

        drawEffect(this.scene, destWorldX, destWorldY, EFFECT_EXPLOSION_3, {
            soundManager: this.config.soundManager,
            playerWorldX: this.config.playerWorldX,
            playerWorldY: this.config.playerWorldY,
        });
        drawEffect(this.scene, destWorldX, destWorldY, EFFECT_EXPLOSION_4, {
            soundManager: this.config.soundManager,
            playerWorldX: this.config.playerWorldX,
            playerWorldY: this.config.playerWorldY,
        });

        this.destroy();
    }

    public destroy(): void {
        this.scene.events.off('update', this.updateCallback);
        this.asset.destroy();
    }
}
