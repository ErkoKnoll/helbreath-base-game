import { DEBUG_KEY } from "./RegistryKeys";

/**
 * Phaser registry event names.
 * Registry events follow the pattern 'changedata-{key}' where {key} is the registry key.
 */
export const IN_DEBUG_MODE_CHANGE = `changedata-${DEBUG_KEY}`;

/**
 * EventBus IN: React → Phaser
 * Events sent from React components to Phaser scenes.
 */
export const IN_UI_CHANGE_MOVEMENT_SPEED = 'ui-change-player-movement-speed';
export const IN_UI_CHANGE_ATTACK_SPEED = 'ui-change-player-attack-speed';
export const IN_UI_CHANGE_ATTACK_RANGE = 'ui-change-player-attack-range';
export const IN_UI_CHANGE_DAMAGE = 'ui-change-player-damage';
export const IN_UI_CHANGE_TRANSPARENCY = 'ui-change-player-transparency';
export const IN_UI_CHANGE_ATTACK_TYPE = 'ui-change-player-attack-type';
export const IN_UI_CHANGE_CAST_SPEED = 'ui-change-player-cast-speed';
export const IN_UI_CHANGE_ATTACK_MODE = 'ui-change-player-attack-mode';
export const IN_UI_CHANGE_RUN_MODE = 'ui-change-player-run-mode';
export const IN_UI_CHANGE_CHILLED_EFFECT = 'ui-change-chilled-effect';
export const IN_UI_CHANGE_BERSERKED_EFFECT = 'ui-change-berserked-effect';
export const IN_UI_CHANGE_GENDER = 'ui-change-player-gender';
export const IN_UI_CHANGE_SKIN_COLOR = 'ui-change-player-skin-color';
export const IN_UI_CHANGE_UNDERWEAR_COLOR = 'ui-change-player-underwear-color';
export const IN_UI_CHANGE_HAIR_STYLE = 'ui-change-player-hair-style';
export const IN_UI_CHANGE_CAMERA_ZOOM = 'ui-change-camera-zoom';
export const IN_UI_CHANGE_MUSIC_VOLUME = 'ui-change-music-volume';
export const IN_UI_CHANGE_SOUND_VOLUME = 'ui-change-sound-volume';
export const IN_UI_MUTE_ALL_SOUNDS = 'ui-mute-all-sounds';
export const IN_UI_UNMUTE_ALL_SOUNDS = 'ui-unmute-all-sounds';
export const IN_UI_PLAY_MUSIC = 'ui-toggle-play-music';
export const IN_UI_CHANGE_PLAY_MAP_MUSIC = 'play-map-music-changed';
export const IN_UI_CHANGE_CAMERA_FOLLOW_PLAYER = 'ui-change-camera-follow-player';
export const IN_UI_CHANGE_CAMERA_SHAKE = 'ui-change-camera-shake';
export const IN_UI_CHANGE_POST_PROCESSING = 'ui-change-post-processing';
export const IN_UI_CHANGE_MAP = 'ui-change-map';
export const IN_UI_TOGGLE_RENDER_MAP_TILES = 'ui-toggle-render-map-tiles';
export const IN_UI_TOGGLE_RENDER_MAP_OBJECTS = 'ui-toggle-render-map-objects';
export const IN_UI_TOGGLE_DEBUG_MODE = 'ui-toggle-debug-mode';
export const IN_UI_TOGGLE_NON_MOVABLE_CELLS_HIGHLIGHT = 'ui-toggle-non-movable-cells-highlight';
export const IN_UI_TOGGLE_TELEPORT_CELLS_HIGHLIGHT = 'ui-toggle-teleport-cells-highlight';
export const IN_UI_TOGGLE_WATER_CELLS_HIGHLIGHT = 'ui-toggle-water-cells-highlight';
export const IN_UI_TOGGLE_FARMABLE_CELLS_HIGHLIGHT = 'ui-toggle-farmable-cells-highlight';
export const IN_UI_TOGGLE_GRID_DISPLAY = 'ui-toggle-grid-display';
export const IN_UI_TOGGLE_DISPLAY_LARGE_ITEMS = 'ui-toggle-display-large-items';
export const IN_UI_CHANGE_WEATHER = 'ui-change-weather';
export const IN_UI_CAMERA_MOVE_UP = 'ui-camera-move-up';
export const IN_UI_CAMERA_MOVE_DOWN = 'ui-camera-move-down';
export const IN_UI_CAMERA_MOVE_LEFT = 'ui-camera-move-left';
export const IN_UI_CAMERA_MOVE_RIGHT = 'ui-camera-move-right';
export const IN_UI_REQUEST_PLAYER_LOGOUT = 'ui-request-player-logout';
export const IN_UI_SUMMON_MONSTER = 'ui-summon-monster';
export const IN_UI_SUMMON_NPC = 'ui-summon-npc';
export const IN_UI_CAST_EFFECT = 'ui-cast-effect';
export const IN_UI_CAST_SPELL = 'ui-cast-spell';
export const IN_UI_KILL_ALL_MONSTERS = 'ui-kill-all-monsters';
export const IN_UI_KILL_ALL_NPCS = 'ui-kill-all-npcs';
export const IN_UI_KILL_ALL_EFFECTS = 'ui-kill-all-effects';
export const IN_UI_PLAYER_RESURRECT = 'ui-player-resurrect';

/**
 * EventBus: Intra-Phaser Communication
 * Events for communication between Phaser objects (no IN/OUT prefix).
 */
export const PLAYER_POSITION_CHANGED = 'player-position-changed';
export const MONSTER_DEAD = 'monster-dead';
export const NPC_DEAD = 'npc-dead';

/** Emitted when an item is equipped. Payload: { itemType: ItemTypes, itemId?: number, itemUid: number, effectOverrides?: Effect[] } */
export const EQUIP_ITEM = 'equip-item';

/** Emitted when an equipped item is moved to bag. Payload: { itemUid: number, itemType: ItemTypes, bagX: number, bagY: number } */
export const ITEM_MOVED_TO_BAG = 'item-moved-to-bag';

/** Emitted when bag item position is updated (reorder within bag). Payload: { itemUid: number, bagX: number, bagY: number } */
export const ITEM_BAG_POSITION_UPDATED = 'item-bag-position-updated';

/** Emitted when a single item is added to bag. Payload: { item: InventoryItem } */
export const ITEM_ADDED_TO_BAG = 'item-added-to-bag';

/** Emitted from UI when user requests to create/add item to bag. Payload: { itemId: number; effectOverrides?: Effect[] } */
export const ITEM_CREATE_REQUESTED = 'item-create-requested';

/** Emitted from UI when user drops bag item outside bag to equip. Payload: { item: InventoryItem, itemType: ItemTypes } */
export const ITEM_EQUIP_REQUESTED = 'item-equip-requested';

/** Emitted from UI when user double-clicks consumable MISC item in bag. Payload: { item: InventoryItem } */
export const ITEM_CONSUMED_REQUESTED = 'item-consumed-requested';

/** Emitted when item is removed from bag (e.g. equipped). Payload: { itemUid: number } */
export const ITEM_REMOVED_FROM_BAG = 'item-removed-from-bag';

/** Emitted when bag item is grabbed or added - bring it to top (z-order). Payload: { itemUid: number } */
export const ITEM_BAG_ITEM_BROUGHT_TO_FRONT = 'item-bag-item-brought-to-front';

/** Emitted when stackable item quantity changes. Payload: { itemUid: number; quantity: number } */
export const ITEM_QUANTITY_UPDATED = 'item-quantity-updated';

/** Emitted from UI when bag item is dropped outside InventoryDialog (user intent). Payload: { itemUid: number } */
export const ITEM_DROP_TO_GROUND_REQUESTED = 'item-drop-to-ground-requested';

/** Emitted after item is removed from bag and added to LootManager. Payload: { worldX: number; worldY: number; itemId: number; itemUid: number; quantity: number; tint?: number; effectOverrides?: Effect[] } */
export const ITEM_DROPPED_TO_GROUND = 'item-dropped-to-ground';

/** Emitted when player PickUp animation completes. Payload: { worldX: number; worldY: number } */
export const ITEM_PICKUP_ATTEMPTED = 'item-pickup-attempted';

/** Emitted to add item from ground to bag (pickup). Payload: { itemId: number; itemUid: number; quantity: number; effectOverrides?: Effect[] } */
export const ITEM_ADD_FROM_GROUND = 'item-add-from-ground';

/** Emitted when monster attack animation hits frame 2 (player should take damage). */
export const MONSTER_ATTACK_HIT_PLAYER = 'monster-attack-hit-player';

/** Emitted when the player dies. Monsters use this to stop targeting and return to wandering. */
export const PLAYER_DIED = 'player-died';

/** Emitted when a Phaser scene is ready. React uses this to receive the current scene instance. */
export const CURRENT_SCENE_READY = 'current-scene-ready';

/** Emitted when player confirms spell target (left click in CastReady or immediate targeting). Payload: PlayerConfirmSpellTargetEvent */
export const PLAYER_CONFIRM_SPELL_TARGET = 'player-confirm-spell-target';

/**
 * EventBus OUT: Phaser → React
 * Events sent from Phaser scenes to React components.
 */
export const OUT_SPRITE_FRAME_EXTRACTED = 'sprite-frame-extracted';
export const OUT_UI_HOVER_SPRITE_FRAME_DEBUG = 'ui-hover-sprite-frame-debug';
export const OUT_UI_HOVER_MONSTER = 'ui-hover-monster';

/** Emitted when pointer is over a ground item. Payload: boolean (true when hovering) */
export const OUT_UI_HOVER_GROUND_ITEM = 'ui-hover-ground-item';
/** Emitted when pointer is over a ground item. Payload: InventoryItemHoverInfo | undefined (for hover overlay) */
export const OUT_UI_HOVER_GROUND_ITEM_INFO = 'ui-hover-ground-item-info';
export const OUT_UI_CAST_STARTED = 'ui-cast-started';
export const OUT_UI_CAST_READY = 'ui-cast-ready';
export const OUT_UI_CAST_REMOVED = 'ui-cast-removed';
export const OUT_UI_SET_MOVEMENT_SPEED = 'ui-set-movement-speed';
export const OUT_UI_SET_ATTACK_SPEED = 'ui-set-attack-speed';
export const OUT_UI_SET_ATTACK_RANGE = 'ui-set-attack-range';
export const OUT_UI_SET_DAMAGE = 'ui-set-damage';
export const OUT_UI_SET_TRANSPARENCY = 'ui-set-transparency';
export const OUT_UI_SET_ATTACK_TYPE = 'ui-set-attack-type';
export const OUT_UI_SET_CAST_SPEED = 'ui-set-cast-speed';
export const OUT_UI_SET_ATTACK_MODE = 'ui-set-attack-mode';
export const OUT_UI_SET_RUN_MODE = 'ui-set-run-mode';
export const OUT_UI_SET_CHILLED_EFFECT = 'ui-set-chilled-effect';
export const OUT_UI_SET_BERSERKED_EFFECT = 'ui-set-berserked-effect';
export const OUT_UI_SET_GENDER = 'ui-set-gender';
export const OUT_UI_SET_SKIN_COLOR = 'ui-set-skin-color';
export const OUT_UI_SET_UNDERWEAR_COLOR = 'ui-set-underwear-color';
export const OUT_UI_SET_HAIR_STYLE = 'ui-set-hair-style';
export const OUT_UI_SET_CAMERA_ZOOM = 'ui-set-camera-zoom';
export const OUT_UI_SET_MUSIC_VOLUME = 'ui-set-music-volume';
export const OUT_UI_SET_SOUND_VOLUME = 'ui-set-sound-volume';
export const OUT_UI_SET_SELECTED_MUSIC = 'ui-set-music-changed';
export const OUT_UI_SET_SELECTED_MAP = 'ui-set-selected-map';
export const OUT_UI_GAME_STATS_UPDATE = 'ui-receive-game-stats-update';
export const OUT_UI_MOUSE_POSITION_UPDATE = 'ui-receive-mouse-position-update';
export const OUT_UI_CAMERA_FOLLOW_PLAYER_CHANGED = 'ui-receive-camera-follow-player-changed';
export const OUT_UI_MINIMAP_CAPTURED = 'ui-minimap-captured';
/** Emitted when a map starts loading. Payload: { minimap, mapName, mapSizeX?, mapSizeY? } */
export const OUT_UI_MINIMAP_LOADING = 'ui-minimap-loading';
export const OUT_UI_PLAYER_DIED = 'player-died';
export const OUT_MAP_LOADED = 'map-loaded';
