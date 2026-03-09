import type { Scene } from 'phaser';
import { Effect } from '../game/effects/Effect';
import { getEffectByKey } from '../constants/Effects';
import type { EffectConfig } from '../constants/Effects';
import { convertWorldPosToPixelPos } from './CoordinateUtils';
import type { SoundManager } from './SoundManager';
import { TILE_SIZE } from '../game/assets/HBMap';

/**
 * Builds the texture key for an effect config.
 * Format: sprite-{sprite}-{spriteSheetIndex}
 */
export function getTextureKeyFromEffectConfig(config: EffectConfig): string {
    return `sprite-${config.sprite}-${config.spriteSheetIndex}`;
}

/**
 * Ensures an effect animation exists and returns its key.
 * Creates the animation if it does not exist.
 */
export function ensureEffectAnimation(
    scene: Scene,
    textureKey: string,
    options: {
        frameRate: number;
        repeat?: number;
        startFrame?: number;
        endFrame?: number;
        animKey?: string;
    }
): string {
    const { frameRate, repeat = 0, animKey } = options;
    try {
        if (!scene.textures.exists(textureKey)) {
            throw new Error(`Texture "${textureKey}" does not exist`);
        }

        const texture = scene.textures.get(textureKey);

        // Find the actual maximum frame index that exists in the texture
        // Frames are stored as string keys, so we need to parse them and find the max
        let maxFrameIndex = -1;
        if (texture) {
            const frameKeys = Object.keys(texture.frames);
            for (const key of frameKeys) {
                const frameNum = parseInt(key, 10);
                if (!isNaN(frameNum) && frameNum > maxFrameIndex) {
                    maxFrameIndex = frameNum;
                }
            }
        }

        const startFrame = options.startFrame ?? 0;
        const endFrame = options.endFrame ?? Math.max(0, maxFrameIndex);

        const key = animKey ?? `${textureKey}-range-${startFrame}-${endFrame}-repeat-${repeat}-fr${frameRate}`;
        if (!scene.anims.exists(key)) {
            const frames = scene.anims.generateFrameNumbers(textureKey, { start: startFrame, end: endFrame });
            const validFrames = frames.filter((f) => f != null);
            if (validFrames.length === 0) {
                throw new Error(
                    `No valid frames for animation (texture: ${textureKey}, range: ${startFrame}-${endFrame})`
                );
            }
            scene.anims.create({
                key,
                frames: validFrames,
                frameRate,
                repeat,
            });
        }
        return key;
    } catch (error) {
        console.warn('[EffectUtils] ensureEffectAnimation failed:', { error, textureKey, options });
        throw error;
    }
}

export type DrawEffectOptions = {
    /** Sound manager for optional effect sound */
    soundManager?: SoundManager;
    /** Player world X for spatial audio (listener position) */
    playerWorldX?: number;
    /** Player world Y for spatial audio (listener position) */
    playerWorldY?: number;
    /** When true, animation loops infinitely and effect is not destroyed on completion */
    infiniteLoop?: boolean;
    /** Called when effect is destroyed (e.g. animation complete) */
    onDestroy?: () => void;
    /** Frame rate for the effect animation (frames per second) */
    frameRate?: number;
    /** Optional frame index at which to start the animation. Clamped to bounds if specified. */
    startAnimationFrame?: number;
    /** Override depth offset (added to worldY * DEPTH_MULTIPLIER). Use higher values to draw on top of player. */
    depthOffset?: number;
    /** When true, use playerWorldY for depth instead of effect position. Requires playerWorldY. Used for effects that float above the player. */
    usePlayerDepthForDepth?: boolean;
};

/**
 * Draws an effect at the given pixel coordinates.
 * Looks up the effect config by key and creates the Effect instance.
 *
 * @param scene - The Phaser scene
 * @param pixelX - X coordinate in pixels
 * @param pixelY - Y coordinate in pixels
 * @param effectKey - Effect key from Effects.ts (e.g. EFFECT_RESURRECTION)
 * @param options - Optional sound manager, player position for spatial audio, and onDestroy callback
 * @returns The created Effect instance, or undefined if effect config not found
 */
export function drawEffectAtPixelCoords(
    scene: Scene,
    pixelX: number,
    pixelY: number,
    effectKey: string,
    options?: DrawEffectOptions
): Effect | undefined {
    const config = getEffectByKey(effectKey);
    if (!config) {
        console.warn(`[EffectUtils] Effect config not found: ${effectKey}`);
        return undefined;
    }

    const effect = new Effect(scene, {
        config,
        pixelX,
        pixelY,
        soundManager: options?.soundManager,
        playerWorldX: options?.playerWorldX,
        playerWorldY: options?.playerWorldY,
        infiniteLoop: options?.infiniteLoop,
        onDestroy: options?.onDestroy,
        frameRate: options?.frameRate,
        startAnimationFrame: options?.startAnimationFrame,
        depthOffset: options?.depthOffset,
        usePlayerDepthForDepth: options?.usePlayerDepthForDepth,
    });

    return effect;
}

/**
 * Draws an effect at the given world coordinates (cell center).
 * Looks up the effect config by key and creates the Effect instance.
 *
 * @param scene - The Phaser scene
 * @param worldX - World X coordinate (grid cell)
 * @param worldY - World Y coordinate (grid cell)
 * @param effectKey - Effect key from Effects.ts (e.g. EFFECT_RESURRECTION)
 * @param options - Optional sound manager, player position for spatial audio, and onDestroy callback
 * @returns The created Effect instance, or undefined if effect config not found
 */
export function drawEffect(
    scene: Scene,
    worldX: number,
    worldY: number,
    effectKey: string,
    options?: DrawEffectOptions
): Effect | undefined {
    // Center effect in cell (convertWorldPosToPixelPos gives top-left corner)
    const pixelX = convertWorldPosToPixelPos(worldX) + TILE_SIZE / 2;
    const pixelY = convertWorldPosToPixelPos(worldY) + TILE_SIZE / 2;
    return drawEffectAtPixelCoords(scene, pixelX, pixelY, effectKey, options);
}
