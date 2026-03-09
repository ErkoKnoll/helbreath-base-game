import type { Scene } from 'phaser';
import { EnergyBolt } from './EnergyBolt';
import type { EnergyBoltConfig } from './EnergyBolt';

/** Target offsets from center (dX, dY): [(dX-1, dY-1), (dX+1, dY-1), (dX+1, dY+1)] */
const TRIPLE_BOLT_OFFSETS: [number, number][] = [
    [-1, -1],
    [1, -1],
    [1, 1],
];

export type TripleEnergyBoltConfig = EnergyBoltConfig;

/**
 * Triple Energy Bolt spell. Emits 3 EnergyBolts simultaneously to destinations
 * (dX-1, dY-1), (dX+1, dY-1), (dX+1, dY+1) relative to the target cell.
 */
export class TripleEnergyBolt {
    constructor(
        scene: Scene,
        originPixelX: number,
        originPixelY: number,
        targetWorldX: number,
        targetWorldY: number,
        config: TripleEnergyBoltConfig
    ) {
        for (const [offsetX, offsetY] of TRIPLE_BOLT_OFFSETS) {
            new EnergyBolt(
                scene,
                originPixelX,
                originPixelY,
                targetWorldX + offsetX,
                targetWorldY + offsetY,
                config
            );
        }
    }
}
