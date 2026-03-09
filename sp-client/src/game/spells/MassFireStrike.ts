import type { Scene } from 'phaser';
import { drawEffectAtPixelCoords } from '../../utils/EffectUtils';
import { EFFECT_EXPLOSION_1, EFFECT_EXPLOSION_2 } from '../../constants/Effects';
import type { SoundManager } from '../../utils/SoundManager';
import type { CameraManager } from '../../utils/CameraManager';
import { DirectionalProjectile, type DirectionalProjectileConfig } from '../effects/DirectionalProjectile';

export type MassFireStrikeConfig = Omit<DirectionalProjectileConfig, 'spriteName' | 'spriteSheetIndex'> & {
    /** Sound manager for launch sound */
    soundManager?: SoundManager;
    /** Player world X for spatial audio */
    playerWorldX?: number;
    /** Player world Y for spatial audio */
    playerWorldY?: number;
    /** Camera manager for shake on explosion */
    cameraManager?: CameraManager;
};

/**
 * Explosion positions and delays.
 * 1x center (Explosion 1) + 3x offsets (Explosion 2) with staggered delays.
 */
const EXPLOSION_OFFSETS: { dx: number; dy: number; delayMs: number; effectKey: string }[] = [
    { dx: 0, dy: 0, delayMs: 0, effectKey: EFFECT_EXPLOSION_1 },
    { dx: -30, dy: -15, delayMs: 60, effectKey: EFFECT_EXPLOSION_2 },
    { dx: 35, dy: -30, delayMs: 100, effectKey: EFFECT_EXPLOSION_2 },
    { dx: 20, dy: 30, delayMs: 140, effectKey: EFFECT_EXPLOSION_2 },
];

/**
 * Mass Fire Strike spell. Same projectile as Fire Strike (effect sheet 5, directional).
 * On arrival, spawns 1x Explosion 1 (center) + 3x Explosion 2 (offsets) with staggered delays.
 */
export class MassFireStrike extends DirectionalProjectile {
    constructor(
        scene: Scene,
        originPixelX: number,
        originPixelY: number,
        targetWorldX: number,
        targetWorldY: number,
        config: MassFireStrikeConfig
    ) {
        super(scene, originPixelX, originPixelY, targetWorldX, targetWorldY, {
            ...config,
            spriteName: 'effect',
            spriteSheetIndex: 5,
        });
    }

    protected onReachDestination(): void {
        // DirectionalProjectile stores generic config; MassFireStrike uses MassFireStrikeConfig
        const config = this.config as MassFireStrikeConfig;
        const effectOptions = {
            soundManager: config.soundManager,
            playerWorldX: config.playerWorldX,
            playerWorldY: config.playerWorldY,
        };

        for (const { dx, dy, delayMs, effectKey } of EXPLOSION_OFFSETS) {
            const pixelX = this.destPixelX + dx;
            const pixelY = this.destPixelY + dy;

            const spawnExplosion = () => {
                config.cameraManager?.setCameraShake(pixelX, pixelY);
                drawEffectAtPixelCoords(this.scene, pixelX, pixelY, effectKey, effectOptions);
            };

            if (delayMs <= 0) {
                spawnExplosion();
            } else {
                this.scene.time.delayedCall(delayMs, spawnExplosion);
            }
        }
    }
}
