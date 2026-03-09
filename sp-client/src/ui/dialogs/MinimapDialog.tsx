import { useState, useEffect, useRef } from 'react';
import { useStore } from '@tanstack/react-store';
import { HeadlessDraggableDialog } from './HeadlessDraggableDialog';
import { cameraDialogStore } from '../store/CameraDialog.store';
import { minimapDialogStore } from '../store/MinimapDialog.store';
import { convertWorldPosToPixelPos } from '../../utils/CoordinateUtils';

interface MinimapDialogProps {
    position: { x: number; y: number };
    onClose: () => void;
    onPositionChange?: (position: { x: number; y: number }) => void;
    zIndex?: number;
    onBringToFront?: () => void;
}

type ResizeCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | undefined;

// Constants
const MIN_MINIMAP_SIZE = 200;
const MAX_VIEWPORT_RATIO = 0.9;
const DEFAULT_MINIMAP_SIZE = 300;
const RESIZE_HANDLE_SIZE = 20;
const PLAYER_DOT_SIZE = 8;
const PLAYER_DOT_BORDER = 2;

interface ResizeHandleConfig {
    corner: Exclude<ResizeCorner, undefined>;
    cursor: string;
    gradient: string;
    position: React.CSSProperties;
}

// Resize handle configurations
const RESIZE_HANDLES: ResizeHandleConfig[] = [
    {
        corner: 'top-left',
        cursor: 'nwse-resize',
        gradient: 'linear-gradient(135deg, #d4af37 0%, #d4af37 50%, transparent 50%, transparent 100%)',
        position: { top: 0, left: 0, borderTopLeftRadius: '4px' },
    },
    {
        corner: 'top-right',
        cursor: 'nesw-resize',
        gradient: 'linear-gradient(225deg, #d4af37 0%, #d4af37 50%, transparent 50%, transparent 100%)',
        position: { top: 0, right: 0, borderTopRightRadius: '4px' },
    },
    {
        corner: 'bottom-left',
        cursor: 'nesw-resize',
        gradient: 'linear-gradient(45deg, #d4af37 0%, #d4af37 50%, transparent 50%, transparent 100%)',
        position: { bottom: 0, left: 0, borderBottomLeftRadius: '4px' },
    },
    {
        corner: 'bottom-right',
        cursor: 'nwse-resize',
        gradient: 'linear-gradient(135deg, transparent 0%, transparent 50%, #d4af37 50%, #d4af37 100%)',
        position: { bottom: 0, right: 0, borderBottomRightRadius: '4px' },
    },
];

// Calculate size delta based on corner and mouse movement
function calculateSizeDelta(corner: Exclude<ResizeCorner, undefined>, deltaX: number, deltaY: number): number {
    switch (corner) {
        case 'bottom-right':
            return Math.max(deltaX, deltaY);
        case 'bottom-left':
            return Math.max(-deltaX, deltaY);
        case 'top-right':
            return Math.max(deltaX, -deltaY);
        case 'top-left':
            return Math.max(-deltaX, -deltaY);
    }
}

// Keep the opposite corner fixed (like bottom-right keeps top-left fixed)
// This gives consistent resize behavior: anchor stays put, size changes from the grabbed corner
function calculatePositionOffset(
    corner: Exclude<ResizeCorner, undefined>,
    sizeDelta: number
): { x: number; y: number } {
    switch (corner) {
        case 'top-left':
            return { x: -sizeDelta, y: -sizeDelta };
        case 'top-right':
            return { x: 0, y: -sizeDelta };
        case 'bottom-left':
            return { x: -sizeDelta, y: 0 };
        case 'bottom-right':
            return { x: 0, y: 0 };
    }
}

export function MinimapDialog({
    position,
    onClose,
    onPositionChange,
    zIndex,
    onBringToFront,
}: MinimapDialogProps) {
    const playerPosition = useStore(cameraDialogStore, (state) => state.playerPosition);
    const minimapImage = useStore(minimapDialogStore, (state) => state.minimapImage);
    const minimapScale = useStore(minimapDialogStore, (state) => state.minimapScale);
    const minimapOriginalSize = useStore(minimapDialogStore, (state) => state.minimapOriginalSize);
    const [minimapSize, setMinimapSize] = useState(DEFAULT_MINIMAP_SIZE);
    const [minimapPlayerDot, setMinimapPlayerDot] = useState<{ x: number; y: number } | undefined>(undefined);
    const [resizingCorner, setResizingCorner] = useState<ResizeCorner>(undefined);
    const resizeStartRef = useRef<{ 
        size: number; 
        currentSize: number;
        positionX: number; 
        positionY: number; 
        mouseX: number; 
        mouseY: number 
    } | undefined>(undefined);

    // Initialize minimap size when image loads
    useEffect(() => {
        if (minimapImage && minimapOriginalSize > 0) {
            setMinimapSize(Math.min(minimapOriginalSize, DEFAULT_MINIMAP_SIZE));
        }
    }, [minimapImage, minimapOriginalSize]);

    // Update player dot position on minimap when player position changes
    useEffect(() => {
        if (playerPosition.worldX === undefined || playerPosition.worldY === undefined || minimapScale <= 0) {
            setMinimapPlayerDot(undefined);
            return;
        }

        // Convert world coordinates (tiles) to pixel coordinates
        const playerPixelX = convertWorldPosToPixelPos(playerPosition.worldX);
        const playerPixelY = convertWorldPosToPixelPos(playerPosition.worldY);
        
        // Scale to minimap coordinates
        const minimapX = playerPixelX * minimapScale;
        const minimapY = playerPixelY * minimapScale;
        
        setMinimapPlayerDot({ x: minimapX, y: minimapY });
    }, [playerPosition.worldX, playerPosition.worldY, minimapScale]);

    const handleResizeStart = (corner: Exclude<ResizeCorner, undefined>) => (e: React.PointerEvent) => {
        // Only left mouse button - avoid conflict with right-click close
        if (e.button !== 0) {
            return;
        }

        // Stop pointer event propagation (like RpgButton) so dnd-kit drag doesn't activate
        e.stopPropagation();
        e.preventDefault();
        e.nativeEvent.stopImmediatePropagation();

        const target = e.currentTarget;
        target.setPointerCapture(e.pointerId);

        if (onBringToFront) {
            onBringToFront();
        }

        const startData = {
            size: minimapSize,
            currentSize: minimapSize,
            positionX: position.x,
            positionY: position.y,
            mouseX: e.clientX,
            mouseY: e.clientY,
        };
        resizeStartRef.current = startData;
        setResizingCorner(corner);

        const handlePointerMove = (ev: Event) => {
            if (!resizeStartRef.current) {
                return;
            }
            const pe = ev as PointerEvent;
            const deltaX = pe.clientX - resizeStartRef.current.mouseX;
            const deltaY = pe.clientY - resizeStartRef.current.mouseY;
            const sizeDelta = calculateSizeDelta(corner, deltaX, deltaY);
            const newSize = resizeStartRef.current.size + sizeDelta;
            const maxSize = Math.min(window.innerWidth * MAX_VIEWPORT_RATIO, window.innerHeight * MAX_VIEWPORT_RATIO);
            const clampedSize = Math.max(MIN_MINIMAP_SIZE, Math.min(newSize, maxSize));
            resizeStartRef.current.currentSize = clampedSize;
            setMinimapSize(clampedSize);

            // Update position during drag to keep opposite corner fixed (like bottom-right)
            if (corner !== 'bottom-right' && onPositionChange) {
                const sizeDelta = clampedSize - resizeStartRef.current.size;
                const offset = calculatePositionOffset(corner, sizeDelta);
                onPositionChange({
                    x: resizeStartRef.current.positionX + offset.x,
                    y: resizeStartRef.current.positionY + offset.y,
                });
            }
        };

        const handlePointerUp = () => {
            target.removeEventListener('pointermove', handlePointerMove);
            target.removeEventListener('pointerup', handlePointerUp);

            const data = resizeStartRef.current;
            if (data && onPositionChange) {
                const sizeDelta = data.currentSize - data.size;
                const offset = calculatePositionOffset(corner, sizeDelta);
                onPositionChange({
                    x: data.positionX + offset.x,
                    y: data.positionY + offset.y,
                });
            }

            setResizingCorner(undefined);
            resizeStartRef.current = undefined;
        };

        target.addEventListener('pointermove', handlePointerMove);
        target.addEventListener('pointerup', handlePointerUp);
    };

    const baseResizeHandleStyle: React.CSSProperties = {
        position: 'absolute',
        width: `${RESIZE_HANDLE_SIZE}px`,
        height: `${RESIZE_HANDLE_SIZE}px`,
        opacity: 0.7,
        transition: 'opacity 0.2s',
        zIndex: 10,
        pointerEvents: 'auto',
        touchAction: 'none',
        userSelect: 'none',
    };

    return (
        <HeadlessDraggableDialog 
            position={position} 
            id="minimap-dialog"
            disableDrag={resizingCorner !== undefined}
            zIndex={zIndex}
            onBringToFront={onBringToFront}
            onContextMenu={(e) => {
                e.preventDefault();
                onClose();
            }}
        >
            {minimapImage ? (
                <div 
                    style={{ 
                        position: 'relative', 
                        display: 'inline-block',
                        width: `${minimapSize}px`,
                        height: `${minimapSize}px`
                    }}
                    onPointerDown={() => {
                        if (onBringToFront) {
                            onBringToFront();
                        }
                    }}
                >
                    <img 
                        src={minimapImage} 
                        alt="Minimap"
                        style={{ 
                            imageRendering: 'pixelated',
                            display: 'block',
                            border: '2px solid #8b7355',
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain'
                        }}
                    />
                    {minimapPlayerDot && minimapOriginalSize > 0 && (
                        <div
                            style={{
                                position: 'absolute',
                                left: `${(minimapPlayerDot.x / minimapOriginalSize) * minimapSize}px`,
                                top: `${(minimapPlayerDot.y / minimapOriginalSize) * minimapSize}px`,
                                width: `${PLAYER_DOT_SIZE}px`,
                                height: `${PLAYER_DOT_SIZE}px`,
                                backgroundColor: '#4287f5',
                                borderRadius: '50%',
                                border: `${PLAYER_DOT_BORDER}px solid white`,
                                transform: 'translate(-50%, -50%)',
                                pointerEvents: 'none',
                                boxShadow: '0 0 4px rgba(66, 135, 245, 0.8)'
                            }}
                        />
                    )}
                    {/* Resize handles */}
                    {RESIZE_HANDLES.map(({ corner, cursor, gradient, position }) => (
                        <div
                            key={corner}
                            data-resize-handle
                            onPointerDown={handleResizeStart(corner)}
                            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
                            style={{
                                ...baseResizeHandleStyle,
                                ...position,
                                cursor,
                                background: gradient,
                            }}
                        />
                    ))}
                </div>
            ) : (
                <div style={{ padding: '20px', textAlign: 'center' }}>
                    Loading minimap...
                </div>
            )}
        </HeadlessDraggableDialog>
    );
}
