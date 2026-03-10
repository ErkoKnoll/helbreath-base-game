import { useEffect, useRef } from 'react';
import { useStore } from '@tanstack/react-store';
import { DraggableDialog } from './DraggableDialog';
import { RpgButton } from '../components/RpgButton';
import { RpgCheckbox } from '../components/RpgCheckbox';
import { RpgHorizontalSeparator } from '../components/RpgHorizontalSeparator';
import { RpgSlider } from '../components/RpgSlider';
import { EventBus } from '../../game/EventBus';
import { convertPixelPosToWorldPos } from '../../utils/CoordinateUtils';
import { cameraDialogStore, setCameraZoom, setFollowPlayer, setCameraShake, setPostProcessing } from '../store/CameraDialog.store';
import { IN_UI_CAMERA_MOVE_UP, IN_UI_CAMERA_MOVE_DOWN, IN_UI_CAMERA_MOVE_LEFT, IN_UI_CAMERA_MOVE_RIGHT } from '../../constants/EventNames';

interface CameraDialogProps {
    position: { x: number; y: number };
    onClose: () => void;
    zIndex?: number;
    onBringToFront?: () => void;
}

export function CameraDialog({
    position,
    onClose,
    zIndex,
    onBringToFront,
}: CameraDialogProps) {
    const zoomLevel = useStore(cameraDialogStore, (state) => state.cameraZoom);
    const fps = useStore(cameraDialogStore, (state) => state.fps);
    const cameraPosition = useStore(cameraDialogStore, (state) => state.cameraPosition);
    const playerPosition = useStore(cameraDialogStore, (state) => state.playerPosition);
    const cursorPosition = useStore(cameraDialogStore, (state) => state.cursorPosition);
    const followPlayer = useStore(cameraDialogStore, (state) => state.followPlayer);
    const cameraShake = useStore(cameraDialogStore, (state) => state.cameraShake);
    const postProcessing = useStore(cameraDialogStore, (state) => state.postProcessing);

    // Camera movement handlers with continuous scrolling support
    const cameraIntervalRef = useRef<number | undefined>(undefined);
    
    const startCameraMovement = (direction: string) => {
        // Emit immediately on press
        EventBus.emit(direction);
        
        // Clear any existing interval
        if (cameraIntervalRef.current) {
            clearInterval(cameraIntervalRef.current);
        }
        
        // Start continuous movement
        cameraIntervalRef.current = window.setInterval(() => {
            EventBus.emit(direction);
        }, 50); // Move every 50ms for smooth scrolling
    };
    
    const stopCameraMovement = () => {
        if (cameraIntervalRef.current) {
            clearInterval(cameraIntervalRef.current);
            cameraIntervalRef.current = undefined;
        }
    };
    
    // Clean up interval on unmount
    useEffect(() => {
        return () => {
            if (cameraIntervalRef.current) {
                clearInterval(cameraIntervalRef.current);
            }
        };
    }, []);

    const handleFollowPlayerChange = (checked: boolean) => {
        setFollowPlayer(checked);
    };

    const handleCameraShakeChange = (checked: boolean) => {
        setCameraShake(checked);
    };

    const handleZoomLevelChange = (zoom: number) => {
        setCameraZoom(zoom);
    };

    const handleZoomReset = () => {
        handleZoomLevelChange(100);
    };

    const handlePostProcessingChange = (value: string) => {
        switch (value) {
            case 'none':
            case 'fxaa':
                setPostProcessing(value);
                break;
        }
    };

    return (
        <DraggableDialog 
            title="Camera" 
            position={position} 
            id="camera-dialog"
            zIndex={zIndex}
            onBringToFront={onBringToFront}
            onContextMenu={(e) => {
                e.preventDefault();
                onClose();
            }}
        >
            <div style={{ minWidth: '240px' }}>
                <div className="rpg-stats">
                <div className="rpg-stat-item">
                    <span className="rpg-stat-label">FPS:</span>
                    <span className="rpg-stat-value">{fps}</span>
                </div>
                <div className="rpg-stat-item">
                    <span className="rpg-stat-label">Camera scene pos:</span>
                    <span className="rpg-stat-value">{cameraPosition.x}, {cameraPosition.y}</span>
                </div>
                <div className="rpg-stat-item">
                    <span className="rpg-stat-label">Camera world pos:</span>
                    <span className="rpg-stat-value">{convertPixelPosToWorldPos(cameraPosition.x)}, {convertPixelPosToWorldPos(cameraPosition.y)}</span>
                </div>
                <div className="rpg-stat-item">
                    <span className="rpg-stat-label">Cursor scene pos:</span>
                    <span className="rpg-stat-value">
                        {cursorPosition ? `${Math.round(cursorPosition.sceneX)}, ${Math.round(cursorPosition.sceneY)}` : 'N/A'}
                    </span>
                </div>
                <div className="rpg-stat-item">
                    <span className="rpg-stat-label">Cursor world pos:</span>
                    <span className="rpg-stat-value">
                        {cursorPosition ? `${cursorPosition.worldX}, ${cursorPosition.worldY}` : 'N/A'}
                    </span>
                </div>
                <div className="rpg-stat-item">
                    <span className="rpg-stat-label">Player scene pos:</span>
                    <span className="rpg-stat-value">
                        {(playerPosition.sceneX !== undefined && playerPosition.sceneY !== undefined) 
                            ? `${playerPosition.sceneX}, ${playerPosition.sceneY}` 
                            : 'N/A'}
                    </span>
                </div>
                <div className="rpg-stat-item">
                    <span className="rpg-stat-label">Player world pos:</span>
                    <span className="rpg-stat-value">
                        {(playerPosition.worldX !== undefined && playerPosition.worldY !== undefined) 
                            ? `${playerPosition.worldX}, ${playerPosition.worldY}` 
                            : 'N/A'}
                    </span>
                </div>
            </div>
            
            <RpgHorizontalSeparator />
            
            <div className="rpg-section-title">Camera Movement</div>
            <div>
                <div className="rpg-control-grid">
                    <div></div>
                    <RpgButton
                        onPointerDown={() => startCameraMovement(IN_UI_CAMERA_MOVE_UP)}
                        onPointerUp={stopCameraMovement}
                        onPointerLeave={stopCameraMovement}
                        style={{ 
                            padding: '8px',
                            fontSize: '16px',
                            minWidth: '40px',
                            height: '40px',
                            userSelect: 'none'
                        }}
                        title="Hold to move camera up"
                    >
                        ▲
                    </RpgButton>
                    <div></div>
                    <RpgButton
                        onPointerDown={() => startCameraMovement(IN_UI_CAMERA_MOVE_LEFT)}
                        onPointerUp={stopCameraMovement}
                        onPointerLeave={stopCameraMovement}
                        style={{ 
                            padding: '8px',
                            fontSize: '16px',
                            minWidth: '40px',
                            height: '40px',
                            userSelect: 'none'
                        }}
                        title="Hold to move camera left"
                    >
                        ◀
                    </RpgButton>
                    <div></div>
                    <RpgButton
                        onPointerDown={() => startCameraMovement(IN_UI_CAMERA_MOVE_RIGHT)}
                        onPointerUp={stopCameraMovement}
                        onPointerLeave={stopCameraMovement}
                        style={{ 
                            padding: '8px',
                            fontSize: '16px',
                            minWidth: '40px',
                            height: '40px',
                            userSelect: 'none'
                        }}
                        title="Hold to move camera right"
                    >
                        ▶
                    </RpgButton>
                    <div></div>
                    <RpgButton
                        onPointerDown={() => startCameraMovement(IN_UI_CAMERA_MOVE_DOWN)}
                        onPointerUp={stopCameraMovement}
                        onPointerLeave={stopCameraMovement}
                        style={{ 
                            padding: '8px',
                            fontSize: '16px',
                            minWidth: '40px',
                            height: '40px',
                            userSelect: 'none'
                        }}
                        title="Hold to move camera down"
                    >
                        ▼
                    </RpgButton>
                    <div></div>
                </div>
            </div>
            
            <RpgCheckbox
                id="follow-player"
                label="Follow player"
                checked={followPlayer}
                onCheckedChange={handleFollowPlayerChange}
            />
            
            <RpgCheckbox
                id="camera-shake"
                label="Camera shake"
                checked={cameraShake}
                onCheckedChange={handleCameraShakeChange}
            />
            
            <RpgHorizontalSeparator />
            
            <div className="rpg-section-title">Post processing</div>
            <div style={{ marginBottom: '12px' }}>
                <select
                    id="post-processing-select"
                    className="rpg-select"
                    value={postProcessing}
                    onChange={(e) => handlePostProcessingChange(e.target.value)}
                    style={{ width: '100%' }}
                >
                    <option value="none">None</option>
                    <option value="fxaa">FXAA</option>
                </select>
            </div>
            
            <RpgHorizontalSeparator />
            
            <div className="rpg-section-title">Camera Zoom: {zoomLevel}%</div>
            <div className="rpg-zoom-container">
                <RpgSlider
                    value={[zoomLevel]}
                    onValueChange={(value) => {
                        handleZoomLevelChange(value[0]);
                    }}
                    min={20}
                    max={200}
                    step={10}
                />
                <RpgButton
                    onClick={handleZoomReset}
                    style={{ 
                        padding: '8px 12px',
                        fontSize: '14px',
                    }}
                >
                    Reset Zoom
                </RpgButton>
            </div>
            </div>
        </DraggableDialog>
    );
}
