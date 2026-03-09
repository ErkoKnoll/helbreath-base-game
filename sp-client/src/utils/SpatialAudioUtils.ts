import { SpatialConfig } from './SoundManager';
import { MAX_SPATIAL_AUDIO_DISTANCE } from '../Config';

/**
 * Configuration for spatial audio calculation.
 */
interface SpatialAudioConfig {
    /** Source position X (world grid coordinates) */
    sourceX: number;
    /** Source position Y (world grid coordinates) */
    sourceY: number;
    /** Listener position X (world grid coordinates) */
    listenerX: number;
    /** Listener position Y (world grid coordinates) */
    listenerY: number;
    /** Maximum audible distance in grid cells (default: 20) */
    maxDistance?: number;
}

/**
 * Calculates spatial audio configuration (pan and volume) based on relative positions.
 * Uses the listener as the center point (pan = 0) and calculates pan/volume for the source.
 * 
 * @param config - Configuration with source and listener positions
 * @returns Spatial configuration with pan (-1 to 1) and distance volume (0 to 1)
 */
export function calculateSpatialAudio(config: SpatialAudioConfig): SpatialConfig {
    const maxDistance = config.maxDistance ?? MAX_SPATIAL_AUDIO_DISTANCE;
    
    // Calculate relative position (source relative to listener) for pan
    const dx = config.sourceX - config.listenerX;

    // Calculate distance
    const distance = Phaser.Math.Distance.Between(
        config.sourceX,
        config.sourceY,
        config.listenerX,
        config.listenerY
    );
    
    // Calculate pan based on horizontal offset (-1 = left, 0 = center, 1 = right)
    // Pan is based on X-axis offset, normalized to [-1, 1]
    // Clamp pan to reasonable range to avoid extreme values for distant sounds
    const panRange = MAX_SPATIAL_AUDIO_DISTANCE; // Grid cells for full pan range
    const pan = Phaser.Math.Clamp(dx / panRange, -1, 1);
    
    // Calculate distance-based volume attenuation
    // Linear falloff from 1.0 (at source) to 0.0 (at maxDistance)
    // Sounds are inaudible beyond maxDistance
    let distanceVolume = 1.0;
    if (distance > 0) {
        distanceVolume = Math.max(0, 1 - (distance / maxDistance));
        // Apply dramatic falloff curve (faster near edge, almost silent at max distance)
        distanceVolume = Math.pow(distanceVolume, 2.5);
    }
    
    // Apply 25% max volume for spatial sounds
    distanceVolume *= 0.25;
    
    return {
        pan,
        distanceVolume
    };
}
