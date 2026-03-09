/**
 * NPC data structure with display name and sprite name.
 */
export interface NPCData {
    /** Display name of the NPC */
    name: string;

    /** Sprite name without extension (e.g., 'Shopkpr') */
    sprite: string;
}

/**
 * List of available NPCs in the game.
 * Sprite names match the original client MakeSprite calls.
 */
export const NPCS: NPCData[] = [
    { name: 'Shop Keeper', sprite: 'shopkpr' },
    { name: 'Gandalf', sprite: 'gandlf' },
    { name: 'Howard', sprite: 'howard' },
    { name: 'Tom', sprite: 'tom' },
    { name: 'William', sprite: 'william' },
    { name: 'Kennedy', sprite: 'kennedy' },
    { name: 'Gail', sprite: 'gail' },
    { name: 'McGaffin', sprite: 'mcgaffin' },
    { name: 'Perry', sprite: 'perry' },
    { name: 'Devlin', sprite: 'devlin' },
];

/**
 * Get all available NPCs as dropdown options.
 *
 * @returns Array of options with label and value
 */
export function getAllNPCOptions(): Array<{ label: string; value: string }> {
    return NPCS.map((npc) => ({
        label: npc.name,
        value: npc.sprite,
    }));
}

/**
 * Get NPC data by sprite name.
 *
 * @param sprite - The sprite name without extension (e.g., 'Shopkpr')
 * @returns The NPC data or undefined if not found
 */
export function getNPCData(sprite: string): NPCData | undefined {
    return NPCS.find((npc) => npc.sprite === sprite);
}
