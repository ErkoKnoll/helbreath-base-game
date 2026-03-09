import type { Scene } from 'phaser';
import { GameObject, GameObjectState } from './GameObject';
import { Direction, findMovableLocation, getDistance, getDirectionOffset, getNextDirection, isCellMovable, convertPixelPosToWorldPos } from '../../utils/CoordinateUtils';
import type { HBMap } from '../assets/HBMap';
import type { Monster } from './Monster';
import { ShadowManager } from '../../utils/ShadowManager';
import { DEFAULT_MOVEMENT_SPEED, DEFAULT_PLAYER_ATTACK_RANGE, DEFAULT_PLAYER_ATTACK_SPEED, HIGH_DEPTH, PLAYER_HEALTH_BAR_HEIGHT, PLAYER_HEALTH_BAR_WIDTH, PLAYER_STUNLOCK_DURATION_MS } from '../../Config';
import { TILE_SIZE } from '../assets/HBMap';
import { CriticalStrikeProjectile } from '../effects/CriticalStrikeProjectile';
import { ArrowProjectile } from '../effects/ArrowProjectile';
import { StormBringerEffect } from '../effects/StormBringerEffect';
import { drawEffect, drawEffectAtPixelCoords } from '../../utils/EffectUtils';
import { EFFECT_RESURRECTION, EFFECT_CASTING_CIRCLE, EFFECT_SPARKLE, EFFECT_FOOTSTEPS_DRY, EFFECT_WET_SPLASH } from '../../constants/Effects';
import { getEffectByKey } from '../../constants/Effects';
import { GameStateManager } from '../../utils/GameStateManager';
import { SoundManager } from '../../utils/SoundManager';
import { getGameStateManager } from '../../utils/RegistryUtils';
import { mapDialogStore } from '../../ui/store/MapDialog.store';
import { playerDialogStore } from '../../ui/store/PlayerDialog.store';
import { PLAYER_RUNNING, PLAYER_WALKING, PLAYER_MELEE_ATTACK, PLAYER_TAKE_UNARMED_DAMAGE, PLAYER_CAST, MALE_CRITICAL_ATTACK, FEMALE_CRITICAL_ATTACK, MALE_DEATH, FEMALE_DEATH } from '../../constants/SoundFileNames';
import { EventBus } from '../EventBus';
import { PLAYER_POSITION_CHANGED, OUT_UI_PLAYER_DIED, OUT_UI_CAST_STARTED, OUT_UI_CAST_READY, OUT_UI_CAST_REMOVED, PLAYER_CONFIRM_SPELL_TARGET, EQUIP_ITEM, IN_UI_CHANGE_GENDER, IN_UI_CHANGE_SKIN_COLOR, IN_UI_CHANGE_UNDERWEAR_COLOR, IN_UI_CHANGE_HAIR_STYLE, ITEM_PICKUP_ATTEMPTED } from '../../constants/EventNames';
import { AttackType, Gender, SkinColor } from '../../Types';
import { calculateAnimationDuration, calculateFrameRateFromDuration } from '../../utils/AnimationUtils';
import { FloatingText } from '../effects/FloatingText';
import { getSpellById } from '../../constants/Spells';
import { ItemTypes, ItemEffect, WeaponType, hasEquippedItemEffect, type Effect } from '../../constants/Items';
import { getInventoryManager } from '../../utils/RegistryUtils';
import { DEFAULT_GEAR, GearConfig, PlayerAppearanceManager, PlayerState } from '../../utils/PlayerAppearanceManager';

/**
 * Represents the player character in the game.
 * Extends GameObject with combat (melee, bow, spell casting), movement (run, walk, dash),
 * equipment via PlayerAppearanceManager/InventoryManager, health/damage, and appearance
 * customization (gender, skin color, hair, underwear). Listens to EventBus for equip and
 * appearance changes.
 */

export class Player extends GameObject {
    private readonly appearanceManager: PlayerAppearanceManager;

    /** Handler for EQUIP_ITEM - stored for cleanup on destroy */
    private equipItemHandler?: (payload: { itemType: string; itemId?: number; itemUid: number; effectOverrides?: Effect[] }) => void;

    /** Handler for IN_UI_CHANGE_GENDER - stored for cleanup on destroy */
    private genderChangeHandler?: (gender: Gender) => void;
    /** Handler for IN_UI_CHANGE_SKIN_COLOR - stored for cleanup on destroy */
    private skinColorChangeHandler?: (skinColor: SkinColor) => void;
    /** Handler for IN_UI_CHANGE_UNDERWEAR_COLOR - stored for cleanup on destroy */
    private underwearColorChangeHandler?: (index: number) => void;
    /** Handler for IN_UI_CHANGE_HAIR_STYLE - stored for cleanup on destroy */
    private hairStyleChangeHandler?: (index: number) => void;

    /** Current animation state */
    private currentState: PlayerState;

    /** Attack mode: when true, idle uses combat stance; when false, idle uses peace stance */
    private attackMode: boolean = true;

    /** Run mode: when true, run at full speed; when false, walk at half speed */
    private runMode: boolean = true;

    /** Base movement duration for run mode (from slider). Walk mode uses double this. */
    private runMovementSpeedDurationMs: number = 500 - (DEFAULT_MOVEMENT_SPEED / 100) * (500 - 100);

    /** Attack range in cells (Chebyshev distance) */
    private attackRange: number = DEFAULT_PLAYER_ATTACK_RANGE;

    /** Attack type - whether damage interrupts the target */
    private attackType: AttackType = AttackType.Interrupt;

    /** Damage dealt per attack (used for melee and bow) */
    private damage: number = 30;

    /** Attack animation frame rate (frames per second) */
    private attackSpeed: number = DEFAULT_PLAYER_ATTACK_SPEED; // 5 + (30/100)*(30-5) when slider default is 30

    /** Cast spell animation duration in milliseconds */
    private castSpeed: number = 1500;

    /** Casting circle effect instance (created when entering Cast state) */
    private castingCircleEffect: ReturnType<typeof drawEffect> | undefined = undefined;

    /** SoundManager instance for playing sound effects */
    private readonly soundManager: SoundManager;

    /** Monster targeted for attack when out of range (pathfind towards on release) */
    private attackTarget: Monster | undefined = undefined;

    /** When true, player is dashing: moving with attack animation instead of run animation */
    private dashMode: boolean = false;

    /** When true, dash damage was already dealt this move (skip startAttack when reaching cell) */
    private dashDamageDealt: boolean = false;

    /** Pending spell ID when cast is commanded from UI (targeting or CastReady) */
    private pendingSpellId: number | undefined = undefined;
    /** When true, play cast animation before entering CastReady; when false, target immediately */
    private pendingUseCastAnimation = false;

    /** Queued spell cast when player is moving - executed when reaching next cell */
    private queuedCastSpellId: number | undefined = undefined;
    private queuedCastUseAnimation = false;

    /** Frame rate for player animations when running */
    /** Calculated from DEFAULT_MOVEMENT_SPEED: 5 FPS (min/slow) to 30 FPS (max/fast) */
    private frameRate: number = 5 + (DEFAULT_MOVEMENT_SPEED / 100) * (30 - 5);

    /** Frame rate for idle animations (always 10 FPS) */
    private readonly IDLE_FRAME_RATE: number = 10;

    /** Number of frames in running animation (standard for all player animations) */
    private readonly RUNNING_FRAME_COUNT: number = 8;

    /** GameStateManager instance for updating player position */
    private gameStateManager: GameStateManager;

    /** Whether the player is dead (in Die state) */
    private isDead: boolean = false;

    /** Health bar graphics - 30px wide, 2 cells above player when alive */
    private healthBarGraphics: Phaser.GameObjects.Graphics;

    /** Accumulator for STAR_TWINKLE spawn interval (ms). Spawns sparkles above player when equipped. */
    private starTwinkleAccumulatorMs: number = 0;

    /**
     * Creates a new Player instance.
     *
     * @param scene - The Phaser scene to add the player to
     * @param worldX - X coordinate in world map position
     * @param worldY - Y coordinate in world map position
     * @param direction - Direction enum for facing (default: NorthEast)
     * @param soundManager - SoundManager instance for playing sound effects
     * @param map - HBMap instance for collision checking
     * @param gear - Initial gear config; resolved from InventoryManager if not provided
     */
    constructor(scene: Scene, worldX: number, worldY: number, direction: Direction = Direction.NorthEast, soundManager: SoundManager, map: HBMap, gear: GearConfig = DEFAULT_GEAR) {
        // Get gender and skin color from GameStateManager (persisted) - must compute before super()
        const gameStateManager = getGameStateManager(scene.game);
        const initialGender = gameStateManager.getGender();
        const initialSkinColor = gameStateManager.getSkinColor();
        const initialHumanSprite = PlayerAppearanceManager.getHumanSpriteName(initialGender, initialSkinColor);

        // Resolve weapon and shield from InventoryManager.equippedItems if not provided in gear
        const inventoryManager = getInventoryManager(scene.game);
        const initialGear = { ...gear, human: initialHumanSprite };
        const resolvedGear = PlayerAppearanceManager.resolveGearFromInventory(initialGear, inventoryManager, initialGender);
        const { configs: assetConfigs, assetIndices } = PlayerAppearanceManager.buildAssetConfigs(
            direction,
            PlayerState.IdlePeaceMode,
            resolvedGear,
        );

        // Add animation frame change callback to the weapon asset for attack damage/sound/arrows.
        const weaponConfig = assetIndices.weaponAssetIndex >= 0 ? assetConfigs[assetIndices.weaponAssetIndex] : undefined;
        if (weaponConfig) {
            weaponConfig.onAnimationFrameChange = (relativeFrameIndex: number) =>
                this.onWeaponAnimationFrameChange(relativeFrameIndex);
        }

        super(scene, {
            x: worldX,
            y: worldY,
            assets: assetConfigs,
            soundManager,
            map,
            stunlockDurationMs: PLAYER_STUNLOCK_DURATION_MS,
        });

        this.appearanceManager = new PlayerAppearanceManager(this.assets, initialGender, resolvedGear, assetIndices);
        this.soundManager = soundManager;
        this.hp = 1000;
        this.maxHp = 1000;

        this.direction = direction;
        this.currentState = PlayerState.IdlePeaceMode;

        // Create shadow manager
        const initialShadowSpriteSheetIndex = this.appearanceManager.getShadowSpriteSheetIndex(PlayerState.IdlePeaceMode, direction);
        this.shadowManager = new ShadowManager({
            scene,
            shadowSpriteName: this.appearanceManager.getHumanSpriteName(),
            shadowSpriteSheetIndex: initialShadowSpriteSheetIndex,
            worldX,
            worldY,
            frameRate: this.IDLE_FRAME_RATE,
        });

        // Center the player in the initial cell
        this.updatePixelPosition();

        // Load GameStateManager from registry
        this.gameStateManager = getGameStateManager(this.scene.game);

        // Create health bar (20px wide, 2 cells above player when alive)
        this.healthBarGraphics = this.scene.add.graphics().setVisible(false);

        // Listen for gender change from UI
        this.genderChangeHandler = (gender: Gender) => {
            this.applyAppearanceChange(gender, this.gameStateManager.getSkinColor());
        };
        EventBus.on(IN_UI_CHANGE_GENDER, this.genderChangeHandler);

        // Listen for skin color change from UI
        this.skinColorChangeHandler = (skinColor: SkinColor) => {
            this.applyAppearanceChange(this.gameStateManager.getGender(), skinColor);
        };
        EventBus.on(IN_UI_CHANGE_SKIN_COLOR, this.skinColorChangeHandler);

        // Listen for underwear color change from UI
        this.underwearColorChangeHandler = (underwearColorIndex: number) => {
            this.applyAppearanceChange(this.gameStateManager.getGender(), this.gameStateManager.getSkinColor(), underwearColorIndex);
        };
        EventBus.on(IN_UI_CHANGE_UNDERWEAR_COLOR, this.underwearColorChangeHandler);

        // Listen for hair style change from UI
        this.hairStyleChangeHandler = (hairStyleIndex: number) => {
            this.applyAppearanceChange(this.gameStateManager.getGender(), this.gameStateManager.getSkinColor(), undefined, hairStyleIndex);
        };
        EventBus.on(IN_UI_CHANGE_HAIR_STYLE, this.hairStyleChangeHandler);

        // Listen for equip events from InventoryManager
        this.equipItemHandler = (payload: { itemType: string; itemId?: number; itemUid: number; effectOverrides?: Effect[] }) => {
            if (payload.itemType === ItemTypes.WEAPON ||
                payload.itemType === ItemTypes.SHIELD ||
                payload.itemType === ItemTypes.ARMOR ||
                payload.itemType === ItemTypes.HAUBERK ||
                payload.itemType === ItemTypes.LEGGINGS ||
                payload.itemType === ItemTypes.BOOTS ||
                payload.itemType === ItemTypes.HELMET ||
                payload.itemType === ItemTypes.CAPE ||
                payload.itemType === ItemTypes.ACCESSORY) {
                this.onEquipItem(payload.itemType, payload.itemId, payload.effectOverrides);
            }
        };
        EventBus.on(EQUIP_ITEM, this.equipItemHandler);

        // Apply current equipped items (InventoryManager emits EQUIP_ITEM before Player exists, so we must apply on init)
        const equipped = inventoryManager.equippedItems;
        this.onEquipItem(ItemTypes.WEAPON, equipped[ItemTypes.WEAPON]?.itemId, equipped[ItemTypes.WEAPON]?.effectOverrides);
        this.onEquipItem(ItemTypes.SHIELD, equipped[ItemTypes.SHIELD]?.itemId, equipped[ItemTypes.SHIELD]?.effectOverrides);
        this.onEquipItem(ItemTypes.ARMOR, equipped[ItemTypes.ARMOR]?.itemId, equipped[ItemTypes.ARMOR]?.effectOverrides);
        this.onEquipItem(ItemTypes.HAUBERK, equipped[ItemTypes.HAUBERK]?.itemId, equipped[ItemTypes.HAUBERK]?.effectOverrides);
        this.onEquipItem(ItemTypes.LEGGINGS, equipped[ItemTypes.LEGGINGS]?.itemId, equipped[ItemTypes.LEGGINGS]?.effectOverrides);
        this.onEquipItem(ItemTypes.BOOTS, equipped[ItemTypes.BOOTS]?.itemId, equipped[ItemTypes.BOOTS]?.effectOverrides);
        this.onEquipItem(ItemTypes.HELMET, equipped[ItemTypes.HELMET]?.itemId, equipped[ItemTypes.HELMET]?.effectOverrides);
        this.onEquipItem(ItemTypes.CAPE, equipped[ItemTypes.CAPE]?.itemId, equipped[ItemTypes.CAPE]?.effectOverrides);
        this.onEquipItem(ItemTypes.ACCESSORY, equipped[ItemTypes.ACCESSORY]?.itemId, equipped[ItemTypes.ACCESSORY]?.effectOverrides);
    }

    private onEquipItem(itemType: ItemTypes, itemId: number | undefined, effectOverrides?: Effect[]): void {
        this.appearanceManager.handleEquip(itemType, itemId, effectOverrides);
        this.switchPlayerState(this.currentState, true);
        this.updatePixelPosition();
    }

    private applyAppearanceChange(gender: Gender, skinColor: SkinColor, underwearColorIndex?: number, hairStyleIndex?: number): void {
        this.gameStateManager.setGender(gender);
        this.gameStateManager.setSkinColor(skinColor);
        if (underwearColorIndex !== undefined) {
            this.gameStateManager.setUnderwearColorIndex(underwearColorIndex);
        }
        if (hairStyleIndex !== undefined) {
            this.gameStateManager.setHairStyleIndex(hairStyleIndex);
        }
        this.gameStateManager.saveGameState();
        const inventoryManager = getInventoryManager(this.scene.game);
        this.appearanceManager.applyAppearanceChange(gender, skinColor, inventoryManager.equippedItems, this.currentState, this.direction, this.shadowManager, underwearColorIndex, hairStyleIndex);
        this.switchPlayerState(this.currentState, true);
    }

    protected override updateDepth(): void {
        this.appearanceManager.updateDepth(this.worldY, this.direction, this.currentState);
    }

    protected override updatePixelPosition(): void {
        const finalPixelX = this.getAnimatedPixelX();
        const finalPixelY = this.getAnimatedPixelY();
        this.updateDepth();
        const ghostConfig = this.getGhostConfig();
        this.appearanceManager.updateAssetPositions(finalPixelX, finalPixelY, ghostConfig);
        this.updateShadowPosition();
        this.updateShadowDepth();
    }

    /**
     * Returns ghost config when ghost effect is enabled and player is moving.
     * Ghost is also shown during dash (temporarily) even when the user has it disabled.
     */
    private getGhostConfig(): { enabled: boolean; offsetX: number; offsetY: number } | undefined {
        const showGhost = playerDialogStore.state.ghostEffect || this.dashMode;
        if (!showGhost || !this.isMoving || (!this.isInMovementState() && !this.dashMode)) {
            return undefined;
        }
        const [dx, dy] = getDirectionOffset(this.direction);
        const progress = Math.min(this.movementElapsedTime / this.movementSpeedDurationMs, 1);
        const ghostDistance = 16 * (1 - progress);
        return {
            enabled: true,
            offsetX: -dx * ghostDistance,
            offsetY: -dy * ghostDistance,
        };
    }

    /**
     * Updates sound effects based on the player's state.
     * Movement sounds continue playing during direction changes; only stop when actually leaving movement.
     */
    private updateSound(newState: PlayerState): void {
        switch (newState) {
            case PlayerState.Run:
            case PlayerState.WalkPeaceMode:
            case PlayerState.WalkCombatMode: {
                const wasInMovementState = this.isInMovementState();
                const movementTypeChanged = wasInMovementState && (
                    (this.currentState === PlayerState.Run) !== (newState === PlayerState.Run)
                );
                if (!wasInMovementState || movementTypeChanged) {
                    this.stopMovementSounds();
                    const config = this.getMovementConfig();
                    const soundStateKey = newState === PlayerState.Run ? PlayerState.Run : PlayerState.WalkPeaceMode;
                    this.soundTracker.playInLoop(soundStateKey, config.soundKey, config.soundIntervalMs);
                }
                break;
            }
            case PlayerState.Cast:
                this.stopMovementSounds();
                // Play cast sound with duration matching castSpeed (in milliseconds)
                // Track by state so it can be stopped when casting is cancelled
                this.soundTracker.playOnce(PLAYER_CAST, this.castSpeed, undefined, PlayerState.Cast);
                break;
            case PlayerState.MeleeAttack:
            case PlayerState.BowAttack:
            case PlayerState.BowStance:
            case PlayerState.IdlePeaceMode:
            case PlayerState.IdleCombatMode:
            case PlayerState.TakeDamage:
            case PlayerState.TakeDamageOnMove:
            case PlayerState.TakeDamageWithKnockback:
            case PlayerState.CastReady:
            case PlayerState.PickUp:
                this.stopMovementSounds();
                break;
            case PlayerState.Die: {
                const deathSound = this.gameStateManager.getGender() === Gender.FEMALE ? FEMALE_DEATH : MALE_DEATH;
                this.soundTracker.playOnce(deathSound);
                break;
            }
            default:
                this.soundTracker.stopAllSounds();
        }
    }

    /**
     * Stops run and walk sounds.
     */
    private stopMovementSounds(): void {
        this.soundTracker.stopSound(PlayerState.Run);
        this.soundTracker.stopSound(PlayerState.WalkPeaceMode);
    }

    /**
     * Switches the player's animation state.
     * Updates all assets to use the new sprite sheet index corresponding to the state.
     */
    private switchPlayerState(newState: PlayerState, forceUpdate: boolean = false): void {
        if (this.currentState === newState && !forceUpdate) {
            return;
        }

        this.updateSound(newState);

        const previousState = this.currentState;

        this.currentState = newState;

        // Create casting circle effect when entering Cast state
        if (newState === PlayerState.Cast && previousState !== PlayerState.Cast) {
            this.createCastingCircleEffect();
            // Create floating text with spell name in green color
            this.createSpellNameFloatingText();
        }

        // Destroy casting circle effect when leaving Cast state
        if (previousState === PlayerState.Cast && newState !== PlayerState.Cast) {
            this.destroyCastingCircleEffect();
        }

        const effectiveAttackSpeed = (this.dashMode && newState === PlayerState.MeleeAttack)
            ? calculateFrameRateFromDuration(this.RUNNING_FRAME_COUNT, this.runMovementSpeedDurationMs)
            : this.attackSpeed;
        this.appearanceManager.applyStateAppearance(newState, this.direction, {
            movementFrameRate: this.frameRate,
            attackSpeed: effectiveAttackSpeed,
            castSpeed: this.castSpeed,
            idleFrameRate: this.IDLE_FRAME_RATE,
        });

        if (newState === PlayerState.Run || previousState === PlayerState.Run || newState === PlayerState.MeleeAttack || previousState === PlayerState.MeleeAttack) {
            this.updateDepth();
        }
        this.appearanceManager.updateShadow(this.shadowManager, this.currentState, this.direction, {
            movementFrameRate: this.frameRate,
            attackSpeed: effectiveAttackSpeed,
            castSpeed: this.castSpeed,
            idleFrameRate: this.IDLE_FRAME_RATE,
        });
    }

    /**
     * Called when the weapon asset's animation reaches a new frame (via onAnimationFrameChange callback).
     * At frame 2: plays attack sound and signals the targeted monster that it received damage.
     */
    private onWeaponAnimationFrameChange(relativeFrameIndex: number): void {
        if ((this.currentState === PlayerState.MeleeAttack || this.currentState === PlayerState.BowAttack) && relativeFrameIndex === 2) {
            // Always play regular attack sound
            this.soundTracker.playOnce(PLAYER_MELEE_ATTACK, calculateAnimationDuration(this.RUNNING_FRAME_COUNT, this.attackSpeed));
            // Play critical attack sound only for InterruptKnockback (melee or bow)
            const shouldPlayCriticalSound = this.attackType === AttackType.InterruptKnockback;
            if (shouldPlayCriticalSound && this.attackTarget) {
                const criticalSound = this.gameStateManager.getGender() === Gender.FEMALE ? FEMALE_CRITICAL_ATTACK : MALE_CRITICAL_ATTACK;
                this.soundTracker.playOnce(criticalSound);
            }
            // Create critical strike projectile for melee knockback only
            if (this.currentState === PlayerState.MeleeAttack && this.attackType === AttackType.InterruptKnockback && this.attackTarget) {
                const sourcePixelX = this.getAnimatedPixelX();
                const sourcePixelY = this.getAnimatedPixelY() - TILE_SIZE;
                const targetPixelX = this.attackTarget.getAnimatedPixelX();
                const targetPixelY = this.attackTarget.getAnimatedPixelY() - this.attackTarget.getHeight() / 2;
                new CriticalStrikeProjectile(this.scene, {
                    sourcePixelX: sourcePixelX,
                    sourcePixelY: sourcePixelY,
                    targetPixelX: targetPixelX,
                    targetPixelY: targetPixelY,
                });
            }
            // Storm Bringer effect: create homing projectile when equipped weapon has STORM_BRINGER (melee only)
            const inventoryManager = getInventoryManager(this.scene.game);
            const weaponDef = inventoryManager.getEquippedWeaponDef();
            const equippedWeapon = inventoryManager.equippedItems[ItemTypes.WEAPON];
            if (equippedWeapon && this.attackTarget) {
                if (this.currentState === PlayerState.MeleeAttack && weaponDef?.effects?.some((e) => e.effect === ItemEffect.STORM_BRINGER)) {
                    new StormBringerEffect(this.scene, {
                        originPixelX: this.getAnimatedPixelX(),
                        originPixelY: this.getAnimatedPixelY(),
                        targetMonster: this.attackTarget,
                        speed: 500,
                    });
                }
                // Arrow projectile when equipped weapon is a bow (damage applied when arrow reaches target).
                // Capture target and damage at creation time - attackTarget is cleared when animation
                // finishes, which can happen before the arrow reaches distant targets.
                if (weaponDef?.weaponType === WeaponType.BOW) {
                    const targetMonster = this.attackTarget;
                    const damageAmount = this.damage;
                    const attackTypeForArrow = this.attackType;
                    new ArrowProjectile(this.scene, {
                        originPixelX: this.getAnimatedPixelX(),
                        originPixelY: this.getAnimatedPixelY(),
                        target: targetMonster,
                        speed: 1000,
                        onReachDestination: () => targetMonster?.takeDamage(damageAmount, attackTypeForArrow),
                    });
                }
            }
            // Melee damage applied immediately at frame 2; bow damage is applied by ArrowProjectile on arrival
            if (this.currentState === PlayerState.MeleeAttack) {
                this.attackTarget?.takeDamage(this.damage, this.attackType);
                if (this.dashMode) {
                    this.dashDamageDealt = true;
                }
            }
        }
    }

    /**
     * Switches to idle state based on attack mode.
     * When attackMode is true: IdleCombatMode. When false: IdlePeaceMode.
     */
    public switchToIdle(): void {
        const idleState = this.attackMode ? PlayerState.IdleCombatMode : PlayerState.IdlePeaceMode;
        this.switchPlayerState(idleState, true);
    }

    /**
     * Sets attack mode (true = combat stance when idle, false = peace stance).
     * If currently in an idle state, updates the displayed stance immediately.
     */
    public setAttackMode(enabled: boolean): void {
        this.attackMode = enabled;
        if (this.currentState === PlayerState.IdlePeaceMode || this.currentState === PlayerState.IdleCombatMode) {
            this.switchToIdle();
        } else if (this.isInMovementState()) {
            this.switchToMovement(true);
        }
    }

    /**
     * Switches to movement state (Run, WalkPeaceMode, or WalkCombatMode).
     * Determines state, speed, sound, and animation based on runMode and attackMode.
     */
    public switchToMovement(forceUpdate: boolean = false): void {
        const config = this.getMovementConfig();
        this.movementSpeedDurationMs = config.movementDurationMs;
        this.switchPlayerState(config.state, forceUpdate);
    }

    /**
     * Returns true when in a movement state (Run, WalkPeaceMode, WalkCombatMode).
     */
    private isInMovementState(): boolean {
        return this.currentState === PlayerState.Run ||
            this.currentState === PlayerState.WalkPeaceMode ||
            this.currentState === PlayerState.WalkCombatMode;
    }

    /**
     * Gets movement config: state, duration, frame rate, sound key, and sound interval.
     */
    private getMovementConfig(): {
        state: PlayerState;
        movementDurationMs: number;
        frameRate: number;
        soundKey: string;
        soundIntervalMs: number;
    } {
        if (this.runMode) {
            const soundIntervalMs = calculateAnimationDuration(this.RUNNING_FRAME_COUNT, this.frameRate) / 2;
            return {
                state: PlayerState.Run,
                movementDurationMs: this.runMovementSpeedDurationMs,
                frameRate: this.frameRate,
                soundKey: PLAYER_RUNNING,
                soundIntervalMs,
            };
        }
        const walkFrameRate = this.frameRate * 2;
        const soundIntervalMs = calculateAnimationDuration(this.RUNNING_FRAME_COUNT, walkFrameRate) * 2;
        const walkState = this.attackMode ? PlayerState.WalkCombatMode : PlayerState.WalkPeaceMode;
        return {
            state: walkState,
            movementDurationMs: this.runMovementSpeedDurationMs * 2,
            frameRate: walkFrameRate,
            soundKey: PLAYER_WALKING,
            soundIntervalMs,
        };
    }

    /**
     * Sets run mode (true = run, false = walk at half speed).
     * If currently in a movement state, updates immediately.
     */
    public setRunMode(enabled: boolean): void {
        this.runMode = enabled;
        if (this.isInMovementState()) {
            this.switchToMovement(true);
        }
    }

    /**
     * Checks if the player is currently in attack state.
     */
    public isAttacking(): boolean {
        return this.currentState === PlayerState.MeleeAttack || this.currentState === PlayerState.BowAttack;
    }

    /**
     * Returns true when the player is in BowStance state (peace mode bow pose, no damage).
     */
    public isInBowStance(): boolean {
        return this.currentState === PlayerState.BowStance;
    }

    /**
     * Returns true when the player is in Cast state (spell cast animation playing).
     */
    public isCasting(): boolean {
        return this.currentState === PlayerState.Cast;
    }

    /**
     * Returns true when the player is in CastReady state (cast animation done, waiting for left click to target).
     */
    public isCastReady(): boolean {
        return this.currentState === PlayerState.CastReady;
    }

    /**
     * Returns true when a spell is pending (either in Cast, CastReady, immediate targeting mode, or queued while moving).
     */
    public hasPendingSpell(): boolean {
        return this.pendingSpellId !== undefined || this.queuedCastSpellId !== undefined;
    }

    /**
     * Called when cast is commanded from UI. With useCastAnimation: enters Cast immediately (retains direction);
     * without: enters targeting mode (no state change). When moving: queues the cast until the next cell is reached.
     * Emits OUT_UI_CAST_STARTED when entering Cast state, or OUT_UI_CAST_READY when entering targeting mode without animation.
     */
    public requestCast(spellId: number, useCastAnimation: boolean): void {
        if (this.isDead || this.hasPendingSpell()) {
            return;
        }
        if (useCastAnimation && this.isMoving) {
            // Queue cast until player reaches next cell - don't start cast animation mid-cell
            this.queuedCastSpellId = spellId;
            this.queuedCastUseAnimation = useCastAnimation;
            this.cancelMovement();
            return;
        }
        this.pendingSpellId = spellId;
        this.pendingUseCastAnimation = useCastAnimation;
        if (useCastAnimation) {
            this.cancelMovement();
            this.switchPlayerState(PlayerState.Cast, true);
            EventBus.emit(OUT_UI_CAST_STARTED);
        } else {
            EventBus.emit(OUT_UI_CAST_READY);
        }
    }

    /**
     * Called when left click occurs. If in targeting mode or CastReady, confirms spell target and emits
     * PLAYER_CONFIRM_SPELL_TARGET. Returns true if handled.
     */
    public onLeftClickAt(cursorPixelX: number, cursorPixelY: number): boolean {
        if (this.pendingSpellId === undefined) {
            return false;
        }
        if (this.pendingUseCastAnimation && this.currentState !== PlayerState.CastReady) {
            return false;
        }
        const spellId = this.pendingSpellId;
        this.pendingSpellId = undefined;
        this.pendingUseCastAnimation = false;
        if (this.currentState === PlayerState.CastReady) {
            this.switchToIdle();
        }
        
        // Turn player towards the spell target direction (same logic as right-click in idle mode)
        const originPixelX = this.getAnimatedPixelX();
        const originPixelY = this.getAnimatedPixelY();
        const targetWorldX = convertPixelPosToWorldPos(cursorPixelX);
        const targetWorldY = convertPixelPosToWorldPos(cursorPixelY);
        
        const direction = getNextDirection(
            this.worldX,
            this.worldY,
            targetWorldX,
            targetWorldY
        );
        
        // Turn player towards cursor direction
        if (direction !== Direction.None) {
            this.turnTowardsDirection(direction);
        }
        
        EventBus.emit(PLAYER_CONFIRM_SPELL_TARGET, {
            spellId,
            originPixelX,
            originPixelY,
            targetPixelX: cursorPixelX,
            targetPixelY: cursorPixelY,
        });
        EventBus.emit(OUT_UI_CAST_REMOVED);
        return true;
    }

    /**
     * Called when right click occurs. Cancels pending or queued spell. Returns true if handled.
     */
    public onRightClick(): boolean {
        if (!this.hasPendingSpell()) {
            return false;
        }
        this.pendingSpellId = undefined;
        this.pendingUseCastAnimation = false;
        this.queuedCastSpellId = undefined;
        this.queuedCastUseAnimation = false;
        if (this.currentState === PlayerState.Cast || this.currentState === PlayerState.CastReady) {
            // Stop cast sound if currently casting
            if (this.currentState === PlayerState.Cast) {
                this.soundTracker.stopSound(PlayerState.Cast);
            }
            this.switchToIdle();
        }
        EventBus.emit(OUT_UI_CAST_REMOVED);
        return true;
    }

    /**
     * Cancels pending or queued spell without emitting. Called on shutdown.
     */
    public cancelPendingCast(): void {
        if (!this.hasPendingSpell()) {
            return;
        }
        this.pendingSpellId = undefined;
        this.pendingUseCastAnimation = false;
        this.queuedCastSpellId = undefined;
        this.queuedCastUseAnimation = false;
        if (this.currentState === PlayerState.CastReady) {
            this.switchToIdle();
        }
        EventBus.emit(OUT_UI_CAST_REMOVED);
    }

    /**
     * Takes damage: subtracts damage from hp, shows FloatingText, and when attackType is Interrupt
     * cancels attack and switches to TakeDamage or TakeDamageOnMove.
     * When InterruptKnockback, knocks back 1 cell away from attacker (if cell is movable).
     * When NoInterrupt: only applies hp reduction and FloatingText, no animation/state change.
     * When hp drops below 1, switches to Die state.
     *
     * @param attackType - Interrupt to play take damage animation; InterruptKnockback to also knock back; NoInterrupt does nothing visually
     * @param damage - Damage amount to subtract from hp
     * @param attackerWorldX - Attacker's world X (used for InterruptKnockback knockback direction)
     * @param attackerWorldY - Attacker's world Y (used for InterruptKnockback knockback direction)
     */
    public takeDamage(attackType: AttackType, damage: number, attackerWorldX: number, attackerWorldY: number): void {
        if (this.isDead) {
            return;
        }

        this.acceptDamage(damage);

        if (this.isDead) {
            return;
        }

        if (attackType === AttackType.NoInterrupt) {
            return;
        }

        if (attackType === AttackType.InterruptKnockback) {
            this.applyKnockbackDamage(attackerWorldX, attackerWorldY);
            return;
        }

        if (attackType === AttackType.Interrupt) {
            this.applyInterruptDamage();
        }
    }

    /**
     * Overrides GameObject.acceptDamage to position FloatingText 3 cells above player.
     */
    public override acceptDamage(damage: number): void {
        this.hp -= damage;
        if (this.hp < 1) {
            this.announceDeath();
        }
        this.createDamageFloatingText(damage, this.getAnimatedPixelY() - 3 * TILE_SIZE + 10);
    }

    /**
     * Overrides GameObject.announceDeath. When hp drops below 1, switches to Die state.
     */
    protected override announceDeath(): void {
        this.isDead = true;
        this.attackTarget = undefined;
        this.dashMode = false;
        this.dashDamageDealt = false;
        this.soundTracker.stopAllSounds();
        this.cancelMovement();
        this.markCurrentTileFree();
        if (this.shadowManager) {
            this.shadowManager.destroy();
            this.shadowManager = undefined;
        }
        this.switchPlayerState(PlayerState.Die, true);
        EventBus.emit(OUT_UI_PLAYER_DIED);
    }

    /**
     * Returns true if the player is in dead state.
     */
    public getIsDead(): boolean {
        return this.isDead;
    }

    public getGender(): Gender {
        return this.appearanceManager.getGender();
    }

    /**
     * Resurrects the player: restores HP, recreates shadow, switches to IdlePeaceMode.
     * Called when user clicks Resurrect in the death dialog.
     * If current tile is occupied (e.g. by a monster), finds closest movable position and moves there.
     */
    public resurrect(): void {
        if (!this.isDead) {
            return;
        }
        this.isDead = false;
        this.hp = this.maxHp;

        // Check if current position is still free; if not, find closest movable location and move there
        if (!isCellMovable(this.map, this.worldX, this.worldY)) {
            const movableLocation = findMovableLocation(this.map, this.worldX, this.worldY);
            if (movableLocation) {
                this.worldX = movableLocation.x;
                this.worldY = movableLocation.y;
                this.updatePixelPosition();
                this.onPositionChanged(this.worldX, this.worldY);
            }
        }
        this.markCurrentTileOccupied();

        this.pendingSpellId = undefined;
        this.pendingUseCastAnimation = false;
        this.queuedCastSpellId = undefined;
        this.queuedCastUseAnimation = false;

        // Recreate shadow manager (destroyed on death)
        const initialShadowSpriteSheetIndex = this.appearanceManager.getShadowSpriteSheetIndex(PlayerState.IdlePeaceMode, this.direction);
        this.shadowManager = new ShadowManager({
            scene: this.scene,
            shadowSpriteName: this.appearanceManager.getHumanSpriteName(),
            shadowSpriteSheetIndex: initialShadowSpriteSheetIndex,
            worldX: this.worldX,
            worldY: this.worldY,
            frameRate: this.IDLE_FRAME_RATE,
        });

        this.switchToIdle();

        drawEffect(this.scene, this.worldX, this.worldY, EFFECT_RESURRECTION);
    }

    /**
     * Applies regular interrupt damage (TakeDamage or TakeDamageOnMove).
     */
    private applyInterruptDamage(): void {
        this.attackTarget = undefined;

        // Cancel pending spell when interrupted by damage - reset cursor to regular state
        if (this.hasPendingSpell()) {
            this.pendingSpellId = undefined;
            this.pendingUseCastAnimation = false;
            this.queuedCastSpellId = undefined;
            this.queuedCastUseAnimation = false;
            if (this.currentState === PlayerState.Cast) {
                this.soundTracker.stopSound(PlayerState.Cast);
            }
            EventBus.emit(OUT_UI_CAST_REMOVED);
        }

        this.soundTracker.playOnce(PLAYER_TAKE_UNARMED_DAMAGE);

        if (this.isMoving) {
            this.switchPlayerState(PlayerState.TakeDamageOnMove, true);
        } else {
            this.switchPlayerState(PlayerState.TakeDamage, true);
        }
    }

    /**
     * Applies knockback damage: cancels current state, moves player 1 cell away from attacker.
     * If knockback destination is not movable, falls back to regular TakeDamage or TakeDamageOnMove.
     */
    private applyKnockbackDamage(attackerWorldX: number, attackerWorldY: number): void {
        if (this.currentState === PlayerState.TakeDamageWithKnockback) {
            return;
        }

        this.attackTarget = undefined;

        // Cancel pending spell when interrupted by damage - reset cursor to regular state
        if (this.hasPendingSpell()) {
            this.pendingSpellId = undefined;
            this.pendingUseCastAnimation = false;
            this.queuedCastSpellId = undefined;
            this.queuedCastUseAnimation = false;
            if (this.currentState === PlayerState.Cast) {
                this.soundTracker.stopSound(PlayerState.Cast);
            }
            EventBus.emit(OUT_UI_CAST_REMOVED);
        }

        this.soundTracker.playOnce(PLAYER_TAKE_UNARMED_DAMAGE);

        const destination = this.computeKnockbackDestination(attackerWorldX, attackerWorldY);
        if (!destination) {
            if (this.isMoving) {
                this.switchPlayerState(PlayerState.TakeDamageOnMove, true);
            } else {
                this.switchPlayerState(PlayerState.TakeDamage, true);
            }
            return;
        }

        this.applyKnockbackMovement(destination.destX, destination.destY);
        this.switchPlayerState(PlayerState.TakeDamageWithKnockback, true);
    }

    /**
     * Gets the attack range in cells.
     */
    public getAttackRange(): number {
        return this.attackRange;
    }

    /**
     * Sets the attack speed from slider value (1-100).
     * Maps to attack animation FPS: 5 (min) to 30 (max).
     */
    public setAttackSpeed(sliderValue: number): void {
        const clampedValue = Phaser.Math.Clamp(sliderValue, 1, 100);
        this.attackSpeed = 5 + (clampedValue / 100) * (30 - 5);
    }

    /**
     * Sets the attack range in cells (1-30).
     */
    public setAttackRange(range: number): void {
        this.attackRange = Phaser.Math.Clamp(range, 1, 30);
    }

    /**
     * Sets the player appearance transparency from slider value (0-100).
     * 0 = fully opaque, 100 = fully transparent.
     */
    public setTransparency(sliderValue: number): void {
        this.appearanceManager.setTransparency(sliderValue);
    }

    /**
     * Sets or clears chilled blue tint on all player appearance items.
     */
    public setChilledEffect(enabled: boolean): void {
        this.appearanceManager.setChilledEffect(enabled);
    }

    /**
     * Sets or clears berserk red overlay on body and equipment (excludes weapon, shield, accessory).
     */
    public setBerserkEffect(enabled: boolean): void {
        this.appearanceManager.setBerserkEffect(enabled);
    }

    /**
     * Sets the attack type (Interrupt or NoInterrupt).
     */
    public setAttackType(attackType: AttackType): void {
        this.attackType = attackType;
    }

    /**
     * Sets the damage dealt per attack (melee and bow). Clamped to 1-1000.
     */
    public setDamage(damage: number): void {
        this.damage = Phaser.Math.Clamp(damage, 1, 1000);
    }

    /**
     * Gets the current attack target (monster to pathfind towards when out of range).
     */
    public getAttackTarget(): Monster | undefined {
        return this.attackTarget;
    }

    /**
     * Clears the attack target (e.g., when target monster dies).
     */
    public clearAttackTarget(): void {
        this.attackTarget = undefined;
    }

    /**
     * Attempts to attack the specified monster.
     * When moving between cells: stores target so attack triggers when reaching next cell.
     * When in attack state or bow stance: rejects (no new commands).
     * When at cell and in range: switches to attack state (combat mode) or bow stance (peace mode).
     *
     * @param monster - The monster to attack
     */
    public attack(monster: Monster): void {
        if (this.isDead ||
            monster.getIsDead() ||
            this.isAttacking() ||
            this.isInBowStance() ||
            this.isCastReady() ||
            this.currentState === PlayerState.TakeDamage ||
            this.currentState === PlayerState.TakeDamageOnMove ||
            this.currentState === PlayerState.TakeDamageWithKnockback ||
            this.isStunlocked()) {
            return;
        }
        if (this.isMoving) {
            // Store target - processMovement will check range when we reach the next cell
            this.attackTarget = monster;
            return;
        }

        const distance = getDistance(this.worldX, this.worldY, monster.getWorldX(), monster.getWorldY());

        if (distance <= this.attackRange) {
            if (this.attackMode) {
                this.startAttack(monster);
            } else {
                this.startBowStance(monster);
            }
        } else {
            this.attackTarget = monster;
        }
    }

    /**
     * Starts the melee attack animation facing the monster.
     */
    private startAttack(monster: Monster): void {
        this.cancelMovement();
        this.attackTarget = monster;

        // Clear movement state when switching to attack; startAttack can be called from
        // processMovement() when reaching a cell (isMoving still true in that path). If we
        // don't clear it, after attack ends super.update() will run the movement block and
        // animate from the adjacent cell into the current cell.
        this.isMoving = false;
        this.offsetX = 0;
        this.offsetY = 0;

        const attackDirection = getNextDirection(this.worldX, this.worldY, monster.getWorldX(), monster.getWorldY());
        if (attackDirection !== Direction.None && attackDirection !== this.direction) {
            this.direction = attackDirection;
            this.updateDepth();
        }

        const weaponDef = getInventoryManager(this.scene.game).getEquippedWeaponDef();
        const attackState = weaponDef?.weaponType === WeaponType.BOW ? PlayerState.BowAttack : PlayerState.MeleeAttack;
        this.switchPlayerState(attackState, true);
        // Refresh sprite positions after state switch; different animation frames use different
        // pivot offsets which can cause a visual jump if base position isn't synced
        this.updatePixelPosition();
    }

    /**
     * Starts the bow stance animation facing the monster (peace mode only).
     * No damage is delivered; armaments are hidden during the animation.
     */
    private startBowStance(monster: Monster): void {
        this.cancelMovement();
        this.attackTarget = monster;

        this.isMoving = false;
        this.offsetX = 0;
        this.offsetY = 0;

        const attackDirection = getNextDirection(this.worldX, this.worldY, monster.getWorldX(), monster.getWorldY());
        if (attackDirection !== Direction.None && attackDirection !== this.direction) {
            this.direction = attackDirection;
            this.updateDepth();
        }

        this.switchPlayerState(PlayerState.BowStance, true);
        this.updatePixelPosition();
    }

    /**
     * Switches to PickUp state when the player clicks on their current cell.
     * Plays the pickup animation once at idle speed, then returns to idle.
     * Repeated clicks on the same cell will trigger PickUp again (looping).
     * Armaments are hidden during PickUp (no animations for them) and restored when returning to idle.
     */
    public requestPickUp(): void {
        if (this.isDead ||
            this.isAttacking() ||
            this.isInBowStance() ||
            this.isCasting() ||
            this.isCastReady() ||
            this.currentState === PlayerState.PickUp ||
            this.currentState === PlayerState.TakeDamageOnMove ||
            this.currentState === PlayerState.TakeDamageWithKnockback ||
            this.isStunlocked() ||
            this.isMoving) {
            return;
        }
        this.cancelMovement();
        this.switchPlayerState(PlayerState.PickUp, true);
    }

    /**
     * Turns the player to face the specified direction without moving.
     * Only allowed when idle (IdlePeaceMode or IdleCombatMode); blocked when in take damage, stunlock, or other states.
     */
    public turnTowardsDirection(direction: Direction): void {
        if (this.isDead ||
            (this.currentState !== PlayerState.IdlePeaceMode && this.currentState !== PlayerState.IdleCombatMode) ||
            direction === Direction.None ||
            this.isStunlocked()) {
            return;
        }

        if (this.direction !== direction) {
            this.direction = direction;
            this.updateDepth();
            this.switchToIdle();
        }
    }

    /**
     * Overrides beforeMove to enter dash mode when moving one cell toward attack target in run mode.
     */
    protected override beforeMove(direction: Direction): boolean {
        if (this.attackTarget?.getIsDead()) {
            this.attackTarget = undefined;
            return false;
        }
        if (!this.attackTarget || !this.attackMode || !this.runMode || !playerDialogStore.state.allowDashAttack) {
            return false;
        }
        const weaponDef = getInventoryManager(this.scene.game).getEquippedWeaponDef();
        if (weaponDef?.weaponType === WeaponType.BOW) {
            return false;
        }
        const distance = getDistance(this.worldX, this.worldY, this.attackTarget.getWorldX(), this.attackTarget.getWorldY());
        if (distance !== this.attackRange + 1) {
            return false;
        }
        this.dashMode = true;
        this.dashDamageDealt = false;
        this.move(direction);
        return true;
    }

    /**
     * Overrides processMovement to check attack range when reaching a cell.
     * If attack target is in range, attack instead of moving.
     */
    protected override processMovement(): void {
        if (this.isDead) {
            return;
        }
        if (this.dashMode) {
            this.dashMode = false;
            if (this.dashDamageDealt) {
                this.dashDamageDealt = false;
                if (this.attackTarget &&
                    !this.attackTarget.getIsDead() &&
                    this.currentState !== PlayerState.TakeDamage &&
                    this.currentState !== PlayerState.TakeDamageOnMove &&
                    this.currentState !== PlayerState.TakeDamageWithKnockback &&
                    !this.isStunlocked()) {
                    const distance = getDistance(this.worldX, this.worldY, this.attackTarget.getWorldX(), this.attackTarget.getWorldY());
                    if (distance <= this.attackRange) {
                        this.destinationX = -1;
                        this.destinationY = -1;
                        if (this.attackMode) {
                            this.startAttack(this.attackTarget);
                        } else {
                            this.startBowStance(this.attackTarget);
                        }
                        return;
                    }
                }
                this.attackTarget = undefined;
                super.processMovement();
                return;
            }
        }
        if (this.attackTarget?.getIsDead()) {
            this.attackTarget = undefined;
        }
        if (this.attackTarget &&
            this.currentState !== PlayerState.TakeDamage &&
            this.currentState !== PlayerState.TakeDamageOnMove &&
            this.currentState !== PlayerState.TakeDamageWithKnockback &&
            !this.isStunlocked()) {
            const distance = getDistance(this.worldX, this.worldY, this.attackTarget.getWorldX(), this.attackTarget.getWorldY());
            if (distance <= this.attackRange) {
                if (this.attackMode) {
                    this.startAttack(this.attackTarget);
                } else {
                    this.startBowStance(this.attackTarget);
                }
                return;
            }
        }
        super.processMovement();
    }

    /**
     * Overrides setDestination to reject when attacking.
     */
    public override setDestination(
        destinationX: number,
        destinationY: number,
        useDirectMovement: boolean = false,
        cameraCenterPixelX?: number,
        cameraCenterPixelY?: number,
        cursorPixelX?: number,
        cursorPixelY?: number
    ): void {
        if (this.isDead ||
            this.isAttacking() ||
            this.isInBowStance() ||
            this.isCasting() ||
            this.isCastReady() ||
            this.currentState === PlayerState.PickUp ||
            this.currentState === PlayerState.TakeDamageOnMove ||
            this.currentState === PlayerState.TakeDamageWithKnockback ||
            this.isStunlocked()) {
            return;
        }
        super.setDestination(destinationX, destinationY, useDirectMovement, cameraCenterPixelX, cameraCenterPixelY, cursorPixelX, cursorPixelY);
    }

    /**
     * Overrides cancelMovement to reject when attacking.
     */
    public override cancelMovement(): void {
        if (this.isAttacking() || this.isInBowStance()) {
            return;
        }
        super.cancelMovement();
    }

    /**
     * Overrides update to handle attack and take damage animation completion.
     */
    public override update(delta: number): void {
        if (this.isDead) {
            this.healthBarGraphics.setVisible(false);
            const accessoryAssetIndex = this.appearanceManager.getAccessoryAssetIndex();
            if (accessoryAssetIndex >= 0 &&
                this.appearanceManager.hasAccessory() &&
                this.assets[accessoryAssetIndex].sprite.visible &&
                !this.assets[accessoryAssetIndex].isAnimationPlaying()) {
                this.assets[accessoryAssetIndex].setVisible(false);
            }
            return;
        }
        this.updateHealthBar();
        this.updateStarTwinkle(delta);
        if ((this.currentState === PlayerState.MeleeAttack || this.currentState === PlayerState.BowAttack) && !this.dashMode) {
            if (!this.isPrimaryAssetAnimationPlaying()) {
                this.attackTarget = undefined;
                this.switchToIdle();
            }
            return;
        }

        if (this.currentState === PlayerState.BowStance && !this.isPrimaryAssetAnimationPlaying()) {
            this.attackTarget = undefined;
            this.switchToIdle();
            return;
        }

        if (this.currentState === PlayerState.PickUp && !this.isPrimaryAssetAnimationPlaying()) {
            EventBus.emit(ITEM_PICKUP_ATTEMPTED, { worldX: this.worldX, worldY: this.worldY });
            this.switchToIdle();
            return;
        }

        if (this.currentState === PlayerState.Cast && !this.isPrimaryAssetAnimationPlaying()) {
            this.switchPlayerState(PlayerState.CastReady);
            EventBus.emit(OUT_UI_CAST_READY);
            return;
        }

        if ((this.currentState === PlayerState.TakeDamage || this.currentState === PlayerState.TakeDamageOnMove) &&
            !this.isPrimaryAssetAnimationPlaying()) {
            if (this.isMoving) {
                this.setPendingStunlockAfterMovement();
                this.switchToMovement(true);
            } else {
                this.switchToIdle();
            }
        }

        if (this.currentState === PlayerState.TakeDamageWithKnockback && this.isKnockbackActive()) {
            this.updateKnockbackVisual(delta);
        }

        if (this.currentState === PlayerState.TakeDamageWithKnockback &&
            !this.isKnockbackActive() && !this.isPrimaryAssetAnimationPlaying()) {
            this.startStunlock();
            this.switchToIdle();
        }

        super.update(delta);

        this.updateStunlock(delta);
    }

    /**
     * When STAR_TWINKLE is equipped, spawns random sparkles above the player at intervals.
     */
    private updateStarTwinkle(delta: number): void {
        const inventoryManager = getInventoryManager(this.scene.game);
        if (!hasEquippedItemEffect(inventoryManager.equippedItems, ItemEffect.STAR_TWINKLE)) {
            this.starTwinkleAccumulatorMs = 0;
            return;
        }
        this.starTwinkleAccumulatorMs += delta;
        const nextIntervalMs = 150 + Phaser.Math.FloatBetween(0, 200);
        if (this.starTwinkleAccumulatorMs < nextIntervalMs) {
            return;
        }
        this.starTwinkleAccumulatorMs = 0;
        const px = this.getAnimatedPixelX();
        const py = this.getAnimatedPixelY();
        const offsetX = Phaser.Math.FloatBetween(-15, 15);
        const offsetY = Phaser.Math.FloatBetween(-60, 0);
        drawEffectAtPixelCoords(this.scene, px + offsetX, py + offsetY, EFFECT_SPARKLE, {
            usePlayerDepthForDepth: true,
            playerWorldY: this.worldY,
        });
    }

    /**
     * Implements abstract method from GameObject to switch state.
     * When switching to Idle after reaching a cell with a queued cast, executes the cast instead.
     */
    protected switchState(state: GameObjectState, forceUpdate: boolean = false): void {
        switch (state) {
            case GameObjectState.Idle:
                if (this.queuedCastSpellId !== undefined) {
                    // Player reached next cell with queued cast - stop run and switch to cast
                    const spellId = this.queuedCastSpellId;
                    const useAnimation = this.queuedCastUseAnimation;
                    this.queuedCastSpellId = undefined;
                    this.queuedCastUseAnimation = false;
                    this.pendingSpellId = spellId;
                    this.pendingUseCastAnimation = useAnimation;
                    this.switchPlayerState(PlayerState.Cast, true);
                    EventBus.emit(OUT_UI_CAST_STARTED);
                } else {
                    this.switchToIdle();
                }
                break;
            case GameObjectState.Move:
                if (this.dashMode) {
                    this.switchPlayerState(PlayerState.MeleeAttack, forceUpdate);
                } else {
                    this.switchToMovement(forceUpdate);
                }
                break;
        }
    }

    /**
     * Overrides hook method from GameObject to update GameStateManager when position changes.
     */
    protected override onPositionChanged(newX: number, newY: number): void {
        this.gameStateManager.setWorldPos(newX, newY);
        EventBus.emit(PLAYER_POSITION_CHANGED, { x: newX, y: newY });
    }

    /**
     * Overrides hook from GameObject. When player reaches a new cell while moving, spawns footsteps effect.
     * Uses wet splash when raining, otherwise dry footsteps.
     */
    protected override onCellReached(): void {
        if (!this.isDead && this.currentState === PlayerState.Run) {
            const weather = mapDialogStore.state.weather;
            const isRaining = weather === 'rain-light' || weather === 'rain-medium' || weather === 'rain-heavy';
            const effectKey = isRaining ? EFFECT_WET_SPLASH : EFFECT_FOOTSTEPS_DRY;
            drawEffect(this.scene, this.worldX, this.worldY, effectKey);
        }
        super.onCellReached();
    }

    /**
     * Returns true when in TakeDamageOnMove state.
     */
    protected override isInTakeDamageOnMoveState(): boolean {
        return this.currentState === PlayerState.TakeDamageOnMove;
    }

    /**
     * Clears destination when stunlock ends so player stays at cell.
     */
    protected override onStunlockComplete(): void {
        if (this.destinationX >= 0 && this.destinationY >= 0 && !this.isMoving) {
            this.destinationX = -1;
            this.destinationY = -1;
        }
    }

    /**
     * Updates the player's movement speed based on a slider value (0-100).
     */
    public setMovementSpeed(sliderValue: number): void {
        const clampedValue = Phaser.Math.Clamp(sliderValue, 0, 100);

        this.movementSpeed = clampedValue;
        this.runMovementSpeedDurationMs = 500 - (clampedValue / 100) * (500 - 100);
        this.frameRate = 5 + (clampedValue / 100) * (30 - 5);

        if (this.isInMovementState()) {
            this.switchToMovement(true);
        }
    }

    /**
     * Updates the player's cast speed based on a slider value (1-100).
     * Maps slider value to cast duration: 1 = 3000ms, 100 = 500ms.
     */
    public setCastSpeed(sliderValue: number): void {
        const clampedValue = Phaser.Math.Clamp(sliderValue, 1, 100);
        // Linear mapping: slider 1-100 maps to 3000ms-500ms
        // Formula: ms = 3000 - (sliderValue - 1) * (3000 - 500) / (100 - 1)
        this.castSpeed = 3000 - ((clampedValue - 1) * 2500) / 99;
    }

    /**
     * Renders the health bar 2 cells above the player.
     */
    private updateHealthBar(): void {
        const centerX = this.getAnimatedPixelX();
        const centerY = this.getAnimatedPixelY() - 2 * TILE_SIZE - 10;
        const left = centerX - PLAYER_HEALTH_BAR_WIDTH / 2;

        this.healthBarGraphics.setVisible(true);
        this.healthBarGraphics.setDepth(HIGH_DEPTH);
        this.healthBarGraphics.clear();

        // Background (dark)
        this.healthBarGraphics.fillStyle(0x333333, 1);
        this.healthBarGraphics.fillRect(left, centerY - PLAYER_HEALTH_BAR_HEIGHT / 2, PLAYER_HEALTH_BAR_WIDTH, PLAYER_HEALTH_BAR_HEIGHT);

        // Fill (red, proportional to hp/maxHp)
        const fillWidth = Math.max(0, PLAYER_HEALTH_BAR_WIDTH * (this.hp / this.maxHp));
        this.healthBarGraphics.fillStyle(0xff0000, 1);
        this.healthBarGraphics.fillRect(left, centerY - PLAYER_HEALTH_BAR_HEIGHT / 2, fillWidth, PLAYER_HEALTH_BAR_HEIGHT);

        // Dark red border
        this.healthBarGraphics.lineStyle(1, 0x660000, 1);
        this.healthBarGraphics.strokeRect(left, centerY - PLAYER_HEALTH_BAR_HEIGHT / 2, PLAYER_HEALTH_BAR_WIDTH, PLAYER_HEALTH_BAR_HEIGHT);
    }

    /**
     * Creates the casting circle effect at the player's location.
     * Effect duration matches castSpeed and does not loop.
     */
    private createCastingCircleEffect(): void {
        // Get the effect config to determine frame count
        const effectConfig = getEffectByKey(EFFECT_CASTING_CIRCLE);
        if (!effectConfig) {
            return;
        }

        // Get texture to determine frame count
        const textureKey = `sprite-${effectConfig.sprite}-${effectConfig.spriteSheetIndex}`;
        const texture = this.scene.textures.get(textureKey);
        if (!texture) {
            return;
        }

        const frameCount = Object.keys(texture.frames).length;
        if (frameCount === 0) {
            return;
        }

        // Calculate frame rate to match castSpeed duration
        const frameRate = calculateFrameRateFromDuration(frameCount, this.castSpeed);

        // Create the effect with calculated frame rate, no looping
        this.castingCircleEffect = drawEffect(
            this.scene,
            this.worldX,
            this.worldY,
            EFFECT_CASTING_CIRCLE,
            {
                soundManager: this.soundManager,
                playerWorldX: this.worldX,
                playerWorldY: this.worldY,
                infiniteLoop: false,
                frameRate: frameRate,
            }
        );
    }

    /**
     * Destroys the casting circle effect if it exists.
     */
    private destroyCastingCircleEffect(): void {
        if (this.castingCircleEffect) {
            this.castingCircleEffect.destroy();
            this.castingCircleEffect = undefined;
        }
    }

    /**
     * Creates a floating text with the spell name above the player in green color.
     * Positioned 3 cells above the player, similar to damage text.
     */
    private createSpellNameFloatingText(): void {
        const spellId = this.pendingSpellId ?? this.queuedCastSpellId;
        if (spellId === undefined) {
            return;
        }

        const spellConfig = getSpellById(spellId);
        if (!spellConfig) {
            return;
        }

        new FloatingText(this.scene, {
            text: spellConfig.name,
            x: this.getAnimatedPixelX(),
            y: this.getAnimatedPixelY() - 3 * TILE_SIZE + 20,
            fontSize: 16,
            color: '#00ff00',
            bold: true,
            horizontalOffset: -2,
            upwardTravelPxPerSec: 30,
            totalDurationMs: 2000,
            fadeDurationMs: 1000,
        });
    }

    /**
     * Destroys the player and all associated resources including the shadow sprite.
     */
    public destroy(): void {
        if (this.equipItemHandler) {
            EventBus.off(EQUIP_ITEM, this.equipItemHandler);
        }
        if (this.genderChangeHandler) {
            EventBus.off(IN_UI_CHANGE_GENDER, this.genderChangeHandler);
        }
        if (this.skinColorChangeHandler) {
            EventBus.off(IN_UI_CHANGE_SKIN_COLOR, this.skinColorChangeHandler);
        }
        if (this.underwearColorChangeHandler) {
            EventBus.off(IN_UI_CHANGE_UNDERWEAR_COLOR, this.underwearColorChangeHandler);
        }
        if (this.hairStyleChangeHandler) {
            EventBus.off(IN_UI_CHANGE_HAIR_STYLE, this.hairStyleChangeHandler);
        }
        this.destroyCastingCircleEffect();
        this.healthBarGraphics.destroy();
        super.destroy();
    }
}
