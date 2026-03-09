import type { Scene } from 'phaser';
import { convertPixelPosToWorldPos } from '../../utils/CoordinateUtils';
import { drawEffect } from '../../utils/EffectUtils';
import { EFFECT_FIRE_BALL_EXPLOSION } from '../../constants/Effects';
import type { SoundManager } from '../../utils/SoundManager';
import type { CameraManager } from '../../utils/CameraManager';
import { DirectionalProjectile, type DirectionalProjectileConfig } from '../effects/DirectionalProjectile';

export type FireBallConfig = Omit<DirectionalProjectileConfig, 'spriteName' | 'spriteSheetIndex'> & {
    /** Sound manager for launch sound */
    soundManager?: SoundManager;
    /** Player world X for spatial audio */
    playerWorldX?: number;
    /** Player world Y for spatial audio */
    playerWorldY?: number;
    /** Camera manager for shake on explosion */
    cameraManager?: CameraManager;
    /** Effect key for explosion on impact. Defaults to EFFECT_FIRE_BALL_EXPLOSION. */
    explosionEffectKey?: string;
};

/**
 * Fire Ball spell. Fires a single directional projectile from origin (pixels) to target (world cell).
 * Uses effect sprite sheet 5 with DirectionalSubFrame animation (4 frames per direction, 8 directions).
 * On arrival, plays Fire Ball Explosion effect.
 */
export class FireBall extends DirectionalProjectile {
    constructor(
        scene: Scene,
        originPixelX: number,
        originPixelY: number,
        targetWorldX: number,
        targetWorldY: number,
        config: FireBallConfig
    ) {
        super(scene, originPixelX, originPixelY, targetWorldX, targetWorldY, {
            ...config,
            spriteName: 'effect',
            spriteSheetIndex: 5,
        });
    }

    protected onReachDestination(): void {
        const destWorldX = convertPixelPosToWorldPos(this.destPixelX);
        const destWorldY = convertPixelPosToWorldPos(this.destPixelY);
        // DirectionalProjectile stores generic config; FireBall uses FireBallConfig (explosionEffectKey, etc.)
        const config = this.config as FireBallConfig;

        config.cameraManager?.setCameraShake(this.destPixelX, this.destPixelY);

        const explosionKey = config.explosionEffectKey ?? EFFECT_FIRE_BALL_EXPLOSION;
        drawEffect(this.scene, destWorldX, destWorldY, explosionKey, {
            soundManager: config.soundManager,
            playerWorldX: config.playerWorldX,
            playerWorldY: config.playerWorldY,
        });
    }
}
