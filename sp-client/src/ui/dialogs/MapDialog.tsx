import { DraggableDialog } from './DraggableDialog';
import { RpgCheckbox } from '../components/RpgCheckbox';
import { RpgButton } from '../components/RpgButton';
import { useStore } from '@tanstack/react-store';
import { 
    mapDialogStore,
    setRenderMapTiles,
    setRenderMapObjects,
    setDebugMode,
    setShowNonMovableCells,
    setShowTeleportCells,
    setShowWaterCells,
    setShowFarmableCells,
    setDisplayGrid,
    setDisplayLargeItems,
    setWeather,
    resetMapDialogToDefaults,
    type WeatherMode
} from '../store/MapDialog.store';
import { controlsDialogStore, setSelectedMap } from '../store/ControlsDialog.store';
import { getAllMapOptions } from '../../constants/Maps';

interface MapDialogProps {
    position: { x: number; y: number };
    onClose: () => void;
    zIndex?: number;
    onBringToFront?: () => void;
}

export function MapDialog({
    position,
    onClose,
    zIndex,
    onBringToFront,
}: MapDialogProps) {
    const selectedMap = useStore(controlsDialogStore, (state) => state.selectedMap);
    const renderMapTiles = useStore(mapDialogStore, (state) => state.renderMapTiles);
    const renderMapObjects = useStore(mapDialogStore, (state) => state.renderMapObjects);
    const debugMode = useStore(mapDialogStore, (state) => state.debugMode);
    const showNonMovableCells = useStore(mapDialogStore, (state) => state.showNonMovableCells);
    const showTeleportCells = useStore(mapDialogStore, (state) => state.showTeleportCells);
    const showWaterCells = useStore(mapDialogStore, (state) => state.showWaterCells);
    const showFarmableCells = useStore(mapDialogStore, (state) => state.showFarmableCells);
    const displayGrid = useStore(mapDialogStore, (state) => state.displayGrid);
    const displayLargeItems = useStore(mapDialogStore, (state) => state.displayLargeItems);
    const weather = useStore(mapDialogStore, (state) => state.weather);

    const weatherOptions: { value: WeatherMode; label: string }[] = [
        { value: 'dry', label: 'Dry' },
        { value: 'rain-light', label: 'Rain light' },
        { value: 'rain-medium', label: 'Rain medium' },
        { value: 'rain-heavy', label: 'Rain heavy' },
        { value: 'snow-light', label: 'Snow light' },
        { value: 'snow-medium', label: 'Snow medium' },
        { value: 'snow-heavy', label: 'Snow heavy' },
    ];

    return (
        <DraggableDialog 
            title="Map" 
            position={position} 
            id="map-dialog"
            zIndex={zIndex}
            onBringToFront={onBringToFront}
            onContextMenu={(e) => {
                e.preventDefault();
                onClose();
            }}
        >
            <div style={{ marginBottom: '8px' }}>
                <select
                    id="map-select"
                    className="rpg-select"
                    value={selectedMap}
                    onChange={(e) => setSelectedMap(e.target.value, false)}
                    style={{ width: '100%' }}
                >
                    {getAllMapOptions().map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            </div>
            <RpgButton
                onClick={() => {
                    resetMapDialogToDefaults();
                    setSelectedMap(selectedMap);
                }}
                style={{ 
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '14px',
                    marginBottom: '12px',
                }}
            >
                Load map
            </RpgButton>

            <RpgCheckbox
                id="render-map-tiles"
                label="Render map tiles"
                checked={renderMapTiles}
                onCheckedChange={setRenderMapTiles}
            />
            
            <RpgCheckbox
                id="render-map-objects"
                label="Render static map objects"
                checked={renderMapObjects}
                onCheckedChange={setRenderMapObjects}
            />
            
            <RpgCheckbox
                id="display-sprites-info"
                label="Display sprites information"
                checked={debugMode}
                onCheckedChange={setDebugMode}
            />
            
            <RpgCheckbox
                id="non-movable-cells"
                label="Display non-movable cells"
                checked={showNonMovableCells}
                onCheckedChange={setShowNonMovableCells}
            />
            
            <RpgCheckbox
                id="teleport-cells"
                label="Display teleport cells"
                checked={showTeleportCells}
                onCheckedChange={setShowTeleportCells}
            />
            
            <RpgCheckbox
                id="water-cells"
                label="Display water cells"
                checked={showWaterCells}
                onCheckedChange={setShowWaterCells}
            />
            
            <RpgCheckbox
                id="farmable-cells"
                label="Display farmable cells"
                checked={showFarmableCells}
                onCheckedChange={setShowFarmableCells}
            />
            
            <RpgCheckbox
                id="display-grid"
                label="Display grid"
                checked={displayGrid}
                onCheckedChange={setDisplayGrid}
            />
            
            <RpgCheckbox
                id="display-large-items"
                label="Display large items"
                checked={displayLargeItems}
                onCheckedChange={setDisplayLargeItems}
            />

            <div style={{ marginTop: '12px', marginBottom: '8px' }}>
                <label htmlFor="weather-select" style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>Weather</label>
                <select
                    id="weather-select"
                    className="rpg-select"
                    value={weather}
                    onChange={(e) => setWeather(e.target.value as WeatherMode)}
                    style={{ width: '100%' }}
                >
                    {weatherOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            </div>
        </DraggableDialog>
    );
}
