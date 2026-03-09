import type { Scene } from 'phaser';
import type { Monster } from '../objects/Monster';
import { getEffectByKey } from '../../constants/Effects';
import { EFFECT_STORM_BRINGER } from '../../constants/Effects';
import { drawEffectAtPixelCoords } from '../../utils/EffectUtils';
import type { Effect } from './Effect';

const DEFAULT_SPEED = 500; // pixels per second
const ARRIVAL_THRESHOLD = 2; // pixels - consider "arrived" when within this distance

export type StormBringerEffectConfig = {
    /** Origin X position in pixels (from player) */
    originPixelX: number;
    /** Origin Y position in pixels (from player) */
    originPixelY: number;
    /** Monster instance to track as target. Projectile follows monster if it moves. */
    targetMonster: Monster;
    /** Travel speed in pixels per second (default: 500) */
    speed?: number;
};

/**
 * Storm Bringer weapon effect: an invisible projectile that travels from origin to target monster,
 * continuously tracking the monster's position. Draws the Storm Bringer effect animation on top
 * of the projectile. Destroys when the effect animation finishes playing once.
 */
export class StormBringerEffect {
    private scene: Scene;
    private targetMonster: Monster;
    private speed: number;
    private currentX: number;
    private currentY: number;
    private hasArrived: boolean = false;
    private effect: Effect | undefined;
    private updateCallback?: (time: number, delta: number) => void;

    constructor(scene: Scene, config: StormBringerEffectConfig) {
        this.scene = scene;
        this.targetMonster = config.targetMonster;
        this.speed = config.speed ?? DEFAULT_SPEED;
        this.currentX = config.originPixelX;
        this.currentY = config.originPixelY;

        if (config.targetMonster.getIsDead()) {
            return;
        }

        const effectConfig = getEffectByKey(EFFECT_STORM_BRINGER);
        if (!effectConfig) {
            console.warn('[StormBringerEffect] Effect config not found:', EFFECT_STORM_BRINGER);
            return;
        }

        this.effect = drawEffectAtPixelCoords(scene, this.currentX, this.currentY, EFFECT_STORM_BRINGER, {
            onDestroy: () => this.onEffectDestroyed(),
        });

        if (this.effect) {
            this.updateCallback = (_time: number, delta: number) => this.update(delta);
            this.scene.events.on('update', this.updateCallback);
        }
    }

    private getTargetPosition(): { x: number; y: number } {
        return {
            x: this.targetMonster.getAnimatedPixelX(),
            y: this.targetMonster.getAnimatedPixelY(),
        };
    }

    private update(delta: number): void {
        if (!this.effect) {
            return;
        }

        if (this.targetMonster.getIsDead()) {
            this.destroy();
            return;
        }

        const target = this.getTargetPosition();
        const dx = target.x - this.currentX;
        const dy = target.y - this.currentY;
        const distance = Phaser.Math.Distance.Between(
            this.currentX,
            this.currentY,
            target.x,
            target.y
        );

        if (this.hasArrived) {
            this.currentX = target.x;
            this.currentY = target.y;
        } else if (distance <= ARRIVAL_THRESHOLD) {
            this.hasArrived = true;
            this.currentX = target.x;
            this.currentY = target.y;
        } else {
            const moveDistance = (this.speed * delta) / 1000;
            const ratio = Math.min(1, moveDistance / distance);
            this.currentX += dx * ratio;
            this.currentY += dy * ratio;
        }

        this.effect.setPosition(this.currentX, this.currentY);
    }

    private onEffectDestroyed(): void {
        this.effect = undefined;
        this.destroy();
    }

    public destroy(): void {
        if (this.updateCallback) {
            this.scene.events.off('update', this.updateCallback);
            this.updateCallback = undefined;
        }
        if (this.effect) {
            this.effect.destroy();
            this.effect = undefined;
        }
    }
}
