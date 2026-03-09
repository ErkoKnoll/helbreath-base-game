import { Store } from '@tanstack/react-store';
import { EventBus } from '../../game/EventBus';
import { IN_UI_CAST_EFFECT, IN_UI_KILL_ALL_EFFECTS } from '../../constants/EventNames';
import { EFFECTS } from '../../constants/Effects';

interface EffectDialogState {
    isOpen: boolean;
    selectedEffect: string;
    infiniteLoop: boolean;
}

const initialState: EffectDialogState = {
    isOpen: false,
    selectedEffect: EFFECTS[0]?.key ?? '',
    infiniteLoop: false,
};

export const effectDialogStore = new Store<EffectDialogState>(initialState);

export const toggleEffectDialog = () => {
    effectDialogStore.setState((state) => ({ ...state, isOpen: !state.isOpen }));
};

export const setEffectDialogOpen = (value: boolean) => {
    effectDialogStore.setState((state) => ({ ...state, isOpen: value }));
};

export const setSelectedEffect = (effectKey: string) => {
    effectDialogStore.setState((state) => ({ ...state, selectedEffect: effectKey }));
};

export const setInfiniteLoop = (value: boolean) => {
    effectDialogStore.setState((state) => ({ ...state, infiniteLoop: value }));
};

export const castEffect = () => {
    const state = effectDialogStore.state;
    EventBus.emit(IN_UI_CAST_EFFECT, { effectKey: state.selectedEffect, infiniteLoop: state.infiniteLoop });
    setEffectDialogOpen(false);
};

export const killAllEffects = () => {
    EventBus.emit(IN_UI_KILL_ALL_EFFECTS);
};
