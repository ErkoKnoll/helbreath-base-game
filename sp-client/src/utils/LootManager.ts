import type { Effect } from '../constants/Items';

/**
 * Represents a single item dropped on the ground at a world cell.
 * Items at the same cell form a stack (top = last dropped).
 */
export interface GroundLootItem {
    itemId: number;
    itemUid: number;
    quantity: number;
    /** Tint color (hex) for items with TINT_INVENTORY effect. Applied to ground sprite. */
    tint?: number;
    /** Per-instance effect overrides (e.g. Appearance Glow). Restored when picked up. */
    effectOverrides?: Effect[];
}

/**
 * Manages items dropped on the ground.
 * Tracks world cell coordinates and stacks of items at each cell.
 * Items can be dropped on top of each other, forming a stack.
 * When an item is picked up, the item underneath becomes visible.
 * State is cleared when the map changes/reloads.
 */
export class LootManager {
    /** Map of "worldX,worldY" -> stack of items (bottom to top; last pushed = top of stack) */
    private readonly stacks = new Map<string, GroundLootItem[]>();

    /**
     * Adds an item to the ground at the specified world cell.
     * The item is placed on top of any existing stack.
     *
     * @param worldX - World X coordinate (cell)
     * @param worldY - World Y coordinate (cell)
     * @param item - The item to add (itemId, itemUid, quantity)
     */
    public addItem(worldX: number, worldY: number, item: GroundLootItem): void {
        const key = this.cellKey(worldX, worldY);
        const stack = this.stacks.get(key) ?? [];
        stack.push(item);
        this.stacks.set(key, stack);
    }

    /**
     * Removes the top (visible) item at the specified world cell.
     * Returns the removed item or undefined if stack is empty.
     *
     * @param worldX - World X coordinate
     * @param worldY - World Y coordinate
     * @returns The removed item or undefined
     */
    public removeTopItem(worldX: number, worldY: number): GroundLootItem | undefined {
        const key = this.cellKey(worldX, worldY);
        const stack = this.stacks.get(key);
        if (!stack || stack.length === 0) {
            return undefined;
        }
        const item = stack.pop()!;
        if (stack.length === 0) {
            this.stacks.delete(key);
        }
        return item;
    }

    /**
     * Removes an item from the ground by itemUid.
     * Returns the removed item or undefined if not found.
     *
     * @param itemUid - Unique ID of the item to remove
     * @returns The removed item and its cell, or undefined
     */
    public removeItem(itemUid: number): { item: GroundLootItem; worldX: number; worldY: number } | undefined {
        for (const [key, stack] of this.stacks) {
            const index = stack.findIndex((i) => i.itemUid === itemUid);
            if (index >= 0) {
                const [item] = stack.splice(index, 1);
                if (stack.length === 0) {
                    this.stacks.delete(key);
                }
                const [worldX, worldY] = key.split(',').map(Number);
                return { item, worldX, worldY };
            }
        }
        return undefined;
    }

    /**
     * Gets the stack of items at the specified world cell.
     * Returns from bottom to top (first element = bottom, last = top).
     *
     * @param worldX - World X coordinate
     * @param worldY - World Y coordinate
     * @returns Array of items at that cell (empty if none)
     */
    public getStack(worldX: number, worldY: number): GroundLootItem[] {
        const key = this.cellKey(worldX, worldY);
        return this.stacks.get(key) ?? [];
    }

    /**
     * Gets the top (visible) item at the specified world cell.
     *
     * @param worldX - World X coordinate
     * @param worldY - World Y coordinate
     * @returns The top item or undefined
     */
    public getTopItem(worldX: number, worldY: number): GroundLootItem | undefined {
        const stack = this.getStack(worldX, worldY);
        return stack.length > 0 ? stack[stack.length - 1] : undefined;
    }

    /**
     * Returns all cells that have dropped items.
     * Each entry is { worldX, worldY, stack }.
     */
    public getAllStacks(): Array<{ worldX: number; worldY: number; stack: GroundLootItem[] }> {
        const result: Array<{ worldX: number; worldY: number; stack: GroundLootItem[] }> = [];
        for (const [key, stack] of this.stacks) {
            const [worldX, worldY] = key.split(',').map(Number);
            result.push({ worldX, worldY, stack });
        }
        return result;
    }

    /**
     * Clears all dropped items. Called when the map is changed/reloaded.
     */
    public clear(): void {
        this.stacks.clear();
    }

    private cellKey(worldX: number, worldY: number): string {
        return `${worldX},${worldY}`;
    }
}
