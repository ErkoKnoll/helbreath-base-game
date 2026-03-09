import type { Scene } from 'phaser';
import { EventBus } from '../game/EventBus';
import { convertPixelPosToWorldPos } from './CoordinateUtils';
import { MOVEMENT_COMMAND_THROTTLE_MS } from '../Config';
import { OUT_UI_MOUSE_POSITION_UPDATE } from '../constants/EventNames';

export interface InputManagerConfig {
    scene: Scene;
    /** When false, input handlers skip processing (e.g. during map load) */
    isEnabled?: () => boolean;
    /** Called when pointer moves; receives world pixel and tile coordinates */
    onPointerMove?: (worldPixelX: number, worldPixelY: number, worldX: number, worldY: number) => void;
    /** Called on left or right pointer down */
    onPointerDown?: (pointer: Phaser.Input.Pointer) => void;
    /** Called on left or right pointer up */
    onPointerUp?: (pointer: Phaser.Input.Pointer) => void;
}

/**
 * Manages mouse/pointer input: tracks button state, pointer position, movement throttle,
 * and emits UI events. Game-specific logic (e.g. attack, movement) is handled via callbacks.
 */
export class InputManager {
    private scene: Scene;
    private isEnabled: () => boolean;
    private onPointerMove?: (worldPixelX: number, worldPixelY: number, worldX: number, worldY: number) => void;
    private onPointerDown?: (pointer: Phaser.Input.Pointer) => void;
    private onPointerUp?: (pointer: Phaser.Input.Pointer) => void;

    private isLeftMouseDown = false;
    private isRightMouseDown = false;
    private lastMovementCommandTime = 0;

    private boundPointerMove: (pointer: Phaser.Input.Pointer) => void;
    private boundPointerDown: (pointer: Phaser.Input.Pointer) => void;
    private boundPointerUp: (pointer: Phaser.Input.Pointer) => void;
    private boundPointerOut: () => void;
    private boundContextMenu: (event: Event) => void;

    constructor(config: InputManagerConfig) {
        this.scene = config.scene;
        this.isEnabled = config.isEnabled ?? (() => true);
        this.onPointerMove = config.onPointerMove;
        this.onPointerDown = config.onPointerDown;
        this.onPointerUp = config.onPointerUp;

        this.boundPointerMove = (pointer: Phaser.Input.Pointer) => this.handlePointerMove(pointer);
        this.boundPointerDown = (pointer: Phaser.Input.Pointer) => this.handlePointerDown(pointer);
        this.boundPointerUp = (pointer: Phaser.Input.Pointer) => this.handlePointerUp(pointer);
        this.boundPointerOut = () => this.handlePointerOut();
        this.boundContextMenu = (event: Event) => event.preventDefault();
    }

    public setup(): void {
        this.scene.input.on('pointermove', this.boundPointerMove);
        this.scene.input.on('pointerdown', this.boundPointerDown);
        this.scene.input.on('pointerup', this.boundPointerUp);
        this.scene.input.on('pointerout', this.boundPointerOut);

        this.scene.input.mouse?.disableContextMenu();
        const gameCanvas = this.scene.game.canvas;
        if (gameCanvas) {
            gameCanvas.addEventListener('contextmenu', this.boundContextMenu);
        }
    }

    public destroy(): void {
        this.scene.input.off('pointermove', this.boundPointerMove);
        this.scene.input.off('pointerdown', this.boundPointerDown);
        this.scene.input.off('pointerup', this.boundPointerUp);
        this.scene.input.off('pointerout', this.boundPointerOut);

        const gameCanvas = this.scene.game.canvas;
        if (gameCanvas) {
            gameCanvas.removeEventListener('contextmenu', this.boundContextMenu);
        }
    }

    public getIsLeftMouseDown(): boolean {
        return this.isLeftMouseDown;
    }

    public getIsRightMouseDown(): boolean {
        return this.isRightMouseDown;
    }

    public getActivePointer(): Phaser.Input.Pointer | undefined {
        return this.scene.input.activePointer ?? undefined;
    }

    /** Returns true if enough time has passed since the last movement command (throttle). */
    public canAcceptMovementCommand(): boolean {
        const currentTime = this.scene.time.now;
        return currentTime - this.lastMovementCommandTime >= MOVEMENT_COMMAND_THROTTLE_MS;
    }

    /** Records that a movement command was accepted (updates throttle timestamp). */
    public recordMovementCommand(): void {
        this.lastMovementCommandTime = this.scene.time.now;
    }

    /** Resets the movement throttle so the next command is accepted immediately. */
    public resetMovementThrottle(): void {
        this.lastMovementCommandTime = 0;
    }

    private handlePointerMove(pointer: Phaser.Input.Pointer): void {
        if (!this.isEnabled() || !this.scene.cameras?.main) {
            return;
        }

        try {
            const worldPixelX = pointer.worldX;
            const worldPixelY = pointer.worldY;
            const worldX = convertPixelPosToWorldPos(worldPixelX);
            const worldY = convertPixelPosToWorldPos(worldPixelY);

            EventBus.emit(OUT_UI_MOUSE_POSITION_UPDATE, {
                sceneX: worldPixelX,
                sceneY: worldPixelY,
                worldX,
                worldY
            });

            this.onPointerMove?.(worldPixelX, worldPixelY, worldX, worldY);
        } catch (error) {
            console.warn('[InputManager] Failed to update mouse position:', error);
        }
    }

    private handlePointerDown(pointer: Phaser.Input.Pointer): void {
        if (!this.isEnabled()) {
            return;
        }

        if (pointer.leftButtonDown()) {
            this.isLeftMouseDown = true;
            this.resetMovementThrottle();
        } else if (pointer.rightButtonDown()) {
            this.isRightMouseDown = true;
        }

        this.onPointerDown?.(pointer);
    }

    private handlePointerUp(pointer: Phaser.Input.Pointer): void {
        if (!this.isEnabled()) {
            return;
        }

        const releasedButton = pointer.button;

        if (releasedButton === 0 && this.isLeftMouseDown) {
            this.isLeftMouseDown = false;
            this.onPointerUp?.(pointer);
        }

        if (releasedButton === 2 && this.isRightMouseDown) {
            this.isRightMouseDown = false;
        }
    }

    private handlePointerOut(): void {
        this.isLeftMouseDown = false;
        this.isRightMouseDown = false;
    }
}
