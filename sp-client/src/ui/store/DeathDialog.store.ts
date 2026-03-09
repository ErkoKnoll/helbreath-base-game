import { Store } from '@tanstack/react-store';
import { EventBus } from '../../game/EventBus';
import { OUT_UI_PLAYER_DIED } from '../../constants/EventNames';

interface DeathDialogState {
    isOpen: boolean;
}

const initialState: DeathDialogState = {
    isOpen: false,
};

export const deathDialogStore = new Store<DeathDialogState>(initialState);

export const setDeathDialogOpen = (value: boolean) => {
    deathDialogStore.setState((state) => ({ ...state, isOpen: value }));
};

// Initialize EventBus listener to show death dialog when player dies
EventBus.on(OUT_UI_PLAYER_DIED, () => {
    setDeathDialogOpen(true);
});
