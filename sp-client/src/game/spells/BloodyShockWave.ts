import type { Scene } from 'phaser';
import { Effect } from '../effects/Effect';
import { getEffectByKey } from '../../constants/Effects';
import { EFFECT_BLOODY_SHOCK_WAVE_NODE } from '../../constants/Effects';
import { convertPixelPosToWorldPos, convertWorldPosToPixelPos } from '../../utils/CoordinateUtils';
import { TILE_SIZE } from '../assets/HBMap';
import type { SoundManager } from '../../utils/SoundManager';
import type { CameraManager } from '../../utils/CameraManager';

export type BloodyShockWaveConfig = {
    /** Total travel duration in milliseconds. Determines projectile speed (distance / duration). */
    duration: number;
    /** Interval in milliseconds between node emissions along the travel path */
    emissionInterval: number;
    /** Sound manager for effect sounds */
    soundManager?: SoundManager;
    /** Player world X for spatial audio */
    playerWorldX?: number;
    /** Player world Y for spatial audio */
    playerWorldY?: number;
    /** Camera manager for shake effect at target */
    cameraManager?: CameraManager;
};

function getRandomOffset(): number {
    return 30 - Phaser.Math.Between(0, 59);
}

/**
 * Bloody Shock Wave spell. Creates an invisible projectile that travels from the
 * caster position (y - 40 pixels) towards the target cell, emitting Bloody Shock
 * Wave Node effects at fixed intervals along its path.
 */
export class BloodyShockWave {
    private scene: Scene;
    private config: BloodyShockWaveConfig;
    private originPixelX: number;
    private originPixelY: number;
    private destPixelX: number;
    private destPixelY: number;
    private travelTimeMs: number = 0;

    private startTime: number = 0;
    private emissionTimer: Phaser.Time.TimerEvent | undefined;
    private destroyTimer: Phaser.Time.TimerEvent | undefined;
    private cameraShakeTimer: Phaser.Time.TimerEvent | undefined;

    constructor(
        scene: Scene,
        originPixelX: number,
        originPixelY: number,
        targetPixelX: number,
        targetPixelY: number,
        config: BloodyShockWaveConfig
    ) {
        this.scene = scene;
        this.config = config;

        this.originPixelX = originPixelX;
        this.originPixelY = originPixelY - 40;

        const destCellX = convertPixelPosToWorldPos(targetPixelX);
        const destCellY = convertPixelPosToWorldPos(targetPixelY);
        this.destPixelX = convertWorldPosToPixelPos(destCellX) + TILE_SIZE / 2;
        this.destPixelY = convertWorldPosToPixelPos(destCellY) + TILE_SIZE / 2;

        this.travelTimeMs = config.duration;

        this.startTime = this.scene.time.now;

        this.emitNode();
        this.scheduleNextEmission();

        this.cameraShakeTimer = this.scene.time.delayedCall(config.duration, () => {
            this.config.cameraManager?.setCameraShake(this.destPixelX, this.destPixelY, 2);
        });

        this.destroyTimer = this.scene.time.delayedCall(config.duration, () => {
            this.destroy();
        });
    }

    private getCurrentPosition(): { pixelX: number; pixelY: number } {
        const elapsed = this.scene.time.now - this.startTime;
        const t = this.travelTimeMs > 0 ? Math.min(elapsed / this.travelTimeMs, 1) : 1;
        return {
            pixelX: this.originPixelX + (this.destPixelX - this.originPixelX) * t,
            pixelY: this.originPixelY + (this.destPixelY - this.originPixelY) * t,
        };
    }

    private emitNode(): void {
        const { pixelX, pixelY } = this.getCurrentPosition();

        const offsetX = getRandomOffset();
        const offsetY = getRandomOffset();
        const effectX = pixelX + offsetX;
        const effectY = pixelY + offsetY;

        const nodeConfig = getEffectByKey(EFFECT_BLOODY_SHOCK_WAVE_NODE);
        if (nodeConfig) {
            new Effect(this.scene, {
                config: nodeConfig,
                pixelX: effectX,
                pixelY: effectY,
                soundManager: this.config.soundManager,
                playerWorldX: this.config.playerWorldX,
                playerWorldY: this.config.playerWorldY,
            });
        }
    }

    private scheduleNextEmission(): void {
        const elapsed = this.scene.time.now - this.startTime;
        if (elapsed >= this.travelTimeMs) {
            return;
        }

        this.emissionTimer = this.scene.time.delayedCall(this.config.emissionInterval, () => {
            this.emitNode();
            this.scheduleNextEmission();
        });
    }

    public destroy(): void {
        this.emissionTimer?.destroy();
        this.emissionTimer = undefined;
        this.cameraShakeTimer?.destroy();
        this.cameraShakeTimer = undefined;
        this.destroyTimer?.destroy();
        this.destroyTimer = undefined;
    }
}
