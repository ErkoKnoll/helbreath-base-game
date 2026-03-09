import type { Scene } from 'phaser';
import { GameAsset } from './GameAsset';
import { convertWorldPosToPixelPos } from '../../utils/CoordinateUtils';
import { getItemById, getItemSheetIndex, getDroppedItemSpriteIndex, getGlowEffectColor, getGlareEffectColor, getTintAppearanceEffectColor, getTintInventoryEffectColorWithOverrides, type Effect } from '../../constants/Items';
import { Gender } from '../../Types';
import type { InventoryItemHoverInfo } from '../../ui/store/InventoryItemHoverOverlay.store';
import { TILE_SIZE } from '../assets/HBMap';
import { EventBus } from '../EventBus';
import { IN_UI_CHANGE_GENDER, IN_UI_TOGGLE_DISPLAY_LARGE_ITEMS } from '../../constants/EventNames';
import { isDisplayLargeItemsEnabled } from '../../utils/RegistryUtils';

/**
 * Represents an item dropped on the ground.
 * Extends GameAsset and uses item-ground.spr sprites with the same indexing as bag items.
 * Renders based on player gender unless the item has a fixed gender.
 */
export class GroundItem extends GameAsset {
    public readonly worldX: number;
    public readonly worldY: number;
    public readonly itemUid: number;
    public readonly itemId: number;
    public readonly quantity: number;
    private readonly effectOverrides?: Effect[];

    constructor(
        scene: Scene,
        worldX: number,
        worldY: number,
        itemId: number,
        itemUid: number,
        quantity: number,
        playerGender: Gender,
        tint?: number,
        effectOverrides?: Effect[]
    ) {
        const itemDef = getItemById(itemId);
        if (!itemDef) {
            throw new Error(`GroundItem: unknown item id ${itemId}`);
        }

        const effectiveGender = itemDef.gender ?? playerGender;
        const sheetIndex = getItemSheetIndex(itemDef, effectiveGender);
        const spriteIndex = getDroppedItemSpriteIndex(itemDef, effectiveGender);

        if (sheetIndex === undefined || spriteIndex === undefined) {
            throw new Error(`GroundItem: no ground sprite for item ${itemId}`);
        }

        const pixelX = convertWorldPosToPixelPos(worldX) + TILE_SIZE / 2;
        const pixelY = convertWorldPosToPixelPos(worldY) + TILE_SIZE / 2;

        const spritePrefix = isDisplayLargeItemsEnabled(scene) ? 'item-pack' : 'item-ground';
        super(scene, {
            x: pixelX,
            y: pixelY,
            spriteName: spritePrefix,
            spriteSheetIndex: sheetIndex,
            frameIndex: spriteIndex,
            ...(tint !== undefined && { tint }),
        });

        this.worldX = worldX;
        this.worldY = worldY;
        this.itemUid = itemUid;
        this.itemId = itemId;
        this.quantity = quantity;
        this.currentGender = effectiveGender;
        this.tintColor = tint;
        this.effectOverrides = effectOverrides;

        // Apply tint after super() - GameAsset.applyItemEffects clears tint when effects is empty
        if (tint !== undefined) {
            this.sprite.setTint(tint);
        }

        this.genderChangeHandler = (newGender: Gender) => this.updateAppearanceForGender(newGender);
        this.displayLargeItemsChangeHandler = () => this.updateTexture();
        EventBus.on(IN_UI_CHANGE_GENDER, this.genderChangeHandler);
        EventBus.on(IN_UI_TOGGLE_DISPLAY_LARGE_ITEMS, this.displayLargeItemsChangeHandler);
    }

    private currentGender: Gender;
    private tintColor?: number;
    private genderChangeHandler?: (gender: Gender) => void;
    private displayLargeItemsChangeHandler?: () => void;

    private getTexturePrefix(): 'item-ground' | 'item-pack' {
        return isDisplayLargeItemsEnabled(this.scene) ? 'item-pack' : 'item-ground';
    }

    private updateTexture(): void {
        const itemDef = getItemById(this.itemId);
        if (!itemDef) {
            return;
        }

        const effectiveGender = itemDef.gender ?? this.currentGender;
        const sheetIndex = getItemSheetIndex(itemDef, effectiveGender);
        const spriteIndex = getDroppedItemSpriteIndex(itemDef, effectiveGender);
        if (sheetIndex === undefined || spriteIndex === undefined) {
            return;
        }

        const prefix = this.getTexturePrefix();
        const textureKey = `sprite-${prefix}-${sheetIndex}`;
        if (this.scene.textures.exists(textureKey)) {
            this.sprite.setTexture(textureKey, spriteIndex);
        }
        if (this.tintColor !== undefined) {
            this.sprite.setTint(this.tintColor);
        }
    }

    private updateAppearanceForGender(newGender: Gender): void {
        const itemDef = getItemById(this.itemId);
        if (!itemDef || itemDef.gender !== undefined) {
            return;
        }

        this.currentGender = newGender;
        this.updateTexture();
    }

    /** Returns hover overlay info for this ground item at the given screen coordinates. */
    public getHoverInfo(mouseX: number, mouseY: number): InventoryItemHoverInfo {
        const itemDef = getItemById(this.itemId)!;
        return {
            itemName: itemDef.name,
            itemType: itemDef.itemType,
            itemId: this.itemId,
            itemUid: this.itemUid,
            source: 'ground',
            gender: itemDef.gender,
            quantity: this.quantity,
            stackable: itemDef.stackable,
            consumable: itemDef.consumable,
            appearanceGlowColor: getGlowEffectColor(itemDef, this.effectOverrides),
            appearanceGlareColor: getGlareEffectColor(itemDef, this.effectOverrides),
            appearanceTintColor: getTintAppearanceEffectColor(itemDef, this.effectOverrides),
            inventoryTintColor: getTintInventoryEffectColorWithOverrides(itemDef, this.effectOverrides),
            mouseX,
            mouseY,
        };
    }

    public override destroy(): void {
        if (this.genderChangeHandler) {
            EventBus.off(IN_UI_CHANGE_GENDER, this.genderChangeHandler);
            this.genderChangeHandler = undefined;
        }
        if (this.displayLargeItemsChangeHandler) {
            EventBus.off(IN_UI_TOGGLE_DISPLAY_LARGE_ITEMS, this.displayLargeItemsChangeHandler);
            this.displayLargeItemsChangeHandler = undefined;
        }
        super.destroy();
    }
}
