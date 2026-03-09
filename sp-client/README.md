# Helbreath single player base game

A Phaser 3 Helbreath single player client built with React, TypeScript, and Vite. This client supports custom sprite formats (.spr), Helbreath-style maps (.amd), and a full game loop including combat, spells, inventory, and spatial audio.

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| [TypeScript](https://www.typescriptlang.org) | Type-safe development |
| [Phaser 3](https://phaser.io) | Game engine and rendering |
| [React](https://react.dev) | UI layer |
| [Vite](https://vite.dev) | Build tooling and dev server |
| [Radix UI](https://www.radix-ui.com) | Accessible UI primitives |
| [TanStack Store](https://tanstack.com/store/latest) | Reactive state management |

**Prerequisites:** [Node.js](https://nodejs.org) (LTS recommended)

---

## Quick Start

This project uses `pnpm` by default; npm or yarn work as well.

```bash
cd sp-client
pnpm install
pnpm dev
```

The client runs at **http://localhost:8080**.

---

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start development server (localhost:8080) |
| `pnpm build` | Production build → output in `sp-client/dist` |
| `pnpm compress-assets` | Build `assets.zip` for faster loading (see [Asset Loading](#asset-loading)) |

---

## Project Structure

```
sp-client/src/
├── App.tsx              # Root React app, mounts Phaser + UI
├── Config.ts             # Game constants (speeds, depths, collision, etc.)
├── PhaserGame.tsx        # Phaser canvas wrapper and React bridge
├── Types.ts              # Shared type definitions
├── main.tsx              # React entry point
│
├── constants/            # Configuration and asset definitions
│   ├── Assets.ts         # Asset registry (sprites, maps, sounds)
│   ├── Effects.ts        # Visual effect definitions
│   ├── EventNames.ts     # IN_UI_*, OUT_UI_* event constants
│   ├── Items.ts          # Item definitions
│   ├── Maps.ts           # Map metadata and helpers
│   ├── Monsters.ts       # Monster definitions
│   ├── NPCs.ts           # NPC definitions
│   ├── RegistryKeys.ts   # Phaser registry keys
│   ├── SoundFileNames.ts # Audio file references
│   ├── Spells.ts         # Spell definitions
│   └── SpriteKeys.ts     # Sprite key constants
│
├── game/                 # Phaser game logic
│   ├── EventBus.ts       # Intra-Phaser event bus
│   ├── main.ts           # Phaser bootstrap
│   ├── assets/           # Custom asset loaders
│   │   ├── HBMap.ts      # .amd map format parser
│   │   └── HBSprite.ts   # .spr sprite format parser
│   ├── effects/          # Visual effects and projectiles
│   │   ├── Effect.ts, FloatingText.ts
│   │   ├── ArrowProjectile.ts, CriticalStrikeProjectile.ts
│   │   └── DirectionalProjectile.ts, StormBringerEffect.ts
│   ├── objects/          # Game entities
│   │   ├── GameObject.ts # Base class for all entities
│   │   ├── Player.ts, Monster.ts, NPC.ts
│   │   ├── GroundItem.ts # Dropped items
│   │   └── GameAsset.ts  # Base drawable game object
│   ├── scenes/
│   │   ├── Boot.ts       # Initial setup
│   │   ├── LoadingScreen.ts  # Asset loading (ZIP or per-file)
│   │   ├── LoginScreen.ts    # Character selection
│   │   └── GameWorld.ts  # Main game scene
│   └── spells/          # Spell implementations (FireBall, LightningBolt, etc.)
│
├── ui/                   # React UI layer
│   ├── components/       # Reusable Rpg* components (Button, Checkbox, Slider, etc.)
│   ├── dialogs/          # Modal dialogs (Inventory, Map, Monster, etc.)
│   ├── overlays/         # Hover overlays (Monster, InventoryItem, AssetDebug)
│   └── store/            # TanStack stores (one per dialog)
│
└── utils/                # Shared utilities
    ├── AnimationUtils.ts, CoordinateUtils.ts, EffectUtils.ts
    ├── CameraManager.ts, CastManager.ts, GameStateManager.ts
    ├── InputManager.ts, InventoryManager.ts, LootManager.ts
    ├── MapManager.ts, MusicManager.ts, ShadowManager.ts
    ├── SoundManager.ts, SoundTracker.ts, SpatialAudioUtils.ts
    ├── SpatialGrid.ts, SpriteUtils.ts
    ├── PlayerAppearanceManager.ts, WeatherManager.ts
    └── RegistryUtils.ts  # Phaser registry helpers
```

---

## Asset Loading

The client supports two loading modes:

| Mode | Use case | How to enable |
|------|----------|---------------|
| **Per-file** | Development, debugging, CDN limitations | Default. Set `IGNORE_ZIP_ASSETS: true` in `src/Config.ts` |
| **ZIP** | Production, slower networks | Set `IGNORE_ZIP_ASSETS: false` in `src/Config.ts`. Add `?ignoreZip=true` to the URL to bypass ZIP loading at runtime |

**Local development:** Per-file loading is recommended for local dev—set `IGNORE_ZIP_ASSETS` to `true` in `src/Config.ts`. It avoids decompression overhead and Phaser's native audio loading is faster when loading files directly.

**CDN limitations:** Some CDNs don't support large files (e.g. multi-megabyte `assets.zip`). Use per-file loading in those cases.

**Building `assets.zip`:** Run `pnpm compress-assets` from `sp-client`. Output: `sp-client/public/assets.zip`. If ZIP loading fails, the client falls back to per-file loading automatically.

---

## Dev Guides

See [ASSET_LOADING.md](./docs/ASSET_LOADING.md) for for how assets are loaded. For creating pre-generated minimap images, see [GENERATING_MINIMAP_SNAPSHOTS.md](./docs/GENERATING_MINIMAP_SNAPSHOTS.md). For how `.spr` sprite files are loaded and parsed, see [SPRITE_FILE_FORMAT.md](./docs/SPRITE_FILE_FORMAT.md). For how sprites render, animation types, and player appearance composition, see [ANIMATIONS_RENDERING.md](./docs/ANIMATIONS_RENDERING.md). For how maps are loaded and rendered (tiles, objects, sprite lookup), see [MAP_RENDERING.md](./docs/MAP_RENDERING.md). For how the grid-based movement system works (GameObject, Player, Monster, pathfinding, knockback, stunlock), see [MOVEMENT_SYSTEM.md](./docs/MOVEMENT_SYSTEM.md). For how the camera system works (follow, zoom, bounds, UI pan, camera shake), see [CAMERA_SYSTEM.md](./docs/CAMERA_SYSTEM.md). For how shadows are rendered beneath map objects, Player, and Monster (ShadowManager, position sync, animation), see [SHADOWS_RENDERING.md](./docs/SHADOWS_RENDERING.md). For how the audio system and spatial audio work (MusicManager, SoundManager, SoundTracker, SpatialAudioUtils), see [AUDIO_SYSTEM.md](./docs/AUDIO_SYSTEM.md). For the React UI layer architecture, EventBus communication with Phaser, and benefits of HTML-based UI, see [UI_LAYER.md](./docs/UI_LAYER.md). For how mouse input flows from InputManager to GameWorld and Player (movement, attack, pickup, spell targeting), see [INPUT_HANDLING.md](./docs/INPUT_HANDLING.md). For Player mechanics, state machine, combat, spell casting, and interaction with GameWorld and other objects, see [PLAYER_MECHANICS.md](./docs/PLAYER_MECHANICS.md). For Monster mechanics, AI behavior, combat, death/corpse, and interaction with GameWorld and Player, see [MONSTER_MECHANICS.md](./docs/MONSTER_MECHANICS.md). For inventory, bag, equipment, ground loot, and pickup/drop flow, see [INVENTORY_AND_LOOT_MECHANICS.md](./docs/INVENTORY_AND_LOOT_MECHANICS.md). For spells, effects, CastManager, and adding new spells or effects, see [SPELLS_AND_EFFECTS_MECHANICS.md](./docs/SPELLS_AND_EFFECTS_MECHANICS.md).

---

## Development Tips

- **Faster loading:** Comment out unused maps in `constants/Assets.ts` and monsters in `constants/Monsters.ts` so their assets are not loaded.
- **Local dev:** Set `IGNORE_ZIP_ASSETS` to `true` in `src/Config.ts` (or use `?ignoreZip=true`) for quicker iteration; per-file loading is often faster on localhost.
- **AI guidance:** Cursor rules live in `sp-client/.cursor/` and can be adapted for other AI tools.

---

## AI Assistance

Cursor-specific configuration is in `sp-client/.cursor/`. The rules cover:

- Code guidelines and patterns
- Sprites, assets, and map system
- UI layer (React ↔ Phaser via EventBus)
- Core systems (GameObject, managers, effects)

These files can be retrofitted for other AI coding assistants.

---

## Community Tools

| Tool | Description |
|------|-------------|
| [PAK Sprite Editor](https://helbreath.dev/sprite-editor/) | Web-based editor for exploring PAK files. Use `tools` scripts to extract `.spr` contents for this project. |
| [Map Editor](https://helbreath.dev/map-editor/) | Web-based editor for `.amd` Helbreath maps. |
| [Helbreath Hub](https://www.helbreathhub.com/downloads) | Additional community tools and resources. |

---

## Production Build

```bash
pnpm build
```

Output is in `sp-client/dist`. Host the contents on any static file server or CDN.
