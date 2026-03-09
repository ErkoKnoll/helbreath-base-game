import { SoundManager, SpatialConfig } from './SoundManager';

/**
 * Represents a tracked sound with its metadata.
 * Keys: state number for looping sounds, -soundId for one-shot sounds.
 */
interface TrackedSound {
    soundId: number;
    fileName: string;
    animationDurationMs?: number;
    isLooping: boolean;
}

/** Key for one-shot sounds in trackedSounds (negative to avoid collision with state enums). */
function oneShotKey(soundId: number): number {
    return -soundId;
}

/**
 * Tracks all sounds (looping and one-shot) in a single map.
 * One-shot entries are cleaned up when the sound finishes (after its duration).
 */
export class SoundTracker {
    private soundManager: SoundManager;
    private trackedSounds: Map<number, TrackedSound> = new Map();

    constructor(soundManager: SoundManager) {
        this.soundManager = soundManager;
    }

    /**
     * Plays a sound in loop and tracks it by game object state.
     * If a sound is already tracked for this state, does nothing.
     */
    public playInLoop(state: number, fileName: string, animationDurationMs: number, spatialConfig?: SpatialConfig): void {
        if (this.trackedSounds.has(state)) {
            const trackedSound = this.trackedSounds.get(state);
            if (trackedSound && trackedSound.animationDurationMs !== animationDurationMs) {
                this.setAnimationDuration(state, animationDurationMs);
            }
            return;
        }

        const soundId = this.soundManager.playInLoop(fileName, animationDurationMs, spatialConfig);
        this.trackedSounds.set(state, { soundId, fileName, animationDurationMs, isLooping: true });
    }

    /**
     * Stops the sound associated with the given state.
     */
    public stopSound(state: number): void {
        const trackedSound = this.trackedSounds.get(state);
        if (trackedSound) {
            console.log(`[SoundTracker] Stopping sound for state ${state}: ${trackedSound.fileName}`);
            this.soundManager.stopSound(trackedSound.soundId);
            this.trackedSounds.delete(state);
        }
    }

    /**
     * Stops all tracked sounds (looping and one-shot).
     */
    public stopAllSounds(): void {
        this.trackedSounds.forEach((trackedSound) => {
            console.log(`[SoundTracker] Stopping all sound for`, trackedSound);
            this.soundManager.stopSound(trackedSound.soundId);
        });
        this.trackedSounds.clear();
    }

    /**
     * Sets the animation duration for the sound associated with the given state (looping only).
     */
    public setAnimationDuration(state: number, animationDurationMs: number): void {
        const trackedSound = this.trackedSounds.get(state);
        if (trackedSound) {
            this.soundManager.setAnimationDuration(trackedSound.soundId, animationDurationMs);
            trackedSound.animationDurationMs = animationDurationMs;
        }
    }

    /**
     * Updates the spatial configuration for the sound associated with the given state (looping only).
     */
    public setSpatialConfig(state: number, spatialConfig: SpatialConfig): void {
        const trackedSound = this.trackedSounds.get(state);
        if (trackedSound) {
            this.soundManager.setSpatialConfig(trackedSound.soundId, spatialConfig);
        }
    }

    /**
     * Plays a sound once without tracking it. The sound will play to completion and
     * will NOT be stopped by stopAllSounds(). Use for one-shots that should persist
     * across state changes (e.g. blade impact when monster takes damage, even if it dies).
     */
    public playOnceUntracked(fileName: string, spatialConfig?: SpatialConfig): void {
        this.soundManager.playOnce(fileName, undefined, spatialConfig);
    }

    /**
     * Plays a sound once. Tracked so stopAllSounds() will stop it if still playing.
     * When state is provided, the sound can be stopped with stopSound(state).
     * Entry is removed from the map when the sound finishes (after its duration).
     */
    public playOnce(fileName: string, animationDurationMs?: number, spatialConfig?: SpatialConfig, state?: number): void {
        const soundId = this.soundManager.playOnce(
            fileName,
            animationDurationMs,
            spatialConfig,
            (id) => this.trackedSounds.delete(state !== undefined ? state : oneShotKey(id))
        );
        const actualKey = state !== undefined ? state : oneShotKey(soundId);
        this.trackedSounds.set(actualKey, { soundId, fileName, animationDurationMs, isLooping: false });
    }
}
