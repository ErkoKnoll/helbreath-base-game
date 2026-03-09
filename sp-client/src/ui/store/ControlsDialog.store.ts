import { Store } from '@tanstack/react-store';
import { EventBus } from '../../game/EventBus';
import { OUT_UI_SET_SELECTED_MAP, IN_UI_CHANGE_MAP } from '../../constants/EventNames';

interface ControlsDialogState {
    isOpen: boolean;
    selectedMap: string;
    isFullscreen: boolean;
}

const initialState: ControlsDialogState = {
    isOpen: false,
    selectedMap: 'aresden.amd',
    isFullscreen: false,
};

export const controlsDialogStore = new Store<ControlsDialogState>(initialState);

export const toggleControlsDialog = () => {
    controlsDialogStore.setState((state) => ({ ...state, isOpen: !state.isOpen }));
};

export const setControlsDialogOpen = (value: boolean) => {
    controlsDialogStore.setState((state) => ({ ...state, isOpen: value }));
};

export const setSelectedMap = (mapName: string, notifyPhaser = true) => {
    controlsDialogStore.setState((state) => ({ ...state, selectedMap: mapName }));
    if (notifyPhaser) {
        EventBus.emit(IN_UI_CHANGE_MAP, mapName);
    }
};

export const setIsFullscreen = (isFullscreen: boolean) => {
    controlsDialogStore.setState((state) => ({ ...state, isFullscreen }));
};

// Initialize EventBus listeners to update state when emitted from Phaser
EventBus.on(OUT_UI_SET_SELECTED_MAP, (mapName: string) => {
    setSelectedMap(mapName, false);
});
