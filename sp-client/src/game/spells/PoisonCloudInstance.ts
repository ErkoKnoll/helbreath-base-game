import type { Scene } from 'phaser';
import { drawEffectAtPixelCoords } from '../../utils/EffectUtils';
import { EFFECT_POISON_CLOUD } from '../../constants/Effects';
import type { Effect } from '../effects/Effect';

export type PoisonCloudInstanceConfig = {
    /** Duration in milliseconds before the effect is destroyed (default: 30000) */
    duration?: number;
    /** Called when effect is created. Returns onDestroy callback to remove from effects array. */
    onEffectCreated?: (effect: Effect) => () => void;
};

const DEFAULT_DURATION_MS = 30000;

/**
 * A single poison cloud tile. Uses Poison Cloud effect (effect4 sheet 4) in a loop.
 * Destroys after the specified duration.
 */
export class PoisonCloudInstance {
    private effect: Effect | undefined;
    private destroyTimer: Phaser.Time.TimerEvent | undefined;
    private onDestroyRef: () => void = () => {};

    constructor(
        scene: Scene,
        pixelX: number,
        pixelY: number,
        config?: PoisonCloudInstanceConfig
    ) {
        const duration = config?.duration ?? DEFAULT_DURATION_MS;

        this.effect = drawEffectAtPixelCoords(
            scene,
            pixelX,
            pixelY,
            EFFECT_POISON_CLOUD,
            {
                infiniteLoop: true,
                frameRate: 10,
                startAnimationFrame: Phaser.Math.Between(0, 10), // 0-10 frames
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
