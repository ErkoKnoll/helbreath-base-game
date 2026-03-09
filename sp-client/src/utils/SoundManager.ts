import { Scene } from 'phaser';

/**
 * Spatial audio configuration for a sound.
 */
export interface SpatialConfig {
    /** Pan value (-1 = left, 0 = center, 1 = right) */
    pan: number;
    /** Volume multiplier for distance (0-1) */
    distanceVolume: number;
}

/**
 * Manages sound effects playback in the game.
 * Handles looping sounds and tracking multiple sounds simultaneously.
 * Supports spatial audio with panning and distance-based volume.
 */
export class SoundManager {
    private scene: Scene;
    private loopingSounds: Map<number, Phaser.Sound.NoAudioSound | Phaser.Sound.HTML5AudioSound | Phaser.Sound.WebAudioSound> = new Map();
    private spatialConfigs: Map<number, SpatialConfig> = new Map(); // Track spatial configs for sounds
    private oneShotSounds: Map<number, Phaser.Sound.NoAudioSound | Phaser.Sound.HTML5AudioSound | Phaser.Sound.WebAudioSound> = new Map();
    private soundVolume = 100; // Default volume (0-100)
    private nextSoundId = 0; // Incrementing counter for unique sound IDs

    constructor(scene: Scene) {
        this.scene = scene;
    }


    /**
     * Plays the specified sound file in a loop.
     * Returns a unique ID that can be used to control the sound later.
     * 
     * @param fileName - The name of the sound file (e.g., 'C10.mp3')
     * @param animationDurationMs - Optional duration of the animation in milliseconds. When provided, sound playback speed will be adjusted to match. When omitted, plays at original duration.
     * @param spatialConfig - Optional spatial audio configuration (pan and distance volume)
     * @returns Unique sound ID
     * @throws Error if sound file is not found in cache
     */
    public playInLoop(fileName: string, animationDurationMs?: number, spatialConfig?: SpatialConfig): number {
        // Extract key from filename (remove .mp3 extension)
        const soundKey = fileName.replace('.mp3', '');

        // Check if the audio exists in cache
        if (!this.scene.cache.audio.exists(soundKey)) {
            throw new Error(`[SoundManager] Sound file not found in cache: ${fileName}`);
        }

        // Generate unique ID for this sound instance
        const soundId = this.nextSoundId++;
        
        // Create and play the sound in loop
        const phaserVolume = this.soundVolume / 100; // Convert to Phaser's volume range (0-1)
        const sound = this.scene.sound.add(soundKey, {
            loop: true,
            volume: phaserVolume
        });

        // Calculate and set playback rate when animation duration is specified
        if (animationDurationMs !== undefined) {
            const playbackRate = this.calculatePlaybackRate(sound, animationDurationMs);
            sound.setRate(playbackRate);
        }

        // Apply spatial configuration if provided
        if (spatialConfig) {
            this.applySpatialConfig(sound, spatialConfig);
            this.spatialConfigs.set(soundId, spatialConfig);
        }
        
        sound.play();
        this.loopingSounds.set(soundId, sound);

        return soundId;
    }

    /**
     * Updates the animation duration (and thus playback speed) of a currently playing sound.
     * Only applies when the sound was originally started with animationDurationMs.
     * 
     * @param soundId - The unique sound ID returned by playInLoop
     * @param animationDurationMs - Duration of the animation in milliseconds. Sound playback speed will be adjusted to match this duration.
     */
    public setAnimationDuration(soundId: number, animationDurationMs: number): void {
        const sound = this.loopingSounds.get(soundId);

        if (sound && sound.isPlaying && animationDurationMs !== undefined) {
            const playbackRate = this.calculatePlaybackRate(sound, animationDurationMs);
            sound.setRate(playbackRate);
        }
    }

    /**
     * Stops the specified sound if it is being played in loop.
     * 
     * @param soundId - The unique sound ID returned by playInLoop
     */
    public stopSound(soundId: number): void {
        let sound = this.loopingSounds.get(soundId);
        if (sound) {
            console.log(`[SoundManager] Stopping looping sound, soundId=${soundId}`);
            if (sound.isPlaying) {
                sound.stop();
            }
            sound.destroy();
            this.loopingSounds.delete(soundId);
            this.spatialConfigs.delete(soundId);
            return;
        }
        sound = this.oneShotSounds.get(soundId);
        if (sound) {
            console.log(`[SoundManager] Stopping one-shot sound, soundId=${soundId}`);
            if (sound.isPlaying) {
                sound.stop();
            }
            sound.destroy();
            this.oneShotSounds.delete(soundId);
        }
    }

    /**
     * Stops all currently playing sounds (both looping and one-shot).
     */
    public stopAllSounds(): void {
        const loopingCount = this.loopingSounds.size;
        const oneShotCount = this.oneShotSounds.size;
        if (loopingCount > 0 || oneShotCount > 0) {
            console.log(`[SoundManager] Stopping all sounds: ${loopingCount} looping, ${oneShotCount} one-shot`);
        }

        this.loopingSounds.forEach((sound) => {
            if (sound.isPlaying) {
                sound.stop();
            }
            sound.destroy();
        });
        this.loopingSounds.clear();
        this.spatialConfigs.clear();

        this.oneShotSounds.forEach((sound) => {
            if (sound.isPlaying) {
                sound.stop();
            }
            sound.destroy();
        });
        this.oneShotSounds.clear();
    }

    /**
     * Sets the sound volume.
     * 
     * @param volume - Volume level between 0 and 100 (0 = silent, 100 = full volume)
     */
    public setSoundVolume(volume: number): void {
        // Clamp volume between 0 and 100
        const clampedVolume = Math.max(0, Math.min(100, volume));
        
        // Update internal volume state FIRST before updating any sounds
        // This ensures new sounds created during the update use the correct volume
        this.soundVolume = clampedVolume;
        
        // Convert to Phaser's volume range (0-1)
        const phaserVolume = clampedVolume / 100;

        // Update all currently playing sounds immediately
        this.loopingSounds.forEach((sound, soundId) => {
            if (sound.isPlaying) {
                // Check if this sound has spatial configuration
                const spatialConfig = this.spatialConfigs.get(soundId);
                if (spatialConfig) {
                    // Re-apply spatial config with new base volume
                    this.applySpatialConfig(sound, spatialConfig);
                } else {
                    // Regular sound - just set volume
                    sound.setVolume(phaserVolume);
                }
            }
        });
    }

    /**
     * Gets the current sound volume.
     * 
     * @returns Volume level between 0 and 100
     */
    public getSoundVolume(): number {
        return this.soundVolume;
    }
    
    /**
     * Updates the spatial configuration for a sound.
     * 
     * @param soundId - The unique sound ID returned by playInLoop
     * @param spatialConfig - Spatial audio configuration (pan and distance volume)
     */
    public setSpatialConfig(soundId: number, spatialConfig: SpatialConfig): void {
        const sound = this.loopingSounds.get(soundId);
        
        if (sound && sound.isPlaying) {
            this.applySpatialConfig(sound, spatialConfig);
            this.spatialConfigs.set(soundId, spatialConfig);
        }
    }
    
    /**
     * Plays the specified sound file once (not in loop).
     * Returns a sound ID that can be used to stop the sound before it finishes.
     *
     * @param fileName - The name of the sound file (e.g., 'C92.mp3')
     * @param animationDurationMs - Optional duration of the animation in milliseconds. When provided, sound playback speed will be adjusted to match. When omitted, plays at original duration.
     * @param spatialConfig - Optional spatial audio configuration (pan and distance volume)
     * @param onComplete - Optional callback when the sound finishes (for cleanup)
     * @returns Sound ID for stopping the sound
     * @throws Error if sound file is not found in cache
     */
    public playOnce(fileName: string, animationDurationMs?: number, spatialConfig?: SpatialConfig, onComplete?: (soundId: number) => void): number {
        // Extract key from filename (remove .mp3 extension)
        const soundKey = fileName.replace('.mp3', '');

        // Check if the audio exists in cache
        if (!this.scene.cache.audio.exists(soundKey)) {
            throw new Error(`[SoundManager] Sound file not found in cache: ${fileName}`);
        }

        // Create and play the sound once (not in loop)
        const phaserVolume = this.soundVolume / 100; // Convert to Phaser's volume range (0-1)
        const sound = this.scene.sound.add(soundKey, {
            loop: false,
            volume: phaserVolume
        });

        // Calculate and set playback rate when animation duration is specified
        if (animationDurationMs !== undefined) {
            const playbackRate = this.calculatePlaybackRate(sound, animationDurationMs);
            sound.setRate(playbackRate);
        }
        
        // Apply spatial configuration if provided
        if (spatialConfig) {
            this.applySpatialConfig(sound, spatialConfig);
        }
        
        sound.play();
        const soundId = this.nextSoundId++;
        this.oneShotSounds.set(soundId, sound);

        // Clean up the sound when it finishes playing
        sound.once('complete', () => {
            this.oneShotSounds.delete(soundId);
            sound.destroy();
            onComplete?.(soundId);
        });

        return soundId;
    }

    /**
     * Calculates the playback rate needed to match the sound duration to the animation duration.
     * 
     * @param sound - The Phaser sound instance
     * @param animationDurationMs - Duration of the animation in milliseconds
     * @returns Playback rate multiplier (e.g., 1.0 = normal speed, 2.0 = 2x speed)
     */
    private calculatePlaybackRate(
        sound: Phaser.Sound.NoAudioSound | Phaser.Sound.HTML5AudioSound | Phaser.Sound.WebAudioSound,
        animationDurationMs: number
    ): number {
        // Get sound duration in milliseconds
        let soundDurationMs: number;
        
        if ('audioBuffer' in sound && sound.audioBuffer) {
            // WebAudioSound - duration is in seconds
            soundDurationMs = sound.audioBuffer.duration * 1000;
        } else {
            // Fallback for other sound types - use duration property if available
            soundDurationMs = (sound.duration || 1) * 1000;
        }
        
        // Calculate playback rate: soundDuration / animationDuration
        // If animation is faster (shorter duration), playback rate increases
        // If animation is slower (longer duration), playback rate decreases
        const playbackRate = soundDurationMs / animationDurationMs;
        
        return playbackRate;
    }
    
    /**
     * Applies spatial configuration to a sound.
     * 
     * @param sound - The Phaser sound instance
     * @param spatialConfig - Spatial audio configuration
     */
    private applySpatialConfig(
        sound: Phaser.Sound.NoAudioSound | Phaser.Sound.HTML5AudioSound | Phaser.Sound.WebAudioSound,
        spatialConfig: SpatialConfig
    ): void {
        // Set pan (-1 = left, 0 = center, 1 = right)
        if ('setPan' in sound) {
            sound.setPan(spatialConfig.pan);
        }
        
        // Set volume with both base volume and distance attenuation
        const phaserVolume = this.soundVolume / 100; // Base volume
        const finalVolume = phaserVolume * spatialConfig.distanceVolume;
        sound.setVolume(finalVolume);
    }
}
