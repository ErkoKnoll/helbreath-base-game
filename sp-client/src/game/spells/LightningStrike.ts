import type { Scene } from 'phaser';
import { LightningBolt } from './LightningBolt';
import type { LightningBoltConfig } from './LightningBolt';
import { convertPixelPosToWorldPos, convertWorldPosToPixelPos } from '../../utils/CoordinateUtils';
import { TILE_SIZE } from '../assets/HBMap';

/** Y offset from player position for lightning source (player's head) */
const LIGHTNING_STRIKE_SOURCE_OFFSET_Y = 50;

export type LightningStrikeConfig = {
    /** Milliseconds between spawning each LightningBolt */
    strikeInterval: number;
    /** Number of lightning bolts to strike */
    strikes: number;
    /** Radius in cells around target for random strike destination (target cell included) */
    radius: number;
    /** Pass-through config for each LightningBolt */
    lightningBoltConfig: LightningBoltConfig;
};

/**
 * Lightning Strike spell. Spawns multiple LightningBolt instances consecutively from the
 * caster (player head) to random cells within radius of the target.
 */
export class LightningStrike {
    private scene: Scene;
    private config: LightningStrikeConfig;
    private originPixelX: number;
    private originPixelY: number;
    private targetWorldX: number;
    private targetWorldY: number;

    private strikeTimer: Phaser.Time.TimerEvent | undefined;
    private strikesRemaining: number;

    constructor(
        scene: Scene,
        originPixelX: number,
        originPixelY: number,
        targetPixelX: number,
        targetPixelY: number,
        config: LightningStrikeConfig
    ) {
        this.scene = scene;
        this.config = config;
        this.originPixelX = originPixelX;
        this.originPixelY = originPixelY - LIGHTNING_STRIKE_SOURCE_OFFSET_Y;
        this.targetWorldX = convertPixelPosToWorldPos(targetPixelX);
        this.targetWorldY = convertPixelPosToWorldPos(targetPixelY);
        this.strikesRemaining = config.strikes;

        this.scheduleNextStrike();
    }

    /**
     * Picks a random cell within radius of the target (target included).
     */
    private getRandomTargetPixel(): { x: number; y: number } {
        const { radius } = this.config;
        const offsetX = radius > 0 ? Phaser.Math.Between(-radius, radius) : 0;
        const offsetY = radius > 0 ? Phaser.Math.Between(-radius, radius) : 0;
        const cellX = this.targetWorldX + offsetX;
        const cellY = this.targetWorldY + offsetY;
        const pixelX = convertWorldPosToPixelPos(cellX) + TILE_SIZE / 2;
        const pixelY = convertWorldPosToPixelPos(cellY) + TILE_SIZE / 2;
        return { x: pixelX, y: pixelY };
    }

    private spawnBolt(): void {
        const { x: targetPixelX, y: targetPixelY } = this.getRandomTargetPixel();

        new LightningBolt(this.scene, 0, 0, targetPixelX, targetPixelY, {
            ...this.config.lightningBoltConfig,
            originPixelX: this.originPixelX,
            originPixelY: this.originPixelY,
        });
    }

    private scheduleNextStrike(): void {
        if (this.strikesRemaining <= 0) {
            this.destroy();
            return;
        }

        this.spawnBolt();
        this.strikesRemaining--;

        if (this.strikesRemaining > 0) {
            this.strikeTimer = this.scene.time.delayedCall(
                this.config.strikeInterval,
                () => this.scheduleNextStrike()
            );
        } else {
            this.destroy();
        }
    }

    public destroy(): void {
        this.strikeTimer?.destroy();
        this.strikeTimer = undefined;
    }
}
