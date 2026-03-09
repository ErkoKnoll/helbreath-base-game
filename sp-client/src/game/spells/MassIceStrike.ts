import type { Scene } from 'phaser';
import { IceStrikeShard } from './IceStrikeShard';
import type { IceStrikeShardConfig } from './IceStrikeShard';
import { EFFECT_ICE_STRIKE_LARGE_SHARD, EFFECT_ICE_STRIKE_SMALL_SHARD } from '../../constants/Effects';

/**
 * Mass Ice Strike spell. Spawns ice shards at the target location with larger spread:
 * 1 main shard at target center + 23 large shards scattered + 8 small shards scattered.
 */
export class MassIceStrike {
    private scene: Scene;
    private shardConfig: IceStrikeShardConfig;
    private targetPixelX: number;
    private targetPixelY: number;

    constructor(
        scene: Scene,
        targetPixelX: number,
        targetPixelY: number,
        shardConfig: IceStrikeShardConfig
    ) {
        this.scene = scene;
        this.shardConfig = shardConfig;
        this.targetPixelX = targetPixelX;
        this.targetPixelY = targetPixelY;

        this.spawnShards();
    }

    private spawnShards(): void {
        const { targetPixelX, targetPixelY } = this;

        const largeShardConfig: IceStrikeShardConfig = { ...this.shardConfig, shardEffectKey: EFFECT_ICE_STRIKE_LARGE_SHARD };
        const smallShardConfig: IceStrikeShardConfig = { ...this.shardConfig, shardEffectKey: EFFECT_ICE_STRIKE_SMALL_SHARD };

        // 1 main shard at target center
        new IceStrikeShard(this.scene, targetPixelX, targetPixelY, largeShardConfig);

        // 7 large shards scattered (larger diameter)
        for (let i = 0; i < 7; i++) {
            const offsetX = Phaser.Math.Between(-45, 65);
            const offsetY = Phaser.Math.Between(-50, 50);
            new IceStrikeShard(this.scene, targetPixelX + offsetX, targetPixelY + offsetY, largeShardConfig);
        }

        // 16 large shards scattered (larger diameter)
        for (let i = 0; i < 16; i++) {
            const offsetX = Phaser.Math.Between(-45, 65);
            const offsetY = Phaser.Math.Between(-50, 50);
            new IceStrikeShard(this.scene, targetPixelX + offsetX, targetPixelY + offsetY, largeShardConfig);
        }

        // 8 small shards scattered
        for (let i = 0; i < 8; i++) {
            const offsetX = Phaser.Math.Between(-40, 60);
            const offsetY = Phaser.Math.Between(-45, 45);
            new IceStrikeShard(this.scene, targetPixelX + offsetX, targetPixelY + offsetY, smallShardConfig);
        }
    }
}
