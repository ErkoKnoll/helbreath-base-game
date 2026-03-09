import { Store } from '@tanstack/react-store';
import { EventBus } from '../../game/EventBus';
import {
    OUT_UI_HOVER_GROUND_ITEM,
    OUT_UI_HOVER_MONSTER,
    OUT_UI_CAST_STARTED,
    OUT_UI_CAST_READY,
    OUT_UI_CAST_REMOVED,
    IN_UI_CHANGE_ATTACK_MODE,
    OUT_UI_SET_ATTACK_MODE,
} from '../../constants/EventNames';
import { CURSOR_ATTACK, CURSOR_CASTING, CURSOR_CAST_READY, CURSOR_GRAB_1, CURSOR_POINTER } from '../../constants/SpriteKeys';
import type { MonsterHoverInfo } from '../../Types';
import { setCursorSpriteKey } from './App.store';
import { playerDialogStore } from './PlayerDialog.store';

/** Debounce leaving ground hover so flicker (10ms tick) doesn't overwrite grab animation. Cancel on cast so it doesn't overwrite casting cursor. */
let leaveGroundTimeout: ReturnType<typeof setTimeout> | null = null;

const cancelLeaveGroundTimeout = () => {
    if (leaveGroundTimeout) {
        clearTimeout(leaveGroundTimeout);
        leaveGroundTimeout = null;
    }
};

interface MonsterHoverOverlayState {
    monsterInfo: MonsterHoverInfo | undefined;
    groundItemHover: boolean;
    casting: boolean;
    castReady: boolean;
}

const initialState: MonsterHoverOverlayState = {
    monsterInfo: undefined,
    groundItemHover: false,
    casting: false,
    castReady: false,
};

export const monsterHoverOverlayStore = new Store<MonsterHoverOverlayState>(initialState);

export const setMonsterHoverInfo = (monsterInfo: MonsterHoverInfo | undefined) => {
    monsterHoverOverlayStore.setState((state) => ({ ...state, monsterInfo }));
};

const updateCursorFromState = () => {
    const state = monsterHoverOverlayStore.state;
    const attackMode = playerDialogStore.state.attackMode;
    if (state.castReady) {
        setCursorSpriteKey(CURSOR_CAST_READY);
    } else if (state.casting) {
        setCursorSpriteKey(CURSOR_CASTING);
    } else if (state.monsterInfo && attackMode) {
        setCursorSpriteKey(CURSOR_ATTACK);
    } else if (state.groundItemHover) {
        setCursorSpriteKey(CURSOR_GRAB_1);
    } else {
        setCursorSpriteKey(CURSOR_POINTER);
    }
};

EventBus.on(OUT_UI_HOVER_MONSTER, (monsterInfo: MonsterHoverInfo | undefined) => {
    setMonsterHoverInfo(monsterInfo);
    const state = monsterHoverOverlayStore.state;
    if (!state.casting && !state.castReady) {
        const attackMode = playerDialogStore.state.attackMode;
        if (monsterInfo && attackMode) {
            cancelLeaveGroundTimeout();
            setCursorSpriteKey(CURSOR_ATTACK);
        } else if (!state.groundItemHover) {
            // Set pointer immediately when leaving monster - debounce caused cursor to get stuck
            cancelLeaveGroundTimeout();
            setCursorSpriteKey(CURSOR_POINTER);
        }
        // When groundItemHover, skip - App interval handles grab cursor alternation
    }
});

EventBus.on(OUT_UI_HOVER_GROUND_ITEM, (hovering: boolean) => {
    const wasHovering = monsterHoverOverlayStore.state.groundItemHover;
    monsterHoverOverlayStore.setState((state) => ({ ...state, groundItemHover: hovering }));
    const state = monsterHoverOverlayStore.state;
    if (!state.casting && !state.castReady && !(state.monsterInfo && playerDialogStore.state.attackMode)) {
        if (!hovering) {
            // Set pointer immediately when leaving ground item - debounce caused cursor to get stuck
            cancelLeaveGroundTimeout();
            setCursorSpriteKey(CURSOR_POINTER);
        } else {
            cancelLeaveGroundTimeout();
            if (!wasHovering) {
                setCursorSpriteKey(CURSOR_GRAB_1);
            }
            // When already hovering, let App interval handle grab cursor alternation
        }
    }
});

EventBus.on(IN_UI_CHANGE_ATTACK_MODE, () => updateCursorFromState());
EventBus.on(OUT_UI_SET_ATTACK_MODE, () => updateCursorFromState());

EventBus.on(OUT_UI_CAST_STARTED, () => {
    cancelLeaveGroundTimeout();
    monsterHoverOverlayStore.setState((state) => ({ ...state, casting: true }));
    setCursorSpriteKey(CURSOR_CASTING);
});

EventBus.on(OUT_UI_CAST_READY, () => {
    cancelLeaveGroundTimeout();
    monsterHoverOverlayStore.setState((state) => ({ ...state, casting: false, castReady: true }));
    setCursorSpriteKey(CURSOR_CAST_READY);
});

EventBus.on(OUT_UI_CAST_REMOVED, () => {
    monsterHoverOverlayStore.setState((state) => ({ ...state, casting: false, castReady: false }));
    updateCursorFromState();
});
