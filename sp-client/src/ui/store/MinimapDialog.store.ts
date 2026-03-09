import { Store } from '@tanstack/react-store';
import { EventBus } from '../../game/EventBus';
import { CachedMinimap } from '../../Types';
import { Minimap } from '../../constants/Assets';
import { convertWorldPosToPixelPos } from '../../utils/CoordinateUtils';
import { OUT_UI_MINIMAP_CAPTURED, OUT_UI_MINIMAP_LOADING } from '../../constants/EventNames';

export interface MinimapLoadingPayload {
    minimap: Minimap;
    mapName: string;
    mapSizeX?: number;
    mapSizeY?: number;
}

interface PreGeneratedMinimapCache {
    minimapImage: string;
    minimapScale: number;
    minimapOriginalSize: number;
}

/** Cache for pre-generated minimaps by map base name (e.g. 'aresden') */
const preGeneratedMinimapCache = new Map<string, PreGeneratedMinimapCache>();

interface MinimapDialogState {
    /** User's preference: whether they want the minimap open (persists across map changes) */
    isOpen: boolean;
    /** Whether the current map supports minimap (false when Minimap.NONE) */
    minimapAvailable: boolean;
    minimapImage: string | undefined;
    minimapScale: number;
    minimapOriginalSize: number;
}

const initialState: MinimapDialogState = {
    isOpen: true,
    minimapAvailable: true,
    minimapImage: undefined,
    minimapScale: 0,
    minimapOriginalSize: 0,
};

export const minimapDialogStore = new Store<MinimapDialogState>(initialState);

export const toggleMinimapDialog = () => {
    minimapDialogStore.setState((state) => {
        if (!state.minimapAvailable) return state;
        return { ...state, isOpen: !state.isOpen };
    });
};

export const setMinimapDialogOpen = (value: boolean) => {
    minimapDialogStore.setState((state) => ({ ...state, isOpen: value }));
};

// Initialize EventBus listener for minimap loading (shows "Loading minimap")
EventBus.on(OUT_UI_MINIMAP_LOADING, (payload: MinimapLoadingPayload) => {
    const clearImageData = (state: MinimapDialogState) => ({
        ...state,
        minimapImage: undefined,
        minimapScale: 0,
        minimapOriginalSize: 0,
    });

    if (payload.minimap === Minimap.NONE) {
        minimapDialogStore.setState((state) => ({
            ...clearImageData(state),
            minimapAvailable: false,
        }));
        return;
    }

    minimapDialogStore.setState((state) => ({ ...state, minimapAvailable: true }));

    if (payload.minimap === Minimap.PRE_GENERATED && payload.mapSizeX != null && payload.mapSizeY != null) {
        const mapBaseName = payload.mapName.replace('.amd', '');
        const cached = preGeneratedMinimapCache.get(mapBaseName);

        if (cached) {
            minimapDialogStore.setState((state) => ({
                ...state,
                minimapImage: cached.minimapImage,
                minimapScale: cached.minimapScale,
                minimapOriginalSize: cached.minimapOriginalSize,
            }));
            return;
        }

        minimapDialogStore.setState(clearImageData);

        const imageUrl = `./assets/images/minimaps/${mapBaseName}.jpg`;

        fetch(imageUrl)
            .then((res) => {
                if (!res.ok) {
                    throw new Error(`Failed to fetch minimap: ${res.status}`);
                }
                return res.blob();
            })
            .then((blob) => {
                const objectUrl = URL.createObjectURL(blob);
                const img = new Image();
                img.onload = () => {
                    const mapWidthPx = convertWorldPosToPixelPos(payload.mapSizeX!);
                    const mapHeightPx = convertWorldPosToPixelPos(payload.mapSizeY!);
                    const scaleX = img.width / mapWidthPx;
                    const scaleY = img.height / mapHeightPx;
                    const scale = Math.min(scaleX, scaleY);

                    const cacheEntry: PreGeneratedMinimapCache = {
                        minimapImage: objectUrl,
                        minimapScale: scale,
                        minimapOriginalSize: img.width,
                    };
                    preGeneratedMinimapCache.set(mapBaseName, cacheEntry);

                    minimapDialogStore.setState((state) => ({
                        ...state,
                        minimapImage: cacheEntry.minimapImage,
                        minimapScale: cacheEntry.minimapScale,
                        minimapOriginalSize: cacheEntry.minimapOriginalSize,
                    }));
                };
                img.src = objectUrl;
            })
            .catch((err) => {
                console.warn('[MinimapDialog] Failed to load pre-generated minimap:', err);
            });
    }
});

// Initialize EventBus listener to update minimap data when emitted from Phaser (ON_DEMAND_GENERATED)
EventBus.on(OUT_UI_MINIMAP_CAPTURED, (data: CachedMinimap) => {
    minimapDialogStore.setState((state) => ({
        ...state,
        minimapImage: data.dataUrl,
        minimapScale: data.scale,
        minimapOriginalSize: data.originalSize,
    }));
});
