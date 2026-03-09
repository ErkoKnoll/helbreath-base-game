import type { Scene } from 'phaser';
import { EarthShockWaveTorrent } from './EarthShockWaveTorrent';
import type { EarthShockWaveTorrentConfig } from './EarthShockWaveTorrent';
import { convertPixelPosToWorldPos, convertWorldPosToPixelPos } from '../../utils/CoordinateUtils';
import { TILE_SIZE } from '../assets/HBMap';
import type { CameraManager } from '../../utils/CameraManager';

export type EarthShockWaveConfig = {
    /** Milliseconds for how long the projectile stays at destination emitting before destroying */
    duration: number;
    /** Projectile speed in pixels per second */
    projectileSpeed: number;
    /** Interval in milliseconds between torrent emissions while moving */
    emissionInterval: number;
    /** Interval in milliseconds between torrent emissions when projectile has reached target */
    immobileEmissionInterval: number;
    /** Camera manager for shake effect when projectile reaches destination */
    cameraManager?: CameraManager;
};

/**
 * Earth Shock Wave spell. Creates an invisible projectile that travels from the
 * player's anchor to the cursor's target cell, emitting Earth Shock Wave Torrent
 * effects at fixed intervals along its path. When the destination is reached,
 * the projectile remains immobile and continues emitting for the configured
 * duration before destroying.
 */
export class EarthShockWave {
    private scene: Scene;
    private config: EarthShockWaveConfig;
    private torrentConfig: EarthShockWaveTorrentConfig;
    private originPixelX: number;
    private originPixelY: number;
    private destPixelX: number;
    private destPixelY: number;

    private startTime: number = 0;
    private emissionTimer: Phaser.Time.TimerEvent | undefined;
    private destroyTimer: Phaser.Time.TimerEvent | undefined;
    private travelTimeMs: number = 0;
    private hasTriggeredCameraShake = false;

    constructor(
        scene: Scene,
        originPixelX: number,
        originPixelY: number,
        cursorPixelX: number,
        cursorPixelY: number,
        projectileConfig: EarthShockWaveConfig,
        torrentConfig: EarthShockWaveTorrentConfig
    ) {
        this.scene = scene;
        this.config = projectileConfig;
        this.torrentConfig = torrentConfig;
        this.originPixelX = originPixelX;
        this.originPixelY = originPixelY;

        const destCellX = convertPixelPosToWorldPos(cursorPixelX);
        const destCellY = convertPixelPosToWorldPos(cursorPixelY);
        this.destPixelX = convertWorldPosToPixelPos(destCellX) + TILE_SIZE / 2;
        this.destPixelY = convertWorldPosToPixelPos(destCellY) + TILE_SIZE / 2;

        const distancePx = Phaser.Math.Distance.Between(
            originPixelX,
            originPixelY,
            this.destPixelX,
            this.destPixelY
        );
        this.travelTimeMs = distancePx > 0 ? (distancePx / projectileConfig.projectileSpeed) * 1000 : 0;

        this.startTime = this.scene.time.now;

        this.emitTorrent();
        this.scheduleNextEmission();

        const totalLifetimeMs = this.travelTimeMs + projectileConfig.duration;
        this.destroyTimer = this.scene.time.delayedCall(totalLifetimeMs, () => {
            this.destroy();
        });
    }

    private emitTorrent(): void {
        const elapsed = this.scene.time.now - this.startTime;
        let pixelX: number;
        let pixelY: number;

        if (elapsed >= this.travelTimeMs) {
            pixelX = this.destPixelX;
            pixelY = this.destPixelY;
            if (!this.hasTriggeredCameraShake) {
                this.hasTriggeredCameraShake = true;
                this.config.cameraManager?.setCameraShake(pixelX, pixelY);
            }
        } else {
            const t = this.travelTimeMs > 0 ? elapsed / this.travelTimeMs : 1;
            pixelX = this.originPixelX + (this.destPixelX - this.originPixelX) * t;
            pixelY = this.originPixelY + (this.destPixelY - this.originPixelY) * t;
        }

        new EarthShockWaveTorrent(this.scene, pixelX, pixelY, this.torrentConfig);
    }

    private scheduleNextEmission(): void {
        const elapsed = this.scene.time.now - this.startTime;
        const atDestination = elapsed >= this.travelTimeMs;
        const interval = atDestination ? this.config.immobileEmissionInterval : this.config.emissionInterval;

        this.emissionTimer = this.scene.time.delayedCall(interval, () => {
            this.emitTorrent();
            this.scheduleNextEmission();
        });
    }

    public destroy(): void {
        this.emissionTimer?.destroy();
        this.emissionTimer = undefined;
        this.destroyTimer?.destroy();
        this.destroyTimer = undefined;
    }
}
