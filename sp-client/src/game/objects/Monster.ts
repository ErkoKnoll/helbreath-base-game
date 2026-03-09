import type { Scene } from 'phaser';
import { GameObject, GameObjectState } from './GameObject';
import type { GameAssetConfig } from './GameAsset';
import { AnimationType } from './GameAsset';
import { Direction, getDistance, getNextDirection } from '../../utils/CoordinateUtils';
import type { HBMap } from '../assets/HBMap';
import { ShadowManager } from '../../utils/ShadowManager';
import type { SoundManager } from '../../utils/SoundManager';
import type { MonsterStatesConfig, StateAnimationConfig } from '../../constants/Monsters';
import { getSpriteFrameHeight } from '../../utils/SpriteUtils';
import { MONSTER_CORPSE_FADE_ALPHA_STEP, MONSTER_DEFAULT_MOVEMENT_SPEED, MONSTER_DEFAULT_ATTACK_SPEED, DEFAULT_ANIMATION_FRAME_RATE, MONSTER_STUNLOCK_DURATION_MS } from '../../Config';
import { calculateSpatialAudio } from '../../utils/SpatialAudioUtils';
import type { Player } from './Player';
import { EventBus } from '../EventBus';
import { MONSTER_DEAD, MONSTER_ATTACK_HIT_PLAYER, PLAYER_DIED, IN_UI_PLAYER_RESURRECT } from '../../constants/EventNames';
import { TAKE_DAMAGE_BLADE } from '../../constants/SoundFileNames';
import { AttackType, MonsterAttackPlayerEvent } from '../../Types';
import { calculateAnimationDuration } from '../../utils/AnimationUtils';

/**
 * Monster animation states mapping to sprite sheet indexes.
 */
export enum MonsterState {
    /** Idle standing animation */
    Idle = 0,
    /** Moving animation */
    Move = 1,
    /** Attack animation */
    Attack = 2,
    /** Take damage animation (stationary) */
    TakeDamage = 3,
    /** Take damage animation while moving between cells */
    TakeDamageOnMove = 4,
    /** Death animation */
    Dead = 5,
    /** Take damage with knockback - plays TakeDamage animation while moving 1 cell away from attacker */
    TakeDamageWithKnockback = 6,
}

/**
 * Shadow display options for monsters.
 */
export enum MonsterShadow {
    /** No shadow displayed */
    NoShadow = 0,
    /** Body shadow displayed beneath the monster */
    BodyShadow = 1,
}

/**
 * Maps monster state to sprite sheet index base.
 * Idle uses spritesheets 0-7 (one per direction).
 * Move uses spritesheets 8-15 (one per direction).
 * Attack uses spritesheets 16-23 (one per direction).
 * TakeDamage/TakeDamageOnMove use spritesheets 24-31 (one per direction), duration matches MONSTER_STUNLOCK_DURATION_MS.
 * Dead uses spritesheets 32-39 (one per direction).
 */
const MONSTER_SPRITESHEET: Record<MonsterState, number> = {
    [MonsterState.Idle]: 0,  // Spritesheets 0-7 for idle
    [MonsterState.Move]: 8,  // Spritesheets 8-15 for movement
    [MonsterState.Attack]: 16, // Spritesheets 16-23 for attack
    [MonsterState.TakeDamage]: 24, // Spritesheets 24-31 for take damage
    [MonsterState.TakeDamageOnMove]: 24, // Same as TakeDamage
    [MonsterState.Dead]: 32, // Spritesheets 32-39 for death
    [MonsterState.TakeDamageWithKnockback]: 24, // Same as TakeDamage
};



/**
 * Configuration for creating a Monster instance.
 */
type MonsterConfig = {
    /** X coordinate in world map position */
    x: number;
    
    /** Y coordinate in world map position */
    y: number;
    
    /** Sprite name for the monster without extension (e.g., 'ettin') */
    spriteName: string;
    
    /** Display name shown in UI (e.g., 'Ettin', 'Dragon') */
    displayName: string;
    
    /** Direction the monster is facing (0-7) */
    direction: Direction;
    
    /** SoundManager instance for playing sound effects */
    soundManager: SoundManager;
    
    /** HBMap instance for collision checking */
    map: HBMap;
    
    /** State-specific configuration (sound and animation data) */
    states?: MonsterStatesConfig;
    
    /** Movement speed slider value (0-100) */
    movementSpeed?: number;
    
    /** Attack speed slider value (1-100) */
    attackSpeed?: number;
    
    /** Reference to the player for initial position setup */
    player?: Player;
    
    /** Whether the player is dead at creation time (prevents targeting dead player) */
    playerIsDead?: boolean;
    
    /** Follow distance in cells (if player is within this distance, monster will follow) */
    followDistance?: number;
    
    /** Attack distance in cells (if player is within this distance, monster will attack) */
    attackDistance?: number;
    
    /** Attack type: how damage affects the target (Interrupt, NoInterrupt, etc.) */
    attackType?: AttackType;
    
    /** Hit points and max hit points (defaults to 100 if not specified) */
    hp?: number;
    maxHp?: number;
    
    /** Attack damage (defaults to 30 if not specified) */
    attackDamage?: number;
    
    /** Time in seconds before corpse starts fading */
    corpseDecayTime: number;
    
    /** Unique monster ID */
    monsterId: number;
    
    /** Temporal coefficient controlling animation speed (defaults to 1.0) */
    temporalCoefficient?: number;
    
    /** Shadow display option (defaults to BodyShadow) */
    shadow?: MonsterShadow;
    
    /** Opacity/transparency of the monster sprite (defaults to 1.0, range 0.0-1.0) */
    opacity?: number;

    /** Transparency slider value 0-100 (0 = opaque, 100 = transparent). Applied at summon time only. Overrides opacity when provided. */
    transparency?: number;

    /** Chilled blue tint effect. Applied at summon time only. */
    chilledEffect?: boolean;

    /** When true, monster spawns ArrowProjectile toward player instead of dealing damage immediately. */
    bowAttack?: boolean;

    /** Berserk red overlay effect. Applied at summon time only. */
    berserkedEffect?: boolean;

    /** Estimated height of the monster in pixels. Used to position damage indicator above the monster. */
    height?: number;
};

/**
 * Represents a monster in the game.
 * Extends GameObject and defaults to Idle state with appropriate animations.
 */
export class Monster extends GameObject {
    /** Current animation state */
    private currentState: MonsterState;
    
    /** Sprite name for the monster */
    private monsterSpriteName: string;
    
    /** Display name shown in UI (e.g., 'Ettin', 'Dragon') */
    private displayName: string;
    
    /** State-specific configuration (sound and animation data) */
    private states?: MonsterStatesConfig;
    
    /** Frame rate for attack animations */
    /** Calculated from attack speed: 5 FPS (min/slow) to 30 FPS (max/fast) */
    private attackSpeedFrameRate: number;
    
    /** Frame rate for movement animations */
    /** Calculated dynamically based on movement speed and monster type */
    private movementFrameRate: number;
    
    /** Number of frames in movement animation (varies by monster type) */
    private movementFrameCount: number;
    
    /** Player's world X coordinate (updated via updatePlayerPosition) */
    private playerX: number = 0;
    
    /** Player's world Y coordinate (updated via updatePlayerPosition) */
    private playerY: number = 0;
    
    /** Whether the player is dead (updated via PLAYER_DIED event) */
    private isPlayerDead: boolean = false;
    
    /** Follow distance in cells (if player is within this distance, monster will follow) */
    private followDistance: number;
    
    /** Attack distance in cells (if player is within this distance, monster will attack) */
    private attackDistance: number;
    
    /** Attack type: how damage affects the target when monster hits player */
    private attackType: AttackType;
    
    /** Attack damage dealt */
    private attackDamage: number;

    /** When true, spawn ArrowProjectile toward player instead of dealing damage immediately */
    private bowAttack: boolean;
    
    /** Whether the monster is currently in attack animation */
    private isAttacking: boolean = false;
    
    /** Target destination for pathfinding (used for random wandering) */
    private targetDestinationX: number = -1;
    private targetDestinationY: number = -1;
    
    /** Whether the monster is marked for killing */
    private shouldKill: boolean = false;
    
    /** Whether the monster is in death animation */
    private isDead: boolean = false;
    
    /** Time in seconds before corpse starts fading */
    private corpseDecayTime: number = 0;
    
    /** Time elapsed since death animation started (in seconds) */
    private deathElapsedTime: number = 0;
    
    /** Whether the corpse decay timer has started */
    private isDecayTimerActive: boolean = false;
    
    /** Current alpha/opacity value for fade out (0-255 range) */
    private currentAlpha: number = 255;
    
    /** Unique monster ID */
    private monsterId: number = -1;

    /** Temporal coefficient controlling animation speed (defaults to 1.0) */
    private temporalCoefficient: number = 1.0;

    /**
     * Creates a new Monster instance.
     * 
     * @param scene - The Phaser scene to add the monster to
     * @param config - Configuration object with position, sprite, direction, and dependencies
     */
    constructor(scene: Scene, config: MonsterConfig) {
        const movementSpeed = config.movementSpeed ?? MONSTER_DEFAULT_MOVEMENT_SPEED;
        const attackSpeed = config.attackSpeed ?? MONSTER_DEFAULT_ATTACK_SPEED;
        const temporalCoefficient = config.temporalCoefficient ?? 1.0;
        const alpha = config.transparency !== undefined
            ? 1 - config.transparency / 100
            : (config.opacity ?? 1.0);
        
        // Calculate initial spriteSheetIndex for monster sprite based on direction
        const initialSpriteSheetIndex = MONSTER_SPRITESHEET[MonsterState.Idle] + config.direction;
        
        // Get idle animation frame count from config (if specified) to adjust frame rate
        // Standard idle has 8 frames, so scale proportionally
        const idleAnimationFrames = config.states?.idle?.animation?.animationFrames ?? 8;
        const idleFrameRate = DEFAULT_ANIMATION_FRAME_RATE * (idleAnimationFrames / 8) * temporalCoefficient;
        
        // Build the GameAsset configuration for the monster
        const assetConfigs: Omit<GameAssetConfig, 'x' | 'y'>[] = [
            {
                spriteName: config.spriteName,
                spriteSheetIndex: initialSpriteSheetIndex,
                // For monster sprite, spriteSheetIndex already encodes the direction (0-7 for idle)
                // So we always use direction 0 when creating, as the spriteSheetIndex itself represents the direction
                direction: 0,
                // Apply frame count adjustment and temporalCoefficient to initial Idle animation frame rate
                frameRate: idleFrameRate,
                // Apply opacity/transparency to the sprite
                alpha,
                onAnimationFrameChange: (relativeFrameIndex: number) => {
                    if (this.currentState === MonsterState.Attack && relativeFrameIndex === 2) {
                        EventBus.emit(MONSTER_ATTACK_HIT_PLAYER, { monsterId: this.monsterId, attackType: this.attackType, attackDamage: this.attackDamage, bowAttack: this.bowAttack } satisfies MonsterAttackPlayerEvent);
                    }
                    if ((this.currentState === MonsterState.TakeDamage || this.currentState === MonsterState.TakeDamageOnMove || this.currentState === MonsterState.TakeDamageWithKnockback) && relativeFrameIndex === 4) {
                        const spatialConfig = this.calculateSpatialConfig();
                        this.soundTracker.playOnceUntracked(TAKE_DAMAGE_BLADE, spatialConfig);
                    }
                },
            },
        ];

        super(scene, {
            x: config.x,
            y: config.y,
            assets: assetConfigs,
            soundManager: config.soundManager,
            map: config.map,
            stunlockDurationMs: MONSTER_STUNLOCK_DURATION_MS,
        });
        
        this.monsterSpriteName = config.spriteName;
        this.displayName = config.displayName;
        this.states = config.states;
        this.hp = config.hp ?? 100;
        this.maxHp = config.maxHp ?? 100;
        this.direction = config.direction;
        this.currentState = MonsterState.Idle;
        this.followDistance = config.followDistance ?? 0;
        this.attackDistance = config.attackDistance ?? 0;
        this.attackType = config.attackType ?? AttackType.Interrupt;
        this.attackDamage = config.attackDamage ?? 30;
        this.bowAttack = config.bowAttack ?? false;
        this.corpseDecayTime = config.corpseDecayTime;
        this.monsterId = config.monsterId;
        this.temporalCoefficient = config.temporalCoefficient ?? 1.0;
        this.height = config.height ?? getSpriteFrameHeight(scene, config.spriteName, 0, 0);

        // Disable auto-switch to Idle state - Monster AI will manage state transitions
        this.autoSwitchToIdle = false;
        
        // Initialize player position from player reference if available
        if (config.player) {
            this.playerX = config.player.getWorldX();
            this.playerY = config.player.getWorldY();
        }

        this.isPlayerDead = config.playerIsDead ?? false;

        EventBus.on(PLAYER_DIED, this.onPlayerDied);
        EventBus.on(IN_UI_PLAYER_RESURRECT, this.onPlayerResurrect);
        
        // Calculate frame rate based on attack speed
        this.attackSpeedFrameRate = 5 + (attackSpeed / 100) * (30 - 5);
        
        // Set movement speed for GameObject
        this.movementSpeed = movementSpeed;
        this.movementSpeedDurationMs = 1000 - (movementSpeed / 100) * (1000 - 200); // 200ms (min/slow) to 1000ms (max/fast)
        
        // Determine movement frame count from config (this will use getStateAnimationConfig)
        this.movementFrameCount = this.getMovementFrameCount();
        
        // Calculate movement frame rate (will be used to derive animation duration)
        // Note: This is a base calculation, actual frame rate is calculated dynamically in getAnimationFrameRate
        const movementDurationSeconds = this.movementSpeedDurationMs / 1000;
        this.movementFrameRate = this.movementFrameCount / movementDurationSeconds;
        
        // Create shadow manager only if BodyShadow is specified (default behavior)
        const shadowOption = config.shadow ?? MonsterShadow.BodyShadow;
        if (shadowOption === MonsterShadow.BodyShadow) {
            const initialShadowSpriteSheetIndex = MONSTER_SPRITESHEET[MonsterState.Idle] + config.direction;
            this.shadowManager = new ShadowManager({
                scene,
                shadowSpriteName: config.spriteName,
                shadowSpriteSheetIndex: initialShadowSpriteSheetIndex,
                worldX: config.x,
                worldY: config.y,
                frameRate: idleFrameRate,
            });
        }
        
        // Center the monster in the initial cell
        this.updatePixelPosition();

        // Apply chilled and berserked effects at summon time (from MonsterDialog)
        if (config.chilledEffect || config.berserkedEffect) {
            for (const asset of this.assets) {
                if (config.chilledEffect) {
                    asset.setChilledTint(true);
                }
                if (config.berserkedEffect) {
                    asset.setBerserkOverlay(true);
                }
            }
        }
    }
    
    
    /**
     * Gets the frame count for movement animations.
     * Uses state config if available, otherwise falls back to legacy logic.
     * 
     * @returns Number of frames in movement animation
     */
    private getMovementFrameCount(): number {
        const config = this.getStateAnimationConfig(MonsterState.Move);
        return config.animationFrames;
    }
    
    /**
     * Gets the frame count for attack animations.
     * Uses state config if available, otherwise falls back to legacy logic.
     * 
     * @returns Number of frames in attack animation
     */
    private getAttackFrameCount(): number {
        const config = this.getStateAnimationConfig(MonsterState.Attack);
        return config.animationFrames;
    }
    
    /**
     * Gets the frame count for death animations.
     * Uses state config if available, otherwise defaults to 8 frames.
     * 
     * @returns Number of frames in death animation
     */
    private getDeathFrameCount(): number {
        const config = this.getStateAnimationConfig(MonsterState.Dead);
        return config.animationFrames;
    }
    
    /**
     * Gets the animation configuration for a specific state.
     * Returns configured values or defaults if not specified.
     * 
     * @param state - The monster state
     * @returns Animation configuration with defaults applied
     */
    private getStateAnimationConfig(state: MonsterState): Required<StateAnimationConfig> {
        let stateConfig: StateAnimationConfig | undefined;
        
        // Get state-specific config if available
        if (this.states) {
        switch (state) {
            case MonsterState.Idle:
                stateConfig = this.states.idle?.animation;
                break;
            case MonsterState.Move:
                stateConfig = this.states.move?.animation;
                break;
            case MonsterState.Attack:
                stateConfig = this.states.attack?.animation;
                break;
            case MonsterState.TakeDamage:
            case MonsterState.TakeDamageOnMove:
            case MonsterState.TakeDamageWithKnockback:
                stateConfig = this.states.takeDamage?.animation;
                break;
            case MonsterState.Dead:
                stateConfig = this.states.death?.animation;
                break;
        }
        }
        
        // Apply defaults (TakeDamage/TakeDamageOnMove use fixed config)
        const defaults: Required<StateAnimationConfig> =
            state === MonsterState.TakeDamage || state === MonsterState.TakeDamageOnMove || state === MonsterState.TakeDamageWithKnockback
                ? {
                    startSpriteSheet: 24,
                    startAnimationFrame: 0,
                    animationFrames: 8,
                    spriteName: this.monsterSpriteName,
                }
                : {
                    startSpriteSheet: MONSTER_SPRITESHEET[state],
                    startAnimationFrame: 0,
                    animationFrames: 8,
                    spriteName: this.monsterSpriteName,
                };

        return {
            startSpriteSheet: stateConfig?.startSpriteSheet ?? defaults.startSpriteSheet,
            startAnimationFrame: stateConfig?.startAnimationFrame ?? defaults.startAnimationFrame,
            animationFrames: stateConfig?.animationFrames ?? defaults.animationFrames,
            spriteName: stateConfig?.spriteName ?? defaults.spriteName,
        };
    }
    
    /**
     * Gets the sound file name for a specific state.
     * 
     * @param state - The monster state
     * @returns Sound file name or undefined if not configured
     */
    private getStateSound(state: MonsterState): string | undefined {
        if (!this.states) {
            return undefined;
        }
        
        switch (state) {
            case MonsterState.Move:
                return this.states.move?.sound;
            case MonsterState.Attack:
                return this.states.attack?.sound;
            case MonsterState.TakeDamage:
            case MonsterState.TakeDamageOnMove:
            case MonsterState.TakeDamageWithKnockback:
                return this.states.takeDamage?.sound;
            case MonsterState.Dead:
                return this.states.death?.sound;
            default:
                return undefined;
        }
    }
    
    /**
     * Picks a random movable location on the map.
     * 
     * @returns Random movable coordinates or undefined if no movable location found
     */
    private pickRandomMovableLocation(): { x: number; y: number } | undefined {
        const maxAttempts = 50;
        
        for (let i = 0; i < maxAttempts; i++) {
            const randomX = Phaser.Math.Between(0, this.map.sizeX - 1);
            const randomY = Phaser.Math.Between(0, this.map.sizeY - 1);
            
            const tile = this.map.getTile(randomX, randomY);
            if (tile && tile.isMoveAllowed) {
                return { x: randomX, y: randomY };
            }
        }
        
        return undefined;
    }
    
    /**
     * Calculates the distance between the monster and player in cells.
     * Uses Chebyshev distance (max of absolute differences in x and y).
     * 
     * @returns Distance in cells
     */
    private getDistanceToPlayer(): number {
        return getDistance(this.worldX, this.worldY, this.playerX, this.playerY);
    }
    
    /**
     * Checks if the monster should attack the player.
     * Returns true if player is within attack distance, player is alive, and monster is not already attacking.
     */
    private shouldAttack(): boolean {
        if (this.attackDistance === 0 ||
            this.isAttacking ||
            this.isPlayerDead) {
            return false;
        }
        
        const distanceToPlayer = this.getDistanceToPlayer();
        return distanceToPlayer <= this.attackDistance;
    }
    
    /**
     * Initiates an attack animation towards the player.
     * Calculates direction to player and plays attack animation.
     */
    private startAttack(): void {
        // Cancel any movement destination so monster doesn't continue moving after attack
        this.cancelMovement();
        
        // Calculate direction to player using stored coordinates
        const attackDirection = getNextDirection(this.worldX, this.worldY, this.playerX, this.playerY);
        
        // Update direction if it changed
        if (attackDirection !== Direction.None && attackDirection !== this.direction) {
            this.direction = attackDirection;
        }
        
        // Mark as attacking
        this.isAttacking = true;
        
        // Switch to attack animation first (stops any playing sounds, e.g. movement one-shot)
        this.switchMonsterState(MonsterState.Attack, true);
        
        // Play attack sound once per attack with spatial audio and animation duration based on attack speed
        const attackSound = this.getStateSound(MonsterState.Attack);
        if (attackSound) {
            const spatialConfig = this.calculateSpatialConfig();
            const attackFrameCount = this.getAttackFrameCount();
            const effectiveAttackFrameRate = this.attackSpeedFrameRate * this.temporalCoefficient;
            const attackAnimationDuration = calculateAnimationDuration(attackFrameCount, effectiveAttackFrameRate);
            this.soundTracker.playOnce(attackSound, attackAnimationDuration, spatialConfig, MonsterState.Attack);
        }
    }
    
    /**
     * Marks the monster for killing. The death animation will start
     * when the monster is not mid-cell (has finished current movement).
     */
    public kill(): void {
        this.shouldKill = true;
    }
    
    /**
     * Starts the death animation sequence.
     * Frees the occupied cell, stops all movement and sounds,
     * sets GameObject to Idle and Monster to Dead state.
     */
    private startDeathAnimation(): void {
        // Free the occupied cell immediately when kill cycle starts
        this.markCurrentTileFree();
        
        // Cancel any movement
        this.cancelMovement();
        
        // Stop all sounds
        this.soundTracker.stopAllSounds();
        
        // Play death sound once with spatial audio and animation duration based on death animation
        const deathSound = this.getStateSound(MonsterState.Dead);
        if (deathSound) {
            const spatialConfig = this.calculateSpatialConfig();
            this.soundTracker.playOnce(deathSound, undefined, spatialConfig);
        }
        
        // Destroy shadow manager - shadows no longer necessary once death animation starts
        if (this.shadowManager) {
            this.shadowManager.destroy();
            this.shadowManager = undefined;
        }
        
        // Mark as dead
        this.isDead = true;
        this.isAttacking = false;
        
        // Set GameObject to Idle (not moving)
        // but Monster to Dead state for animation
        this.isMoving = false;
        this.moveReady = true;
        
        // Switch to death animation
        this.switchMonsterState(MonsterState.Dead);
        
        // Reset death timer
        this.deathElapsedTime = 0;
        this.isDecayTimerActive = false;
        this.currentAlpha = 255;
    }
    
    /**
     * Returns true if the monster is in dead state (death animation or corpse).
     */
    public getIsDead(): boolean {
        return this.isDead;
    }

    /**
     * Returns the display name of the monster (e.g. "Ettin", "Dragon").
     */
    public getDisplayName(): string {
        return this.displayName;
    }

    /**
     * Overrides GameObject.announceDeath. When hp drops below 1, switches to Dead state.
     */
    protected override announceDeath(): void {
        this.startDeathAnimation();
    }

    /**
     * Takes damage: when attackType is Interrupt, cancels idle and attack states immediately, plays TakeDamage animation once.
     * When attackType is InterruptKnockback, knocks back 1 cell away from player (if cell is movable).
     * When attackType is NoInterrupt, no state change occurs.
     *
     * @param damage - Damage amount to subtract from hp (default: 30)
     * @param attackType - Interrupt to cancel attack and play take damage; InterruptKnockback to also knock back; NoInterrupt to skip
     */
    public takeDamage(damage: number = 30, attackType?: AttackType): void {
        if (this.isDead || this.shouldKill) {
            return;
        }

        this.acceptDamage(damage);
        if (attackType === AttackType.NoInterrupt) {
            return;
        }
        
        if (this.isDead || this.shouldKill) {
            return;
        }

        if (attackType === AttackType.InterruptKnockback) {
            this.applyKnockbackDamage();
            return;
        }

        // Interrupt: cancel idle and attack states and their animations immediately
        this.isAttacking = false;
        this.soundTracker.stopSound(MonsterState.Attack);

        if (this.isMoving) {
            this.switchMonsterState(MonsterState.TakeDamageOnMove, true);
        } else {
            this.switchMonsterState(MonsterState.TakeDamage, true);
        }
    }

    /**
     * Applies knockback damage: cancels current state, moves monster 1 cell away from player.
     * If knockback destination is not movable, falls back to regular TakeDamage or TakeDamageOnMove.
     */
    private applyKnockbackDamage(): void {
        if (this.currentState === MonsterState.TakeDamageWithKnockback) {
            return;
        }

        this.isAttacking = false;
        this.soundTracker.stopSound(MonsterState.Attack);

        const destination = this.computeKnockbackDestination(this.playerX, this.playerY);
        if (!destination) {
            if (this.isMoving) {
                this.switchMonsterState(MonsterState.TakeDamageOnMove, true);
            } else {
                this.switchMonsterState(MonsterState.TakeDamage, true);
            }
            return;
        }

        this.applyKnockbackMovement(destination.destX, destination.destY);
        this.switchMonsterState(MonsterState.TakeDamageWithKnockback, true);
    }

    /**
     * Gets the monster's unique ID.
     * @returns The monster's ID
     */
    public getMonsterId(): number {
        return this.monsterId;
    }

    /**
     * Gets the monster's attack damage.
     */
    public getAttackDamage(): number {
        return this.attackDamage;
    }

    /**
     * Gets the monster's movement speed slider value (0-100).
     */
    public getMovementSpeed(): number {
        return this.movementSpeed;
    }

    /**
     * Gets the monster's attack speed slider value (1-100).
     * Derived from attackSpeedFrameRate: 5 + (attackSpeed/100)*25.
     */
    public getAttackSpeed(): number {
        return Math.round(((this.attackSpeedFrameRate - 5) / 25) * 100);
    }

    /**
     * Gets the monster's follow distance in cells.
     */
    public getFollowDistance(): number {
        return this.followDistance;
    }

    /**
     * Gets the monster's attack distance in cells.
     */
    public getAttackDistance(): number {
        return this.attackDistance;
    }

    /**
     * Gets the monster's attack type.
     */
    public getAttackType(): AttackType {
        return this.attackType;
    }
    
    /**
     * Evaluates the monster's AI state and makes decisions.
     * Called when monster is ready to make the next action.
     */
    private evaluateAI(): void {
        if (this.isDead || this.shouldKill ||
            this.isMoving || this.isAttacking ||
            this.currentState === MonsterState.TakeDamage || this.currentState === MonsterState.TakeDamageOnMove ||
            this.currentState === MonsterState.TakeDamageWithKnockback ||
            this.isStunlocked()) {
            return;
        }

        // If movement speed is 0, monster should remain idle at all times
        if (this.movementSpeed === 0) {
            // Switch to Idle if not already
            if (this.currentState !== MonsterState.Idle) {
                this.switchMonsterState(MonsterState.Idle);
            }
            return;
        }
        
        // Priority 1: Check if player is in attack range
        if (this.shouldAttack()) {
            this.startAttack();
            return;
        }
        
        // Priority 2: Check if player is in follow range (and player is alive)
        if (this.followDistance > 0 && !this.isPlayerDead) {
            const distanceToPlayer = this.getDistanceToPlayer();
            
            if (distanceToPlayer <= this.followDistance) {
                // Move one cell towards player using stored coordinates
                this.moveOneStepTowards(this.playerX, this.playerY);
                return;
            }
        }
        
        // Priority 3: Random wandering (if movement speed > 0)
        // Check if we have a target destination, if not or reached it, pick a new one
        if (this.targetDestinationX === -1 || this.targetDestinationY === -1 ||
            (this.worldX === this.targetDestinationX && this.worldY === this.targetDestinationY)) {
            // Pick a new random destination
            const destination = this.pickRandomMovableLocation();
            if (destination) {
                this.targetDestinationX = destination.x;
                this.targetDestinationY = destination.y;
            }
        }
        
        // Move one step towards target destination
        if (this.targetDestinationX !== -1 && this.targetDestinationY !== -1) {
            this.moveOneStepTowards(this.targetDestinationX, this.targetDestinationY);
        } else {
            // No movement action taken - switch to Idle if not already
            if (this.currentState !== MonsterState.Idle) {
                this.switchMonsterState(MonsterState.Idle);
            }
        }
    }
    
    /**
     * Overrides move to play movement sound at the start of each step.
     * Uses playOnce (not looping) to avoid artifacts when stopping at cell boundaries.
     */
    protected override move(direction: Direction): void {
        super.move(direction);
        const moveSound = this.getStateSound(MonsterState.Move);
        if (moveSound) {
            const spatialConfig = this.calculateSpatialConfig();
            const movementFrameCount = this.getMovementFrameCount();
            const effectiveMovementFrameRate = this.movementFrameRate * this.temporalCoefficient;
            const movementAnimationDuration = calculateAnimationDuration(movementFrameCount, effectiveMovementFrameRate);
            this.soundTracker.playOnce(moveSound, movementAnimationDuration, spatialConfig);
        }
    }

    /**
     * Moves one step towards the specified destination using pathfinding.
     * 
     * @param targetX - Target X coordinate in world grid
     * @param targetY - Target Y coordinate in world grid
     */
    private moveOneStepTowards(targetX: number, targetY: number): void {
        // Calculate direction to target
        const direction = getNextDirection(this.worldX, this.worldY, targetX, targetY);
        
        if (direction === Direction.None) {
            return;
        }
        
        // Check if we can move in that direction
        if (!this.canMove(direction)) {
            // Try to find an alternative direction using pathfinding logic
            const alternativeDirection = this.findNextMovableDirection(direction);
            if (alternativeDirection === Direction.None) {
                // Can't move anywhere, clear target destination if it was random wandering
                if (this.targetDestinationX !== -1 && this.targetDestinationY !== -1) {
                    this.targetDestinationX = -1;
                    this.targetDestinationY = -1;
                }
                return;
            }
            this.move(alternativeDirection);
        } else {
            this.move(direction);
        }
    }
    
    /**
     * Updates the shadow sprite animation based on current state and direction.
     * Syncs shadow frame with monster frame when switching states to prevent flicker.
     */
    private updateShadow(): void {
        if (!this.shadowManager) {
            return;
        }
        
        // Get animation configuration for current state
        const animConfig = this.getStateAnimationConfig(this.currentState);
        
        // Calculate shadow spritesheet index using config
        const shadowSpriteSheetIndex = animConfig.startSpriteSheet + this.direction;
        
        // Update shadow animation with appropriate frame rate
        const animationFrameRate = this.getAnimationFrameRate(this.currentState);
        
        // For attack, death, and take damage animations, play once (repeat: 0). For other states, use default (loop)
            const repeat = (this.currentState === MonsterState.Attack || this.currentState === MonsterState.Dead ||
            this.currentState === MonsterState.TakeDamage || this.currentState === MonsterState.TakeDamageOnMove ||
            this.currentState === MonsterState.TakeDamageWithKnockback) ? 0 : undefined;
        
        // Get monster's current frame to keep shadow in sync - prevents flicker when switching
        // between Idle and Move (monster may preserve frame but shadow was resetting to 0)
        const relativeFrame = this.assets.length > 0 ? this.assets[0].getCurrentRelativeFrame() : undefined;
        const playFromFrame = relativeFrame !== undefined
            ? animConfig.startAnimationFrame + relativeFrame
            : undefined;
        
        // Use config-driven shadow animation
        if (animConfig.startAnimationFrame > 0 || animConfig.animationFrames !== 8) {
            // Custom frame configuration - specify start and end frames
            const startFrame = animConfig.startAnimationFrame;
            const endFrame = animConfig.startAnimationFrame + animConfig.animationFrames - 1;
            this.shadowManager.updateAnimation(shadowSpriteSheetIndex, animationFrameRate, repeat, startFrame, endFrame, playFromFrame);
        } else {
            // Standard 8 frames starting at 0 - use simplified call
            this.shadowManager.updateAnimation(shadowSpriteSheetIndex, animationFrameRate, repeat, undefined, undefined, playFromFrame);
        }
    }
    
    /**
     * Calculates spatial audio configuration relative to player position.
     * 
     * @returns Spatial configuration based on stored player coordinates
     */
    private calculateSpatialConfig() {
        return calculateSpatialAudio({
            sourceX: this.worldX,
            sourceY: this.worldY,
            listenerX: this.playerX,
            listenerY: this.playerY,
        });
    }
    
    /**
     * Updates sound effects based on the monster's state.
     * 
     * @param newState - The new MonsterState to update sounds for
     */
    private updateSound(newState: MonsterState): void {
        if (newState === MonsterState.TakeDamage || newState === MonsterState.TakeDamageOnMove ||
            newState === MonsterState.TakeDamageWithKnockback) {
            this.soundTracker.stopSound(MonsterState.Attack);
            const takeDamageSound = this.getStateSound(MonsterState.TakeDamage);
            if (takeDamageSound) {
                const spatialConfig = this.calculateSpatialConfig();
                this.soundTracker.playOnce(takeDamageSound, undefined, spatialConfig);
            }
        }
        // Movement sound is played in move() override at the start of each step
    }
    
    /**
     * Updates the stored player position and conditionally updates spatial audio.
     * Should be called when the player position changes.
     * 
     * @param playerX - Player's world X coordinate
     * @param playerY - Player's world Y coordinate
     */
    public updatePlayerPosition(playerX: number, playerY: number): void {
        // Store player coordinates
        this.playerX = playerX;
        this.playerY = playerY;
        
        // Movement sound is now playOnce per step; no spatial config updates needed
    }
    
    /**
     * Gets the animation frame rate for the given state.
     * Frame rates are multiplied by temporalCoefficient to control animation speed.
     * For Move state, calculates frame rate to match movement duration for smooth sync.
     * 
     * @param state - The MonsterState to get the frame rate for
     * @returns The frame rate for the given state, multiplied by temporalCoefficient
     */
    private getAnimationFrameRate(state: MonsterState): number {
        let baseFrameRate: number;
        const animConfig = this.getStateAnimationConfig(state);
        
        switch (state) {
            case MonsterState.Move:
                // Calculate frame rate to match movement duration
                // Frame rate = frames / (duration in seconds)
                // Use config to get frame count (varies by monster, typically 5-8 frames)
                const movementDurationSeconds = this.movementSpeedDurationMs / 1000;
                baseFrameRate = animConfig.animationFrames / movementDurationSeconds;
                break;
            case MonsterState.Attack:
                // Adjust attack frame rate based on frame count ratio
                // Standard attack has 8 frames, so scale proportionally
                // E.g., 4 frames should play at half the speed to take the same time
                baseFrameRate = this.attackSpeedFrameRate * (animConfig.animationFrames / 8);
                break;
            case MonsterState.TakeDamage:
            case MonsterState.TakeDamageOnMove:
                // Match animation duration to stunlock duration (500ms)
                baseFrameRate = animConfig.animationFrames / (MONSTER_STUNLOCK_DURATION_MS / 1000);
                break;
            case MonsterState.TakeDamageWithKnockback: {
                // Match animation duration to stunlock so take damage animation finishes before Idle transition
                const takeDamageConfig = this.getStateAnimationConfig(MonsterState.TakeDamageWithKnockback);
                baseFrameRate = takeDamageConfig.animationFrames / (MONSTER_STUNLOCK_DURATION_MS / 1000);
                break;
            }
            case MonsterState.Dead:
                // Adjust death frame rate based on frame count ratio
                // Standard death has 8 frames, so scale proportionally
                baseFrameRate = DEFAULT_ANIMATION_FRAME_RATE * (animConfig.animationFrames / 8);
                break;
            case MonsterState.Idle:
            default:
                // Adjust idle frame rate based on frame count ratio
                // Standard idle has 8 frames, so scale proportionally
                baseFrameRate = DEFAULT_ANIMATION_FRAME_RATE * (animConfig.animationFrames / 8);
                break;
        }
        return baseFrameRate * this.temporalCoefficient;
    }
    
    /**
     * Switches the monster's animation state.
     * Updates the asset to use the new sprite sheet index corresponding to the state.
     * Preserves the current direction and continues playing the animation from the same relative frame
     * (except for Attack and Dead states which always start from frame 0).
     * 
     * @param newState - The new MonsterState to switch to
     * @param forceUpdate - If true, updates animation even if state hasn't changed (for direction changes)
     */
    private switchMonsterState(newState: MonsterState, forceUpdate: boolean = false): void {
        // Don't switch if already in this state unless forceUpdate is true
        if (this.currentState === newState && !forceUpdate) {
            return;
        }
        
        // Handle sound switching based on new state
        this.updateSound(newState);
        
        // Get the current relative frame position from the asset
        // Attack, Death, and TakeDamage animations should always start from frame 0 (don't preserve relative frame)
        // Also don't preserve frame when transitioning between states with different frame counts
        let currentRelativeFrame: number | undefined;
        if (newState === MonsterState.Attack || newState === MonsterState.Dead ||
            newState === MonsterState.TakeDamage || newState === MonsterState.TakeDamageOnMove ||
            newState === MonsterState.TakeDamageWithKnockback) {
            // Non-looping animations always start from frame 0
            currentRelativeFrame = undefined;
        } else {
            // Check if frame count changed between states
            const currentStateConfig = this.getStateAnimationConfig(this.currentState);
            const newStateConfig = this.getStateAnimationConfig(newState);
            
            if (currentStateConfig.animationFrames !== newStateConfig.animationFrames ||
                currentStateConfig.startAnimationFrame !== newStateConfig.startAnimationFrame) {
                // Different frame configurations - don't preserve frame
                currentRelativeFrame = undefined;
            } else {
                // Same frame configuration - preserve frame position for smooth transitions
                currentRelativeFrame = this.assets.length > 0 ? this.assets[0].getCurrentRelativeFrame() : undefined;
            }
        }
        
        this.currentState = newState;
        
        // Get animation configuration for this state
        const animConfig = this.getStateAnimationConfig(newState);
        
        // Use sprite name from config (allows for sprite overrides per state)
        const spriteName = animConfig.spriteName;
        
        // Calculate spriteSheetIndex for monster sprite using config
        const monsterSpriteSheetIndex = animConfig.startSpriteSheet + this.direction;
        
        // Switch animation for the monster asset
        if (this.assets.length > 0) {
            const asset = this.assets[0];
            
            // If sprite name changed, update the sprite texture
            if (spriteName !== this.monsterSpriteName) {
                // Change the sprite texture to use the override sprite
                asset.setSpriteName(spriteName);
            } else if (spriteName === this.monsterSpriteName && asset.getSpriteName() !== this.monsterSpriteName) {
                // Switching back to base sprite from an override
                asset.setSpriteName(this.monsterSpriteName);
            }
            
            // For monster sprite, spriteSheetIndex already encodes the direction (0-7 for idle, 8-15 for move)
            // So we always use direction 0 when playing, as the spriteSheetIndex itself represents the direction
            const animationKey = `sprite-${spriteName}-${monsterSpriteSheetIndex}`;
            const animationDirection = 0;
            
            // Play the animation with the correct frame rate and preserve relative frame position
            const animationFrameRate = this.getAnimationFrameRate(newState);
            
            // For attack, death, and take damage animations, play once (repeat: 0). For other states, use default (loop)
            const repeat = (newState === MonsterState.Attack || newState === MonsterState.Dead ||
                newState === MonsterState.TakeDamage || newState === MonsterState.TakeDamageOnMove ||
                newState === MonsterState.TakeDamageWithKnockback) ? 0 : undefined;
            
            // Determine animation type based on startAnimationFrame
            // If startAnimationFrame > 0, we need SubFrame animation (for custom frame ranges)
            const animationType = animConfig.startAnimationFrame > 0 ? AnimationType.SubFrame : AnimationType.FullFrame;
            const isLooping = repeat !== 0;
            
            // Use config-driven animation
            if (animConfig.startAnimationFrame > 0 || animConfig.animationFrames !== 8) {
                // Custom frame configuration (non-standard frame count or offset)
                asset.playAnimationWithDirection(
                    animationKey, 
                    animationDirection, 
                    animationFrameRate, 
                    currentRelativeFrame, 
                    repeat,
                    animConfig.animationFrames, // Custom frame count
                    animationType,
                    animConfig.startAnimationFrame, // Custom start frame
                    isLooping
                );
            } else {
                // Standard 8 frames starting at 0 - use simplified call
                asset.playAnimationWithDirection(animationKey, animationDirection, animationFrameRate, currentRelativeFrame, repeat);
            }
        }
        
        // Update shadow animation to match new state
        this.updateShadow();
    }
    
    /**
     * Implements abstract method from GameObject to switch state.
     * Maps GameObjectState to MonsterState and calls switchMonsterState.
     * 
     * @param state - The GameObjectState to switch to
     * @param forceUpdate - If true, updates animation even if state hasn't changed (for direction changes)
     */
    protected switchState(state: GameObjectState, forceUpdate: boolean = false): void {
        switch (state) {
            case GameObjectState.Idle:
                this.switchMonsterState(MonsterState.Idle, forceUpdate);
                break;
            case GameObjectState.Move:
                this.switchMonsterState(MonsterState.Move, forceUpdate);
                break;
        }
    }
    
    /**
     * Hook method called when the monster's position changes during movement.
     * Updates spatial audio for the movement sound using stored player coordinates.
     * 
     * @param _newX - New world X coordinate (unused)
     * @param _newY - New world Y coordinate (unused)
     */
    protected override onPositionChanged(_newX: number, _newY: number): void {
        // Update spatial audio when monster reaches a new cell using stored player coordinates
        this.updatePlayerPosition(this.playerX, this.playerY);
    }

    /**
     * Returns true when in TakeDamageOnMove state.
     */
    protected override isInTakeDamageOnMoveState(): boolean {
        return this.currentState === MonsterState.TakeDamageOnMove;
    }
    
    /**
     * Updates the monster's state and AI behavior.
     * Should be called every frame by the scene's update loop.
     * 
     * @param delta - Time elapsed since last frame in milliseconds
     */
    public override update(delta: number): void {
        // If dead, handle death animation and fade out
        if (this.isDead) {
            // Check if death animation is complete
            if (!this.isPrimaryAssetAnimationPlaying()) {
                // Death animation finished, now wait for decay time
                if (!this.isDecayTimerActive) {
                    this.isDecayTimerActive = true;
                    this.deathElapsedTime = 0;
                }
                
                // Update decay timer
                this.deathElapsedTime += delta / 1000; // Convert to seconds
                
                // After decay time has elapsed, start fading
                if (this.deathElapsedTime >= this.corpseDecayTime) {
                    this.currentAlpha = Math.max(0, this.currentAlpha - MONSTER_CORPSE_FADE_ALPHA_STEP);
                    
                    // Apply alpha to all assets
                    for (const asset of this.assets) {
                        asset.setAlpha(this.currentAlpha / 255); // Normalize to 0-1
                    }
                    
                    // When fully transparent, emit event to remove monster
                    if (this.currentAlpha < 1) {
                        EventBus.emit(MONSTER_DEAD, { monsterId: this.monsterId });
                    }
                }
            }
            
            return; // Don't process any other logic when dead
        }
        
        // Check if marked for killing and not mid-cell
        if (this.shouldKill && !this.isMoving) {
            // Start death animation
            this.startDeathAnimation();
            return;
        }
        
        // Check if attack animation is complete (every frame for accuracy)
        if (this.isAttacking && !this.isPrimaryAssetAnimationPlaying()) {
            // Attack animation finished, return to idle state
            this.isAttacking = false;
            this.switchMonsterState(MonsterState.Idle);
        }

        // Check if take damage animation is complete
        if ((this.currentState === MonsterState.TakeDamage || this.currentState === MonsterState.TakeDamageOnMove) &&
            !this.isPrimaryAssetAnimationPlaying()) {
            if (this.isMoving) {
                this.setPendingStunlockAfterMovement();
                this.switchMonsterState(MonsterState.Move, true);
            } else {
                this.startStunlock();
                this.switchMonsterState(MonsterState.Idle);
            }
        }

        // Update knockback visual interpolation when in TakeDamageWithKnockback
        if (this.currentState === MonsterState.TakeDamageWithKnockback && this.isKnockbackActive()) {
            this.updateKnockbackVisual(delta);
        }

        // Check if take damage with knockback is complete (animation and movement both done)
        if (this.currentState === MonsterState.TakeDamageWithKnockback &&
            !this.isKnockbackActive() && !this.isPrimaryAssetAnimationPlaying()) {
            this.startStunlock();
            this.switchMonsterState(MonsterState.Idle);
        }

        // Call parent update for movement
        super.update(delta);

        this.updateStunlock(delta);
        
        // After movement update, evaluate AI when not attacking and not moving
        // Note: We don't automatically switch to Idle state here - let AI manage state transitions
        // This prevents animation resets when continuously moving between cells
        if (!this.isAttacking && !this.isMoving) {
            this.evaluateAI();
        }
    }
    
    /**
     * Event handler for PLAYER_DIED. Updates monster's awareness of player status.
     */
    private onPlayerDied = (): void => {
        this.isPlayerDead = true;
    };

    /**
     * Event handler for IN_UI_PLAYER_RESURRECT. Updates monster's awareness that player is alive again.
     */
    private onPlayerResurrect = (): void => {
        this.isPlayerDead = false;
    };

    /**
     * Destroys the monster and all associated resources including the shadow sprite.
     */
    public destroy(): void {
        EventBus.off(PLAYER_DIED, this.onPlayerDied);
        EventBus.off(IN_UI_PLAYER_RESURRECT, this.onPlayerResurrect);
        super.destroy();
    }
}
