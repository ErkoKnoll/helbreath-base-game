# Player Mechanics Developer Guide

This guide documents the `Player` class mechanics, its interaction with `GameWorld`, and related game objects. Use it when extending player behavior, debugging combat/movement, or integrating new systems.

---

## Overview

`Player` extends `GameObject` and represents the player character. It manages:

- **Movement** — Run/walk, pathfinding, direct movement, dash attack
- **Combat** — Melee, bow, attack target tracking, damage dealing
- **Spell casting** — Cast animation, targeting mode, queued casts
- **Appearance** — Gear, gender, skin color, effects (chilled, berserk)
- **State** — Idle, movement, attack, take damage, death, resurrection

---

## Class Hierarchy

```
GameObject (base)
  └── Player
```

`Player` inherits from `GameObject`:

- `worldX`, `worldY` — world position
- `setDestination`, `cancelMovement`, `move` — movement
- `takeDamage`, `acceptDamage`, `announceDeath` — damage handling
- `beforeMove`, `processMovement`, `switchState` — movement hooks
- `onPositionChanged`, `onCellReached` — position callbacks

---

## Player State Machine

`PlayerState` (from `PlayerAppearanceManager`) drives animation and behavior:

| State | Description |
|-------|-------------|
| `IdlePeaceMode` | Idle, no weapon stance |
| `IdleCombatMode` | Idle, combat stance |
| `WalkPeaceMode` | Walking, peace stance |
| `WalkCombatMode` | Walking, combat stance |
| `Run` | Running |
| `BowStance` | Peace mode bow pose (no damage) |
| `MeleeAttack` | Melee attack animation |
| `BowAttack` | Bow attack animation |
| `Cast` | Cast animation playing |
| `CastReady` | Cast done, waiting for target click |
| `PickUp` | Pickup animation |
| `TakeDamage` | Take damage (stationary) |
| `TakeDamageOnMove` | Take damage while moving |
| `TakeDamageWithKnockback` | Take damage with knockback |
| `Die` | Death animation |

---

## GameWorld Integration

### Game Loop

`GameWorld.update()` calls `player.update(delta)` every frame. The update order:

1. `player.update(delta)` — movement, state transitions, animations
2. `handleLeftMouseButton()` — movement, attack, spell targeting
3. `handleRightMouseButton()` — turn, cancel spell
4. `cameraManager.update()` — camera follows player
5. `handleMapObjectCollisions()` — map object transparency when player is behind

### Player Creation

`Player` is created in `initializeGameObjects()` after map load:

```typescript
this.player = new Player(this, playerWorldX, playerWorldY, 1, this.soundManager, map, gear);
```

Initial position comes from `GameStateManager` (saved coords) or map center. `GameStateManager` and `InventoryManager` supply gear, gender, skin color, and movement/attack settings.

### Input Flow

| Input | Handler | Player action |
|-------|---------|---------------|
| Left click (hold) | `handleLeftMouseButton` | Movement, attack, spell target |
| Left click (release) | `InputManager.onPointerUp` | Attack, pickup, movement |
| Right click | `handleRightMouseButton`, `InputManager` | Turn, cancel spell |

`GameWorld` uses `getMonsterUnderPointer()` to find monsters under the cursor. If a monster is under the cursor:

- In range → `player.attack(monster)`
- Out of range → `player.setDestination(monster.worldX, monster.worldY)` for pathfinding

---

## Movement Mechanics

### `setDestination`

`Player` overrides `setDestination` and rejects when:

- Dead, attacking, bow stance, casting, cast ready, pickup, take damage, stunlocked

`GameObject.setDestination` does pathfinding and updates `destinationX`/`destinationY`.

### `cancelMovement`

`Player` overrides `cancelMovement` and does not cancel when attacking or in bow stance.

### Run vs Walk

- `runMode` — run (full speed) vs walk (half speed)
- `attackMode` — combat stance vs peace stance when idle/walking
- `switchToMovement()` picks `Run`, `WalkPeaceMode`, or `WalkCombatMode` from these flags

### Dash Attack

When `allowDashAttack` is enabled and the player is one cell away from the attack target:

1. `beforeMove` detects distance `attackRange + 1`
2. Sets `dashMode = true`, calls `move(direction)` toward target
3. During movement, `switchState(Move)` → `MeleeAttack` (attack animation instead of run)
4. At weapon frame 2, damage is applied and `dashDamageDealt = true`
5. In `processMovement`, when the cell is reached, if damage was dealt and target is still in range, starts another attack

---

## Combat Mechanics

### Attack Flow

1. `player.attack(monster)` — called by `GameWorld` when the player clicks a monster
2. If moving: store `attackTarget`, process when reaching next cell
3. If in range: `startAttack(monster)` (melee/bow) or `startBowStance(monster)` (peace mode)
4. If out of range: store `attackTarget`, `GameWorld` calls `setDestination` toward monster

### `processMovement` Hook

When the player reaches a cell:

- If `attackTarget` is in range → `startAttack` or `startBowStance`
- Otherwise continue pathfinding

### Damage Delivery

- **Melee**: damage at weapon animation frame 2 via `onWeaponAnimationFrameChange`
- **Bow**: `ArrowProjectile` created at frame 2; damage when arrow reaches target
- **Critical strike**: `CriticalStrikeProjectile` for `InterruptKnockback` melee
- **Storm Bringer**: `StormBringerEffect` when weapon has `STORM_BRINGER`

### Attack Target Lifecycle

- Set by `attack()` or `startAttack`
- Cleared when: attack animation ends, target dies, player takes damage, player dies
- `GameWorld` listens for `MONSTER_DEAD` and calls `player.clearAttackTarget()` if the dead monster was the target

---

## Spell Casting

### Request Flow

1. UI emits `IN_UI_CAST_SPELL` with `spellId` and `useCastAnimation`
2. `GameWorld.setupSpellRequestListener` → `player.requestCast(spellId, useCastAnimation)`

### Cast Modes

- **With animation**: `switchPlayerState(Cast)`, play cast animation, then `CastReady`
- **Without animation**: emit `OUT_UI_CAST_READY` immediately (targeting mode)
- **While moving**: queue cast in `queuedCastSpellId`; when the next cell is reached, `switchState(Idle)` runs the queued cast

### Targeting

- `onLeftClickAt(cursorPixelX, cursorPixelY)` — when in targeting or `CastReady`
- Emits `PLAYER_CONFIRM_SPELL_TARGET` with spell ID and pixel coords
- `CastManager` listens and runs the spell

### Cancellation

- Right click → `player.onRightClick()` → clears pending/queued spell, emits `OUT_UI_CAST_REMOVED`
- Damage interrupt → `applyInterruptDamage` clears pending spell

---

## Damage and Death

### Taking Damage

`player.takeDamage(attackType, damage, attackerWorldX, attackerWorldY)`:

- `NoInterrupt` — only HP change and floating text
- `Interrupt` — take damage animation, cancel attack/spell
- `InterruptKnockback` — knockback 1 cell away from attacker, then take damage animation

### Monster → Player Damage

`GameWorld` listens for `MONSTER_ATTACK_HIT_PLAYER`:

- Melee: `player.takeDamage(...)` directly
- Bow: creates `ArrowProjectile`; damage applied in `onReachDestination`

### Death

- `acceptDamage` reduces HP; when HP < 1, `announceDeath` runs
- `announceDeath`: `isDead = true`, destroy shadow, cancel movement, `switchPlayerState(Die)`, emit `OUT_UI_PLAYER_DIED`
- `GameWorld` shows death dialog; `IN_UI_PLAYER_RESURRECT` → `player.resurrect()`

### Resurrection

- Restore HP, recreate shadow
- If current cell is blocked, find nearest movable cell and move there
- `switchToIdle`, play resurrection effect

---

## Appearance and Equipment

### PlayerAppearanceManager

`Player` uses `PlayerAppearanceManager` for:

- Gear (weapon, shield, armor, etc.)
- Gender, skin color, underwear, hair
- State → sprite sheet mapping
- Shadow sprite sheet index

### Event Listeners

`Player` subscribes to:

- `EQUIP_ITEM` — update gear from `InventoryManager`
- `IN_UI_CHANGE_GENDER`, `IN_UI_CHANGE_SKIN_COLOR`, etc. — appearance changes

On construction, it applies current equipped items from `InventoryManager.equippedItems` (in case events fired before the player existed).

---

## Other Object Interactions

### Monster

- `player.attack(monster)` — player initiates combat
- `monster.takeDamage(damage, attackType)` — player deals damage
- Monsters receive `player` reference for follow/attack AI
- `player.clearAttackTarget()` when monster dies

### CastManager

- `getPlayerWorldPos()` — spell origin
- Listens for `PLAYER_CONFIRM_SPELL_TARGET` to run spells
- `player.requestCast` starts cast flow

### CameraManager

- `getFollowTarget()` returns `player.getAnimatedPixelX/Y()` for camera follow

### GroundItem / LootManager

- `player.requestPickUp()` when clicking own cell
- On PickUp animation end, `ITEM_PICKUP_ATTEMPTED` emitted
- `GameWorld` handles pickup via `LootManager`

### Map Objects (GameAsset)

- `handleMapObjectCollisions` checks player vs map objects
- Objects behind the player get reduced alpha

---

## Key Event Names

| Event | Direction | Purpose |
|-------|-----------|---------|
| `IN_UI_CAST_SPELL` | UI → Phaser | Request spell cast |
| `PLAYER_CONFIRM_SPELL_TARGET` | Player → CastManager | Spell target confirmed |
| `OUT_UI_CAST_STARTED` | Phaser → UI | Cast animation started |
| `OUT_UI_CAST_READY` | Phaser → UI | Targeting mode ready |
| `OUT_UI_CAST_REMOVED` | Phaser → UI | Spell cancelled |
| `PLAYER_POSITION_CHANGED` | Player → GameWorld | Update monster spatial audio |
| `OUT_UI_PLAYER_DIED` | Player → UI | Death dialog |
| `IN_UI_PLAYER_RESURRECT` | UI → Phaser | Resurrect |
| `MONSTER_ATTACK_HIT_PLAYER` | Monster → GameWorld | Apply damage to player |
| `ITEM_PICKUP_ATTEMPTED` | Player → GameWorld | Pickup at cell |
| `EQUIP_ITEM` | InventoryManager → Player | Gear change |

---

## Configuration Sources

| Setting | Source |
|---------|--------|
| Movement speed, attack speed, range, cast speed | `GameStateManager` (persisted) |
| Attack mode, run mode, attack type | `GameStateManager` |
| Damage, transparency, chilled, berserk | `playerDialogStore` |
| Gender, skin color, gear | `GameStateManager` + `InventoryManager` |

---

## Cleanup

`Player.destroy()`:

- Unsubscribes from EventBus (equip, gender, skin, etc.)
- Destroys casting circle effect
- Destroys health bar graphics
- Calls `super.destroy()` (GameObject)

`GameWorld.shutdown()` calls `player.cancelPendingCast()` then `player.destroy()`.
