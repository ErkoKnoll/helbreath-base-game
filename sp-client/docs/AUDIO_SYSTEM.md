# Audio System Developer Guide

This guide describes how the audio system and spatial audio work in the sp-client. The system is built on Phaser 3's sound APIs and provides background music, sound effects, and positional (spatial) audio.

---

## Architecture Overview

The audio system consists of four main components:

| Component | Purpose |
|-----------|---------|
| **MusicManager** | Background music playback (looping, single track at a time) |
| **SoundManager** | Sound effects (looping and one-shot), spatial audio, playback rate sync |
| **SoundTracker** | Tracks sounds by game state; coordinates with SoundManager |
| **SpatialAudioUtils** | Calculates pan and volume from source/listener positions |

```
┌─────────────────┐     ┌─────────────────┐     ┌──────────────────────┐
│  SoundTracker   │────▶│  SoundManager   │────▶│  Phaser Sound API    │
│  (state-based)  │     │  (playback)     │     │  (WebAudio/HTML5)     │
└────────┬────────┘     └────────┬────────┘     └──────────────────────┘
         │                       │
         │              ┌────────▼────────┐
         │              │ SpatialConfig   │◀──── SpatialAudioUtils
         │              │ (pan, volume)   │      (position → config)
         │              └────────────────┘
         │
┌────────▼────────┐
│  MusicManager   │────▶ Phaser Sound (separate from SFX)
└─────────────────┘
```

---

## MusicManager

**File:** `src/utils/MusicManager.ts`

Manages background music. Only one track plays at a time.

### Features

- **Looping music** – Plays `.mp3` files in a continuous loop
- **Track switching** – Stops current track and starts new one when switching
- **Volume control** – 0–100 scale, persisted for the session
- **Scene updates** – `setScene()` for when the Phaser scene is recreated

### API

| Method | Description |
|--------|-------------|
| `playMusic(fileName: string)` | Plays a music file (e.g. `'default.mp3'`). Reuses key if same track is already playing. |
| `stopMusic()` | Stops and destroys the current music |
| `getCurrentMusic()` | Returns the current music file name or `undefined` |
| `setMusicVolume(volume: number)` | Sets volume (0–100) |
| `getMusicVolume()` | Returns current volume (0–100) |
| `setScene(scene: Scene)` | Updates the Phaser scene reference |

### Usage

```typescript
// Music must be loaded into Phaser's audio cache first (e.g. in Boot/LoadingScreen)
musicManager.playMusic('default.mp3');
musicManager.setMusicVolume(50);
musicManager.stopMusic();
```

---

## SoundManager

**File:** `src/utils/SoundManager.ts`

Manages sound effects: looping and one-shot, with optional spatial audio and animation-synced playback.

### SpatialConfig Interface

Spatial audio is configured via `SpatialConfig`:

```typescript
interface SpatialConfig {
    /** Pan value (-1 = left, 0 = center, 1 = right) */
    pan: number;
    /** Volume multiplier for distance (0-1) */
    distanceVolume: number;
}
```

- **pan** – Stereo position: -1 = left, 0 = center, 1 = right
- **distanceVolume** – Attenuation from distance (0 = silent, 1 = full)

### Features

- **Looping sounds** – `playInLoop()` returns a `soundId` for control
- **One-shot sounds** – `playOnce()` plays once and cleans up on completion
- **Animation sync** – `animationDurationMs` adjusts playback rate to match animation length
- **Spatial audio** – Optional `SpatialConfig` for pan and distance volume
- **Volume control** – Global SFX volume (0–100); spatial sounds use base volume × `distanceVolume`

### API

| Method | Description |
|--------|-------------|
| `playInLoop(fileName, animationDurationMs?, spatialConfig?)` | Starts a looping sound. Returns `soundId`. |
| `playOnce(fileName, animationDurationMs?, spatialConfig?, onComplete?)` | Plays once. Returns `soundId`. Calls `onComplete` when done. |
| `stopSound(soundId)` | Stops a looping or one-shot sound by ID |
| `stopAllSounds()` | Stops all looping and one-shot sounds |
| `setAnimationDuration(soundId, animationDurationMs)` | Updates playback rate for a looping sound |
| `setSpatialConfig(soundId, spatialConfig)` | Updates spatial config for a looping sound |
| `setSoundVolume(volume)` | Sets global SFX volume (0–100) |
| `getSoundVolume()` | Returns current SFX volume |

### Spatial Audio Application

When `SpatialConfig` is provided:

1. **Pan** – `setPan(pan)` on the Phaser sound
2. **Volume** – `finalVolume = baseVolume × distanceVolume`

Spatial configs for looping sounds are stored and reapplied when global volume changes.

---

## SoundTracker

**File:** `src/utils/SoundTracker.ts`

Wraps `SoundManager` and tracks sounds by game state (e.g. attack, idle, walk). Ensures one sound per state and coordinates cleanup.

### Features

- **State-based tracking** – Looping sounds keyed by state number
- **One-shot tracking** – Optional state key for cleanup via `stopSound(state)`
- **Untracked one-shots** – `playOnceUntracked()` for sounds that should persist across state changes

### API

| Method | Description |
|--------|-------------|
| `playInLoop(state, fileName, animationDurationMs, spatialConfig?)` | Plays looping sound for state. Skips if already playing for that state. |
| `stopSound(state)` | Stops the sound for the given state |
| `stopAllSounds()` | Stops all tracked sounds |
| `setAnimationDuration(state, animationDurationMs)` | Updates playback rate for a looping sound |
| `setSpatialConfig(state, spatialConfig)` | Updates spatial config for a looping sound |
| `playOnce(fileName, animationDurationMs?, spatialConfig?, state?)` | One-shot, tracked. `stopAllSounds()` stops it if still playing. |
| `playOnceUntracked(fileName, spatialConfig?)` | One-shot, not tracked. Not stopped by `stopAllSounds()`. |

### Tracking Logic

- **Looping:** `trackedSounds` maps `state` → `TrackedSound`
- **One-shot:** Uses `-soundId` as key when no state is given; entry removed when sound completes
- **Untracked:** Not stored in `trackedSounds`; used for sounds like damage or death that should persist

---

## SpatialAudioUtils

**File:** `src/utils/SpatialAudioUtils.ts`

Converts world positions into `SpatialConfig` for pan and distance-based volume.

### Configuration

```typescript
interface SpatialAudioConfig {
    sourceX: number;   // Source position (world grid)
    sourceY: number;
    listenerX: number; // Listener position (usually player)
    listenerY: number;
    maxDistance?: number; // Optional: max audible distance (default from Config)
}
```

### Algorithm

1. **Pan** – `dx = sourceX - listenerX`; pan range uses `MAX_SPATIAL_AUDIO_DISTANCE` and is clamped to [-1, 1].
2. **Distance** – Euclidean distance between source and listener.
3. **Volume** – Linear falloff from 1.0 (at source) to 0.0 (at `maxDistance`), then a power curve for smoother falloff.
4. **Max volume** – Spatial sounds are capped at 25% of base volume.

### API

```typescript
function calculateSpatialAudio(config: SpatialAudioConfig): SpatialConfig
```

### Usage

```typescript
import { calculateSpatialAudio } from './SpatialAudioUtils';

const spatialConfig = calculateSpatialAudio({
    sourceX: monster.x,
    sourceY: monster.y,
    listenerX: player.x,
    listenerY: player.y,
    maxDistance: 20 // optional, defaults to MAX_SPATIAL_AUDIO_DISTANCE
});

soundManager.playInLoop('C10.mp3', 500, spatialConfig);
```

### Configuration Constant

`MAX_SPATIAL_AUDIO_DISTANCE` in `src/Config.ts` (default: 20) controls:

- Maximum audible distance in grid cells
- Pan range for full left/right stereo

---

## Typical Workflow

### 1. Background music (scene load)

```typescript
musicManager.playMusic('default.mp3');
```

### 2. Looping sound (e.g. attack)

```typescript
const soundId = soundManager.playInLoop('C10.mp3', 500, spatialConfig);
// Later: soundManager.stopSound(soundId);
```

### 3. State-based looping (e.g. via SoundTracker)

```typescript
soundTracker.playInLoop(STATE_ATTACK, 'C10.mp3', 500, spatialConfig);
// Later: soundTracker.stopSound(STATE_ATTACK);
```

### 4. One-shot (e.g. death)

```typescript
soundTracker.playOnceUntracked('C92.mp3', spatialConfig);
```

### 5. Updating spatial audio during movement

```typescript
// Each frame or when positions change:
const spatialConfig = calculateSpatialAudio({
    sourceX: monster.x, sourceY: monster.y,
    listenerX: player.x, listenerY: player.y
});
soundManager.setSpatialConfig(soundId, spatialConfig);
// Or via SoundTracker:
soundTracker.setSpatialConfig(state, spatialConfig);
```

---

## Asset Requirements

- Audio files must be loaded into Phaser's audio cache before use (e.g. in Boot or LoadingScreen).
- Sound keys are derived from filenames by removing `.mp3` (e.g. `'C10.mp3'` → `'C10'`).
- `MusicManager` and `SoundManager` both check `scene.cache.audio.exists(key)` before playing.

---

## Volume Ranges

| Component | Range | Notes |
|-----------|-------|-------|
| Music | 0–100 | Converted to Phaser 0–1 internally |
| SFX | 0–100 | Converted to Phaser 0–1 internally |
| Spatial distanceVolume | 0–1 | Multiplied by base SFX volume |
| Spatial max | 25% | Spatial sounds capped at 25% of base volume |
