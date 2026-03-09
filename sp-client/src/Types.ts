/**
 * Type definitions for shared data structures across the application.
 */

/**
 * Player gender for selecting equipped sprite variants (e.g. weapon male/female).
 */
export enum Gender {
    MALE = 'male',
    FEMALE = 'female',
}

/**
 * Player skin color for base sprite variant (wm/ym/bm for male, ww/yw/bw for female).
 */
export enum SkinColor {
    Light = 'light',
    Tanned = 'tanned',
    Dark = 'dark',
}

/**
 * Event payload when hovering over a monster. Emitted every 100ms while hovered.
 * Undefined when no monster is hovered or monster becomes dead.
 * overlayScreenX/Y: screen position for overlay anchor (bottom-center of monster, in DOM pixels).
 */
export interface MonsterHoverInfo {
    name: string;
    hp: number;
    maxHp: number;
    overlayScreenX: number;
    overlayScreenY: number;
    damage: number;
    movementSpeed: number;
    attackSpeed: number;
    attackType: AttackType;
    followDistance: number;
    attackDistance: number;
}

/**
 * Event payload for summoning an NPC. Emitted from UI to Phaser.
 */
export interface SummonNPCEvent {
    spriteName: string;
    direction: number;
}

/**
 * Event payload for summoning a monster. Emitted from UI to Phaser.
 */
export interface SummonMonsterEvent {
    spriteName: string;
    direction: number;
    health: number;
    damage: number;
    movementSpeed: number;
    attackSpeed: number;
    followDistance: number;
    attackDistance: number;
    attackType: AttackType;
    /** Transparency slider value 0-100 (0 = opaque, 100 = transparent). Applied at summon time only. */
    transparency?: number;
    /** Chilled blue tint effect. Applied at summon time only. */
    chilledEffect?: boolean;
    /** Berserk red overlay effect. Applied at summon time only. */
    berserkedEffect?: boolean;
}

/**
 * Event payload for casting a spell. Emitted from UI to Phaser.
 */
export interface CastSpellEvent {
    spellId: number;
    /** When true, play cast animation before casting; when false, cast immediately */
    useCastAnimation?: boolean;
}

/**
 * Event payload when player confirms spell target. Emitted from Player to GameWorld.
 */
export interface PlayerConfirmSpellTargetEvent {
    spellId: number;
    originPixelX: number;
    originPixelY: number;
    targetPixelX: number;
    targetPixelY: number;
}

/**
 * Event payload when a monster's attack hits the player.
 */
export interface MonsterAttackPlayerEvent {
    monsterId: number;
    attackType: AttackType;
    /** Damage amount dealt by the monster's attack */
    attackDamage: number;
    /** When true, spawn ArrowProjectile from monster toward player instead of dealing damage immediately */
    bowAttack?: boolean;
}

/**
 * Attack type that determines whether damage interrupts the target.
 */
export enum AttackType {
    /** Damage does not interrupt (e.g. target continues current action) */
    NoInterrupt = 0,
    /** Damage interrupts the target (e.g. cancels attack, plays take damage animation) */
    Interrupt = 1,
    /** Damage interrupts and knocks back the target by 1 cell away from attacker */
    InterruptKnockback = 2,
}

/** Human-readable labels for AttackType. */
export const ATTACK_TYPE_LABELS: Record<AttackType, string> = {
    [AttackType.NoInterrupt]: 'No Interrupt',
    [AttackType.Interrupt]: 'Interrupt',
    [AttackType.InterruptKnockback]: 'Interrupt Knockback',
};

/**
 * Represents a cached minimap with its data URL, scale factor, and original size.
 */
export interface CachedMinimap {
    dataUrl: string;
    scale: number;
    originalSize: number;
}

/**
 * Represents pivot point data for a single sprite frame.
 * Pivot points define the rotation/transformation origin for sprites.
 */
export type PivotFrame = { pivotX: number; pivotY: number; width: number; height: number };

/**
 * Contains pivot data for all sprite sheets in a sprite file.
 * Each sprite sheet has an array of pivot frames.
 */
export type PivotData = {
    spriteSheetPivots: PivotFrame[][];
};
