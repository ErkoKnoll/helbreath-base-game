import type { Scene } from 'phaser';
import type { WeatherMode } from '../ui/store/MapDialog.store';
import { RAIN_SOUND } from '../constants/SoundFileNames';
import { HIGH_DEPTH, DEPTH_MULTIPLIER } from '../Config';
import { convertPixelPosToWorldPos } from './CoordinateUtils';
import type { SoundManager } from './SoundManager';

/** Precipitation particle state (effect2 sheet 1) */
interface PrecipParticle {
    /** World pixel X */
    pixelX: number;
    /** World pixel Y */
    pixelY: number;
    /** Animation step: rain 0-24 (20 fall + splash), snow 0-79; respawn when exceeded */
    step: number;
    /** Reusable sprite for this particle */
    sprite: Phaser.GameObjects.Sprite;
}

const EFFECT2_TEXTURE_KEY = 'sprite-effect2-1';
const FRAME_UPDATE_INTERVAL_MS = 30;
const MAX_PARTICLES = 200;

/** Rain: effect2 frames 16-19 falling, 20-23 splash. ~610px Y, -20px X over 600ms */
const RAIN_FALLING_FRAME_START = 16;
const RAIN_SPLASH_FRAME_END = 23;
const RAIN_FALL_STEPS = 20;
const RAIN_TOTAL_Y = 610;
const RAIN_TOTAL_X = -20;

/** Snow: effect2 frames 39-50. ~324px Y over 2400ms, no splash */
const SNOW_FRAME_START = 39;
const SNOW_FALL_STEPS = 80;
const SNOW_TOTAL_Y = 324;

/** Margin in pixels beyond viewport for spawn */
const SPAWN_MARGIN = 200;

/** Fall speeds in px/ms for smooth per-frame motion */
const RAIN_FALL_SPEED_Y = RAIN_TOTAL_Y / (RAIN_FALL_STEPS * FRAME_UPDATE_INTERVAL_MS);
const RAIN_FALL_SPEED_X = RAIN_TOTAL_X / (RAIN_FALL_STEPS * FRAME_UPDATE_INTERVAL_MS);
const SNOW_FALL_SPEED_Y = SNOW_TOTAL_Y / (SNOW_FALL_STEPS * FRAME_UPDATE_INTERVAL_MS);

function isRain(mode: WeatherMode): boolean {
    return mode === 'rain-light' || mode === 'rain-medium' || mode === 'rain-heavy';
}

function isSnow(mode: WeatherMode): boolean {
    return mode === 'snow-light' || mode === 'snow-medium' || mode === 'snow-heavy';
}

/**
 * Manages weather effects: rain and snow precipitation particles.
 * Spawns and animates particles from effect2 sprite sheet, with optional rain sound.
 */
export class WeatherManager {
    private scene: Scene;
    private soundManager: SoundManager;
    private weatherMode: WeatherMode = 'dry';
    private particles: PrecipParticle[] = [];
    private lastFrameUpdateTime = 0;
    private rainSoundId: number | undefined = undefined;
    /** Last camera scroll and view size (for spawn positioning when switching weather) */
    private lastScrollX = 0;
    private lastScrollY = 0;
    private lastViewWidth = 640;
    private lastViewHeight = 480;

    constructor(scene: Scene, soundManager: SoundManager) {
        this.scene = scene;
        this.soundManager = soundManager;
    }

    /**
     * Sets the weather mode. Clears all effects when switching to dry or between rain/snow.
     */
    public setWeather(mode: WeatherMode): void {
        const prevMode = this.weatherMode;
        const wasPrecip = prevMode !== 'dry';
        const isPrecip = mode !== 'dry';

        this.weatherMode = mode;

        if (wasPrecip && !isPrecip) {
            this.clearParticles();
            this.stopRainSound();
        } else if (isPrecip) {
            const wasRain = isRain(prevMode);
            const wasSnow = isSnow(prevMode);
            const isRainNow = isRain(mode);
            const isSnowNow = isSnow(mode);
            if (wasPrecip && (wasRain !== isRainNow || wasSnow !== isSnowNow)) {
                this.clearParticles();
            }
            this.initializeParticles();
            if (isRainNow) {
                this.startRainSound();
            } else {
                this.stopRainSound();
            }
        }
    }

    /**
     * Updates precipitation particles and draws them. Call every frame from GameWorld.update().
     */
    public update(
        delta: number,
        scrollX: number,
        scrollY: number,
        viewWidth: number,
        viewHeight: number
    ): void {
        this.lastScrollX = scrollX;
        this.lastScrollY = scrollY;
        this.lastViewWidth = viewWidth;
        this.lastViewHeight = viewHeight;

        if (this.weatherMode === 'dry') {
            return;
        }

        this.updatePositions(delta);

        const now = this.scene.time.now;
        if (now - this.lastFrameUpdateTime >= FRAME_UPDATE_INTERVAL_MS) {
            this.lastFrameUpdateTime = now;
            this.updateParticleSteps();
        }

        this.drawParticles(scrollX, scrollY, viewWidth, viewHeight);
    }

    /**
     * Cleans up weather effects. Call from scene shutdown.
     */
    public destroy(): void {
        this.clearParticles();
        this.stopRainSound();
    }

    private getParticleCount(): number {
        switch (this.weatherMode) {
            case 'rain-light':
            case 'snow-light':
                return Math.floor(MAX_PARTICLES / 5);
            case 'rain-medium':
            case 'snow-medium':
                return Math.floor(MAX_PARTICLES / 2);
            case 'rain-heavy':
            case 'snow-heavy':
                return MAX_PARTICLES;
            default:
                return 0;
        }
    }

    /** Spawns a particle in a region covering the visible viewport plus margin */
    private spawnParticle(): { pixelX: number; pixelY: number } {
        return {
            pixelX: this.lastScrollX + Phaser.Math.Between(-SPAWN_MARGIN, this.lastViewWidth + SPAWN_MARGIN),
            pixelY: this.lastScrollY + Phaser.Math.Between(-400, this.lastViewHeight + SPAWN_MARGIN),
        };
    }

    private initializeParticles(): void {
        this.clearParticles();
        if (!this.scene.textures.exists(EFFECT2_TEXTURE_KEY)) {
            return;
        }

        const count = this.getParticleCount();
        const snow = isSnow(this.weatherMode);
        const initialFrame = snow ? SNOW_FRAME_START : RAIN_FALLING_FRAME_START;

        for (let i = 0; i < count; i++) {
            const { pixelX, pixelY } = this.spawnParticle();
            const step = -(i % 40);

            const sprite = this.scene.add.sprite(pixelX, pixelY, EFFECT2_TEXTURE_KEY, initialFrame);
            sprite.setDepth(HIGH_DEPTH);
            sprite.setVisible(false);

            this.particles.push({ pixelX, pixelY, step, sprite });
        }
    }

    private clearParticles(): void {
        for (const p of this.particles) {
            p.sprite.destroy();
        }
        this.particles = [];
    }

    /** Moves falling particles every frame for smooth motion */
    private updatePositions(delta: number): void {
        const snow = isSnow(this.weatherMode);
        const dy = snow ? SNOW_FALL_SPEED_Y * delta : RAIN_FALL_SPEED_Y * delta;
        const dx = snow ? 0 : RAIN_FALL_SPEED_X * delta;

        for (const p of this.particles) {
            if (snow) {
                if (p.step >= 0 && p.step < SNOW_FALL_STEPS) {
                    p.pixelY += dy;
                }
            } else {
                if (p.step >= 0 && p.step < RAIN_FALL_STEPS) {
                    p.pixelY += dy;
                    p.pixelX += dx;
                }
            }
        }
    }

    private updateParticleSteps(): void {
        const snow = isSnow(this.weatherMode);
        const respawnStep = snow ? SNOW_FALL_STEPS : 25;

        for (const p of this.particles) {
            p.step++;

            if (p.step >= respawnStep) {
                const pos = this.spawnParticle();
                p.pixelX = pos.pixelX;
                p.pixelY = pos.pixelY;
                p.step = -1 * Phaser.Math.Between(0, 10);
            }
        }
    }

    private drawParticles(
        scrollX: number,
        scrollY: number,
        viewWidth: number,
        viewHeight: number
    ): void {
        const snow = isSnow(this.weatherMode);

        for (const p of this.particles) {
            const screenX = p.pixelX - scrollX;
            const screenY = p.pixelY - scrollY;

            const inView =
                screenX >= -50 &&
                screenX <= viewWidth + 50 &&
                screenY >= -50 &&
                screenY <= viewHeight + 50;

            let visible: boolean;
            if (snow) {
                visible = inView && p.step >= 0 && p.step < SNOW_FALL_STEPS;
            } else {
                visible = inView && ((p.step >= 0 && p.step < RAIN_FALL_STEPS) || (p.step >= 20 && p.step <= RAIN_SPLASH_FRAME_END));
            }

            if (!visible) {
                p.sprite.setVisible(false);
                continue;
            }

            p.sprite.setPosition(p.pixelX, p.pixelY);
            p.sprite.setVisible(true);

            if (snow) {
                if (p.step >= 0 && p.step < SNOW_FALL_STEPS) {
                    const frame = SNOW_FRAME_START + Math.floor(p.step / 20) * 3 + (p.step % 3);
                    p.sprite.setFrame(Math.min(frame, 50));
                    p.sprite.setDepth(HIGH_DEPTH);
                }
            } else {
                if (p.step >= 0 && p.step < RAIN_FALL_STEPS) {
                    const frame = RAIN_FALLING_FRAME_START + Math.floor(p.step / 6);
                    p.sprite.setFrame(frame);
                    p.sprite.setDepth(HIGH_DEPTH);
                } else if (p.step >= 20 && p.step <= RAIN_SPLASH_FRAME_END) {
                    p.sprite.setFrame(p.step);
                    const worldY = convertPixelPosToWorldPos(p.pixelY);
                    p.sprite.setDepth(worldY * DEPTH_MULTIPLIER - 1);
                }
            }
        }
    }

    private startRainSound(): void {
        if (this.rainSoundId !== undefined) {
            return;
        }
        try {
            this.rainSoundId = this.soundManager.playInLoop(RAIN_SOUND);
        } catch (e) {
            console.warn('[WeatherManager] Could not play rain sound:', e);
        }
    }

    private stopRainSound(): void {
        if (this.rainSoundId !== undefined) {
            this.soundManager.stopSound(this.rainSoundId);
            this.rainSoundId = undefined;
        }
    }
}
