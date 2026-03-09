import { Store } from '@tanstack/react-store';
import { EventBus } from '../../game/EventBus';
import {
    EQUIP_ITEM,
    ITEM_ADDED_TO_BAG,
    ITEM_BAG_POSITION_UPDATED,
    ITEM_BAG_ITEM_BROUGHT_TO_FRONT,
    ITEM_REMOVED_FROM_BAG,
    ITEM_QUANTITY_UPDATED,
    OUT_UI_GAME_STATS_UPDATE,
} from '../../constants/EventNames';
import { ItemTypes, type Effect, type InventoryItem, type EquipmentSlot } from '../../constants/Items';
import type { Gender } from '../../Types';

interface InventoryDialogState {
    isOpen: boolean;
    equippedItems: Partial<Record<EquipmentSlot, InventoryItem>>;
    baggedItems: InventoryItem[];
    playerGender: Gender | undefined;
}

const initialState: InventoryDialogState = {
    isOpen: false,
    equippedItems: {},
    baggedItems: [],
    playerGender: undefined,
};

export const inventoryDialogStore = new Store<InventoryDialogState>(initialState);

export const toggleInventoryDialog = () => {
    inventoryDialogStore.setState((state) => ({ ...state, isOpen: !state.isOpen }));
};

export const setInventoryDialogOpen = (value: boolean) => {
    inventoryDialogStore.setState((state) => ({ ...state, isOpen: value }));
};

export const setEquippedItem = (slot: EquipmentSlot, equipped: InventoryItem | undefined) => {
    inventoryDialogStore.setState((state) => ({
        ...state,
        equippedItems: {
            ...state.equippedItems,
            [slot]: equipped,
        },
    }));
};

export const addItemToBag = (item: InventoryItem) => {
    inventoryDialogStore.setState((state) => ({
        ...state,
        baggedItems: [...state.baggedItems, item],
    }));
};

export const removeItemFromBag = (itemUid: number) => {
    inventoryDialogStore.setState((state) => ({
        ...state,
        baggedItems: state.baggedItems.filter((b) => b.itemUid !== itemUid),
    }));
};

// Listen to equip item events from InventoryManager
EventBus.on(
    EQUIP_ITEM,
    (payload: {
        itemType: ItemTypes;
        itemId?: number;
        itemUid: number;
        bagX?: number;
        bagY?: number;
        effectOverrides?: Effect[];
        quantity?: number;
    }) => {
        const item = payload.itemId !== undefined
            ? {
                itemId: payload.itemId,
                itemUid: payload.itemUid,
                bagX: payload.bagX,
                bagY: payload.bagY,
                ...(payload.effectOverrides?.length && { effectOverrides: payload.effectOverrides }),
                ...(payload.quantity !== undefined && { quantity: payload.quantity }),
            }
            : undefined;
        setEquippedItem(payload.itemType as EquipmentSlot, item);
    },
);

// Listen to item added to bag from InventoryManager
EventBus.on(ITEM_ADDED_TO_BAG, (payload: { item: InventoryItem }) => {
    addItemToBag(payload.item);
});

// Listen to item removed from bag (e.g. equipped)
EventBus.on(ITEM_REMOVED_FROM_BAG, (payload: { itemUid: number }) => {
    removeItemFromBag(payload.itemUid);
});

// Listen to bag item position update (reorder within bag)
EventBus.on(
    ITEM_BAG_POSITION_UPDATED,
    (payload: { itemUid: number; bagX: number; bagY: number }) => {
        inventoryDialogStore.setState((state) => ({
            ...state,
            baggedItems: state.baggedItems.map((b) =>
                b.itemUid === payload.itemUid
                    ? { ...b, bagX: payload.bagX, bagY: payload.bagY }
                    : b,
            ),
        }));
    },
);

// Listen to stackable item quantity update
EventBus.on(ITEM_QUANTITY_UPDATED, (payload: { itemUid: number; quantity: number }) => {
    inventoryDialogStore.setState((state) => ({
        ...state,
        baggedItems: state.baggedItems.map((b) =>
            b.itemUid === payload.itemUid ? { ...b, quantity: payload.quantity } : b,
        ),
    }));
});

// Listen to game stats to receive player gender for inventory sprite selection
EventBus.on(OUT_UI_GAME_STATS_UPDATE, (stats: { playerGender?: Gender }) => {
    if (stats.playerGender !== undefined) {
        inventoryDialogStore.setState((state) => ({ ...state, playerGender: stats.playerGender }));
    }
});

// Listen to bring bag item to front (z-order when grabbed or added)
EventBus.on(ITEM_BAG_ITEM_BROUGHT_TO_FRONT, (payload: { itemUid: number }) => {
    inventoryDialogStore.setState((state) => {
        const index = state.baggedItems.findIndex((b) => b.itemUid === payload.itemUid);
        if (index < 0) return state;
        const item = state.baggedItems[index];
        const rest = state.baggedItems.filter((_, i) => i !== index);
        return { ...state, baggedItems: [...rest, item] };
    });
});
