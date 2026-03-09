import type { Scene } from 'phaser';
import { LightningBlast } from './LightningBlast';
import { LIGHTNING_SOUND } from '../../constants/SoundFileNames';
import { DEPTH_MULTIPLIER } from '../../Config';
import { convertPixelPosToWorldPos } from '../../utils/CoordinateUtils';
import { TILE_SIZE } from '../assets/HBMap';
import { calculateSpatialAudio } from '../../utils/SpatialAudioUtils';
import type { SoundManager } from '../../utils/SoundManager';
import type { CameraManager } from '../../utils/CameraManager';

/** Default segments when origin is not set (above-target bolt) */
const DEFAULT_LIGHTNING_SEGMENTS = 20;
/** Max perpendicular offset (pixels) for lightning jitter - kept subtle */
const LIGHTNING_JITTER = 1;
/** Main bolt line width */
const BOLT_WIDTH = 3;
/** Glow line width */
const GLOW_WIDTH = 1;

export type LightningBoltConfig = {
    /** Duration in ms how long the lightning arc effect lasts */
    arcDuration: number;
    /** Milliseconds between redrawing the lightning arc (new random path) */
    arcPeriod: number;
    /** Frame rate for the Energy Bolt Explosion impact effect */
    impactAnimationSpeed: number;
    /** Sound manager for E40 thunder sound */
    soundManager?: SoundManager;
    /** Player world X for spatial audio */
    playerWorldX?: number;
    /** Player world Y for spatial audio */
    playerWorldY?: number;
    /** Camera manager for shake effect on impact */
    cameraManager?: CameraManager;
    /**
     * Optional origin in pixel coordinates. If not set, origin is target with y - 600 (above target).
     */
    originPixelX?: number;
    originPixelY?: number;
};

/** Vertical offset above target for lightning source (pixels) */
const LIGHTNING_SOURCE_OFFSET_Y = 600;

/**
 * Lightning Bolt spell. Draws a procedural jagged lightning arc from above the target
 * (y - 600) down to the target. Redraws the arc every arcPeriod ms with a new random path.
 * Spawns the Energy Bolt Explosion effect at the target immediately when cast.
 */
export class LightningBolt {
    private scene: Scene;
    private config: LightningBoltConfig;
    private originPixelX: number;
    private originPixelY: number;
    private targetPixelX: number;
    private targetPixelY: number;
    /** Number of segments for the jagged path (distance in cells, or default when origin not set) */
    private segments: number;

    private graphics: Phaser.GameObjects.Graphics;
    private arcTimer: Phaser.Time.TimerEvent | undefined;
    private destroyTimer: Phaser.Time.TimerEvent | undefined;

    constructor(
        scene: Scene,
        _originPixelX: number,
        _originPixelY: number,
        targetPixelX: number,
        targetPixelY: number,
        config: LightningBoltConfig
    ) {
        this.scene = scene;
        this.config = config;
        this.targetPixelX = targetPixelX;
        this.targetPixelY = targetPixelY;
        if (config.originPixelX !== undefined && config.originPixelY !== undefined) {
            this.originPixelX = config.originPixelX;
            this.originPixelY = config.originPixelY;
            const distPx = Math.hypot(this.targetPixelX - this.originPixelX, this.targetPixelY - this.originPixelY);
            this.segments = Math.max(1, Math.round(distPx / TILE_SIZE));
        } else {
            this.originPixelX = targetPixelX;
            this.originPixelY = targetPixelY - LIGHTNING_SOURCE_OFFSET_Y;
            this.segments = DEFAULT_LIGHTNING_SEGMENTS;
        }

        this.graphics = scene.add.graphics();
        const targetWorldY = convertPixelPosToWorldPos(targetPixelY);
        this.graphics.setDepth(targetWorldY * DEPTH_MULTIPLIER + 50);

        this.playThunderSound();
        this.spawnImpactEffect();
        this.drawArc();

        this.arcTimer = scene.time.addEvent({
            delay: config.arcPeriod,
            callback: this.drawArc,
            callbackScope: this,
            repeat: Math.floor(config.arcDuration / config.arcPeriod) - 1,
        });

        this.destroyTimer = scene.time.delayedCall(config.arcDuration, () => {
            this.destroy();
        });
    }

    private playThunderSound(): void {
        const { soundManager, playerWorldX, playerWorldY } = this.config;
        if (soundManager && playerWorldX !== undefined && playerWorldY !== undefined) {
            const targetWorldX = convertPixelPosToWorldPos(this.targetPixelX);
            const targetWorldY = convertPixelPosToWorldPos(this.targetPixelY);
            const spatialConfig = calculateSpatialAudio({
                sourceX: targetWorldX,
                sourceY: targetWorldY,
                listenerX: playerWorldX,
                listenerY: playerWorldY,
            });
            soundManager.playOnce(LIGHTNING_SOUND, undefined, spatialConfig);
        }
    }

    /**
     * Generates a jagged path from origin to target with random perpendicular offsets.
     */
    private generatePath(): { x: number; y: number }[] {
        const points: { x: number; y: number }[] = [];
        const dx = this.targetPixelX - this.originPixelX;
        const dy = this.targetPixelY - this.originPixelY;
        const seg = this.segments;

        for (let i = 0; i <= seg; i++) {
            const t = i / seg;
            let x = this.originPixelX + dx * t;
            let y = this.originPixelY + dy * t;

            if (i > 0 && i < seg) {
                const perpX = -dy / seg;
                const perpY = dx / seg;
                const jitter = Phaser.Math.FloatBetween(-LIGHTNING_JITTER, LIGHTNING_JITTER);
                x += perpX * jitter;
                y += perpY * jitter;
            }

            points.push({ x, y });
        }

        return points;
    }

    /**
     * Draws the lightning arc using a jagged path. Main bolt (bright) + glow (dim).
     */
    private drawArc(): void {
        this.graphics.clear();

        const path = this.generatePath();

        for (let branch = 0; branch < 3; branch++) {
            const offset = branch === 0 ? 0 : (branch === 1 ? 2 : -2);
            const isMain = branch === 0;

            if (isMain) {
                this.graphics.lineStyle(BOLT_WIDTH, 0xffffff, 0.95);
            } else {
                this.graphics.lineStyle(GLOW_WIDTH, 0x6464ff, 0.6);
            }

            for (let i = 0; i < path.length - 1; i++) {
                let x1 = path[i].x;
                let y1 = path[i].y;
                let x2 = path[i + 1].x;
                let y2 = path[i + 1].y;

                if (branch > 0) {
                    const perpX = (path[i + 1].y - path[i].y) / this.segments;
                    const perpY = -(path[i + 1].x - path[i].x) / this.segments;
                    x1 += perpX * offset;
                    y1 += perpY * offset;
                    x2 += perpX * offset;
                    y2 += perpY * offset;
                }

                this.graphics.lineBetween(x1, y1, x2, y2);
            }
        }
    }

    private spawnImpactEffect(): void {
        const targetWorldX = convertPixelPosToWorldPos(this.targetPixelX);
        const targetWorldY = convertPixelPosToWorldPos(this.targetPixelY);

        LightningBlast.spawn(this.scene, targetWorldX, targetWorldY, {
            soundManager: this.config.soundManager,
            playerWorldX: this.config.playerWorldX,
            playerWorldY: this.config.playerWorldY,
            frameRate: this.config.impactAnimationSpeed,
            cameraManager: this.config.cameraManager,
        });
    }

    public destroy(): void {
        this.arcTimer?.destroy();
        this.arcTimer = undefined;
        this.destroyTimer?.destroy();
        this.destroyTimer = undefined;
        this.graphics.destroy();
    }
}
