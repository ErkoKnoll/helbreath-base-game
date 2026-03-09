# Monster Mechanics Developer Guide

This guide documents the `Monster` class mechanics, its interaction with `GameWorld`, and related game objects. Use it when extending monster behavior, debugging AI/combat, or integrating new monster types.

---

## Overview

`Monster` extends `GameObject` and represents an AI-controlled enemy. It manages:

- **AI behavior** — Follow player, attack when in range, random wandering
- **Combat** — Attack animation, damage delivery via event, bow vs melee
- **Damage** — Take damage, interrupt, knockback, stunlock
- **Death** — Death animation, corpse decay, fade out, removal
- **Spatial audio** — Sounds relative to player position

---

## Class Hierarchy

```
GameObject (base)
  └── Monster
```

`Monster` inherits from `GameObject`:

- `worldX`, `worldY` — world position
- `move`, `cancelMovement`, `canMove` — movement
- `takeDamage`, `acceptDamage`, `announceDeath` — damage handling
- `switchState` — maps GameObjectState to MonsterState
- `onPositionChanged`, `isInTakeDamageOnMoveState` — hooks

`Monster` sets `autoSwitchToIdle = false` — the AI manages state transitions instead of `GameObject` automatically switching to Idle on movement completion.

---

## Monster State Machine

`MonsterState` drives animation and behavior:

| State | Description |
|-------|-------------|
| `Idle` | Standing animation |
| `Move` | Moving animation |
| `Attack` | Attack animation (damage at frame 2) |
| `TakeDamage` | Take damage (stationary) |
| `TakeDamageOnMove` | Take damage while moving |
| `TakeDamageWithKnockback` | Take damage with knockback |
| `Dead` | Death animation |

### Sprite Sheet Mapping

| State | Sprite sheet index base |
|-------|-------------------------|
| Idle | 0–7 (one per direction) |
| Move | 8–15 |
| Attack | 16–23 |
| TakeDamage / TakeDamageOnMove / TakeDamageWithKnockback | 24–31 |
| Dead | 32–39 |

---

## GameWorld Integration

### Game Loop

`GameWorld.update()` iterates over monsters:

```typescript
for (const monster of this.monsters) {
    monster.update(delta);
}
```

Monsters are updated after the player. `player.update(delta)` runs first.

### Player Position Sync

`GameWorld` listens for `PLAYER_POSITION_CHANGED` and calls `updateMonsterSpatialAudio(data.x, data.y)`, which forwards to each monster:

```typescript
for (const monster of this.monsters) {
    monster.updatePlayerPosition(playerX, playerY);
}
```

Monsters store `playerX` and `playerY` for AI decisions (follow, attack range) and spatial audio (listener position).

### Monster Creation (Summon)

Monsters are created via `IN_UI_SUMMON_MONSTER`:

1. `GameWorld` finds nearest movable location from player
2. Looks up monster data in `MONSTERS` for sounds, etc.
3. Creates `Monster` with config including `player`, `playerIsDead`, `followDistance`, `attackDistance`, etc.
4. Pushes to `this.monsters`

### Monster Removal

- **Death**: `Monster` emits `MONSTER_DEAD` when corpse fades to transparent. `GameWorld` listens, finds monster by ID, destroys it, removes from `this.monsters`, and clears `player.clearAttackTarget()` if it was the target.
- **Kill all**: `IN_UI_KILL_ALL_MONSTERS` → `monster.kill()` for each. `kill()` sets `shouldKill = true`; death animation starts when next cell is reached.
- **Shutdown**: `GameWorld.shutdown()` destroys all monsters.

---

## AI Behavior (`evaluateAI`)

`evaluateAI` runs when the monster is not attacking, not moving, and not in take-damage/stunlock states.

### Priority Order

1. **Attack** — If `shouldAttack()` returns true (player in range, alive, not already attacking): `startAttack()`.
2. **Follow** — If `followDistance > 0`, player alive, and player within follow distance: `moveOneStepTowards(playerX, playerY)`.
3. **Wander** — If no target or reached target: pick random movable location. Then `moveOneStepTowards(targetX, targetY)`.

### Movement Speed 0

If `movementSpeed === 0`, the monster never moves or wanders. It also doesn't attack the player.

### Target Destination

`targetDestinationX` / `targetDestinationY` are used for random wandering. When reached or invalid, a new random movable location is picked.

---

## Combat Mechanics

### Attack Flow

1. `shouldAttack()` — true when distance ≤ `attackDistance`, player alive, not attacking.
2. `startAttack()` — cancel movement, face player, `switchMonsterState(Attack)`, play attack sound.
3. At animation frame 2: `onAnimationFrameChange` callback emits `MONSTER_ATTACK_HIT_PLAYER` with `monsterId`, `attackType`, `attackDamage`, `bowAttack`.

### Damage Delivery

`GameWorld` listens for `MONSTER_ATTACK_HIT_PLAYER`:

- **Melee**: `player.takeDamage(attackType, attackDamage, monster.worldX, monster.worldY)` directly.
- **Bow**: `bowAttack === true` → create `ArrowProjectile`; damage applied in `onReachDestination` when arrow reaches player.

### Taking Damage

`Monster.takeDamage(damage, attackType)`:

- `NoInterrupt` — only HP change and floating text.
- `Interrupt` — cancel attack, play TakeDamage or TakeDamageOnMove.
- `InterruptKnockback` — knockback 1 cell away from player (uses `playerX`/`playerY`), then TakeDamageWithKnockback.

Knockback uses `computeKnockbackDestination(playerX, playerY)` — player is the attacker.

---

## Death and Corpse

### Death Sequence

1. HP drops below 1 → `acceptDamage` → `announceDeath` → `startDeathAnimation()`.
2. `startDeathAnimation()`: free cell, cancel movement, stop sounds, destroy shadow, `switchMonsterState(Dead)`.
3. When death animation finishes: start decay timer.
4. After `corpseDecayTime` seconds: fade alpha by `MONSTER_CORPSE_FADE_ALPHA_STEP` each frame.
5. When alpha < 1: emit `MONSTER_DEAD` and GameWorld removes the monster.

### Kill Command

`monster.kill()` sets `shouldKill = true`. When the monster is not mid-cell (`!isMoving`), `update` calls `startDeathAnimation()`.

---

## Configuration

### MonsterConfig (from summon)

| Field | Purpose |
|-------|---------|
| `spriteName`, `displayName` | Sprite and UI name |
| `followDistance`, `attackDistance` | AI behavior (cells) |
| `attackType`, `attackDamage` | Damage to player |
| `movementSpeed`, `attackSpeed` | Movement/attack speed (0–100) |
| `corpseDecayTime` | Seconds before corpse fades |
| `bowAttack` | Use ArrowProjectile instead of direct damage |
| `temporalCoefficient` | Animation speed multiplier |
| `chilledEffect`, `berserkedEffect` | Visual effects at summon |
| `transparency`, `opacity` | Sprite opacity |
| `shadow` | `BodyShadow` or `NoShadow` |

### MonsterStatesConfig (from constants/Monsters)

`MonsterData.states` defines per-state sound and animation:

- `idle`, `move`, `attack`, `takeDamage`, `death`
- Each has `sound` (optional) and `animation` (StateAnimationConfig)
- `StateAnimationConfig`: `startSpriteSheet`, `startAnimationFrame`, `animationFrames`, `spriteName` (override)

---

## Other Object Interactions

### Player

- `player.attack(monster)` — player initiates combat; `monster.takeDamage(damage, attackType)` when player hits.
- `player.clearAttackTarget()` when monster dies (if it was the target).
- `playerX` and `playerY` for AI and spatial audio.

### ArrowProjectile

- When `bowAttack` is true, `GameWorld` creates `ArrowProjectile` on `MONSTER_ATTACK_HIT_PLAYER`; damage applied when arrow reaches player.

### SpatialAudioUtils

- `calculateSpatialAudio({ sourceX, sourceY, listenerX, listenerY })` — monster uses `playerX`/`playerY` as listener.
- `calculateSpatialConfig()` used for attack, take damage, death, and movement sounds.

---

## Event Listeners

### Subscribed

| Event | Handler | Purpose |
|-------|---------|---------|
| `PLAYER_DIED` | `onPlayerDied` | Set `isPlayerDead = true` |
| `IN_UI_PLAYER_RESURRECT` | `onPlayerResurrect` | Set `isPlayerDead = false` |

### Emitted

| Event | When |
|-------|------|
| `MONSTER_ATTACK_HIT_PLAYER` | Attack animation frame 2 |
| `MONSTER_DEAD` | Corpse fully faded |

---

## Shadow

- `MonsterShadow.BodyShadow` (default): `ShadowManager` created with monster sprite.
- `MonsterShadow.NoShadow`: no shadow.
- Shadow destroyed in `startDeathAnimation()`.

---

## Cleanup

`Monster.destroy()`:

- Unsubscribes from `PLAYER_DIED` and `IN_UI_PLAYER_RESURRECT` on EventBus.
- Calls `super.destroy()` (GameObject).

---

## Hover Overlay

`GameWorld` uses `getMonsterUnderPointer()` to find monsters under the cursor for hit testing. `OUT_UI_HOVER_MONSTER` is emitted with monster info (name, hp, damage, etc.) for the UI overlay.
