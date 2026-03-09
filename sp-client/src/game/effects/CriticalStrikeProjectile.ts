import type { Scene } from 'phaser';
import { GameAsset } from '../objects/GameAsset';
import { AnimationType } from '../objects/GameAsset';
import { HIGH_DEPTH } from '../../Config';
import { calculateFrameRateFromDuration } from '../../utils/AnimationUtils';

/** Movement speed: 50px per 10ms = 5px per ms */
const PIXELS_PER_MS = 5;

/** Sprite sheet 8 has 3 frames (indices 0, 1, 2) */
const FRAME_COUNT = 3;

/**
 * Configuration for creating a CriticalStrikeProjectile instance.
 */
export type CriticalStrikeProjectileConfig = {
    /** Source X position in pixels */
    sourcePixelX: number;
    /** Source Y position in pixels */
    sourcePixelY: number;
    /** Target X position in pixels */
    targetPixelX: number;
    /** Target Y position in pixels */
    targetPixelY: number;
};

/**
 * A projectile effect that travels from source to target.
 * Uses effect.spr sprite sheet 8 (3 frames), animates once (non-looping).
 * Reaches the third frame at the last 1/3 of travel.
 * Moves at 50px per 10ms. Destroys when it reaches the destination.
 */
export class CriticalStrikeProjectile {
    private scene: Scene;
    private asset: GameAsset;
    private sourceX: number;
    private sourceY: number;
    private targetX: number;
    private targetY: number;
    private currentX: number;
    private currentY: number;
    private totalDistance: number;
    private traveledDistance: number = 0;
    private updateCallback: (time: number, delta: number) => void;

    constructor(scene: Scene, config: CriticalStrikeProjectileConfig) {
        this.scene = scene;
        this.sourceX = config.sourcePixelX;
        this.sourceY = config.sourcePixelY;
        this.targetX = config.targetPixelX;
        this.targetY = config.targetPixelY;
        this.currentX = config.sourcePixelX;
        this.currentY = config.sourcePixelY;

        this.totalDistance = Phaser.Math.Distance.Between(
            config.sourcePixelX,
            config.sourcePixelY,
            config.targetPixelX,
            config.targetPixelY
        );

        const travelDurationMs = this.totalDistance / PIXELS_PER_MS;
        const frameRate = calculateFrameRateFromDuration(FRAME_COUNT, travelDurationMs);

        this.asset = new GameAsset(scene, {
            x: config.sourcePixelX,
            y: config.sourcePixelY,
            spriteName: 'effect',
            spriteSheetIndex: 8,
            animationType: AnimationType.FullFrame,
            isLooping: false,
        });

        this.asset.setDepth(HIGH_DEPTH);

        const animationKey = `sprite-effect-8`;
        this.asset.playAnimationWithDirection(
            animationKey,
            0,
            frameRate,
            undefined,
            0,
            FRAME_COUNT,
            AnimationType.FullFrame,
            undefined,
            false
        );

        this.updateCallback = (_time: number, delta: number) => this.update(delta);
        this.scene.events.on('update', this.updateCallback);
    }

    private update(delta: number): void {
        const moveDistance = PIXELS_PER_MS * delta;
        this.traveledDistance += moveDistance;

        if (this.traveledDistance >= this.totalDistance) {
            this.destroy();
            return;
        }

        const progress = this.traveledDistance / this.totalDistance;
        this.currentX = this.sourceX + (this.targetX - this.sourceX) * progress;
        this.currentY = this.sourceY + (this.targetY - this.sourceY) * progress;

        this.asset.setPosition(this.currentX, this.currentY);
    }

    public destroy(): void {
        this.scene.events.off('update', this.updateCallback);
        this.asset.destroy();
    }
}
