import { useEffect, useRef } from 'react';
import { useStore } from '@tanstack/react-store';
import { createPortal } from 'react-dom';
import { DraggableDialog } from './DraggableDialog';
import { RpgCheckbox } from '../components/RpgCheckbox';
import { RpgHorizontalSeparator } from '../components/RpgHorizontalSeparator';
import { RpgSlider } from '../components/RpgSlider';
import { soundDialogStore, setMusicVolume, setSoundVolume, setPlayMapMusic, setSelectedMusic, setShowTooltip, setTooltipPosition, setPortalTarget, muteAllSounds, unmuteAllSounds } from '../store/SoundDialog.store';

interface SoundDialogProps {
    position: { x: number; y: number };
    onClose: () => void;
    zIndex?: number;
    onBringToFront?: () => void;
}

// Available music files
const MUSIC_OPTIONS = [
    { value: 'default.mp3', label: 'Default' },
    { value: 'abaddon.mp3', label: 'Abaddon' },
    { value: 'apocalypse.mp3', label: 'Apocalypse' },
    { value: 'aresden.mp3', label: 'Aresden' },
    { value: 'dungeon.mp3', label: 'Dungeon' },
    { value: 'elvine.mp3', label: 'Elvine' },
    { value: 'middleland.mp3', label: 'Middleland' },
];

export function SoundDialog({
    position,
    onClose,
    zIndex,
    onBringToFront,
}: SoundDialogProps) {
    const musicVolume = useStore(soundDialogStore, (state) => state.musicVolume);
    const soundVolume = useStore(soundDialogStore, (state) => state.soundVolume);
    const playMapMusic = useStore(soundDialogStore, (state) => state.playMapMusic);
    const selectedMusic = useStore(soundDialogStore, (state) => state.selectedMusic);
    const showTooltip = useStore(soundDialogStore, (state) => state.showTooltip);
    const tooltipPosition = useStore(soundDialogStore, (state) => state.tooltipPosition);
    const portalTarget = useStore(soundDialogStore, (state) => state.portalTarget);
    
    // Track if sound slider is being dragged
    const isDraggingSoundSlider = useRef(false);

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

    const handleMouseEnter = (e: React.MouseEvent) => {
        setShowTooltip(true);
        setTooltipPosition({ x: e.clientX, y: e.clientY });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (showTooltip) {
            setTooltipPosition({ x: e.clientX, y: e.clientY });
        }
    };

    const handleMouseLeave = () => {
        setShowTooltip(false);
    };

    const handleMusicChange = (musicFile: string) => {
        setSelectedMusic(musicFile);
    };

    return (
        <DraggableDialog 
            title="Sound" 
            position={position} 
            id="sound-dialog"
            zIndex={zIndex}
            onBringToFront={onBringToFront}
            onContextMenu={(e) => {
                e.preventDefault();
                onClose();
            }}
        >
            <div style={{ marginBottom: '3px' }}>
                <div className="rpg-section-title" style={{ marginTop: '0px', marginBottom: '6px' }}>Music</div>
                <select
                    id="music-select"
                    className="rpg-select"
                    value={selectedMusic}
                    onChange={(e) => handleMusicChange(e.target.value)}
                    style={{ width: '100%' }}
                >
                    {MUSIC_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                            {option.label}
                        </option>
                    ))}
                </select>
            </div>
            
            <div
                onMouseEnter={handleMouseEnter}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                style={{ cursor: 'help', marginBottom: '3px' }}
            >
                <RpgCheckbox
                    id="play-map-music"
                    label="Play map music"
                    checked={playMapMusic}
                    onCheckedChange={setPlayMapMusic}
                />
            </div>
            
            <RpgHorizontalSeparator />
            
            <div className="rpg-section-title" style={{ marginTop: '6px', marginBottom: '0px' }}>Music volume</div>
            <div className="rpg-zoom-container">
                <RpgSlider
                    value={[musicVolume]}
                    onValueChange={(value) => {
                        // Update visual state only while dragging (don't notify Phaser)
                        setMusicVolume(value[0], false);
                    }}
                    onValueCommit={(value) => {
                        // Update and notify Phaser when slider is released
                        setMusicVolume(value[0], true);
                    }}
                    min={0}
                    max={100}
                    step={1}
                />
            </div>
            
            <RpgHorizontalSeparator />
            
            <div className="rpg-section-title" style={{ marginTop: '6px', marginBottom: '0px' }}>Sound volume</div>
            <div className="rpg-zoom-container">
                <RpgSlider
                    value={[soundVolume]}
                    onValueChange={(value) => {
                        // Mute all sounds when dragging starts
                        if (!isDraggingSoundSlider.current) {
                            isDraggingSoundSlider.current = true;
                            muteAllSounds();
                        }
                        // Update visual state only while dragging (don't notify Phaser)
                        setSoundVolume(value[0], false);
                    }}
                    onValueCommit={(value) => {
                        // Update and notify Phaser when slider is released
                        isDraggingSoundSlider.current = false;
                        setSoundVolume(value[0], true);
                        // Unmute all sounds with the new volume
                        unmuteAllSounds();
                    }}
                    min={0}
                    max={100}
                    step={1}
                />
            </div>
            
            {showTooltip && portalTarget && createPortal(
                <div
                    style={{
                        position: 'fixed',
                        left: `${tooltipPosition.x + 15}px`,
                        top: `${tooltipPosition.y + 20}px`,
                        pointerEvents: 'none',
                        zIndex: (zIndex || 10000) + 1,
                        background: 'linear-gradient(135deg, rgba(74, 44, 26, 0.98) 0%, rgba(45, 24, 16, 0.98) 100%)',
                        border: '2px solid var(--rpg-leather)',
                        borderRadius: '6px',
                        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(212, 175, 55, 0.2)',
                        padding: '8px 12px',
                        userSelect: 'none',
                        maxWidth: '250px',
                    }}
                >
                    <span
                        style={{
                            color: 'var(--rpg-gold)',
                            fontSize: '12px',
                            fontFamily: 'Georgia, serif',
                            textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)',
                            lineHeight: '1.4',
                        }}
                    >
                        Play map's default music on map change.
                    </span>
                </div>,
                portalTarget
            )}
        </DraggableDialog>
    );
}
