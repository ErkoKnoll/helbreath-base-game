import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '@tanstack/react-store';
import { inventoryItemHoverOverlayStore } from '../store/InventoryItemHoverOverlay.store';

export function InventoryItemHoverOverlay() {
    const hoverInfo = useStore(inventoryItemHoverOverlayStore, (state) => state.hoverInfo);
    const suppressOverlay = useStore(inventoryItemHoverOverlayStore, (state) => state.suppressOverlay);
    const [portalTarget, setPortalTarget] = useState<HTMLElement | undefined>(undefined);

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

    if (!hoverInfo || !portalTarget || suppressOverlay) {
        return null;
    }

    const opacity = hoverInfo.source === 'ground' ? 0.9 : 1;
    const overlay = (
        <div
            style={{
                position: 'fixed',
                left: `${hoverInfo.mouseX + 15}px`,
                top: `${hoverInfo.mouseY + 20}px`,
                pointerEvents: 'none',
                zIndex: 20002,
                opacity,
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
                    Item Info
                </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px 12px' }}>
                <div className="rpg-stat-item">
                    <span className="rpg-stat-label">Item name:</span>
                    <span className="rpg-stat-value">{hoverInfo.itemName}</span>
                </div>
                <div className="rpg-stat-item">
                    <span className="rpg-stat-label">Item type:</span>
                    <span className="rpg-stat-value">{hoverInfo.itemType}</span>
                </div>
                {hoverInfo.appearanceGlowColor !== undefined && (
                    <div className="rpg-stat-item">
                        <span className="rpg-stat-label">Appearance glow:</span>
                        <span className="rpg-stat-value" style={{ color: `#${hoverInfo.appearanceGlowColor.toString(16).padStart(6, '0')}` }}>
                            #{hoverInfo.appearanceGlowColor.toString(16).padStart(6, '0').toUpperCase()}
                        </span>
                    </div>
                )}
                {hoverInfo.appearanceGlareColor !== undefined && (
                    <div className="rpg-stat-item">
                        <span className="rpg-stat-label">Appearance glare:</span>
                        <span className="rpg-stat-value" style={{ color: `#${hoverInfo.appearanceGlareColor.toString(16).padStart(6, '0')}` }}>
                            #{hoverInfo.appearanceGlareColor.toString(16).padStart(6, '0').toUpperCase()}
                        </span>
                    </div>
                )}
                {hoverInfo.appearanceTintColor !== undefined && (
                    <div className="rpg-stat-item">
                        <span className="rpg-stat-label">Appearance tint:</span>
                        <span className="rpg-stat-value" style={{ color: `#${hoverInfo.appearanceTintColor.toString(16).padStart(6, '0')}` }}>
                            #{hoverInfo.appearanceTintColor.toString(16).padStart(6, '0').toUpperCase()}
                        </span>
                    </div>
                )}
                {hoverInfo.inventoryTintColor !== undefined && (
                    <div className="rpg-stat-item">
                        <span className="rpg-stat-label">Inventory tint:</span>
                        <span className="rpg-stat-value" style={{ color: `#${hoverInfo.inventoryTintColor.toString(16).padStart(6, '0')}` }}>
                            #{hoverInfo.inventoryTintColor.toString(16).padStart(6, '0').toUpperCase()}
                        </span>
                    </div>
                )}
                {hoverInfo.consumable && (
                    <div className="rpg-stat-item">
                        <span className="rpg-stat-label">Consumable:</span>
                        <span className="rpg-stat-value">true</span>
                    </div>
                )}
                {hoverInfo.stackable && (
                    <div className="rpg-stat-item">
                        <span className="rpg-stat-label">Quantity:</span>
                        <span className="rpg-stat-value">{hoverInfo.quantity ?? 1}</span>
                    </div>
                )}
                {hoverInfo.gender !== undefined && (
                    <div className="rpg-stat-item">
                        <span className="rpg-stat-label">Gender:</span>
                        <span className="rpg-stat-value">{hoverInfo.gender.charAt(0).toUpperCase() + hoverInfo.gender.slice(1)}</span>
                    </div>
                )}
                <div className="rpg-stat-item">
                    <span className="rpg-stat-label">Item ID:</span>
                    <span className="rpg-stat-value">{hoverInfo.itemId}</span>
                </div>
                <div className="rpg-stat-item">
                    <span className="rpg-stat-label">Item UID:</span>
                    <span className="rpg-stat-value">{hoverInfo.itemUid}</span>
                </div>
            </div>
        </div>
    );

    return createPortal(overlay, portalTarget);
}
