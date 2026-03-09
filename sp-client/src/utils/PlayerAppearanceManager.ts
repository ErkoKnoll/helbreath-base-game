import type { GameAssetConfig } from '../game/objects/GameAsset';
import { AnimationType, GameAsset } from '../game/objects/GameAsset';
import type { Direction } from './CoordinateUtils';
import { Gender, SkinColor } from '../Types';
import { DEFAULT_ANIMATION_FRAME_RATE, DEPTH_MULTIPLIER } from '../Config';
import { calculateFrameRateFromDuration } from './AnimationUtils';
import { getItemByEquippedSprite, getItemById, ITEMS, ItemTypes, mergeItemEffects, WEAPON_SPRITE_OVERWRITES, type Effect } from '../constants/Items';
import type { ShadowManager } from './ShadowManager';

export enum PlayerState {
    IdlePeaceMode = 0,
    IdleCombatMode = 1,
    WalkPeaceMode = 2,
    WalkCombatMode = 3,
    Run = 4,
    BowStance = 5,
    MeleeAttack = 6,
    BowAttack = 7,
    Cast = 8,
    PickUp = 9,
    TakeDamage = 10,
    TakeDamageOnMove = 11,
    Die = 12,
    TakeDamageWithKnockback = 13,
    CastReady = 14,
}

type GearSlot = 'human' | 'hair' | 'underwear' | 'hauberk' | 'leggings' | 'boots' | 'helm' | 'armor' | 'weapon' | 'cape' | 'shield' | 'accessory';
type EquippedItems = Partial<Record<ItemTypes, { itemId: number; effectOverrides?: Effect[] }>>;

export type GearConfig = {
    human: string;
    underwear?: string;
    /** Underwear color index (0-7). 12 sprite sheets per color. */
    underwearColorIndex?: number;
    /** Hair style: 0-7 = Style 1-8. Index 2 renders no hair. 12 sprite sheets per style. */
    hairStyleIndex?: number;
    hauberk?: string;
    helm?: string;
    leggings?: string;
    boots?: string;
    armor?: string;
    cape?: string;
    weapon?: string;
    weaponStartSpriteSheetIndex?: number;
    shield?: string;
    shieldStartSpriteSheetIndex?: number;
    accessory?: string;
};

export const DEFAULT_GEAR: GearConfig = {
    human: 'wm',
    underwear: undefined,
    underwearColorIndex: 0,
    hairStyleIndex: 0,
    hauberk: undefined,
    helm: undefined,
    leggings: undefined,
    boots: undefined,
    armor: undefined,
    cape: undefined,
    weapon: undefined,
    shield: undefined,
    accessory: undefined,
};

type PlayerAssetIndices = {
    weaponAssetIndex: number;
    shieldAssetIndex: number;
    armorAssetIndex: number;
    hauberkAssetIndex: number;
    leggingsAssetIndex: number;
    bootsAssetIndex: number;
    helmAssetIndex: number;
    capeAssetIndex: number;
    accessoryAssetIndex: number;
    humanAssetIndex: number;
    hairAssetIndex: number;
    underwearAssetIndex: number;
};

export type BuildPlayerAssetConfigsResult = {
    configs: Omit<GameAssetConfig, 'x' | 'y'>[];
    assetIndices: PlayerAssetIndices;
};

export type PlayerAppearanceAnimationConfig = {
    movementFrameRate: number;
    attackSpeed: number;
    castSpeed: number;
    idleFrameRate: number;
};

const ARMOUR_SPRITESHEET_BASE: Record<PlayerState, number> = {
    [PlayerState.IdlePeaceMode]: 0,
    [PlayerState.IdleCombatMode]: 1,
    [PlayerState.WalkPeaceMode]: 2,
    [PlayerState.WalkCombatMode]: 3,
    [PlayerState.Run]: 4,
    [PlayerState.BowStance]: 5,
    [PlayerState.MeleeAttack]: 6,
    [PlayerState.BowAttack]: 7,
    [PlayerState.Cast]: 8,
    [PlayerState.PickUp]: 9,
    [PlayerState.TakeDamage]: 10,
    [PlayerState.TakeDamageOnMove]: 10,
    [PlayerState.Die]: 11,
    [PlayerState.TakeDamageWithKnockback]: 10,
    [PlayerState.CastReady]: 1,
};

const PLAYER_ANIMATION_FRAME_COUNT: Record<PlayerState, number> = {
    [PlayerState.IdlePeaceMode]: 8,
    [PlayerState.IdleCombatMode]: 8,
    [PlayerState.WalkPeaceMode]: 8,
    [PlayerState.WalkCombatMode]: 8,
    [PlayerState.Run]: 8,
    [PlayerState.BowStance]: 8,
    [PlayerState.MeleeAttack]: 8,
    [PlayerState.BowAttack]: 8,
    [PlayerState.Cast]: 16,
    [PlayerState.PickUp]: 4,
    [PlayerState.TakeDamage]: 4,
    [PlayerState.TakeDamageOnMove]: 4,
    [PlayerState.Die]: 8,
    [PlayerState.TakeDamageWithKnockback]: 4,
    [PlayerState.CastReady]: 8,
};

const ARMAMENT_STATE_INDEX: Record<PlayerState, number> = {
    [PlayerState.IdlePeaceMode]: 0,
    [PlayerState.IdleCombatMode]: 1,
    [PlayerState.WalkPeaceMode]: 2,
    [PlayerState.WalkCombatMode]: 3,
    [PlayerState.Run]: 6,
    [PlayerState.BowStance]: -1,
    [PlayerState.MeleeAttack]: 4,
    [PlayerState.BowAttack]: 4,
    [PlayerState.Cast]: -1,
    [PlayerState.PickUp]: -1,
    [PlayerState.TakeDamage]: 5,
    [PlayerState.TakeDamageOnMove]: 5,
    [PlayerState.Die]: -1,
    [PlayerState.TakeDamageWithKnockback]: 5,
    [PlayerState.CastReady]: 1,
};

const HUMAN_SPRITESHEET_BASE: Record<PlayerState, number> = {
    [PlayerState.IdlePeaceMode]: 0,
    [PlayerState.IdleCombatMode]: 8,
    [PlayerState.WalkPeaceMode]: 16,
    [PlayerState.WalkCombatMode]: 24,
    [PlayerState.Run]: 32,
    [PlayerState.BowStance]: 40,
    [PlayerState.MeleeAttack]: 48,
    [PlayerState.BowAttack]: 56,
    [PlayerState.Cast]: 64,
    [PlayerState.PickUp]: 72,
    [PlayerState.TakeDamage]: 80,
    [PlayerState.TakeDamageOnMove]: 80,
    [PlayerState.Die]: 88,
    [PlayerState.TakeDamageWithKnockback]: 80,
    [PlayerState.CastReady]: 8,
};

const ANGELIC_STATE_FROM_PLAYER_STATE: Record<PlayerState, number> = {
    [PlayerState.IdlePeaceMode]: 5,
    [PlayerState.IdleCombatMode]: 5,
    [PlayerState.WalkPeaceMode]: 5,
    [PlayerState.WalkCombatMode]: 5,
    [PlayerState.Run]: 5,
    [PlayerState.BowStance]: 5,
    [PlayerState.MeleeAttack]: 0,
    [PlayerState.BowAttack]: 0,
    [PlayerState.Cast]: 4,
    [PlayerState.PickUp]: 5,
    [PlayerState.TakeDamage]: 2,
    [PlayerState.TakeDamageOnMove]: 2,
    [PlayerState.Die]: 3,
    [PlayerState.TakeDamageWithKnockback]: 2,
    [PlayerState.CastReady]: 5,
};

const ANGELIC_STATE_FRAME_COUNT: Record<number, number> = {
    0: 8,
    1: 8,
    2: 4,
    3: 8,
    4: 16,
    5: 4,
};

const MANTLE_DRAWING_ORDER = [1, 1, 1, 0, 0, 0, 2, 2] as const;
const MANTLE_DRAWING_ORDER_ON_RUN = [1, 1, 1, 1, 1, 1, 1, 1] as const;

function getGearRenderOrder(direction: Direction, isRunning: boolean): readonly GearSlot[] {
    const dirIndex = Math.max(0, Math.min(7, direction));
    let mantleOrder = (isRunning ? MANTLE_DRAWING_ORDER_ON_RUN : MANTLE_DRAWING_ORDER)[dirIndex];
    if (!isRunning && direction === 7) {
        mantleOrder = 1;
    }
    if (isRunning && direction === 6) {
        mantleOrder = 2;
    }
    const shieldBeforeWeapon = (!isRunning && (direction === 1 || direction === 2 || direction === 3 || direction === 4)) || (isRunning && (direction === 2 || direction === 3));
    const weaponShield = shieldBeforeWeapon ? (['shield', 'weapon'] as const) : (['weapon', 'shield'] as const);
    const accessorySuffix = ['accessory'] as const;
    if (!isRunning && direction === 2) {
        return ['human', 'hair', 'underwear', 'hauberk', 'leggings', 'boots', 'helm', 'armor', 'shield', 'cape', 'weapon', ...accessorySuffix];
    }
    if (isRunning && direction === 6) {
        return ['human', 'hair', 'underwear', 'hauberk', 'leggings', 'boots', 'helm', 'armor', 'weapon', 'cape', 'shield', ...accessorySuffix];
    }
    switch (mantleOrder) {
        case 0:
            return ['human', 'hair', 'underwear', 'cape', 'hauberk', 'leggings', 'boots', 'helm', 'armor', ...weaponShield, ...accessorySuffix];
        case 1:
            return ['human', 'hair', 'underwear', 'hauberk', 'leggings', 'boots', 'helm', 'armor', ...weaponShield, 'cape', ...accessorySuffix];
        case 2:
            return ['human', 'hair', 'underwear', 'hauberk', 'leggings', 'boots', 'helm', 'armor', 'cape', ...weaponShield, ...accessorySuffix];
        default:
            return ['human', 'hair', 'underwear', 'hauberk', 'leggings', 'boots', 'helm', 'armor', ...weaponShield, 'cape', ...accessorySuffix];
    }
}

/**
 * Manages player visual appearance: gear layers, animations, and state-to-sprite mapping.
 * Builds and updates GameAsset configs for human, armor, weapon, shield, cape, etc., with correct
 * render order and sprite sheet indices per PlayerState.
 */
export class PlayerAppearanceManager {
    private readonly assets: GameAsset[];
    private gender: Gender;
    private humanSpriteName: string;
    private hauberk: string | undefined;
    private helm: string | undefined;
    private leggings: string | undefined;
    private boots: string | undefined;
    private cape: string | undefined;
    private armor: string | undefined;
    private weapon: string | undefined;
    private shield: string | undefined;
    private accessory: string | undefined;
    private accessoryOffsetX: number = 0;
    private accessoryOffsetY: number = 0;
    private weaponStartSpriteSheetIndex: number | undefined;
    private shieldStartSpriteSheetIndex: number | undefined;
    private readonly weaponAssetIndex: number;
    private readonly shieldAssetIndex: number;
    private readonly armorAssetIndex: number;
    private readonly hauberkAssetIndex: number;
    private readonly leggingsAssetIndex: number;
    private readonly bootsAssetIndex: number;
    private readonly helmAssetIndex: number;
    private readonly capeAssetIndex: number;
    private readonly accessoryAssetIndex: number;
    private readonly humanAssetIndex: number;
    private readonly hairAssetIndex: number;
    private readonly underwearAssetIndex: number;
    private underwearColorIndex: number;
    private hairStyleIndex: number;

    private isChilled: boolean = false;
    private isBerserked: boolean = false;

    public constructor(
        assets: GameAsset[],
        initialGender: Gender,
        resolvedGear: GearConfig,
        assetIndices: PlayerAssetIndices,
    ) {
        this.assets = assets;
        this.gender = initialGender;
        this.humanSpriteName = resolvedGear.human;
        this.armor = resolvedGear.armor;
        this.hauberk = resolvedGear.hauberk;
        this.leggings = resolvedGear.leggings;
        this.boots = resolvedGear.boots;
        this.helm = resolvedGear.helm;
        this.cape = resolvedGear.cape;
        this.weapon = resolvedGear.weapon;
        this.shield = resolvedGear.shield;
        this.accessory = resolvedGear.accessory;
        this.weaponStartSpriteSheetIndex = resolvedGear.weaponStartSpriteSheetIndex;
        this.shieldStartSpriteSheetIndex = resolvedGear.shieldStartSpriteSheetIndex;
        this.weaponAssetIndex = assetIndices.weaponAssetIndex;
        this.shieldAssetIndex = assetIndices.shieldAssetIndex;
        this.armorAssetIndex = assetIndices.armorAssetIndex;
        this.hauberkAssetIndex = assetIndices.hauberkAssetIndex;
        this.leggingsAssetIndex = assetIndices.leggingsAssetIndex;
        this.bootsAssetIndex = assetIndices.bootsAssetIndex;
        this.helmAssetIndex = assetIndices.helmAssetIndex;
        this.capeAssetIndex = assetIndices.capeAssetIndex;
        this.accessoryAssetIndex = assetIndices.accessoryAssetIndex;
        this.humanAssetIndex = assetIndices.humanAssetIndex;
        this.hairAssetIndex = assetIndices.hairAssetIndex;
        this.underwearAssetIndex = assetIndices.underwearAssetIndex;
        this.underwearColorIndex = resolvedGear.underwearColorIndex ?? 0;
        this.hairStyleIndex = resolvedGear.hairStyleIndex ?? 0;
        this.updateAccessoryOffset();
        this.applyInitialVisibility();
    }

    public static getHumanSpriteName(gender: Gender, skinColor: SkinColor = SkinColor.Light): string {
        const spriteMap: Record<Gender, Record<SkinColor, string>> = {
            [Gender.MALE]: { [SkinColor.Light]: 'wm', [SkinColor.Tanned]: 'ym', [SkinColor.Dark]: 'bm' },
            [Gender.FEMALE]: { [SkinColor.Light]: 'ww', [SkinColor.Tanned]: 'yw', [SkinColor.Dark]: 'bw' },
        };
        return spriteMap[gender][skinColor];
    }

    public static resolveGearFromInventory(
        gear: GearConfig,
        inventoryManager: { equippedItems: EquippedItems },
        gender: Gender,
    ): GearConfig {
        const weaponItem = inventoryManager.equippedItems[ItemTypes.WEAPON];
        const weaponDef = weaponItem ? getItemById(weaponItem.itemId) : undefined;
        const weapon = gear.weapon ?? (weaponDef
            ? (gender === Gender.MALE ? weaponDef.equippedSpriteMale : weaponDef.equippedSpriteFemale)
            : undefined);
        const weaponStartSpriteSheetIndex = gear.weaponStartSpriteSheetIndex
            ?? weaponDef?.startSpriteSheetIndex
            ?? (weapon ? getItemByEquippedSprite(weapon)?.startSpriteSheetIndex : undefined);

        const shieldItem = inventoryManager.equippedItems[ItemTypes.SHIELD];
        const shieldDef = shieldItem ? getItemById(shieldItem.itemId) : undefined;
        const shield = gear.shield ?? (shieldDef
            ? (gender === Gender.MALE ? shieldDef.equippedSpriteMale : shieldDef.equippedSpriteFemale)
            : undefined);
        const shieldStartSpriteSheetIndex = gear.shieldStartSpriteSheetIndex
            ?? shieldDef?.startSpriteSheetIndex
            ?? (shield ? getItemByEquippedSprite(shield)?.startSpriteSheetIndex : undefined);

        const armorItem = inventoryManager.equippedItems[ItemTypes.ARMOR];
        const armorDef = armorItem ? getItemById(armorItem.itemId) : undefined;
        const armor = gear.armor ?? (armorDef
            ? (gender === Gender.MALE ? armorDef.equippedSpriteMale : armorDef.equippedSpriteFemale)
            : undefined);

        const hauberkItem = inventoryManager.equippedItems[ItemTypes.HAUBERK];
        const hauberkDef = hauberkItem ? getItemById(hauberkItem.itemId) : undefined;
        const hauberk = gear.hauberk ?? (hauberkDef
            ? (gender === Gender.MALE ? hauberkDef.equippedSpriteMale : hauberkDef.equippedSpriteFemale)
            : undefined);

        const leggingsItem = inventoryManager.equippedItems[ItemTypes.LEGGINGS];
        const leggingsDef = leggingsItem ? getItemById(leggingsItem.itemId) : undefined;
        const leggings = gear.leggings ?? (leggingsDef
            ? (gender === Gender.MALE ? leggingsDef.equippedSpriteMale : leggingsDef.equippedSpriteFemale)
            : undefined);

        const bootsItem = inventoryManager.equippedItems[ItemTypes.BOOTS];
        const bootsDef = bootsItem ? getItemById(bootsItem.itemId) : undefined;
        const boots = gear.boots ?? (bootsDef
            ? (gender === Gender.MALE ? bootsDef.equippedSpriteMale : bootsDef.equippedSpriteFemale)
            : undefined);

        const helmItem = inventoryManager.equippedItems[ItemTypes.HELMET];
        const helmDef = helmItem ? getItemById(helmItem.itemId) : undefined;
        const helm = gear.helm ?? (helmDef
            ? (gender === Gender.MALE ? helmDef.equippedSpriteMale : helmDef.equippedSpriteFemale)
            : undefined);

        const capeItem = inventoryManager.equippedItems[ItemTypes.CAPE];
        const capeDef = capeItem ? getItemById(capeItem.itemId) : undefined;
        const cape = gear.cape ?? (capeDef
            ? (gender === Gender.MALE ? capeDef.equippedSpriteMale : capeDef.equippedSpriteFemale)
            : undefined);

        const accessoryItem = inventoryManager.equippedItems[ItemTypes.ACCESSORY];
        const accessoryDef = accessoryItem ? getItemById(accessoryItem.itemId) : undefined;
        const accessory = gear.accessory ?? (accessoryDef
            ? (gender === Gender.MALE ? accessoryDef.equippedSpriteMale : accessoryDef.equippedSpriteFemale)
            : undefined);

        const underwear = gear.underwear ?? (gender === Gender.MALE ? 'mpt' : 'wpt');
        return { ...gear, weapon, weaponStartSpriteSheetIndex, shield, shieldStartSpriteSheetIndex, armor, hauberk, leggings, boots, helm, cape, accessory, underwear };
    }

    public static buildAssetConfigs(direction: Direction, state: PlayerState, gear: GearConfig): BuildPlayerAssetConfigsResult {
        const configs: Omit<GameAssetConfig, 'x' | 'y'>[] = [];
        const assetIndices: PlayerAssetIndices = {
            weaponAssetIndex: -1,
            shieldAssetIndex: -1,
            armorAssetIndex: -1,
            hauberkAssetIndex: -1,
            leggingsAssetIndex: -1,
            bootsAssetIndex: -1,
            helmAssetIndex: -1,
            capeAssetIndex: -1,
            accessoryAssetIndex: -1,
            humanAssetIndex: -1,
            hairAssetIndex: -1,
            underwearAssetIndex: -1,
        };

        const isFemale = gear.human === 'ww' || gear.human === 'yw' || gear.human === 'bw';
        const defaultBoots = isFemale
            ? ITEMS.find((i) => i.itemType === ItemTypes.BOOTS)?.equippedSpriteFemale
            : ITEMS.find((i) => i.itemType === ItemTypes.BOOTS)?.equippedSpriteMale;
        const defaultArmor = ITEMS.find((i) => i.itemType === ItemTypes.ARMOR);
        const defaultHauberk = ITEMS.find((i) => i.itemType === ItemTypes.HAUBERK);
        const defaultLeggings = ITEMS.find((i) => i.itemType === ItemTypes.LEGGINGS);
        const defaultHelm = ITEMS.find((i) => i.itemType === ItemTypes.HELMET);
        const defaultCape = ITEMS.find((i) => i.itemType === ItemTypes.CAPE);
        const underwear = gear.underwear ?? (isFemale ? 'wpt' : 'mpt');
        const hairStyleIndex = gear.hairStyleIndex ?? 0;
        const hair = isFemale ? 'whr' : 'mhr';
        const gearBySlot: Record<GearSlot, string | undefined> = {
            human: gear.human,
            hair,
            underwear,
            hauberk: gear.hauberk ?? (isFemale ? defaultHauberk?.equippedSpriteFemale : defaultHauberk?.equippedSpriteMale),
            leggings: gear.leggings ?? (isFemale ? defaultLeggings?.equippedSpriteFemale : defaultLeggings?.equippedSpriteMale),
            boots: gear.boots ?? defaultBoots,
            helm: gear.helm ?? (isFemale ? defaultHelm?.equippedSpriteFemale : defaultHelm?.equippedSpriteMale),
            armor: gear.armor ?? (isFemale ? defaultArmor?.equippedSpriteFemale : defaultArmor?.equippedSpriteMale),
            weapon: gear.weapon ?? (ITEMS[0]?.equippedSpriteMale),
            shield: gear.shield ?? (ITEMS.find((i) => i.itemType === ItemTypes.SHIELD)?.equippedSpriteMale),
            cape: gear.cape ?? (isFemale ? defaultCape?.equippedSpriteFemale : defaultCape?.equippedSpriteMale),
            accessory: gear.accessory ?? (ITEMS.find((i) => i.itemType === ItemTypes.ACCESSORY)?.equippedSpriteMale),
        };

        const gearRenderOrder = getGearRenderOrder(direction, state === PlayerState.Run);
        for (const slot of gearRenderOrder) {
            const spriteName = gearBySlot[slot];
            if (!spriteName) {
                continue;
            }

            switch (slot) {
                case 'weapon':
                    assetIndices.weaponAssetIndex = configs.length;
                    break;
                case 'shield':
                    assetIndices.shieldAssetIndex = configs.length;
                    break;
                case 'armor':
                    assetIndices.armorAssetIndex = configs.length;
                    break;
                case 'hauberk':
                    assetIndices.hauberkAssetIndex = configs.length;
                    break;
                case 'leggings':
                    assetIndices.leggingsAssetIndex = configs.length;
                    break;
                case 'boots':
                    assetIndices.bootsAssetIndex = configs.length;
                    break;
                case 'helm':
                    assetIndices.helmAssetIndex = configs.length;
                    break;
                case 'cape':
                    assetIndices.capeAssetIndex = configs.length;
                    break;
                case 'accessory':
                    assetIndices.accessoryAssetIndex = configs.length;
                    break;
                case 'human':
                    assetIndices.humanAssetIndex = configs.length;
                    break;
                case 'hair':
                    assetIndices.hairAssetIndex = configs.length;
                    break;
                case 'underwear':
                    assetIndices.underwearAssetIndex = configs.length;
                    break;
            }

            switch (slot) {
                case 'human': {
                    const spriteSheetIndex = HUMAN_SPRITESHEET_BASE[state] + direction;
                    configs.push({
                        spriteName,
                        spriteSheetIndex,
                        direction: 0,
                        animationType: AnimationType.FullFrame,
                    });
                    break;
                }
                case 'weapon': {
                    const armamentStateIndex = ARMAMENT_STATE_INDEX[state];
                    const base = gear.weaponStartSpriteSheetIndex ?? 0;
                    const spriteSheetIndex = base + armamentStateIndex * 8 + direction;
                    const weaponItem = getItemByEquippedSprite(spriteName);
                    const effects = weaponItem?.effects;
                    configs.push({
                        spriteName,
                        spriteSheetIndex,
                        direction: 0,
                        animationType: AnimationType.FullFrame,
                        ...(effects && effects.length > 0 && { effects }),
                    });
                    break;
                }
                case 'shield': {
                    const armamentStateIndex = ARMAMENT_STATE_INDEX[state];
                    const base = gear.shieldStartSpriteSheetIndex ?? 0;
                    const effectiveStateIndex = armamentStateIndex >= 0 ? armamentStateIndex : 1;
                    const spriteSheetIndex = base + effectiveStateIndex;
                    const shieldItem = getItemByEquippedSprite(spriteName);
                    const effects = shieldItem?.effects;
                    configs.push({
                        spriteName,
                        spriteSheetIndex,
                        direction,
                        framesPerDirection: 8,
                        animationType: AnimationType.DirectionalSubFrame,
                        ...(effects && effects.length > 0 && { effects }),
                    });
                    break;
                }
                case 'accessory': {
                    const angelicState = ANGELIC_STATE_FROM_PLAYER_STATE[state];
                    const spriteSheetIndex = angelicState * 8 + direction;
                    const framesPerDirection = ANGELIC_STATE_FRAME_COUNT[angelicState] ?? 8;
                    const accessoryItem = getItemByEquippedSprite(spriteName);
                    const effects = accessoryItem?.effects;
                    configs.push({
                        spriteName,
                        spriteSheetIndex,
                        direction: 0,
                        framesPerDirection,
                        animationType: AnimationType.FullFrame,
                        ...(effects && effects.length > 0 && { effects }),
                    });
                    break;
                }
                case 'hair': {
                    const framesPerDirection = PLAYER_ANIMATION_FRAME_COUNT[state];
                    const effectiveHairStyle = hairStyleIndex === 2 ? 0 : hairStyleIndex;
                    const spriteSheetIndex = effectiveHairStyle * 12 + ARMOUR_SPRITESHEET_BASE[state];
                    configs.push({
                        spriteName,
                        spriteSheetIndex,
                        direction,
                        framesPerDirection,
                        animationType: AnimationType.DirectionalSubFrame,
                    });
                    break;
                }
                case 'underwear': {
                    const framesPerDirection = PLAYER_ANIMATION_FRAME_COUNT[state];
                    const underwearColorIndex = gear.underwearColorIndex ?? 0;
                    const spriteSheetIndex = underwearColorIndex * 12 + ARMOUR_SPRITESHEET_BASE[state];
                    configs.push({
                        spriteName,
                        spriteSheetIndex,
                        direction,
                        framesPerDirection,
                        animationType: AnimationType.DirectionalSubFrame,
                    });
                    break;
                }
                default: {
                    // armor, hauberk, leggings, boots, helm, cape (glare supported; accessory excluded)
                    const slotItem = getItemByEquippedSprite(spriteName);
                    const effects = slotItem?.effects;
                    configs.push({
                        spriteName,
                        spriteSheetIndex: ARMOUR_SPRITESHEET_BASE[state],
                        direction,
                        animationType: AnimationType.DirectionalSubFrame,
                        ...(effects && effects.length > 0 && { effects }),
                    });
                    break;
                }
            }
        }

        return { configs, assetIndices };
    }

    public getGender(): Gender {
        return this.gender;
    }

    public getHumanSpriteName(): string {
        return this.humanSpriteName;
    }

    public getAccessoryAssetIndex(): number {
        return this.accessoryAssetIndex;
    }

    public hasAccessory(): boolean {
        return this.accessory !== undefined;
    }

    public getShadowSpriteSheetIndex(state: PlayerState, direction: Direction): number {
        return HUMAN_SPRITESHEET_BASE[state] + direction;
    }

    public applyAppearanceChange(gender: Gender, skinColor: SkinColor, equippedItems: EquippedItems, currentState: PlayerState, direction: Direction, shadowManager?: ShadowManager, underwearColorIndex?: number, hairStyleIndex?: number): void {
        this.gender = gender;
        this.humanSpriteName = PlayerAppearanceManager.getHumanSpriteName(gender, skinColor);
        if (underwearColorIndex !== undefined) {
            this.underwearColorIndex = Math.max(0, Math.min(7, underwearColorIndex));
        }
        if (hairStyleIndex !== undefined) {
            this.hairStyleIndex = hairStyleIndex < 0 ? 0 : hairStyleIndex > 7 ? 7 : hairStyleIndex;
        }

        if (this.humanAssetIndex >= 0) {
            this.assets[this.humanAssetIndex].setSpriteName(this.humanSpriteName);
        }
        if (this.hairAssetIndex >= 0) {
            const hairSprite = gender === Gender.MALE ? 'mhr' : 'whr';
            this.assets[this.hairAssetIndex].setSpriteName(hairSprite);
            this.assets[this.hairAssetIndex].setVisible(this.hairStyleIndex !== 2);
        }
        if (this.underwearAssetIndex >= 0) {
            this.assets[this.underwearAssetIndex].setSpriteName(gender === Gender.MALE ? 'mpt' : 'wpt');
        }
        if (shadowManager) {
            const shadowSpriteSheetIndex = this.getShadowSpriteSheetIndex(currentState, direction);
            shadowManager.updateShadowSprite(this.humanSpriteName, shadowSpriteSheetIndex);
        }

        this.applyEquipItem(ItemTypes.WEAPON, equippedItems[ItemTypes.WEAPON]?.itemId, equippedItems[ItemTypes.WEAPON]?.effectOverrides);
        this.applyEquipItem(ItemTypes.SHIELD, equippedItems[ItemTypes.SHIELD]?.itemId, equippedItems[ItemTypes.SHIELD]?.effectOverrides);
        this.applyEquipItem(ItemTypes.ARMOR, equippedItems[ItemTypes.ARMOR]?.itemId, equippedItems[ItemTypes.ARMOR]?.effectOverrides);
        this.applyEquipItem(ItemTypes.HAUBERK, equippedItems[ItemTypes.HAUBERK]?.itemId, equippedItems[ItemTypes.HAUBERK]?.effectOverrides);
        this.applyEquipItem(ItemTypes.LEGGINGS, equippedItems[ItemTypes.LEGGINGS]?.itemId, equippedItems[ItemTypes.LEGGINGS]?.effectOverrides);
        this.applyEquipItem(ItemTypes.BOOTS, equippedItems[ItemTypes.BOOTS]?.itemId, equippedItems[ItemTypes.BOOTS]?.effectOverrides);
        this.applyEquipItem(ItemTypes.HELMET, equippedItems[ItemTypes.HELMET]?.itemId, equippedItems[ItemTypes.HELMET]?.effectOverrides);
        this.applyEquipItem(ItemTypes.CAPE, equippedItems[ItemTypes.CAPE]?.itemId, equippedItems[ItemTypes.CAPE]?.effectOverrides);
        this.applyEquipItem(ItemTypes.ACCESSORY, equippedItems[ItemTypes.ACCESSORY]?.itemId, equippedItems[ItemTypes.ACCESSORY]?.effectOverrides);
        this.applyChilledToAllAssets();
        this.applyBerserkToEligibleAssets();
    }

    public handleEquip(itemType: ItemTypes, itemId: number | undefined, effectOverrides?: Effect[]): void {
        this.applyEquipItem(itemType, itemId, effectOverrides);
    }

    public updateDepth(worldY: number, direction: Direction, currentState: PlayerState): void {
        const baseDepth = worldY * DEPTH_MULTIPLIER;
        const order = getGearRenderOrder(direction, currentState === PlayerState.Run);
        for (let i = 0; i < this.assets.length; i++) {
            const slot = this.getGearSlotForSprite(this.assets[i].getSpriteName(), i);
            const position = slot ? order.indexOf(slot) : i;
            this.assets[i].setDepth(baseDepth + position * 3);
        }
    }

    /**
     * Ghost config for trail effect during movement.
     * When provided and enabled, each asset renders a semi-transparent copy offset behind.
     */
    public updateAssetPositions(pixelX: number, pixelY: number, ghostConfig?: { enabled: boolean; offsetX: number; offsetY: number }): void {
        for (let i = 0; i < this.assets.length; i++) {
            const asset = this.assets[i];
            if (asset.isMapObject()) {
                continue;
            }

            const isAccessory = i === this.accessoryAssetIndex && this.accessory;
            const offsetX = isAccessory ? this.accessoryOffsetX : 0;
            const offsetY = isAccessory ? this.accessoryOffsetY : 0;
            asset.setPosition(pixelX + offsetX, pixelY + offsetY);

            if (ghostConfig?.enabled) {
                asset.updateGhostSprite(true, ghostConfig.offsetX, ghostConfig.offsetY);
            } else {
                asset.updateGhostSprite(false, 0, 0);
            }
        }
    }

    /**
     * Sets or clears chilled blue tint on all appearance items.
     * Applied after other effects (e.g. TINT_APPEARANCE, glare) so it blends with existing visuals.
     */
    public setChilledEffect(chilled: boolean): void {
        this.isChilled = chilled;
        this.applyChilledToAllAssets();
    }

    /**
     * Sets or clears berserk red overlay on body and equipment (excludes weapon, shield, accessory).
     * Berserk overlay is rendered underneath other effects (chilled, glare).
     */
    public setBerserkEffect(berserked: boolean): void {
        this.isBerserked = berserked;
        this.applyBerserkToEligibleAssets();
    }

    /**
     * Applies chilled tint to all assets. Called at the end of appearance updates so it layers over other effects.
     */
    private applyChilledToAllAssets(): void {
        for (let i = 0; i < this.assets.length; i++) {
            this.assets[i].setChilledTint(this.isChilled);
        }
    }

    /**
     * Applies berserk overlay to body, underwear, and equipment. Excludes weapon, shield, accessory (angels).
     */
    private applyBerserkToEligibleAssets(): void {
        for (let i = 0; i < this.assets.length; i++) {
            const slot = this.getGearSlotForSprite(this.assets[i].getSpriteName(), i);
            const excluded = slot === 'weapon' || slot === 'shield' || slot === 'accessory';
            this.assets[i].setBerserkOverlay(this.isBerserked && !excluded);
        }
    }

    /**
     * Sets transparency on all rendered appearance items (base player sprite, underwear, armor, etc.).
     * Does not change transparency for overlay effect sprites (e.g. glare overlay).
     *
     * @param sliderValue - Transparency slider value 0-100 (0 = fully opaque, 100 = fully transparent)
     */
    public setTransparency(sliderValue: number): void {
        const clamped = Math.max(0, Math.min(100, sliderValue));
        const alpha = 1 - clamped / 100;
        for (let i = 0; i < this.assets.length; i++) {
            this.assets[i].setAlpha(alpha);
        }
    }

    public updateShadow(shadowManager: ShadowManager | undefined, currentState: PlayerState, direction: Direction, animationConfig: PlayerAppearanceAnimationConfig): void {
        if (!shadowManager) {
            return;
        }
        const shadowSpriteSheetIndex = HUMAN_SPRITESHEET_BASE[currentState] + direction;
        const animationFrameRate = this.getAnimationFrameRate(currentState, animationConfig);
        const repeat = this.getAnimationRepeat(currentState);
        shadowManager.updateAnimation(shadowSpriteSheetIndex, animationFrameRate, repeat);
    }

    public applyStateAppearance(newState: PlayerState, direction: Direction, animationConfig: PlayerAppearanceAnimationConfig): void {
        const repeat = this.getAnimationRepeat(newState);
        const currentRelativeFrame = repeat === 0
            ? undefined
            : (this.assets.length > 0 ? this.assets[0].getCurrentRelativeFrame() : undefined);
        const frameCount = PLAYER_ANIMATION_FRAME_COUNT[newState];

        for (let i = 0; i < this.assets.length; i++) {
            const asset = this.assets[i];
            let spriteName = asset.getSpriteName();
            const slot = this.getGearSlotForSprite(spriteName, i);

            // Exception: use female sprite for broken male sprites per WEAPON_SPRITE_OVERWRITES
            if (slot === 'weapon' && this.weapon !== undefined) {
                const stateName = PlayerState[newState];
                const overwrites = WEAPON_SPRITE_OVERWRITES[stateName];
                const overwrite = overwrites?.find((o) => o.maleSprite === this.weapon);
                spriteName = overwrite ? overwrite.femaleSprite : this.weapon;
                asset.setSpriteName(spriteName);
            }

            const shouldHideArmaments = newState === PlayerState.Die ||
                newState === PlayerState.Cast ||
                newState === PlayerState.PickUp ||
                newState === PlayerState.BowStance;
            if (shouldHideArmaments && (slot === 'weapon' || slot === 'shield')) {
                asset.setVisible(false);
                continue;
            }

            asset.setVisible(this.isSlotVisible(slot));

            const { animationKey, animationDirection, animationType } = this.getAnimationConfigForAsset(spriteName, newState, direction, i);
            const animationFrameRate = slot === 'accessory'
                ? this.getAccessoryAnimationFrameRate(newState, animationConfig)
                : this.getAnimationFrameRate(newState, animationConfig);
            const assetRepeat = slot === 'accessory' ? this.getAccessoryAnimationRepeat(newState) : repeat;
            const assetFrameCount = slot === 'accessory'
                ? (ANGELIC_STATE_FRAME_COUNT[ANGELIC_STATE_FROM_PLAYER_STATE[newState]] ?? 8)
                : frameCount;
            asset.playAnimationWithDirection(animationKey, animationDirection, animationFrameRate, currentRelativeFrame, assetRepeat, assetFrameCount, animationType);
        }
        this.applyChilledToAllAssets();
        this.applyBerserkToEligibleAssets();
    }

    private applyEquipItem(itemType: ItemTypes, itemId: number | undefined, effectOverrides?: Effect[]): void {
        switch (itemType) {
            case ItemTypes.WEAPON:
                this.applyWeaponEquip(itemId, effectOverrides);
                break;
            case ItemTypes.SHIELD:
                this.applyShieldEquip(itemId, effectOverrides);
                break;
            case ItemTypes.ARMOR:
                this.applySimpleEquip(itemId, this.armorAssetIndex, 'armor', effectOverrides);
                break;
            case ItemTypes.HAUBERK:
                this.applySimpleEquip(itemId, this.hauberkAssetIndex, 'hauberk', effectOverrides);
                break;
            case ItemTypes.LEGGINGS:
                this.applySimpleEquip(itemId, this.leggingsAssetIndex, 'leggings', effectOverrides);
                break;
            case ItemTypes.BOOTS:
                this.applySimpleEquip(itemId, this.bootsAssetIndex, 'boots', effectOverrides);
                break;
            case ItemTypes.HELMET:
                this.applySimpleEquip(itemId, this.helmAssetIndex, 'helm', effectOverrides);
                break;
            case ItemTypes.CAPE:
                this.applySimpleEquip(itemId, this.capeAssetIndex, 'cape', effectOverrides);
                break;
            case ItemTypes.ACCESSORY:
                this.applyAccessoryEquip(itemId, effectOverrides);
                break;
        }
        this.applyChilledToAllAssets();
        this.applyBerserkToEligibleAssets();
    }

    private applyWeaponEquip(itemId: number | undefined, effectOverrides?: Effect[]): void {
        if (itemId === undefined) {
            this.weapon = undefined;
            this.weaponStartSpriteSheetIndex = undefined;
            if (this.weaponAssetIndex >= 0) {
                const weaponAsset = this.assets[this.weaponAssetIndex];
                weaponAsset.setItemEffects(undefined);
                weaponAsset.setVisible(false);
            }
            return;
        }
        const itemDef = getItemById(itemId);
        if (!itemDef) {
            return;
        }
        const sprite = this.gender === Gender.MALE ? itemDef.equippedSpriteMale : itemDef.equippedSpriteFemale;
        if (!sprite) {
            return;
        }
        this.weapon = sprite;
        this.weaponStartSpriteSheetIndex = itemDef.startSpriteSheetIndex;
        if (this.weaponAssetIndex >= 0) {
            const weaponAsset = this.assets[this.weaponAssetIndex];
            weaponAsset.setSpriteName(sprite);
            weaponAsset.setItemEffects(mergeItemEffects(itemDef.effects, effectOverrides));
            weaponAsset.setVisible(true);
        }
    }

    private applyShieldEquip(itemId: number | undefined, effectOverrides?: Effect[]): void {
        if (itemId === undefined) {
            this.shield = undefined;
            this.shieldStartSpriteSheetIndex = undefined;
            if (this.shieldAssetIndex >= 0) {
                const shieldAsset = this.assets[this.shieldAssetIndex];
                shieldAsset.setItemEffects(undefined);
                shieldAsset.setVisible(false);
            }
            return;
        }
        const itemDef = getItemById(itemId);
        if (!itemDef) {
            return;
        }
        const sprite = this.gender === Gender.MALE ? itemDef.equippedSpriteMale : itemDef.equippedSpriteFemale;
        if (!sprite) {
            return;
        }
        this.shield = sprite;
        this.shieldStartSpriteSheetIndex = itemDef.startSpriteSheetIndex;
        if (this.shieldAssetIndex >= 0) {
            const shieldAsset = this.assets[this.shieldAssetIndex];
            shieldAsset.setSpriteName(sprite);
            shieldAsset.setItemEffects(mergeItemEffects(itemDef.effects, effectOverrides));
            shieldAsset.setVisible(true);
        }
    }

    private applySimpleEquip(itemId: number | undefined, assetIndex: number, slot: 'armor' | 'hauberk' | 'leggings' | 'boots' | 'helm' | 'cape', effectOverrides?: Effect[]): void {
        if (itemId === undefined) {
            this[slot] = undefined;
            if (assetIndex >= 0) {
                const asset = this.assets[assetIndex];
                asset.setItemEffects(undefined);
                asset.setVisible(false);
            }
            return;
        }
        const itemDef = getItemById(itemId);
        if (!itemDef) {
            return;
        }
        const sprite = this.gender === Gender.MALE ? itemDef.equippedSpriteMale : itemDef.equippedSpriteFemale;
        if (!sprite) {
            return;
        }
        this[slot] = sprite;
        if (assetIndex >= 0) {
            const asset = this.assets[assetIndex];
            asset.setSpriteName(sprite);
            asset.setItemEffects(mergeItemEffects(itemDef.effects, effectOverrides));
            asset.setVisible(true);
        }
    }

    private applyAccessoryEquip(itemId: number | undefined, effectOverrides?: Effect[]): void {
        if (itemId === undefined) {
            this.accessory = undefined;
            this.accessoryOffsetX = 0;
            this.accessoryOffsetY = 0;
            if (this.accessoryAssetIndex >= 0) {
                this.assets[this.accessoryAssetIndex].setItemEffects(undefined);
                this.assets[this.accessoryAssetIndex].setVisible(false);
            }
            return;
        }
        const itemDef = getItemById(itemId);
        if (!itemDef) {
            return;
        }
        const sprite = this.gender === Gender.MALE ? itemDef.equippedSpriteMale : itemDef.equippedSpriteFemale;
        if (!sprite) {
            return;
        }
        this.accessory = sprite;
        this.accessoryOffsetX = itemDef.offsetX ?? 0;
        this.accessoryOffsetY = itemDef.offsetY ?? 0;
        if (this.accessoryAssetIndex >= 0) {
            const accessoryAsset = this.assets[this.accessoryAssetIndex];
            accessoryAsset.setSpriteName(sprite);
            accessoryAsset.setItemEffects(mergeItemEffects(itemDef.effects, effectOverrides));
            accessoryAsset.setVisible(true);
        }
    }

    private updateAccessoryOffset(): void {
        if (!this.accessory) {
            this.accessoryOffsetX = 0;
            this.accessoryOffsetY = 0;
            return;
        }
        const accessoryItemDef = getItemByEquippedSprite(this.accessory);
        if (!accessoryItemDef) {
            this.accessoryOffsetX = 0;
            this.accessoryOffsetY = 0;
            return;
        }
        this.accessoryOffsetX = accessoryItemDef.offsetX ?? 0;
        this.accessoryOffsetY = accessoryItemDef.offsetY ?? 0;
    }

    private applyInitialVisibility(): void {
        if (this.weaponAssetIndex >= 0 && !this.weapon) {
            this.assets[this.weaponAssetIndex].setVisible(false);
        }
        if (this.shieldAssetIndex >= 0 && !this.shield) {
            this.assets[this.shieldAssetIndex].setVisible(false);
        }
        if (this.armorAssetIndex >= 0 && !this.armor) {
            this.assets[this.armorAssetIndex].setVisible(false);
        }
        if (this.hauberkAssetIndex >= 0 && !this.hauberk) {
            this.assets[this.hauberkAssetIndex].setVisible(false);
        }
        if (this.leggingsAssetIndex >= 0 && !this.leggings) {
            this.assets[this.leggingsAssetIndex].setVisible(false);
        }
        if (this.bootsAssetIndex >= 0 && !this.boots) {
            this.assets[this.bootsAssetIndex].setVisible(false);
        }
        if (this.helmAssetIndex >= 0 && !this.helm) {
            this.assets[this.helmAssetIndex].setVisible(false);
        }
        if (this.capeAssetIndex >= 0 && !this.cape) {
            this.assets[this.capeAssetIndex].setVisible(false);
        }
        if (this.accessoryAssetIndex >= 0 && !this.accessory) {
            this.assets[this.accessoryAssetIndex].setVisible(false);
        }
        if (this.hairAssetIndex >= 0 && this.hairStyleIndex === 2) {
            this.assets[this.hairAssetIndex].setVisible(false);
        }
    }

    private isSlotVisible(slot: GearSlot | undefined): boolean {
        switch (slot) {
            case 'weapon':
                return this.weapon !== undefined;
            case 'shield':
                return this.shield !== undefined;
            case 'armor':
                return this.armor !== undefined;
            case 'hauberk':
                return this.hauberk !== undefined;
            case 'leggings':
                return this.leggings !== undefined;
            case 'boots':
                return this.boots !== undefined;
            case 'helm':
                return this.helm !== undefined;
            case 'cape':
                return this.cape !== undefined;
            case 'accessory':
                return this.accessory !== undefined;
            case 'hair':
                return this.hairStyleIndex !== 2;
            default:
                return true;
        }
    }

    private getGearSlotForSprite(spriteName: string, assetIndex?: number): GearSlot | undefined {
        if (assetIndex !== undefined && assetIndex === this.weaponAssetIndex) {
            return 'weapon';
        }
        if (assetIndex !== undefined && assetIndex === this.shieldAssetIndex) {
            return 'shield';
        }
        if (assetIndex !== undefined && assetIndex === this.armorAssetIndex) {
            return 'armor';
        }
        if (assetIndex !== undefined && assetIndex === this.hairAssetIndex) {
            return 'hair';
        }
        if (assetIndex !== undefined && assetIndex === this.underwearAssetIndex) {
            return 'underwear';
        }
        if (assetIndex !== undefined && assetIndex === this.hauberkAssetIndex) {
            return 'hauberk';
        }
        if (assetIndex !== undefined && assetIndex === this.leggingsAssetIndex) {
            return 'leggings';
        }
        if (assetIndex !== undefined && assetIndex === this.bootsAssetIndex) {
            return 'boots';
        }
        if (assetIndex !== undefined && assetIndex === this.helmAssetIndex) {
            return 'helm';
        }
        if (assetIndex !== undefined && assetIndex === this.capeAssetIndex) {
            return 'cape';
        }
        if (assetIndex !== undefined && assetIndex === this.accessoryAssetIndex) {
            return 'accessory';
        }
        switch (spriteName) {
            case this.humanSpriteName:
                return 'human';
            case 'mhr':
            case 'whr':
                return 'hair';
            case 'mpt':
            case 'wpt':
                return 'underwear';
            case this.hauberk:
                return 'hauberk';
            case this.helm:
                return 'helm';
            case this.leggings:
                return 'leggings';
            case this.boots:
                return 'boots';
            case this.armor:
                return 'armor';
            case this.weapon:
                return 'weapon';
            case this.shield:
                return 'shield';
            case this.cape:
                return 'cape';
            case this.accessory:
                return 'accessory';
            default:
                return undefined;
        }
    }

    private getAnimationConfigForAsset(
        spriteName: string,
        newState: PlayerState,
        direction: Direction,
        assetIndex?: number,
    ): { animationKey: string; animationDirection: number; animationType: AnimationType } {
        const slot = this.getGearSlotForSprite(spriteName, assetIndex);
        if (!slot) {
            return {
                animationKey: `sprite-${spriteName}-0`,
                animationDirection: 0,
                animationType: AnimationType.FullFrame,
            };
        }

        if (slot === 'human') {
            const spriteSheetIndex = HUMAN_SPRITESHEET_BASE[newState] + direction;
            return {
                animationKey: `sprite-${spriteName}-${spriteSheetIndex}`,
                animationDirection: 0,
                animationType: AnimationType.FullFrame,
            };
        }

        if (slot === 'weapon') {
            const armamentStateIndex = ARMAMENT_STATE_INDEX[newState];
            const base = this.weaponStartSpriteSheetIndex ?? getItemByEquippedSprite(spriteName)?.startSpriteSheetIndex ?? 0;
            const spriteSheetIndex = base + armamentStateIndex * 8 + direction;
            return {
                animationKey: `sprite-${spriteName}-${spriteSheetIndex}`,
                animationDirection: 0,
                animationType: AnimationType.FullFrame,
            };
        }

        if (slot === 'shield') {
            const armamentStateIndex = ARMAMENT_STATE_INDEX[newState];
            const base = this.shieldStartSpriteSheetIndex ?? getItemByEquippedSprite(spriteName)?.startSpriteSheetIndex ?? 0;
            const effectiveStateIndex = armamentStateIndex >= 0 ? armamentStateIndex : 1;
            const spriteSheetIndex = base + effectiveStateIndex;
            return {
                animationKey: `sprite-${spriteName}-${spriteSheetIndex}`,
                animationDirection: direction,
                animationType: AnimationType.DirectionalSubFrame,
            };
        }

        if (slot === 'accessory') {
            const angelicState = ANGELIC_STATE_FROM_PLAYER_STATE[newState];
            const spriteSheetIndex = angelicState * 8 + direction;
            return {
                animationKey: `sprite-${spriteName}-${spriteSheetIndex}`,
                animationDirection: 0,
                animationType: AnimationType.FullFrame,
            };
        }

        if (slot === 'underwear') {
            const spriteSheetIndex = this.underwearColorIndex * 12 + ARMOUR_SPRITESHEET_BASE[newState];
            return {
                animationKey: `sprite-${spriteName}-${spriteSheetIndex}`,
                animationDirection: direction,
                animationType: AnimationType.DirectionalSubFrame,
            };
        }

        if (slot === 'hair') {
            const effectiveHairStyle = this.hairStyleIndex === 2 ? 0 : this.hairStyleIndex;
            const spriteSheetIndex = effectiveHairStyle * 12 + ARMOUR_SPRITESHEET_BASE[newState];
            return {
                animationKey: `sprite-${spriteName}-${spriteSheetIndex}`,
                animationDirection: direction,
                animationType: AnimationType.DirectionalSubFrame,
            };
        }

        return {
            animationKey: `sprite-${spriteName}-${ARMOUR_SPRITESHEET_BASE[newState]}`,
            animationDirection: direction,
            animationType: AnimationType.DirectionalSubFrame,
        };
    }

    private getAnimationFrameRate(state: PlayerState, animationConfig: PlayerAppearanceAnimationConfig): number {
        switch (state) {
            case PlayerState.Run:
                return animationConfig.movementFrameRate;
            case PlayerState.WalkPeaceMode:
            case PlayerState.WalkCombatMode:
                return animationConfig.movementFrameRate / 2;
            case PlayerState.MeleeAttack:
            case PlayerState.BowAttack:
            case PlayerState.BowStance:
                return animationConfig.attackSpeed;
            case PlayerState.Cast: {
                const frameCount = PLAYER_ANIMATION_FRAME_COUNT[state];
                return calculateFrameRateFromDuration(frameCount, animationConfig.castSpeed);
            }
            case PlayerState.TakeDamage:
            case PlayerState.TakeDamageOnMove:
            case PlayerState.TakeDamageWithKnockback: {
                const frameCount = PLAYER_ANIMATION_FRAME_COUNT[state];
                const durationMs = (4 / 15) * 1000;
                return calculateFrameRateFromDuration(frameCount, durationMs);
            }
            case PlayerState.Die:
            case PlayerState.PickUp:
            case PlayerState.IdlePeaceMode:
            case PlayerState.IdleCombatMode:
            default:
                return animationConfig.idleFrameRate;
        }
    }

    private getAnimationRepeat(state: PlayerState): number | undefined {
        if (state === PlayerState.MeleeAttack || state === PlayerState.BowAttack || state === PlayerState.BowStance || state === PlayerState.Cast || state === PlayerState.PickUp || state === PlayerState.TakeDamage || state === PlayerState.TakeDamageOnMove || state === PlayerState.TakeDamageWithKnockback || state === PlayerState.Die) {
            return 0;
        }
        return undefined;
    }

    private getAccessoryAnimationFrameRate(state: PlayerState, animationConfig: PlayerAppearanceAnimationConfig): number {
        const angelicState = ANGELIC_STATE_FROM_PLAYER_STATE[state];
        if (angelicState === 5) {
            return DEFAULT_ANIMATION_FRAME_RATE;
        }
        switch (state) {
            case PlayerState.MeleeAttack:
            case PlayerState.BowAttack:
                return animationConfig.attackSpeed;
            case PlayerState.Cast: {
                const frameCount = ANGELIC_STATE_FRAME_COUNT[4];
                return calculateFrameRateFromDuration(frameCount, animationConfig.castSpeed);
            }
            case PlayerState.TakeDamage:
            case PlayerState.TakeDamageOnMove:
            case PlayerState.TakeDamageWithKnockback: {
                const frameCount = ANGELIC_STATE_FRAME_COUNT[2];
                const durationMs = (4 / 15) * 1000;
                return calculateFrameRateFromDuration(frameCount, durationMs);
            }
            case PlayerState.Die:
                return animationConfig.idleFrameRate;
            default:
                return DEFAULT_ANIMATION_FRAME_RATE;
        }
    }

    private getAccessoryAnimationRepeat(state: PlayerState): number | undefined {
        const angelicState = ANGELIC_STATE_FROM_PLAYER_STATE[state];
        if (angelicState === 5) {
            return undefined;
        }
        return 0;
    }
}
