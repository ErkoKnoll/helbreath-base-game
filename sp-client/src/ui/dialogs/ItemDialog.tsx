import { useStore } from '@tanstack/react-store';
import Sketch from '@uiw/react-color-sketch';
import { DraggableDialog } from './DraggableDialog';
import { RpgButton } from '../components/RpgButton';
import { RpgCheckbox } from '../components/RpgCheckbox';
import { itemDialogStore, setSelectedItemId, setItemDialogOpen, setAppearanceGlowEnabled, setAppearanceGlowColor, setAppearanceGlareEnabled, setAppearanceGlareColor, setAppearanceTintEnabled, setAppearanceTintColor, setInventoryTintEnabled, setInventoryTintColor } from '../store/ItemDialog.store';
import { setInventoryDialogOpen } from '../store/InventoryDialog.store';
import { ITEMS, ItemTypes, ItemEffect, type Effect } from '../../constants/Items';
import { EventBus } from '../../game/EventBus';
import { ITEM_CREATE_REQUESTED } from '../../constants/EventNames';

/** Format ItemTypes enum value for display (e.g. "accessory" → "Accessory"). */
function formatCategoryLabel(type: ItemTypes): string {
    return type.charAt(0).toUpperCase() + type.slice(1);
}

/** Group items by ItemTypes category, sorted alphabetically (categories first, then items). */
function getItemsByCategory(): { category: ItemTypes; items: typeof ITEMS }[] {
    const byCategory = ITEMS.reduce((acc, item) => {
        const cat = item.itemType;
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(item);
        return acc;
    }, {} as Record<ItemTypes, typeof ITEMS>);

    const sortedCategories = (Object.keys(byCategory) as ItemTypes[]).sort((a, b) =>
        formatCategoryLabel(a).localeCompare(formatCategoryLabel(b))
    );

    return sortedCategories.map((category) => ({
        category,
        items: [...byCategory[category]].sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

interface ItemDialogProps {
    position: { x: number; y: number };
    onClose: () => void;
    zIndex?: number;
    onBringToFront?: () => void;
}

/** Converts numeric hex (e.g. 0x000000) to Sketch color prop string. */
function hexNumberToSketchColor(value: number): string {
    return '#' + value.toString(16).padStart(6, '0');
}

export function ItemDialog({
    position,
    onClose,
    zIndex,
    onBringToFront,
}: ItemDialogProps) {
    const selectedItemId = useStore(itemDialogStore, (state) => state.selectedItemId);
    const appearanceGlowEnabled = useStore(itemDialogStore, (state) => state.appearanceGlowEnabled);
    const appearanceGlowColor = useStore(itemDialogStore, (state) => state.appearanceGlowColor);
    const appearanceGlareEnabled = useStore(itemDialogStore, (state) => state.appearanceGlareEnabled);
    const appearanceGlareColor = useStore(itemDialogStore, (state) => state.appearanceGlareColor);
    const appearanceTintEnabled = useStore(itemDialogStore, (state) => state.appearanceTintEnabled);
    const appearanceTintColor = useStore(itemDialogStore, (state) => state.appearanceTintColor);
    const inventoryTintEnabled = useStore(itemDialogStore, (state) => state.inventoryTintEnabled);
    const inventoryTintColor = useStore(itemDialogStore, (state) => state.inventoryTintColor);

    const handleCreateItem = () => {
        const effectOverrides: Effect[] = [];
        if (appearanceGlowEnabled) effectOverrides.push({ effect: ItemEffect.GLOW, effectColor: appearanceGlowColor });
        if (appearanceGlareEnabled) effectOverrides.push({ effect: ItemEffect.GLARE, effectColor: appearanceGlareColor });
        if (appearanceTintEnabled) effectOverrides.push({ effect: ItemEffect.TINT_APPEARANCE, effectColor: appearanceTintColor });
        if (inventoryTintEnabled) effectOverrides.push({ effect: ItemEffect.TINT_INVENTORY, effectColor: inventoryTintColor });
        EventBus.emit(ITEM_CREATE_REQUESTED, { itemId: selectedItemId, effectOverrides: effectOverrides.length ? effectOverrides : undefined });
        setItemDialogOpen(false);
        setInventoryDialogOpen(true);
    };

    return (
        <DraggableDialog
            title="Items"
            position={position}
            id="item-dialog"
            zIndex={zIndex}
            onBringToFront={onBringToFront}
            onContextMenu={(e) => {
                e.preventDefault();
                onClose();
            }}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '8px' }}>
                <div>
                    <label htmlFor="item-select" className="rpg-label" style={{ marginBottom: '4px', display: 'block' }}>
                        Item
                    </label>
                    <select
                        id="item-select"
                        className="rpg-select"
                        value={selectedItemId}
                        onChange={(e) => setSelectedItemId(Number(e.target.value))}
                    >
                        {getItemsByCategory().map(({ category, items }) => (
                            <optgroup key={category} label={formatCategoryLabel(category)}>
                                {items.map((item) => (
                                    <option key={item.id} value={item.id}>
                                        {item.name}
                                    </option>
                                ))}
                            </optgroup>
                        ))}
                    </select>
                </div>

                <div>
                    <div className="rpg-section-title" style={{ marginBottom: '6px' }}>Effects</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <RpgCheckbox
                            id="appearance-glow"
                            label="Appearance Glow (unofficial)"
                            checked={appearanceGlowEnabled}
                            onCheckedChange={(c) => setAppearanceGlowEnabled(c === true)}
                        />
                        {appearanceGlowEnabled && (
                            <div style={{ marginTop: '4px' }}>
                                <Sketch
                                    color={hexNumberToSketchColor(appearanceGlowColor)}
                                    onChange={(color) => {
                                        const hex = color.hex ?? hexNumberToSketchColor(appearanceGlowColor);
                                        setAppearanceGlowColor(parseInt(hex.replace(/^#/, ''), 16));
                                    }}
                                    disableAlpha
                                />
                            </div>
                        )}
                        <RpgCheckbox
                            id="appearance-glare"
                            label="Appearance Glare"
                            checked={appearanceGlareEnabled}
                            onCheckedChange={(c) => setAppearanceGlareEnabled(c === true)}
                        />
                        {appearanceGlareEnabled && (
                            <div style={{ marginTop: '4px' }}>
                                <Sketch
                                    color={hexNumberToSketchColor(appearanceGlareColor)}
                                    onChange={(color) => {
                                        const hex = color.hex ?? hexNumberToSketchColor(appearanceGlareColor);
                                        setAppearanceGlareColor(parseInt(hex.replace(/^#/, ''), 16));
                                    }}
                                    disableAlpha
                                />
                            </div>
                        )}
                        <RpgCheckbox
                            id="appearance-tint"
                            label="Appearance Tint"
                            checked={appearanceTintEnabled}
                            onCheckedChange={(c) => setAppearanceTintEnabled(c === true)}
                        />
                        {appearanceTintEnabled && (
                            <div style={{ marginTop: '4px' }}>
                                <Sketch
                                    color={hexNumberToSketchColor(appearanceTintColor)}
                                    onChange={(color) => {
                                        const hex = color.hex ?? hexNumberToSketchColor(appearanceTintColor);
                                        setAppearanceTintColor(parseInt(hex.replace(/^#/, ''), 16));
                                    }}
                                    disableAlpha
                                />
                            </div>
                        )}
                        <RpgCheckbox
                            id="inventory-tint"
                            label="Inventory Tint"
                            checked={inventoryTintEnabled}
                            onCheckedChange={(c) => setInventoryTintEnabled(c === true)}
                        />
                        {inventoryTintEnabled && (
                            <div style={{ marginTop: '4px' }}>
                                <Sketch
                                    color={hexNumberToSketchColor(inventoryTintColor)}
                                    onChange={(color) => {
                                        const hex = color.hex ?? hexNumberToSketchColor(inventoryTintColor);
                                        setInventoryTintColor(parseInt(hex.replace(/^#/, ''), 16));
                                    }}
                                    disableAlpha
                                />
                            </div>
                        )}
                    </div>
                </div>

                <RpgButton onClick={handleCreateItem}>
                    Create item
                </RpgButton>
            </div>
        </DraggableDialog>
    );
}
