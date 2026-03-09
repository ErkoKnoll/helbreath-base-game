import { getMapAssets, Minimap } from './Assets';

/**
 * Map data structure with display name, filename, and optional music.
 */
export interface MapData {
    mapName: string;
    mapFile: string;
    music?: string; // Optional music file name (e.g., 'default.mp3')
    minimap?: Minimap;
}

/**
 * Get map names derived from the unified Assets collection
 */
export function getMapNames(): MapData[] {
    return getMapAssets().map(asset => ({
        mapName: asset.mapName || asset.fileName.replace('.amd', ''),
        mapFile: asset.fileName,
        music: asset.music,
        minimap: asset.minimap ?? Minimap.ON_DEMAND_GENERATED,
    }));
}

/**
 * Get map data for a given filename.
 * 
 * @param filename - The map filename (e.g., 'aresden.amd')
 * @returns The map data or undefined if not found
 */
export function getMapData(filename: string): MapData | undefined {
    return getMapNames().find(map => map.mapFile === filename);
}

/**
 * Get music file name for a map file.
 * 
 * @param filename - The map filename (e.g., 'aresden.amd')
 * @returns The music file name or 'default.mp3' if not specified
 */
export function getMapMusic(filename: string): string {
    const mapData = getMapData(filename);
    return mapData?.music || 'default.mp3';
}

/**
 * Get all available map filenames sorted by display name.
 */
export function getAllMapOptions(): Array<{ label: string; value: string }> {
    return getMapNames()
        .map(map => ({ label: map.mapName, value: map.mapFile }))
        .sort((a, b) => a.label.localeCompare(b.label));
}
