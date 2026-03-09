import type { Scene } from 'phaser';
import { convertPixelPosToWorldPos, convertWorldPosToPixelPos } from '../../utils/CoordinateUtils';
import { drawEffect, drawEffectAtPixelCoords } from '../../utils/EffectUtils';
import { EFFECT_ARMOR_BREAK_BASE, EFFECT_ARMOR_BREAK_TORRENT } from '../../constants/Effects';
import { TILE_SIZE } from '../assets/HBMap';
import type { SoundManager } from '../../utils/SoundManager';

export type ArmorBreakConfig = {
    /** Sound manager for effect sounds */
    soundManager?: SoundManager;
    /** Player world X for spatial audio */
    playerWorldX?: number;
    /** Player world Y for spatial audio */
    playerWorldY?: number;
};

/**
 * Armor Break spell. Draws two effects simultaneously at the cursor world/cell location:
 * Armor Break Base, Armor Break Torrent.
 */
export class ArmorBreak {
    constructor(
        scene: Scene,
        _originPixelX: number,
        _originPixelY: number,
        targetPixelX: number,
        targetPixelY: number,
        config: ArmorBreakConfig
    ) {
        const worldX = convertPixelPosToWorldPos(targetPixelX);
        const worldY = convertPixelPosToWorldPos(targetPixelY);

        const drawOptions = {
            soundManager: config.soundManager,
            playerWorldX: config.playerWorldX,
            playerWorldY: config.playerWorldY,
        };

        const pixelX = convertWorldPosToPixelPos(worldX) + TILE_SIZE / 2;
        const pixelY = convertWorldPosToPixelPos(worldY) + TILE_SIZE / 2;

        drawEffectAtPixelCoords(scene, pixelX, pixelY + 35, EFFECT_ARMOR_BREAK_BASE, drawOptions);
        drawEffect(scene, worldX, worldY, EFFECT_ARMOR_BREAK_TORRENT, drawOptions);
    }
}
