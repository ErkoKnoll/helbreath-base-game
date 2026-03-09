import { EventBus } from '../game/EventBus';
import {
    OUT_UI_SET_MOVEMENT_SPEED,
    OUT_UI_SET_CAMERA_ZOOM,
    OUT_UI_SET_MUSIC_VOLUME,
    OUT_UI_SET_SOUND_VOLUME,
    OUT_UI_SET_SELECTED_MAP,
    OUT_UI_SET_ATTACK_SPEED,
    OUT_UI_SET_ATTACK_RANGE,
    OUT_UI_SET_ATTACK_TYPE,
    OUT_UI_SET_CAST_SPEED,
    OUT_UI_SET_ATTACK_MODE,
    OUT_UI_SET_RUN_MODE,
    OUT_UI_SET_GENDER,
    OUT_UI_SET_SKIN_COLOR,
    OUT_UI_SET_UNDERWEAR_COLOR,
    OUT_UI_SET_HAIR_STYLE,
} from '../constants/EventNames';
import { DEFAULT_PLAYER_ATTACK_SPEED, DEFAULT_PLAYER_ATTACK_RANGE } from '../Config';
import { AttackType, Gender, SkinColor } from '../Types';
import { ItemTypes, type InventoryItem, type EquipmentSlot } from '../constants/Items';

/**
 * Represents the saved game state structure stored in localStorage.
 */
interface GameStateStorage {
    /** X coordinate in world map position */
    worldPosX: number;
    /** Y coordinate in world map position */
    worldPosY: number;
    /** Map name the player is currently on */
    map: string;
    /** Movement speed slider value (0-100) */
    movementSpeed: number;
    /** Attack speed slider value (1-100) */
    attackSpeed: number;
    /** Attack range in cells (1-20) */
    attackRange: number;
    /** Attack type (Interrupt or NoInterrupt) */
    attackType?: AttackType;
    /** Cast speed slider value (1-100) */
    castSpeed: number;
    /** Attack mode enabled (true = combat stance when idle, false = peace stance) */
    attackMode?: boolean;
    /** Run mode enabled (true = run, false = walk at half speed) */
    runMode?: boolean;
    /** Player gender (male or female) for appearance */
    gender?: Gender;
    /** Player skin color (light, tanned, dark) for base sprite variant */
    skinColor?: SkinColor;
    /** Underwear color index (0-7) for mpt/wpt sprite sheet offset */
    underwearColorIndex?: number;
    /** Hair style: 0-7 = Style 1-8. Index 2 renders no hair. */
    hairStyleIndex?: number;
    /** Camera zoom level as percentage (20-200, where 100 = zoom 1.0) */
    cameraZoom: number;
    /** Music volume (0-100) */
    musicVolume: number;
    /** Sound volume (0-100) */
    soundVolume: number;
    /** Equipped items by equipment slot */
    equippedItems?: Partial<Record<EquipmentSlot, InventoryItem>>;
    /** Items in the bag */
    baggedItems?: InventoryItem[];
    /** Next itemUid for newly created items */
    nextItemUid?: number;
}

/**
 * Manages game state persistence to localStorage.
 * Provides methods to update individual state fields and save the complete state.
 */
export class GameStateManager {
    /** X coordinate in world map position */
    private worldPosX = -1;
    /** Y coordinate in world map position */
    private worldPosY = -1;
    /** Map name the player is currently on */
    private map = 'aresden.amd';
    /** Movement speed slider value (0-100) */
    private movementSpeed = 80;
    /** Attack speed slider value (1-100) */
    private attackSpeed = DEFAULT_PLAYER_ATTACK_SPEED;
    /** Attack range in cells (1-20) */
    private attackRange = DEFAULT_PLAYER_ATTACK_RANGE;
    /** Attack type (Interrupt or NoInterrupt) */
    private attackType = AttackType.Interrupt;
    /** Cast speed slider value (1-100), default 60 maps to 1500ms */
    private castSpeed = 60;
    /** Attack mode enabled (true = combat stance when idle, false = peace stance). Default true. */
    private attackMode = true;
    /** Run mode enabled (true = run, false = walk at half speed). Default true. */
    private runMode = true;
    /** Player gender (male or female). Default male. */
    private gender = Gender.MALE;
    /** Player skin color (light, tanned, dark). Default light. */
    private skinColor = SkinColor.Light;
    /** Underwear color index (0-7). Default 0. */
    private underwearColorIndex = 0;
    /** Hair style: 0-7 = Style 1-8. Index 2 renders no hair. Default 0. */
    private hairStyleIndex = 0;
    /** Camera zoom level as percentage (20-200, where 100 = zoom 1.0) */
    private cameraZoom = 100;
    /** Music volume (0-100) */
    private musicVolume = 50;
    /** Sound volume (0-100) */
    private soundVolume = 50;

    /** Equipped items by equipment slot */
    private equippedItems: Partial<Record<EquipmentSlot, InventoryItem>> = {};
    /** Items in the bag */
    private baggedItems: InventoryItem[] = [];
    /** Next itemUid for newly created items */
    private nextItemUid = 0;

    private readonly STORAGE_KEY = 'gameState';

    /** Initial equipped items when game state is first created (no localStorage). */
    private static createInitialInventory(): {
        equippedItems: Partial<Record<EquipmentSlot, InventoryItem>>;
        baggedItems: InventoryItem[];
        nextItemUid: number;
    } {
        let uid = 0;
        const equippedItems: Partial<Record<EquipmentSlot, InventoryItem>> = {
            [ItemTypes.WEAPON]: { itemId: 1, itemUid: uid++ },
            [ItemTypes.ARMOR]: { itemId: 8, itemUid: uid++ },
            [ItemTypes.HAUBERK]: { itemId: 10, itemUid: uid++ },
            [ItemTypes.LEGGINGS]: { itemId: 13, itemUid: uid++ },
            [ItemTypes.HELMET]: { itemId: 15, itemUid: uid++ },
            [ItemTypes.CAPE]: { itemId: 23, itemUid: uid++ },
        };
        return { equippedItems, baggedItems: [], nextItemUid: uid };
    }

    constructor() {
        // Load all fields from localStorage
        try {
            const gameStateJson = localStorage.getItem(this.STORAGE_KEY);
            if (gameStateJson) {
                // localStorage returns string; JSON.parse returns unknown. Cast to Partial<GameStateStorage>
                // after parse - we validate each field below before use.
                const gameState = JSON.parse(gameStateJson) as Partial<GameStateStorage>;
                this.worldPosX = gameState.worldPosX ?? this.worldPosX;
                this.worldPosY = gameState.worldPosY ?? this.worldPosY;
                this.map = gameState.map ?? this.map;
                // Validate ranges and use defaults if invalid
                this.movementSpeed = (gameState.movementSpeed !== undefined && gameState.movementSpeed >= 0 && gameState.movementSpeed <= 100)
                    ? gameState.movementSpeed
                    : this.movementSpeed;
                this.attackSpeed = (gameState.attackSpeed !== undefined && gameState.attackSpeed >= 1 && gameState.attackSpeed <= 100)
                    ? gameState.attackSpeed
                    : this.attackSpeed;
                this.attackRange = (gameState.attackRange !== undefined && gameState.attackRange >= 1 && gameState.attackRange <= 20)
                    ? gameState.attackRange
                    : this.attackRange;
                this.attackType = (gameState.attackType === AttackType.NoInterrupt ||
                    gameState.attackType === AttackType.Interrupt ||
                    gameState.attackType === AttackType.InterruptKnockback)
                    ? gameState.attackType
                    : this.attackType;
                this.castSpeed = (gameState.castSpeed !== undefined && gameState.castSpeed >= 1 && gameState.castSpeed <= 100)
                    ? gameState.castSpeed
                    : this.castSpeed;
                this.attackMode = gameState.attackMode !== undefined ? gameState.attackMode : this.attackMode;
                this.runMode = gameState.runMode !== undefined ? gameState.runMode : this.runMode;
                this.gender = (gameState.gender === Gender.MALE || gameState.gender === Gender.FEMALE)
                    ? gameState.gender
                    : this.gender;
                this.skinColor = (gameState.skinColor === SkinColor.Light || gameState.skinColor === SkinColor.Tanned || gameState.skinColor === SkinColor.Dark)
                    ? gameState.skinColor
                    : this.skinColor;
                this.underwearColorIndex = (gameState.underwearColorIndex !== undefined && gameState.underwearColorIndex >= 0 && gameState.underwearColorIndex <= 7)
                    ? gameState.underwearColorIndex
                    : this.underwearColorIndex;
                this.hairStyleIndex = (gameState.hairStyleIndex !== undefined && gameState.hairStyleIndex >= 0 && gameState.hairStyleIndex <= 7)
                    ? gameState.hairStyleIndex
                    : (gameState.hairStyleIndex === -1)
                        ? 2
                        : this.hairStyleIndex;
                this.cameraZoom = (gameState.cameraZoom !== undefined && gameState.cameraZoom >= 20 && gameState.cameraZoom <= 200)
                    ? gameState.cameraZoom
                    : this.cameraZoom;
                this.musicVolume = (gameState.musicVolume !== undefined && gameState.musicVolume >= 0 && gameState.musicVolume <= 100)
                    ? gameState.musicVolume
                    : this.musicVolume;
                this.soundVolume = (gameState.soundVolume !== undefined && gameState.soundVolume >= 0 && gameState.soundVolume <= 100)
                    ? gameState.soundVolume
                    : this.soundVolume;
                // Load inventory from saved state (use initial inventory if save has no inventory data)
                const hasInventoryData =
                    (gameState.equippedItems && typeof gameState.equippedItems === 'object') ||
                    Array.isArray(gameState.baggedItems) ||
                    (typeof gameState.nextItemUid === 'number' && gameState.nextItemUid >= 0);
                if (hasInventoryData) {
                    if (gameState.equippedItems && typeof gameState.equippedItems === 'object') {
                        this.equippedItems = gameState.equippedItems;
                    }
                    if (Array.isArray(gameState.baggedItems)) {
                        this.baggedItems = gameState.baggedItems;
                    }
                    if (typeof gameState.nextItemUid === 'number' && gameState.nextItemUid >= 0) {
                        this.nextItemUid = gameState.nextItemUid;
                    }
                } else {
                    const initial = GameStateManager.createInitialInventory();
                    this.equippedItems = initial.equippedItems;
                    this.baggedItems = initial.baggedItems;
                    this.nextItemUid = initial.nextItemUid;
                }
            } else {
                // No saved state: use initial inventory (weapon, armor, hauberk, leggings, helmet, cape)
                const initial = GameStateManager.createInitialInventory();
                this.equippedItems = initial.equippedItems;
                this.baggedItems = initial.baggedItems;
                this.nextItemUid = initial.nextItemUid;
            }
        } catch (error) {
            console.warn('[GameStateManager] Failed to load game state from localStorage:', error);
        }

        // Emit events to sync React layer state
        EventBus.emit(OUT_UI_SET_MOVEMENT_SPEED, this.movementSpeed);
        EventBus.emit(OUT_UI_SET_ATTACK_SPEED, this.attackSpeed);
        EventBus.emit(OUT_UI_SET_ATTACK_RANGE, this.attackRange);
        EventBus.emit(OUT_UI_SET_ATTACK_TYPE, this.attackType);
        EventBus.emit(OUT_UI_SET_CAST_SPEED, this.castSpeed);
        EventBus.emit(OUT_UI_SET_ATTACK_MODE, this.attackMode);
        EventBus.emit(OUT_UI_SET_RUN_MODE, this.runMode);
        EventBus.emit(OUT_UI_SET_GENDER, this.gender);
        EventBus.emit(OUT_UI_SET_SKIN_COLOR, this.skinColor);
        EventBus.emit(OUT_UI_SET_UNDERWEAR_COLOR, this.underwearColorIndex);
        EventBus.emit(OUT_UI_SET_HAIR_STYLE, this.hairStyleIndex);
        EventBus.emit(OUT_UI_SET_CAMERA_ZOOM, this.cameraZoom);
        EventBus.emit(OUT_UI_SET_MUSIC_VOLUME, this.musicVolume);
        EventBus.emit(OUT_UI_SET_SOUND_VOLUME, this.soundVolume);
        EventBus.emit(OUT_UI_SET_SELECTED_MAP, this.map);
    }

    /**
     * Saves the current game state to localStorage.
     */
    public saveGameState(): void {
        try {
            const gameState: GameStateStorage = {
                worldPosX: this.worldPosX,
                worldPosY: this.worldPosY,
                map: this.map,
                movementSpeed: this.movementSpeed,
                attackSpeed: this.attackSpeed,
                attackRange: this.attackRange,
                attackType: this.attackType,
                castSpeed: this.castSpeed,
                attackMode: this.attackMode,
                runMode: this.runMode,
                gender: this.gender,
                skinColor: this.skinColor,
                underwearColorIndex: this.underwearColorIndex,
                hairStyleIndex: this.hairStyleIndex,
                cameraZoom: this.cameraZoom,
                musicVolume: this.musicVolume,
                soundVolume: this.soundVolume,
                equippedItems: this.equippedItems,
                baggedItems: this.baggedItems,
                nextItemUid: this.nextItemUid,
            };
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(gameState));
            console.log('[GameStateManager] Saved game state:', gameState);
        } catch (error) {
            console.warn('[GameStateManager] Failed to save game state to localStorage:', error);
        }
    }

    /**
     * Sets the world position.
     * Call this every time player position changes.
     */
    public setWorldPos(x: number, y: number): void {
        this.worldPosX = x;
        this.worldPosY = y;
    }

    /**
     * Sets the current map name.
     * Call this every time map changes.
     */
    public setMap(map: string): void {
        this.map = map;
    }

    /**
     * Sets the movement speed slider value (0-100).
     * Call this every time the movement speed slider changes.
     */
    public setMovementSpeed(speed: number): void {
        this.movementSpeed = speed >= 0 && speed <= 100 ? speed : this.movementSpeed;
    }

    /**
     * Sets the attack speed slider value (1-100).
     * Call this every time the attack speed slider changes.
     */
    public setAttackSpeed(speed: number): void {
        this.attackSpeed = speed >= 1 && speed <= 100 ? speed : this.attackSpeed;
    }

    /**
     * Sets the attack range in cells (1-20).
     * Call this every time the attack range slider changes.
     */
    public setAttackRange(range: number): void {
        this.attackRange = range >= 1 && range <= 20 ? range : this.attackRange;
    }

    /**
     * Sets the attack type (Interrupt or NoInterrupt).
     */
    public setAttackType(attackType: AttackType): void {
        this.attackType = attackType;
    }

    /**
     * Sets the cast speed slider value (1-100).
     * Call this every time the cast speed slider changes.
     */
    public setCastSpeed(speed: number): void {
        this.castSpeed = speed >= 1 && speed <= 100 ? speed : this.castSpeed;
    }

    /**
     * Sets attack mode (true = combat stance when idle, false = peace stance).
     */
    public setAttackMode(enabled: boolean): void {
        this.attackMode = enabled;
    }

    /**
     * Sets run mode (true = run, false = walk at half speed).
     */
    public setRunMode(enabled: boolean): void {
        this.runMode = enabled;
    }

    /**
     * Sets the player gender (male or female).
     */
    public setGender(gender: Gender): void {
        this.gender = gender;
    }

    /**
     * Sets the player skin color (light, tanned, dark).
     */
    public setSkinColor(skinColor: SkinColor): void {
        this.skinColor = skinColor;
    }

    /**
     * Sets the underwear color index (0-7).
     */
    public setUnderwearColorIndex(index: number): void {
        this.underwearColorIndex = Math.max(0, Math.min(7, index));
    }

    /**
     * Sets the hair style index (0-7 = Style 1-8). Index 2 renders no hair.
     */
    public setHairStyleIndex(index: number): void {
        this.hairStyleIndex = index < 0 ? 0 : index > 7 ? 7 : index;
    }

    /**
     * Sets the camera zoom level as percentage (20-200, where 100 = zoom 1.0).
     * Call this every time camera zoom changes.
     */
    public setCameraZoom(zoom: number): void {
        this.cameraZoom = zoom >= 20 && zoom <= 200 ? zoom : this.cameraZoom;
    }

    /**
     * Sets the music volume (0-100).
     * Call this every time music volume slider changes.
     */
    public setMusicVolume(volume: number): void {
        this.musicVolume = volume >= 0 && volume <= 100 ? volume : this.musicVolume;
    }

    /**
     * Gets the world X coordinate.
     */
    public getWorldPosX(): number {
        return this.worldPosX;
    }

    /**
     * Gets the world Y coordinate.
     */
    public getWorldPosY(): number {
        return this.worldPosY;
    }

    /**
     * Gets the current map name.
     */
    public getMap(): string {
        return this.map;
    }

    /**
     * Gets the movement speed slider value (0-100).
     */
    public getMovementSpeed(): number {
        return this.movementSpeed;
    }

    /**
     * Gets the attack speed slider value (1-100).
     */
    public getAttackSpeed(): number {
        return this.attackSpeed;
    }

    /**
     * Gets the attack range in cells (1-20).
     */
    public getAttackRange(): number {
        return this.attackRange;
    }

    /**
     * Gets the attack type (Interrupt or NoInterrupt).
     */
    public getAttackType(): AttackType {
        return this.attackType;
    }

    /**
     * Gets the cast speed slider value (1-100).
     */
    public getCastSpeed(): number {
        return this.castSpeed;
    }

    /**
     * Gets attack mode (true = combat stance when idle, false = peace stance).
     */
    public getAttackMode(): boolean {
        return this.attackMode;
    }

    /**
     * Gets run mode (true = run, false = walk at half speed).
     */
    public getRunMode(): boolean {
        return this.runMode;
    }

    /**
     * Gets the player gender (male or female).
     */
    public getGender(): Gender {
        return this.gender;
    }

    /**
     * Gets the player skin color (light, tanned, dark).
     */
    public getSkinColor(): SkinColor {
        return this.skinColor;
    }

    /**
     * Gets the underwear color index (0-7).
     */
    public getUnderwearColorIndex(): number {
        return this.underwearColorIndex;
    }

    /**
     * Gets the hair style index (0-7 = Style 1-8). Index 2 renders no hair.
     */
    public getHairStyleIndex(): number {
        return this.hairStyleIndex;
    }

    /**
     * Gets the camera zoom level as percentage (20-200, where 100 = zoom 1.0).
     */
    public getCameraZoom(): number {
        return this.cameraZoom;
    }

    /**
     * Gets the music volume (0-100).
     */
    public getMusicVolume(): number {
        return this.musicVolume;
    }

    /**
     * Sets the sound volume (0-100).
     * Call this every time sound volume slider changes.
     */
    public setSoundVolume(volume: number): void {
        this.soundVolume = volume >= 0 && volume <= 100 ? volume : this.soundVolume;
    }

    /**
     * Gets the sound volume (0-100).
     */
    public getSoundVolume(): number {
        return this.soundVolume;
    }

    /**
     * Gets the current inventory state (equipped items, bagged items, next item UID).
     */
    public getInventoryState(): {
        equippedItems: Partial<Record<EquipmentSlot, InventoryItem>>;
        baggedItems: InventoryItem[];
        nextItemUid: number;
    } {
        return {
            equippedItems: { ...this.equippedItems },
            baggedItems: [...this.baggedItems],
            nextItemUid: this.nextItemUid,
        };
    }

    /**
     * Sets the inventory state and persists to localStorage.
     * Call this whenever inventory changes (equip, unequip, add to bag, etc.).
     */
    public setInventoryState(
        equippedItems: Partial<Record<EquipmentSlot, InventoryItem>>,
        baggedItems: InventoryItem[],
        nextItemUid: number,
    ): void {
        this.equippedItems = { ...equippedItems };
        this.baggedItems = [...baggedItems];
        this.nextItemUid = nextItemUid;
    }
}
