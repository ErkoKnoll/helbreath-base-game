/**
 * Configuration constants for the game client.
 */

/**
 * Game version number displayed on loading and login screens.
 */
export const VERSION_NUMBER = '0.9';

/**
 * Whether to generate the minimap when loading a map.
 * Set to false to skip minimap generation for faster map loading.
 */
export const GENERATE_MINIMAP = true;

/**
 * When true, during minimap capture the scene (map tiles + objects)
 * is captured as a PNG and triggered for browser download.
 */
export const DOWNLOAD_MAP_SNAPSHOT = false;

/**
 * Shrink multiplier for map snapshot to avoid WebGL framebuffer size limits.
 * Output size is (mapWidth / multiplier) x (mapHeight / multiplier).
 * Use 1 for full resolution; increase (e.g. 3) for large maps that exceed GPU limits.
 * 1 doesn't work very well, use 2 or 3 for most maps
 */
export const MAP_SNAPSHOT_SHRINK_MULTIPLIER = 3;

/**
 * Default movement speed slider value (0-100).
 * Used as the initial movement speed when no value is stored in localStorage.
 */
export const DEFAULT_MOVEMENT_SPEED = 80;

/**
 * Default movement speed for monsters (0-100).
 * Used when no movement speed is specified for a monster.
 */
export const MONSTER_DEFAULT_MOVEMENT_SPEED = 50;

/**
 * Default attack speed for monsters (1-100).
 * Used when no attack speed is specified for a monster.
 */
export const MONSTER_DEFAULT_ATTACK_SPEED = 50;

/**
 * Default player attack speed slider value (1-100).
 * Maps to attack animation FPS: 5 (min) to 30 (max).
 */
export const DEFAULT_PLAYER_ATTACK_SPEED = 12.5;

/**
 * Default player attack range in cells (1-20).
 */
export const DEFAULT_PLAYER_ATTACK_RANGE = 2;

/**
 * Stunlock duration in milliseconds after TakeDamageOnMove when reaching destination cell.
 * Player cannot move, change direction, or attack during this period.
 * Also used for take damage sound duration.
 */
export const PLAYER_STUNLOCK_DURATION_MS = 100;

/**
 * Stunlock duration in milliseconds for monsters after interrupted attack.
 * Monster cannot move, attack, or perform any action during this period.
 */
export const MONSTER_STUNLOCK_DURATION_MS = 500;

/**
 * Duration for knockback movement in milliseconds (TakeDamageWithKnockback).
 * Used by both Monster and Player for consistent knockback speed.
 */
export const KNOCKBACK_DURATION_MS = 100;

/**
 * Default animation frame rate in frames per second.
 * Used for idle and death animations.
 */
export const DEFAULT_ANIMATION_FRAME_RATE = 10;

/**
 * Dialog positioning constants.
 * These define the approximate widths of dialogs and spacing for sequential positioning.
 */
export const CONTROLS_DIALOG_WIDTH = 250;
export const MAP_DIALOG_WIDTH = 220;
export const CAMERA_DIALOG_WIDTH = 240;
export const SOUND_DIALOG_WIDTH = 220;
export const PLAYER_DIALOG_WIDTH = 220;
export const DIALOG_PADDING = 10; // Padding between dialogs
export const DIALOG_START_X = 20;
export const DIALOG_START_Y = 20;

/**
 * Minimum time between movement commands in milliseconds.
 * Used to throttle movement commands to prevent overshooting.
 */
export const MOVEMENT_COMMAND_THROTTLE_MS = 100;

/**
 * Maximum distance for spatial audio in grid cells.
 * Sounds beyond this distance are inaudible.
 */
export const MAX_SPATIAL_AUDIO_DISTANCE = 20;

/**
 * Maximum follow distance for monsters in cells.
 * Used to limit the follow distance slider in the summon dialog.
 */
export const MONSTER_MAX_FOLLOW_DISTANCE = 20;

/**
 * Maximum attack range for monsters in cells.
 * Used to limit the attack distance slider in the summon dialog.
 */
export const MAX_MONSTER_ATTACK_RANGE = 10;

/**
 * Transparency for the monster hover overlay (0-1).
 * 0 = fully transparent, 1 = fully opaque.
 */
export const MONSTER_OVERLAY_TRANSPARENCY = 0.9;

/**
 * Vertical offset in pixels below monster center for monster hover overlay anchor.
 */
export const MONSTER_HOVER_OVERLAY_ANCHOR_OFFSET_Y = 30;

/**
 * Interval in milliseconds for game stats and monster hover updates.
 */
export const GAME_STATS_UPDATE_INTERVAL_MS = 10;

/**
 * Multiplier for world-Y-based depth calculation. Depth = worldY * DEPTH_MULTIPLIER.
 * All depth offsets used with this system should be scaled by 10 (e.g. -1 → -10, +5 → +50).
 */
export const DEPTH_MULTIPLIER = 100;

/**
 * Depth for effects that should render above everything else (e.g. projectiles, critical strike).
 */
export const HIGH_DEPTH = 5000000;

/**
 * Depth for loading overlay (covers screen during map load).
 */
export const LOADING_OVERLAY_DEPTH = 10000000;

/**
 * Depth for loading text (above loading overlay).
 */
export const LOADING_TEXT_DEPTH = 10000001;

/**
 * Frames to wait after camera restoration before removing loading overlay.
 * Ensures zoom/scroll changes are fully rendered (~1 second at 30fps).
 */
export const FRAMES_UNTIL_OVERLAY_REMOVAL = 30;

/**
 * Spatial grid radius in cells for map object collision lookup.
 * Phase 1: get candidates within this radius (fast).
 */
export const MAP_OBJECT_COLLISION_GRID_RADIUS_CELLS = 24;

/**
 * Filter radius in cells for map object collision.
 * Phase 2: filter candidates by accurate distance (precise).
 */
export const MAP_OBJECT_COLLISION_RADIUS_CELLS = 12;

/**
 * Alpha (0-1) for map objects when player is behind them (collision transparency).
 */
export const MAP_OBJECT_COLLISION_ALPHA = 0.5;

/**
 * Depth for floating text (damage numbers, etc.) - above all game objects and debug.
 */
export const FLOATING_TEXT_DEPTH = 100000;

/**
 * Alpha reduction per frame for monster corpse fade-out (0-255 range).
 */
export const MONSTER_CORPSE_FADE_ALPHA_STEP = 10;

/**
 * Player health bar width in pixels.
 */
export const PLAYER_HEALTH_BAR_WIDTH = 30;

/**
 * Player health bar height in pixels.
 */
export const PLAYER_HEALTH_BAR_HEIGHT = 3;

/**
 * List of sprite names that have shadows enabled.
 * Shadows are rendered beneath these sprites for depth visualization.
 */
export const SPRITES_WITH_SHADOWS: readonly string[] = [
    'map-tile-223',
] as const;

/**
 * Whether to ignore zip assets by default.
 * If true, URL parameters will not be checked for ignoreZip.
 */
export const IGNORE_ZIP_ASSETS = true;
