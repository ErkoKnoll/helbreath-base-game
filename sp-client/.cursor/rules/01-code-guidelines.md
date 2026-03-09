# Code Guidelines

These are the coding standards and patterns for the MMORPG Base Game project. Follow these guidelines to ensure consistency and maintainability.

## Default Values

Do not use default values (e.g., `?? defaultValue`, optional parameters with fallbacks) unless explicitly requested. Prefer required parameters and explicit values at call sites.

## Preserving Intentional Changes

Do not overwrite or "correct" values that were changed after initial implementation. For example, if a user overwrote `projectileSpeed` for a spell from a generated default to a different value, that change is intentional. When adding similar features or refactoring, preserve existing values in the codebase rather than reverting them to what you might consider "correct" or "standard."

## Source of Truth

**Important**: Do not reference external C# or C++ codebases in code comments. When implementing features or fixing bugs, reference the source implementations within this codebase (TypeScript/JavaScript in `src/`). The TypeScript/JavaScript implementations are the authoritative source of truth for this project.

## Type Safety

Always use TypeScript interfaces or types to describe data structures, especially when working with:
- localStorage/sessionStorage data
- API responses
- Configuration objects
- Event payloads
- Any structured data that crosses boundaries (React ↔ Phaser, client ↔ server, etc.)

This ensures type safety, better IDE support, and prevents runtime errors from malformed data.

**Example:**
```typescript
// ✅ Good: Typed interface
interface GameState {
  worldX: number;
  worldY: number;
  mapName: string;
  movementSpeed: number;
}

const loadGameState = (): GameState => {
  const data = localStorage.getItem('gameState');
  return JSON.parse(data) as GameState;
};

// ❌ Bad: No type definition
const loadGameState = () => {
  const data = localStorage.getItem('gameState');
  return JSON.parse(data);
};
```

## Type Inference

Do not use explicit type annotations when TypeScript can infer the type automatically. Let TypeScript infer types from initializers, return statements, and context.

Only add explicit types when necessary for:
- Clarity at API boundaries
- When the inferred type would be incorrect
- Function parameters that cannot be inferred

**Examples:**
```typescript
// ✅ Good: Type inferred from initializer
const x = 5;
const name = 'Player';
const items = ['sword', 'shield'];

// ❌ Bad: Redundant type annotation
const x: number = 5;
const name: string = 'Player';
const items: string[] = ['sword', 'shield'];

// ✅ Good: Explicit type needed
const value: string = getValue(); // getValue() returns string | null

// ✅ Good: Parameter types required
function calculateDamage(base: number, multiplier: number): number {
  return base * multiplier;
}
```

## Switch vs If-Else for Multi-Way Branching

**Use switch statements over chained if or if-else statements** when branching on a single discriminant (e.g., `spellId`, `state`, `type`, `dialogId`, `slot`, `assetType`) with three or more mutually exclusive cases. Switch is clearer intent, easier to extend (add cases), and avoids repeated comparison of the same variable.

**Examples:**
```typescript
// ✅ Good: Single discriminant, multiple cases
switch (data.spellId) {
    case SPELL_EARTH_SHOCK_WAVE_ID:
        new EarthShockWave(this, ...);
        break;
    case SPELL_LIGHTNING_BOLT_ID:
        new LightningBolt(this, ...);
        break;
    default:
        this.createBlizzardSpell(...);
}

// ❌ Bad: If-else chain for same discriminant
if (data.spellId === SPELL_EARTH_SHOCK_WAVE_ID) {
    new EarthShockWave(this, ...);
} else if (data.spellId === SPELL_LIGHTNING_BOLT_ID) {
    new LightningBolt(this, ...);
} else {
    this.createBlizzardSpell(...);
}
```

**When to use if-else instead:** Different conditions, different variables, or only 1–2 branches.

## Control Flow Braces

Always use `{ }` blocks for `if`, `else`, `for`, `while`, and `do-while` bodies. Do not use shorthand single-statement form (e.g., `if (x) doSomething();`). Braces improve readability, make diffs cleaner, and reduce risk of bugs when adding statements later.

**Examples:**
```typescript
// ✅ Good: Always use braces
if (remove) {
    this.onDestroyRef = remove;
}
for (const item of items) {
    process(item);
}

// ❌ Bad: Shorthand without braces
if (remove) this.onDestroyRef = remove;
for (const item of items) process(item);
```

## Early Return Guards

When multiple consecutive conditions all trigger the same early return, merge them into a single `if` statement with OR conditions instead of separate blocks.

**Examples:**
```typescript
// ✅ Good: Single merged guard
if (monster.getIsDead() ||
    this.isAttacking() ||
    this.currentState === PlayerState.TakeDamage ||
    this.isStunlocked()) {
    return;
}

// ❌ Bad: Multiple separate guards
if (monster.getIsDead()) {
    return;
}
if (this.isAttacking()) {
    return;
}
if (this.currentState === PlayerState.TakeDamage) {
    return;
}
if (this.isStunlocked()) {
    return;
}
```

## Variable Inlining

When creating a variable or constant that is only used once, inline it directly in the usage. Only create intermediate variables when they improve readability:
- Reused multiple times
- Complex expressions that benefit from naming
- Variable name adds meaningful context

**Examples:**
```typescript
// ✅ Good: Inline single-use variable
if (getGameStateManager(this.game).getMovementSpeed() > 50) {
  // ...
}

// ❌ Bad: Unnecessary variable for single use
const movementSpeed = getGameStateManager(this.game).getMovementSpeed();
if (movementSpeed > 50) {
  // ...
}

// ✅ Good: Variable improves readability
const playerTilePosition = {
  x: convertPixelPosToWorldPos(this.player.getPixelX()),
  y: convertPixelPosToWorldPos(this.player.getPixelY())
};
this.camera.centerOn(playerTilePosition.x, playerTilePosition.y);

// ✅ Good: Variable reused multiple times
const gameState = getGameStateManager(this.game);
gameState.setWorldPos(x, y);
gameState.setMapName(mapName);
gameState.saveGameState();
```

## Missing Resource Handling

When looking up a resource that is expected to exist (e.g., a monster by ID, a map by name), prefer an explicit `if` check over null coalescing (`??`). If the resource is not found, do not perform the action and log a console warning about the unexpected outcome.

**Examples:**
```typescript
// ✅ Good: Explicit check, skip action and warn when resource missing
const monster = this.monsters.find(m => m.getMonsterId() === data.monsterId);
if (monster) {
    this.player.takeDamage(data.attackType, monster.getWorldX(), monster.getWorldY());
} else {
    console.warn(`[GameWorld] Monster ${data.monsterId} not found for attack hit, skipping`);
}

// ❌ Bad: Null coalescing hides missing resource, proceeds with fallback
const attackerX = monster?.getWorldX() ?? this.player.getWorldX();
```

## Null vs Undefined

Prefer using `undefined` over `null` for representing absent or uninitialized values. 

Only use `null` when both `null` and `undefined` need to be distinguished as separate meaningful states.

**Examples:**
```typescript
// ✅ Good: Use undefined for uninitialized
private destinationX: number | undefined;
private player: Player | undefined;

// ❌ Bad: Unnecessary use of null
private destinationX: number | null;

// ✅ Good: null and undefined have different meanings
interface ApiResponse {
  value: string | null | undefined;
  // null = explicitly set to empty
  // undefined = not set yet
}
```

## Class Method Visibility

Use the `public` keyword explicitly for class methods that are intended to be public. This makes the API surface clear and explicit, improving code readability and maintainability.

**Example:**
```typescript
// ✅ Good: Explicit public methods
class Player extends GameObject {
  public getWorldX(): number {
    return this.worldX;
  }
  
  public setDestination(x: number, y: number): void {
    this.destinationX = x;
    this.destinationY = y;
  }
  
  protected processMovement(): void {
    // Internal method
  }
  
  private updateInternalState(): void {
    // Private helper
  }
}
```

## Type Casts

Avoid using type casts (`as` or `<Type>`) unless there is no other option. Type casts bypass TypeScript's type checking and can hide bugs.

**Instead of casting:**
- Use type guards (`instanceof`, `typeof`) to narrow types safely
- Use union types and conditional checks
- Create helper functions that validate and return the correct type
- When working with third-party libraries that return `any`, document why the cast is necessary

**Only cast when:**
- Working with external libraries that return overly broad types (e.g., Phaser registry returns `any`)
- The type system cannot infer a type you know to be correct at runtime
- Using assertion syntax for creating partial objects

Always prefer runtime type validation over blind casts.

**Examples:**
```typescript
// ✅ Good: Use helper function with type safety
const map = getMap(scene, 'map-aresden');
// Helper function handles registry access internally

// ❌ Bad: Direct cast without validation
const map = scene.registry.get('map-aresden') as HBMap;

// ✅ Good: Type guard
function isPlayer(obj: GameObject): obj is Player {
  return obj instanceof Player;
}

if (isPlayer(gameObject)) {
  gameObject.setMovementSpeed(50); // TypeScript knows it's Player
}

// ✅ Good: Document necessary cast
// Phaser registry returns 'any', but we know the type from our storage pattern
const pivotData = scene.registry.get(`pivots-${spriteName}`) as PivotData[];
```

## Registry Access Pattern

Always use helper functions from `src/utils/RegistryUtils.ts` instead of direct registry access.

**Benefits:**
- Type safety without casts
- Centralized error handling
- Consistent API across codebase
- Easier to refactor if registry structure changes

**Examples:**
```typescript
// ✅ Good: Use helper functions
const map = getMap(scene, 'map-aresden');
const gameState = getGameStateManager(scene.game);
const musicMgr = getMusicManager(scene);
const pivotData = getPivotData(scene, textureKey, spriteName, false);

// ❌ Bad: Direct registry access
const map = scene.registry.get('map-aresden') as HBMap;
const gameState = scene.game.registry.get('gameStateManager') as GameStateManager;
```

## Event Naming Convention

Event names follow a strict prefix pattern (defined in `constants/EventNames.ts`):

- **`IN_UI_*`** - Events from React UI to Phaser (e.g., `IN_UI_CHANGE_MOVEMENT_SPEED`)
- **`OUT_UI_*`** - Events from Phaser to React UI (e.g., `OUT_UI_GAME_STATS_UPDATE`)
- **No prefix** - Intra-Phaser communication (e.g., `PLAYER_POSITION_CHANGED`)
- **Special cases:**
  - `IN_DEBUG_MODE_CHANGE` - Registry change events
  - `OUT_SPRITE_FRAME_EXTRACTED` - Asset processing events
  - `OUT_MAP_LOADED` - Scene lifecycle events

**Why this matters:**
- Clear directionality (IN = incoming to Phaser, OUT = outgoing from Phaser)
- Prevents naming collisions
- Makes event flow easy to trace
- Self-documenting code

**Examples:**
```typescript
// ✅ Good: Use constants from EventNames.ts
import { IN_UI_CHANGE_MOVEMENT_SPEED, OUT_UI_GAME_STATS_UPDATE } from './constants/EventNames';

EventBus.emit(IN_UI_CHANGE_MOVEMENT_SPEED, speed);
EventBus.on(OUT_UI_GAME_STATS_UPDATE, handleUpdate);

// ❌ Bad: Hardcoded strings
EventBus.emit('change-movement-speed', speed);
EventBus.on('game-stats-update', handleUpdate);
```

### Typed Event Payloads

Always use typed interfaces for EventBus event payloads. Define payload types in `src/Types.ts` (or a domain-specific types file). Use the same type for both emit and on/listener.

**Benefits:**
- Type safety at emit and receive sites
- Self-documenting—payload shape is explicit
- Catches missing or wrong properties at compile time
- Easier refactoring when payload changes

**Pattern:**
```typescript
// src/Types.ts
export interface MonsterAttackPlayerEvent {
  monsterId: number;
  attackType: AttackType;
}

// Emitter
EventBus.emit(MONSTER_ATTACK_HIT_PLAYER, { monsterId: this.monsterId, attackType: this.attackType } satisfies MonsterAttackPlayerEvent);

// Listener
EventBus.on(MONSTER_ATTACK_HIT_PLAYER, (data: MonsterAttackPlayerEvent) => {
  this.player.takeDamage(data.attackType);
});
```

### Intra-Phaser EventBus Communication

**Callbacks vs EventBus:**
- **Callbacks are allowed** when they don't introduce overly complicated references. When creating an object, prefer registering a callback in the constructor to listen for things that happen with that object.
- **Use EventBus** when callbacks cannot be created at constructor time, or when references would be too complicated to maintain—e.g., Player/Monster movement speed updates flowing from UI through GameStateManager to many objects.

**Avoid:** Direct object references or method calls between unrelated objects when EventBus or simple callbacks suffice.

**Why EventBus (when callbacks don't fit):**
- Decouples components (Monster doesn't need Player reference)
- Single source of truth (one emitter, multiple listeners)
- Easy to extend (add new listeners without modifying emitter)
- Consistent with React ↔ Phaser communication
- Clean lifecycle management (centralized event cleanup)

**Naming convention for intra-Phaser events:**
- Use **NO PREFIX** (not `IN_` or `OUT_`)
- Use `SCREAMING_SNAKE_CASE`
- Be descriptive and specific
- Examples: `PLAYER_POSITION_CHANGED`, `MONSTER_DIED`, `ITEM_PICKED_UP`

**Pattern:**
```typescript
// constants/EventNames.ts
export const PLAYER_POSITION_CHANGED = 'player-position-changed';

// Player.ts (emitter)
import { EventBus } from '../EventBus';
import { PLAYER_POSITION_CHANGED } from '../../constants/EventNames';

protected onPositionChanged(newX: number, newY: number): void {
  // Update internal state
  this.gameStateManager.setWorldPos(newX, newY);
  
  // Emit event for other game objects
  EventBus.emit(PLAYER_POSITION_CHANGED, { x: newX, y: newY });
}

// GameWorld.ts (listener setup)
private setupPlayerEventListeners(): void {
  EventBus.on(PLAYER_POSITION_CHANGED, (data: { x: number; y: number }) => {
    this.updateMonsterSpatialAudio(data.x, data.y);
  });
}

// GameWorld.ts (cleanup)
public shutdown(): void {
  EventBus.off(PLAYER_POSITION_CHANGED);
  // ... other cleanup
}

// Monster.ts (receives updates via GameWorld)
public updatePlayerPosition(playerX: number, playerY: number): void {
  // Store player coordinates (no direct Player reference needed)
  this.playerX = playerX;
  this.playerY = playerY;
  
  // Update spatial audio if currently moving
  if (this.currentState === MonsterState.Move) {
    const spatialConfig = calculateSpatialAudio({
      sourceX: this.worldX,
      sourceY: this.worldY,
      listenerX: playerX,
      listenerY: playerY,
    });
    this.soundTracker.setSpatialConfig(MonsterState.Move, spatialConfig);
  }
}
```

**✅ Good: EventBus-based communication**
```typescript
// Player emits position changes
EventBus.emit(PLAYER_POSITION_CHANGED, { x: newX, y: newY });

// GameWorld listens and updates monsters
EventBus.on(PLAYER_POSITION_CHANGED, (data) => {
  for (const monster of this.monsters) {
    monster.updatePlayerPosition(data.x, data.y);
  }
});
```

**❌ Bad: Direct callbacks**
```typescript
// Player stores callback
private onPositionChanged?: (x: number, y: number) => void;

public setOnPositionChanged(callback: (x: number, y: number) => void): void {
  this.onPositionChanged = callback;
}

// GameWorld sets up callback
this.player.setOnPositionChanged((x, y) => {
  this.updateMonsterSpatialAudio(x, y);
});
```

**❌ Bad: Direct object references**
```typescript
// Monster stores Player reference
private player: Player;

// Monster accesses Player directly
const playerX = this.player.getWorldX();
const playerY = this.player.getWorldY();
```

## Resource Cleanup Pattern

Always implement proper cleanup in `destroy()` or `shutdown()` methods to prevent memory leaks.

**Critical rules:**
1. Remove all EventBus listeners
2. Remove all Phaser registry listeners
3. Destroy all Phaser game objects (sprites, graphics, etc.)
4. Clear object references to prevent memory leaks
5. Call parent `destroy()` if extending a class

**Example:**
```typescript
class MyGameObject {
  private sprite: Phaser.GameObjects.Sprite;
  private eventHandler: () => void;
  private registryHandler: () => void;
  
  constructor(scene: Scene) {
    this.sprite = scene.add.sprite(0, 0, 'texture');
    
    this.eventHandler = () => { /* ... */ };
    EventBus.on('some-event', this.eventHandler);
    
    this.registryHandler = () => { /* ... */ };
    scene.registry.events.on('changedata', this.registryHandler);
  }
  
  destroy(): void {
    // 1. Remove EventBus listeners
    EventBus.off('some-event', this.eventHandler);
    
    // 2. Remove registry listeners
    this.scene.registry.events.off('changedata', this.registryHandler);
    
    // 3. Destroy Phaser objects
    this.sprite.destroy();
    
    // 4. Clear references
    this.sprite = undefined;
    this.eventHandler = undefined;
    this.registryHandler = undefined;
  }
}
```

## Pivot Offset Pattern

When rendering sprites with pivot points, always use `GameAsset` class instead of creating sprites manually.

**Why:**
- `GameAsset` automatically applies pivot offsets every frame
- Handles directional animations with frame ranges
- Supports debug visualization
- Manages shadows automatically (if enabled)

**Examples:**
```typescript
// ✅ Good: Use GameAsset for automatic pivot handling
const asset = new GameAsset(scene, {
  x,
  y,
  spriteName: 'wyvern',
  spriteSheetIndex: 0,
  direction: 0
});

// ❌ Bad: Manual sprite creation without pivot handling
const sprite = scene.add.sprite(x, y, 'texture');
```

## Coordinate Conversion Pattern

Always use conversion functions from `src/utils/CoordinateUtils.ts` instead of manual calculations.

**Why:**
- Centralized formula (easier to change if needed)
- `TILE_SIZE` constant ensures consistency
- Proper centering offset applied
- Type-safe and self-documenting

**Examples:**
```typescript
// ✅ Good: Use conversion functions
const pixelX = convertWorldPosToPixelPos(worldX);
const worldX = convertPixelPosToWorldPos(pixelX);

// ❌ Bad: Manual coordinate calculation
const pixelX = worldX * 32 + 16;
const worldX = Math.floor(pixelX / 32);
```

## Scene Transition Pattern

When transitioning between scenes, follow this pattern:

**Steps:**
1. Save game state to `GameStateManager`
2. Stop music/sounds to prevent overlap
3. Call `scene.start()` (automatically calls `shutdown()`)
4. New scene's `init()` will load saved state

**Example:**
```typescript
// ✅ Good: Save state, cleanup, then transition
const gameStateManager = getGameStateManager(this.game);
gameStateManager.setWorldPos(x, y);
gameStateManager.saveGameState();
getMusicManager(this).stopMusic();
this.scene.start('GameWorld');

// ❌ Bad: Direct scene.start() without cleanup
this.scene.start('GameWorld');
```

## React ↔ Phaser Synchronization

When creating UI controls that sync with Phaser state. For architecture details: [UI_LAYER](../../docs/UI_LAYER.md).

### React → Phaser Pattern
```typescript
// In store file (ui/store/MyStore.ts)
export const setValue = (value: number, notifyPhaser = true) => {
  myStore.setState((state) => ({ ...state, value }));
  if (notifyPhaser) {
    EventBus.emit(IN_UI_VALUE_CHANGED, value);
  }
};
```

### Phaser → React Pattern
```typescript
// In Phaser (typically GameStateManager constructor)
EventBus.emit(OUT_UI_SET_VALUE, initialValue);

// In store file (at module initialization level)
EventBus.on(OUT_UI_SET_VALUE, (value: number) => {
  setValue(value, false); // notifyPhaser=false prevents infinite loop
});
```

## Naming Conventions

### Files
- **Scenes**: PascalCase (e.g., `GameWorld.ts`, `LoadingScreen.ts`)
- **Classes**: PascalCase (e.g., `GameObject.ts`, `HBSprite.ts`)
- **Utilities**: PascalCase (e.g., `CoordinateUtils.ts`, `RegistryUtils.ts`)
- **Stores**: PascalCase with `.store.ts` suffix (e.g., `CameraDialog.store.ts`)
- **React components**: PascalCase (e.g., `RpgButton.tsx`, `MinimapDialog.tsx`)

### Variables & Functions
- **Variables**: camelCase (e.g., `movementSpeed`, `playerPosition`)
- **Constants**: SCREAMING_SNAKE_CASE (e.g., `TILE_SIZE`, `DEFAULT_MOVEMENT_SPEED`)
- **Functions**: camelCase (e.g., `convertWorldPosToPixelPos`, `getNextDirection`)
- **Event names**: SCREAMING_SNAKE_CASE with prefix (e.g., `IN_UI_CHANGE_MOVEMENT_SPEED`)

### Classes & Types
- **Classes**: PascalCase (e.g., `GameObject`, `HBMap`, `GameAsset`)
- **Interfaces**: PascalCase, no I prefix (e.g., `PlayerState`, `MapTile`)
- **Enums**: PascalCase (e.g., `Direction`, `SpriteType`, `GameObjectState`)

## Comments

### Classes and Utility Functions

**All classes and exported utility functions must have a JSDoc comment** describing what they are used for. Keep comments accurate and up to date with the logic—when behavior changes, update the comment.

- **Classes:** Add a class-level JSDoc above the class declaration (e.g., "Manages map loading, rendering, and minimap capture").
- **Utility functions:** Add a JSDoc above each exported function describing its purpose, parameters, and return value.
- **Accuracy:** If a comment describes behavior that no longer matches the code, fix the comment.

### When to Comment (Beyond Classes/Functions)

- Complex algorithms that aren't self-explanatory
- Why something is done (not what is done)
- Workarounds for library quirks
- Performance considerations
- Type cast justifications

### When Not to Comment

- Self-explanatory code
- Redundant descriptions of what code does
- Commented-out code (remove it)

**Examples:**
```typescript
// ✅ Good: Class has JSDoc describing purpose
/**
 * Manages map loading, rendering, and minimap capture.
 */
export class MapManager { ... }

// ✅ Good: Utility function has JSDoc
/**
 * Converts pixel coordinate to world coordinate based on tile size (32x32 pixels).
 * @param pixelCoordinate - Coordinate in pixels
 * @returns World coordinate
 */
export function convertPixelPosToWorldPos(pixelCoordinate: number): number { ... }

// ✅ Good: Explains why
// Use bitwise shift for optimized multiplication by 32 (2^5 = 32)
return worldCoordinate << 5;

// ✅ Good: Documents workaround
// Phaser registry returns 'any', cast is safe based on our storage pattern
const pivotData = scene.registry.get(key) as PivotData[];

// ❌ Bad: Redundant comment
// Set the movement speed to 50
this.movementSpeed = 50;

// ❌ Bad: Class or utility function without comment
export class SomeManager { ... }
export function doThing(x: number) { ... }
```

## Error Handling

- Use meaningful error messages
- Include context in error messages (e.g., which sprite failed to load)
- Throw errors for programming mistakes
- Warn for recoverable issues
- Handle errors at appropriate level

**Try-catch for fallible operations:** Wrap any action that can possibly fail (race conditions, external APIs, Phaser animation/texture lookups, async operations, etc.) in try-catch. In the catch block, log a warning with `console.warn` including the error and relevant debugging data (e.g., IDs, keys, parameters). This prevents crashes and aids diagnosis.

**Examples:**
```typescript
// ✅ Good: Meaningful error with context
if (!map) {
  throw new Error(`Map not found in registry: ${mapName}`);
}

// ✅ Good: Warning for recoverable issue
if (!texture.has(String(frameIndex))) {
  console.warn(`Frame ${frameIndex} not found in texture ${textureKey}, skipping`);
  return;
}

// ❌ Bad: Generic error
if (!map) {
  throw new Error('Map not found');
}

// ✅ Good: Try-catch for fallible operations (race conditions, external state)
try {
  this.shadowSprite.play({ key: shadowAnimationKey, frameRate: this.frameRate });
} catch (error) {
  console.warn('[ShadowManager] updateAnimation failed:', {
    error,
    shadowAnimationKey,
    shadowSpriteSheetIndex,
  });
}
```

## Performance Considerations

- Minimize work in `update()` loops
- Use object pooling for frequently created/destroyed objects
- Cache expensive calculations
- Batch operations when possible
- Use spatial grids for proximity queries
- **Separate static from dynamic rendering** - Draw static elements once, only update dynamic elements

**Example:**
```typescript
// ✅ Good: Cache calculation
private movementSpeedDurationMs: number;

setMovementSpeed(value: number): void {
  // Cache calculation instead of computing every frame
  this.movementSpeedDurationMs = 500 - (value / 100) * 400;
}

// ❌ Bad: Recalculate every frame
update(delta: number): void {
  const duration = 500 - (this.movementSpeed / 100) * 400;
  // ...
}
```

### Case Study: Map Cell Highlighting Optimization

**Problem:** Cell highlighting caused severe lag - redrawing thousands of graphics objects every frame.

**Root Cause:** Mixed static (non-movable cells from map data) with dynamic (occupied cells from game objects) rendering.

**Solution:** Separate static from dynamic rendering:
1. **Static cells** (3000+ red rectangles) - Draw once when enabled
2. **Dynamic cells** (~5 orange rectangles) - Redraw only on occupancy changes

**Result:** ~600x performance improvement (3005 → 5 graphics operations per movement)

**Key Lessons:**
- Profile before optimizing - identify what's actually slow
- Separate static from dynamic updates
- Only redraw what changes
- Categories matter: "non-movable" included both static (map) and dynamic (objects)
- Auto-refresh on state change preserves correctness while optimizing performance

**Implementation Pattern:**
```typescript
// Two separate arrays for different update frequencies
private staticGraphics: Graphics[] = [];   // Draw once
private dynamicGraphics: Graphics[] = [];  // Update on change

enable() {
  this.drawStaticGraphics();    // Once
  this.updateDynamicGraphics(); // Initial state
}

onStateChange() {
  this.updateDynamicGraphics(); // Only update dynamic
}
```

## Framework Utilities

**Always prefer framework-provided utilities over reimplementing standard functionality.** Phaser provides many built-in utilities for common game development tasks. Using these ensures consistency, maintainability, and often better performance.

**Common Phaser Utilities:**
- `Phaser.Math.Between(min, max)` - Random integer in range (inclusive)
- `Phaser.Math.FloatBetween(min, max)` - Random float in range
- `Phaser.Math.Distance.Between(x1, y1, x2, y2)` - Calculate distance
- `Phaser.Math.Angle.Between(x1, y1, x2, y2)` - Calculate angle
- `Phaser.Math.Clamp(value, min, max)` - Clamp value to range
- `Phaser.Math.Linear(p0, p1, t)` - Linear interpolation
- `Phaser.Geom.*` - Geometric calculations (rectangles, circles, lines, etc.)

**Examples:**
```typescript
// ✅ Good: Use Phaser utilities
const randomX = Phaser.Math.Between(0, this.map.sizeX - 1);
const randomY = Phaser.Math.Between(0, this.map.sizeY - 1);
const distance = Phaser.Math.Distance.Between(x1, y1, x2, y2);
const angle = Phaser.Math.Angle.Between(playerX, playerY, targetX, targetY);

// ❌ Bad: Manual implementation
const randomX = Math.floor(Math.random() * this.map.sizeX);
const randomY = Math.floor(Math.random() * this.map.sizeY);
const distance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
const angle = Math.atan2(targetY - playerY, targetX - playerX);
```

**Benefits:**
- More readable and self-documenting
- Framework utilities are tested and optimized
- Consistent behavior across the codebase
- Easier for other developers familiar with Phaser
- Less chance of edge-case bugs

**When to use native JavaScript:**
- Framework doesn't provide the functionality
- Performance is critical and native is measurably faster
- You need specific behavior the framework utility doesn't support

**Basic math functions:** Standard library functions like `Math.sqrt`, `Math.ceil`, `Math.floor`, and `Math.round` are allowed over Phaser counterparts (e.g. `Phaser.Math.FloorTo`, `Phaser.Math.CeilTo`). They are widely known and sufficient for simple numeric operations.

## Code Duplication & Base Class Design

**Problem:** Subclasses duplicating initialization code (e.g., marking tile occupancy, storing map reference).

**Anti-pattern:**
```typescript
// ❌ Bad: Every subclass repeats the same code
class Monster extends GameObject {
  constructor(scene, config) {
    super(scene, { ... });
    this.map = config.map;           // Duplicate
    this.markCurrentTileOccupied();  // Duplicate
  }
}

class Player extends GameObject {
  constructor(scene, config) {
    super(scene, { ... });
    this.map = config.map;           // Duplicate
    this.markCurrentTileOccupied();  // Duplicate
  }
}
```

**Solution:** Move shared logic to base class:
```typescript
// ✅ Good: Base class handles common initialization
class GameObject {
  constructor(scene, config: { map: HBMap, ... }) {
    this.map = config.map;           // Once
    // ... create assets ...
    this.markCurrentTileOccupied();  // Once
  }
}

class Monster extends GameObject {
  constructor(scene, config) {
    super(scene, {
      ...config,
      map: config.map,  // Pass through to base
    });
    // Only Monster-specific logic here
  }
}
```

**Benefits:**
- **DRY** (Don't Repeat Yourself) - Logic defined once
- **Consistency** - All subclasses get the behavior automatically
- **Less Error-Prone** - Can't forget to add initialization in new subclasses
- **Easier Maintenance** - Change behavior in one place

**When to use:**
- Logic is identical across all subclasses
- Behavior is fundamental to the base class contract
- State needs to be initialized before subclass construction
- Forgetting the logic would cause bugs

## Rewriting Rules or Instructions (When Asked)

When explicitly asked to rewrite, update, or regenerate cursor rules or AI instructions:
- **Be concise** - Reduce context size; avoid redundancy
- **Don't repeat** - Reference sub-files for detailed topics; don't duplicate their content
- **No code examples** - Except for style/pattern guides (e.g., Registry access, Event naming)
- **Reference methods** - Point to files/methods for lookup (e.g., `GameAsset.playAnimationWithDirection` in GameAsset.ts) instead of inlining full signatures
