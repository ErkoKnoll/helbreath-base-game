import {
    EFFECT_CAST,
    EFFECT_ENERGY_EXPLOSION,
    EFFECT_EXPLOSION,
    CHILL_WIND_DROPLET_SOUND,
    EFFECT_ICE_SHARD,
    EFFECT_SNOW_IMPACT,
    ENERGY_BOLT_LAUNCH_SOUND,
    ITEM_DROPPED_SOUND,
} from './SoundFileNames';

/**
 * Effect configuration for visual effects in the game.
 * Effects play sprite animations at a position and destroy when complete.
 */
export interface EffectConfig {
    /** Display name for UI */
    name: string;
    /** Unique key for lookup */
    key: string;
    /** Sprite file name (without extension), e.g. 'effect11' */
    sprite: string;
    /** Sprite sheet index within the sprite file */
    spriteSheetIndex: number;
    /** Frame rate for animation playback (default: 10) */
    frameRate?: number;
    /** Frame range [start, end] for animation. If not specified, entire sheet is played. */
    animationFrames?: [number, number];
    /** Sound file (e.g. 'E5.mp3') to play when effect is created. Spatially aware of player, no duration modification. */
    sound?: string;
    /** Offset added to depth calculation (default: +80 when omitted). Use negative values to render behind other objects at same Y. */
    depthOffset?: number;
    /** Frame index (0-based) at which to start fading out. From this frame onward, alpha interpolates linearly from 1 to 0 over remaining frames. */
    fadeOutStartAnimationIndex?: number;
    /** When true, draws a light-radius overlay (effect sheet 0 frame 1) behind the main effect. */
    drawLightRadius?: boolean;
    /** Pixel offset applied to X when drawing. */
    offsetX?: number;
    /** Pixel offset applied to Y when drawing. */
    offsetY?: number;
}

export const EFFECT_RESURRECTION = 'resurrection';
export const EFFECT_GOLD_DROP = 'gold-drop';
export const EFFECT_EXPLOSION_1 = 'explosion-1';
export const EFFECT_EXPLOSION_2 = 'explosion-2';
export const EFFECT_EXPLOSION_3 = 'explosion-3';
export const EFFECT_EXPLOSION_4 = 'explosion-4';
export const EFFECT_MASS_CHILL_WIND_DROPLET = 'mass-chill-wind-droplet';
export const EFFECT_LIGHTNING_ARC = 'lightning-arc';
export const EFFECT_SPIKE_FIELD = 'spike-field';
export const EFFECT_FIRE_BALL_EXPLOSION = 'fire-ball-explosion';
export const ENERGY_BOLT_PROJECTILE = 'energy-bolt-projectile';
export const EFFECT_ENERGY_BOLT_EXPLOSION = 'energy-bolt-explosion';
export const EFFECT_PARALYZE = 'paralyze';
export const EFFECT_GENERIC_POINT_CAST = 'generic-point-cast';
export const EFFECT_POSITIONAL_FIRE_1 = 'positional-fire-1';
export const EFFECT_POSITIONAL_FIRE_2 = 'positional-fire-2';
export const EFFECT_POSITIONAL_FIRE_3 = 'positional-fire-3';
export const EFFECT_POSITIONAL_CRIMSON_FIRE = 'positional-crimson-fire';
export const EFFECT_FOOTSTEPS_DRY = 'footsteps-dry';
export const EFFECT_WET_SPLASH = 'wet-splash';
export const EFFECT_METEOR_FALLING = 'meteor-falling';
export const EFFECT_BLUE_ORB = 'blue-orb';
export const EFFECT_WHITE_ORB = 'white-orb';
export const EFFECT_FIRE_ORB = 'fire-orb';
export const EFFECT_METEOR_STRIKE_IMPACT = 'meteor-strike-impact';
export const EFFECT_CRUSADE_SMOKE = 'crusade-smoke';
export const EFFECT_METEOR_EXPLOSION = 'meteor-explosion';
export const EFFECT_METEOR_GROUND_EXPLOSION = 'meteor-ground-explosion';
export const EFFECT_BLOODY_SHOCK_WAVE_NODE = 'bloody-shock-wave-node';
export const CHILL_WIND_DROPLET = 'chill-wind-droplet';
export const EFFECT_ICE_STRIKE_SMALL_SHARD = 'ice-strike-small-shard';
export const EFFECT_ICE_STRIKE_LARGE_SHARD = 'ice-strike-large-shard';
export const EFFECT_ICE_STRIKE_SHARD_IMPACT_FRACTION = 'ice-strike-shard-impact-fraction';
export const EFFECT_POISON_CLOUD = 'poison-cloud';
export const EFFECT_EARTH_WORM_ATTACK_JAWS = 'earth-worm-attack';
export const EFFECT_EARTH_WORM_ATTACK_HELIX = 'earth-worm-attack-helix';
export const EFFECT_EARTH_WORM_ATTACK_BASE = 'earth-worm-attack-base';
export const EFFECT_CELEBRATING_LIGHT_1 = 'celebrating-light-1';
export const EFFECT_CELEBRATING_LIGHT_2 = 'celebrating-light-2';
export const EFFECT_BLIZZARD_SHARD_1 = 'blizzard-shard-1';
export const EFFECT_BLIZZARD_SHARD_2 = 'blizzard-shard-2';
export const EFFECT_BLIZZARD_SHARD_3 = 'blizzard-shard-3';
export const EFFECT_BLIZZARD_SHARD_IMPACT = 'blizzard-shard-impact';
export const EFFECT_ARMOR_BREAK_TORRENT = 'armor-break-torrent';
export const EFFECT_ARMOR_BREAK_BASE = 'armor-break-base';
export const EFFECT_ENERGY_SPHERE = 'energy-sphere';
export const EFFECT_BLUE_APPARITION = 'blue-apparition';
export const EFFECT_HOLD_TWIST = 'hold-twist';
export const EFFECT_SNOOZE = 'snooze';
export const EFFECT_GREEN_EXCLAMATION_MARK = 'green-exclamation-mark';
export const EFFECT_YELLOW_EXCLAMATION_MARK = 'yellow-exclamation-mark';
export const EFFECT_BLUE_ARROW_POINTER = 'blue-arrow-pointer';
export const EFFECT_CRUSADE_CRUSADE_FIRE_1 = 'crusade-fire-1';
export const EFFECT_CRUSADE_CRUSADE_FIRE_2 = 'crusade-fire-2';
export const EFFECT_CRUSADE_CRUSADE_FIRE_3 = 'crusade-fire-3';
export const EFFECT_CRUSADE_ENEMY_INDICATOR = 'crusade-enemy-indicator';
export const EFFECT_WHIRLWIND = 'whirlwind';
export const EFFECT_PROTECTION_RING = 'protection-ring';
export const EFFECT_WEAPON_SPECIAL_POWER_ACTIVATION_1 = 'weapon-special-power-activation-1';
export const EFFECT_WEAPON_SPECIAL_POWER_ACTIVATION_2 = 'weapon-special-power-activation-2';
export const EFFECT_MERIEN_SHIELD_ACTIVATION = 'merien-shield-activation';
export const EFFECT_SPARKLE = 'sparkle';
export const EFFECT_CASTING_CIRCLE = 'casting-circle';
export const EFFECT_STAMINA_DRAIN = 'stamina-drain';
export const EFFECT_HEAL = 'heal';
export const EFFECT_INVISIBILITY = 'invisibility';
export const EFFECT_ABSOLUTE_MAGIC_PROTECTION = 'absolute-magic-protection';
export const EFFECT_STAMINA_RECOVERY = 'stamina-recovery';
export const EFFECT_BERSERK = 'berserk';
export const EFFECT_ILLUSION_MOVEMENT_BASE = 'illusion-movement-base';
export const EFFECT_ILLUSION_MOVEMENT_TORRENT = 'illusion-movement-torrent';
export const EFFECT_MASS_ILLUSION_MOVEMENT_TORRENT = 'mass-illusion-movement-torrent';
export const EFFECT_MASS_ILLUSION_MOVEMENT_BASE = 'mass-illusion-movement-base';
export const EFFECT_DEFENSE_SHIELD = 'defense-shield';
export const EFFECT_SMALL_RED_LIGHT = 'small-red-light';
export const EFFECT_SMALL_YELLOW_LIGHT = 'small-yellow-light';
export const EFFECT_SMALL_GREEN_LIGHT = 'small-green-light';
export const EFFECT_SMALL_CYAN_LIGHT = 'small-cyan-light';
export const EFFECT_SMALL_BLUE_LIGHT = 'small-blue-light';
export const EFFECT_SMALL_PURPLE_LIGHT = 'small-purple-light';
export const EFFECT_PROTECTION_FROM_ARROWS_BUFF = 'protection-from-arrows-buff';
export const EFFECT_UNKNOWN_DEBUFF_1 = 'unknown-debuff-1';
export const EFFECT_UNKNOWN_1 = 'unknown-1';
export const EFFECT_UNKNOWN_2 = 'unknown-2';
export const EFFECT_UNKNOWN_3 = 'unknown-3';
export const EFFECT_UNKNOWN_4 = 'unknown-4';
export const EFFECT_UNKNOWN_5 = 'unknown-5';
export const EFFECT_UNKNOWN_6 = 'unknown-6';
export const EFFECT_UNKNOWN_7 = 'unknown-7';
export const EFFECT_ABSOLUTE_MAGIC_PROTECTION_BUFF = 'absolute-magic-protection-buff';
export const EFFECT_DEFENSE_SHIELD_BUFF = 'defense-shield-buff';
export const EFFECT_POISON_DEBUFF = 'poison-debuff';
export const EFFECT_UNKNOWN_RECOVERY = 'unknown-recovery';
export const EFFECT_UNKNOWN_SMALL_RECOVERY_1 = 'unknown-small-recovery-1';
export const EFFECT_UNKNOWN_SMALL_RECOVERY_2 = 'unknown-small-recovery-2';
export const EFFECT_MAGE_HERO_SET = 'mage-hero-set';
export const EFFECT_WARRIOR_HERO_SET = 'warrior-hero-set';
export const EFFECT_CANCELLATION = 'cancellation';
export const EFFECT_EARTH_SHOCK_WAVE_TORRENT = 'earth-shock-wave-torrent';
export const EFFECT_EARTH_SHOCK_WAVE_DUST = 'earth-shock-wave-dust';
export const EFFECT_INHIBITION_CASTING_1 = 'inhibition-casting-1';
export const EFFECT_INHIBITION_CASTING_2 = 'inhibition-casting-2';
export const EFFECT_STORM_BRINGER = 'storm-bringer';
export const EFFECT_PORTAL_1 = 'portal-1';
export const EFFECT_PORTAL_2 = 'portal-2';
export const EFFECT_VORTEX = 'vortex';
export const EFFECT_MASS_ILLUSION_MOVEMENT_DEBUFF = 'mass-illusion-movement-debuff';
export const EFFECT_ABADDON_SMOKE_CLOUD = 'abaddon-smoke-cloud';
export const EFFECT_ABADDON_AURA = 'abaddon-aura';
export const EFFECT_ABADDON_SPIRIT_1 = 'abaddon-spirit-1';
export const EFFECT_ABADDON_SPIRIT_2 = 'abaddon-spirit-2';
export const EFFECT_ABADDON_SPIRIT_3 = 'abaddon-spirit-3';
export const EFFECT_ABADDON_SPIRIT_4 = 'abaddon-spirit-4';
export const EFFECT_ABADDON_SPIRIT_5 = 'abaddon-spirit-5';
export const EFFECT_ABADDON_SPIRIT_6 = 'abaddon-spirit-6';
export const EFFECT_ABADDON_SPIRIT_7 = 'abaddon-spirit-7';
export const EFFECT_ABADDON_SPIRIT_8 = 'abaddon-spirit-8';
export const EFFECT_ABADDON_SPIRIT_9 = 'abaddon-spirit-9';
export const EFFECT_ABADDON_SPIRIT_10 = 'abaddon-spirit-10';
export const EFFECT_ABADDON_BURNING_CLOUD = 'abaddon-burning-cloud';
export const EFFECT_ABADDON_UNKNOWN_1 = 'abaddon-unknown-1';
export const EFFECT_ABADDON_UNKNOWN_2 = 'abaddon-unknown-2';
export const EFFECT_ABADDON_UNKNOWN_3 = 'abaddon-unknown-3';
export const EFFECT_ABADDON_FISSURE_1 = 'abaddon-fissure-1';
export const EFFECT_ABADDON_FISSURE_2 = 'abaddon-fissure-2';
export const EFFECT_ABADDON_METEOR_1 = 'abaddon-meteor-1';
export const EFFECT_ABADDON_METEOR_2 = 'abaddon-meteor-2';
export const EFFECT_ABADDON_METEOR_3 = 'abaddon-meteor-3';
export const EFFECT_ABADDON_METEOR_EXPLOSION = 'abaddon-meteor-explosion';
export const EFFECT_ABADDON_FISSURE_SMOKE = 'abaddon-meteor-smoke';

export const EFFECTS: EffectConfig[] = [
    {
        name: 'Explosion 1',
        key: EFFECT_EXPLOSION_1,
        sprite: 'effect3',
        spriteSheetIndex: 1,
        frameRate: 20,
        sound: EFFECT_EXPLOSION
    },
    {
        name: 'Explosion 2',
        key: EFFECT_EXPLOSION_2,
        sprite: 'effect3',
        spriteSheetIndex: 2,
        frameRate: 20,
        sound: EFFECT_EXPLOSION
    },
    {
        name: 'Explosion 3',
        key: EFFECT_EXPLOSION_3,
        sprite: 'effect3',
        spriteSheetIndex: 5,
        frameRate: 20,
    },
    {
        name: 'Explosion 4',
        key: EFFECT_EXPLOSION_4,
        sprite: 'effect11',
        spriteSheetIndex: 8,
        frameRate: 15,
    },
    {
        name: 'Mass Chill Wind Droplet',
        key: EFFECT_MASS_CHILL_WIND_DROPLET,
        sprite: 'effect5',
        spriteSheetIndex: 6,
        frameRate: 20,
        animationFrames: [0, 13],
        sound: CHILL_WIND_DROPLET_SOUND
    },
    {
        name: 'Lightning Arc',
        key: EFFECT_LIGHTNING_ARC,
        sprite: 'effect3',
        spriteSheetIndex: 3,
        frameRate: 40,
    },
    {
        name: 'Spike Field',
        key: EFFECT_SPIKE_FIELD,
        sprite: 'effect3',
        spriteSheetIndex: 4,
        frameRate: 10,
        depthOffset: -1
    },
    {
        name: 'Fire Ball Explosion',
        key: EFFECT_FIRE_BALL_EXPLOSION,
        sprite: 'effect',
        spriteSheetIndex: 3,
        frameRate: 20,
        sound: EFFECT_EXPLOSION
    },
    {
        name: 'Energy Bolt Projectile',
        key: ENERGY_BOLT_PROJECTILE,
        sprite: 'effect',
        spriteSheetIndex: 0,
        animationFrames: [2, 5],
        frameRate: 20,
        sound: ENERGY_BOLT_LAUNCH_SOUND
    },
    {
        name: 'Energy Bolt Explosion',
        key: EFFECT_ENERGY_BOLT_EXPLOSION,
        sprite: 'effect',
        spriteSheetIndex: 6,
        frameRate: 50,
        sound: EFFECT_ENERGY_EXPLOSION,
        fadeOutStartAnimationIndex: 6,
        drawLightRadius: true,
    },
    {
        name: 'Meteor Falling',
        key: EFFECT_METEOR_FALLING,
        sprite: 'crueffect1',
        spriteSheetIndex: 0,
        frameRate: 20,
        animationFrames: [0, 4],
    },
    {
        name: 'Meteor Strike Impact',
        key: EFFECT_METEOR_STRIKE_IMPACT,
        sprite: 'crueffect1',
        spriteSheetIndex: 1,
        frameRate: 20,
        sound: EFFECT_EXPLOSION
    },
    {
        name: 'Crusade Smoke',
        key: EFFECT_CRUSADE_SMOKE,
        sprite: 'crueffect1',
        spriteSheetIndex: 0,
        frameRate: 20,
        animationFrames: [20, 24],
    },
    {
        name: 'Crusade Fire 1',
        key: EFFECT_CRUSADE_CRUSADE_FIRE_1,
        sprite: 'crueffect1',
        spriteSheetIndex: 4,
        frameRate: 50,
    },
    {
        name: 'Crusade Fire 2',
        key: EFFECT_CRUSADE_CRUSADE_FIRE_2,
        sprite: 'crueffect1',
        spriteSheetIndex: 5,
        frameRate: 30,
    },
    {
        name: 'Crusade Fire 3',
        key: EFFECT_CRUSADE_CRUSADE_FIRE_3,
        sprite: 'crueffect1',
        spriteSheetIndex: 6,
        frameRate: 50,
    },
    {
        name: 'Crusade Enemy Indicator',
        key: EFFECT_CRUSADE_ENEMY_INDICATOR,
        sprite: 'crueffect1',
        spriteSheetIndex: 7,
        frameRate: 5,
    },
    {
        name: 'Generic Point Cast',
        key: EFFECT_GENERIC_POINT_CAST,
        sprite: 'effect',
        spriteSheetIndex: 4,
        frameRate: 10,
        sound: EFFECT_CAST
    },
    {
        name: 'Positional Fire 1',
        key: EFFECT_POSITIONAL_FIRE_1,
        sprite: 'effect',
        spriteSheetIndex: 9,
        frameRate: 10,
    },
    {
        name: 'Positional Fire 2',
        key: EFFECT_POSITIONAL_FIRE_2,
        sprite: 'effect11',
        spriteSheetIndex: 0,
        frameRate: 10,
    },
    {
        name: 'Positional Fire 3',
        key: EFFECT_POSITIONAL_FIRE_3,
        sprite: 'effect11',
        spriteSheetIndex: 4,
        frameRate: 10,
    },
    {
        name: 'Positional Crimson Fire',
        key: EFFECT_POSITIONAL_CRIMSON_FIRE,
        sprite: 'effect2',
        spriteSheetIndex: 2,
        frameRate: 10,
    },
    {
        name: 'Blue Orb',
        key: EFFECT_BLUE_ORB,
        sprite: 'crueffect1',
        spriteSheetIndex: 0,
        frameRate: 10,
        animationFrames: [5, 9],
    },
    {
        name: 'White Orb',
        key: EFFECT_WHITE_ORB,
        sprite: 'crueffect1',
        spriteSheetIndex: 0,
        frameRate: 10,
        animationFrames: [10, 14],
    },
    {
        name: 'Fire Orb',
        key: EFFECT_FIRE_ORB,
        sprite: 'crueffect1',
        spriteSheetIndex: 0,
        frameRate: 10,
        animationFrames: [15, 19],
    },
    {
        name: 'Meteor Explosion',
        key: EFFECT_METEOR_EXPLOSION,
        sprite: 'crueffect1',
        spriteSheetIndex: 2,
        frameRate: 20,
    },
    {
        name: 'Meteor Ground Explosion',
        key: EFFECT_METEOR_GROUND_EXPLOSION,
        sprite: 'crueffect1',
        spriteSheetIndex: 8,
        frameRate: 30,
    },
    {
        name: 'Bloody Shock Wave Node',
        key: EFFECT_BLOODY_SHOCK_WAVE_NODE,
        sprite: 'effect4',
        spriteSheetIndex: 0,
        frameRate: 30,
        sound: ENERGY_BOLT_LAUNCH_SOUND
    },
    {
        name: 'Chill Wind Droplet',
        key: CHILL_WIND_DROPLET,
        sprite: 'effect4',
        spriteSheetIndex: 1,
        frameRate: 33,
        animationFrames: [0, 14],
        sound: CHILL_WIND_DROPLET_SOUND,
        drawLightRadius: true,
    },
    {
        name: 'Ice Strike Small Shard',
        key: EFFECT_ICE_STRIKE_SMALL_SHARD,
        sprite: 'effect4',
        spriteSheetIndex: 2,
        frameRate: 50,
        animationFrames: [0, 23],
    },
    {
        name: 'Ice Strike',
        key: EFFECT_ICE_STRIKE_LARGE_SHARD,
        sprite: 'effect4',
        spriteSheetIndex: 2,
        frameRate: 30,
        animationFrames: [24, 31],
    },
    {
        name: 'Ice Shard Impact Fraction',
        key: EFFECT_ICE_STRIKE_SHARD_IMPACT_FRACTION,
        sprite: 'effect4',
        spriteSheetIndex: 3,
        frameRate: 10,
        sound: EFFECT_ICE_SHARD
    },
    {
        name: 'Poison Cloud',
        key: EFFECT_POISON_CLOUD,
        sprite: 'effect4',
        spriteSheetIndex: 4,
        frameRate: 10,
    },
    {
        name: 'Earth Worm Attack Jaws',
        key: EFFECT_EARTH_WORM_ATTACK_JAWS,
        sprite: 'effect6',
        spriteSheetIndex: 0,
        frameRate: 20,
        sound: ENERGY_BOLT_LAUNCH_SOUND
    },
    {
        name: 'Earth Worm Attack Helix',
        key: EFFECT_EARTH_WORM_ATTACK_HELIX,
        sprite: 'effect6',
        spriteSheetIndex: 1,
        frameRate: 20,
    },
    {
        name: 'Earth Worm Attack Base',
        key: EFFECT_EARTH_WORM_ATTACK_BASE,
        sprite: 'effect6',
        spriteSheetIndex: 4,
        frameRate: 20,
    },
    {
        name: 'Celebrating Light 1',
        key: EFFECT_CELEBRATING_LIGHT_1,
        sprite: 'effect6',
        spriteSheetIndex: 2,
        frameRate: 20,
    },
    {
        name: 'Celebrating Light 2',
        key: EFFECT_CELEBRATING_LIGHT_2,
        sprite: 'effect6',
        spriteSheetIndex: 3,
        frameRate: 20,
    },
    {
        name: 'Blizzard Shard 1',
        key: EFFECT_BLIZZARD_SHARD_1,
        sprite: 'effect7',
        spriteSheetIndex: 1,
        frameRate: 20,
        sound: EFFECT_ICE_SHARD
    },
    {
        name: 'Blizzard Shard 2',
        key: EFFECT_BLIZZARD_SHARD_2,
        sprite: 'effect7',
        spriteSheetIndex: 2,
        frameRate: 20,
        sound: EFFECT_ICE_SHARD
    },
    {
        name: 'Blizzard Shard 3',
        key: EFFECT_BLIZZARD_SHARD_3,
        sprite: 'effect7',
        spriteSheetIndex: 3,
        frameRate: 20,
        sound: EFFECT_ICE_SHARD
    },
    {
        name: 'Blizzard Shard Impact',
        key: EFFECT_BLIZZARD_SHARD_IMPACT,
        sprite: 'effect7',
        spriteSheetIndex: 6,
        frameRate: 15,
        sound: EFFECT_SNOW_IMPACT
    },
    {
        name: 'Armor Break Torrent',
        key: EFFECT_ARMOR_BREAK_TORRENT,
        sprite: 'effect7',
        spriteSheetIndex: 9,
        frameRate: 15,
        sound: EFFECT_CAST
    },
    {
        name: 'Armor Break Base',
        key: EFFECT_ARMOR_BREAK_BASE,
        sprite: 'effect7',
        spriteSheetIndex: 10,
        frameRate: 20,
    },
    {
        name: 'Small Red Light',
        key: EFFECT_SMALL_RED_LIGHT,
        sprite: 'effect9',
        spriteSheetIndex: 0,
        frameRate: 15,
    },
    {
        name: 'Small Yellow Light',
        key: EFFECT_SMALL_YELLOW_LIGHT,
        sprite: 'effect9',
        spriteSheetIndex: 1,
        frameRate: 15,
    },
    {
        name: 'Small Green Light',
        key: EFFECT_SMALL_GREEN_LIGHT,
        sprite: 'effect9',
        spriteSheetIndex: 2,
        frameRate: 15,
    },
    {
        name: 'Small Cyan Light',
        key: EFFECT_SMALL_CYAN_LIGHT,
        sprite: 'effect9',
        spriteSheetIndex: 3,
        frameRate: 15,
    },
    {
        name: 'Small Blue Light',
        key: EFFECT_SMALL_BLUE_LIGHT,
        sprite: 'effect9',
        spriteSheetIndex: 4,
        frameRate: 15,
    },
    {
        name: 'Small Purple Light',
        key: EFFECT_SMALL_PURPLE_LIGHT,
        sprite: 'effect9',
        spriteSheetIndex: 5,
        frameRate: 15,
    },
    {
        name: 'Energy Sphere',
        key: EFFECT_ENERGY_SPHERE,
        sprite: 'effect5',
        spriteSheetIndex: 0,
        frameRate: 10,
    },
    {
        name: 'Blue Apparition',
        key: EFFECT_BLUE_APPARITION,
        sprite: 'effect5',
        spriteSheetIndex: 5,
        frameRate: 10,
        animationFrames: [11, 20],
    },
    {
        name: 'Whirlwind',
        key: EFFECT_WHIRLWIND,
        sprite: 'effect3',
        spriteSheetIndex: 0,
        frameRate: 15,
    },
    {
        name: 'Storm Bringer',
        key: EFFECT_STORM_BRINGER,
        sprite: 'effect11',
        spriteSheetIndex: 11,
        frameRate: 15,
        offsetX: 75,
        offsetY: 64,
    },
    {
        name: 'Portal 1',
        key: EFFECT_PORTAL_1,
        sprite: 'effect11',
        spriteSheetIndex: 12,
        frameRate: 15,
    },
    {
        name: 'Portal 2',
        key: EFFECT_PORTAL_2,
        sprite: 'effect11',
        spriteSheetIndex: 13,
        frameRate: 15,
    },
    {
        name: 'Earth Shock Wave Torrent',
        key: EFFECT_EARTH_SHOCK_WAVE_TORRENT,
        sprite: 'effect11',
        spriteSheetIndex: 2,
        frameRate: 50,
        sound: ENERGY_BOLT_LAUNCH_SOUND
    },
    {
        name: 'Earth Shock Wave Dust',
        key: EFFECT_EARTH_SHOCK_WAVE_DUST,
        sprite: 'effect11',
        spriteSheetIndex: 3,
        frameRate: 50,
    }, {
        name: 'Footsteps (dry)',
        key: EFFECT_FOOTSTEPS_DRY,
        sprite: 'effect2',
        spriteSheetIndex: 1,
        animationFrames: [28, 32],
        frameRate: 10,
        depthOffset: -1,
    },
    {
        name: 'Wet splash',
        key: EFFECT_WET_SPLASH,
        sprite: 'effect2',
        spriteSheetIndex: 1,
        animationFrames: [20, 23],
        frameRate: 10,
        depthOffset: -1,
    },
    {
        name: 'Vortex (bugged)',
        key: EFFECT_VORTEX,
        sprite: 'effect12',
        spriteSheetIndex: 0,
        frameRate: 15,
    },
    {
        name: 'Hold Twist',
        key: EFFECT_HOLD_TWIST,
        sprite: 'crueffect1',
        spriteSheetIndex: 3,
        frameRate: 15,
        sound: EFFECT_CAST
    },
    {
        name: 'Snooze',
        key: EFFECT_SNOOZE,
        sprite: 'effect9',
        spriteSheetIndex: 19,
        frameRate: 10,
    },
    {
        name: 'Green Exclamation Mark',
        key: EFFECT_GREEN_EXCLAMATION_MARK,
        sprite: 'effect9',
        spriteSheetIndex: 20,
        frameRate: 10,
    },
    {
        name: 'Yellow Exclamation Mark',
        key: EFFECT_YELLOW_EXCLAMATION_MARK,
        sprite: 'effect9',
        spriteSheetIndex: 21,
        frameRate: 10,
    },
    {
        name: 'Blue Arrow Pointer',
        key: EFFECT_BLUE_ARROW_POINTER,
        sprite: 'effect8',
        spriteSheetIndex: 0,
        frameRate: 15,
    },
    {
        name: 'Gold Drop',
        key: EFFECT_GOLD_DROP,
        sprite: 'effect',
        spriteSheetIndex: 1,
        sound: ITEM_DROPPED_SOUND
    },
    {
        name: 'Unknown Effect 1',
        key: EFFECT_UNKNOWN_1,
        sprite: 'effect9',
        spriteSheetIndex: 8,
        frameRate: 15,
    },
    {
        name: 'Unknown Effect 2',
        key: EFFECT_UNKNOWN_2,
        sprite: 'effect9',
        spriteSheetIndex: 9,
        frameRate: 15,
    },
    {
        name: 'Unknown Effect 3',
        key: EFFECT_UNKNOWN_3,
        sprite: 'effect9',
        spriteSheetIndex: 10,
        frameRate: 15,
    },
    {
        name: 'Unknown Effect 4',
        key: EFFECT_UNKNOWN_4,
        sprite: 'effect9',
        spriteSheetIndex: 11,
        frameRate: 15,
    },
    {
        name: 'Unknown Effect 5',
        key: EFFECT_UNKNOWN_5,
        sprite: 'effect9',
        spriteSheetIndex: 12,
        frameRate: 15,
    },
    {
        name: 'Unknown Effect 6',
        key: EFFECT_UNKNOWN_6,
        sprite: 'effect11',
        spriteSheetIndex: 7,
        frameRate: 10,
    },
    {
        name: 'Unknown Effect 7 (bugged)',
        key: EFFECT_UNKNOWN_7,
        sprite: 'effect12',
        spriteSheetIndex: 2,
        frameRate: 15,
    },
    {
        name: 'Paralyze',
        key: EFFECT_PARALYZE,
        sprite: 'effect5',
        spriteSheetIndex: 2,
        frameRate: 25,
        sound: EFFECT_CAST
    },
    {
        name: 'Resurrection',
        key: EFFECT_RESURRECTION,
        sprite: 'effect11',
        spriteSheetIndex: 10,
        frameRate: 15
    },
    {
        name: 'Protection Ring',
        key: EFFECT_PROTECTION_RING,
        sprite: 'effect5',
        spriteSheetIndex: 1,
        frameRate: 15,
        sound: EFFECT_CAST,
        depthOffset: -1
    },
    {
        name: 'Weapon Special Power Activation 1',
        key: EFFECT_WEAPON_SPECIAL_POWER_ACTIVATION_1,
        sprite: 'effect5',
        spriteSheetIndex: 3,
        frameRate: 15,
        depthOffset: -1
    },
    {
        name: 'Weapon Special Power Activation 2 (bugged)',
        key: EFFECT_WEAPON_SPECIAL_POWER_ACTIVATION_2,
        sprite: 'effect12',
        spriteSheetIndex: 1,
        frameRate: 15,
    },
    {
        name: 'Merien Shield Activation',
        key: EFFECT_MERIEN_SHIELD_ACTIVATION,
        sprite: 'effect5',
        spriteSheetIndex: 4,
        frameRate: 15,
    },
    {
        name: 'Sparkle',
        key: EFFECT_SPARKLE,
        sprite: 'effect5',
        spriteSheetIndex: 5,
        frameRate: 15,
        animationFrames: [0, 10],
    },
    {
        name: 'Casting Circle',
        key: EFFECT_CASTING_CIRCLE,
        sprite: 'effect5',
        spriteSheetIndex: 7,
        frameRate: 10,
        depthOffset: -1
    },
    {
        name: 'Stamina Drain',
        key: EFFECT_STAMINA_DRAIN,
        sprite: 'effect7',
        spriteSheetIndex: 4,
        frameRate: 15,
        sound: EFFECT_CAST
    },
    {
        name: 'Heal',
        key: EFFECT_HEAL,
        sprite: 'effect7',
        spriteSheetIndex: 5,
        frameRate: 15,
        sound: EFFECT_CAST
    },
    {
        name: 'Invisibility',
        key: EFFECT_INVISIBILITY,
        sprite: 'effect7',
        spriteSheetIndex: 7,
        frameRate: 20,
        sound: EFFECT_CAST
    },
    {
        name: 'Absolute Magic Protection',
        key: EFFECT_ABSOLUTE_MAGIC_PROTECTION,
        sprite: 'effect7',
        spriteSheetIndex: 8,
        frameRate: 15,
        sound: EFFECT_CAST
    },
    {
        name: 'Stamina Recovery',
        key: EFFECT_STAMINA_RECOVERY,
        sprite: 'effect7',
        spriteSheetIndex: 11,
        frameRate: 15,
        sound: EFFECT_CAST
    },
    {
        name: 'Berserk',
        key: EFFECT_BERSERK,
        sprite: 'effect8',
        spriteSheetIndex: 1,
        frameRate: 10,
        sound: EFFECT_CAST,
        depthOffset: -1
    },
    {
        name: 'Illusion Movement Base',
        key: EFFECT_ILLUSION_MOVEMENT_BASE,
        sprite: 'effect8',
        spriteSheetIndex: 2,
        frameRate: 10,
        sound: EFFECT_CAST,
        depthOffset: -1
    },
    {
        name: 'Illusion Movement Torrent',
        key: EFFECT_ILLUSION_MOVEMENT_TORRENT,
        sprite: 'effect8',
        spriteSheetIndex: 3,
        frameRate: 10,
    },
    {
        name: 'Mass Illusion Movement Base',
        key: EFFECT_MASS_ILLUSION_MOVEMENT_BASE,
        sprite: 'effect8',
        spriteSheetIndex: 5,
        frameRate: 10,
        sound: EFFECT_CAST,
        depthOffset: -1
    },
    {
        name: 'Mass Illusion Movement Torrent',
        key: EFFECT_MASS_ILLUSION_MOVEMENT_TORRENT,
        sprite: 'effect8',
        spriteSheetIndex: 4,
        frameRate: 10,
    },
    {
        name: 'Defense Shield',
        key: EFFECT_DEFENSE_SHIELD,
        sprite: 'effect8',
        spriteSheetIndex: 6,
        frameRate: 10,
        sound: EFFECT_CAST,
        depthOffset: -1
    },
    {
        name: 'Protection From Arrows Buff',
        key: EFFECT_PROTECTION_FROM_ARROWS_BUFF,
        sprite: 'effect9',
        spriteSheetIndex: 6,
        frameRate: 15,
        depthOffset: -11
    },
    {
        name: 'Unknown Debuff 1',
        key: EFFECT_UNKNOWN_DEBUFF_1,
        sprite: 'effect9',
        spriteSheetIndex: 7,
        frameRate: 15,
    },
    {
        name: 'Absolute Magic Protection Buff',
        key: EFFECT_ABSOLUTE_MAGIC_PROTECTION_BUFF,
        sprite: 'effect9',
        spriteSheetIndex: 13,
        frameRate: 15,
    },
    {
        name: 'Defense Shield Buff',
        key: EFFECT_DEFENSE_SHIELD_BUFF,
        sprite: 'effect9',
        spriteSheetIndex: 14,
        frameRate: 15,
    },
    {
        name: 'Poison Debuff',
        key: EFFECT_POISON_DEBUFF,
        sprite: 'effect9',
        spriteSheetIndex: 15,
        frameRate: 10,
    },
    {
        name: 'Unknown Recovery',
        key: EFFECT_UNKNOWN_RECOVERY,
        sprite: 'effect9',
        spriteSheetIndex: 16,
        frameRate: 15,
        sound: EFFECT_CAST
    },
    {
        name: 'Unknown Small Recovery 1',
        key: EFFECT_UNKNOWN_SMALL_RECOVERY_1,
        sprite: 'effect9',
        spriteSheetIndex: 17,
        frameRate: 15,
        sound: EFFECT_CAST
    },
    {
        name: 'Unknown Small Recovery 2',
        key: EFFECT_UNKNOWN_SMALL_RECOVERY_2,
        sprite: 'effect9',
        spriteSheetIndex: 18,
        frameRate: 15,
        sound: EFFECT_CAST
    },
    {
        name: 'Mage Hero Set',
        key: EFFECT_MAGE_HERO_SET,
        sprite: 'effect10',
        spriteSheetIndex: 0,
        frameRate: 15,
        depthOffset: -1
    },
    {
        name: 'Warrior Hero Set',
        key: EFFECT_WARRIOR_HERO_SET,
        sprite: 'effect10',
        spriteSheetIndex: 1,
        frameRate: 20,
    },
    {
        name: 'Cancellation',
        key: EFFECT_CANCELLATION,
        sprite: 'effect11',
        spriteSheetIndex: 1,
        frameRate: 15,
    },
    {
        name: 'Inhibition Casting 1',
        key: EFFECT_INHIBITION_CASTING_1,
        sprite: 'effect11',
        spriteSheetIndex: 5,
        frameRate: 15,
    },
    {
        name: 'Inhibition Casting 2',
        key: EFFECT_INHIBITION_CASTING_2,
        sprite: 'effect11',
        spriteSheetIndex: 6,
        frameRate: 15,
    },
    {
        name: 'Mass Illusion Movement Debuff',
        key: EFFECT_MASS_ILLUSION_MOVEMENT_DEBUFF,
        sprite: 'effect12',
        spriteSheetIndex: 3,
        frameRate: 15,
    },
    {
        name: 'Abaddon Smoke Cloud',
        key: EFFECT_ABADDON_SMOKE_CLOUD,
        sprite: 'yseffect3',
        spriteSheetIndex: 0,
        frameRate: 15,
    },
    {
        name: 'Abaddon Aura',
        key: EFFECT_ABADDON_AURA,
        sprite: 'yseffect3',
        spriteSheetIndex: 1,
        frameRate: 15,
    },
    {
        name: 'Abaddon Spirit 1',
        key: EFFECT_ABADDON_SPIRIT_1,
        sprite: 'yseffect3',
        spriteSheetIndex: 2,
        frameRate: 10,
    },
    {
        name: 'Abaddon Spirit 2',
        key: EFFECT_ABADDON_SPIRIT_2,
        sprite: 'yseffect3',
        spriteSheetIndex: 3,
        frameRate: 10,
    },
    {
        name: 'Abaddon Spirit 3',
        key: EFFECT_ABADDON_SPIRIT_3,
        sprite: 'yseffect3',
        spriteSheetIndex: 4,
        frameRate: 10,
    },
    {
        name: 'Abaddon Spirit 4',
        key: EFFECT_ABADDON_SPIRIT_4,
        sprite: 'yseffect3',
        spriteSheetIndex: 5,
        frameRate: 10,
    },
    {
        name: 'Abaddon Spirit 5',
        key: EFFECT_ABADDON_SPIRIT_5,
        sprite: 'yseffect3',
        spriteSheetIndex: 6,
        frameRate: 10,
    },
    {
        name: 'Abaddon Spirit 6',
        key: EFFECT_ABADDON_SPIRIT_6,
        sprite: 'yseffect3',
        spriteSheetIndex: 7,
        frameRate: 10,
    },
    {
        name: 'Abaddon Spirit 7',
        key: EFFECT_ABADDON_SPIRIT_7,
        sprite: 'yseffect3',
        spriteSheetIndex: 8,
        frameRate: 10,
    },
    {
        name: 'Abaddon Spirit 8',
        key: EFFECT_ABADDON_SPIRIT_8,
        sprite: 'yseffect3',
        spriteSheetIndex: 9,
        frameRate: 10,
    },
    {
        name: 'Abaddon Spirit 9',
        key: EFFECT_ABADDON_SPIRIT_9,
        sprite: 'yseffect3',
        spriteSheetIndex: 10,
        frameRate: 10,
    },
    {
        name: 'Abaddon Spirit 10',
        key: EFFECT_ABADDON_SPIRIT_10,
        sprite: 'yseffect3',
        spriteSheetIndex: 11,
        frameRate: 10,
    },
    {
        name: 'Abaddon Burning Cloud',
        key: EFFECT_ABADDON_BURNING_CLOUD,
        sprite: 'yseffect3',
        spriteSheetIndex: 12,
        frameRate: 10,
    },
    {
        name: 'Abaddon Unknown Effect 1',
        key: EFFECT_ABADDON_UNKNOWN_1,
        sprite: 'yseffect3',
        spriteSheetIndex: 13,
        frameRate: 10,
    },
    {
        name: 'Abaddon Unknown Effect 2',
        key: EFFECT_ABADDON_UNKNOWN_2,
        sprite: 'yseffect3',
        spriteSheetIndex: 14,
        frameRate: 10,
    },
    {
        name: 'Abaddon Unknown Effect 3',
        key: EFFECT_ABADDON_UNKNOWN_3,
        sprite: 'yseffect3',
        spriteSheetIndex: 15,
        frameRate: 10,
    },
    {
        name: 'Abaddon Fissure 1',
        key: EFFECT_ABADDON_FISSURE_1,
        sprite: 'yseffect4',
        spriteSheetIndex: 4,
        frameRate: 10,
    },
    {
        name: 'Abaddon Meteor 1',
        key: EFFECT_ABADDON_METEOR_1,
        sprite: 'yseffect4',
        spriteSheetIndex: 5,
        frameRate: 15,
    },
    {
        name: 'Abaddon Meteor 2',
        key: EFFECT_ABADDON_METEOR_2,
        sprite: 'yseffect4',
        spriteSheetIndex: 1,
        frameRate: 15,
    },
    {
        name: 'Abaddon Meteor 3',
        key: EFFECT_ABADDON_METEOR_3,
        sprite: 'yseffect4',
        spriteSheetIndex: 2,
        frameRate: 15,
    },
    {
        name: 'Abaddon Meteor Explosion',
        key: EFFECT_ABADDON_METEOR_EXPLOSION,
        sprite: 'yseffect4',
        spriteSheetIndex: 3,
        frameRate: 15,
    },
    {
        name: 'Abaddon Fissure Smoke',
        key: EFFECT_ABADDON_FISSURE_SMOKE,
        sprite: 'yseffect4',
        spriteSheetIndex: 6,
        frameRate: 15,
    },
];

/**
 * Get effect config by key.
 */
export function getEffectByKey(key: string): EffectConfig | undefined {
    return EFFECTS.find((e) => e.key === key);
}
