import type { Scene, Game } from 'phaser';
import { getPivotData } from './RegistryUtils';
import { DEPTH_MULTIPLIER, VERSION_NUMBER } from '../Config';
import { convertPixelPosToWorldPos } from './CoordinateUtils';
import { getItemPackSpriteSheets, getItemPackEmittedTintKeys } from './RegistryUtils';

const LIGHT_RADIUS_OVERLAY_TEXTURE_KEY = 'sprite-effect-0';
const LIGHT_RADIUS_OVERLAY_FRAME_INDEX = 1;

/**
 * Creates a light-radius overlay sprite (effect sheet 0 frame 1) rendered behind the main object.
 * Returns undefined if the texture does not exist.
 */
export function createLightRadiusOverlay(
    scene: Scene,
    pixelX: number,
    pixelY: number
): Phaser.GameObjects.Sprite | undefined {
    if (!scene.textures.exists(LIGHT_RADIUS_OVERLAY_TEXTURE_KEY)) {
        return undefined;
    }
    const overlay = scene.add.sprite(
        pixelX,
        pixelY,
        LIGHT_RADIUS_OVERLAY_TEXTURE_KEY,
        LIGHT_RADIUS_OVERLAY_FRAME_INDEX
    );
    overlay.setOrigin(0.5, 0.5);
    const worldY = convertPixelPosToWorldPos(pixelY);
    overlay.setDepth(worldY * DEPTH_MULTIPLIER - 10);
    return overlay;
}

/**
 * Gets the height of a sprite frame from pivot data in the registry.
 * Uses the first frame of the first sprite sheet when spriteSheetIndex and frameIndex are not specified.
 *
 * @param scene - The Phaser scene with access to the registry
 * @param spriteName - The sprite name without extension (e.g., 'ettin', 'slm')
 * @param spriteSheetIndex - The sprite sheet index (default: 0)
 * @param frameIndex - The frame index within the sprite sheet (default: 0)
 * @returns The frame height in pixels, or undefined if pivot data is not found
 */
export function getSpriteFrameHeight(
    scene: Scene,
    spriteName: string,
    spriteSheetIndex = 0,
    frameIndex = 0
): number | undefined {
    const pivotData = getPivotData(scene, '', spriteName, false);
    if (!pivotData?.spriteSheetPivots[spriteSheetIndex]?.[frameIndex]) {
        return undefined;
    }
    return pivotData.spriteSheetPivots[spriteSheetIndex][frameIndex].height;
}

/**
 * Checks if a sprite index represents a tree sprite.
 * Tree sprites have indices in the range 100-145.
 * 
 * @param spriteIndex - The sprite index to check
 * @returns true if the sprite index is a tree sprite, false otherwise
 */
export function isTreeSpriteIndex(spriteIndex: number): boolean {
    return spriteIndex >= 100 && spriteIndex <= 145;
}

/**
 * Draws the application title "Helbreath" with subtitle "Explorer"
 * and a black stripe background for better readability.
 * 
 * @param scene - The Phaser scene to draw the title on
 */
export function drawAppTitle(scene: Scene): void {
    const width = scene.scale.width;
    const height = scene.scale.height;

    // Add title "Helbreath" at top half middle
    const titleY = height / 4; // Top half middle
    const subtitleY = titleY + 60; // Below the title (increased spacing for larger fonts)
    
    // Calculate stripe with uniform padding top and bottom
    const titleFontSize = 56; // Increased from 48px
    const subtitleFontSize = 28; // Increased from 24px
    const padding = 30; // Uniform padding above title and below subtitle
    
    // Calculate stripe bounds: from top of title (accounting for font size) minus padding
    // to bottom of subtitle (accounting for font size) plus padding
    const titleTop = titleY - titleFontSize / 2;
    const subtitleBottom = subtitleY + subtitleFontSize / 2;
    const stripeTop = titleTop - padding;
    const stripeBottom = subtitleBottom + padding;
    const stripeHeight = stripeBottom - stripeTop;
    const stripeY = (stripeTop + stripeBottom) / 2;
    
    // Add horizontal black stripe behind title and subtitle for better readability
    const stripe = scene.add.rectangle(width / 2, stripeY, width, stripeHeight, 0x000000);
    stripe.setAlpha(0.5); // 50% opacity
    stripe.setDepth(9); // Behind the text (text is at depth 10)
    
    const titleText = scene.add.text(width / 2, titleY, 'Helbreath', {
        fontFamily: 'Georgia, serif',
        fontSize: `${titleFontSize}px`,
        color: '#d4af37', // Theme's golden color
        fontStyle: 'bold',
    });
    titleText.setOrigin(0.5, 0.5);
    titleText.setShadow(2, 2, '#1a0f0a', 3, true);
    titleText.setDepth(10);
    // Set letter spacing using Phaser's method
    if (titleText.setLetterSpacing) {
        titleText.setLetterSpacing(2);
    }

    // Add subtitle "Explorer" below title
    const subtitleText = scene.add.text(width / 2, subtitleY, 'Explorer', {
        fontFamily: 'Georgia, serif',
        fontSize: `${subtitleFontSize}px`,
        color: '#d4af37', // Theme's golden color
        fontStyle: 'normal',
    });
    subtitleText.setOrigin(0.5, 0.5);
    subtitleText.setShadow(1, 1, '#1a0f0a', 2, true);
    subtitleText.setDepth(10);
    // Set letter spacing using Phaser's method
    if (subtitleText.setLetterSpacing) {
        subtitleText.setLetterSpacing(2);
    }
}

/**
 * Draws the version number at the bottom left corner of the scene.
 * White text, 16px, 75% opacity (25% transparent).
 *
 * @param scene - The Phaser scene to draw the version on
 */
export function drawVersionNumber(scene: Scene): void {
    const height = scene.scale.height;

    const versionText = scene.add.text(12, height - 12, `v ${VERSION_NUMBER}`, {
        fontFamily: 'Georgia, serif',
        fontSize: '16px',
        color: '#ffffff',
    });
    versionText.setOrigin(0, 1);
    versionText.setAlpha(0.75);
    versionText.setDepth(10);
}

/**
 * Emits tinted sprite frame for item-pack on demand when items with TINT_INVENTORY are created.
 * Tracks emitted keys to avoid duplicates. Call when adding item with TINT_INVENTORY in effectOverrides.
 *
 * @param game - The Phaser game instance
 * @param sheetIndex - Sprite sheet index
 * @param spriteIndex - Frame index within the sheet
 * @param effectColor - Hex color for tint (e.g. 0x000000)
 */
export function emitTintedInventorySpriteIfNeeded(game: Game, sheetIndex: number, spriteIndex: number, effectColor: number): void {
    const spriteSheets = getItemPackSpriteSheets(game);
    if (!spriteSheets?.length) {
        return;
    }

    const effectColorHex = effectColor.toString(16).padStart(6, '0');
    const tintKey = `sprite-item-pack-${sheetIndex}-${spriteIndex}-${effectColorHex}`;

    const emitted = getItemPackEmittedTintKeys(game);
    if (emitted?.has(tintKey)) {
        return;
    }

    const sheet = spriteSheets[sheetIndex];
    if (!sheet) {
        return;
    }

    if (sheet.emitTintedFrameForSprite(spriteIndex, effectColor)) {
        emitted?.add(tintKey);
    }
}
