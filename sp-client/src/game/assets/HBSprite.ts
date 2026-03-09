import type { Scene } from 'phaser';
import { EventBus } from '../EventBus';
import type { PivotFrame, PivotData } from '../../Types';
import { OUT_SPRITE_FRAME_EXTRACTED } from '../../constants/EventNames';
import { getBinaryBuffer, setPivotDataByTextureKey, setPivotDataBySpriteName } from '../../utils/RegistryUtils';
import { ITEMS, getItemSheetIndex, getItemSpriteIndex, getTintInventoryEffectColor } from '../../constants/Items';
import { Gender } from '../../Types';

/**
 * Enum representing different sprite types based on various items types in Helbreath.
 */
export enum SpriteType {
    Human = 'Human',
    Tiles = 'Tiles',
    Monster = 'Monster',
    EquipmentPack = 'EquipmentPack',
    HairAndUndies = 'HairAndUndies',
    Bows = 'Bows',
    Weapons = 'Weapons',
    Shields = 'Shields',
    Effect = 'Effect',
    Interface = 'Interface',
    ItemPack = 'ItemPack',
    ItemGround = 'ItemGround',
}

/**
 * Frame metadata parsed from sprite file binary data.
 * Contains position, dimensions, and pivot point information.
 */
type SpriteFrameMetadata = {
    left: number;
    top: number;
    width: number;
    height: number;
    pivotX: number;
    pivotY: number;
};

/**
 * Sprite metadata item containing frame metadata and image length.
 * Used during sprite file parsing.
 */
type SpriteMetaItem = {
    frames: SpriteFrameMetadata[];
    imageLength: number;
};

/**
 * Represents a single frame within a sprite sheet.
 * Contains position, dimensions, pivot point, and texture information.
 */
export class HBSpriteFrame {
    /** The x coordinate of the frame within the sprite sheet */
    public readonly x: number;
    
    /** The y coordinate of the frame within the sprite sheet */
    public readonly y: number;
    
    /** The width of the frame in pixels */
    public readonly width: number;
    
    /** The height of the frame in pixels */
    public readonly height: number;
    
    /** The x coordinate of the pivot point relative to the frame's top-left corner */
    public readonly pivotX: number;
    
    /** The y coordinate of the pivot point relative to the frame's top-left corner */
    public readonly pivotY: number;
    
    /** The texture key used to identify the sprite sheet texture in Phaser */
    public readonly textureKey: string;
    
    /** The index of this frame within the sprite sheet */
    public readonly frameIndex: number;

    /**
     * Creates a new HBSpriteFrame instance.
     * 
     * @param x - The x coordinate of the frame within the sprite sheet
     * @param y - The y coordinate of the frame within the sprite sheet
     * @param width - The width of the frame in pixels
     * @param height - The height of the frame in pixels
     * @param pivotX - The x coordinate of the pivot point relative to the frame's top-left corner
     * @param pivotY - The y coordinate of the pivot point relative to the frame's top-left corner
     * @param textureKey - The texture key used to identify the sprite sheet texture in Phaser
     * @param frameIndex - The index of this frame within the sprite sheet
     */
    constructor(
        x: number,
        y: number,
        width: number,
        height: number,
        pivotX: number,
        pivotY: number,
        textureKey: string,
        frameIndex: number
    ) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.pivotX = pivotX;
        this.pivotY = pivotY;
        this.textureKey = textureKey;
        this.frameIndex = frameIndex;
    }
}

/**
 * Represents a sprite sheet containing multiple frames.
 * Handles texture creation, frame slicing, and optional frame extraction as data URLs.
 */
export class HBSpriteSheet {
    /** Array of frames contained in this sprite sheet */
    public readonly frames: HBSpriteFrame[];
    
    /** The texture key used to identify this sprite sheet in Phaser */
    public readonly textureKey: string;
    
    /** The name of the sprite (without index) */
    private readonly spriteName: string;
    
    /** The index of this sprite sheet within the sprite file */
    private readonly spriteSheetIndex: number;
    
    /** The canvas element used to create the texture (undefined after texture creation) */
    private canvas: HTMLCanvasElement | undefined = undefined;

    /**
     * Creates a new HBSpriteSheet instance.
     * Creates a Phaser texture from the sprite sheet image and slices it into frames.
     * 
     * @param scene - The Phaser scene to register the texture with
     * @param spriteName - The name of the sprite (without index)
     * @param spriteSheetIndex - The index of this sprite sheet within the sprite file
     * @param frames - Array of frame definitions for this sprite sheet
     * @param spriteSheetImage - The ImageBitmap containing the sprite sheet image
     * @param exportFramesAsDataUrls - Whether to extract all frames as data URLs (default: false)
     * @param customTextureKey - Optional custom texture key to use instead of default naming (default: undefined)
     */
    private readonly scene: Scene;

    constructor(
        scene: Scene,
        spriteName: string,
        spriteSheetIndex: number,
        frames: HBSpriteFrame[],
        spriteSheetImage: ImageBitmap,
        exportFramesAsDataUrls = false,
        customTextureKey?: string
    ) {
        this.scene = scene;
        this.frames = frames;
        this.spriteName = spriteName;
        this.spriteSheetIndex = spriteSheetIndex;
        
        // Build texture key: use custom key if provided, otherwise use {spriteName}-{spriteSheetIndex}
        this.textureKey = customTextureKey ?? `${spriteName}-${spriteSheetIndex}`;
        
        // Create texture from sprite sheet image
        this.createTexture(scene, spriteSheetImage, frames);
        
        // Extract all frames as data URLs if requested (stored in registry for UI)
        if (exportFramesAsDataUrls) {
            this.extractAllFramesAsDataUrls();
        }
    }

    /**
     * Creates a Phaser texture from the sprite sheet ImageBitmap and slices it into individual frames.
     * Uses NEAREST filtering for pixel-perfect rendering.
     * 
     * @param scene - The Phaser scene to register the texture with
     * @param spriteSheetImage - The ImageBitmap containing the sprite sheet image
     * @param frames - Array of frame definitions to slice from the texture
     */
    private createTexture(scene: Scene, spriteSheetImage: ImageBitmap, frames: HBSpriteFrame[]): void {
        // Check if texture already exists
        if (scene.textures.exists(this.textureKey)) {
            return;
        }

        // Create canvas for the texture using the original sprite sheet image
        this.canvas = document.createElement('canvas');
        this.canvas.width = spriteSheetImage.width;
        this.canvas.height = spriteSheetImage.height;
        const ctx = this.canvas.getContext('2d', { alpha: true });

        if (!ctx) {
            throw new Error('Failed to get canvas context for texture creation');
        }

        ctx.imageSmoothingEnabled = false;

        // Draw the entire sprite sheet onto the canvas
        ctx.drawImage(spriteSheetImage, 0, 0);

        // Add canvas as texture to Phaser
        scene.textures.addCanvas(this.textureKey, this.canvas);

        // Set texture filter to NEAREST for pixel-perfect rendering
        const texture = scene.textures.get(this.textureKey);
        if (texture.source && texture.source[0]) {
            const source = texture.source[0];
            source.scaleMode = 0; // Phaser.ScaleModes.NEAREST
        }

        // Add frames to the texture by slicing the sprite sheet
        frames.forEach((sprite, frameIndex) => {
            texture.add(String(frameIndex), 0, sprite.x, sprite.y, sprite.width, sprite.height);
        });
    }

    /**
     * Extracts all frames from the sprite sheet as data URLs and stores them in the registry.
     * Used to provide frame data to the React layer for UI purposes.
     * Triggers changedata-{key} events when registry is updated.
     */
    private extractAllFramesAsDataUrls(): void {
        if (!this.canvas) {
            throw Error('[SpriteSheet] Cannot extract frames: canvas not available');
            return;
        }

        const ctx = this.canvas.getContext('2d', { alpha: true });
        if (!ctx) {
            throw Error('[SpriteSheet] Cannot extract frames: canvas context not available');
        }

        // Extract each frame
        this.frames.forEach((frame) => {
            // Create a temporary canvas for this frame
            const frameCanvas = document.createElement('canvas');
            frameCanvas.width = frame.width;
            frameCanvas.height = frame.height;
            const frameCtx = frameCanvas.getContext('2d', { alpha: true });

            if (!frameCtx) {
                throw Error(`[SpriteSheet] Failed to get context for frame ${frame.frameIndex}`);
            }

            frameCtx.imageSmoothingEnabled = false;

            // Draw the frame from the sprite sheet canvas
            frameCtx.drawImage(
                this.canvas!,
                frame.x,
                frame.y,
                frame.width,
                frame.height,
                0,
                0,
                frame.width,
                frame.height
            );

            // Convert to data URL
            const dataUrl = frameCanvas.toDataURL('image/png');

            // Signal React layer via EventBus
            const key = `${this.spriteName}-${this.spriteSheetIndex}-${frame.frameIndex}`;
            EventBus.emit(OUT_SPRITE_FRAME_EXTRACTED, key, dataUrl);

            // For item-pack: generate tinted sprites for items with TINT_INVENTORY effect
            if (this.spriteName === 'sprite-item-pack') {
                this.emitTintedFramesForItemPack(frame, frameCanvas);
            }
        });
    }

    /**
     * Emits tinted data URLs for item-pack frames used by items with TINT_INVENTORY effect.
     * Key format: sprite-item-pack-{sheetIndex}-{spriteIndex}-{effectColorHex}
     */
    private emitTintedFramesForItemPack(frame: HBSpriteFrame, frameCanvas: HTMLCanvasElement): void {
        const sheetIndex = this.spriteSheetIndex;
        const spriteIndex = frame.frameIndex;
        const emittedColors = new Set<number>();

        for (const item of ITEMS) {
            const effectColor = getTintInventoryEffectColor(item);
            if (effectColor === undefined || emittedColors.has(effectColor)) continue;

            const maleSheet = getItemSheetIndex(item, Gender.MALE);
            const maleSprite = getItemSpriteIndex(item, Gender.MALE);
            const femaleSheet = getItemSheetIndex(item, Gender.FEMALE);
            const femaleSprite = getItemSpriteIndex(item, Gender.FEMALE);
            const usesThisFrame =
                (maleSheet === sheetIndex && maleSprite === spriteIndex) ||
                (femaleSheet === sheetIndex && femaleSprite === spriteIndex);
            if (!usesThisFrame) continue;

            emittedColors.add(effectColor);
            this.emitTintedFrameForSprite(spriteIndex, effectColor, frameCanvas);
        }
    }

    /**
     * Emits a tinted frame for the given sprite index and effect color.
     * Used during load (via emitTintedFramesForItemPack) and on demand when items with
     * TINT_INVENTORY are created via ItemDialog with custom colors.
     * Key format: sprite-item-pack-{sheetIndex}-{spriteIndex}-{effectColorHex}
     * @param frameCanvas - Optional; when provided, uses it instead of extracting from canvas (avoids re-extraction during load)
     * @returns true if emitted, false if frame not found or canvas unavailable
     */
    public emitTintedFrameForSprite(spriteIndex: number, effectColor: number, frameCanvas?: HTMLCanvasElement): boolean {
        const frame = this.frames.find((f) => f.frameIndex === spriteIndex);
        if (!frame) return false;

        let sourceCanvas: HTMLCanvasElement;
        if (frameCanvas) {
            sourceCanvas = frameCanvas;
        } else {
            if (!this.canvas) return false;
            const extracted = document.createElement('canvas');
            extracted.width = frame.width;
            extracted.height = frame.height;
            const ctx = extracted.getContext('2d', { alpha: true });
            if (!ctx) return false;
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(this.canvas, frame.x, frame.y, frame.width, frame.height, 0, 0, frame.width, frame.height);
            sourceCanvas = extracted;
        }

        const tintCanvas = document.createElement('canvas');
        tintCanvas.width = frame.width;
        tintCanvas.height = frame.height;
        const tintCtx = tintCanvas.getContext('2d', { alpha: true });
        if (!tintCtx) return false;

        tintCtx.imageSmoothingEnabled = false;
        tintCtx.drawImage(sourceCanvas, 0, 0);

        const tr = ((effectColor >> 16) & 0xff) / 255;
        const tg = ((effectColor >> 8) & 0xff) / 255;
        const tb = (effectColor & 0xff) / 255;
        const imageData = tintCtx.getImageData(0, 0, frame.width, frame.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.floor(data[i] * tr);
            data[i + 1] = Math.floor(data[i + 1] * tg);
            data[i + 2] = Math.floor(data[i + 2] * tb);
        }
        tintCtx.putImageData(imageData, 0, 0);

        const tintDataUrl = tintCanvas.toDataURL('image/png');
        const effectColorHex = effectColor.toString(16).padStart(6, '0');
        const tintKey = `${this.spriteName}-${this.spriteSheetIndex}-${spriteIndex}-${effectColorHex}`;
        EventBus.emit(OUT_SPRITE_FRAME_EXTRACTED, tintKey, tintDataUrl);
        return true;
    }
}

/**
 * Animation class that creates and registers Phaser animations from Sprite instances.
 * This implementation is for working with Helbreath's sprite format.
 */
export class HBAnimation {
    /** The unique key used to identify this animation in Phaser's AnimationManager */
    public readonly animationKey: string;
    
    /** The cache key of the sprite file this animation belongs to */
    public readonly spriteCacheKey: string;
    
    /** The index of the sprite sheet within the sprite file */
    public readonly spriteSheetIndex: number;

    /**
     * Creates a new HBAnimation instance and registers it with Phaser's AnimationManager.
     * 
     * @param scene - The Phaser scene that contains the AnimationManager
     * @param spriteCacheKey - The cache key of the sprite file
     * @param spriteSheetIndex - The index of the sprite sheet within the sprite file
     * @param sprites - Array of sprite frames to use for the animation
     * @param frameRate - The frame rate for the animation (default: 10)
     * @param repeat - Number of times to repeat the animation (-1 for infinite, default: -1)
     */
    constructor(
        scene: Scene,
        spriteCacheKey: string,
        spriteSheetIndex: number,
        sprites: HBSpriteFrame[],
        frameRate = 10,
        repeat = -1,
    ) {
        this.spriteCacheKey = spriteCacheKey;
        this.spriteSheetIndex = spriteSheetIndex;

        const spriteName = spriteCacheKey.toLowerCase();

        this.animationKey = `${spriteName}-${spriteSheetIndex}`;

        // Register animation if it doesn't exist
        if (!scene.anims.exists(this.animationKey)) {
            this.registerAnimation(scene, sprites, frameRate, repeat);
        }
    }

    /**
     * Registers the animation with Phaser's AnimationManager.
     * Converts sprite frames into Phaser animation frames with custom pivot data.
     * 
     * @param scene - The Phaser scene containing the AnimationManager
     * @param sprites - Array of sprite frames to convert to animation frames
     * @param frameRate - The frame rate for the animation
     * @param repeat - Number of times to repeat the animation (-1 for infinite)
     */
    private registerAnimation(
        scene: Scene,
        sprites: HBSpriteFrame[],
        frameRate: number,
        repeat: number
    ): void {
        const frames = sprites.map((sprite) => ({
            key: sprite.textureKey,
            frame: String(sprite.frameIndex), // Use frame index from sprite sheet
            customData: {
                pivotX: sprite.pivotX,
                pivotY: sprite.pivotY,
                width: sprite.width,
                height: sprite.height
            }
        }));

        scene.anims.create({
            key: this.animationKey,
            frames: frames,
            frameRate: frameRate,
            repeat: repeat
        });
    }
}

/** Size of the header in bytes (sprite count) */
const HEADER_SIZE = 2;

/**
 * Reads a 16-bit signed integer from a DataView in little-endian format.
 * 
 * @param view - The DataView to read from
 * @param offset - The byte offset to read from
 * @returns The 16-bit signed integer value
 */
const readInt16 = (view: DataView, offset: number) => view.getInt16(offset, true);

/**
 * Reads a 32-bit signed integer from a DataView in little-endian format.
 * 
 * @param view - The DataView to read from
 * @param offset - The byte offset to read from
 * @returns The 32-bit signed integer value
 */
const readInt32 = (view: DataView, offset: number) => view.getInt32(offset, true);

/**
 * Represents a Helbreath sprite file containing one or more sprite sheets.
 * Handles loading, parsing, and registering sprite sheets and animations with Phaser.
 */
export class HBSpriteFile {
    /** The name of the sprite file */
    public readonly fileName: string;
    
    /** The type of sprite (determines if animations should be created) */
    public readonly spriteType: SpriteType;
    
    /** Whether to export individual frames as data URLs for React layer */
    public readonly exportFramesAsDataUrls: boolean;
    
    /** Starting index for tile sprites (used for map tile texture naming) */
    public readonly tileStartIndex?: number;
    
    /** Array of sprite sheets loaded from this file */
    public spriteSheets: HBSpriteSheet[];
    
    /** Array of animations created from the sprite sheets (empty for Tiles and Interface types) */
    public animations: HBAnimation[];

    /**
     * Creates a new HBSpriteFile instance.
     * 
     * @param fileName - The name of the sprite file (must exist in Phaser's binary cache)
     * @param spriteType - The type of sprite (affects whether animations are created)
     * @param exportFramesAsDataUrls - Whether to export individual frames as data URLs (default: false)
     * @param tileStartIndex - Starting index for tile sprites (for map tile texture naming, default: undefined)
     */
    constructor(fileName: string, spriteType: SpriteType, exportFramesAsDataUrls = false, tileStartIndex?: number) {
        this.fileName = fileName;
        this.spriteType = spriteType;
        this.exportFramesAsDataUrls = exportFramesAsDataUrls;
        this.tileStartIndex = tileStartIndex;
    }

    /**
     * Loads the sprite file from Phaser's binary cache, parses it, and creates sprite sheets and animations.
     * This method:
     * 1. Loads the binary data from cache
     * 2. Parses the Helbreath sprite format
     * 3. Creates sprite sheets with textures
     * 4. Registers pivot data in Phaser's registry
     * 5. Creates animations (if sprite type supports them)
     * 
     * @param scene - The Phaser scene with access to the binary cache
     * @throws Error if the sprite buffer is not found in cache
     */
    public async load(scene: Scene): Promise<void> {
        // Load binary from cache using fileName
        const buffer = getBinaryBuffer(scene, this.fileName);
        
        if (!buffer) {
            throw new Error(`Missing sprite buffer in cache for ${this.fileName}`);
        }
        
        // Extract sprite name from file name
        const spriteName = this.fileName.toLowerCase();
        
        // Parse sprite file - this now returns SpriteFrame instances directly
        const parsedSprites = this.parseSprite(buffer, spriteName, this.tileStartIndex);
        
        // Process each sprite sheet
        const spriteSheets: HBSpriteSheet[] = [];
        
        for (let spriteSheetIndex = 0; spriteSheetIndex < parsedSprites.length; spriteSheetIndex++) {
            const parsedSprite = parsedSprites[spriteSheetIndex];
            
            // Convert sprite sheet image data to ImageBitmap
            const spriteSheetImage = await this.createImageFromPng(parsedSprite.imageData);
            
            try {
                // Frames are already SpriteFrame instances from parseSprite
                const frames = parsedSprite.frames;
                
                // Determine texture naming
                // For tiles with a start index, use map-tile-{index} naming
                // Otherwise use the default {spriteName}-{spriteSheetIndex} naming
                const useCustomNaming = this.spriteType === SpriteType.Tiles && this.tileStartIndex !== undefined;
                const customTextureKey = useCustomNaming ? `map-tile-${this.tileStartIndex + spriteSheetIndex}` : undefined;
                
                // Create SpriteSheet with all frames and sprite sheet image
                // This will create the texture and slice it into frames
                const spriteSheet = new HBSpriteSheet(
                    scene, 
                    spriteName, 
                    spriteSheetIndex, 
                    frames, 
                    spriteSheetImage, 
                    this.exportFramesAsDataUrls,
                    customTextureKey
                );
                spriteSheets.push(spriteSheet);
            } finally {
                // Clean up sprite sheet image
                spriteSheetImage.close();
            }
        }
        
        // Populate spriteSheets
        this.spriteSheets = spriteSheets;

        // Build pivot data structure and register it globally
        const spriteSheetPivots: PivotFrame[][] = [];
        for (let spriteSheetIndex = 0; spriteSheetIndex < spriteSheets.length; spriteSheetIndex++) {
            const spriteSheet = spriteSheets[spriteSheetIndex];
            const framePivots = spriteSheet.frames.map((frame) => ({
                pivotX: frame.pivotX,
                pivotY: frame.pivotY,
                width: frame.width,
                height: frame.height
            }));
            spriteSheetPivots.push(framePivots);
            
            // For tiles, also register pivots using the textureKey for tile-based lookup
            // This allows GameAsset to look up pivots using the textureKey (e.g., map-tile-123)
            if (this.spriteType === SpriteType.Tiles) {
                const textureKey = spriteSheet.textureKey;
                const texturePivotData: PivotData = { 
                    spriteSheetPivots: [framePivots] // Single sprite sheet for this texture
                };
                setPivotDataByTextureKey(scene, textureKey, texturePivotData);
            }
        }
        
        // Register pivot data in Phaser registry (for backward compatibility)
        const pivotData: PivotData = { spriteSheetPivots };
        setPivotDataBySpriteName(scene, spriteName, pivotData);

        // Create Animation instances if sprite type is not Tiles or Interface
        if (this.spriteType !== SpriteType.Tiles && this.spriteType !== SpriteType.Interface) {
            const animations: HBAnimation[] = [];
            
            for (let spriteSheetIndex = 0; spriteSheetIndex < spriteSheets.length; spriteSheetIndex++) {
                const spriteSheet = spriteSheets[spriteSheetIndex];
                
                // Create Animation instance for this sprite sheet using HBAnimation class
                // This will register the animation with Phaser's AnimationManager
                const animation = new HBAnimation(
                    scene,
                    this.fileName,
                    spriteSheetIndex,
                    spriteSheet.frames,
                    10, // frameRate
                    -1  // repeat
                );
                
                animations.push(animation);
            }
            
            // Populate animations
            this.animations = animations;
        } else {
            this.animations = [];
        }

        // Remove sprite file from cache to free up memory (no longer needed after parsing)
        scene.cache.binary.remove(this.fileName);

        console.log(`Sprite loaded: ${this.fileName}`, this);
    }

    /**
     * Creates an ImageBitmap from PNG image data.
     * 
     * @param data - The PNG image data as a Uint8Array
     * @returns A Promise that resolves to an ImageBitmap
     * @throws Error if the PNG data cannot be decoded
     */
    private async createImageFromPng(data: Uint8Array): Promise<ImageBitmap> {
        const buffer = data.byteOffset === 0 && data.byteLength === data.buffer.byteLength
            ? data.buffer
            : data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
        const arrayBuffer = buffer instanceof ArrayBuffer ? buffer : new Uint8Array(data).buffer;
        const blob = new Blob([arrayBuffer], { type: 'image/png' });
        
        try {
            return await createImageBitmap(blob);
        } catch (error) {
            throw new Error(`Failed to decode sprite PNG: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Parses a Helbreath sprite file from binary data.
     * The format consists of:
     * - Header: sprite count (2 bytes)
     * - For each sprite: frame count, image length, dimensions, and frame metadata
     * - PNG image data for each sprite sheet
     * 
     * @param buffer - The binary data of the sprite file
     * @param spriteName - The name of the sprite (used for texture keys)
     * @param tileStartIndex - Optional starting index for tile texture naming
     * @returns Array of objects containing sprite frames and PNG image data for each sprite sheet
     */
    private parseSprite(buffer: ArrayBuffer, spriteName: string, tileStartIndex?: number): Array<{ frames: HBSpriteFrame[]; imageData: Uint8Array }> {
        const view = new DataView(buffer);
        let offset = 0;
    
        const spriteCount = readInt16(view, offset);
        offset += HEADER_SIZE;
    
        const meta: SpriteMetaItem[] = [];
    
        for (let i = 0; i < spriteCount; i += 1)
        {
            const frameCount = readInt16(view, offset);
            offset += 2;
    
            const imageLength = readInt32(view, offset);
            offset += 4;
    
            offset += 4; // width (unused in parser)
            offset += 4; // height (unused in parser)
            offset += 1; // startLocation placeholder byte
    
            const frames: SpriteFrameMetadata[] = [];
    
            for (let f = 0; f < frameCount; f += 1)
            {
                const left = readInt16(view, offset);
                offset += 2;
                const top = readInt16(view, offset);
                offset += 2;
                const width = readInt16(view, offset);
                offset += 2;
                const height = readInt16(view, offset);
                offset += 2;
                const pivotX = readInt16(view, offset);
                offset += 2;
                const pivotY = readInt16(view, offset);
                offset += 2;
    
                frames.push({ left, top, width, height, pivotX, pivotY });
            }
    
            meta.push({ frames, imageLength });
        }
    
        const sprites: Array<{ frames: HBSpriteFrame[]; imageData: Uint8Array }> = [];
    
        for (let i = 0; i < meta.length; i += 1)
        {
            offset += 4; // startLocation, not needed for sequential read
            const { imageLength, frames } = meta[i];
            
            const imageBuffer = buffer.slice(offset, offset + imageLength);
            offset += imageLength;
    
            // Create Uint8Array view - slice already returns a new ArrayBuffer, so this is safe
            const imageData = new Uint8Array(imageBuffer);
    
            // Build texture key for this sprite sheet
            // For tiles with a start index, use map-tile-{index} naming
            // Otherwise use the default {spriteName}-{i} naming
            const textureKey = tileStartIndex !== undefined 
                ? `map-tile-${tileStartIndex + i}` 
                : `${spriteName}-${i}`;
            
            // Build SpriteFrame instances directly
            const spriteFrames = frames.map((frame, frameIndex) => {
                return new HBSpriteFrame(
                    frame.left,
                    frame.top,
                    frame.width,
                    frame.height,
                    frame.pivotX,
                    frame.pivotY,
                    textureKey,
                    frameIndex
                );
            });
    
            sprites.push({
                frames: spriteFrames,
                imageData
            });
        }
    
        return sprites;
    };
}