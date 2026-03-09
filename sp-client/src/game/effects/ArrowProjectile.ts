import Phaser, { type Scene } from 'phaser';
import { GameAsset } from '../objects/GameAsset';
import { convertPixelPosToWorldPos } from '../../utils/CoordinateUtils';
import { DEPTH_MULTIPLIER } from '../../Config';

const DEFAULT_SPEED = 1000; // pixels per second
/** Hit radius in pixels - arrow hits when within this distance of target. Larger value ensures hits on moving targets. */
const HIT_RADIUS = 24;
const ARROW_SPRITE_SHEET = 7; // effect.pak sheet 7
const DEGREES_PER_DIRECTION = 22.5; // 16 directions = 360 / 16

const ORIGIN_OFFSET_Y = 45;
const TARGET_OFFSET_Y_DEFAULT = 45;

/**
 * Target interface for ArrowProjectile. Provides pixel coordinates to home toward.
 * When getIsDead returns true (e.g. Monster), the projectile destroys itself early.
 * getHeight is optional; when smaller than TARGET_OFFSET_Y_DEFAULT, target Y offset = height/2.
 */
export interface ArrowProjectileTarget {
    getAnimatedPixelX(): number;
    getAnimatedPixelY(): number;
    getIsDead?(): boolean;
    getHeight?(): number;
}

/** Type guard for ArrowProjectileTarget. Player and Monster implement this interface. */
export function isArrowProjectileTarget(obj: unknown): obj is ArrowProjectileTarget {
    return (
        typeof obj === 'object' &&
        obj !== null &&
        typeof (obj as ArrowProjectileTarget).getAnimatedPixelX === 'function' &&
        typeof (obj as ArrowProjectileTarget).getAnimatedPixelY === 'function'
    );
}

export type ArrowProjectileConfig = {
    /** Origin X position in pixels */
    originPixelX: number;
    /** Origin Y position in pixels */
    originPixelY: number;
    /** Target to track. Projectile follows target if it moves. */
    target: ArrowProjectileTarget;
    /** Called when arrow reaches the target. Caller applies damage (e.g. via closure) in this callback. */
    onReachDestination: () => void;
    /** Travel speed in pixels per second (default: 1000) */
    speed?: number;
};

/**
 * Distance from point (px, py) to the line segment from (x1, y1) to (x2, y2).
 */
function distanceFromPointToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) {
        return Phaser.Math.Distance.Between(px, py, x1, y1);
    }
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const projX = x1 + t * dx;
    const projY = y1 + t * dy;
    return Phaser.Math.Distance.Between(px, py, projX, projY);
}

/**
 * Computes the 16-direction frame index (0-15) from angle in degrees.
 * North = 0°, East = 90°, South = 180°, West = 270°. Clockwise from North.
 * Uses atan2(dx, -dy) so that North (negative dy) = 0°.
 */
function getDirectionFrameFromAngle(angleDeg: number): number {
    // Normalize to 0-360
    let normalized = ((angleDeg % 360) + 360) % 360;
    const index = Math.round(normalized / DEGREES_PER_DIRECTION) % 16;
    return index;
}

/**
 * Gets the arrow sprite frame index for the given direction from origin to target.
 * Effect sheet 7 has 16 frames (0-15), one per 22.5° direction.
 */
function getArrowFrameIndex(currentX: number, currentY: number, targetX: number, targetY: number): number {
    const dx = targetX - currentX;
    const dy = targetY - currentY;

    if (dx === 0 && dy === 0) {
        return 0; // Default to North when no movement
    }

    // atan2(dx, -dy): North (dy negative) = 0°, East (dx positive) = 90°
    const angleRad = Phaser.Math.Angle.Between(0, 0, -dy, dx);
    const angleDeg = (angleRad * 180) / Math.PI;
    return getDirectionFrameFromAngle(angleDeg);
}

/**
 * Arrow projectile that travels from origin toward a target, homing on the target's
 * current position each frame. Uses effect sprite sheet 7 with 16 directional frames.
 * Destroys when it reaches the target coordinates.
 */
export class ArrowProjectile {
    private scene: Scene;
    private target: ArrowProjectileTarget;
    private onReachDestination: () => void;
    private speed: number;
    private currentX: number;
    private currentY: number;
    private hasArrived: boolean = false;
    private asset: GameAsset | undefined;
    private updateCallback?: (time: number, delta: number) => void;

    constructor(scene: Scene, config: ArrowProjectileConfig) {
        this.scene = scene;
        this.target = config.target;
        this.onReachDestination = config.onReachDestination;
        this.speed = config.speed ?? DEFAULT_SPEED;
        this.currentX = config.originPixelX;
        this.currentY = config.originPixelY - ORIGIN_OFFSET_Y;

        if (config.target.getIsDead?.()) {
            return;
        }

        const targetPos = this.getTargetPosition();
        const targetX = targetPos.x;
        const targetY = targetPos.y;
        const initialFrame = getArrowFrameIndex(this.currentX, this.currentY, targetX, targetY);

        this.asset = new GameAsset(this.scene, {
            x: this.currentX,
            y: this.currentY,
            spriteName: 'effect',
            spriteSheetIndex: ARROW_SPRITE_SHEET,
            frameIndex: initialFrame,
            isLooping: false,
        });
        this.asset.setDepth(convertPixelPosToWorldPos(this.currentY) * DEPTH_MULTIPLIER + 50);

        this.updateCallback = (_time: number, delta: number) => this.update(delta);
        this.scene.events.on('postupdate', this.updateCallback);
    }

    private getTargetPosition(): { x: number; y: number } {
        const baseY = this.target.getAnimatedPixelY();
        const targetHeight = this.target.getHeight?.() ?? TARGET_OFFSET_Y_DEFAULT;
        const targetOffsetY = targetHeight < TARGET_OFFSET_Y_DEFAULT ? targetHeight / 2 : TARGET_OFFSET_Y_DEFAULT;
        return {
            x: this.target.getAnimatedPixelX(),
            y: baseY - targetOffsetY,
        };
    }

    private update(delta: number): void {
        if (!this.asset) {
            return;
        }

        if (this.target.getIsDead?.()) {
            this.destroy();
            return;
        }

        const target = this.getTargetPosition();
        const dx = target.x - this.currentX;
        const dy = target.y - this.currentY;
        const distance = Phaser.Math.Distance.Between(this.currentX, this.currentY, target.x, target.y);

        if (this.hasArrived) {
            this.currentX = target.x;
            this.currentY = target.y;
        } else if (distance <= HIT_RADIUS) {
            this.hasArrived = true;
            this.currentX = target.x;
            this.currentY = target.y;
            this.onReachDestination();
        } else {
            const prevX = this.currentX;
            const prevY = this.currentY;
            const moveDistance = (this.speed * delta) / 1000;
            const ratio = Math.min(1, moveDistance / distance);
            this.currentX += dx * ratio;
            this.currentY += dy * ratio;

            // Path-based hit: check if we passed through the target this frame (catches overshoot on moving targets)
            const distToPath = distanceFromPointToSegment(target.x, target.y, prevX, prevY, this.currentX, this.currentY);
            if (distToPath <= HIT_RADIUS) {
                this.hasArrived = true;
                this.currentX = target.x;
                this.currentY = target.y;
                this.onReachDestination();
            }
        }

        // Update sprite direction based on current trajectory
        const frameIndex = getArrowFrameIndex(this.currentX, this.currentY, target.x, target.y);
        this.asset.sprite.setFrame(frameIndex);
        this.asset.setPosition(this.currentX, this.currentY);
        this.asset.setDepth(convertPixelPosToWorldPos(this.currentY) * DEPTH_MULTIPLIER + 50);

        if (this.hasArrived) {
            this.destroy();
        }
    }

    public destroy(): void {
        if (this.updateCallback) {
            this.scene.events.off('postupdate', this.updateCallback);
            this.updateCallback = undefined;
        }
        if (this.asset) {
            this.asset.destroy();
            this.asset = undefined;
        }
    }
}
