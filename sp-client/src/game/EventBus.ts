import { Events } from 'phaser';

/**
 * Phaser EventEmitter for cross-component communication.
 * Used to emit events between React UI, Phaser scenes, and game objects.
 */
export const EventBus = new Events.EventEmitter();