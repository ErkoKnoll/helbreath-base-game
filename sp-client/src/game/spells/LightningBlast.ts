import type { Scene } from 'phaser';
import { EFFECT_ENERGY_BOLT_EXPLOSION } from '../../constants/Effects';
import { drawEffect } from '../../utils/EffectUtils';
import { convertWorldPosToPixelPos } from '../../utils/CoordinateUtils';
import { TILE_SIZE } from '../assets/HBMap';
import type { SoundManager } from '../../utils/SoundManager';
import type { CameraManager } from '../../utils/CameraManager';

export type LightningBlastConfig = {
    /** Sound manager for E2 explosion sound */
    soundManager?: SoundManager;
    /** Player world X for spatial audio */
    playerWorldX?: number;
    /** Player world Y for spatial audio */
    playerWorldY?: number;
    /** Frame rate for the impact animation (default from effect config) */
    frameRate?: number;
    /** Camera manager for shake effect on impact */
    cameraManager?: CameraManager;
};

/**
 * Lightning Blast impact effect. Spawns the Energy Bolt Explosion at the target
 * and applies camera shake based on distance from screen center.
 * Used by Lightning Bolt and Energy Bolt spells.
 */
export class LightningBlast {
    /**
     * Spawns the lightning blast impact effect at the given world coordinates.
     * Draws the Energy Bolt Explosion and triggers camera shake.
     */
    public static spawn(
        scene: Scene,
        worldX: number,
        worldY: number,
        config: LightningBlastConfig
    ): void {
        const pixelX = convertWorldPosToPixelPos(worldX) + TILE_SIZE / 2;
        const pixelY = convertWorldPosToPixelPos(worldY) + TILE_SIZE / 2;

        drawEffect(scene, worldX, worldY, EFFECT_ENERGY_BOLT_EXPLOSION, {
            soundManager: config.soundManager,
            playerWorldX: config.playerWorldX,
            playerWorldY: config.playerWorldY,
            frameRate: config.frameRate,
        });

        config.cameraManager?.setCameraShake(pixelX, pixelY);
    }
}
