import { Store } from '@tanstack/react-store';
import { EventBus } from '../../game/EventBus';
import { 
    OUT_UI_SET_MUSIC_VOLUME, 
    OUT_UI_SET_SOUND_VOLUME,
    OUT_UI_SET_SELECTED_MUSIC,
    IN_UI_CHANGE_MUSIC_VOLUME,
    IN_UI_CHANGE_SOUND_VOLUME,
    IN_UI_MUTE_ALL_SOUNDS,
    IN_UI_UNMUTE_ALL_SOUNDS,
    IN_UI_PLAY_MUSIC,
    IN_UI_CHANGE_PLAY_MAP_MUSIC
} from '../../constants/EventNames';

interface SoundDialogState {
    isOpen: boolean;
    musicVolume: number;
    soundVolume: number;
    playMapMusic: boolean;
    selectedMusic: string;
    showTooltip: boolean;
    tooltipPosition: { x: number; y: number };
    portalTarget: HTMLElement | undefined;
}

const initialState: SoundDialogState = {
    isOpen: false,
    musicVolume: 50, // Default music volume
    soundVolume: 50, // Default sound volume
    playMapMusic: true,
    selectedMusic: 'default.mp3',
    showTooltip: false,
    tooltipPosition: { x: 0, y: 0 },
    portalTarget: undefined,
};

export const soundDialogStore = new Store<SoundDialogState>(initialState);

export const toggleSoundDialog = () => {
    soundDialogStore.setState((state) => ({ ...state, isOpen: !state.isOpen }));
};

export const setSoundDialogOpen = (value: boolean) => {
    soundDialogStore.setState((state) => ({ ...state, isOpen: value }));
};

export const setMusicVolume = (volume: number, notifyPhaser = true) => {
    soundDialogStore.setState((state) => ({ ...state, musicVolume: volume }));
    if (notifyPhaser) {
        // Emit event to Phaser - Phaser handles updating GameStateManager
        EventBus.emit(IN_UI_CHANGE_MUSIC_VOLUME, volume);
    }
};

export const setSoundVolume = (volume: number, notifyPhaser = true) => {
    soundDialogStore.setState((state) => ({ ...state, soundVolume: volume }));
    if (notifyPhaser) {
        // Emit event to Phaser - Phaser handles updating GameStateManager
        EventBus.emit(IN_UI_CHANGE_SOUND_VOLUME, volume);
    }
};

export const muteAllSounds = () => {
    EventBus.emit(IN_UI_MUTE_ALL_SOUNDS);
};

export const unmuteAllSounds = () => {
    EventBus.emit(IN_UI_UNMUTE_ALL_SOUNDS);
};

export const setPlayMapMusic = (enabled: boolean, notifyPhaser = true) => {
    soundDialogStore.setState((state) => ({ ...state, playMapMusic: enabled }));
    if (notifyPhaser) {
        EventBus.emit(IN_UI_CHANGE_PLAY_MAP_MUSIC, enabled);
    }
};

export const setSelectedMusic = (musicFile: string, notifyPhaser = true) => {
    soundDialogStore.setState((state) => ({ ...state, selectedMusic: musicFile }));
    if (notifyPhaser) {
        EventBus.emit(IN_UI_PLAY_MUSIC, musicFile);
    }
};

export const setShowTooltip = (show: boolean) => {
    soundDialogStore.setState((state) => ({ ...state, showTooltip: show }));
};

export const setTooltipPosition = (position: { x: number; y: number }) => {
    soundDialogStore.setState((state) => ({ ...state, tooltipPosition: position }));
};

export const setPortalTarget = (target: HTMLElement | undefined) => {
    soundDialogStore.setState((state) => ({ ...state, portalTarget: target }));
};

// Initialize EventBus listeners to update volumes when emitted from Phaser
EventBus.on(OUT_UI_SET_MUSIC_VOLUME, (volume: number) => {
    setMusicVolume(volume, false);
});

EventBus.on(OUT_UI_SET_SOUND_VOLUME, (volume: number) => {
    setSoundVolume(volume, false);
});

// Listen for music changes from Phaser
EventBus.on(OUT_UI_SET_SELECTED_MUSIC, (musicFile: string) => {
    setSelectedMusic(musicFile, false);
});
