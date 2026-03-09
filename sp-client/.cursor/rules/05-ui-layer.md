# UI Layer

React UI, stores, React ↔ Phaser via EventBus. See `01-code-guidelines.md` for React ↔ Phaser sync pattern. For details: [UI_LAYER](../../docs/UI_LAYER.md).

## Pattern

**React→Phaser:** Store setter emits `IN_UI_*` after `setState`. **Phaser→React:** Phaser emits `OUT_UI_*`; store listens at module level, calls setter with `notifyPhaser: false`. All events in `EventNames.ts`.

## Components

**Rpg components:** `ui/components/` – RpgButton, RpgCheckbox, RpgSlider, RpgVerticalSeparator, RpgHorizontalSeparator. **Dialogs:** `ui/dialogs/` – ControlsDialog, CameraDialog, MapDialog, SoundDialog, MinimapDialog, MonsterDialog (includes summon), PlayerDialog, AboutDialog, DeathDialog, CastDialog, EffectDialog, ItemDialog, InventoryDialog, NPCDialog. **Overlays:** `ui/overlays/` – AssetDebugOverlay, MonsterHoverOverlay, InventoryItemHoverOverlay. **Wrappers:** DraggableDialog, HeadlessDraggableDialog.

**Stores:** `ui/store/` – one per dialog. Pattern: `setX(value, notifyPhaser=true)`.

## Key Features

Camera: directional buttons, zoom slider, follow player. Map: render toggles, cell highlights, grid, debug. Sound: music/sound volumes. Minimap: resize, player dot, click-to-teleport (debug). MonsterDialog: summon monsters, attack type, kill all. PlayerDialog: attack speed/range, cast speed, appearance. DeathDialog: player death, resurrect. CastDialog: spell casting. EffectDialog: effect toggles. ItemDialog: create items, effects. InventoryDialog: bag, equipment. NPCDialog: summon NPCs. MonsterHoverOverlay: monster stats on hover. InventoryItemHoverOverlay: item info on hover. AssetDebugOverlay: sprite frame debug info.

## Styling

Theme vars in `public/style.css`. Component styles in `src/ui/rpg-ui.css`. Typography: Georgia.

## Cleanup

`useEffect` return must call `EventBus.off()` for listeners.
