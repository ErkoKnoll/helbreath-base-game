import { useStore } from '@tanstack/react-store';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DraggableDialog } from './DraggableDialog';
import { inventoryDialogStore } from '../store/InventoryDialog.store';
import { appStore } from '../store/App.store';
import { mapDialogStore } from '../store/MapDialog.store';
import { ITEMS, ItemTypes, EQUIPMENT_SLOT_TO_SLOT_ID, getItemInventorySpriteKeyWithOverrides, getGlowEffectColor, getGlareEffectColor, getTintAppearanceEffectColor, getTintInventoryEffectColorWithOverrides, RING_SLOT_LEFT, RING_SLOT_RIGHT, type Effect, type EquipmentSlot } from '../../constants/Items';
import { EventBus } from '../../game/EventBus';
import {
    ITEM_MOVED_TO_BAG,
    ITEM_EQUIP_REQUESTED,
    ITEM_BAG_ITEM_BROUGHT_TO_FRONT,
    ITEM_CONSUMED_REQUESTED,
    ITEM_DROP_TO_GROUND_REQUESTED,
} from '../../constants/EventNames';
import { setInventoryItemHoverInfo, setInventoryItemHoverOverlaySuppressed } from '../store/InventoryItemHoverOverlay.store';
import { Gender } from '../../Types';

interface InventoryDialogProps {
    position: { x: number; y: number };
    onClose: () => void;
    zIndex?: number;
    onBringToFront?: () => void;
}

const DRAG_GHOST_SIZE = 48;
const BAG_ITEM_SIZE = 48;
const BAG_PADDING = 8;
/** Minimum pixel movement to treat as a drag; below this, release cancels drag (allows double-click to equip). */
const DRAG_THRESHOLD_PX = 8;
/** Max ms between two clicks to treat as double-click (fallback when browser dblclick doesn't fire). */
const DOUBLE_CLICK_WINDOW_MS = 400;
/** Delay before clearing hover overlay on mouseLeave - reduces flicker when moving between overlapping items. */
const HOVER_LEAVE_DELAY_MS = 50;

function clampBagPosition(
    bagX: number,
    bagY: number,
    bagRect: DOMRect,
    itemDisplayWidth: number,
    itemDisplayHeight: number,
): { bagX: number; bagY: number } {
    const itemHalfWidth = itemDisplayWidth / 2;
    const itemHalfHeight = itemDisplayHeight / 2;
    const minX = BAG_PADDING + itemHalfWidth;
    const maxX = Math.max(minX, bagRect.width - BAG_PADDING - itemHalfWidth);
    const minY = BAG_PADDING + itemHalfHeight;
    const maxY = Math.max(minY, bagRect.height - BAG_PADDING - itemHalfHeight);
    return {
        bagX: Math.round(Math.max(minX, Math.min(maxX, bagX))),
        bagY: Math.round(Math.max(minY, Math.min(maxY, bagY))),
    };
}

type DragSource = EquipmentSlot | 'bag';

interface DraggedItem {
    item: { itemId: number; itemUid: number; effectOverrides?: Effect[] };
    source: DragSource;
    itemType: ItemTypes;
}

export function InventoryDialog({
    position,
    onClose,
    zIndex,
    onBringToFront,
}: InventoryDialogProps) {
    const equippedItems = useStore(inventoryDialogStore, (state) => state.equippedItems);
    const baggedItems = useStore(inventoryDialogStore, (state) => state.baggedItems);
    const playerGender = useStore(inventoryDialogStore, (state) => state.playerGender);
    const spriteFrameMap = useStore(appStore, (state) => state.spriteFrameMap);
    const displaySpritesInfo = useStore(mapDialogStore, (state) => state.debugMode);

    const [draggedItem, setDraggedItem] = useState<DraggedItem | null>(null);
    const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
    const [isBagDropTarget, setIsBagDropTarget] = useState(false);
    const [isDropToGroundIntent, setIsDropToGroundIntent] = useState(false);
    const [activeSlotDropTarget, setActiveSlotDropTarget] = useState<EquipmentSlot | null>(null);
    const [dragGhostPortalTarget, setDragGhostPortalTarget] = useState<HTMLElement>(document.body);
    const bagAreaRef = useRef<HTMLDivElement>(null);
    const isBagDropTargetRef = useRef(false);
    const activeSlotDropTargetRef = useRef<EquipmentSlot | null>(null);
    const ringLeftSlotRef = useRef<HTMLDivElement | null>(null);
    const ringRightSlotRef = useRef<HTMLDivElement | null>(null);
    const dragStartPositionRef = useRef({ x: 0, y: 0 });
    const bagItemImageSizeCacheRef = useRef(new Map<string, { width: number; height: number }>());
    const [, setBagItemImageSizesVersion] = useState(0);
    /** When we cancel a drag (no movement), store item+time so second click can trigger equip if dblclick doesn't fire. */
    const lastCancelledBagDragRef = useRef<{ itemUid: number; item: { itemId: number; itemUid: number }; itemType: ItemTypes; timestamp: number } | null>(null);
    const isSecondClickOfDoubleClickRef = useRef(false);
    /** When synthetic double-click handled consume/equip in mouseup, skip the native dblclick to avoid double-firing. */
    const skipNextDblclickRef = useRef(false);
    /** Debounce mouseLeave to avoid flicker when moving between overlapping items. */
    const hoverLeaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    /** Right-click context menu for bag items. */
    const [contextMenu, setContextMenu] = useState<{
        x: number;
        y: number;
        item: { itemId: number; itemUid: number };
    } | null>(null);

    useEffect(() => {
        const updatePortalTarget = () => {
            const fullscreenElement = document.fullscreenElement;
            setDragGhostPortalTarget(
                fullscreenElement instanceof HTMLElement ? fullscreenElement : document.body,
            );
        };
        updatePortalTarget();
        document.addEventListener('fullscreenchange', updatePortalTarget);
        return () => document.removeEventListener('fullscreenchange', updatePortalTarget);
    }, []);

    const clearHoverDebounced = useCallback(() => {
        if (hoverLeaveTimeoutRef.current) {
            clearTimeout(hoverLeaveTimeoutRef.current);
            hoverLeaveTimeoutRef.current = null;
        }
        hoverLeaveTimeoutRef.current = setTimeout(() => {
            hoverLeaveTimeoutRef.current = null;
            setInventoryItemHoverInfo(undefined);
        }, HOVER_LEAVE_DELAY_MS);
    }, []);

    const cancelHoverClear = useCallback(() => {
        if (hoverLeaveTimeoutRef.current) {
            clearTimeout(hoverLeaveTimeoutRef.current);
            hoverLeaveTimeoutRef.current = null;
        }
    }, []);

    useEffect(() => {
        return () => {
            if (hoverLeaveTimeoutRef.current) clearTimeout(hoverLeaveTimeoutRef.current);
            setInventoryItemHoverInfo(undefined);
        };
    }, []);

    useEffect(() => {
        if (!contextMenu) return;
        const closeMenu = () => {
            setContextMenu(null);
            setInventoryItemHoverOverlaySuppressed(false);
        };
        const handleClick = () => closeMenu();
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') closeMenu();
        };
        window.addEventListener('click', handleClick);
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('click', handleClick);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [contextMenu]);

    useEffect(() => {
        let isDisposed = false;
        const loadedKeys = new Set<string>();

        for (const item of baggedItems) {
            const itemDef = ITEMS.find((i) => i.id === item.itemId);
            if (!itemDef) {
                continue;
            }
            const gender = playerGender !== undefined ? playerGender : Gender.MALE;
            const spriteKey = getItemInventorySpriteKeyWithOverrides(itemDef, gender, item.effectOverrides);
            if (!spriteKey) {
                continue;
            }
            if (loadedKeys.has(spriteKey) || bagItemImageSizeCacheRef.current.has(spriteKey)) {
                continue;
            }
            const imageDataUrl = spriteFrameMap.get(spriteKey);
            if (imageDataUrl === undefined) {
                continue;
            }

            loadedKeys.add(spriteKey);
            const image = new Image();
            image.onload = () => {
                if (isDisposed) {
                    return;
                }
                bagItemImageSizeCacheRef.current.set(spriteKey, {
                    width: image.naturalWidth,
                    height: image.naturalHeight,
                });
                setBagItemImageSizesVersion((version) => version + 1);
            };
            image.src = imageDataUrl;
        }

        return () => {
            isDisposed = true;
        };
    }, [baggedItems, playerGender, spriteFrameMap]);

    const getBagItemDisplaySize = useCallback(
        (itemId: number, effectOverrides?: Effect[]) => {
            const bagItem = ITEMS.find((i) => i.id === itemId);
            if (!bagItem) {
                return { width: BAG_ITEM_SIZE, height: BAG_ITEM_SIZE };
            }
            const gender = playerGender !== undefined ? playerGender : Gender.MALE;
            const spriteKey = getItemInventorySpriteKeyWithOverrides(bagItem, gender, effectOverrides);
            const naturalSize =
                spriteKey !== undefined
                    ? bagItemImageSizeCacheRef.current.get(spriteKey)
                    : undefined;
            const scale = bagItem.scale !== undefined ? bagItem.scale : 1;
            if (naturalSize === undefined) {
                return {
                    width: Math.max(1, Math.round(BAG_ITEM_SIZE * scale)),
                    height: Math.max(1, Math.round(BAG_ITEM_SIZE * scale)),
                };
            }
            return {
                width: Math.max(1, Math.round(naturalSize.width * scale)),
                height: Math.max(1, Math.round(naturalSize.height * scale)),
            };
        },
        [playerGender],
    );

    const getSlotData = useCallback(
        (slot: EquipmentSlot) => {
            const equipped = equippedItems[slot];
            const itemDef = equipped !== undefined ? ITEMS.find((i) => i.id === equipped.itemId) : undefined;
            const gender = playerGender ?? Gender.MALE;
            const spriteKey = itemDef !== undefined ? getItemInventorySpriteKeyWithOverrides(itemDef, gender, equipped?.effectOverrides) : undefined;
            const imageDataUrl = spriteKey !== undefined ? spriteFrameMap.get(spriteKey) : undefined;
            return { equipped, itemDef, imageDataUrl };
        },
        [equippedItems, playerGender, spriteFrameMap],
    );

    const isItemEquippable = useCallback(
        (itemDef: { itemType: ItemTypes; gender?: Gender }) => {
            if (itemDef.itemType === ItemTypes.MISC) return false;
            const pg = playerGender ?? Gender.MALE;
            if (itemDef.gender !== undefined && itemDef.gender !== pg) return false;
            return true;
        },
        [playerGender],
    );

    const getItemImageUrl = useCallback(
        (itemId: number, effectOverrides?: Effect[]) => {
            const item = ITEMS.find((i) => i.id === itemId);
            if (!item) return undefined;
            const gender = playerGender ?? Gender.MALE;
            const key = getItemInventorySpriteKeyWithOverrides(item, gender, effectOverrides);
            if (!key) return undefined;
            return spriteFrameMap.get(key);
        },
        [playerGender, spriteFrameMap],
    );

    const handleSlotMouseDown = useCallback(
        (e: React.MouseEvent, slot: EquipmentSlot) => {
            const { equipped, imageDataUrl } = getSlotData(slot);
            if (e.button !== 0 || !imageDataUrl || !equipped) return;
            e.preventDefault();
            cancelHoverClear();
            setInventoryItemHoverInfo(undefined);
            isBagDropTargetRef.current = false;
            activeSlotDropTargetRef.current = slot;
            setIsBagDropTarget(false);
            setActiveSlotDropTarget(slot);
            dragStartPositionRef.current = { x: e.clientX, y: e.clientY };
            const itemDef = ITEMS.find((i) => i.id === equipped.itemId);
            setDraggedItem({
                item: equipped,
                source: slot,
                itemType: itemDef?.itemType ?? ItemTypes.RING,
            });
            setDragPosition({ x: e.clientX, y: e.clientY });
        },
        [getSlotData],
    );

    const handleSlotDoubleClick = useCallback(
        (slot: EquipmentSlot) => {
            const { equipped, imageDataUrl } = getSlotData(slot);
            if (!equipped || !imageDataUrl) return;
            EventBus.emit(ITEM_MOVED_TO_BAG, {
                itemUid: equipped.itemUid,
                itemType: slot,
                bagX: equipped.bagX,
                bagY: equipped.bagY,
            });
        },
        [getSlotData],
    );

    const handleBagItemDoubleClick = useCallback(
        (item: { itemId: number; itemUid: number; quantity?: number }) => {
            if (skipNextDblclickRef.current) {
                skipNextDblclickRef.current = false;
                return;
            }
            const itemDef = ITEMS.find((i) => i.id === item.itemId);
            if (!itemDef) return;
            if (itemDef.itemType === ItemTypes.MISC && itemDef.consumable) {
                EventBus.emit(ITEM_CONSUMED_REQUESTED, { item });
                return;
            }
            if (itemDef.itemType === ItemTypes.MISC) return;
            const payload = itemDef.itemType === ItemTypes.RING
                ? { item, itemType: itemDef.itemType }
                : { item, itemType: itemDef.itemType };
            EventBus.emit(ITEM_EQUIP_REQUESTED, payload);
        },
        [],
    );

    const handleBagItemMouseDown = useCallback(
        (e: React.MouseEvent, item: { itemId: number; itemUid: number; effectOverrides?: Effect[] }) => {
            if (e.button !== 0) return;
            const itemDef = ITEMS.find((i) => i.id === item.itemId);
            if (!itemDef) return;
            e.preventDefault();
            cancelHoverClear();
            setInventoryItemHoverInfo(undefined);
            EventBus.emit(ITEM_BAG_ITEM_BROUGHT_TO_FRONT, { itemUid: item.itemUid });
            isBagDropTargetRef.current = true;
            activeSlotDropTargetRef.current = null;
            setIsBagDropTarget(true);
            setActiveSlotDropTarget(null);
            dragStartPositionRef.current = { x: e.clientX, y: e.clientY };

            // Fallback: if previous click was cancelled (no movement) on same item within double-click window, treat as second click
            const now = Date.now();
            const last = lastCancelledBagDragRef.current;
            const isSecondClick =
                last !== null &&
                last.itemUid === item.itemUid &&
                now - last.timestamp <= DOUBLE_CLICK_WINDOW_MS;
            isSecondClickOfDoubleClickRef.current = isSecondClick;
            if (isSecondClick) {
                lastCancelledBagDragRef.current = null;
            }

            setDraggedItem({
                item,
                source: 'bag',
                itemType: itemDef.itemType,
            });
            setDragPosition({ x: e.clientX, y: e.clientY });
        },
        [cancelHoverClear],
    );

    useEffect(() => {
        if (!draggedItem) return;

        const getCloserRingSlot = (clientX: number, clientY: number): EquipmentSlot | null => {
            const left = ringLeftSlotRef.current?.getBoundingClientRect();
            const right = ringRightSlotRef.current?.getBoundingClientRect();
            if (!left || !right) return RING_SLOT_LEFT;
            const leftCenterX = left.left + left.width / 2;
            const leftCenterY = left.top + left.height / 2;
            const rightCenterX = right.left + right.width / 2;
            const rightCenterY = right.top + right.height / 2;
            const distLeft = Math.hypot(clientX - leftCenterX, clientY - leftCenterY);
            const distRight = Math.hypot(clientX - rightCenterX, clientY - rightCenterY);
            return distLeft <= distRight ? RING_SLOT_LEFT : RING_SLOT_RIGHT;
        };

        const handleMouseMove = (e: MouseEvent) => {
            setDragPosition({ x: e.clientX, y: e.clientY });
            const el = document.elementFromPoint(e.clientX, e.clientY);
            const bagEl = bagAreaRef.current;
            const overBag = !!(bagEl && (el === bagEl || bagEl.contains(el)));
            const dialogEl = document.querySelector<HTMLElement>('[data-dialog-id="inventory-dialog"]');
            const dialogRect = dialogEl?.getBoundingClientRect();
            const outsideDialog = dialogRect
                ? e.clientX < dialogRect.left ||
                  e.clientX > dialogRect.right ||
                  e.clientY < dialogRect.top ||
                  e.clientY > dialogRect.bottom
                : true;
            const dropToGround = draggedItem.source === 'bag' && outsideDialog;
            setIsDropToGroundIntent(dropToGround);
            isBagDropTargetRef.current = overBag && !dropToGround;
            setIsBagDropTarget(overBag && !dropToGround);

            let slotTarget: EquipmentSlot | null = null;
            if (!overBag && !dropToGround) {
                if (draggedItem.source === 'bag' && draggedItem.itemType === ItemTypes.RING) {
                    slotTarget = getCloserRingSlot(e.clientX, e.clientY);
                } else if (draggedItem.source === 'bag' && draggedItem.itemType === ItemTypes.MISC) {
                    slotTarget = null; // MISC is not equippable
                } else if (draggedItem.source !== 'bag') {
                    slotTarget = draggedItem.source;
                } else {
                    slotTarget = draggedItem.itemType as EquipmentSlot;
                }
            }
            activeSlotDropTargetRef.current = slotTarget;
            setActiveSlotDropTarget(slotTarget);
        };

        const handleMouseUp = (e: MouseEvent) => {
            const dx = e.clientX - dragStartPositionRef.current.x;
            const dy = e.clientY - dragStartPositionRef.current.y;
            const hasMoved = Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX;

            if (!hasMoved) {
                // No movement: cancel drag so double-click can equip or consume
                if (isSecondClickOfDoubleClickRef.current && draggedItem.source === 'bag') {
                    const itemDef = ITEMS.find((i) => i.id === draggedItem.item.itemId);
                    if (itemDef?.consumable && itemDef.itemType === ItemTypes.MISC) {
                        EventBus.emit(ITEM_CONSUMED_REQUESTED, { item: draggedItem.item });
                        skipNextDblclickRef.current = true;
                    } else if (draggedItem.itemType !== ItemTypes.MISC) {
                        const payload = draggedItem.itemType === ItemTypes.RING
                            ? { item: draggedItem.item, itemType: draggedItem.itemType }
                            : { item: draggedItem.item, itemType: draggedItem.itemType };
                        EventBus.emit(ITEM_EQUIP_REQUESTED, payload);
                        skipNextDblclickRef.current = true;
                    }
                } else if (draggedItem.source === 'bag') {
                    // First click cancelled - store for potential synthetic double-click
                    lastCancelledBagDragRef.current = {
                        itemUid: draggedItem.item.itemUid,
                        item: draggedItem.item,
                        itemType: draggedItem.itemType,
                        timestamp: Date.now(),
                    };
                }
                isSecondClickOfDoubleClickRef.current = false;
                setDraggedItem(null);
                setIsBagDropTarget(false);
                setIsDropToGroundIntent(false);
                setActiveSlotDropTarget(null);
                return;
            }

            lastCancelledBagDragRef.current = null;

            if (isBagDropTargetRef.current) {
                const bagEl = bagAreaRef.current;
                const rect = bagEl?.getBoundingClientRect();
                let bagX = rect ? e.clientX - rect.left : 0;
                let bagY = rect ? e.clientY - rect.top : 0;
                if (rect) {
                    const draggedItemDisplaySize = getBagItemDisplaySize(draggedItem.item.itemId, draggedItem.item.effectOverrides);
                    const clamped = clampBagPosition(
                        bagX,
                        bagY,
                        rect,
                        draggedItemDisplaySize.width,
                        draggedItemDisplaySize.height,
                    );
                    bagX = clamped.bagX;
                    bagY = clamped.bagY;
                }
                const slotForMove: EquipmentSlot = draggedItem.source === 'bag' ? (draggedItem.itemType as EquipmentSlot) : draggedItem.source;
                EventBus.emit(ITEM_MOVED_TO_BAG, {
                    itemUid: draggedItem.item.itemUid,
                    itemType: slotForMove,
                    bagX,
                    bagY,
                });
            } else if (draggedItem.source === 'bag') {
                const dialogEl = document.querySelector<HTMLElement>('[data-dialog-id="inventory-dialog"]');
                const dialogRect = dialogEl?.getBoundingClientRect();
                const isOutsideDialog = dialogRect
                    ? e.clientX < dialogRect.left ||
                      e.clientX > dialogRect.right ||
                      e.clientY < dialogRect.top ||
                      e.clientY > dialogRect.bottom
                    : true;

                if (isOutsideDialog) {
                    EventBus.emit(ITEM_DROP_TO_GROUND_REQUESTED, { itemUid: draggedItem.item.itemUid });
                } else if (draggedItem.itemType !== ItemTypes.MISC) {
                    // Dropped inside dialog but outside bag → equip to slot (MISC is not equippable)
                    const payload = draggedItem.itemType === ItemTypes.RING && activeSlotDropTargetRef.current
                        ? { item: draggedItem.item, itemType: draggedItem.itemType, targetSlot: activeSlotDropTargetRef.current }
                        : { item: draggedItem.item, itemType: draggedItem.itemType };
                    EventBus.emit(ITEM_EQUIP_REQUESTED, payload);
                }
            }
            // Ring from slot dropped outside bag: snap back (do nothing, item stays in slot)
            setDraggedItem(null);
            setIsBagDropTarget(false);
            setIsDropToGroundIntent(false);
            setActiveSlotDropTarget(null);
        };

        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [draggedItem, getBagItemDisplaySize]);

    return (
        <DraggableDialog
            title="Inventory"
            position={position}
            id="inventory-dialog"
            zIndex={zIndex}
            onBringToFront={onBringToFront}
            onContextMenu={(e) => {
                e.preventDefault();
                onClose();
            }}
        >
            <div className="inventory-dialog-content" data-drop-to-ground={isDropToGroundIntent ? 'true' : undefined}>
                <div className="inventory-equipped-area">
                    {(() => {
                        const getSlotLabel = (slot: EquipmentSlot) => {
                            if (slot === ItemTypes.ACCESSORY) return 'ACC';
                            if (slot === ItemTypes.NECKLACE) return 'NECK';
                            if (slot === RING_SLOT_LEFT || slot === RING_SLOT_RIGHT) return 'Ring';
                            const slotId = EQUIPMENT_SLOT_TO_SLOT_ID[slot];
                            return slotId.charAt(0).toUpperCase() + slotId.slice(1);
                        };
                        const renderEquippableSlot = (slot: EquipmentSlot, slotRef?: React.RefObject<HTMLDivElement | null>) => {
                            const slotId = EQUIPMENT_SLOT_TO_SLOT_ID[slot];
                            const { equipped, itemDef, imageDataUrl } = getSlotData(slot);
                            const isDropTarget = activeSlotDropTarget === slot;
                            const slotLabel = getSlotLabel(slot);
                            return (
                                <div
                                    key={slot}
                                    ref={slotRef ?? undefined}
                                    data-slot-type={slot}
                                    className={`inventory-slot inventory-slot-${slotId}${imageDataUrl ? ' inventory-slot-has-item' : ''}${isDropTarget ? ' inventory-slot-drop-target' : ''}`}
                                    onMouseDown={(e) => handleSlotMouseDown(e, slot)}
                                    onDoubleClick={imageDataUrl ? () => handleSlotDoubleClick(slot) : undefined}
                                    onMouseEnter={
                                        imageDataUrl && itemDef && equipped && !draggedItem && !contextMenu
                                            ? (e) => {
                                                  cancelHoverClear();
                                                  setInventoryItemHoverInfo({
                                                      itemName: itemDef.name,
                                                      itemType: itemDef.itemType,
                                                      itemId: equipped.itemId,
                                                      itemUid: equipped.itemUid,
                                                      gender: itemDef.gender,
                                                      quantity: equipped.quantity ?? 1,
                                                      stackable: itemDef.stackable,
                                                      consumable: itemDef.consumable,
                                                      appearanceGlowColor: getGlowEffectColor(itemDef, equipped.effectOverrides),
                                                      appearanceGlareColor: getGlareEffectColor(itemDef, equipped.effectOverrides),
                                                      appearanceTintColor: getTintAppearanceEffectColor(itemDef, equipped.effectOverrides),
                                                      inventoryTintColor: getTintInventoryEffectColorWithOverrides(itemDef, equipped.effectOverrides),
                                                      mouseX: e.clientX,
                                                      mouseY: e.clientY,
                                                  });
                                              }
                                            : undefined
                                    }
                                    onMouseMove={
                                        imageDataUrl && itemDef && equipped && !draggedItem && !contextMenu
                                            ? (e) =>
                                                  setInventoryItemHoverInfo({
                                                      itemName: itemDef.name,
                                                      itemType: itemDef.itemType,
                                                      itemId: equipped.itemId,
                                                      itemUid: equipped.itemUid,
                                                      gender: itemDef.gender,
                                                      quantity: equipped.quantity ?? 1,
                                                      stackable: itemDef.stackable,
                                                      consumable: itemDef.consumable,
                                                      appearanceGlowColor: getGlowEffectColor(itemDef, equipped.effectOverrides),
                                                      appearanceGlareColor: getGlareEffectColor(itemDef, equipped.effectOverrides),
                                                      appearanceTintColor: getTintAppearanceEffectColor(itemDef, equipped.effectOverrides),
                                                      mouseX: e.clientX,
                                                      mouseY: e.clientY,
                                                  })
                                            : undefined
                                    }
                                    onMouseLeave={
                                        imageDataUrl ? () => clearHoverDebounced() : undefined
                                    }
                                    style={{ cursor: imageDataUrl ? 'grab' : undefined }}
                                >
                                    {imageDataUrl ? (
                                        <img
                                            src={imageDataUrl}
                                            alt={`Equipped ${slotLabel}`}
                                            className="inventory-slot-item-image"
                                            draggable={false}
                                            style={{
                                                imageRendering: 'pixelated',
                                                visibility: draggedItem?.source === slot ? 'hidden' : 'visible',
                                                ...(displaySpritesInfo && { border: '1px solid red' }),
                                                ...(itemDef?.scale != null && { transform: `scale(${itemDef.scale})` }),
                                            }}
                                        />
                                    ) : (
                                        <span className="inventory-slot-label">{slotLabel}</span>
                                    )}
                                </div>
                            );
                        };
                        return (
                            <>
                                {renderEquippableSlot(ItemTypes.HELMET)}
                                {renderEquippableSlot(ItemTypes.WEAPON)}
                                {renderEquippableSlot(ItemTypes.ARMOR)}
                                {renderEquippableSlot(ItemTypes.HAUBERK)}
                                {renderEquippableSlot(ItemTypes.SHIELD)}
                                {renderEquippableSlot(ItemTypes.LEGGINGS)}
                                {renderEquippableSlot(ItemTypes.CAPE)}
                                {renderEquippableSlot(ItemTypes.BOOTS)}
                                {renderEquippableSlot(ItemTypes.ACCESSORY)}
                                {renderEquippableSlot(ItemTypes.NECKLACE)}
                                {renderEquippableSlot(RING_SLOT_LEFT, ringLeftSlotRef)}
                                {renderEquippableSlot(RING_SLOT_RIGHT, ringRightSlotRef)}
                            </>
                        );
                    })()}
                </div>
                <div
                    ref={bagAreaRef}
                    className={`inventory-bag-area${isBagDropTarget ? ' inventory-bag-area-drop-target' : ''}`}
                >
                    {baggedItems.map((item) => {
                        const bagItem = ITEMS.find((i) => i.id === item.itemId);
                        const gender = playerGender ?? Gender.MALE;
                        const spriteKey = bagItem !== undefined ? getItemInventorySpriteKeyWithOverrides(bagItem, gender, item.effectOverrides) : undefined;
                        const imageDataUrl = spriteKey !== undefined ? spriteFrameMap.get(spriteKey) : undefined;
                        const isThisItemDragged =
                            draggedItem?.source === 'bag' &&
                            draggedItem.item.itemUid === item.itemUid;
                        const hasPosition = item.bagX !== undefined && item.bagY !== undefined;
                        const bagItemDisplaySize = getBagItemDisplaySize(item.itemId, item.effectOverrides);
                        return (
                            <div
                                key={item.itemUid}
                                className={`inventory-bag-item${displaySpritesInfo ? ' inventory-bag-item-debug' : ''}`}
                                onMouseDown={(e) => handleBagItemMouseDown(e, item)}
                                onDoubleClick={() => handleBagItemDoubleClick(item)}
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setInventoryItemHoverInfo(undefined);
                                    setInventoryItemHoverOverlaySuppressed(true);
                                    setContextMenu({ x: e.clientX, y: e.clientY, item });
                                }}
                                onMouseEnter={
                                    bagItem && !draggedItem && !contextMenu
                                        ? (e) => {
                                              cancelHoverClear();
                                              setInventoryItemHoverInfo({
                                                  itemName: bagItem.name,
                                                  itemType: bagItem.itemType,
                                                  itemId: item.itemId,
                                                  itemUid: item.itemUid,
                                                  gender: bagItem.gender,
                                                  quantity: item.quantity ?? 1,
                                                  stackable: bagItem.stackable,
                                                  consumable: bagItem.consumable,
                                                  appearanceGlowColor: getGlowEffectColor(bagItem, item.effectOverrides),
                                                  appearanceGlareColor: getGlareEffectColor(bagItem, item.effectOverrides),
                                                  appearanceTintColor: getTintAppearanceEffectColor(bagItem, item.effectOverrides),
                                                  inventoryTintColor: getTintInventoryEffectColorWithOverrides(bagItem, item.effectOverrides),
                                                  mouseX: e.clientX,
                                                  mouseY: e.clientY,
                                              });
                                          }
                                        : undefined
                                }
                                onMouseMove={
                                    bagItem && !draggedItem && !contextMenu
                                        ? (e) =>
                                              setInventoryItemHoverInfo({
                                                  itemName: bagItem.name,
                                                  itemType: bagItem.itemType,
                                                  itemId: item.itemId,
                                                  itemUid: item.itemUid,
                                                  gender: bagItem.gender,
                                                  quantity: item.quantity ?? 1,
                                                  stackable: bagItem.stackable,
                                                  consumable: bagItem.consumable,
                                                  appearanceGlowColor: getGlowEffectColor(bagItem, item.effectOverrides),
                                                  appearanceGlareColor: getGlareEffectColor(bagItem, item.effectOverrides),
                                                  appearanceTintColor: getTintAppearanceEffectColor(bagItem, item.effectOverrides),
                                                  inventoryTintColor: getTintInventoryEffectColorWithOverrides(bagItem, item.effectOverrides),
                                                  mouseX: e.clientX,
                                                  mouseY: e.clientY,
                                              })
                                        : undefined
                                }
                                onMouseLeave={() => clearHoverDebounced()}
                                style={{
                                    cursor: 'grab',
                                    left: hasPosition ? item.bagX : '50%',
                                    top: hasPosition ? item.bagY : '50%',
                                    transform: 'translate(-50%, -50%)',
                                    width: bagItemDisplaySize.width,
                                    height: bagItemDisplaySize.height,
                                }}
                            >
                                {imageDataUrl ? (
                                    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <img
                                            src={imageDataUrl}
                                            alt={bagItem?.name ?? 'Item'}
                                            className="inventory-slot-item-image"
                                            draggable={false}
                                            style={{
                                                imageRendering: 'pixelated',
                                                visibility: isThisItemDragged ? 'hidden' : 'visible',
                                                width: '100%',
                                                height: '100%',
                                                maxWidth: 'none',
                                                maxHeight: 'none',
                                                objectFit: 'fill',
                                            }}
                                        />
                                        {bagItem?.stackable && (
                                            <span
                                                style={{
                                                    position: 'absolute',
                                                    bottom: -10,
                                                    right: -10,
                                                    fontSize: '16px',
                                                    fontWeight: 'bold',
                                                    color: 'var(--rpg-parchment)',
                                                    textShadow: '1px 1px 1px rgba(0,0,0,0.9)',
                                                    padding: '0 2px',
                                                    minWidth: '12px',
                                                    textAlign: 'right',
                                                    visibility: isThisItemDragged ? 'hidden' : 'visible',
                                                }}
                                            >
                                                {item.quantity ?? 1}
                                            </span>
                                        )}
                                    </div>
                                ) : (
                                    <span className="inventory-slot-label" title={bagItem?.name}>
                                        ?
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
            {draggedItem &&
                getItemImageUrl(draggedItem.item.itemId, draggedItem.item.effectOverrides) &&
                (() => {
                    const draggedItemDef = ITEMS.find((i) => i.id === draggedItem.item.itemId);
                    const itemScale = draggedItemDef?.scale ?? 1;
                    // For consistency: smaller items stay small, larger items scale down to fit
                    const ghostSize = itemScale < 1 ? DRAG_GHOST_SIZE * itemScale : DRAG_GHOST_SIZE;
                    const imageScale = itemScale > 1 ? 1 / itemScale : 1;
                    const draggedBagItem = draggedItem.source === 'bag'
                        ? baggedItems.find((b) => b.itemUid === draggedItem.item.itemUid)
                        : undefined;
                    const showQuantityOnGhost = draggedItemDef?.stackable && draggedBagItem;
                    const ghostQuantity = draggedBagItem?.quantity ?? 1;
                    return createPortal(
                        <div
                            className="inventory-drag-ghost"
                            style={{
                                left: dragPosition.x,
                                top: dragPosition.y,
                                width: ghostSize,
                                height: ghostSize,
                                zIndex: (zIndex ?? 10000) + 1000,
                                transform: 'translate(-50%, -50%)',
                            }}
                        >
                            <img
                                src={getItemImageUrl(draggedItem.item.itemId, draggedItem.item.effectOverrides)!}
                                alt=""
                                draggable={false}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'contain',
                                    imageRendering: 'pixelated',
                                    pointerEvents: 'none',
                                    ...(imageScale !== 1 && { transform: `scale(${imageScale})` }),
                                }}
                            />
                            {showQuantityOnGhost && (
                                <span
                                    style={{
                                        position: 'absolute',
                                        bottom: 0,
                                        right: 0,
                                        fontSize: '16px',
                                        fontWeight: 'bold',
                                        color: 'var(--rpg-parchment)',
                                        textShadow: '1px 1px 1px rgba(0,0,0,0.9)',
                                        padding: '0 2px',
                                        minWidth: '12px',
                                        textAlign: 'right',
                                        pointerEvents: 'none',
                                    }}
                                >
                                    {ghostQuantity}
                                </span>
                            )}
                        </div>,
                        dragGhostPortalTarget,
                    );
                })()}
            {contextMenu &&
                (() => {
                    const bagItemDef = ITEMS.find((i) => i.id === contextMenu.item.itemId);
                    const showEquip = bagItemDef ? isItemEquippable(bagItemDef) : false;
                    const showConsume = !!(bagItemDef?.itemType === ItemTypes.MISC && bagItemDef?.consumable);
                    const options: { label: string; onClick: () => void }[] = [];
                    if (showEquip) {
                        options.push({
                            label: 'Equip',
                            onClick: () => {
                                EventBus.emit(ITEM_EQUIP_REQUESTED, {
                                    item: contextMenu.item,
                                    itemType: bagItemDef!.itemType,
                                });
                            },
                        });
                    }
                    if (showConsume) {
                        options.push({
                            label: 'Consume',
                            onClick: () => EventBus.emit(ITEM_CONSUMED_REQUESTED, { item: contextMenu.item }),
                        });
                    }
                    options.push({
                        label: 'Drop',
                        onClick: () => EventBus.emit(ITEM_DROP_TO_GROUND_REQUESTED, { itemUid: contextMenu.item.itemUid }),
                    });
                    return createPortal(
                        <div
                            className="rpg-context-menu"
                            style={{
                                left: contextMenu.x,
                                top: contextMenu.y,
                                zIndex: (zIndex ?? 10000) + 2000,
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            {options.map((opt) => (
                                <div
                                    key={opt.label}
                                    className="rpg-context-menu-item"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        opt.onClick();
                                        setContextMenu(null);
                                        setInventoryItemHoverOverlaySuppressed(false);
                                    }}
                                >
                                    {opt.label}
                                </div>
                            ))}
                        </div>,
                        dragGhostPortalTarget,
                    );
                })()}
        </DraggableDialog>
    );
}
