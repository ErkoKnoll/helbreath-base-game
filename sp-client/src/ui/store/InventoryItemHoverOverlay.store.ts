import { Store } from '@tanstack/react-store';
import { EventBus } from '../../game/EventBus';
import { OUT_UI_HOVER_GROUND_ITEM_INFO } from '../../constants/EventNames';
import { ItemTypes } from '../../constants/Items';
import { Gender } from '../../Types';

export interface InventoryItemHoverInfo {
    itemName: string;
    itemType: ItemTypes;
    itemId: number;
    itemUid: number;
    /** When 'ground', overlay uses 90% opacity (e.g. for GroundItem). */
    source?: 'ground' | 'inventory';
    /** When set, item is gender-specific (e.g. female-only Chemise). */
    gender?: Gender;
    /** When set and item is stackable, displayed as Quantity. */
    quantity?: number;
    /** When true, Quantity row is shown. */
    stackable?: boolean;
    /** When true, item is consumable (double-click to use). */
    consumable?: boolean;
    /** Hex color for GLOW effect (base or overridden). Shown as "Appearance glow" when set. */
    appearanceGlowColor?: number;
    /** Hex color for GLARE effect (base or overridden). Shown as "Appearance glare" when set. */
    appearanceGlareColor?: number;
    /** Hex color for TINT_APPEARANCE effect (base or overridden). Shown as "Appearance tint" when set. */
    appearanceTintColor?: number;
    /** Hex color for TINT_INVENTORY effect (base or overridden). Shown as "Inventory tint" when set. */
    inventoryTintColor?: number;
    mouseX: number;
    mouseY: number;
}

interface InventoryItemHoverOverlayState {
    hoverInfo: InventoryItemHoverInfo | undefined;
    /** When true, overlay does not render (e.g. when inventory context menu is open). */
    suppressOverlay: boolean;
}

const initialState: InventoryItemHoverOverlayState = {
    hoverInfo: undefined,
    suppressOverlay: false,
};

export const inventoryItemHoverOverlayStore = new Store<InventoryItemHoverOverlayState>(initialState);

export const setInventoryItemHoverInfo = (hoverInfo: InventoryItemHoverInfo | undefined) => {
    inventoryItemHoverOverlayStore.setState((state) => ({ ...state, hoverInfo }));
};

export const setInventoryItemHoverOverlaySuppressed = (suppressed: boolean) => {
    inventoryItemHoverOverlayStore.setState((state) => ({ ...state, suppressOverlay: suppressed }));
};

EventBus.on(OUT_UI_HOVER_GROUND_ITEM_INFO, (hoverInfo: InventoryItemHoverInfo | undefined) => {
    setInventoryItemHoverInfo(hoverInfo);
});
