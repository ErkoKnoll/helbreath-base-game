import type { Scene } from 'phaser';
import { MeteorStrikeProjectile } from './MeteorStrikeProjectile';
import type { MeteorStrikeProjectileConfig } from './MeteorStrikeProjectile';

export type MeteorStrikeConfig = MeteorStrikeProjectileConfig;

/**
 * Meteor Strike spell. Creates a single projectile from above the cursor
 * (cursor +300px X, -600px Y) that travels toward the cursor position.
 */
export class MeteorStrike {
    constructor(
        scene: Scene,
        _originPixelX: number,
        _originPixelY: number,
        targetPixelX: number,
        targetPixelY: number,
        config: MeteorStrikeConfig
    ) {
        new MeteorStrikeProjectile(scene, targetPixelX, targetPixelY, {
            projectileSpeed: config.projectileSpeed,
            soundManager: config.soundManager,
            playerWorldX: config.playerWorldX,
            playerWorldY: config.playerWorldY,
            cameraManager: config.cameraManager,
        });
    }
}
