import type { Scene } from 'phaser';
import { ChillWindDroplet } from './ChillWindDroplet';
import { EFFECT_MASS_CHILL_WIND_DROPLET } from '../../constants/Effects';
import type { SoundManager } from '../../utils/SoundManager';

const FIXED_OFFSETS: [number, number][] = [
    [0, 0],
    [-30, -15],
    [35, -30],
    [20, 30],
];

function randomOffset(): [number, number] {
    const x = Phaser.Math.Between(-50, 49);
    const y = Phaser.Math.Between(-35, 34);
    return [x, y];
}

export type MassChillWindConfig = {
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
 * Mass Chill Wind spell. Spawns 8 droplets at target: 4 fixed + 4 random offsets.
 * Uses effect5 sheet 6 (Mass Chill Wind Droplet).
 */
export class MassChillWind {
    private droplets: ChillWindDroplet[] = [];

    constructor(
        scene: Scene,
        targetPixelX: number,
        targetPixelY: number,
        config: MassChillWindConfig
    ) {
        const dropletConfig = {
            effectKey: EFFECT_MASS_CHILL_WIND_DROPLET,
            dropDistance: config.dropDistance,
            projectileSpeed: config.projectileSpeed,
            soundManager: config.soundManager,
            playerWorldX: config.playerWorldX,
            playerWorldY: config.playerWorldY,
        };

        for (const [dx, dy] of FIXED_OFFSETS) {
            const pixelX = targetPixelX + dx;
            const pixelY = targetPixelY + dy;
            const droplet = new ChillWindDroplet(scene, pixelX, pixelY, dropletConfig);
            this.droplets.push(droplet);
        }

        for (let i = 0; i < 4; i++) {
            const [dx, dy] = randomOffset();
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
