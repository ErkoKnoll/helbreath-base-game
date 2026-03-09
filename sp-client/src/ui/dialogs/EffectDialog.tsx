import { useStore } from '@tanstack/react-store';
import { DraggableDialog } from './DraggableDialog';
import { RpgButton } from '../components/RpgButton';
import { RpgCheckbox } from '../components/RpgCheckbox';
import { effectDialogStore, setSelectedEffect, setInfiniteLoop, castEffect, killAllEffects, setEffectDialogOpen } from '../store/EffectDialog.store';
import { EFFECTS } from '../../constants/Effects';

interface EffectDialogProps {
    position: { x: number; y: number };
    zIndex?: number;
    onBringToFront?: () => void;
}

export function EffectDialog({
    position,
    zIndex,
    onBringToFront,
}: EffectDialogProps) {
    const selectedEffect = useStore(effectDialogStore, (state) => state.selectedEffect);
    const infiniteLoop = useStore(effectDialogStore, (state) => state.infiniteLoop);

    const handleCast = () => {
        castEffect();
    };

    return (
        <DraggableDialog
            title="Cast Effect"
            position={position}
            id="effect-dialog"
            zIndex={zIndex}
            onBringToFront={onBringToFront}
            onContextMenu={(e) => {
                e.preventDefault();
                setEffectDialogOpen(false);
            }}
        >
            <div style={{ display: 'flex', flexDirection: 'column', minHeight: 100 }}>
                <div style={{ marginBottom: '8px' }}>
                    <div className="rpg-section-title" style={{ marginBottom: '3px' }}>Effect</div>
                    <select
                        id="effect-select"
                        className="rpg-select"
                        value={selectedEffect}
                        onChange={(e) => setSelectedEffect(e.target.value)}
                        style={{ width: '100%' }}
                    >
                        {EFFECTS.map((effect) => (
                            <option key={effect.key} value={effect.key}>
                                {effect.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div style={{ marginBottom: '8px' }}>
                    <RpgCheckbox
                        id="effect-infinite-loop"
                        label="Repeat"
                        checked={infiniteLoop}
                        onCheckedChange={(checked) => setInfiniteLoop(checked === true)}
                    />
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '8px', flexDirection: 'column', gap: '8px' }}>
                    <RpgButton
                        onClick={handleCast}
                        style={{
                            padding: '8px 24px',
                            fontSize: '14px',
                            minWidth: '100px',
                        }}
                    >
                        Cast
                    </RpgButton>
                    <RpgButton
                        onClick={killAllEffects}
                        style={{
                            padding: '8px 24px',
                            fontSize: '14px',
                            minWidth: '100px',
                        }}
                    >
                        Kill all
                    </RpgButton>
                </div>
            </div>
        </DraggableDialog>
    );
}
