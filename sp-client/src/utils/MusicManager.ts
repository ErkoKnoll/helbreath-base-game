import { Scene } from 'phaser';

/**
 * Manages background music playback in the game.
 * Handles looping music and switching between different tracks.
 */
export class MusicManager {
    private scene: Scene;
    private currentMusic: Phaser.Sound.WebAudioSound | undefined = undefined;
    private currentMusicKey: string | undefined = undefined;
    private musicVolume = 100; // Default volume (0-100)

    constructor(scene: Scene) {
        this.scene = scene;
    }

    /**
     * Updates the scene reference (useful when scene is recreated).
     * 
     * @param scene - The new scene instance
     */
    public setScene(scene: Scene): void {
        this.scene = scene;
    }

    /**
     * Plays the specified music file in a loop.
     * If the same music is already playing, continues playing without restarting.
     * If a different music is playing, stops it and starts the new one.
     * 
     * @param fileName - The name of the .mp3 file (e.g., 'default.mp3')
     */
    public playMusic(fileName: string): void {
        // If the same music is already playing, do nothing
        if (this.currentMusicKey === fileName && this.currentMusic && this.currentMusic.isPlaying) {
            return;
        }

        // Stop current music if playing
        if (this.currentMusic && this.currentMusic.isPlaying) {
            this.currentMusic.stop();
            this.currentMusic.destroy();
            this.currentMusic = undefined;
        }

        // Extract key from filename (remove .mp3 extension)
        const musicKey = fileName.replace('.mp3', '');

        // Check if the audio exists in cache
        if (!this.scene.cache.audio.exists(musicKey)) {
            console.warn(`[MusicManager] Music file not found in cache: ${fileName}`);
            return;
        }

        // Create and play the new music
        const phaserVolume = this.musicVolume / 100; // Convert to Phaser's volume range (0-1)
        this.currentMusic = this.scene.sound.add(musicKey, {
            loop: true,
            volume: phaserVolume
        }) as Phaser.Sound.WebAudioSound;

        // Play with loop enabled to ensure music loops continuously
        this.currentMusic.play({ loop: true });
        this.currentMusicKey = fileName;

        console.log(`[MusicManager] Playing music: ${fileName}`);
    }

    /**
     * Stops the currently playing music.
     */
    public stopMusic(): void {
        if (this.currentMusic) {
            if (this.currentMusic.isPlaying) {
                this.currentMusic.stop();
            }
            this.currentMusic.destroy();
            this.currentMusic = undefined;
            this.currentMusicKey = undefined;
            console.log('[MusicManager] Music stopped');
        }
    }

    /**
     * Gets the currently playing music file name.
     * 
     * @returns The current music file name or undefined if no music is playing
     */
    public getCurrentMusic(): string | undefined {
        return this.currentMusicKey;
    }

    /**
     * Sets the music volume.
     * 
     * @param volume - Volume level between 0 and 100 (0 = silent, 100 = full volume)
     */
    public setMusicVolume(volume: number): void {
        // Clamp volume between 0 and 100
        const clampedVolume = Math.max(0, Math.min(100, volume));
        this.musicVolume = clampedVolume;
        // Convert to Phaser's volume range (0-1)
        const phaserVolume = clampedVolume / 100;

        // Update current music if playing
        if (this.currentMusic) {
            // Phaser sounds have a volume property that can be set directly
            this.currentMusic.setVolume(phaserVolume);
        }

        console.log(`[MusicManager] Music volume set to ${clampedVolume}%`);
    }

    /**
     * Gets the current music volume.
     * 
     * @returns Volume level between 0 and 100
     */
    public getMusicVolume(): number {
        return this.musicVolume;
    }
}
