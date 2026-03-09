import { Store } from '@tanstack/react-store';
import { EventBus } from '../../game/EventBus';
import { OUT_UI_HOVER_SPRITE_FRAME_DEBUG } from '../../constants/EventNames';

export interface AssetDebugInfo {
    frame: number;
    pivotX: number;
    pivotY: number;
    hasPivot: boolean;
    posX: number;
    posY: number;
    worldX: number;
    worldY: number;
    topLeftX: number;
    topLeftY: number;
    spriteName: string;
    spriteSheetIndex?: number;
    mouseX: number;
    mouseY: number;
    depth: number;
}

interface AssetDebugOverlayState {
    debugInfo: AssetDebugInfo | undefined;
}

const initialState: AssetDebugOverlayState = {
    debugInfo: undefined,
};

export const assetDebugOverlayStore = new Store<AssetDebugOverlayState>(initialState);

export const setAssetDebugInfo = (debugInfo: AssetDebugInfo | undefined) => {
    assetDebugOverlayStore.setState((state) => ({ ...state, debugInfo }));
};

// Initialize EventBus listener to update state when emitted from Phaser
EventBus.on(OUT_UI_HOVER_SPRITE_FRAME_DEBUG, (debugInfo: AssetDebugInfo | undefined) => {
    setAssetDebugInfo(debugInfo);
});
