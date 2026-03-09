import type { Scene } from 'phaser';
import { BlizzardShard } from './BlizzardShard';
import type { BlizzardShardConfig } from './BlizzardShard';
import { convertPixelPosToWorldPos, convertWorldPosToPixelPos, randomPixelInRadius } from '../../utils/CoordinateUtils';
import { TILE_SIZE } from '../assets/HBMap';

export type BlizzardConfig = {
    /** Milliseconds for the projectile to travel from origin to destination */
    projectileSpeed: number;
    /** Number of emission events during travel */
    emissionSteps: number;
    /** Initial radius in cells for shard spread */
    startRadius: number;
    /** Final radius in cells for shard spread */
    endRadius: number;
    /** Number of shards at the start of travel */
    startShards: number;
    /** Number of shards at the end of travel */
    endShards: number;
};

/**
 * Blizzard spell. Creates a cone-shaped spread of blizzard shards originating from
 * the caster toward the cursor. An invisible projectile travels from the player
 * anchor to the cursor's cell center, emitting shards at each step.
 */
export class Blizzard {
    private scene: Scene;
    private config: BlizzardConfig;
    private shardConfig: BlizzardShardConfig;
    private originPixelX: number;
    private originPixelY: number;
    private destPixelX: number;
    private destPixelY: number;

    private emissionTimers: Phaser.Time.TimerEvent[] = [];
    private destroyTimer: Phaser.Time.TimerEvent | undefined;

    constructor(
        scene: Scene,
        originPixelX: number,
        originPixelY: number,
        cursorPixelX: number,
        cursorPixelY: number,
        projectileConfig: BlizzardConfig,
        shardConfig: BlizzardShardConfig
    ) {
        this.scene = scene;
        this.config = projectileConfig;
        this.shardConfig = shardConfig;
        this.originPixelX = originPixelX;
        this.originPixelY = originPixelY;

        const destCellX = convertPixelPosToWorldPos(cursorPixelX);
        const destCellY = convertPixelPosToWorldPos(cursorPixelY);
        this.destPixelX = convertWorldPosToPixelPos(destCellX) + TILE_SIZE / 2;
        this.destPixelY = convertWorldPosToPixelPos(destCellY) + TILE_SIZE / 2;

        this.scheduleEmissions();
        this.destroyTimer = this.scene.time.delayedCall(this.config.projectileSpeed, () => {
            this.destroy();
        });
    }

    private scheduleEmissions(): void {
        const { projectileSpeed, emissionSteps } = this.config;

        for (let step = 0; step < emissionSteps; step++) {
            const progress = emissionSteps > 1 ? step / (emissionSteps - 1) : 1;
            const delay = progress * projectileSpeed;

            const timer = this.scene.time.delayedCall(delay, () => {
                this.emitShards(progress);
            });
            this.emissionTimers.push(timer);
        }
    }

    private emitShards(progress: number): void {
        const { startRadius, endRadius, startShards, endShards } = this.config;

        const radius = Math.floor(startRadius + (endRadius - startRadius) * progress);
        const shardCount = Math.round(startShards + (endShards - startShards) * progress);

        const projPixelX = this.originPixelX + (this.destPixelX - this.originPixelX) * progress;
        const projPixelY = this.originPixelY + (this.destPixelY - this.originPixelY) * progress;

        for (let i = 0; i < shardCount; i++) {
            const { dx, dy } = randomPixelInRadius(radius);
            const shardPixelX = projPixelX + dx;
            const shardPixelY = projPixelY + dy;

            const shardConfig = {
                ...this.shardConfig,
            };
            new BlizzardShard(this.scene, shardPixelX, shardPixelY, shardConfig);
        }
    }

    public destroy(): void {
        for (const timer of this.emissionTimers) {
            timer.destroy();
        }
        this.emissionTimers = [];
        this.destroyTimer?.destroy();
        this.destroyTimer = undefined;
    }
}
