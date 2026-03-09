import type { Scene } from 'phaser';
import { EventBus } from '../game/EventBus';
import { drawEffect } from './EffectUtils';
import { convertPixelPosToWorldPos } from './CoordinateUtils';
import type { Effect } from '../game/effects/Effect';
import type { SoundManager } from './SoundManager';
import type { CameraManager } from './CameraManager';
import type { PlayerConfirmSpellTargetEvent } from '../Types';
import {
    IN_UI_CAST_EFFECT,
    IN_UI_KILL_ALL_EFFECTS,
    PLAYER_CONFIRM_SPELL_TARGET,
    OUT_UI_CAST_READY,
    OUT_UI_CAST_REMOVED,
} from '../constants/EventNames';
import { Blizzard } from '../game/spells/Blizzard';
import { EarthShockWave } from '../game/spells/EarthShockWave';
import { BloodyShockWave } from '../game/spells/BloodyShockWave';
import { LightningBolt } from '../game/spells/LightningBolt';
import { LightningStrike } from '../game/spells/LightningStrike';
import { EnergyStrike } from '../game/spells/EnergyStrike';
import { EnergyBolt } from '../game/spells/EnergyBolt';
import { TripleEnergyBolt } from '../game/spells/TripleEnergyBolt';
import { FireBall } from '../game/spells/FireBall';
import { FireStrike } from '../game/spells/FireStrike';
import { MassFireStrike } from '../game/spells/MassFireStrike';
import { MeteorStrike } from '../game/spells/MeteorStrike';
import { EarthwormStrike } from '../game/spells/EarthwormStrike';
import { ArmorBreak } from '../game/spells/ArmorBreak';
import { FireWall } from '../game/spells/FireWall';
import { PoisonCloud } from '../game/spells/PoisonCloud';
import { IceStorm } from '../game/spells/IceStorm';
import { IceStrike } from '../game/spells/IceStrike';
import { MassIceStrike } from '../game/spells/MassIceStrike';
import { ChillWind } from '../game/spells/ChillWind';
import { MassChillWind } from '../game/spells/MassChillWind';
import { SpikeField } from '../game/spells/SpikeField';
import {
    SPELL_BLIZZARD_ID,
    SPELL_MASS_BLIZZARD_ID,
    SPELL_EARTH_SHOCK_WAVE_ID,
    SPELL_LIGHTNING_BOLT_ID,
    SPELL_LIGHTNING_STRIKE_ID,
    SPELL_MASS_LIGHTNING_STRIKE_ID,
    SPELL_ENERGY_STRIKE_ID,
    SPELL_ENERGY_BOLT_ID,
    SPELL_TRIPLE_ENERGY_BOLT_ID,
    SPELL_FIRE_BALL_ID,
    SPELL_FIRE_STRIKE_ID,
    SPELL_MASS_FIRE_STRIKE_ID,
    SPELL_FIRE_WALL_ID,
    SPELL_CHILL_WIND_ID,
    SPELL_MASS_CHILL_WIND_ID,
    SPELL_POISON_CLOUD_ID,
    SPELL_SPIKE_FIELD_ID,
    SPELL_ICE_STORM_ID,
    SPELL_ICE_STRIKE_ID,
    SPELL_MASS_ICE_STRIKE_ID,
    SPELL_METEOR_STRIKE_ID,
    SPELL_EARTHWORM_STRIKE_ID,
    SPELL_ARMOR_BREAK_ID,
    SPELL_BLOODY_SHOCK_WAVE_ID,
} from '../constants/Spells';
import { EFFECT_ICE_STRIKE_LARGE_SHARD } from '../constants/Effects';
import type { BlizzardConfig } from '../game/spells/Blizzard';
import type { BlizzardShardConfig } from '../game/spells/BlizzardShard';
import type { IceStrikeShardConfig } from '../game/spells/IceStrikeShard';

export interface CastManagerConfig {
    scene: Scene;
    soundManager: SoundManager;
    cameraManager: CameraManager | undefined;
    getPlayerWorldPos: () => { x: number; y: number } | undefined;
}

/**
 * Manages casting, tracking effects and spells, and cleanup.
 * Handles effect placement, spell execution on target confirm, and effect lifecycle.
 */
export class CastManager {
    private scene: Scene;
    private soundManager: SoundManager;
    private cameraManager: CameraManager | undefined;
    private getPlayerWorldPos: () => { x: number; y: number } | undefined;

    private pendingEffectKey: string | undefined = undefined;
    private pendingEffectInfiniteLoop = false;
    private castReady = false;
    private effects: Effect[] = [];

    private boundCastEffect: (data: { effectKey: string; infiniteLoop: boolean }) => void;
    private boundKillAllEffects: () => void;
    private boundConfirmSpellTarget: (data: PlayerConfirmSpellTargetEvent) => void;

    constructor(config: CastManagerConfig) {
        this.scene = config.scene;
        this.soundManager = config.soundManager;
        this.cameraManager = config.cameraManager;
        this.getPlayerWorldPos = config.getPlayerWorldPos;

        this.boundCastEffect = (data: { effectKey: string; infiniteLoop: boolean }) => this.handleCastEffect(data);
        this.boundKillAllEffects = () => this.handleKillAllEffects();
        this.boundConfirmSpellTarget = (data: PlayerConfirmSpellTargetEvent) => this.executeSpell(data);
    }

    public setupEventListeners(): void {
        EventBus.on(IN_UI_CAST_EFFECT, this.boundCastEffect);
        EventBus.on(IN_UI_KILL_ALL_EFFECTS, this.boundKillAllEffects);
        EventBus.on(PLAYER_CONFIRM_SPELL_TARGET, this.boundConfirmSpellTarget);
    }

    public destroyEventListeners(): void {
        EventBus.off(IN_UI_CAST_EFFECT);
        EventBus.off(IN_UI_KILL_ALL_EFFECTS);
        EventBus.off(PLAYER_CONFIRM_SPELL_TARGET);
    }

    public getPendingEffectKey(): string | undefined {
        return this.pendingEffectKey;
    }

    public getPendingEffectInfiniteLoop(): boolean {
        return this.pendingEffectInfiniteLoop;
    }

    public clearPendingEffect(): void {
        this.pendingEffectKey = undefined;
        this.pendingEffectInfiniteLoop = false;
        EventBus.emit(OUT_UI_CAST_REMOVED);
    }

    public getCastReady(): boolean {
        return this.castReady;
    }

    public setCastReady(value: boolean): void {
        this.castReady = value;
    }

    /**
     * Attempts to place a pending effect at the given world coordinates.
     * Returns true if an effect was placed, false otherwise.
     */
    public tryPlaceEffect(worldX: number, worldY: number): boolean {
        if (!this.pendingEffectKey) {
            return false;
        }

        const playerPos = this.getPlayerWorldPos();
        const effect = drawEffect(this.scene, worldX, worldY, this.pendingEffectKey, {
            soundManager: this.soundManager,
            playerWorldX: playerPos?.x,
            playerWorldY: playerPos?.y,
            infiniteLoop: this.pendingEffectInfiniteLoop,
            onDestroy: () => {
                const i = this.effects.indexOf(effect!);
                if (i !== -1) {
                    this.effects.splice(i, 1);
                }
            },
        });

        if (effect) {
            this.effects.push(effect);
            this.castReady = true;
            EventBus.emit(OUT_UI_CAST_REMOVED);
        }

        this.pendingEffectKey = undefined;
        this.pendingEffectInfiniteLoop = false;
        return !!effect;
    }

    /**
     * Returns an onEffectCreated callback for spells that create persistent effects.
     * Registers the effect and returns an unsubscribe function for cleanup.
     */
    public getOnEffectCreated(): (effect: Effect) => () => void {
        return (effect: Effect) => {
            this.effects.push(effect);
            return () => {
                const i = this.effects.indexOf(effect);
                if (i !== -1) {
                    this.effects.splice(i, 1);
                }
            };
        };
    }

    public killAllEffects(): void {
        console.log(`[CastManager] Killing all effects (${this.effects.length} total)`);
        const effectsToDestroy = [...this.effects];
        this.effects = [];
        for (const effect of effectsToDestroy) {
            effect.destroy();
        }
    }

    public destroy(): void {
        this.destroyEventListeners();
        if (this.pendingEffectKey) {
            EventBus.emit(OUT_UI_CAST_REMOVED);
        }
        this.pendingEffectKey = undefined;
        this.pendingEffectInfiniteLoop = false;
        this.killAllEffects();
    }

    private handleCastEffect(data: { effectKey: string; infiniteLoop: boolean }): void {
        this.pendingEffectKey = data.effectKey;
        this.pendingEffectInfiniteLoop = data.infiniteLoop;
        EventBus.emit(OUT_UI_CAST_READY);
    }

    private handleKillAllEffects(): void {
        this.killAllEffects();
    }

    private executeSpell(data: PlayerConfirmSpellTargetEvent): void {
        const playerPos = this.getPlayerWorldPos();
        const onEffectCreated = this.getOnEffectCreated();

        switch (data.spellId) {
            case SPELL_EARTH_SHOCK_WAVE_ID:
                new EarthShockWave(
                    this.scene,
                    data.originPixelX,
                    data.originPixelY,
                    data.targetPixelX,
                    data.targetPixelY,
                    {
                        duration: 400,
                        projectileSpeed: 1500,
                        emissionInterval: 20,
                        immobileEmissionInterval: 100,
                        cameraManager: this.cameraManager,
                    },
                    {
                        soundManager: this.soundManager,
                        playerWorldX: playerPos?.x,
                        playerWorldY: playerPos?.y,
                    }
                );
                break;
            case SPELL_BLOODY_SHOCK_WAVE_ID:
                new BloodyShockWave(
                    this.scene,
                    data.originPixelX,
                    data.originPixelY,
                    data.targetPixelX,
                    data.targetPixelY,
                    {
                        duration: 400,
                        emissionInterval: 20,
                        soundManager: this.soundManager,
                        playerWorldX: playerPos?.x,
                        playerWorldY: playerPos?.y,
                        cameraManager: this.cameraManager,
                    }
                );
                break;
            case SPELL_LIGHTNING_BOLT_ID:
                new LightningBolt(
                    this.scene,
                    data.originPixelX,
                    data.originPixelY,
                    data.targetPixelX,
                    data.targetPixelY,
                    {
                        arcDuration: 120,
                        arcPeriod: 20,
                        impactAnimationSpeed: 50,
                        soundManager: this.soundManager,
                        playerWorldX: playerPos?.x,
                        playerWorldY: playerPos?.y,
                        cameraManager: this.cameraManager,
                    }
                );
                break;
            case SPELL_LIGHTNING_STRIKE_ID:
                new LightningStrike(
                    this.scene,
                    data.originPixelX,
                    data.originPixelY,
                    data.targetPixelX,
                    data.targetPixelY,
                    {
                        strikeInterval: 120,
                        strikes: 5,
                        radius: 2,
                        lightningBoltConfig: {
                            arcDuration: 120,
                            arcPeriod: 20,
                            impactAnimationSpeed: 50,
                            soundManager: this.soundManager,
                            playerWorldX: playerPos?.x,
                            playerWorldY: playerPos?.y,
                            cameraManager: this.cameraManager,
                        },
                    }
                );
                break;
            case SPELL_MASS_LIGHTNING_STRIKE_ID:
                new LightningStrike(
                    this.scene,
                    data.originPixelX,
                    data.originPixelY,
                    data.targetPixelX,
                    data.targetPixelY,
                    {
                        strikeInterval: 50,
                        strikes: 12,
                        radius: 3,
                        lightningBoltConfig: {
                            arcDuration: 120,
                            arcPeriod: 20,
                            impactAnimationSpeed: 50,
                            soundManager: this.soundManager,
                            playerWorldX: playerPos?.x,
                            playerWorldY: playerPos?.y,
                            cameraManager: this.cameraManager,
                        },
                    }
                );
                break;
            case SPELL_ENERGY_STRIKE_ID:
                new EnergyStrike(
                    this.scene,
                    data.originPixelX,
                    data.originPixelY,
                    data.targetPixelX,
                    data.targetPixelY,
                    {
                        projectiles: 8,
                        emissionInterval: 80,
                        radius: 2,
                        projectileConfig: {
                            projectileSpeed: 2000,
                            soundManager: this.soundManager,
                            playerWorldX: playerPos?.x,
                            playerWorldY: playerPos?.y,
                            cameraManager: this.cameraManager,
                        },
                    }
                );
                break;
            case SPELL_ENERGY_BOLT_ID:
                new EnergyBolt(
                    this.scene,
                    data.originPixelX,
                    data.originPixelY,
                    convertPixelPosToWorldPos(data.targetPixelX),
                    convertPixelPosToWorldPos(data.targetPixelY),
                    {
                        projectileSpeed: 1500,
                        soundManager: this.soundManager,
                        playerWorldX: playerPos?.x,
                        playerWorldY: playerPos?.y,
                        cameraManager: this.cameraManager,
                    }
                );
                break;
            case SPELL_TRIPLE_ENERGY_BOLT_ID:
                new TripleEnergyBolt(
                    this.scene,
                    data.originPixelX,
                    data.originPixelY,
                    convertPixelPosToWorldPos(data.targetPixelX),
                    convertPixelPosToWorldPos(data.targetPixelY),
                    {
                        projectileSpeed: 1500,
                        soundManager: this.soundManager,
                        playerWorldX: playerPos?.x,
                        playerWorldY: playerPos?.y,
                        cameraManager: this.cameraManager,
                    }
                );
                break;
            case SPELL_FIRE_BALL_ID:
                new FireBall(
                    this.scene,
                    data.originPixelX,
                    data.originPixelY,
                    convertPixelPosToWorldPos(data.targetPixelX),
                    convertPixelPosToWorldPos(data.targetPixelY),
                    {
                        projectileSpeed: 1500,
                        soundManager: this.soundManager,
                        playerWorldX: playerPos?.x,
                        playerWorldY: playerPos?.y,
                        cameraManager: this.cameraManager,
                    }
                );
                break;
            case SPELL_FIRE_STRIKE_ID:
                new FireStrike(
                    this.scene,
                    data.originPixelX,
                    data.originPixelY,
                    convertPixelPosToWorldPos(data.targetPixelX),
                    convertPixelPosToWorldPos(data.targetPixelY),
                    {
                        projectileSpeed: 1500,
                        soundManager: this.soundManager,
                        playerWorldX: playerPos?.x,
                        playerWorldY: playerPos?.y,
                        cameraManager: this.cameraManager,
                    }
                );
                break;
            case SPELL_MASS_FIRE_STRIKE_ID:
                new MassFireStrike(
                    this.scene,
                    data.originPixelX,
                    data.originPixelY,
                    convertPixelPosToWorldPos(data.targetPixelX),
                    convertPixelPosToWorldPos(data.targetPixelY),
                    {
                        projectileSpeed: 1500,
                        soundManager: this.soundManager,
                        playerWorldX: playerPos?.x,
                        playerWorldY: playerPos?.y,
                        cameraManager: this.cameraManager,
                    }
                );
                break;
            case SPELL_FIRE_WALL_ID:
                new FireWall(
                    this.scene,
                    data.originPixelX,
                    data.originPixelY,
                    data.targetPixelX,
                    data.targetPixelY,
                    {
                        duration: 30000,
                        soundManager: this.soundManager,
                        playerWorldX: playerPos?.x,
                        playerWorldY: playerPos?.y,
                        onEffectCreated,
                    }
                );
                break;
            case SPELL_CHILL_WIND_ID:
                new ChillWind(this.scene, data.targetPixelX, data.targetPixelY, {
                    dropDistance: 200,
                    projectileSpeed: 1500,
                    soundManager: this.soundManager,
                    playerWorldX: playerPos?.x,
                    playerWorldY: playerPos?.y,
                });
                break;
            case SPELL_MASS_CHILL_WIND_ID:
                new MassChillWind(this.scene, data.targetPixelX, data.targetPixelY, {
                    dropDistance: 200,
                    projectileSpeed: 1500,
                    soundManager: this.soundManager,
                    playerWorldX: playerPos?.x,
                    playerWorldY: playerPos?.y,
                });
                break;
            case SPELL_POISON_CLOUD_ID:
                new PoisonCloud(this.scene, data.targetPixelX, data.targetPixelY, {
                    duration: 30000,
                    onEffectCreated,
                });
                break;
            case SPELL_SPIKE_FIELD_ID:
                new SpikeField(this.scene, data.targetPixelX, data.targetPixelY, {
                    duration: 30000,
                    onEffectCreated,
                });
                break;
            case SPELL_ICE_STORM_ID:
                new IceStorm(this.scene, data.targetPixelX, data.targetPixelY, {
                    duration: 30000,
                    onEffectCreated,
                });
                break;
            case SPELL_ICE_STRIKE_ID:
                this.createIceStrikeSpell(data.targetPixelX, data.targetPixelY);
                break;
            case SPELL_MASS_ICE_STRIKE_ID:
                this.createMassIceStrikeSpell(data.targetPixelX, data.targetPixelY);
                break;
            case SPELL_METEOR_STRIKE_ID:
                new MeteorStrike(
                    this.scene,
                    data.originPixelX,
                    data.originPixelY,
                    data.targetPixelX,
                    data.targetPixelY,
                    {
                        projectileSpeed: 1500,
                        soundManager: this.soundManager,
                        playerWorldX: playerPos?.x,
                        playerWorldY: playerPos?.y,
                        cameraManager: this.cameraManager,
                    }
                );
                break;
            case SPELL_EARTHWORM_STRIKE_ID:
                new EarthwormStrike(
                    this.scene,
                    data.originPixelX,
                    data.originPixelY,
                    data.targetPixelX,
                    data.targetPixelY,
                    {
                        soundManager: this.soundManager,
                        playerWorldX: playerPos?.x,
                        playerWorldY: playerPos?.y,
                        cameraManager: this.cameraManager,
                    }
                );
                break;
            case SPELL_ARMOR_BREAK_ID:
                new ArmorBreak(
                    this.scene,
                    data.originPixelX,
                    data.originPixelY,
                    data.targetPixelX,
                    data.targetPixelY,
                    {
                        soundManager: this.soundManager,
                        playerWorldX: playerPos?.x,
                        playerWorldY: playerPos?.y,
                    }
                );
                break;
            case SPELL_BLIZZARD_ID:
            case SPELL_MASS_BLIZZARD_ID:
                this.createBlizzardSpell(
                    data.originPixelX,
                    data.originPixelY,
                    data.targetPixelX,
                    data.targetPixelY,
                    data.spellId
                );
                break;
            default:
                break;
        }
        this.castReady = true;
    }

    private createBlizzardSpell(
        originPixelX: number,
        originPixelY: number,
        cursorPixelX: number,
        cursorPixelY: number,
        spellId: number
    ): void {
        const playerPos = this.getPlayerWorldPos();
        const shardConfig: BlizzardShardConfig = {
            dropDistanceMin: 300,
            dropDistanceMax: 500,
            dropSpeedMin: 200,
            dropSpeedMax: 500,
            fadeInDuration: 200,
            impactFadeOutDuration: 500,
            impactAnimationSpeed: 15,
            soundManager: this.soundManager,
            playerWorldX: playerPos?.x,
            playerWorldY: playerPos?.y,
            cameraManager: this.cameraManager,
        };

        const blizzardConfig: BlizzardConfig = {
            projectileSpeed: 300,
            emissionSteps: 10,
            startRadius: 1,
            endRadius: 3,
            startShards: 0,
            endShards: 10,
        };

        const massBlizzardConfig: BlizzardConfig = {
            ...blizzardConfig,
            endRadius: 6,
            endShards: 20,
        };

        switch (spellId) {
            case SPELL_BLIZZARD_ID:
                new Blizzard(
                    this.scene,
                    originPixelX,
                    originPixelY,
                    cursorPixelX,
                    cursorPixelY,
                    blizzardConfig,
                    shardConfig
                );
                break;
            case SPELL_MASS_BLIZZARD_ID:
                new Blizzard(
                    this.scene,
                    originPixelX,
                    originPixelY,
                    cursorPixelX,
                    cursorPixelY,
                    massBlizzardConfig,
                    shardConfig
                );
                break;
        }
    }

    private createIceStrikeSpell(targetPixelX: number, targetPixelY: number): void {
        const playerPos = this.getPlayerWorldPos();
        const shardConfig: IceStrikeShardConfig = {
            dropDistanceMin: 200,
            dropDistanceMax: 400,
            dropSpeedMin: 400,
            dropSpeedMax: 600,
            fadeInDuration: 50,
            impactFadeOutDuration: 500,
            impactAnimationSpeed: 15,
            shardEffectKey: EFFECT_ICE_STRIKE_LARGE_SHARD,
            soundManager: this.soundManager,
            playerWorldX: playerPos?.x,
            playerWorldY: playerPos?.y,
            cameraManager: this.cameraManager,
        };
        new IceStrike(this.scene, targetPixelX, targetPixelY, shardConfig);
    }

    private createMassIceStrikeSpell(targetPixelX: number, targetPixelY: number): void {
        const playerPos = this.getPlayerWorldPos();
        const shardConfig: IceStrikeShardConfig = {
            dropDistanceMin: 200,
            dropDistanceMax: 400,
            dropSpeedMin: 400,
            dropSpeedMax: 600,
            fadeInDuration: 50,
            impactFadeOutDuration: 500,
            impactAnimationSpeed: 15,
            shardEffectKey: EFFECT_ICE_STRIKE_LARGE_SHARD,
            soundManager: this.soundManager,
            playerWorldX: playerPos?.x,
            playerWorldY: playerPos?.y,
            cameraManager: this.cameraManager,
        };
        new MassIceStrike(this.scene, targetPixelX, targetPixelY, shardConfig);
    }
}
