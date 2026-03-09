import type { Scene } from 'phaser';
import type { CameraManager } from '../../utils/CameraManager';
import { convertPixelPosToWorldPos } from '../../utils/CoordinateUtils';
import { drawEffect } from '../../utils/EffectUtils';
import {
    EFFECT_EARTH_WORM_ATTACK_BASE,
    EFFECT_EARTH_WORM_ATTACK_JAWS,
    EFFECT_EARTH_WORM_ATTACK_HELIX,
} from '../../constants/Effects';
import type { SoundManager } from '../../utils/SoundManager';

export type EarthwormStrikeConfig = {
    /** Sound manager for effect sounds */
    soundManager?: SoundManager;
    /** Player world X for spatial audio */
    playerWorldX?: number;
    /** Player world Y for spatial audio */
    playerWorldY?: number;
    /** Camera manager for shake on creation */
    cameraManager?: CameraManager;
};

/**
 * Earthworm Strike spell. Draws three effects simultaneously at the cursor world/cell location:
 * Earth Worm Attack Base, Earth Worm Attack Jaws, Earth Worm Attack Helix.
 */
export class EarthwormStrike {
    constructor(
        scene: Scene,
        _originPixelX: number,
        _originPixelY: number,
        targetPixelX: number,
        targetPixelY: number,
        config: EarthwormStrikeConfig
    ) {
        const worldX = convertPixelPosToWorldPos(targetPixelX);
        const worldY = convertPixelPosToWorldPos(targetPixelY);

        config.cameraManager?.setCameraShake(targetPixelX, targetPixelY, 2);

        const drawOptions = {
            soundManager: config.soundManager,
            playerWorldX: config.playerWorldX,
            playerWorldY: config.playerWorldY,
        };

        drawEffect(scene, worldX, worldY, EFFECT_EARTH_WORM_ATTACK_BASE, drawOptions);
        drawEffect(scene, worldX, worldY, EFFECT_EARTH_WORM_ATTACK_JAWS, drawOptions);
        drawEffect(scene, worldX, worldY, EFFECT_EARTH_WORM_ATTACK_HELIX, drawOptions);
    }
}
