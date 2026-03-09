import type { Scene } from 'phaser';
import { ChillWindDroplet } from './ChillWindDroplet';
import type { SoundManager } from '../../utils/SoundManager';

const DROPLET_OFFSETS: [number, number][] = [
    [0, 0],       // center
    [-30, -15],
    [35, -30],
    [20, 30],
];

export type ChillWindConfig = {
    /** Distance (in pixels) droplets drop from above the target */
    dropDistance: number;
    /** Fall speed in pixels per second */
    projectileSpeed: number;
    /** Sound manager for E45 cast sound */
    soundManager?: SoundManager;
    /** Player world X for spatial audio */
    playerWorldX?: number;
    /** Player world Y for spatial audio */
    playerWorldY?: number;
};

/**
 * Chill Wind spell. Spawns 4 droplets at target (center + 3 offsets).
 */
export class ChillWind {
    private droplets: ChillWindDroplet[] = [];

    constructor(
        scene: Scene,
        targetPixelX: number,
        targetPixelY: number,
        config: ChillWindConfig
    ) {
        const dropletConfig = {
            dropDistance: config.dropDistance,
            projectileSpeed: config.projectileSpeed,
            soundManager: config.soundManager,
            playerWorldX: config.playerWorldX,
            playerWorldY: config.playerWorldY,
        };

        for (const [dx, dy] of DROPLET_OFFSETS) {
            const pixelX = targetPixelX + dx;
            const pixelY = targetPixelY + dy;
            const droplet = new ChillWindDroplet(scene, pixelX, pixelY, dropletConfig);
            this.droplets.push(droplet);
        }
    }

    public destroy(): void {
        for (const droplet of this.droplets) {
            droplet.destroy();
        }
        this.droplets = [];
    }
}
