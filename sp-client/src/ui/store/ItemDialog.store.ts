import { Store } from '@tanstack/react-store';
import { ITEMS } from '../../constants/Items';

/** Default black for Appearance Glow (hex 0x000000). */
export const DEFAULT_APPEARANCE_GLOW_COLOR = 0x000000;

/** Default blue for Appearance Glare (hex 0x0000ff). */
export const DEFAULT_APPEARANCE_GLARE_COLOR = 0x0000ff;

/** Default white for Appearance Tint (hex 0xffffff). */
export const DEFAULT_APPEARANCE_TINT_COLOR = 0xffffff;

/** Default black for Inventory Tint (hex 0x000000). */
export const DEFAULT_INVENTORY_TINT_COLOR = 0x000000;

interface ItemDialogState {
    isOpen: boolean;
    selectedItemId: number;
    /** Whether Appearance Glow effect is enabled for newly created items. */
    appearanceGlowEnabled: boolean;
    /** Glow color (hex) when Appearance Glow is enabled. Default black. */
    appearanceGlowColor: number;
    /** Whether Appearance Glare effect is enabled for newly created items. */
    appearanceGlareEnabled: boolean;
    /** Glare color (hex) when Appearance Glare is enabled. Default blue. */
    appearanceGlareColor: number;
    /** Whether Appearance Tint effect is enabled for newly created items. */
    appearanceTintEnabled: boolean;
    /** Tint color (hex) when Appearance Tint is enabled. Default white. */
    appearanceTintColor: number;
    /** Whether Inventory Tint effect is enabled for newly created items. */
    inventoryTintEnabled: boolean;
    /** Tint color (hex) when Inventory Tint is enabled. Default black. */
    inventoryTintColor: number;
}

const initialState: ItemDialogState = {
    isOpen: false,
    selectedItemId: ITEMS[0]?.id ?? 1,
    appearanceGlowEnabled: false,
    appearanceGlowColor: DEFAULT_APPEARANCE_GLOW_COLOR,
    appearanceGlareEnabled: false,
    appearanceGlareColor: DEFAULT_APPEARANCE_GLARE_COLOR,
    appearanceTintEnabled: false,
    appearanceTintColor: DEFAULT_APPEARANCE_TINT_COLOR,
    inventoryTintEnabled: false,
    inventoryTintColor: DEFAULT_INVENTORY_TINT_COLOR,
};

export const itemDialogStore = new Store<ItemDialogState>(initialState);

export const toggleItemDialog = () => {
    itemDialogStore.setState((state) => ({ ...state, isOpen: !state.isOpen }));
};

export const setItemDialogOpen = (value: boolean) => {
    itemDialogStore.setState((state) => ({ ...state, isOpen: value }));
};

export const setSelectedItemId = (itemId: number) => {
    itemDialogStore.setState((state) => ({ ...state, selectedItemId: itemId }));
};

export const setAppearanceGlowEnabled = (enabled: boolean) => {
    itemDialogStore.setState((state) => ({ ...state, appearanceGlowEnabled: enabled }));
};

export const setAppearanceGlowColor = (color: number) => {
    itemDialogStore.setState((state) => ({ ...state, appearanceGlowColor: color }));
};

export const setAppearanceGlareEnabled = (enabled: boolean) => {
    itemDialogStore.setState((state) => ({ ...state, appearanceGlareEnabled: enabled }));
};

export const setAppearanceGlareColor = (color: number) => {
    itemDialogStore.setState((state) => ({ ...state, appearanceGlareColor: color }));
};

export const setAppearanceTintEnabled = (enabled: boolean) => {
    itemDialogStore.setState((state) => ({ ...state, appearanceTintEnabled: enabled }));
};

export const setAppearanceTintColor = (color: number) => {
    itemDialogStore.setState((state) => ({ ...state, appearanceTintColor: color }));
};

export const setInventoryTintEnabled = (enabled: boolean) => {
    itemDialogStore.setState((state) => ({ ...state, inventoryTintEnabled: enabled }));
};

export const setInventoryTintColor = (color: number) => {
    itemDialogStore.setState((state) => ({ ...state, inventoryTintColor: color }));
};
