import type { Scene } from 'phaser';
import { convertPixelPosToWorldPos, convertWorldPosToPixelPos } from '../../utils/CoordinateUtils';
import { TILE_SIZE } from '../assets/HBMap';
import { PoisonCloudInstance } from './PoisonCloudInstance';
import type { Effect } from '../effects/Effect';

/** Radius in cells from center (1 = 3x3 area) */
const FIELD_RADIUS = 1;

export type PoisonCloudConfig = {
    /** Duration in milliseconds each poison cloud instance lasts (default: 30000) */
    duration?: number;
    /** Called when each effect is created. Returns onDestroy to remove from effects array. */
    onEffectCreated?: (effect: Effect) => () => void;
};

/**
 * Poison Cloud spell. Creates a 3x3 field of poison cloud tiles centered on the target.
 * Each tile uses Poison Cloud effect (effect4 sheet 4) in a loop for the configured duration.
 */
export class PoisonCloud {
    private instances: PoisonCloudInstance[] = [];

    constructor(
        scene: Scene,
        targetPixelX: number,
        targetPixelY: number,
        config: PoisonCloudConfig
    ) {
        const targetWorldX = convertPixelPosToWorldPos(targetPixelX);
        const targetWorldY = convertPixelPosToWorldPos(targetPixelY);

        const duration = config.duration ?? 30000;

        for (let dy = -FIELD_RADIUS; dy <= FIELD_RADIUS; dy++) {
            for (let dx = -FIELD_RADIUS; dx <= FIELD_RADIUS; dx++) {
                const wx = targetWorldX + dx;
                const wy = targetWorldY + dy;
                const pixelX = convertWorldPosToPixelPos(wx) + TILE_SIZE / 2;
                const pixelY = convertWorldPosToPixelPos(wy) + TILE_SIZE / 2;

                const instance = new PoisonCloudInstance(scene, pixelX, pixelY, {
                    duration,
                    onEffectCreated: config.onEffectCreated,
                });
                this.instances.push(instance);
            }
        }
    }

    public destroy(): void {
        for (const instance of this.instances) {
            instance.destroy();
        }
        this.instances = [];
    }
}
