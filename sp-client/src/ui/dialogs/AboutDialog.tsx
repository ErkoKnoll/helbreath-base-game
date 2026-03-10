import { DraggableDialog } from "./DraggableDialog";
import { RpgButton } from "../components/RpgButton";
import { VERSION_NUMBER } from "../../Config";

/** localStorage key for "About dialog dismissed" - versioned so users see the dialog again on upgrade */
export const ABOUT_DISMISSED_STORAGE_KEY = `aboutDismissed_v${VERSION_NUMBER}`;

interface AboutDialogProps {
    position: { x: number; y: number };
    onClose: () => void;
    zIndex?: number;
    onBringToFront?: () => void;
}

export function AboutDialog({
    position,
    onClose,
    zIndex,
    onBringToFront,
}: AboutDialogProps) {
    return (
        <DraggableDialog
            title="About"
            position={position}
            id="about-dialog"
            zIndex={zIndex}
            onBringToFront={onBringToFront}
            onContextMenu={(e) => {
                e.preventDefault();
                onClose();
            }}
        >
            <div
                style={{
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    minHeight: 0,
                    overflow: "hidden",
                }}
            >
                <div
                    className="about-dialog-scroll"
                    style={{
                        color: "var(--rpg-parchment)",
                        fontFamily: "Georgia, serif",
                        fontSize: "16px",
                        lineHeight: "1.6",
                        marginBottom: "16px",
                        overflowY: "auto",
                        flex: 1,
                        minHeight: 0,
                    }}
                >
                <p style={{ margin: "0" }}>
                    This is not a full Helbreath game client.
                </p>
                <p style={{ margin: "0" }}>
                    It is intended to be the base game client with functional assets and base mechanics to be extended from.
                </p>

                <h3 style={{ margin: "20px 0 8px 0", fontSize: "18px" }}>
                    Changelog
                </h3><p style={{ margin: "0 0 4px 0", fontWeight: "bold" }}>v 0.9</p>
                <ul style={{ margin: "0 0 12px 0", paddingLeft: "20px" }}>
                    <li>Added remaining misc items</li>
                    <li>Added FXAA post processing shader</li>
                </ul>
                <p style={{ margin: "0 0 4px 0", fontWeight: "bold" }}>v 0.8</p>
                <ul style={{ margin: "0 0 12px 0", paddingLeft: "20px" }}>
                    <li>Added footsteps</li>
                    <li>Added weather effects</li>
                    <li>Added dash attack and ghost effect support</li>
                    <li>Added player appearance customization options</li>
                </ul>
                <p style={{ margin: "0 0 4px 0", fontWeight: "bold" }}>v 0.7</p>
                <ul style={{ margin: "0 0 12px 0", paddingLeft: "20px" }}>
                    <li>Added support for dropping items</li>
                    <li>Added remaining equippable items (misc items yet to be added)</li>
                    <li>Added special weapon effects: Storm Bringer, star twinkle, glare, glow and tint effects some of which can also be applied at item creation time</li>
                    <li>Introduced transparency, chilled and berserked effects for player and monsters</li>
                    <li>Added correct Procella maps and unofficial HB Sleepy Hollow 6 map</li>
                    <li>Added bow attack support</li>
                </ul>
                <p style={{ margin: "0 0 4px 0", fontWeight: "bold" }}>v 0.6</p>
                <ul style={{ margin: "0 0 12px 0", paddingLeft: "20px" }}>
                    <li>Added inventory system and few items</li>
                </ul>
                <p style={{ margin: "0 0 4px 0", fontWeight: "bold" }}>v 0.5</p>
                <ul style={{ margin: "0 0 12px 0", paddingLeft: "20px" }}>
                    <li>Implemented pre-generated minimaps</li>
                    <li>Implemented following player states: peace/attack mode, walk/run mode, item pickup and bowing</li>
                    <li>Added support for summoning NPCs</li>
                </ul>
                <p style={{ margin: "0 0 4px 0", fontWeight: "bold" }}>v 0.4</p>
                <ul style={{ margin: "0 0 12px 0", paddingLeft: "20px" }}>
                    <li>Added damaging spells (without damaging effects)</li>
                </ul>
                <p style={{ margin: "0 0 4px 0", fontWeight: "bold" }}>v 0.3</p>
                <ul style={{ margin: "0 0 12px 0", paddingLeft: "20px" }}>
                    <li>Added effects</li>
                </ul>
                <p style={{ margin: "0 0 4px 0", fontWeight: "bold" }}>v 0.2</p>
                <ul style={{ margin: "0 0 12px 0", paddingLeft: "20px" }}>
                    <li>Added monsters with basic AI capabilities</li>
                    <li>Added basic melee combat system</li>
                </ul>
                </div>

                <div style={{ display: "flex", justifyContent: "center", flexShrink: 0, paddingTop: "12px" }}>
                <RpgButton onClick={onClose} style={{ width: "120px" }}>
                    Got it
                </RpgButton>
                </div>
            </div>
        </DraggableDialog>
    );
}

