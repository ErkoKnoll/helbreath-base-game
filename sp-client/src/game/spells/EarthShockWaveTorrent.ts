import type { Scene } from 'phaser';
import { Effect } from '../effects/Effect';
import { getEffectByKey } from '../../constants/Effects';
import { EFFECT_EARTH_SHOCK_WAVE_TORRENT, EFFECT_EARTH_SHOCK_WAVE_DUST } from '../../constants/Effects';
import type { SoundManager } from '../../utils/SoundManager';

export type EarthShockWaveTorrentConfig = {
    soundManager?: SoundManager;
    playerWorldX?: number;
    playerWorldY?: number;
};

/**
 * Earth Shock Wave spell. Creates Earth Shock Wave Torrent and Earth Shock Wave Dust
 * effects at the given pixel coordinates.
 */
export class EarthShockWaveTorrent {
    private effects: Effect[] = [];

    constructor(
        scene: Scene,
        pixelX: number,
        pixelY: number,
        config?: EarthShockWaveTorrentConfig
    ) {
        const { soundManager, playerWorldX, playerWorldY } = config ?? {};

        const torrentConfig = getEffectByKey(EFFECT_EARTH_SHOCK_WAVE_TORRENT);
        const dustConfig = getEffectByKey(EFFECT_EARTH_SHOCK_WAVE_DUST);

        if (torrentConfig) {
            const torrentEffect = new Effect(scene, {
                config: torrentConfig,
                pixelX,
                pixelY,
                soundManager,
                playerWorldX,
                playerWorldY,
            });
            this.effects.push(torrentEffect);
        }

        if (dustConfig) {
            const dustEffect = new Effect(scene, {
                config: dustConfig,
                pixelX,
                pixelY,
                soundManager,
                playerWorldX,
                playerWorldY,
            });
            this.effects.push(dustEffect);
        }
    }

    public destroy(): void {
        for (const effect of this.effects) {
            effect.destroy();
        }
        this.effects = [];
    }
}
