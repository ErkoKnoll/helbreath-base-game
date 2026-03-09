import { Store } from '@tanstack/react-store';
import { EventBus } from '../../game/EventBus';
import {
    IN_UI_TOGGLE_RENDER_MAP_TILES,
    IN_UI_TOGGLE_RENDER_MAP_OBJECTS,
    IN_UI_TOGGLE_DEBUG_MODE,
    IN_UI_TOGGLE_NON_MOVABLE_CELLS_HIGHLIGHT,
    IN_UI_TOGGLE_TELEPORT_CELLS_HIGHLIGHT,
    IN_UI_TOGGLE_WATER_CELLS_HIGHLIGHT,
    IN_UI_TOGGLE_FARMABLE_CELLS_HIGHLIGHT,
    IN_UI_TOGGLE_GRID_DISPLAY,
    IN_UI_TOGGLE_DISPLAY_LARGE_ITEMS,
    IN_UI_CHANGE_WEATHER,
} from '../../constants/EventNames';

/** Weather mode: dry (no effects), rain, or snow intensity levels */
export type WeatherMode = 'dry' | 'rain-light' | 'rain-medium' | 'rain-heavy' | 'snow-light' | 'snow-medium' | 'snow-heavy';

interface MapDialogState {
    isOpen: boolean;
    renderMapTiles: boolean;
    renderMapObjects: boolean;
    debugMode: boolean;
    showNonMovableCells: boolean;
    showTeleportCells: boolean;
    showWaterCells: boolean;
    showFarmableCells: boolean;
    displayGrid: boolean;
    displayLargeItems: boolean;
    weather: WeatherMode;
}

const initialState: MapDialogState = {
    isOpen: false,
    renderMapTiles: true,
    renderMapObjects: true,
    debugMode: false,
    showNonMovableCells: false,
    showTeleportCells: false,
    showWaterCells: false,
    showFarmableCells: false,
    displayGrid: false,
    displayLargeItems: false,
    weather: 'dry',
};

export const mapDialogStore = new Store<MapDialogState>(initialState);

// Dialog visibility controls
export const toggleMapDialog = () => {
    mapDialogStore.setState((state) => ({ ...state, isOpen: !state.isOpen }));
};

export const setMapDialogOpen = (value: boolean) => {
    mapDialogStore.setState((state) => ({ ...state, isOpen: value }));
};

// Helper functions to update individual fields
export const setRenderMapTiles = (value: boolean) => {
    mapDialogStore.setState((state) => ({ ...state, renderMapTiles: value }));
    EventBus.emit(IN_UI_TOGGLE_RENDER_MAP_TILES, value);
};

export const setRenderMapObjects = (value: boolean) => {
    mapDialogStore.setState((state) => ({ ...state, renderMapObjects: value }));
    EventBus.emit(IN_UI_TOGGLE_RENDER_MAP_OBJECTS, value);
};

export const setDebugMode = (value: boolean) => {
    mapDialogStore.setState((state) => ({ ...state, debugMode: value }));
    EventBus.emit(IN_UI_TOGGLE_DEBUG_MODE, value);
};

export const setShowNonMovableCells = (value: boolean) => {
    mapDialogStore.setState((state) => ({ ...state, showNonMovableCells: value }));
    EventBus.emit(IN_UI_TOGGLE_NON_MOVABLE_CELLS_HIGHLIGHT, value);
};

export const setShowTeleportCells = (value: boolean) => {
    mapDialogStore.setState((state) => ({ ...state, showTeleportCells: value }));
    EventBus.emit(IN_UI_TOGGLE_TELEPORT_CELLS_HIGHLIGHT, value);
};

export const setShowWaterCells = (value: boolean) => {
    mapDialogStore.setState((state) => ({ ...state, showWaterCells: value }));
    EventBus.emit(IN_UI_TOGGLE_WATER_CELLS_HIGHLIGHT, value);
};

export const setShowFarmableCells = (value: boolean) => {
    mapDialogStore.setState((state) => ({ ...state, showFarmableCells: value }));
    EventBus.emit(IN_UI_TOGGLE_FARMABLE_CELLS_HIGHLIGHT, value);
};

export const setDisplayGrid = (value: boolean) => {
    mapDialogStore.setState((state) => ({ ...state, displayGrid: value }));
    EventBus.emit(IN_UI_TOGGLE_GRID_DISPLAY, value);
};

export const setDisplayLargeItems = (value: boolean) => {
    mapDialogStore.setState((state) => ({ ...state, displayLargeItems: value }));
    EventBus.emit(IN_UI_TOGGLE_DISPLAY_LARGE_ITEMS, value);
};

export const setWeather = (value: WeatherMode) => {
    mapDialogStore.setState((state) => ({ ...state, weather: value }));
    EventBus.emit(IN_UI_CHANGE_WEATHER, value);
};

// Helper function to reset to defaults (for ControlsDialog)
export const resetMapDialogToDefaults = () => {
    mapDialogStore.setState((state) => ({
        ...state,
        renderMapTiles: true,
        renderMapObjects: true,
        showNonMovableCells: false,
        showTeleportCells: false,
        showWaterCells: false,
        showFarmableCells: false,
        displayGrid: false,
        displayLargeItems: false,
        weather: 'dry',
        // Note: debugMode is preserved and not reset
    }));
};
