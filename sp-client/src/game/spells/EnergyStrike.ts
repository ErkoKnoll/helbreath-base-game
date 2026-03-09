import type { Scene } from 'phaser';
import { EnergyStrikeProjectile } from './EnergyStrikeProjectile';
import type { EnergyStrikeProjectileConfig } from './EnergyStrikeProjectile';
import { convertPixelPosToWorldPos } from '../../utils/CoordinateUtils';

/** Y offset from player position for projectile origin (above player) */
const ENERGY_STRIKE_ORIGIN_OFFSET_Y = 50;
/** Randomness in pixels around the origin */
const ENERGY_STRIKE_ORIGIN_JITTER = 20;

export type EnergyStrikeConfig = {
    /** Number of projectiles to emit */
    projectiles: number;
    /** Milliseconds between spawning each projectile */
    emissionInterval: number;
    /** Radius in cells around target for random strike destination (target cell included) */
    radius: number;
    /** Pass-through config for each EnergyStrikeProjectile */
    projectileConfig: EnergyStrikeProjectileConfig;
};

/**
 * Energy Strike spell. Emits EnergyStrikeProjectiles at intervals from the player
 * (y - 50 px with ±20 px randomness) to random cells within radius of the target.
 */
export class EnergyStrike {
    private scene: Scene;
    private config: EnergyStrikeConfig;
    private originPixelX: number;
    private originPixelY: number;
    private targetWorldX: number;
    private targetWorldY: number;

    private emissionTimer: Phaser.Time.TimerEvent | undefined;
    private projectilesRemaining: number;

    constructor(
        scene: Scene,
        originPixelX: number,
        originPixelY: number,
        targetPixelX: number,
        targetPixelY: number,
        config: EnergyStrikeConfig
    ) {
        this.scene = scene;
        this.config = config;
        this.originPixelX = originPixelX;
        this.originPixelY = originPixelY - ENERGY_STRIKE_ORIGIN_OFFSET_Y;
        this.targetWorldX = convertPixelPosToWorldPos(targetPixelX);
        this.targetWorldY = convertPixelPosToWorldPos(targetPixelY);
        this.projectilesRemaining = config.projectiles;

        this.scheduleNextProjectile();
    }

    /**
     * Picks a random cell within radius of the target (target included).
     */
    private getRandomTargetCell(): { worldX: number; worldY: number } {
        const { radius } = this.config;
        const offsetX = radius > 0 ? Phaser.Math.Between(-radius, radius) : 0;
        const offsetY = radius > 0 ? Phaser.Math.Between(-radius, radius) : 0;
        return {
            worldX: this.targetWorldX + offsetX,
            worldY: this.targetWorldY + offsetY,
        };
    }

    /**
     * Gets origin with ±50 px randomness around base origin.
     */
    private getRandomOrigin(): { x: number; y: number } {
        return {
            x: this.originPixelX + Phaser.Math.Between(-ENERGY_STRIKE_ORIGIN_JITTER, ENERGY_STRIKE_ORIGIN_JITTER),
            y: this.originPixelY + Phaser.Math.Between(-ENERGY_STRIKE_ORIGIN_JITTER, ENERGY_STRIKE_ORIGIN_JITTER),
        };
    }

    private spawnProjectile(): void {
        const { x: originX, y: originY } = this.getRandomOrigin();
        const { worldX, worldY } = this.getRandomTargetCell();

        new EnergyStrikeProjectile(
            this.scene,
            originX,
            originY,
            worldX,
            worldY,
            this.config.projectileConfig
        );
    }

    private scheduleNextProjectile(): void {
        if (this.projectilesRemaining <= 0) {
            this.destroy();
            return;
        }

        this.spawnProjectile();
        this.projectilesRemaining--;

        if (this.projectilesRemaining > 0) {
            this.emissionTimer = this.scene.time.delayedCall(
                this.config.emissionInterval,
                () => this.scheduleNextProjectile()
            );
        } else {
            this.destroy();
        }
    }

    public destroy(): void {
        this.emissionTimer?.destroy();
        this.emissionTimer = undefined;
    }
}
