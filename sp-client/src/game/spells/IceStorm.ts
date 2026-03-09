import type { Scene } from 'phaser';
import { convertPixelPosToWorldPos, convertWorldPosToPixelPos } from '../../utils/CoordinateUtils';
import { TILE_SIZE } from '../assets/HBMap';
import { drawEffectAtPixelCoords } from '../../utils/EffectUtils';
import { EFFECT_WHIRLWIND } from '../../constants/Effects';
import type { Effect } from '../effects/Effect';

export type IceStormConfig = {
    /** Duration in milliseconds the ice storm lasts (default: 30000) */
    duration?: number;
    /** Called when the effect is created. Returns onDestroy to remove from effects array. */
    onEffectCreated?: (effect: Effect) => () => void;
};

const DEFAULT_DURATION_MS = 30000;

/**
 * Ice Storm spell. Creates a single ice storm tile at the target.
 * Uses Whirlwind effect (effect3 sheet 0) in a loop for the configured duration.
 */
export class IceStorm {
    private effect: Effect | undefined;
    private destroyTimer: Phaser.Time.TimerEvent | undefined;
    private onDestroyRef: () => void = () => {};

    constructor(
        scene: Scene,
        targetPixelX: number,
        targetPixelY: number,
        config: IceStormConfig
    ) {
        const targetWorldX = convertPixelPosToWorldPos(targetPixelX);
        const targetWorldY = convertPixelPosToWorldPos(targetPixelY);

        const duration = config.duration ?? DEFAULT_DURATION_MS;

        const pixelX = convertWorldPosToPixelPos(targetWorldX) + TILE_SIZE / 2;
        const pixelY = convertWorldPosToPixelPos(targetWorldY) + TILE_SIZE / 2;

        this.effect = drawEffectAtPixelCoords(
            scene,
            pixelX,
            pixelY,
            EFFECT_WHIRLWIND,
            {
                infiniteLoop: true,
                frameRate: 20,
                onDestroy: () => this.onDestroyRef(),
            }
        );

        if (this.effect) {
            const remove = config.onEffectCreated?.(this.effect);
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
