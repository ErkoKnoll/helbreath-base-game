import type { Scene } from 'phaser';
import { FLOATING_TEXT_DEPTH } from '../../Config';

/**
 * Configuration for creating a FloatingText instance.
 */
export type FloatingTextConfig = {
    /** Text to display */
    text: string;
    /** X position in pixels (origin, text travels upward from here) */
    x: number;
    /** Y position in pixels (origin, text travels upward from here) */
    y: number;
    /** Font size in pixels */
    fontSize?: number;
    /** Text colour (hex string, e.g. '#ff0000') */
    color?: string;
    /** Upward travel speed in pixels per second */
    upwardTravelPxPerSec?: number;
    /** Total duration in milliseconds before destroy */
    totalDurationMs: number;
    /** Fade duration in milliseconds. Fade starts at (totalDurationMs - fadeDurationMs). 0 = no fade, destroyed immediately at end. */
    fadeDurationMs?: number;
    /** Whether the font is bold */
    bold?: boolean;
    /** Horizontal offset in pixels. Negative = shift left, positive = shift right. */
    horizontalOffset?: number;
};

/**
 * Represents numerical or textual indicators on the game canvas.
 * Renders at very high depth above all other objects.
 * Text travels upward from origin and fades out before being destroyed.
 */
export class FloatingText {
    private scene: Scene;
    private textObject: Phaser.GameObjects.Text;
    private originY: number;
    private upwardTravelPxPerSec: number;
    private totalDurationMs: number;
    private fadeDurationMs: number;
    private elapsedMs: number = 0;
    private updateCallback: (time: number, delta: number) => void;

    constructor(scene: Scene, config: FloatingTextConfig) {
        this.scene = scene;
        this.originY = config.y;
        this.upwardTravelPxPerSec = config.upwardTravelPxPerSec ?? 0;
        this.totalDurationMs = config.totalDurationMs;
        this.fadeDurationMs = config.fadeDurationMs ?? 0;

        const x = config.x + (config.horizontalOffset ?? 0);
        this.textObject = scene.add.text(x, config.y, config.text, {
            fontFamily: "'Georgia', serif",
            fontSize: `${config.fontSize ?? 16}px`,
            fontStyle: config.bold ? 'bold' : 'normal',
            color: config.color ?? '#ffffff',
        });
        this.textObject.setOrigin(0.5, 0.5);
        this.textObject.setDepth(FLOATING_TEXT_DEPTH);

        this.updateCallback = (_time: number, delta: number) => this.update(delta);
        this.scene.events.on('update', this.updateCallback);
    }

    private update(delta: number): void {
        this.elapsedMs += delta;

        // Move upward
        const travelOffset = (this.elapsedMs / 1000) * this.upwardTravelPxPerSec;
        this.textObject.setPosition(this.textObject.x, this.originY - travelOffset);

        // Handle fade and destroy
        const fadeStartMs = this.totalDurationMs - this.fadeDurationMs;
        if (this.fadeDurationMs > 0 && this.elapsedMs >= fadeStartMs) {
            const fadeElapsed = this.elapsedMs - fadeStartMs;
            const fadeProgress = Math.min(1, fadeElapsed / this.fadeDurationMs);
            const alpha = 1 - fadeProgress;
            this.textObject.setAlpha(alpha);
            if (alpha <= 0) {
                this.destroy();
                return;
            }
        }

        if (this.elapsedMs >= this.totalDurationMs) {
            this.destroy();
        }
    }

    public destroy(): void {
        this.scene.events.off('update', this.updateCallback);
        this.textObject.destroy();
    }
}
