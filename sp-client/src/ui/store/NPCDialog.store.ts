import { Store } from '@tanstack/react-store';
import { EventBus } from '../../game/EventBus';
import { IN_UI_SUMMON_NPC } from '../../constants/EventNames';
import { Direction } from '../../utils/CoordinateUtils';
import type { SummonNPCEvent } from '../../Types';
import { NPCS } from '../../constants/NPCs';

interface NPCDialogState {
    isOpen: boolean;
    selectedNPC: string;
    selectedDirection: Direction;
}

const initialState: NPCDialogState = {
    isOpen: false,
    selectedNPC: NPCS[0]?.sprite ?? 'shopkpr',
    selectedDirection: Direction.South,
};

export const npcDialogStore = new Store<NPCDialogState>(initialState);

export const toggleNPCDialog = () => {
    npcDialogStore.setState((state) => ({ ...state, isOpen: !state.isOpen }));
};

export const setNPCDialogOpen = (value: boolean) => {
    npcDialogStore.setState((state) => ({ ...state, isOpen: value }));
};

export const setSelectedNPC = (sprite: string) => {
    npcDialogStore.setState((state) => ({ ...state, selectedNPC: sprite }));
};

export const setSelectedDirection = (direction: Direction) => {
    npcDialogStore.setState((state) => ({ ...state, selectedDirection: direction }));
};

export const summonNPC = () => {
    const state = npcDialogStore.state;
    const payload: SummonNPCEvent = {
        spriteName: state.selectedNPC,
        direction: state.selectedDirection,
    };
    EventBus.emit(IN_UI_SUMMON_NPC, payload);
};
