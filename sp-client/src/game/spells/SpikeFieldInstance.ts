import type { Scene } from 'phaser';
import { drawEffectAtPixelCoords } from '../../utils/EffectUtils';
import { EFFECT_SPIKE_FIELD } from '../../constants/Effects';
import type { Effect } from '../effects/Effect';

export type SpikeFieldInstanceConfig = {
    /** Duration in milliseconds before the effect is destroyed (default: 30000) */
    duration?: number;
    /** Called when effect is created. Returns onDestroy callback to remove from effects array. */
    onEffectCreated?: (effect: Effect) => () => void;
};

const DEFAULT_DURATION_MS = 30000;

/**
 * A single spike field tile. Uses Spike Field effect (effect3 sheet 4) in a loop.
 * Destroys after the specified duration.
 */
export class SpikeFieldInstance {
    private effect: Effect | undefined;
    private destroyTimer: Phaser.Time.TimerEvent | undefined;
    private onDestroyRef: () => void = () => {};

    constructor(
        scene: Scene,
        pixelX: number,
        pixelY: number,
        config?: SpikeFieldInstanceConfig
    ) {
        const duration = config?.duration ?? DEFAULT_DURATION_MS;

        this.effect = drawEffectAtPixelCoords(
            scene,
            pixelX,
            pixelY,
            EFFECT_SPIKE_FIELD,
            {
                infiniteLoop: true,
                frameRate: 10,
                startAnimationFrame: Phaser.Math.Between(0, 4), // 0-4 frames
                onDestroy: () => this.onDestroyRef(),
            }
        );

        if (this.effect) {
            const remove = config?.onEffectCreated?.(this.effect);
            if (remove) {
                this.onDestroyRef = remove;
            }
            this.destroyTimer = scene.time.delayedCall(duration, () => {
                this.destroy();
            });
        }
    }

    public destroy(): void {
        this.destroyTimer?.destroy();
        this.destroyTimer = undefined;
        this.effect?.destroy();
        this.effect = undefined;
    }
}
