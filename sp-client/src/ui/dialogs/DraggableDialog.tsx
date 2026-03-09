import { BaseDraggableDialog } from './HeadlessDraggableDialog';

interface DraggableDialogProps {
    children: React.ReactNode;
    title?: string;
    position: { x: number; y: number };
    id?: string;
    onContextMenu?: (e: React.MouseEvent) => void;
    zIndex?: number;
    onBringToFront?: () => void;
}

export function DraggableDialog({ children, title = 'Controls', position, id = 'draggable-dialog', onContextMenu, zIndex = 10000, onBringToFront }: DraggableDialogProps) {
    return (
        <BaseDraggableDialog
            position={position}
            id={id}
            onContextMenu={onContextMenu}
            zIndex={zIndex}
            onBringToFront={onBringToFront}
            cursor="default"
            renderHeader={(listeners, attributes, isDragging) => (
                <div
                    className="draggable-dialog-header"
                    {...listeners}
                    {...attributes}
                    style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
                >
                    {title}
                </div>
            )}
        >
            {children}
        </BaseDraggableDialog>
    );
}
