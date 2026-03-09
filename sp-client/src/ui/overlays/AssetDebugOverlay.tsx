import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@tanstack/react-store';
import { assetDebugOverlayStore } from '../store/AssetDebugOverlay.store';

export function AssetDebugOverlay() {
    const debugInfo = useStore(assetDebugOverlayStore, (state) => state.debugInfo);
    const [portalTarget, setPortalTarget] = useState<HTMLElement | undefined>(undefined);

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

    if (!debugInfo || !portalTarget) {
        return null;
    }

    const dialog = (
        <div
            style={{
                position: 'fixed',
                left: `${debugInfo.mouseX + 15}px`,
                top: `${debugInfo.mouseY + 20}px`,
                pointerEvents: 'none',
                zIndex: 20001,
                background: 'linear-gradient(135deg, rgba(74, 44, 26, 0.98) 0%, rgba(45, 24, 16, 0.98) 100%)',
                border: '2px solid var(--rpg-leather)',
                borderRadius: '6px',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.6), inset 0 1px 0 rgba(212, 175, 55, 0.2)',
                padding: '0',
                userSelect: 'none',
            }}
        >
            <div
                style={{
                    padding: '4px 8px',
                    background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.3) 0%, rgba(212, 175, 55, 0.1) 100%)',
                    borderBottom: '1px solid var(--rpg-leather)',
                    borderRadius: '4px 4px 0 0',
                    textAlign: 'center',
                }}
            >
                <span
                    style={{
                        color: 'var(--rpg-gold)',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        fontFamily: 'Georgia, serif',
                        textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)',
                    }}
                >
                    Asset Info
                </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px 12px' }}>
                <div className="rpg-stat-item">
                    <span className="rpg-stat-label">Sprite name:</span>
                    <span className="rpg-stat-value">{debugInfo.spriteName}</span>
                </div>
                <div className="rpg-stat-item">
                    <span className="rpg-stat-label">Sprite frame:</span>
                    <span className="rpg-stat-value">{debugInfo.frame}</span>
                </div>
                <div className="rpg-stat-item">
                    <span className="rpg-stat-label">Sprite pivot:</span>
                    <span className="rpg-stat-value">
                        {debugInfo.hasPivot ? `${debugInfo.pivotX}, ${debugInfo.pivotY}` : '<missing>'}
                    </span>
                </div>
                {debugInfo.spriteSheetIndex !== undefined && (
                    <div className="rpg-stat-item">
                        <span className="rpg-stat-label">Sprite sheet:</span>
                        <span className="rpg-stat-value">{debugInfo.spriteSheetIndex}</span>
                    </div>
                )}
                <div className="rpg-stat-item">
                    <span className="rpg-stat-label">Scene pos:</span>
                    <span className="rpg-stat-value">{Math.round(debugInfo.posX)}, {Math.round(debugInfo.posY)}</span>
                </div>
                <div className="rpg-stat-item">
                    <span className="rpg-stat-label">World pos:</span>
                    <span className="rpg-stat-value">{debugInfo.worldX}, {debugInfo.worldY}</span>
                </div>
                <div className="rpg-stat-item">
                    <span className="rpg-stat-label">Sprite depth:</span>
                    <span className="rpg-stat-value">{debugInfo.depth}</span>
                </div>
            </div>
        </div>
    );

    return createPortal(dialog, portalTarget);
}
