import type { Scene } from 'phaser';
import { drawEffectAtPixelCoords } from '../../utils/EffectUtils';
import { EFFECT_FIRE_BALL_EXPLOSION } from '../../constants/Effects';
import type { SoundManager } from '../../utils/SoundManager';
import type { CameraManager } from '../../utils/CameraManager';
import { DirectionalProjectile, type DirectionalProjectileConfig } from '../effects/DirectionalProjectile';

export type FireStrikeConfig = Omit<DirectionalProjectileConfig, 'spriteName' | 'spriteSheetIndex'> & {
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
 * Center + 3 offset explosions with staggered delays (cStartFrame: 0, -3, -5, -7).
 * At ~50fps, 1 frame ≈ 20ms.
 */
const EXPLOSION_OFFSETS: { dx: number; dy: number; delayMs: number }[] = [
    { dx: 0, dy: 0, delayMs: 0 },
    { dx: 20, dy: 30, delayMs: 60 },
    { dx: 35, dy: -30, delayMs: 100 },
    { dx: -30, dy: -15, delayMs: 140 },
];

/**
 * Fire Strike spell. Same projectile as Fire Ball (effect sheet 5, directional).
 * On arrival, spawns 4 Fire Ball Explosions: center + 3 offsets with staggered delays.
 */
export class FireStrike extends DirectionalProjectile {
    constructor(
        scene: Scene,
        originPixelX: number,
        originPixelY: number,
        targetWorldX: number,
        targetWorldY: number,
        config: FireStrikeConfig
    ) {
        super(scene, originPixelX, originPixelY, targetWorldX, targetWorldY, {
            ...config,
            spriteName: 'effect',
            spriteSheetIndex: 5,
        });
    }

    protected onReachDestination(): void {
        // DirectionalProjectile stores generic config; FireStrike uses FireStrikeConfig
        const config = this.config as FireStrikeConfig;
        const effectOptions = {
            soundManager: config.soundManager,
            playerWorldX: config.playerWorldX,
            playerWorldY: config.playerWorldY,
        };

        for (const { dx, dy, delayMs } of EXPLOSION_OFFSETS) {
            const pixelX = this.destPixelX + dx;
            const pixelY = this.destPixelY + dy;

            const spawnExplosion = () => {
                config.cameraManager?.setCameraShake(pixelX, pixelY);
                drawEffectAtPixelCoords(this.scene, pixelX, pixelY, EFFECT_FIRE_BALL_EXPLOSION, effectOptions);
            };

            if (delayMs <= 0) {
                spawnExplosion();
            } else {
                this.scene.time.delayedCall(delayMs, spawnExplosion);
            }
        }
    }
}
