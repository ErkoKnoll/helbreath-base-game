/**
 * Spell definitions for the game.
 * Spells are identified by numeric ID and can be cast at world coordinates.
 */
export interface SpellConfig {
    /** Numeric ID for the spell */
    id: number;
    /** Display name for UI */
    name: string;
}

export const SPELL_ENERGY_BOLT_ID = 1;
export const SPELL_FIRE_BALL_ID = 2;
export const SPELL_FIRE_STRIKE_ID = 3;
export const SPELL_FIRE_WALL_ID = 4;
export const SPELL_CHILL_WIND_ID = 5;
export const SPELL_POISON_CLOUD_ID = 6;
export const SPELL_TRIPLE_ENERGY_BOLT_ID = 7;
export const SPELL_LIGHTNING_BOLT_ID = 8;
export const SPELL_SPIKE_FIELD_ID = 9;
export const SPELL_ICE_STORM_ID = 10;
export const SPELL_ICE_STRIKE_ID = 11;
export const SPELL_ENERGY_STRIKE_ID = 12;
export const SPELL_MASS_FIRE_STRIKE_ID = 13;
export const SPELL_MASS_CHILL_WIND_ID = 14;
export const SPELL_EARTHWORM_STRIKE_ID = 15;
export const SPELL_ARMOR_BREAK_ID = 16;
export const SPELL_BLOODY_SHOCK_WAVE_ID = 17;
export const SPELL_MASS_ICE_STRIKE_ID = 18;
export const SPELL_LIGHTNING_STRIKE_ID = 19;
export const SPELL_METEOR_STRIKE_ID = 20;
export const SPELL_MASS_LIGHTNING_STRIKE_ID = 21;
export const SPELL_BLIZZARD_ID = 22;
export const SPELL_EARTH_SHOCK_WAVE_ID = 23;
export const SPELL_MASS_BLIZZARD_ID = 24;

export const SPELLS: SpellConfig[] = [
    {
        id: SPELL_ENERGY_BOLT_ID,
        name: 'Energy Bolt',
    },
    {
        id: SPELL_FIRE_BALL_ID,
        name: 'Fire Ball',
    },
    {
        id: SPELL_FIRE_STRIKE_ID,
        name: 'Fire Strike',
    },
    {
        id: SPELL_FIRE_WALL_ID,
        name: 'Fire Wall',
    },
    {
        id: SPELL_CHILL_WIND_ID,
        name: 'Chill Wind',
    },
    {
        id: SPELL_POISON_CLOUD_ID,
        name: 'Poison Cloud',
    },
    {
        id: SPELL_TRIPLE_ENERGY_BOLT_ID,
        name: 'Triple Energy Bolt',
    },
    {
        id: SPELL_LIGHTNING_BOLT_ID,
        name: 'Lightning Bolt',
    },
    {
        id: SPELL_SPIKE_FIELD_ID,
        name: 'Spike Field',
    },
    {
        id: SPELL_ICE_STORM_ID,
        name: 'Ice Storm',
    },
    {
        id: SPELL_ICE_STRIKE_ID,
        name: 'Ice Strike',
    },
    {
        id: SPELL_ENERGY_STRIKE_ID,
        name: 'Energy Strike',
    },
    {
        id: SPELL_MASS_FIRE_STRIKE_ID,
        name: 'Mass Fire Strike',
    },
    {
        id: SPELL_MASS_CHILL_WIND_ID,
        name: 'Mass Chill Wind',
    },
    {
        id: SPELL_EARTHWORM_STRIKE_ID,
        name: 'Earthworm Strike',
    },
    {
        id: SPELL_ARMOR_BREAK_ID,
        name: 'Armor Break',
    },
    {
        id: SPELL_BLOODY_SHOCK_WAVE_ID,
        name: 'Bloody Shock Wave',
    },
    {
        id: SPELL_MASS_ICE_STRIKE_ID,
        name: 'Mass Ice Strike',
    },
    {
        id: SPELL_LIGHTNING_STRIKE_ID,
        name: 'Lightning Strike',
    },
    {
        id: SPELL_METEOR_STRIKE_ID,
        name: 'Meteor Strike',
    },
    {
        id: SPELL_MASS_LIGHTNING_STRIKE_ID,
        name: 'Mass Lightning Strike',
    },
    {
        id: SPELL_BLIZZARD_ID,
        name: 'Blizzard',
    },
    {
        id: SPELL_EARTH_SHOCK_WAVE_ID,
        name: 'Earth Shock Wave',
    },
    {
        id: SPELL_MASS_BLIZZARD_ID,
        name: 'Mass Blizzard',
    },
];

export function getSpellById(id: number): SpellConfig | undefined {
    return SPELLS.find((s) => s.id === id);
}
