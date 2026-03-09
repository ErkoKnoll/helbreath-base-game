import type { Game } from 'phaser';
import { EventBus } from '../game/EventBus';
import { ItemTypes, type Item, type InventoryItem, type EquipmentSlot, type Effect, getItemById, getItemSheetIndex, getItemSpriteIndex, getTintInventoryEffectColorFromInventoryItem, getTintInventoryEffectColorWithOverrides, RING_SLOT_LEFT, RING_SLOT_RIGHT } from '../constants/Items';
import {
    EQUIP_ITEM,
    ITEM_MOVED_TO_BAG,
    ITEM_ADDED_TO_BAG,
    ITEM_BAG_POSITION_UPDATED,
    ITEM_EQUIP_REQUESTED,
    ITEM_REMOVED_FROM_BAG,
    ITEM_CREATE_REQUESTED,
    ITEM_BAG_ITEM_BROUGHT_TO_FRONT,
    ITEM_QUANTITY_UPDATED,
    ITEM_CONSUMED_REQUESTED,
    IN_UI_CHANGE_GENDER,
    ITEM_DROP_TO_GROUND_REQUESTED,
    ITEM_DROPPED_TO_GROUND,
    ITEM_ADD_FROM_GROUND,
} from '../constants/EventNames';
import {
    ITEM_ADDED_SOUND,
    ITEM_DROPPED_SOUND,
    ITEM_EQUIP_SOUND,
    ITEM_MOVED_TO_BAG_SOUND,
} from '../constants/SoundFileNames';
import { getGameStateManager, getLootManager, getSoundManager } from './RegistryUtils';
import { emitTintedInventorySpriteIfNeeded } from './SpriteUtils';
import { Gender } from '../Types';

/**
 * Manages player inventory state: equipped items and items in bag.
 */
export class InventoryManager {
    /** Equipped items by equipment slot (weapon, shield, ring-left, ring-right, etc.). */
    equippedItems: Partial<Record<EquipmentSlot, InventoryItem>> = {};

    /** Gets the item definition for the equipped weapon, or undefined if no weapon equipped. */
    public getEquippedWeaponDef(): Item | undefined {
        const equipped = this.equippedItems[ItemTypes.WEAPON];
        return equipped ? getItemById(equipped.itemId) : undefined;
    }

    /** Items currently stored in the bag */
    baggedItems: InventoryItem[] = [];

    /** Next itemUid for newly created items */
    private nextItemUid = 0;

    private playSound(key: string): void {
        const soundManager = getSoundManager(this.game);
        if (soundManager) {
            try {
                const fileName = key.endsWith('.mp3') ? key : `${key}.mp3`;
                soundManager.playOnce(fileName);
            } catch {
                // Silently ignore if sound fails
            }
        }
    }

    private ensureTintedInventorySpritesEmitted(itemDef: Item, effectOverrides?: Effect[]): void {
        const effectColor = getTintInventoryEffectColorWithOverrides(itemDef, effectOverrides);
        if (effectColor === undefined) return;

        const maleSheet = getItemSheetIndex(itemDef, Gender.MALE);
        const maleSprite = getItemSpriteIndex(itemDef, Gender.MALE);
        const femaleSheet = getItemSheetIndex(itemDef, Gender.FEMALE);
        const femaleSprite = getItemSpriteIndex(itemDef, Gender.FEMALE);

        if (maleSheet !== undefined && maleSprite !== undefined) {
            emitTintedInventorySpriteIfNeeded(this.game, maleSheet, maleSprite, effectColor);
        }
        if (femaleSheet !== undefined && femaleSprite !== undefined && (femaleSheet !== maleSheet || femaleSprite !== maleSprite)) {
            emitTintedInventorySpriteIfNeeded(this.game, femaleSheet, femaleSprite, effectColor);
        }
    }

    /** Ensures tinted sprites are emitted for all inventory items with TINT_INVENTORY. Called on init when loading persisted state. */
    private ensureTintedSpritesForAllInventoryItems(): void {
        const emitForItem = (item: InventoryItem) => {
            const itemDef = getItemById(item.itemId);
            if (itemDef) this.ensureTintedInventorySpritesEmitted(itemDef, item.effectOverrides);
        };
        for (const item of Object.values(this.equippedItems)) {
            if (item) emitForItem(item);
        }
        for (const item of this.baggedItems) {
            emitForItem(item);
        }
    }

    private persistInventory(): void {
        const gameStateManager = getGameStateManager(this.game);
        gameStateManager.setInventoryState(
            this.equippedItems,
            this.baggedItems,
            this.nextItemUid,
        );
        gameStateManager.saveGameState();
    }

    constructor(private readonly game: Game) {
        // Initialize from GameStateManager (persisted state or initial defaults)
        const gameStateManager = getGameStateManager(this.game);
        const { equippedItems, baggedItems, nextItemUid } = gameStateManager.getInventoryState();
        this.equippedItems = equippedItems;
        this.baggedItems = baggedItems;
        this.nextItemUid = nextItemUid;

        // Emit tinted inventory sprites for items with TINT_INVENTORY (needed on login when loading persisted state)
        this.ensureTintedSpritesForAllInventoryItems();

        // Emit EQUIP_ITEM for each equipped item so UI store syncs
        for (const [slot, item] of Object.entries(this.equippedItems)) {
            if (item !== undefined) {
                EventBus.emit(EQUIP_ITEM, {
                    itemType: slot as ItemTypes,
                    itemId: item.itemId,
                    itemUid: item.itemUid,
                    bagX: item.bagX,
                    bagY: item.bagY,
                    effectOverrides: item.effectOverrides,
                });
            }
        }
        // Emit ITEM_ADDED_TO_BAG for each bagged item so UI store syncs
        for (const item of this.baggedItems) {
            EventBus.emit(ITEM_ADDED_TO_BAG, { item });
        }

        EventBus.on(
            ITEM_MOVED_TO_BAG,
            (payload: { itemUid: number; itemType: EquipmentSlot | ItemTypes; bagX?: number; bagY?: number }) => {
                const slot = payload.itemType as EquipmentSlot;
                const equipped = this.equippedItems[slot];
                if (equipped?.itemUid === payload.itemUid) {
                    const movedItem: InventoryItem = {
                        ...equipped,
                        bagX: payload.bagX ?? equipped.bagX,
                        bagY: payload.bagY ?? equipped.bagY,
                    };
                    this.baggedItems.push(movedItem);
                    this.equippedItems[slot] = undefined;
                    this.playSound(ITEM_MOVED_TO_BAG_SOUND);
                    EventBus.emit(EQUIP_ITEM, {
                        itemType: slot,
                        itemId: undefined,
                        itemUid: payload.itemUid,
                    });
                    EventBus.emit(ITEM_ADDED_TO_BAG, { item: movedItem });
                    this.persistInventory();
                } else {
                    const index = this.baggedItems.findIndex(
                        (b) => b.itemUid === payload.itemUid,
                    );
                    if (index >= 0 && payload.bagX !== undefined && payload.bagY !== undefined) {
                        this.baggedItems[index] = {
                            ...this.baggedItems[index],
                            bagX: payload.bagX,
                            bagY: payload.bagY,
                        };
                        EventBus.emit(ITEM_BAG_POSITION_UPDATED, {
                            itemUid: payload.itemUid,
                            bagX: payload.bagX,
                            bagY: payload.bagY,
                        });
                        this.persistInventory();
                    }
                }
            },
        );

        EventBus.on(ITEM_EQUIP_REQUESTED, (payload: { item: InventoryItem; itemType: ItemTypes; targetSlot?: EquipmentSlot }) => {
            const itemType = payload.itemType;
            const index = this.baggedItems.findIndex(
                (b) => b.itemUid === payload.item.itemUid,
            );
            if (index < 0) return;

            const itemDef = getItemById(payload.item.itemId);
            if (itemType === ItemTypes.MISC) return; // MISC is not equippable
            if (itemDef?.gender !== undefined) {
                const playerGender = getGameStateManager(this.game).getGender();
                if (itemDef.gender !== playerGender) {
                    return;
                }
            }

            // For rings: resolve target slot. On double-click (no targetSlot): try left, then right, else replace left.
            const targetSlot: EquipmentSlot = itemType === ItemTypes.RING
                ? (payload.targetSlot ?? (() => {
                    const leftOccupied = this.equippedItems[RING_SLOT_LEFT] !== undefined;
                    const rightOccupied = this.equippedItems[RING_SLOT_RIGHT] !== undefined;
                    if (!leftOccupied) return RING_SLOT_LEFT;
                    if (!rightOccupied) return RING_SLOT_RIGHT;
                    return RING_SLOT_LEFT; // both occupied: replace left
                })())
                : itemType;

            const blockedSlots = itemDef?.blockedItemSlots ?? [];

            const unequipToBag = (slot: EquipmentSlot) => {
                const equipped = this.equippedItems[slot];
                if (equipped === undefined) return;
                this.equippedItems[slot] = undefined;
                this.baggedItems.push(equipped);
                this.playSound(ITEM_MOVED_TO_BAG_SOUND);
                EventBus.emit(ITEM_ADDED_TO_BAG, { item: equipped });
                EventBus.emit(EQUIP_ITEM, {
                    itemType: slot,
                    itemId: undefined,
                    itemUid: equipped.itemUid,
                });
            };

            for (const [slot, equipped] of Object.entries(this.equippedItems)) {
                if (equipped === undefined) continue;
                const equippedDef = getItemById(equipped.itemId);
                if (equippedDef?.blockedItemSlots?.includes(itemType)) {
                    unequipToBag(slot as EquipmentSlot);
                }
            }

            for (const slot of blockedSlots) {
                unequipToBag(slot as EquipmentSlot);
            }

            const [newItem] = this.baggedItems.splice(index, 1);

            const previouslyEquipped = this.equippedItems[targetSlot];
            if (previouslyEquipped !== undefined) {
                const unequippedItem: InventoryItem = { ...previouslyEquipped };
                this.baggedItems.push(unequippedItem);
                this.playSound(ITEM_MOVED_TO_BAG_SOUND);
                EventBus.emit(ITEM_ADDED_TO_BAG, { item: unequippedItem });
            }

            this.equippedItems[targetSlot] = newItem;
            this.playSound(ITEM_EQUIP_SOUND);
            EventBus.emit(ITEM_REMOVED_FROM_BAG, { itemUid: newItem.itemUid });
            EventBus.emit(EQUIP_ITEM, {
                itemType: targetSlot,
                itemId: newItem.itemId,
                itemUid: newItem.itemUid,
                bagX: newItem.bagX,
                bagY: newItem.bagY,
                effectOverrides: newItem.effectOverrides,
            });
            this.persistInventory();
        });

        EventBus.on(ITEM_CREATE_REQUESTED, (payload: { itemId: number; effectOverrides?: Effect[] }) => {
            const itemDef = getItemById(payload.itemId);
            const quantity = 1;

            if (itemDef?.stackable) {
                const existing = this.baggedItems.find((b) => b.itemId === payload.itemId);
                if (existing) {
                    const newQuantity = (existing.quantity ?? 1) + quantity;
                    existing.quantity = newQuantity;
                    this.playSound(ITEM_ADDED_SOUND);
                    EventBus.emit(ITEM_QUANTITY_UPDATED, {
                        itemUid: existing.itemUid,
                        quantity: newQuantity,
                    });
                    this.persistInventory();
                    return;
                }
            }

            const newItem: InventoryItem = {
                itemId: payload.itemId,
                itemUid: this.nextItemUid++,
                bagX: undefined,
                bagY: undefined,
                quantity,
                ...(payload.effectOverrides?.length && { effectOverrides: payload.effectOverrides }),
            };
            if (itemDef) this.ensureTintedInventorySpritesEmitted(itemDef, payload.effectOverrides);
            this.baggedItems.push(newItem);
            this.playSound(ITEM_ADDED_SOUND);
            EventBus.emit(ITEM_ADDED_TO_BAG, { item: newItem });
            this.persistInventory();
        });

        EventBus.on(ITEM_BAG_ITEM_BROUGHT_TO_FRONT, (payload: { itemUid: number }) => {
            const index = this.baggedItems.findIndex((b) => b.itemUid === payload.itemUid);
            if (index >= 0) {
                const [item] = this.baggedItems.splice(index, 1);
                this.baggedItems.push(item);
                this.persistInventory();
            }
        });

        EventBus.on(ITEM_CONSUMED_REQUESTED, (payload: { item: InventoryItem }) => {
            const index = this.baggedItems.findIndex((b) => b.itemUid === payload.item.itemUid);
            if (index < 0) return;

            const itemDef = getItemById(payload.item.itemId);
            if (!itemDef || itemDef.itemType !== ItemTypes.MISC || !itemDef.consumable) return;

            if (itemDef.consumptionSound) {
                this.playSound(itemDef.consumptionSound);
            }

            const bagItem = this.baggedItems[index];
            if (itemDef.stackable && (bagItem.quantity ?? 1) > 1) {
                const newQuantity = (bagItem.quantity ?? 1) - 1;
                bagItem.quantity = newQuantity;
                EventBus.emit(ITEM_QUANTITY_UPDATED, {
                    itemUid: bagItem.itemUid,
                    quantity: newQuantity,
                });
            } else {
                this.baggedItems.splice(index, 1);
                EventBus.emit(ITEM_REMOVED_FROM_BAG, { itemUid: payload.item.itemUid });
            }
            this.persistInventory();
        });

        EventBus.on(ITEM_DROP_TO_GROUND_REQUESTED, (payload: { itemUid: number }) => {
            const index = this.baggedItems.findIndex((b) => b.itemUid === payload.itemUid);
            if (index < 0) return;

            const gameStateManager = getGameStateManager(this.game);
            const worldX = gameStateManager.getWorldPosX();
            const worldY = gameStateManager.getWorldPosY();

            const [droppedItem] = this.baggedItems.splice(index, 1);
            const quantity = droppedItem.quantity ?? 1;
            const tint = getTintInventoryEffectColorFromInventoryItem(droppedItem);

            const lootManager = getLootManager(this.game);
            lootManager.addItem(worldX, worldY, {
                itemId: droppedItem.itemId,
                itemUid: droppedItem.itemUid,
                quantity,
                ...(tint !== undefined && { tint }),
                ...(droppedItem.effectOverrides?.length && { effectOverrides: droppedItem.effectOverrides }),
            });

            this.playSound(ITEM_DROPPED_SOUND);
            EventBus.emit(ITEM_REMOVED_FROM_BAG, { itemUid: payload.itemUid });
            EventBus.emit(ITEM_DROPPED_TO_GROUND, {
                worldX,
                worldY,
                itemId: droppedItem.itemId,
                itemUid: droppedItem.itemUid,
                quantity,
                ...(tint !== undefined && { tint }),
                ...(droppedItem.effectOverrides?.length && { effectOverrides: droppedItem.effectOverrides }),
            });
            this.persistInventory();
        });

        EventBus.on(ITEM_ADD_FROM_GROUND, (payload: { itemId: number; itemUid: number; quantity: number; effectOverrides?: Effect[] }) => {
            const itemDef = getItemById(payload.itemId);
            const quantity = payload.quantity;

            if (itemDef?.stackable) {
                const existing = this.baggedItems.find((b) => b.itemId === payload.itemId);
                if (existing) {
                    const newQuantity = (existing.quantity ?? 1) + quantity;
                    existing.quantity = newQuantity;
                    this.playSound(ITEM_ADDED_SOUND);
                    EventBus.emit(ITEM_QUANTITY_UPDATED, {
                        itemUid: existing.itemUid,
                        quantity: newQuantity,
                    });
                    this.persistInventory();
                    return;
                }
            }

            const newItem: InventoryItem = {
                itemId: payload.itemId,
                itemUid: payload.itemUid,
                bagX: undefined,
                bagY: undefined,
                quantity,
                ...(payload.effectOverrides?.length && { effectOverrides: payload.effectOverrides }),
            };
            if (itemDef) this.ensureTintedInventorySpritesEmitted(itemDef, payload.effectOverrides);
            this.baggedItems.push(newItem);
            this.playSound(ITEM_ADDED_SOUND);
            EventBus.emit(ITEM_ADDED_TO_BAG, { item: newItem });
            this.persistInventory();
        });

        EventBus.on(IN_UI_CHANGE_GENDER, (newGender: Gender) => {
            const unequipToBag = (slot: EquipmentSlot) => {
                const equipped = this.equippedItems[slot];
                if (equipped === undefined) return;
                this.equippedItems[slot] = undefined;
                this.baggedItems.push(equipped);
                this.playSound(ITEM_MOVED_TO_BAG_SOUND);
                EventBus.emit(ITEM_ADDED_TO_BAG, { item: equipped });
                EventBus.emit(EQUIP_ITEM, {
                    itemType: slot,
                    itemId: undefined,
                    itemUid: equipped.itemUid,
                });
            };

            for (const [slot, equipped] of Object.entries(this.equippedItems)) {
                if (equipped === undefined) continue;
                const itemDef = getItemById(equipped.itemId);
                if (itemDef?.gender !== undefined && itemDef.gender !== newGender) {
                    unequipToBag(slot as EquipmentSlot);
                }
            }
            this.persistInventory();
        });
    }
}
