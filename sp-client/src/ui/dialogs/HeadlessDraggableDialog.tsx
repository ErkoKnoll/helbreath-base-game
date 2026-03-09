import { CSSProperties, useEffect, useState, useRef, useCallback, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

export interface BaseDraggableDialogProps {
    children: ReactNode;
    position: { x: number; y: number };
    id?: string;
    onContextMenu?: (e: React.MouseEvent) => void;
    disableDrag?: boolean;
    zIndex?: number;
    onBringToFront?: () => void;
    className?: string;
    cursor?: string;
    renderHeader?: (listeners: any, attributes: any, isDragging: boolean) => ReactNode;
}

export function BaseDraggableDialog({ 
    children, 
    position, 
    id = 'draggable-dialog', 
    onContextMenu, 
    disableDrag = false, 
    zIndex = 10000, 
    onBringToFront,
    className = 'draggable-dialog',
    cursor: customCursor,
    renderHeader
}: BaseDraggableDialogProps) {
    const [portalTarget, setPortalTarget] = useState<HTMLElement | undefined>(undefined);
    const dialogRef = useRef<HTMLDivElement | null>(null);
    const [maxHeight, setMaxHeight] = useState<number | undefined>(undefined);
    
    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id,
    });
    
    // Combine refs
    const setRefs = useCallback((node: HTMLDivElement | null) => {
        dialogRef.current = node;
        setNodeRef(node);
    }, [setNodeRef]);

    // Update portal target based on fullscreen state
    useEffect(() => {
        const updatePortalTarget = () => {
            const fullscreenElement = document.fullscreenElement;
            if (fullscreenElement instanceof HTMLElement) {
                setPortalTarget(fullscreenElement);
            } else {
                setPortalTarget(document.body);
            }
        };

        updatePortalTarget();

        document.addEventListener('fullscreenchange', updatePortalTarget);
        return () => {
            document.removeEventListener('fullscreenchange', updatePortalTarget);
        };
    }, []);

    // Calculate max height based on viewport
    useEffect(() => {
        const calculateMaxHeight = () => {
            const viewportHeight = window.innerHeight;
            // Account for transform if dialog is being dragged
            const currentTop = transform ? position.y + transform.y : position.y;
            const padding = 20; // Padding from viewport edges
            const calculatedMaxHeight = viewportHeight - currentTop - padding;
            setMaxHeight(Math.max(200, calculatedMaxHeight)); // Minimum height of 200px
        };

        calculateMaxHeight();
        window.addEventListener('resize', calculateMaxHeight);
        return () => {
            window.removeEventListener('resize', calculateMaxHeight);
        };
    }, [position.y, transform]);

    const defaultCursor = isDragging ? 'grabbing' : (disableDrag ? 'default' : 'grab');
    const cursor = customCursor ?? defaultCursor;

    const style: CSSProperties = {
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: transform ? CSS.Translate.toString(transform) : undefined,
        zIndex: zIndex,
        cursor: cursor,
        maxHeight: maxHeight ? `${maxHeight}px` : undefined,
        display: 'flex',
        flexDirection: 'column',
    };

    // If renderHeader is provided, drag listeners go on header only, not on main div
    // Otherwise, drag listeners go on main div (for headless dialogs)
    const shouldApplyDragToMainDiv = !renderHeader && !disableDrag;
    const dragListeners = shouldApplyDragToMainDiv ? listeners : {};
    const dragAttributes = shouldApplyDragToMainDiv ? attributes : {};

    const dialog = (
        <div
            ref={setRefs}
            style={style}
            className={className}
            data-dialog-id={id}
            data-dialog-width={dialogRef.current?.offsetWidth}
            data-dialog-height={dialogRef.current?.offsetHeight}
            onContextMenu={onContextMenu}
            onMouseDown={onBringToFront}
            {...dragListeners}
            {...dragAttributes}
        >
            {renderHeader && renderHeader(listeners, attributes, isDragging)}
            <div className="draggable-dialog-content">
                {children}
            </div>
        </div>
    );

    return portalTarget ? createPortal(dialog, portalTarget) : null;
}

interface HeadlessDraggableDialogProps {
    children: ReactNode;
    position: { x: number; y: number };
    id?: string;
    onContextMenu?: (e: React.MouseEvent) => void;
    disableDrag?: boolean;
    zIndex?: number;
    onBringToFront?: () => void;
}

export function HeadlessDraggableDialog(props: HeadlessDraggableDialogProps) {
    return (
        <BaseDraggableDialog
            {...props}
            id={props.id ?? 'headless-draggable-dialog'}
            className="draggable-dialog headless-draggable-dialog"
        />
    );
}
