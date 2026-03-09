import { Store } from '@tanstack/react-store';
import { EventBus } from '../../game/EventBus';
import { OUT_SPRITE_FRAME_EXTRACTED } from '../../constants/EventNames';
import { CURSOR_POINTER } from '../../constants/SpriteKeys';

interface AppState {
    spriteFrameMap: Map<string, string>;
    cursorSpriteKey: string;
}

const initialState: AppState = {
    spriteFrameMap: new Map(),
    cursorSpriteKey: CURSOR_POINTER,
};

export const appStore = new Store<AppState>(initialState);

export const setSpriteFrame = (key: string, dataUrl: string) => {
    appStore.setState((state) => ({
        ...state,
        spriteFrameMap: new Map(state.spriteFrameMap).set(key, dataUrl),
    }));
};

export const setCursorSpriteKey = (key: string) => {
    appStore.setState((state) => ({ ...state, cursorSpriteKey: key }));
};

// Listen to sprite frame extraction events from Phaser via EventBus
EventBus.on(OUT_SPRITE_FRAME_EXTRACTED, (key: string, dataUrl: string) => {
    setSpriteFrame(key, dataUrl);
});
