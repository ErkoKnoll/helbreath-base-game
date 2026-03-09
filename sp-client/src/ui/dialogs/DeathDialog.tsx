import { HeadlessDraggableDialog } from './HeadlessDraggableDialog';
import { RpgButton } from '../components/RpgButton';
import { EventBus } from '../../game/EventBus';
import { IN_UI_PLAYER_RESURRECT } from '../../constants/EventNames';
import { setDeathDialogOpen } from '../store/DeathDialog.store';

interface DeathDialogProps {
    position: { x: number; y: number };
    zIndex?: number;
    onBringToFront?: () => void;
}

export function DeathDialog({
    position,
    zIndex,
    onBringToFront,
}: DeathDialogProps) {
    const handleResurrect = () => {
        EventBus.emit(IN_UI_PLAYER_RESURRECT);
        setDeathDialogOpen(false);
    };

    return (
        <HeadlessDraggableDialog
            position={position}
            id="death-dialog"
            zIndex={zIndex}
            onBringToFront={onBringToFront}
            onContextMenu={(e) => e.preventDefault()}
        >
            <div style={{
                color: 'var(--rpg-parchment)',
                fontFamily: 'Georgia, serif',
                fontSize: '16px',
                lineHeight: '1.6',
                textAlign: 'center',
                padding: '16px',
            }}>
                <p style={{ margin: '0 0 16px 0' }}>
                    Oh blimey, you died!
                </p>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <RpgButton onClick={handleResurrect}>
                        Resurrect
                    </RpgButton>
                </div>
            </div>
        </HeadlessDraggableDialog>
    );
}
