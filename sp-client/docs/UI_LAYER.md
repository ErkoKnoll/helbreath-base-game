# UI Layer Developer Guide

The game client uses a **React-based UI layer** that sits alongside the Phaser canvas. The UI is rendered as standard HTML/CSS, while the game world is rendered by Phaser in a canvas element. This document describes the architecture, how React and Phaser communicate, and the benefits of this approach.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  App.tsx (React root)                                            │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  #game-container  (PhaserGame.tsx)                             ││
│  │  └── <canvas>  (Phaser renders here, e.g. 1024×576)           ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  React UI (HTML, native resolution)                          ││
│  │  • Dialogs (Controls, Map, Inventory, etc.)                   ││
│  │  • Overlays (MonsterHover, InventoryItemHover, AssetDebug)     ││
│  │  • All positioned via CSS (fixed/absolute)                  ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

- **Phaser canvas**: Fixed resolution (e.g. 1024×576). The canvas may be scaled via CSS to fit the viewport.
- **React UI**: Renders as HTML in the document. It uses the browser’s native resolution and is independent of the canvas resolution.

---

## Project Structure

```
sp-client/src/ui/
├── components/       # Reusable RPG themed UI primitives
│   ├── RpgButton.tsx
│   ├── RpgCheckbox.tsx
│   ├── RpgSlider.tsx
│   ├── RpgHorizontalSeparator.tsx
│   └── RpgVerticalSeparator.tsx
├── dialogs/          # Modal dialogs (draggable, stackable)
│   ├── DraggableDialog.tsx, HeadlessDraggableDialog.tsx
│   ├── ControlsDialog.tsx   # Main control panel (Map, Camera, Player, etc.)
│   ├── MapDialog.tsx, CameraDialog.tsx, MinimapDialog.tsx
│   ├── PlayerDialog.tsx, InventoryDialog.tsx, ItemDialog.tsx
│   ├── SoundDialog.tsx, MonsterDialog.tsx, NPCDialog.tsx
│   ├── EffectDialog.tsx, CastDialog.tsx
│   ├── DeathDialog.tsx, AboutDialog.tsx
│   └── ...
├── overlays/         # Hover overlays (positioned near cursor or entity)
│   ├── MonsterHoverOverlay.tsx
│   ├── InventoryItemHoverOverlay.tsx
│   └── AssetDebugOverlay.tsx
├── store/            # TanStack Store (one per dialog/overlay)
│   ├── PlayerDialog.store.ts, MapDialog.store.ts, ...
│   ├── MonsterHoverOverlay.store.ts, InventoryItemHoverOverlay.store.ts
│   └── App.store.ts
└── rpg-ui.css        # Shared RPG-style styling
```

---

## React ↔ Phaser Communication: EventBus

The UI and game logic communicate via a **Phaser EventEmitter** (`EventBus` in `game/EventBus.ts`). Events are defined in `constants/EventNames.ts`.

### Direction

| Direction | Prefix | Example |
|-----------|--------|---------|
| React → Phaser | `IN_UI_*` | `IN_UI_CHANGE_MOVEMENT_SPEED`, `IN_UI_CAST_SPELL` |
| Phaser → React | `OUT_UI_*` | `OUT_UI_HOVER_MONSTER`, `OUT_UI_GAME_STATS_UPDATE` |

### Flow Example: Monster Hover Overlay

1. **GameWorld** (Phaser) runs an interval (`setupCameraStatsUpdateInterval`). Each tick it:
   - Finds the monster under the pointer via `getMonsterUnderPointer()`
   - Converts monster anchor position to screen coordinates via `canvasToScreenPosition()`
   - Emits `OUT_UI_HOVER_MONSTER` with `MonsterHoverInfo` (name, hp, overlayScreenX/Y, etc.)

2. **MonsterHoverOverlay.store** subscribes to `OUT_UI_HOVER_MONSTER` and updates `monsterInfo`.

3. **MonsterHoverOverlay** component reads from the store and renders an HTML overlay at `overlayScreenX`, `overlayScreenY`.

4. When the user changes attack mode in the Player dialog, the store emits `IN_UI_CHANGE_ATTACK_MODE`. GameWorld listens and updates the player; the overlay store also listens to update the cursor (attack vs pointer).

### Flow Example: Player Controls

1. **PlayerDialog** (React) has sliders for movement speed, attack speed, etc. On change, it calls `setMovementSpeed(value)` from `PlayerDialog.store`.

2. **PlayerDialog.store** updates its state and emits `IN_UI_CHANGE_MOVEMENT_SPEED` via EventBus.

3. **GameWorld** listens to `IN_UI_CHANGE_MOVEMENT_SPEED` in `setupControlDialogEventListeners()` and calls `this.player.setMovementSpeed(sliderValue)` and `getGameStateManager(this.game).setMovementSpeed(sliderValue)`.

4. When the scene loads, GameWorld reads `playerDialogStore.state` and applies saved values to the player in `initializeGameObjects()`.

---

## How GameWorld Hooks Up the UI

`GameWorld.ts` is the main Phaser scene. It wires the UI in several ways:

### 1. Event Listeners (init)

In `init()`, GameWorld registers EventBus listeners for all `IN_UI_*` events it cares about:

- `setupControlDialogEventListeners()` — movement speed, attack speed, map change, logout, etc.
- `setupSoundDialogEventListeners()` — music volume, sound volume, play music
- `setupMapDialogEventListeners()` — map highlights, weather, debug toggles
- `setupSummonDialogEventListeners()` — summon monster/NPC
- `setupSpellRequestListener()` — `IN_UI_CAST_SPELL`
- `setupNPCEventListeners()`, `setupMonsterEventListeners()`, `setupLootEventListeners()`

### 2. Outbound Events (Phaser → React)

GameWorld emits `OUT_UI_*` events so the React layer can react:

- **`OUT_UI_GAME_STATS_UPDATE`** — FPS, camera position, player position (every 20ms)
- **`OUT_UI_HOVER_MONSTER`** — Monster under cursor (name, hp, stats, overlay position)
- **`OUT_UI_HOVER_GROUND_ITEM`** / **`OUT_UI_HOVER_GROUND_ITEM_INFO`** — Ground item under cursor
- **`OUT_MAP_LOADED`** — Map fully loaded (App opens Controls and Minimap dialogs)

### 3. Store Integration

GameWorld imports stores directly when it needs to read or apply UI state:

- `playerDialogStore` — Used in `initializeGameObjects()` to apply movement speed, attack speed, transparency, effects, etc.
- `mapDialogStore` — Used for weather when creating `WeatherManager`

### 4. Cursor and Overlay Handling

- GameWorld tracks `lastCursorPosition` (document coords) for `elementFromPoint` when the cursor is over DOM overlays (e.g. inventory). Phaser’s pointer can be stale in that case.
- Hover overlays only show when `elementFromPoint(checkX, checkY) === this.game.canvas`, so they don’t appear when the cursor is over a dialog.

---

## State Management: TanStack Store

Each dialog and overlay has its own store in `ui/store/`. Stores:

- Hold UI state (open/closed, slider values, etc.)
- Emit `IN_UI_*` events when the user changes something
- Subscribe to `OUT_UI_*` events to stay in sync with Phaser

Example: `PlayerDialog.store.ts` defines `setMovementSpeed(speed, notifyPhaser)`. When `notifyPhaser` is true, it emits `IN_UI_CHANGE_MOVEMENT_SPEED`. It also listens to `OUT_UI_SET_MOVEMENT_SPEED` to update its state when Phaser sends values back (e.g. on scene load).

---

## Overlays and Fullscreen

Hover overlays (`MonsterHoverOverlay`, `InventoryItemHoverOverlay`) use `createPortal` to render into:

- `document.fullscreenElement` when in fullscreen
- `document.body` otherwise

This keeps overlays visible and correctly layered when the game is fullscreen. They listen to `fullscreenchange` to switch the portal target.

---

## Benefits of Running the UI in React (HTML Layer)

### 1. Canvas-Resolution Independent

The Phaser canvas runs at a fixed resolution (e.g. 1024×576). The React UI renders as HTML at the browser’s native resolution. Text, icons, and layout stay sharp regardless of canvas resolution, which is especially useful on high-DPI displays.

### 2. Independent UI Scaling in Fullscreen

In fullscreen, the canvas is scaled via CSS. The UI is separate HTML and can be scaled independently using browser zoom (e.g. Ctrl/Cmd + Plus/Minus). Users can make dialogs and text larger without changing the game’s internal resolution.

### 3. Accessibility

HTML UI supports:

- Screen readers and assistive technologies
- Keyboard navigation
- Semantic markup (`<button>`, `<label>`, etc.)
- ARIA attributes
- High-contrast and user font-size preferences

The project uses Radix UI for accessible primitives where applicable.

### 4. Easier Testing

Because the UI is HTML:

- **Playwright**, **Cypress**, and similar tools can target elements by role, text, or test IDs
- No need to simulate canvas coordinates or game-engine input
- Standard DOM queries and assertions work as in any web app

### 5. Richer Ecosystem and Simpler UI Development

- Use standard React components, CSS, and layout (flexbox, grid)
- Integrate libraries (Radix UI, @dnd-kit for drag-and-drop, etc.)
- Avoid reimplementing complex widgets in the game engine
- Faster iteration with hot reload and familiar tooling

### 6. Reduced Obstruction in Non-Fullscreen Mode

Dialogs are positioned with `position: fixed` and can be placed outside the canvas. In windowed mode, users can move panels (e.g. inventory, minimap) to the side of the game window, reducing overlap with the game view.

### 7. Potential for Multi-Monitor / Multi-Tab Layouts

In theory, parts of the UI could be rendered in a separate browser tab or window (e.g. via `window.open` or a second route). That would allow:

- Game canvas on one monitor
- Inventory, map, or chat on another

The EventBus and stores could be shared or synchronized across tabs to support such layouts.

---

## Adding a New Dialog

1. Create a store in `ui/store/` (e.g. `MyDialog.store.ts`) with `isOpen` and any dialog-specific state.
2. Create the dialog component in `ui/dialogs/` using `DraggableDialog` or `HeadlessDraggableDialog`.
3. In `App.tsx`, add state for position and z-index, subscribe to the store’s `isOpen`, and render the dialog conditionally.
4. Add EventBus listeners in GameWorld (or other scenes) for any `IN_UI_*` events the dialog emits.
5. If the dialog needs data from Phaser, add `OUT_UI_*` events and subscribe in the store.

---

## Adding a New Overlay

1. Create a store in `ui/store/` that subscribes to the relevant `OUT_UI_*` events.
2. Create the overlay component that reads from the store and renders with `position: fixed`.
3. Use `createPortal` if the overlay must render into `document.fullscreenElement` when in fullscreen.
4. Add the overlay component to `App.tsx` (no position state needed if it’s cursor- or entity-positioned).

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `App.tsx` | Mounts PhaserGame + all dialogs/overlays, manages positions and z-index |
| `PhaserGame.tsx` | Renders `#game-container`, bootstraps Phaser |
| `game/EventBus.ts` | Phaser EventEmitter for React ↔ Phaser events |
| `constants/EventNames.ts` | All `IN_UI_*` and `OUT_UI_*` event names |
| `game/scenes/GameWorld.ts` | Main scene; registers EventBus listeners, emits outbound events |
| `ui/rpg-ui.css` | Shared RPG-style CSS variables and classes |
