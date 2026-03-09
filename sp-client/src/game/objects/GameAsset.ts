import type { GameObjects, Scene } from 'phaser';
import { ShadowManager } from '../../utils/ShadowManager';
import { canvasToScreenPosition, convertPixelPosToWorldPos } from '../../utils/CoordinateUtils';
import { EventBus } from '../EventBus';
import type { PivotFrame } from '../../Types';
import { HIGH_DEPTH, SPRITES_WITH_SHADOWS } from '../../Config';
import { getPivotData, isDebugModeEnabled } from '../../utils/RegistryUtils';
import { isTreeSpriteIndex } from '../../utils/SpriteUtils';
import { IN_DEBUG_MODE_CHANGE, OUT_UI_HOVER_SPRITE_FRAME_DEBUG } from '../../constants/EventNames';
import { ItemEffect, type Effect } from '../../constants/Items';

/**
 * Animation type enumeration for different animation behaviors.
 */
export enum AnimationType {
    /** Plays full range of sprites in sprite sheet (default behavior) */
    FullFrame = 'FullFrame',
    /** Plays directional sub-frames (used for player equipment) */
    DirectionalSubFrame = 'DirectionalSubFrame',
    /** Plays sub-frames with custom start index (used for Fire Wyvern) */
    SubFrame = 'SubFrame',
}

/**
 * Configuration object for creating a GameAsset instance.
 */
export type GameAssetConfig = {
    /** The x coordinate where the sprite should be positioned (in pixel coordinates) */
    x: number;

    /** The y coordinate where the sprite should be positioned (in pixel coordinates) */
    y: number;

    /** The name of the sprite file (without extension) */
    spriteName: string;

    /** 
     * The index of the sprite sheet within the sprite file.
     * Optional when mapObject is true, required otherwise.
     */
    spriteSheetIndex?: number;

    /** 
     * Whether this is a map object using legacy index-based texture lookup.
     * When true, texture key will be just the spriteName without spriteSheetIndex.
     */
    mapObject?: boolean;

    /** 
     * The direction index (0-7) for directional sprites.
     * Equipment, except weapons and shields, have all 8 directions included in the sprite sheet.
     * We'll need to extract the correct frame range from the sprite sheet for given direction.
     */
    direction?: number;

    /** Number of frames per direction (default: 8) */
    framesPerDirection?: number;

    /** Specific frame index to display (if not provided, animation will play) */
    frameIndex?: number;

    /** Alpha transparency value (0-1) */
    alpha?: number;

    /** Tint color value (hex color) */
    tint?: number;

    /** Frame rate for animation playback (default: 10) */
    frameRate?: number;

    /** Animation type (default: FullFrame) */
    animationType?: AnimationType;

    /** Starting frame index for SubFrame animations (default: 0) */
    animationFrameStartIndex?: number;

    /** Whether the animation should loop (default: true) */
    isLooping?: boolean;

    /** Optional callback invoked when the animation reaches a new frame (relative frame index 0-7 within direction) */
    onAnimationFrameChange?: (relativeFrameIndex: number) => void;

    /** Item effects for equipped visuals (e.g. glare on Dark Knight Templar Sword). */
    effects?: Effect[];
};

/**
 * Represents a single frame or animation that can be drawn on the scene.
 * Designed for Helbreath's sprite format with support for pivot points, directional animations,
 * and debug visualization.
 */
export class GameAsset {
    /** The Phaser sprite object that renders the asset */
    public readonly sprite: GameObjects.Sprite;

    /** The Phaser scene this asset belongs to */
    public scene: Scene;

    /** The base x coordinate before pivot offset is applied */
    private baseX: number;

    /** The base y coordinate before pivot offset is applied */
    private baseY: number;

    /** Array of pivot data for each frame in the sprite sheet */
    private spriteSheetPivots: PivotFrame[] | undefined;

    /** The starting frame index for the current direction (if directional) */
    private directionStartFrame?: number;

    /** The ending frame index for the current direction (if directional) */
    private directionEndFrame?: number;

    /** Whether the current animation should loop (true for looping, false for non-looping) */
    private isAnimationLooping: boolean = true;

    /** Animation type controlling frame playback behavior */
    private animationType: AnimationType = AnimationType.FullFrame;

    /** Starting frame index for SubFrame animations */
    private animationFrameStartIndex: number = 0;

    /** Re-entrancy guard to prevent infinite recursion when setCurrentFrame triggers ANIMATION_UPDATE */
    private _isHandlingFrameLimit: boolean = false;

    /** Graphics object used for debug visualization */
    private debugGraphics: GameObjects.Graphics;

    /** Whether this asset is non-animated (has a fixed frameIndex) */
    private isNonAnimated = false;

    /** The frame index for non-animated sprites */
    private fixedFrameIndex?: number;

    /** The sprite name (without extension) */
    private spriteName: string;

    /** The sprite sheet index within the sprite file */
    private spriteSheetIndex?: number;

    /** Shadow manager for rendering shadow beneath the asset (when enabled) */
    private shadowManager: ShadowManager | undefined = undefined;

    /** Tree shadow GameAsset for trees (sprite index 100-145) */
    private treeShadowAsset: GameAsset | undefined = undefined;

    /** Whether the cursor is currently hovering over this sprite */
    private isHovering = false;

    /** Handler function for pointerover event - stored so we can deregister it */
    private pointerOverHandler?: () => void;

    /** Handler function for pointerout event - stored so we can deregister it */
    private pointerOutHandler?: () => void;

    /** Handler function for pointermove event - stored so we can deregister it */
    private pointerMoveHandler?: () => void;

    /** Arrow function reference for debug mode change handler */
    private debugModeChangeHandler = (_parent: any, value: boolean) => {
        this.onDebugModeChange(_parent, value);
    };

    /** Callback from config, invoked when animation reaches a new frame (not invoked during construction) */
    private onAnimationFrameChangeCallback?: (relativeFrameIndex: number) => void;

    /** Guards callback invocation until construction completes (avoids accessing parent's this before super() returns) */
    private _constructionComplete = false;

    /** Previous frame index for detecting frame changes */
    private previousFrameIndex: number = -1;

    /** Overlay sprite for blue glare effect (additive blue with oscillating transparency). */
    private glareOverlay: GameObjects.Sprite | undefined;

    /** Overlay sprite for berserk red tint effect (constant transparency, rendered underneath other effects). */
    private berserkOverlay: GameObjects.Sprite | undefined;

    /** Shared progress (0–1) for glare/glow oscillation. Both effects peak when value = 1. */
    private effectOscillationProgress = { value: 0 };

    /** Single tween driving both glare and glow in sync. */
    private effectOscillationTween: Phaser.Tweens.Tween | undefined;

    /** Phaser FX Glow effect (oscillating outer strength). */
    private glowEffect: Phaser.FX.Glow | undefined;

    /** Current effects (stored for effect cleanup). */
    private currentEffects: Effect[] = [];

    /** Ghost sprite for trail effect during movement (semi-transparent copy behind main sprite). */
    private ghostSprite: GameObjects.Sprite | undefined;

    /** Current glare effect colour (hex, e.g. 0x0000ff). Used when GLARE is in currentEffects. */
    private currentEffectColor: number = 0x0000ff;

    /**
     * Creates a minimal AnimationFrame-like object for non-animated sprites.
     * This is used to provide debug information for static frames.
     * Cast is necessary because we only populate the fields needed by updateDebug.
     */
    private createMockFrame(frameIndex: number): Phaser.Animations.AnimationFrame {
        return {
            index: frameIndex,
            textureFrame: frameIndex,
            frame: { name: String(frameIndex) } as Phaser.Textures.Frame
        } as Phaser.Animations.AnimationFrame;
    }

    /**
     * Creates a new GameAsset instance.
     * Sets up the sprite, loads pivot data, configures animations, and initializes debug tools.
     * 
     * @param scene - The Phaser scene to add the asset to
     * @param config - Configuration object specifying position, sprite, and animation settings
     */
    constructor(scene: Scene, config: GameAssetConfig) {
        this.scene = scene;
        this.baseX = config.x;
        this.baseY = config.y;
        this.spriteName = config.spriteName;
        this.spriteSheetIndex = config.spriteSheetIndex;

        // Validate spriteSheetIndex requirement
        if (!config.mapObject && config.spriteSheetIndex === undefined) {
            throw new Error('spriteSheetIndex is required when mapObject is not true');
        }

        // Build texture key based on whether this is a map object
        let textureKey: string;
        let animationKey: string;

        if (config.mapObject) {
            // Legacy index-based lookup for map objects
            textureKey = config.spriteName;
            animationKey = config.spriteName;
        } else {
            // Standard sprite-sheet based lookup
            textureKey = `sprite-${config.spriteName}-${config.spriteSheetIndex}`;
            animationKey = config.direction !== undefined
                ? `sprite-${config.spriteName}-${config.spriteSheetIndex}`
                : `sprite-${config.spriteName}-${config.spriteSheetIndex}`;
        }

        // Check if texture exists
        if (!scene.textures.exists(textureKey)) {
            throw new Error(`Texture "${textureKey}" does not exist`);
        }

        // Check if frame index exists in texture (if frameIndex is specified)
        if (config.frameIndex !== undefined) {
            const texture = scene.textures.get(textureKey);
            if (!texture.has(String(config.frameIndex))) {
                throw new Error(`Frame index ${config.frameIndex} does not exist in texture "${textureKey}"`);
            }
        }

        // Initialize animation type and looping behavior
        this.animationType = config.animationType ?? AnimationType.FullFrame;
        this.animationFrameStartIndex = config.animationFrameStartIndex ?? 0;
        this.isAnimationLooping = config.isLooping ?? true;

        // Calculate directional frame range if direction is specified
        if (config.direction !== undefined) {
            const framesPerDirection = config.framesPerDirection ?? 8;
            this.directionStartFrame = config.direction * framesPerDirection;
            this.directionEndFrame = this.directionStartFrame + framesPerDirection - 1;
        }

        // Store callback from config (not invoked during construction to avoid parent accessing this before super() returns)
        this.onAnimationFrameChangeCallback = config.onAnimationFrameChange;

        // Retrieve pivot data from global registry
        const pivotData = getPivotData(scene, textureKey, config.spriteName, config.mapObject ?? false);

        if (config.mapObject) {
            // For map objects, the pivot data is stored as a single sprite sheet (index 0)
            if (pivotData && pivotData.spriteSheetPivots[0]) {
                this.spriteSheetPivots = pivotData.spriteSheetPivots[0];
            }
        } else {
            // For regular sprites, use the sprite sheet index
            if (pivotData && config.spriteSheetIndex !== undefined && pivotData.spriteSheetPivots[config.spriteSheetIndex]) {
                this.spriteSheetPivots = pivotData.spriteSheetPivots[config.spriteSheetIndex];
            }
        }

        // Check if this is a tree (sprite index 100-145) and create tree shadow before rendering tree
        this.applyShadowIfTree(config);

        // Create sprite at given coordinates
        if (config.frameIndex !== undefined) {
            this.sprite = scene.add.sprite(config.x, config.y, textureKey, config.frameIndex);
            this.applyPivotOffset(config.frameIndex);
            this.isNonAnimated = true;
            this.fixedFrameIndex = config.frameIndex;
        } else {
            this.sprite = scene.add.sprite(config.x, config.y, textureKey);
        }

        this.sprite.setOrigin(0, 0); // Set anchor point to top-left

        if (config.alpha !== undefined) {
            this.sprite.setAlpha(config.alpha ?? 1);
        }

        if (config.tint !== undefined) {
            this.sprite.setTint(config.tint);
        }

        this.applyItemEffects(config.effects);

        // Always create debug graphics, but control visibility based on global setting and hover state
        // Use very high depth (50000) to ensure debug info always renders on top of other sprites
        this.debugGraphics = scene.add.graphics().setDepth(HIGH_DEPTH);

        // Pointer event listeners for hover detection will be registered only when debug mode is enabled
        // See enableHoverDetection() and disableHoverDetection() methods

        // Set initial visibility based on global debug setting and hover state
        this.updateDebugVisibility();

        // Set up animation event listeners for pivot correction and frame limiting
        this.sprite.on(Phaser.Animations.Events.ANIMATION_START, (_anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
            this.applyFramePivotOffset(frame);
            this.updateDebug(frame);
            this.emitAnimationFrameChange(frame);
        });
        this.sprite.on(Phaser.Animations.Events.ANIMATION_UPDATE, (_anim: Phaser.Animations.Animation, frame: Phaser.Animations.AnimationFrame) => {
            this.applyFramePivotOffset(frame);
            this.handleDirectionalFrameLimit(frame);
            this.updateDebug(frame);
            this.emitAnimationFrameChange(frame);
        });

        // Check initial debug mode state and enable/disable interactivity accordingly
        if (isDebugModeEnabled(scene)) {
            this.enableHoverDetection();
        }

        // Listen for global debug mode changes
        scene.registry.events.on(IN_DEBUG_MODE_CHANGE, this.debugModeChangeHandler);

        // Play animation if it exists
        if (config.frameIndex === undefined) {
            if (scene.anims.exists(animationKey)) {
                // Constructor animations are typically looping (no repeat specified means default/infinite)
                this.isAnimationLooping = true;
                this.sprite.play({
                    key: animationKey,
                    startFrame: this.directionStartFrame ?? 0,
                    frameRate: config.frameRate ?? 10
                });
            } else {
                console.warn(`Animation key "${animationKey}" does not exist. Sprite created but not animating.`);
            }
        }

        // Create shadow for sprites that have shadows enabled
        this.drawShadowIfNecessary(config);

        this._constructionComplete = true;
    }

    /**
     * Applies item effects visuals (e.g. blue glare on Dark Knight Templar Sword).
     */
    private applyItemEffects(effects?: Effect[]): void {
        this.setItemEffects(effects);
    }

    /**
     * Sets or clears item effects (e.g. glare, glow, tint appearance). Call when equipped item changes.
     * Additive overlay with oscillating alpha (overlay sprite + ADD blend + tint + alpha tween).
     */
    public setItemEffects(effects?: Effect[]): void {
        this.currentEffects = effects ?? [];
        this.stopEffectOscillationTween();
        const glareEffect = this.currentEffects.find((e) => e.effect === ItemEffect.GLARE);
        this.currentEffectColor = glareEffect?.effectColor ?? 0x0000ff;
        this.destroyGlareOverlay();
        if (!glareEffect) {
            // Continue to handle other effects even when no glare
        } else {
            this.createGlareOverlay();
        }
        this.destroyGlowEffect();
        const glowEffectConfig = this.currentEffects.find((e) => e.effect === ItemEffect.GLOW);
        if (glowEffectConfig) {
            this.createGlowEffect(glowEffectConfig.effectColor ?? 0xffffff);
        }
        this.applyTintFromEffects();
    }

    /**
     * Applies tint from item effects (TINT_APPEARANCE) or clears tint.
     * Used when restoring tint after chilled effect is removed.
     */
    private applyTintFromEffects(): void {
        const tintAppearanceEffect = this.currentEffects.find((e) => e.effect === ItemEffect.TINT_APPEARANCE);
        if (tintAppearanceEffect) {
            const color = tintAppearanceEffect.effectColor ?? 0xffffff;
            this.sprite.setTint(color);
        } else {
            this.sprite.clearTint();
        }
    }

    /**
     * Sets or clears berserk red overlay. Uses same technique as glare (transparent overlay sprite)
     * but with constant alpha and red tint. Rendered underneath other effects (chilled, glare).
     */
    public setBerserkOverlay(enabled: boolean): void {
        if (enabled && !this.berserkOverlay) {
            this.createBerserkOverlay();
        } else if (!enabled && this.berserkOverlay) {
            this.destroyBerserkOverlay();
        }
        if (this.berserkOverlay) {
            this.berserkOverlay.setVisible(enabled && this.sprite.visible);
        }
    }

    /**
     * Sets or clears chilled blue tint. Applied after other effects so it blends with existing visuals.
     * When chilled is removed, restores tint from item effects (e.g. TINT_APPEARANCE).
     */
    public setChilledTint(chilled: boolean): void {
        if (chilled) {
            this.sprite.setTint(0x88aaff);
        } else {
            this.applyTintFromEffects();
        }
    }

    /** Creates the glare overlay (additive tint with oscillating transparency). */
    private createGlareOverlay(): void {
        const hasGlare = this.currentEffects.some((e) => e.effect === ItemEffect.GLARE);
        const textureKey = this.sprite.texture?.key;
        if (!hasGlare || !textureKey) {
            return;
        }

        const frame = this.sprite.anims?.currentFrame ?? this.sprite.frame;
        const frameName = this.getFrameName(frame);
        const texture = this.scene.textures.get(textureKey);
        const safeFrame = texture.has(frameName) ? frameName : '0';

        this.glareOverlay = this.scene.add.sprite(this.sprite.x, this.sprite.y, textureKey, safeFrame);
        this.glareOverlay.setOrigin(0, 0);
        this.glareOverlay.setBlendMode(Phaser.BlendModes.ADD);
        this.glareOverlay.setTint(this.currentEffectColor);
        this.glareOverlay.setAlpha(0.4);
        this.glareOverlay.setDepth(this.sprite.depth + 1);
        this.glareOverlay.setVisible(this.sprite.visible);
        this.scene.children.bringToTop(this.glareOverlay);

        this.startEffectOscillationTween();

        this.sprite.on(Phaser.Animations.Events.ANIMATION_UPDATE, this.syncGlareOverlayFrame);
        this.sprite.on(Phaser.Animations.Events.ANIMATION_START, this.syncGlareOverlayFrame);
    }

    /** Syncs glare overlay frame and texture with main sprite. */
    private syncGlareOverlayFrame = (): void => {
        if (!this.glareOverlay) return;
        const mainTextureKey = this.sprite.texture?.key;
        if (mainTextureKey && this.glareOverlay.texture?.key !== mainTextureKey) {
            this.destroyGlareOverlay();
            this.createGlareOverlay();
            return;
        }
        const frame = this.sprite.anims?.currentFrame ?? this.sprite.frame;
        const frameName = this.getFrameName(frame);
        if (this.glareOverlay.frame?.name !== frameName) {
            this.glareOverlay.setFrame(frameName);
        }
    };

    /** Gets frame name from animation frame or sprite frame. */
    private getFrameName(frame: Phaser.Animations.AnimationFrame | Phaser.Textures.Frame | undefined): string {
        if (!frame) return this.fixedFrameIndex !== undefined ? String(this.fixedFrameIndex) : '0';
        const f = frame as { textureFrame?: number; frame?: { name?: string }; index?: number; name?: string };
        const name = f.textureFrame ?? f.frame?.name ?? f.index ?? f.name;
        return name !== undefined ? String(name) : (this.fixedFrameIndex !== undefined ? String(this.fixedFrameIndex) : '0');
    }

    /** Destroys glare overlay. */
    private destroyGlareOverlay(): void {
        this.sprite.off(Phaser.Animations.Events.ANIMATION_UPDATE, this.syncGlareOverlayFrame);
        this.sprite.off(Phaser.Animations.Events.ANIMATION_START, this.syncGlareOverlayFrame);
        this.glareOverlay?.destroy();
        this.glareOverlay = undefined;
    }

    /** Creates the berserk overlay (red tint with constant transparency). Rendered underneath glare. */
    private createBerserkOverlay(): void {
        const textureKey = this.sprite.texture?.key;
        if (!textureKey) return;
        const frame = this.sprite.anims?.currentFrame ?? this.sprite.frame;
        const frameName = this.getFrameName(frame);
        const texture = this.scene.textures.get(textureKey);
        const safeFrame = texture.has(frameName) ? frameName : '0';

        this.berserkOverlay = this.scene.add.sprite(this.sprite.x, this.sprite.y, textureKey, safeFrame);
        this.berserkOverlay.setOrigin(0, 0);
        this.berserkOverlay.setBlendMode(Phaser.BlendModes.ADD);
        this.berserkOverlay.setTint(0xff4444);
        this.berserkOverlay.setAlpha(0.5 * this.sprite.alpha);
        this.berserkOverlay.setDepth(this.sprite.depth + 1);
        this.berserkOverlay.setVisible(this.sprite.visible);
        this.scene.children.bringToTop(this.berserkOverlay);

        this.sprite.on(Phaser.Animations.Events.ANIMATION_UPDATE, this.syncBerserkOverlayFrame);
        this.sprite.on(Phaser.Animations.Events.ANIMATION_START, this.syncBerserkOverlayFrame);
    }

    /** Syncs berserk overlay frame and texture with main sprite. */
    private syncBerserkOverlayFrame = (): void => {
        if (!this.berserkOverlay) return;
        const mainTextureKey = this.sprite.texture?.key;
        if (mainTextureKey && this.berserkOverlay.texture?.key !== mainTextureKey) {
            this.destroyBerserkOverlay();
            this.createBerserkOverlay();
            return;
        }
        const frame = this.sprite.anims?.currentFrame ?? this.sprite.frame;
        const frameName = this.getFrameName(frame);
        if (this.berserkOverlay.frame?.name !== frameName) {
            this.berserkOverlay.setFrame(frameName);
        }
    };

    /** Destroys berserk overlay. */
    private destroyBerserkOverlay(): void {
        this.sprite.off(Phaser.Animations.Events.ANIMATION_UPDATE, this.syncBerserkOverlayFrame);
        this.sprite.off(Phaser.Animations.Events.ANIMATION_START, this.syncBerserkOverlayFrame);
        this.berserkOverlay?.destroy();
        this.berserkOverlay = undefined;
    }

    /** Creates the glow FX effect. Outer strength is driven by shared oscillation tween. */
    private createGlowEffect(color: number): void {
        const hasGlow = this.currentEffects.some((e) => e.effect === ItemEffect.GLOW);
        if (!hasGlow) return;
        this.sprite.preFX?.setPadding(16);
        this.glowEffect = this.sprite.preFX?.addGlow(color, 0.5, 0, false);
        if (!this.glowEffect) return;
        this.startEffectOscillationTween();
    }

    /** Destroys glow FX effect. */
    private destroyGlowEffect(): void {
        if (this.glowEffect && this.sprite.preFX) {
            this.sprite.preFX.remove(this.glowEffect);
            this.sprite.preFX.setPadding(0);
        }
        this.glowEffect = undefined;
    }

    /** Starts the shared oscillation tween (glare + glow in sync). Idempotent if already running. */
    private startEffectOscillationTween(): void {
        const hasGlare = this.glareOverlay != null;
        const hasGlow = this.glowEffect != null;
        if ((!hasGlare && !hasGlow) || this.effectOscillationTween?.isPlaying()) return;
        this.effectOscillationProgress.value = 0;
        this.applyEffectOscillationProgress();
        this.effectOscillationTween?.stop();
        this.effectOscillationTween = this.scene.tweens.add({
            targets: this.effectOscillationProgress,
            value: 1,
            duration: 1200,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            onUpdate: () => this.applyEffectOscillationProgress(),
        });
    }

    /** Stops the shared oscillation tween. */
    private stopEffectOscillationTween(): void {
        this.effectOscillationTween?.stop();
        this.effectOscillationTween = undefined;
    }

    /** Applies shared progress to glare alpha and glow outerStrength. Both peak when progress = 1. */
    private applyEffectOscillationProgress(): void {
        const p = this.effectOscillationProgress.value;
        if (this.glareOverlay) {
            this.glareOverlay.setAlpha(0.4 + p * 0.6);
        }
        if (this.glowEffect) {
            this.glowEffect.outerStrength = 0.5 + p * 4.5;
        }
    }

    /**
     * Checks if this is a tree (sprite index 100-145) and creates a tree shadow if applicable.
     * 
     * @param config - The configuration object used to create this GameAsset
     */
    private applyShadowIfTree(config: GameAssetConfig): void {
        if (!config.mapObject) {
            return;
        }

        // Extract sprite index from spriteName (e.g., "map-tile-100" -> 100)
        const spriteIndexMatch = config.spriteName.match(/^map-tile-(\d+)$/);
        if (!spriteIndexMatch) {
            return;
        }

        const spriteIndex = parseInt(spriteIndexMatch[1], 10);

        // If sprite index is between 100 and 145, it's a tree - render tree shadow
        if (!isTreeSpriteIndex(spriteIndex)) {
            return;
        }

        const shadowSpriteIndex = spriteIndex + 50; // Shadow sprite index = tree sprite index + 50
        const shadowX = config.x + 16; // Offset shadow position
        const shadowY = config.y + 16;

        try {
            // Create tree shadow GameAsset before the tree
            this.treeShadowAsset = new GameAsset(this.scene, {
                x: shadowX,
                y: shadowY,
                spriteName: `map-tile-${shadowSpriteIndex}`,
                mapObject: true,
                frameIndex: config.frameIndex, // Use same frame as tree
                alpha: 0.5 // Set transparency to match player shadows (50% opacity)
            });

            // Set shadow depth to render below the tree (will be updated when tree depth is set)
            // We'll update this in setDepth() method
        } catch (error) {
            console.warn(`Failed to create tree shadow for tree sprite ${spriteIndex}:`, error);
            this.treeShadowAsset = undefined;
        }
    }

    /**
     * Creates shadow for sprites that have shadows enabled.
     * 
     * @param config - The configuration object used to create this GameAsset
     */
    private drawShadowIfNecessary(config: GameAssetConfig): void {
        // Create shadow for sprites that have shadows enabled
        if (SPRITES_WITH_SHADOWS.includes(this.spriteName)) {
            // Map objects should have static shadows (no animation, no frame rate)
            const isMapObject = config.mapObject ?? false;

            this.shadowManager = new ShadowManager({
                scene: this.scene,
                shadowSpriteName: this.spriteName,
                shadowSpriteSheetIndex: config.mapObject ? 0 : (config.spriteSheetIndex ?? 0),
                worldX: convertPixelPosToWorldPos(config.x),
                worldY: convertPixelPosToWorldPos(config.y),
                // Don't set frameRate for map objects - they should be static
                frameRate: isMapObject ? undefined : (config.frameRate ?? 10),
                mapObject: isMapObject,
                // Use the same frameIndex as the GameAsset for map objects (if specified)
                frameIndex: isMapObject ? config.frameIndex : undefined,
            });

            // Update shadow position and depth initially
            this.updateShadowPosition();
            this.updateShadowDepth();
        }
    }

    /**
     * Enables hover detection by making the sprite interactive and registering event listeners.
     * This allows pointer events to be captured for debug visualization.
     * Only called when debug mode is enabled.
     */
    private enableHoverDetection(): void {
        try {
            // Always make sprite interactive when enabling hover detection
            // Even if sprite.input exists, it might be disabled from previous disableInteractive() call
            if (!this.sprite.input || !this.sprite.input.enabled) {
                // Make sprite interactive to receive pointer events for hover detection
                // Configure to allow pointer events to pass through to the scene so movement commands still work
                // By not listening to pointerdown/pointerup, we ensure those events reach the scene
                this.sprite.setInteractive({
                    useHandCursor: false,
                    pixelPerfect: false
                });
            }

            // Register event listeners only if they haven't been registered yet
            if (!this.pointerOverHandler) {
                this.pointerOverHandler = () => {
                    this.isHovering = true;
                    this.updateDebugVisibility();
                    // Immediately update debug text when hovering starts
                    if (isDebugModeEnabled(this.scene)) {
                        if (this.isNonAnimated && this.fixedFrameIndex !== undefined) {
                            this.updateDebug(this.createMockFrame(this.fixedFrameIndex));
                        } else if (this.sprite.anims && this.sprite.anims.currentFrame) {
                            this.updateDebug(this.sprite.anims.currentFrame);
                        }
                    }
                };

                this.pointerOutHandler = () => {
                    this.isHovering = false;
                    this.updateDebugVisibility();
                };

                this.pointerMoveHandler = () => {
                    // Continuously update debug info as mouse moves while hovering
                    if (this.isHovering) {
                        if (isDebugModeEnabled(this.scene)) {
                            if (this.isNonAnimated && this.fixedFrameIndex !== undefined) {
                                this.updateDebug(this.createMockFrame(this.fixedFrameIndex));
                            } else if (this.sprite.anims && this.sprite.anims.currentFrame) {
                                this.updateDebug(this.sprite.anims.currentFrame);
                            }
                        }
                    }
                };

                this.sprite.on('pointerover', this.pointerOverHandler);
                this.sprite.on('pointerout', this.pointerOutHandler);
                this.sprite.on('pointermove', this.pointerMoveHandler);
            }
        } catch (error) {
            console.error(`Error enabling hover detection for GameAsset: ${error}`);
        }
    }

    /**
     * Disables hover detection by removing interactivity from the sprite and de-registering event listeners.
     * This prevents pointer events from being captured, allowing movement commands to work unimpeded.
     * Called when debug mode is disabled.
     */
    private disableHoverDetection(): void {
        // Deregister event listeners if they were registered
        if (this.pointerOverHandler) {
            this.sprite.off('pointerover', this.pointerOverHandler);
            this.pointerOverHandler = undefined;
        }

        if (this.pointerOutHandler) {
            this.sprite.off('pointerout', this.pointerOutHandler);
            this.pointerOutHandler = undefined;
        }

        if (this.pointerMoveHandler) {
            this.sprite.off('pointermove', this.pointerMoveHandler);
            this.pointerMoveHandler = undefined;
        }

        if (this.sprite.input) {
            this.sprite.disableInteractive();
            // Reset hover state when disabling
            this.isHovering = false;
            this.updateDebugVisibility();
        }
    }

    /**
     * Handles debug mode changes from the global registry.
     * Enables or disables hover detection and updates debug visibility accordingly.
     * 
     * @param _parent - The registry object that triggered the change (unused)
     * @param value - The new debug mode state (true = enabled, false = disabled)
     */
    private onDebugModeChange(_parent: any, value: boolean): void {
        // Enable or disable hover detection based on debug mode
        if (value) {
            this.enableHoverDetection();
        } else {
            this.disableHoverDetection();
        }

        this.updateDebugVisibility();
        // For non-animated sprites, update debug info when debug mode is toggled on and hovering
        if (value && this.isHovering && this.isNonAnimated && this.fixedFrameIndex !== undefined) {
            this.updateDebug(this.createMockFrame(this.fixedFrameIndex));
        } else if (value && this.isHovering && this.sprite.anims && this.sprite.anims.currentFrame) {
            this.updateDebug(this.sprite.anims.currentFrame);
        }
    }

    /**
     * Applies pivot offset to sprite position based on the current animation frame.
     * Extracts the frame index from the animation frame and calls applyPivotOffset.
     * 
     * @param frame - The current animation frame from Phaser's animation system
     */
    private applyFramePivotOffset(frame: Phaser.Animations.AnimationFrame): void {
        // Get frame index from frame
        const frameName = frame.textureFrame ?? frame.frame?.name ?? frame.index;
        const frameIndex = typeof frameName === 'number' ? frameName : parseInt(frameName, 10);

        this.applyPivotOffset(frameIndex);
    }

    /**
     * Applies pivot offset to sprite position based on the frame index.
     * Looks up pivot data for the frame and adjusts sprite position accordingly.
     * Only applies offset if pivot data exists and frame dimensions are non-zero.
     * 
     * @param frameIndex - The index of the frame to get pivot data for
     */
    private applyPivotOffset(frameIndex: number): void {
        if (!this.spriteSheetPivots) {
            return;
        }

        // Look up pivot data by frame index
        const pivotData = this.spriteSheetPivots[frameIndex];
        if (!pivotData) {
            return;
        }

        const pivotX = (pivotData.width !== 0 && pivotData.height !== 0) ? pivotData.pivotX : 0;
        const pivotY = (pivotData.width !== 0 && pivotData.height !== 0) ? pivotData.pivotY : 0;

        // Apply pivot offset: add pivot to base position
        this.sprite.setPosition(this.baseX + pivotX, this.baseY + pivotY);

        if (this.berserkOverlay) {
            this.berserkOverlay.setPosition(this.sprite.x, this.sprite.y);
        }
        if (this.glareOverlay) {
            this.glareOverlay.setPosition(this.sprite.x, this.sprite.y);
        }

        // Update shadow position if shadow is enabled
        this.updateShadowPosition();
    }

    /**
     * Handles directional frame limiting by wrapping back to the start frame when out of range.
     * This ensures that directional animations loop within their designated frame range.
     * Behavior depends on animation type:
     * - DirectionalSubFrame: Always applies frame limiting for looping within direction range
     * - SubFrame: Handles frame limiting with custom start index and frame count
     * - FullFrame: Only applies frame limiting for looping animations
     * 
     * @param frame - The current animation frame from Phaser's animation system
     */
    private handleDirectionalFrameLimit(frame: Phaser.Animations.AnimationFrame): void {
        // Re-entrancy guard: setCurrentFrame triggers ANIMATION_UPDATE, which would re-enter here
        if (this._isHandlingFrameLimit) {
            return;
        }

        // Get current frame index
        const frameName = frame.textureFrame ?? frame.frame?.name ?? frame.index;
        const frameIndex = typeof frameName === 'number' ? frameName : parseInt(frameName, 10);

        // Handle DirectionalSubFrame animation type (player equipment)
        if (this.animationType === AnimationType.DirectionalSubFrame) {
            if (this.directionStartFrame === undefined || this.directionEndFrame === undefined) {
                return;
            }

            if (frameIndex < this.directionStartFrame || frameIndex > this.directionEndFrame) {
                const currentAnim = this.sprite.anims.currentAnim;
                if (currentAnim && currentAnim.frames) {
                    const pastEnd = frameIndex > this.directionEndFrame;
                    const targetFrameIndex = (!this.isAnimationLooping && pastEnd)
                        ? this.directionEndFrame
                        : this.directionStartFrame;
                    const targetFrame = currentAnim.frames.find((f: any) => {
                        const fIndex = typeof f.textureFrame === 'number' ? f.textureFrame :
                            (f.frame?.name ? parseInt(f.frame.name, 10) : f.index);
                        return fIndex === targetFrameIndex;
                    });

                    if (targetFrame) {
                        this._isHandlingFrameLimit = true;
                        try {
                            this.sprite.anims.setCurrentFrame(targetFrame);
                            if (!this.isAnimationLooping && pastEnd) {
                                this.sprite.anims.stop();
                            }
                        } finally {
                            this._isHandlingFrameLimit = false;
                        }
                    }
                }
            }
            return;
        }

        // Handle SubFrame animation type (Fire Wyvern)
        if (this.animationType === AnimationType.SubFrame) {
            if (this.directionStartFrame === undefined || this.directionEndFrame === undefined) {
                return;
            }

            // Calculate the actual frame range with the start index offset
            // For Fire Wyvern attack: directionStartFrame=0, directionEndFrame=4 (5 frames: 0-4)
            // We want to offset this to frames 4-8, so:
            // actualStartFrame = 0 + 4 = 4
            // actualEndFrame = 4 + 4 = 8 (keeping the same number of frames)
            const actualStartFrame = this.directionStartFrame + this.animationFrameStartIndex;
            const actualEndFrame = this.directionEndFrame + this.animationFrameStartIndex;

            // If frame is outside the valid range
            if (frameIndex < actualStartFrame || frameIndex > actualEndFrame) {
                if (!this.isAnimationLooping) {
                    return;
                }
                // For looping animations, wrap back to start
                const currentAnim = this.sprite.anims.currentAnim;
                const targetFrame = currentAnim?.frames?.find((f: Phaser.Animations.AnimationFrame) => f.index === actualStartFrame)
                    ?? currentAnim?.frames?.[actualStartFrame];
                if (targetFrame?.frame) {
                    this._isHandlingFrameLimit = true;
                    try {
                        this.sprite.anims.setCurrentFrame(targetFrame);
                    } finally {
                        this._isHandlingFrameLimit = false;
                    }
                }
            }
            return;
        }

        // Handle FullFrame animation type (default behavior)
        // Only apply frame limiting for looping animations
        if (!this.isAnimationLooping) {
            return;
        }

        if (this.directionStartFrame === undefined || this.directionEndFrame === undefined) {
            return;
        }

        // If frame is outside the valid range (either below start or above end), wrap back to start
        // This handles the case where animation loops from frame 63 back to frame 0
        if (frameIndex < this.directionStartFrame || frameIndex > this.directionEndFrame) {
            const currentAnim = this.sprite.anims.currentAnim;
            if (currentAnim && currentAnim.frames) {
                // Find the frame object with the matching frame index
                const targetFrame = currentAnim.frames.find((f: any) => {
                    const fIndex = typeof f.textureFrame === 'number' ? f.textureFrame :
                        (f.frame?.name ? parseInt(f.frame.name, 10) : f.index);
                    return fIndex === this.directionStartFrame;
                });

                if (targetFrame) {
                    this._isHandlingFrameLimit = true;
                    try {
                        this.sprite.anims.setCurrentFrame(targetFrame);
                    } finally {
                        this._isHandlingFrameLimit = false;
                    }
                }
            }
        }
    }

    /**
     * Updates the visibility of debug graphics based on debug mode and hover state.
     * Graphics (frame, anchor, pivot points) are always shown when debug mode is enabled.
     * Text is handled by React layer.
     */
    private updateDebugVisibility(): void {
        const debugEnabled = isDebugModeEnabled(this.scene);
        // Graphics are always visible when debug mode is enabled
        this.debugGraphics.setVisible(debugEnabled);

        // If debug mode is enabled, update debug graphics (and text if hovering)
        if (debugEnabled) {
            if (this.isNonAnimated && this.fixedFrameIndex !== undefined) {
                this.updateDebug(this.createMockFrame(this.fixedFrameIndex));
            } else if (this.sprite.anims && this.sprite.anims.currentFrame) {
                this.updateDebug(this.sprite.anims.currentFrame);
            }
        } else {
            // Clear debug info from React when debug mode is disabled or not hovering
            EventBus.emit(OUT_UI_HOVER_SPRITE_FRAME_DEBUG, undefined);
        }

        // Clear debug info when not hovering
        if (!this.isHovering) {
            EventBus.emit(OUT_UI_HOVER_SPRITE_FRAME_DEBUG, undefined);
        }
    }

    /**
     * Updates debug graphics and text with current frame information.
     * Draws:
     * - Green rectangle around the frame bounds
     * - Red crosshair at sprite position
     * - Blue crosshair at pivot point (if available)
     * - Emits event with debug info to React layer (only when hovering)
     * 
     * @param frame - The current animation frame from Phaser's animation system
     */
    private updateDebug(frame: Phaser.Animations.AnimationFrame): void {
        // Skip if debug mode is not enabled
        if (!isDebugModeEnabled(this.scene)) {
            return;
        }

        // Get frame index from frame
        const frameName = frame.textureFrame ?? frame.frame?.name ?? frame.index;
        const frameIndex = typeof frameName === 'number' ? frameName : parseInt(frameName, 10);

        // Look up pivot data by frame index
        const pivotData = this.spriteSheetPivots?.[frameIndex];
        const hasPivotData = !!pivotData && pivotData.width !== 0 && pivotData.height !== 0;

        const frameWidth = this.sprite.frame?.width ?? this.sprite.displayWidth;
        const frameHeight = this.sprite.frame?.height ?? this.sprite.displayHeight;

        const topLeftX = this.sprite.x - (this.sprite.originX * frameWidth);
        const topLeftY = this.sprite.y - (this.sprite.originY * frameHeight);
        const pivotX = hasPivotData ? pivotData!.pivotX : 0;
        const pivotY = hasPivotData ? pivotData!.pivotY : 0;
        const pivotWorldX = hasPivotData ? (topLeftX + pivotX) : this.sprite.x;
        const pivotWorldY = hasPivotData ? (topLeftY + pivotY) : this.sprite.y;

        this.debugGraphics.clear();

        // Draw filled green rectangle at 75% opacity when hovering
        if (this.isHovering) {
            this.debugGraphics.fillStyle(0x00ff00, 0.25);
            this.debugGraphics.fillRect(topLeftX, topLeftY, frameWidth, frameHeight);
        }

        // Draw green stroke rectangle around frame bounds
        this.debugGraphics.lineStyle(1, 0x00ff00, 1);
        this.debugGraphics.strokeRect(topLeftX, topLeftY, frameWidth, frameHeight);
        this.debugGraphics.lineStyle(1, 0xff0000, 1);
        this.debugGraphics.lineBetween(this.sprite.x - 6, this.sprite.y, this.sprite.x + 6, this.sprite.y);
        this.debugGraphics.lineBetween(this.sprite.x, this.sprite.y - 6, this.sprite.x, this.sprite.y + 6);
        this.debugGraphics.lineStyle(1, 0x00aaff, 1);
        this.debugGraphics.lineBetween(pivotWorldX - 4, pivotWorldY, pivotWorldX + 4, pivotWorldY);
        this.debugGraphics.lineBetween(pivotWorldX, pivotWorldY - 4, pivotWorldX, pivotWorldY + 4);

        // Emit debug info to React layer when hovering
        if (this.isHovering) {
            const pointer = this.scene.input.activePointer;
            const { screenX, screenY } = canvasToScreenPosition(pointer.x, pointer.y, this.scene.game);

            // Convert scene position to world coordinates
            const worldX = convertPixelPosToWorldPos(this.sprite.x);
            const worldY = convertPixelPosToWorldPos(this.sprite.y);

            EventBus.emit(OUT_UI_HOVER_SPRITE_FRAME_DEBUG, {
                frame: frameIndex,
                pivotX,
                pivotY,
                hasPivot: hasPivotData,
                posX: this.sprite.x,
                posY: this.sprite.y,
                worldX,
                worldY,
                topLeftX,
                topLeftY,
                spriteName: this.spriteName,
                spriteSheetIndex: this.spriteSheetIndex,
                mouseX: screenX,
                mouseY: screenY,
                depth: this.sprite.depth,
            });
        }
    }

    /**
     * Called when the animation reaches a new frame.
     * Subclasses can override this to handle frame-specific logic (e.g., playing sounds at specific frames).
     * Default implementation does nothing.
     *
     * @param relativeFrameIndex - Frame index relative to the current direction (0-7 for 8-frame directions)
     */
    protected onAnimationFrameChange(_relativeFrameIndex: number): void {
        // Default implementation does nothing
        // Subclasses can override this to handle frame changes
    }

    /**
     * Detects frame changes and invokes the protected hook and config callback.
     */
    private emitAnimationFrameChange(frame: Phaser.Animations.AnimationFrame): void {
        const frameName = frame.textureFrame ?? frame.frame?.name ?? frame.index;
        const absoluteFrameIndex = typeof frameName === 'number' ? frameName : parseInt(frameName, 10);

        if (absoluteFrameIndex === this.previousFrameIndex) {
            return;
        }
        this.previousFrameIndex = absoluteFrameIndex;

        // For SubFrame animations, account for animationFrameStartIndex so relative frame
        // is 0-based within the animation sequence (handles specialized frames not starting from 0)
        const animationStartFrame = this.directionStartFrame !== undefined
            ? this.directionStartFrame + (this.animationType === AnimationType.SubFrame ? this.animationFrameStartIndex : 0)
            : 0;
        const relativeFrameIndex = this.directionStartFrame !== undefined
            ? absoluteFrameIndex - animationStartFrame
            : absoluteFrameIndex;

        this.onAnimationFrameChange(relativeFrameIndex);
        if (this._constructionComplete) {
            this.onAnimationFrameChangeCallback?.(relativeFrameIndex);
        }
    }

    /**
     * Called when a non-looping animation has finished playing.
     * Subclasses can override this to handle animation completion (e.g., for attack/death animations).
     * Default implementation does nothing.
     */
    protected animationFinished(): void {
        // Default implementation does nothing
        // Subclasses can override this to handle animation completion
    }

    /**
     * Gets the current relative frame position (0-7) within the current direction.
     * Returns undefined if no animation is playing or direction frame ranges are not set.
     * 
     * @returns The relative frame index (0-7) or undefined
     */
    public getCurrentRelativeFrame(): number | undefined {
        if (!this.sprite.anims?.isPlaying || this.directionStartFrame === undefined) {
            return undefined;
        }

        const currentFrame = this.sprite.anims.currentFrame;
        if (!currentFrame) {
            return undefined;
        }

        // Get current absolute frame index
        const frameName = currentFrame.textureFrame ?? currentFrame.frame?.name ?? currentFrame.index;
        const absoluteFrameIndex = typeof frameName === 'number' ? frameName : parseInt(frameName, 10);

        // For SubFrame, account for animationFrameStartIndex (handles specialized frames not starting from 0)
        const animationStartFrame = this.directionStartFrame + (this.animationType === AnimationType.SubFrame ? this.animationFrameStartIndex : 0);
        return absoluteFrameIndex - animationStartFrame;
    }

    /**
     * Plays a specific animation with a specific direction.
     * This is an atomic operation that updates direction frame ranges, pivot data, and plays the animation.
     * 
     * @param animationKey - The animation key to play (format: sprite-{name}-{index})
     * @param direction - The direction index (0-7)
     * @param frameRate - Optional frame rate for animation (default: 10)
     * @param relativeFrame - Optional relative frame position (0-7) to start from within the direction
     * @param repeat - Optional repeat count (0 = play once, undefined = loop)
     * @param framesPerDirection - Optional number of frames per direction (default: 8)
     * @param animationType - Optional animation type (default: current animation type)
     * @param animationFrameStartIndex - Optional starting frame index for SubFrame animations (default: 0)
     * @param isLooping - Optional looping behavior (default: true, or false if repeat is 0)
     */
    public playAnimationWithDirection(animationKey: string, direction: number, frameRate = 10, relativeFrame?: number, repeat?: number, framesPerDirection?: number, animationType?: AnimationType, animationFrameStartIndex?: number, isLooping?: boolean): void {
        if (!this.sprite || !this.sprite.anims) {
            return;
        }
        try {
            if (!this.scene.anims.exists(animationKey)) {
                console.warn(`Animation key "${animationKey}" does not exist`);
                return;
            }

            // Extract sprite name and sheet index from animation key
            // Format: sprite-{name}-{index}
            const match = animationKey.match(/^sprite-(.+)-(\d+)$/);
            if (match) {
                const spriteName = match[1];
                const spriteSheetIndex = parseInt(match[2], 10);

                // Update pivot data for the new spritesheet
                const pivotData = getPivotData(this.scene, '', spriteName, false);
                if (pivotData && pivotData.spriteSheetPivots[spriteSheetIndex]) {
                    this.spriteSheetPivots = pivotData.spriteSheetPivots[spriteSheetIndex];
                } else {
                    // No pivot data found for this spritesheet
                    this.spriteSheetPivots = undefined;
                }
            }

            // Update animation type and start index if provided
            if (animationType !== undefined) {
                this.animationType = animationType;
            }
            if (animationFrameStartIndex !== undefined) {
                this.animationFrameStartIndex = animationFrameStartIndex;
            }

            // Update direction frame ranges BEFORE playing
            const actualFramesPerDirection = framesPerDirection ?? 8;
            this.directionStartFrame = direction * actualFramesPerDirection;
            this.directionEndFrame = this.directionStartFrame + actualFramesPerDirection - 1;

            // Calculate the absolute frame index to start from
            // For SubFrame animations, add the animationFrameStartIndex offset
            let startFrame: number;
            if (this.animationType === AnimationType.SubFrame) {
                // For SubFrame, start from the directionStartFrame + animationFrameStartIndex
                startFrame = this.directionStartFrame + this.animationFrameStartIndex;
                if (relativeFrame !== undefined) {
                    startFrame += Math.max(0, Math.min(actualFramesPerDirection - this.animationFrameStartIndex - 1, relativeFrame));
                }
            } else {
                // For other types, use the standard logic
                startFrame = relativeFrame !== undefined
                    ? this.directionStartFrame + Math.max(0, Math.min(actualFramesPerDirection - 1, relativeFrame))
                    : this.directionStartFrame;
            }

            // Stop current animation if playing to ensure clean state
            if (this.sprite.anims.isPlaying) {
                this.sprite.anims.stop();
            }

            // Reset to frame 0 when starting from a non-zero frame to avoid carryover from previous animation
            if (startFrame > 0) {
                const anim = this.scene.anims.get(animationKey);
                const firstFrame = anim?.frames?.[0];
                if (firstFrame?.frame) {
                    this.sprite.anims.setCurrentFrame(firstFrame);
                }
            }

            // Play the animation from the correct starting frame
            const playConfig: Phaser.Types.Animations.PlayAnimationConfig = {
                key: animationKey,
                startFrame: startFrame,
                frameRate: frameRate
            };
            
            // Only set repeat if explicitly provided
            if (repeat !== undefined) {
                playConfig.repeat = repeat;
            }
            
            // Track whether this animation should loop
            // Priority: explicit isLooping parameter > repeat parameter > current value
            if (isLooping !== undefined) {
                this.isAnimationLooping = isLooping;
            } else {
                // - undefined: uses animation default (usually -1 for infinite) -> looping
                // - -1: infinite loop -> looping
                // - 0: play once -> not looping
                // - > 0: repeat that many times -> looping during playback (Phaser handles stopping)
                this.isAnimationLooping = repeat === undefined || repeat !== 0;
            }
            
            this.sprite.play(playConfig);

            // Sync overlays to parent's current frame (do not play—overlays must respect parent's
            // DirectionalSubFrame/SubFrame limits; playing would cycle through all frames).
            if (this.berserkOverlay) {
                this.syncBerserkOverlayFrame();
            }
            if (this.glareOverlay) {
                this.syncGlareOverlayFrame();
            }
        } catch (error) {
            console.error(`Error playing animation with direction for GameAsset`, this, error);
        }
    }

    /**
     * Sets the position of the asset.
     * Updates baseX and baseY, and reapplies pivot offset if applicable.
     * 
     * @param x - The new x coordinate (in pixel coordinates)
     * @param y - The new y coordinate (in pixel coordinates)
     */
    public setPosition(x: number, y: number): void {
        this.baseX = x;
        this.baseY = y;

        // Re-apply pivot offset based on current frame
        if (this.sprite.frame) {
            const frameName = this.sprite.frame.name;
            const frameIndex = typeof frameName === 'number' ? frameName : parseInt(frameName, 10);
            this.applyPivotOffset(frameIndex);
        } else {
            this.sprite.setPosition(x, y);
        }

        if (this.berserkOverlay) {
            this.berserkOverlay.setPosition(this.sprite.x, this.sprite.y);
        }
        if (this.glareOverlay) {
            this.glareOverlay.setPosition(this.sprite.x, this.sprite.y);
        }

        // Update shadow position if shadow is enabled
        this.updateShadowPosition();
    }

    /**
     * Updates or hides the ghost sprite (trail effect during movement).
     * Ghost is a semi-transparent copy positioned behind the main sprite in the direction of travel.
     *
     * @param visible - Whether the ghost should be visible
     * @param offsetX - X offset in pixels (positive = ghost to the right of main sprite)
     * @param offsetY - Y offset in pixels (positive = ghost below main sprite)
     */
    public updateGhostSprite(visible: boolean, offsetX: number, offsetY: number): void {
        if (!visible) {
            if (this.ghostSprite) {
                this.ghostSprite.setVisible(false);
            }
            return;
        }
        if (this.isMapObject()) {
            return;
        }
        const textureKey = this.sprite.texture?.key;
        if (!textureKey) {
            return;
        }
        if (!this.ghostSprite) {
            const frame = this.sprite.anims?.currentFrame ?? this.sprite.frame;
            const frameName = this.getFrameName(frame);
            const texture = this.scene.textures.get(textureKey);
            const safeFrame = texture.has(frameName) ? frameName : '0';
            this.ghostSprite = this.scene.add.sprite(this.sprite.x, this.sprite.y, textureKey, safeFrame);
            this.ghostSprite.setOrigin(0, 0);
            this.ghostSprite.setAlpha(0.4);
            this.ghostSprite.setTint(0x666666);
            this.ghostSprite.setDepth(this.sprite.depth - 1);
            this.ghostSprite.setVisible(true);
            this.sprite.on(Phaser.Animations.Events.ANIMATION_UPDATE, this.syncGhostFrame);
            this.sprite.on(Phaser.Animations.Events.ANIMATION_START, this.syncGhostFrame);
        }
        this.ghostSprite.setPosition(this.sprite.x + offsetX, this.sprite.y + offsetY);
        this.ghostSprite.setDepth(this.sprite.depth - 1);
        this.ghostSprite.setVisible(this.sprite.visible);
        this.syncGhostFrame();
    }

    private syncGhostFrame = (): void => {
        if (!this.ghostSprite) return;
        const textureKey = this.sprite.texture?.key;
        if (textureKey && this.ghostSprite.texture?.key !== textureKey) {
            this.destroyGhostSprite();
            return;
        }
        const frame = this.sprite.anims?.currentFrame ?? this.sprite.frame;
        const frameName = this.getFrameName(frame);
        if (this.ghostSprite.frame?.name !== frameName) {
            this.ghostSprite.setFrame(frameName);
        }
    };

    private destroyGhostSprite(): void {
        if (this.ghostSprite) {
            this.sprite.off(Phaser.Animations.Events.ANIMATION_UPDATE, this.syncGhostFrame);
            this.sprite.off(Phaser.Animations.Events.ANIMATION_START, this.syncGhostFrame);
            this.ghostSprite.destroy();
            this.ghostSprite = undefined;
        }
    }

    /**
     * Sets the depth of the sprite for proper rendering order.
     * Higher depth values render on top of lower depth values.
     * 
     * @param depth - The depth value to set
     */
    public setDepth(depth: number): void {
        // map-tile-422 renders +1 on top of regular depth for proper layering
        const actualDepth = this.isMapObject() && this.spriteName === 'map-tile-422'
            ? depth + 100
            : depth;
        this.sprite.setDepth(actualDepth);

        if (this.berserkOverlay) {
            this.berserkOverlay.setDepth(actualDepth + 1);
        }
        if (this.glareOverlay) {
            this.glareOverlay.setDepth(actualDepth + 2);
        }
        if (this.ghostSprite) {
            this.ghostSprite.setDepth(actualDepth - 1);
        }

        // Update tree shadow depth to render below the tree
        // Use depth - 50 to ensure shadow always stays below (based on Y-based depth calculation)
        if (this.treeShadowAsset) {
            this.treeShadowAsset.setDepth(actualDepth - 500);
        }

        // Update shadow depth if shadow is enabled
        this.updateShadowDepth();
    }

    /**
     * Gets the current depth of the sprite.
     * 
     * @returns The depth value
     */
    public getDepth(): number {
        return this.sprite.depth;
    }

    /**
     * Returns true if this asset's sprite animation is currently playing.
     *
     * @returns True when animation is playing, false when stopped or no animation exists
     */
    public isAnimationPlaying(): boolean {
        return this.sprite?.anims?.isPlaying ?? false;
    }

    /**
     * Checks if this asset is a static map object.
     * Map objects are identified by their sprite name pattern (map-tile-XXX).
     * 
     * @returns True if this is a map object, false otherwise
     */
    public isMapObject(): boolean {
        return this.spriteName.startsWith('map-tile-');
    }

    /**
     * Returns the tree shadow GameAsset if this asset has one (trees only).
     * Used for RenderTexture capture to include shadows in the correct draw order.
     */
    public getTreeShadowAsset(): GameAsset | undefined {
        return this.treeShadowAsset;
    }

    /**
     * Sets the alpha transparency of the sprite.
     * 
     * @param alpha - The alpha value (0-1)
     */
    public setAlpha(alpha: number): void {
        this.sprite.setAlpha(alpha);
        if (this.berserkOverlay) {
            this.berserkOverlay.setAlpha(0.5 * alpha);
        }
    }

    /**
     * Sets the visibility of the sprite.
     *
     * @param visible - Whether the sprite should be visible
     */
    public setVisible(visible: boolean): void {
        this.sprite.setVisible(visible);
        if (this.berserkOverlay) {
            this.berserkOverlay.setVisible(visible);
        }
        if (this.glareOverlay) {
            this.glareOverlay.setVisible(visible);
        }
    }

    /**
     * Gets the bounding rectangle of the sprite in world coordinates.
     * 
     * @returns A rectangle object with x, y, width, height
     */
    public getBounds(): { x: number; y: number; width: number; height: number } {
        const bounds = this.sprite.getBounds();
        return {
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height
        };
    }

    /**
     * Updates the shadow sprite position to match the asset's current position.
     */
    private updateShadowPosition(): void {
        if (!this.shadowManager) {
            return;
        }

        // Use sprite's actual position (which includes pivot offset)
        // The sprite position is at the pivot point (baseX + pivotX, baseY + pivotY)
        const spriteX = this.sprite.x;
        const spriteY = this.sprite.y;

        // Get current frame index to look up pivot data
        let frameIndex: number;
        if (this.isNonAnimated && this.fixedFrameIndex !== undefined) {
            frameIndex = this.fixedFrameIndex;
        } else {
            const currentFrame = this.sprite.anims.currentFrame;
            if (!currentFrame) {
                return;
            }
            const frameName = currentFrame.textureFrame ?? currentFrame.frame?.name ?? currentFrame.index;
            frameIndex = typeof frameName === 'number' ? frameName : parseInt(frameName, 10);
        }

        // Get object's pivot data for current frame
        let objectPivotX = 0;
        let objectPivotY = 0;
        if (this.spriteSheetPivots && this.spriteSheetPivots[frameIndex]) {
            const pivotFrame = this.spriteSheetPivots[frameIndex];
            if (pivotFrame.width !== 0 && pivotFrame.height !== 0) {
                objectPivotX = pivotFrame.pivotX;
                objectPivotY = pivotFrame.pivotY;
            }
        }

        // Get object's frame dimensions
        const objectFrame = this.sprite.frame;
        const objectFrameWidth = objectFrame?.width ?? this.sprite.displayWidth;
        const objectFrameHeight = objectFrame?.height ?? this.sprite.displayHeight;

        // Pass sprite position and pivot data to shadow manager
        // Shadow manager will calculate position relative to this, accounting for shadow's pivot and origin
        this.shadowManager.updatePositionFromSprite(
            spriteX,
            spriteY,
            objectPivotX,
            objectPivotY,
            objectFrameWidth,
            objectFrameHeight
        );
    }

    /**
     * Updates the shadow depth to render just below the asset.
     */
    private updateShadowDepth(): void {
        if (!this.shadowManager) {
            return;
        }

        const assetDepth = this.sprite.depth;
        this.shadowManager.updateDepth(assetDepth);
    }

    /**
     * Gets the current sprite name.
     * @returns The sprite name without extension
     */
    public getSpriteName(): string {
        return this.spriteName;
    }
    
    /**
     * Changes the sprite name for subsequent animations.
     * Used for sprite overrides in monster animations.
     * The actual texture change happens when playAnimationWithDirection is called.
     * @param newSpriteName - The new sprite name (without extension)
     */
    public setSpriteName(newSpriteName: string): void {
        this.spriteName = newSpriteName;
    }
    
    /**
     * Destroys the GameAsset and cleans up all associated resources.
     * Removes event listeners, destroys the sprite, and cleans up debug graphics and text.
     */
    public destroy(): void {
        this.destroyBerserkOverlay();
        this.destroyGlareOverlay();
        this.destroyGhostSprite();

        // Destroy tree shadow asset if it exists
        if (this.treeShadowAsset) {
            this.treeShadowAsset.destroy();
            this.treeShadowAsset = undefined;
        }

        // Destroy shadow manager if it exists
        if (this.shadowManager) {
            this.shadowManager.destroy();
            this.shadowManager = undefined;
        }

        // Remove debug mode change listener
        this.scene.registry.events.off(IN_DEBUG_MODE_CHANGE, this.debugModeChangeHandler);

        this.sprite.destroy();
        this.debugGraphics.destroy();
    }
}
