import { Store } from '@tanstack/react-store';
import { EventBus } from '../../game/EventBus';
import { IN_UI_CAST_SPELL } from '../../constants/EventNames';
import { SPELLS } from '../../constants/Spells';
import type { CastSpellEvent } from '../../Types';

interface CastDialogState {
    isOpen: boolean;
    selectedSpellId: number;
    useCastAnimation: boolean;
}

const initialState: CastDialogState = {
    isOpen: false,
    selectedSpellId: SPELLS[0]?.id ?? 1,
    useCastAnimation: false,
};

export const castDialogStore = new Store<CastDialogState>(initialState);

export const toggleCastDialog = () => {
    castDialogStore.setState((state) => ({ ...state, isOpen: !state.isOpen }));
};

export const setCastDialogOpen = (value: boolean) => {
    castDialogStore.setState((state) => ({ ...state, isOpen: value }));
};

export const setSelectedSpellId = (spellId: number) => {
    castDialogStore.setState((state) => ({ ...state, selectedSpellId: spellId }));
};

export const setUseCastAnimation = (useCastAnimation: boolean) => {
    castDialogStore.setState((state) => ({ ...state, useCastAnimation }));
};

export const castSpell = () => {
    const state = castDialogStore.state;
    EventBus.emit(IN_UI_CAST_SPELL, {
        spellId: state.selectedSpellId,
        useCastAnimation: state.useCastAnimation,
    } satisfies CastSpellEvent);
    setCastDialogOpen(false);
};
