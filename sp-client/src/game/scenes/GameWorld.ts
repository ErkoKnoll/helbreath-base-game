import { Scene } from 'phaser';
import { GameAsset } from '../objects/GameAsset';
import { GroundItem } from '../objects/GroundItem';
import { DEFAULT_GEAR } from '../../utils/PlayerAppearanceManager';
import { Player } from '../objects/Player';
import { Monster } from '../objects/Monster';
import { ArrowProjectile, isArrowProjectileTarget } from '../effects/ArrowProjectile';
import { NPC } from '../objects/NPC';
import { HBMap, TILE_SIZE } from '../assets/HBMap';
import { EventBus } from '../EventBus';
import { canvasToScreenPosition, convertWorldPosToPixelPos, convertPixelPosToWorldPos, getNextDirection, Direction, findMovableLocation, getDistance, isCellMovable } from '../../utils/CoordinateUtils';
import { getObjectsNearPixel, getObjectsAtWorldCell } from '../../utils/SpatialGrid';
import {
    DEPTH_MULTIPLIER,
    FRAMES_UNTIL_OVERLAY_REMOVAL,
    GAME_STATS_UPDATE_INTERVAL_MS,
    LOADING_OVERLAY_DEPTH,
    LOADING_TEXT_DEPTH,
    MAP_OBJECT_COLLISION_ALPHA,
    MAP_OBJECT_COLLISION_GRID_RADIUS_CELLS,
    MAP_OBJECT_COLLISION_RADIUS_CELLS,
    MONSTER_HOVER_OVERLAY_ANCHOR_OFFSET_Y,
} from '../../Config';
import { InputManager } from '../../utils/InputManager';
import { CameraManager } from '../../utils/CameraManager';
import { getMusicManager, getGameStateManager, getLootManager, setDebugModeEnabled, setDisplayLargeItemsEnabled, setSoundManager } from '../../utils/RegistryUtils';
import { playerDialogStore } from '../../ui/store/PlayerDialog.store';
import { MapManager } from '../../utils/MapManager';
import { SoundManager } from '../../utils/SoundManager';
import { MONSTERS } from '../../constants/Monsters';
import { getNPCData } from '../../constants/NPCs';
import {
    ITEM_ADD_FROM_GROUND,
    ITEM_DROPPED_TO_GROUND,
    ITEM_PICKUP_ATTEMPTED,
    PLAYER_POSITION_CHANGED,
    MONSTER_DEAD,
    MONSTER_ATTACK_HIT_PLAYER,
    IN_UI_REQUEST_PLAYER_LOGOUT,
    IN_UI_PLAYER_RESURRECT,
    IN_UI_CAST_SPELL,
    IN_UI_KILL_ALL_MONSTERS,
    IN_UI_CHANGE_MOVEMENT_SPEED,
    IN_UI_CHANGE_ATTACK_SPEED,
    IN_UI_CHANGE_ATTACK_RANGE,
    IN_UI_CHANGE_DAMAGE,
    IN_UI_CHANGE_TRANSPARENCY,
    IN_UI_CHANGE_ATTACK_TYPE,
    IN_UI_CHANGE_CAST_SPEED,
    IN_UI_CHANGE_ATTACK_MODE,
    IN_UI_CHANGE_RUN_MODE,
    IN_UI_CHANGE_CHILLED_EFFECT,
    IN_UI_CHANGE_BERSERKED_EFFECT,
    IN_UI_CHANGE_MUSIC_VOLUME,
    IN_UI_CHANGE_SOUND_VOLUME,
    IN_UI_CHANGE_MAP,
    IN_UI_TOGGLE_RENDER_MAP_TILES,
    IN_UI_TOGGLE_RENDER_MAP_OBJECTS,
    IN_UI_TOGGLE_DEBUG_MODE,
    IN_UI_TOGGLE_NON_MOVABLE_CELLS_HIGHLIGHT,
    IN_UI_TOGGLE_TELEPORT_CELLS_HIGHLIGHT,
    IN_UI_TOGGLE_WATER_CELLS_HIGHLIGHT,
    IN_UI_TOGGLE_FARMABLE_CELLS_HIGHLIGHT,
    IN_UI_TOGGLE_GRID_DISPLAY,
    IN_UI_TOGGLE_DISPLAY_LARGE_ITEMS,
    IN_UI_CHANGE_WEATHER,
    IN_UI_PLAY_MUSIC,
    IN_UI_CHANGE_PLAY_MAP_MUSIC,
    IN_UI_SUMMON_MONSTER,
    IN_UI_SUMMON_NPC,
    IN_UI_KILL_ALL_NPCS,
    NPC_DEAD,
    OUT_UI_GAME_STATS_UPDATE,
    OUT_UI_HOVER_GROUND_ITEM,
    OUT_UI_HOVER_GROUND_ITEM_INFO,
    OUT_UI_HOVER_MONSTER,
    OUT_UI_SET_SELECTED_MUSIC,
    OUT_MAP_LOADED
} from '../../constants/EventNames';
import { AttackType, CastSpellEvent, Gender, MonsterAttackPlayerEvent, MonsterHoverInfo, SummonMonsterEvent, SummonNPCEvent } from '../../Types';
import type { Effect } from '../../constants/Items';
import { CastManager } from '../../utils/CastManager';
import { WeatherManager } from '../../utils/WeatherManager';
import { mapDialogStore } from '../../ui/store/MapDialog.store';

/**
 * Main game scene. Manages player, monsters, NPCs, ground items, map, camera, input,
 * spell casting, weather, and UI event handling. Loads map on init, spawns objects, and runs the game loop.
 */
export class GameWorld extends Scene {
    private updateInterval: number | undefined = undefined;
    /** Last known cursor position (document coords) - used for elementFromPoint when cursor is over DOM overlays */
    private lastCursorPosition: { x: number; y: number } | undefined = undefined;
    private cursorPositionCleanup: (() => void) | undefined = undefined;
    /** Player instance - cleaned up in shutdown() */
    private player: Player | undefined = undefined;
    /** List of monster instances - cleaned up in shutdown() */
    private monsters: Monster[] = [];
    /** Next monster ID to assign */
    private nextMonsterId: number = 0;
    /** List of NPC instances - cleaned up in shutdown() */
    private npcs: NPC[] = [];
    /** Next NPC ID to assign */
    private nextNPCId: number = 0;
    /** Camera manager - handles follow, zoom, bounds, and UI-driven movement */
    private cameraManager: CameraManager | undefined = undefined;
    /** Mouse/pointer input manager */
    private inputManager: InputManager | undefined = undefined;
    /** Set of map objects that are currently colliding with the player */
    private collidingMapObjects: Set<GameAsset> = new Set();
    /** Loading overlay rectangle - cleaned up after objects are loaded */
    private loadingOverlay: Phaser.GameObjects.Rectangle | undefined = undefined;
    /** Loading text - cleaned up after objects are loaded */
    private loadingText: Phaser.GameObjects.Text | undefined = undefined;
    /** Whether scene initialization has started (deferred to first update) */
    private initializationStarted = false;
    /** Counter for frames to wait before removing overlay after camera restoration */
    private framesUntilOverlayRemoval = 0;
    /** Map manager - handles map loading, rendering, and minimap capture */
    private mapManager: MapManager | undefined = undefined;
    /** Sound manager instance */
    private soundManager: SoundManager;
    /** Whether to play map music when map loads */
    private playMapMusic = true;
    /** Whether the map is currently loading */
    private loadingMap = true;
    /** Cast manager - handles effects, spells, and cleanup */
    private castManager: CastManager | undefined = undefined;
    /** Map that is currently displayed (for proper cleanup on shutdown - gameStateManager may already point to new map) */
    private displayedMap: HBMap | undefined = undefined;
    /** Ground items (dropped loot) - cleaned up in shutdown() */
    private groundItems: GroundItem[] = [];
    /** Weather manager - rain particles and sound */
    private weatherManager: WeatherManager | undefined = undefined;

    constructor() {
        super('GameWorld');
        this.soundManager = new SoundManager(this);
    }

    public init() {
        setSoundManager(this.game, this.soundManager);
        // Reset initialization state
        this.initializationStarted = false;
        this.framesUntilOverlayRemoval = 0;
        this.loadingMap = true;

        this.weatherManager = new WeatherManager(this, this.soundManager);
        this.weatherManager.setWeather(mapDialogStore.state.weather);
        this.setupMapManager();
        this.setupCameraManager();
        this.setupControlDialogEventListeners();
        this.setupSoundDialogEventListeners();
        this.setupMapDialogEventListeners();
        this.setupSummonDialogEventListeners();
        this.setupNPCEventListeners();
        this.setupCastManager();
        this.setupSpellRequestListener();
        this.setupPlayerEventListeners();
        this.setupMonsterEventListeners();
        this.setupLootEventListeners();
        this.setupInputManager();
        this.setupCameraStatsUpdateInterval();

        this.events.on('shutdown', () => {
            this.shutdown();
        });
    }

    public create() {
        this.cameras.main.setBackgroundColor('#000');
    }

    /**
     * Called every frame by Phaser. Updates game objects.
     * 
     * @param _time - Total elapsed time in milliseconds (unused)
     * @param delta - Time elapsed since last frame in milliseconds
     */
    public update(_time: number, delta: number): void {
        this.handleOverlayUpdate();

        // Defer initialization to first update() call so overlay is visible first frame
        if (!this.initializationStarted) {
            this.drawLoadingOverlay(() => {
                // Set displayedMap early so we clean up correctly even if user switches maps during load
                this.displayedMap = this.mapManager!.getCurrentMap();
                this.mapManager!.startMinimapCapture((map) => {
                    map.renderMapObjects(this, true); // Third pass (with trees)

                    // Complete map setup (initialize game objects and setup overlay removal)
                    // For non-minimap case, ensure zoom is still applied
                    this.setupMap(map);

                    // Emit event that map is loaded (tiles and objects are rendered)
                    EventBus.emit(OUT_MAP_LOADED);
                });
            });
            return; // Return early to let overlay render
        }

        // Update player movement
        if (this.player) {
            this.player.update(delta);
            this.handleLeftMouseButton();
            this.handleRightMouseButton();
            this.cameraManager?.update();
            this.handleMapObjectCollisions();
        }

        // Update monsters
        for (const monster of this.monsters) {
            monster.update(delta);
        }

        // Update weather (rain particles, sound)
        if (this.weatherManager && this.cameras?.main) {
            const cam = this.cameras.main;
            this.weatherManager.update(delta, cam.scrollX, cam.scrollY, cam.width, cam.height);
        }
    }

    public shutdown() {
        EventBus.emit(OUT_UI_HOVER_GROUND_ITEM, false);
        EventBus.emit(OUT_UI_HOVER_GROUND_ITEM_INFO, undefined);
        EventBus.emit(OUT_UI_HOVER_MONSTER, undefined);
        this.castManager?.destroy();
        this.castManager = undefined;
        if (this.player?.hasPendingSpell()) {
            this.player.cancelPendingCast();
        }
        this.inputManager?.destroy();
        this.inputManager = undefined;
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = undefined;
        }
        this.cursorPositionCleanup?.();
        this.cursorPositionCleanup = undefined;

        if (this.player) {
            this.player.destroy();
            this.player = undefined;
        }

        // Destroy all monsters
        for (const monster of this.monsters) {
            monster.destroy();
        }
        this.monsters = [];

        // Destroy all NPCs
        for (const npc of this.npcs) {
            npc.destroy();
        }
        this.npcs = [];

        // Destroy all ground items
        for (const groundItem of this.groundItems) {
            groundItem.destroy();
        }
        this.groundItems = [];

        if (this.loadingOverlay) {
            this.loadingOverlay.destroy();
            this.loadingOverlay = undefined;
        }
        if (this.loadingText) {
            this.loadingText.destroy();
            this.loadingText = undefined;
        }

        this.weatherManager?.destroy();
        this.weatherManager = undefined;

        if (this.soundManager) {
            this.soundManager.stopAllSounds();
        }

        this.initializationStarted = false;
        this.framesUntilOverlayRemoval = 0;
        this.loadingMap = true;
        this.mapManager?.resetCapturingState();
        this.collidingMapObjects.clear();

        this.cameraManager?.destroyEventListeners();
        this.cameraManager = undefined;
        EventBus.off(IN_UI_TOGGLE_NON_MOVABLE_CELLS_HIGHLIGHT);
        EventBus.off(IN_UI_TOGGLE_TELEPORT_CELLS_HIGHLIGHT);
        EventBus.off(IN_UI_TOGGLE_WATER_CELLS_HIGHLIGHT);
        EventBus.off(IN_UI_TOGGLE_FARMABLE_CELLS_HIGHLIGHT);
        EventBus.off(IN_UI_TOGGLE_RENDER_MAP_TILES);
        EventBus.off(IN_UI_TOGGLE_RENDER_MAP_OBJECTS);
        EventBus.off(IN_UI_TOGGLE_DEBUG_MODE);
        EventBus.off(IN_UI_TOGGLE_GRID_DISPLAY);
        EventBus.off(IN_UI_TOGGLE_DISPLAY_LARGE_ITEMS);
        EventBus.off(IN_UI_CHANGE_WEATHER);
        EventBus.off(IN_UI_CHANGE_MOVEMENT_SPEED);
        EventBus.off(IN_UI_CHANGE_ATTACK_SPEED);
        EventBus.off(IN_UI_CHANGE_ATTACK_RANGE);
        EventBus.off(IN_UI_CHANGE_DAMAGE);
        EventBus.off(IN_UI_CHANGE_TRANSPARENCY);
        EventBus.off(IN_UI_CHANGE_ATTACK_TYPE);
        EventBus.off(IN_UI_CHANGE_CAST_SPEED);
        EventBus.off(IN_UI_CHANGE_ATTACK_MODE);
        EventBus.off(IN_UI_CHANGE_RUN_MODE);
        EventBus.off(IN_UI_CHANGE_CHILLED_EFFECT);
        EventBus.off(IN_UI_CHANGE_BERSERKED_EFFECT);
        EventBus.off(IN_UI_REQUEST_PLAYER_LOGOUT);
        EventBus.off(IN_UI_PLAYER_RESURRECT);
        EventBus.off(IN_UI_PLAY_MUSIC);
        EventBus.off(IN_UI_CHANGE_PLAY_MAP_MUSIC);
        EventBus.off(IN_UI_CHANGE_MUSIC_VOLUME);
        EventBus.off(IN_UI_CHANGE_SOUND_VOLUME);
        EventBus.off(IN_UI_SUMMON_MONSTER);
        EventBus.off(IN_UI_SUMMON_NPC);
        EventBus.off(IN_UI_CAST_SPELL);
        EventBus.off(IN_UI_KILL_ALL_MONSTERS);
        EventBus.off(IN_UI_KILL_ALL_NPCS);
        EventBus.off(IN_UI_CHANGE_MAP);
        EventBus.off(PLAYER_POSITION_CHANGED);
        EventBus.off(MONSTER_ATTACK_HIT_PLAYER);
        EventBus.off(MONSTER_DEAD);
        EventBus.off(NPC_DEAD);
        EventBus.off(ITEM_DROPPED_TO_GROUND);
        EventBus.off(ITEM_PICKUP_ATTEMPTED);

        // Destroy the map that was actually displayed (not getCurrentMap - gameStateManager
        // may already point to the new map after IN_UI_CHANGE_MAP)
        const mapToCleanup = this.displayedMap;
        this.displayedMap = undefined;
        if (mapToCleanup) {
            mapToCleanup.destroyAllHighlights();
            mapToCleanup.destroyMapTiles(this);
            mapToCleanup.destroyMapObjects();
        }
        this.mapManager = undefined;
    }

    private handleOverlayUpdate(): void {
        // Keep overlay on top every frame while it exists
        if (this.loadingOverlay && this.loadingText) {
            this.children.bringToTop(this.loadingOverlay);
            this.children.bringToTop(this.loadingText);
        }

        // Check if we need to remove the overlay after waiting for frames
        if (this.framesUntilOverlayRemoval > 0) {
            this.framesUntilOverlayRemoval--;
            if (this.framesUntilOverlayRemoval === 0) {
                // Remove loading overlay after waiting for frames
                if (this.loadingOverlay) {
                    this.loadingOverlay.destroy();
                    this.loadingOverlay = undefined;
                }
                if (this.loadingText) {
                    this.loadingText.destroy();
                    this.loadingText = undefined;
                }
            }
        }
    }

    private drawLoadingOverlay(callback: () => void): void {
        // Create loading overlay FIRST, before any rendering
        // Black overlay covering entire screen - fixed to camera viewport
        this.loadingOverlay = this.add.rectangle(
            this.scale.width / 2,
            this.scale.height / 2,
            this.scale.width,
            this.scale.height,
            0x000000,
            1.0
        );
        this.loadingOverlay.setScrollFactor(0, 0);
        this.loadingOverlay.setDepth(LOADING_OVERLAY_DEPTH);

        // Loading text in RPG UI style - fixed to camera viewport
        this.loadingText = this.add.text(
            this.scale.width / 2,
            this.scale.height / 2,
            'Loading map...',
            {
                fontFamily: 'Georgia, serif',
                fontSize: '20px',
                color: '#f4e4c1',
                fontStyle: 'bold',
            }
        );
        this.loadingText.setOrigin(0.5, 0.5);
        this.loadingText.setShadow(1, 1, '#1a0f0a', 2, true);
        this.loadingText.setScrollFactor(0, 0);
        this.loadingText.setDepth(LOADING_TEXT_DEPTH);

        // Mark as started but defer actual loading to next frame so overlay renders first
        this.initializationStarted = true;

        // Use delayedCall to start loading on next frame, ensuring overlay is visible
        this.time.delayedCall(0, callback);
    }

    private handleLeftMouseButton(): void {
        const inputManager = this.inputManager;
        if (!this.loadingMap && inputManager?.getIsLeftMouseDown() && inputManager.getActivePointer() && this.cameras?.main && this.player) {
            if (this.player.isCasting()) {
                return;
            }

            const pointer = inputManager.getActivePointer()!;

            if (this.player.hasPendingSpell()) {
                const camera = this.cameras.main;
                const cursorPixelX = pointer.x + camera.scrollX;
                const cursorPixelY = pointer.y + camera.scrollY;
                if (this.player.onLeftClickAt(cursorPixelX, cursorPixelY)) {
                    return;
                }
            }

            // Pending effect summon: create effect at cursor position (overrides movement)
            if (this.castManager?.getPendingEffectKey()) {
                const camera = this.cameras.main;
                const worldPixelX = pointer.x + camera.scrollX;
                const worldPixelY = pointer.y + camera.scrollY;
                const worldX = convertPixelPosToWorldPos(worldPixelX);
                const worldY = convertPixelPosToWorldPos(worldPixelY);
                if (this.castManager.tryPlaceEffect(worldX, worldY)) {
                    return;
                }
            }

            const monster = this.getMonsterUnderPointer(pointer);

            // Skip attack and movement when we just placed an effect (castReady)
            if (this.castManager?.getCastReady()) {
                return;
            }

            // When holding over a monster: attack when in range (ignore dead monsters)
            if (monster && !monster.getIsDead()) {
                this.player.attack(monster);
                if (this.player.isAttacking() || this.player.isInBowStance()) {
                    return;
                }
                // Out of range: pathfind to monster's position (player will attack when reaching adjacent cell)
                if (getDistance(
                    this.player.getWorldX(),
                    this.player.getWorldY(),
                    monster.getWorldX(),
                    monster.getWorldY()
                ) > this.player.getAttackRange()) {
                    this.player.setDestination(monster.getWorldX(), monster.getWorldY(), false);
                }
                return;
            }

            // Not over monster: move towards cursor (throttled)
            if (inputManager.canAcceptMovementCommand()) {
                const camera = this.cameras.main;
                const worldPixelX = pointer.x + camera.scrollX;
                const worldPixelY = pointer.y + camera.scrollY;
                // Use player's anchor point (where they appear on screen) as center for direction calculation
                const playerAnchorPixelX = this.player.getAnimatedPixelX();
                const playerAnchorPixelY = this.player.getAnimatedPixelY();

                const commandedDestX = convertPixelPosToWorldPos(worldPixelX);
                const commandedDestY = convertPixelPosToWorldPos(worldPixelY);

                this.player.setDestination(
                    commandedDestX,
                    commandedDestY,
                    true,
                    playerAnchorPixelX,
                    playerAnchorPixelY,
                    worldPixelX,
                    worldPixelY
                );
                inputManager.recordMovementCommand();
            }
        }
    }

    private handleRightMouseButton(): void {
        const inputManager = this.inputManager;
        if (!this.loadingMap && inputManager?.getIsRightMouseDown() && inputManager.getActivePointer() && this.cameras?.main && this.player) {
            if (this.player.hasPendingSpell()) {
                return;
            }
            if (!this.player.getIsMoving()) {
                const pointer = inputManager.getActivePointer()!;
                const camera = this.cameras.main;

                // Convert screen position to world position manually
                const worldPixelX = pointer.x + camera.scrollX;
                const worldPixelY = pointer.y + camera.scrollY;

                // Calculate direction from player to cursor
                const direction = getNextDirection(
                    this.player.getWorldX(),
                    this.player.getWorldY(),
                    convertPixelPosToWorldPos(worldPixelX),
                    convertPixelPosToWorldPos(worldPixelY)
                );

                // Turn player towards cursor direction
                if (direction !== Direction.None) {
                    this.player.turnTowardsDirection(direction);
                }
            }
        }
    }

    private getCurrentMap(): HBMap {
        return this.mapManager!.getCurrentMap();
    }

    /**
     * Finds the top-most monster under the pointer (if any).
     * Uses SpatialGrid to limit bounds checks to monsters in nearby cells.
     */
    private getMonsterUnderPointer(pointer: Phaser.Input.Pointer): Monster | undefined {
        if (!this.cameras?.main) {
            return undefined;
        }
        const camera = this.cameras.main;
        const worldPixelX = pointer.x + camera.scrollX;
        const worldPixelY = pointer.y + camera.scrollY;

        const candidates = getObjectsNearPixel(
            this.monsters,
            (m) => ({ x: m.getAnimatedPixelX(), y: m.getAnimatedPixelY() }),
            worldPixelX,
            worldPixelY,
            10
        );

        let topMonster: Monster | undefined;
        let topDepth = -Infinity;

        for (const monster of candidates) {
            const bounds = monster.getBounds();
            if (!bounds) {
                continue;
            }

            const inBounds =
                worldPixelX >= bounds.x &&
                worldPixelX <= bounds.x + bounds.width &&
                worldPixelY >= bounds.y &&
                worldPixelY <= bounds.y + bounds.height;

            if (inBounds) {
                const depth = monster.getDepth();
                if (depth > topDepth) {
                    topDepth = depth;
                    topMonster = monster;
                }
            }
        }
        return topMonster;
    }

    /**
     * Finds the top-most ground item in the world cell under the pointer (if any).
     * Uses SpatialGrid for O(1) cell lookup instead of linear scan.
     */
    private getGroundItemUnderPointer(pointer: Phaser.Input.Pointer): GroundItem | undefined {
        if (!this.cameras?.main) {
            return undefined;
        }
        const camera = this.cameras.main;
        const worldPixelX = pointer.x + camera.scrollX;
        const worldPixelY = pointer.y + camera.scrollY;
        const cellX = convertPixelPosToWorldPos(worldPixelX);
        const cellY = convertPixelPosToWorldPos(worldPixelY);

        const candidates = getObjectsAtWorldCell(
            this.groundItems,
            (g) => ({ worldX: g.worldX, worldY: g.worldY }),
            cellX,
            cellY
        );

        let topItem: GroundItem | undefined;
        let topDepth = -Infinity;

        for (const g of candidates) {
            const depth = g.getDepth();
            if (depth > topDepth) {
                topDepth = depth;
                topItem = g;
            }
        }
        return topItem;
    }

    private setupMapManager(): void {
        let savedOverlayVisible = false;
        let savedTextVisible = false;
        this.mapManager = new MapManager({
            scene: this,
            playMapMusic: this.playMapMusic,
            onBeforeSnapshot: () => {
                savedOverlayVisible = this.loadingOverlay?.visible ?? false;
                savedTextVisible = this.loadingText?.visible ?? false;
                this.loadingOverlay?.setVisible(false);
                this.loadingText?.setVisible(false);
            },
            onAfterSnapshot: () => {
                if (this.loadingOverlay && savedOverlayVisible) {
                    this.loadingOverlay.setVisible(true);
                }
                if (this.loadingText && savedTextVisible) {
                    this.loadingText.setVisible(true);
                }
            }
        });
    }

    private setupCameraManager(): void {
        this.cameraManager = new CameraManager({
            scene: this,
            isCapturingMinimap: () => this.mapManager?.getIsCapturingMinimap() ?? false,
            getFollowTarget: () =>
                this.player
                    ? { x: this.player.getAnimatedPixelX(), y: this.player.getAnimatedPixelY() }
                    : undefined,
        });
        this.cameraManager.setupEventListeners();
        this.mapManager?.setCameraManager(this.cameraManager);
    }

    private setupControlDialogEventListeners(): void {
        // Listen for player movement speed changes from React
        EventBus.on(IN_UI_CHANGE_MOVEMENT_SPEED, (sliderValue: number) => {
            if (this.player) {
                this.player.setMovementSpeed(sliderValue);
            }
            getGameStateManager(this.game).setMovementSpeed(sliderValue);
        });

        // Listen for player attack speed changes from React
        EventBus.on(IN_UI_CHANGE_ATTACK_SPEED, (sliderValue: number) => {
            if (this.player) {
                this.player.setAttackSpeed(sliderValue);
            }
            getGameStateManager(this.game).setAttackSpeed(sliderValue);
        });

        // Listen for player cast speed changes from React
        EventBus.on(IN_UI_CHANGE_CAST_SPEED, (sliderValue: number) => {
            if (this.player) {
                this.player.setCastSpeed(sliderValue);
            }
            getGameStateManager(this.game).setCastSpeed(sliderValue);
        });

        // Listen for player attack range changes from React
        EventBus.on(IN_UI_CHANGE_ATTACK_RANGE, (range: number) => {
            if (this.player) {
                this.player.setAttackRange(range);
            }
            getGameStateManager(this.game).setAttackRange(range);
        });

        // Listen for player damage changes from React
        EventBus.on(IN_UI_CHANGE_DAMAGE, (damage: number) => {
            if (this.player) {
                this.player.setDamage(damage);
            }
        });

        // Listen for player transparency changes from React
        EventBus.on(IN_UI_CHANGE_TRANSPARENCY, (value: number) => {
            if (this.player) {
                this.player.setTransparency(value);
            }
        });

        EventBus.on(IN_UI_CHANGE_ATTACK_TYPE, (attackType: AttackType) => {
            if (this.player) {
                this.player.setAttackType(attackType);
            }
            getGameStateManager(this.game).setAttackType(attackType);
        });

        EventBus.on(IN_UI_CHANGE_ATTACK_MODE, (enabled: boolean) => {
            if (this.player) {
                this.player.setAttackMode(enabled);
            }
            getGameStateManager(this.game).setAttackMode(enabled);
        });

        EventBus.on(IN_UI_CHANGE_RUN_MODE, (enabled: boolean) => {
            if (this.player) {
                this.player.setRunMode(enabled);
            }
            getGameStateManager(this.game).setRunMode(enabled);
        });

        // Listen for chilled effect changes from React
        EventBus.on(IN_UI_CHANGE_CHILLED_EFFECT, (enabled: boolean) => {
            if (this.player) {
                this.player.setChilledEffect(enabled);
            }
        });

        // Listen for berserked effect changes from React
        EventBus.on(IN_UI_CHANGE_BERSERKED_EFFECT, (enabled: boolean) => {
            if (this.player) {
                this.player.setBerserkEffect(enabled);
            }
        });

        // Listen for map change events from React
        EventBus.on(IN_UI_CHANGE_MAP, (mapName: string) => {
            // Clear LootManager state when map changes (dropped items don't persist across maps)
            getLootManager(this.game).clear();

            // Save game state before map change
            // Set coordinates to -1 to indicate map change - GameWorld will use center position
            // Movement speed, camera zoom, and music volume should already be updated via their respective event handlers
            const gameStateManager = getGameStateManager(this.game);
            gameStateManager.setMap(mapName);
            gameStateManager.setWorldPos(-1, -1);
            gameStateManager.saveGameState();
            console.log('[GameWorld] Saved game state (map change)');
            this.scene.restart();
        });

        EventBus.on(IN_UI_PLAYER_RESURRECT, () => {
            this.player?.resurrect();
        });

        // Listen for player logout events from React
        EventBus.on(IN_UI_REQUEST_PLAYER_LOGOUT, () => {
            // Stop music before saving state
            getMusicManager(this).stopMusic();

            // Save game state before logout
            const gameStateManager = getGameStateManager(this.game);
            if (this.player) {
                gameStateManager.setWorldPos(this.player.getWorldX(), this.player.getWorldY());
            }
            gameStateManager.saveGameState();

            // Navigate back to LoginScreen
            this.scene.start('LoginScreen');
        });
    }

    private setupSoundDialogEventListeners(): void {
        // Listen for music play requests from React
        EventBus.on(IN_UI_PLAY_MUSIC, (musicFile: string) => {
            getMusicManager(this).playMusic(musicFile);
            // Emit event to notify React layer of music change
            EventBus.emit(OUT_UI_SET_SELECTED_MUSIC, musicFile);
        });

        // Listen for play map music setting changes from React
        EventBus.on(IN_UI_CHANGE_PLAY_MAP_MUSIC, (enabled: boolean) => {
            this.playMapMusic = enabled;
        });

        // Listen for music volume changes from React
        EventBus.on(IN_UI_CHANGE_MUSIC_VOLUME, (volume: number) => {
            getMusicManager(this).setMusicVolume(volume);
            // Update GameStateManager
            getGameStateManager(this.game).setMusicVolume(volume);
        });

        // Listen for sound volume changes from React
        EventBus.on(IN_UI_CHANGE_SOUND_VOLUME, (volume: number) => {
            if (this.soundManager) {
                this.soundManager.setSoundVolume(volume);
            }
            // Update GameStateManager
            getGameStateManager(this.game).setSoundVolume(volume);
        });
    }

    private setupSummonDialogEventListeners(): void {
        // Listen for summon monster events from React
        EventBus.on(IN_UI_SUMMON_MONSTER, (data: SummonMonsterEvent) => {
            if (!this.player) {
                console.warn('[GameWorld] Cannot summon monster: player not found');
                return;
            }

            const map = this.getCurrentMap();
            const playerWorldX = this.player.getWorldX();
            const playerWorldY = this.player.getWorldY();

            // Find nearest movable location from player position
            const movableLocation = findMovableLocation(map, playerWorldX, playerWorldY);

            if (!movableLocation) {
                console.warn('[GameWorld] Cannot summon monster: no movable location found near player');
                return;
            }

            // Get monster data to retrieve sounds
            const monsterData = MONSTERS.find(monster => monster.spriteName === data.spriteName);

            if (!monsterData) {
                console.warn(`[GameWorld] Cannot summon monster: unknown sprite ${data.spriteName}`);
                return;
            }

            // Generate unique monster ID
            const monsterId = this.nextMonsterId++;

            // Create new monster at the movable location
            const monster = new Monster(this, {
                x: movableLocation.x,
                y: movableLocation.y,
                spriteName: data.spriteName,
                displayName: monsterData.name,
                direction: data.direction,
                hp: data.health,
                maxHp: data.health,
                attackDamage: data.damage,
                soundManager: this.soundManager,
                map,
                states: monsterData.states,
                movementSpeed: data.movementSpeed,
                attackSpeed: data.attackSpeed,
                player: this.player,
                playerIsDead: this.player?.getIsDead() ?? false,
                followDistance: data.followDistance,
                attackDistance: data.attackDistance,
                attackType: data.attackType,
                corpseDecayTime: monsterData.corpseDecayTime,
                monsterId,
                temporalCoefficient: monsterData.temporalCoefficient,
                shadow: monsterData.shadow,
                opacity: monsterData.opacity,
                height: monsterData.height,
                bowAttack: monsterData.bowAttack,
                transparency: data.transparency,
                chilledEffect: data.chilledEffect,
                berserkedEffect: data.berserkedEffect,
            });

            this.monsters.push(monster);
            console.log(`[GameWorld] Summoned ${data.spriteName} (ID: ${monsterId}) at (${movableLocation.x}, ${movableLocation.y}) with speed ${data.movementSpeed}, attack speed ${data.attackSpeed}, follow distance ${data.followDistance}, attack distance ${data.attackDistance}`);
        });

        // Listen for summon NPC events from React
        EventBus.on(IN_UI_SUMMON_NPC, (data: SummonNPCEvent) => {
            if (!this.player) {
                console.warn('[GameWorld] Cannot summon NPC: player not found');
                return;
            }

            const map = this.getCurrentMap();
            const playerWorldX = this.player.getWorldX();
            const playerWorldY = this.player.getWorldY();

            // Find nearest movable location from player position
            const movableLocation = findMovableLocation(map, playerWorldX, playerWorldY);

            if (!movableLocation) {
                console.warn('[GameWorld] Cannot summon NPC: no movable location found near player');
                return;
            }

            const npcData = getNPCData(data.spriteName);

            if (!npcData) {
                console.warn(`[GameWorld] Cannot summon NPC: unknown sprite ${data.spriteName}`);
                return;
            }

            const npcId = this.nextNPCId++;

            const npc = new NPC(this, {
                x: movableLocation.x,
                y: movableLocation.y,
                spriteName: data.spriteName.toLowerCase(),
                displayName: npcData.name,
                direction: data.direction,
                soundManager: this.soundManager,
                map,
                npcId,
            });

            this.npcs.push(npc);
            console.log(`[GameWorld] Summoned NPC ${data.spriteName} (ID: ${npcId}) at (${movableLocation.x}, ${movableLocation.y})`);
        });
    }

    private setupNPCEventListeners(): void {
        // Listen for NPC death events to remove them from the game
        EventBus.on(NPC_DEAD, (data: { npcId: number }) => {
            const npcIndex = this.npcs.findIndex((n) => n.getNPCId() === data.npcId);
            if (npcIndex !== -1) {
                const npc = this.npcs[npcIndex];
                console.log(`[GameWorld] NPC ${data.npcId} removed from game`);
                npc.destroy();
                this.npcs.splice(npcIndex, 1);
            }
        });

        // Listen for kill all NPCs events
        EventBus.on(IN_UI_KILL_ALL_NPCS, () => {
            console.log(`[GameWorld] Killing all NPCs (${this.npcs.length} total)`);
            [...this.npcs].forEach((npc) => npc.kill());
        });
    }

    private setupCastManager(): void {
        this.castManager = new CastManager({
            scene: this,
            soundManager: this.soundManager,
            cameraManager: this.cameraManager,
            getPlayerWorldPos: () =>
                this.player ? { x: this.player.getWorldX(), y: this.player.getWorldY() } : undefined,
        });
        this.castManager.setupEventListeners();
    }

    private setupSpellRequestListener(): void {
        EventBus.on(IN_UI_CAST_SPELL, (data: CastSpellEvent) => {
            this.player?.requestCast(data.spellId, data.useCastAnimation ?? false);
        });
    }

    private setupPlayerEventListeners(): void {
        // Listen for player position changes to update monster spatial audio
        EventBus.on(PLAYER_POSITION_CHANGED, (data: { x: number; y: number }) => {
            this.updateMonsterSpatialAudio(data.x, data.y);
        });
    }

    private setupMonsterEventListeners(): void {
        EventBus.on(MONSTER_ATTACK_HIT_PLAYER, (data: MonsterAttackPlayerEvent) => {
            if (this.player) {
                const monster = this.monsters.find(m => m.getMonsterId() === data.monsterId);
                if (monster) {
                    if (data.bowAttack && isArrowProjectileTarget(this.player)) {
                        new ArrowProjectile(this, {
                            originPixelX: monster.getAnimatedPixelX(),
                            originPixelY: monster.getAnimatedPixelY(),
                            target: this.player,
                            speed: 1000,
                            onReachDestination: () => {
                                this.player!.takeDamage(data.attackType, data.attackDamage, monster.getWorldX(), monster.getWorldY());
                            },
                        });
                    } else {
                        this.player.takeDamage(data.attackType, data.attackDamage, monster.getWorldX(), monster.getWorldY());
                    }
                } else {
                    console.warn(`[GameWorld] Monster ${data.monsterId} not found for attack hit, skipping`);
                }
            }
        });

        // Listen for monster death events to remove them from the game
        EventBus.on(MONSTER_DEAD, (data: { monsterId: number }) => {
            const monsterIndex = this.monsters.findIndex(m => m.getMonsterId() === data.monsterId);
            if (monsterIndex !== -1) {
                const monster = this.monsters[monsterIndex];
                console.log(`[GameWorld] Monster ${data.monsterId} died, removing from game`);

                // Clear player's attack target if it was this monster
                if (this.player && this.player.getAttackTarget() === monster) {
                    this.player.clearAttackTarget();
                }

                // Destroy monster and remove from list
                monster.destroy();
                this.monsters.splice(monsterIndex, 1);
            }
        });

        // Listen for kill all monsters events
        EventBus.on(IN_UI_KILL_ALL_MONSTERS, () => {
            console.log(`[GameWorld] Killing all monsters (${this.monsters.length} total)`);
            for (const monster of this.monsters) {
                monster.kill();
            }
        });
    }

    private setupLootEventListeners(): void {
        EventBus.on(ITEM_DROPPED_TO_GROUND, (data: { worldX: number; worldY: number; itemId: number; itemUid: number; quantity: number; tint?: number; effectOverrides?: Effect[] }) => {
            if (!this.player) {
                return;
            }

            const existingIndex = this.groundItems.findIndex(
                (g) => g.worldX === data.worldX && g.worldY === data.worldY
            );
            if (existingIndex >= 0) {
                const [removed] = this.groundItems.splice(existingIndex, 1);
                removed.destroy();
            }

            const playerGender = getGameStateManager(this.game).getGender();
            try {
                const groundItem = new GroundItem(
                    this,
                    data.worldX,
                    data.worldY,
                    data.itemId,
                    data.itemUid,
                    data.quantity,
                    playerGender,
                    data.tint,
                    data.effectOverrides
                );
                groundItem.setDepth(data.worldY * DEPTH_MULTIPLIER - DEPTH_MULTIPLIER / 2);
                this.groundItems.push(groundItem);
            } catch (error) {
                console.warn('[GameWorld] Failed to create GroundItem:', error);
            }
        });

        EventBus.on(ITEM_PICKUP_ATTEMPTED, (data: { worldX: number; worldY: number }) => {
            const lootManager = getLootManager(this.game);
            const topItem = lootManager.removeTopItem(data.worldX, data.worldY);
            if (!topItem) {
                return;
            }

            EventBus.emit(ITEM_ADD_FROM_GROUND, {
                itemId: topItem.itemId,
                itemUid: topItem.itemUid,
                quantity: topItem.quantity,
                ...(topItem.effectOverrides?.length && { effectOverrides: topItem.effectOverrides }),
            });

            const toRemove = this.groundItems.filter(
                (g) => g.worldX === data.worldX && g.worldY === data.worldY
            );
            this.groundItems = this.groundItems.filter(
                (g) => g.worldX !== data.worldX || g.worldY !== data.worldY
            );
            for (const g of toRemove) {
                g.destroy();
            }

            const newTop = lootManager.getTopItem(data.worldX, data.worldY);
            if (newTop) {
                const playerGender = getGameStateManager(this.game).getGender();
                try {
                    const groundItem = new GroundItem(
                        this,
                        data.worldX,
                        data.worldY,
                        newTop.itemId,
                        newTop.itemUid,
                        newTop.quantity,
                        playerGender,
                        newTop.tint,
                        newTop.effectOverrides
                    );
                    groundItem.setDepth(data.worldY * DEPTH_MULTIPLIER - DEPTH_MULTIPLIER / 2);
                    this.groundItems.push(groundItem);
                } catch (error) {
                    console.warn('[GameWorld] Failed to create GroundItem for stack:', error);
                }
            }
        });
    }

    /**
     * Updates player position for all monsters and their spatial audio.
     * 
     * @param playerX - Player's world X coordinate
     * @param playerY - Player's world Y coordinate
     */
    private updateMonsterSpatialAudio(playerX: number, playerY: number): void {
        for (const monster of this.monsters) {
            monster.updatePlayerPosition(playerX, playerY);
        }
    }

    private setupMapDialogEventListeners(): void {
        // Listen for non-movable cells highlight toggle events from React
        EventBus.on(IN_UI_TOGGLE_NON_MOVABLE_CELLS_HIGHLIGHT, (enabled: boolean) => {
            const currentMap = this.getCurrentMap();
            if (enabled) {
                currentMap.enableNonMovableCellsHighlight(this);
            } else {
                currentMap.disableNonMovableCellsHighlight();
            }
        });

        // Listen for teleport cells highlight toggle events from React
        EventBus.on(IN_UI_TOGGLE_TELEPORT_CELLS_HIGHLIGHT, (enabled: boolean) => {
            const currentMap = this.getCurrentMap();
            if (enabled) {
                currentMap.enableTeleportCellsHighlight(this);
            } else {
                currentMap.disableTeleportCellsHighlight();
            }
        });

        // Listen for water cells highlight toggle events from React
        EventBus.on(IN_UI_TOGGLE_WATER_CELLS_HIGHLIGHT, (enabled: boolean) => {
            const currentMap = this.getCurrentMap();
            if (enabled) {
                currentMap.enableWaterCellsHighlight(this);
            } else {
                currentMap.disableWaterCellsHighlight();
            }
        });

        // Listen for farmable cells highlight toggle events from React
        EventBus.on(IN_UI_TOGGLE_FARMABLE_CELLS_HIGHLIGHT, (enabled: boolean) => {
            const currentMap = this.getCurrentMap();
            if (enabled) {
                currentMap.enableFarmableCellsHighlight(this);
            } else {
                currentMap.disableFarmableCellsHighlight();
            }
        });

        // Listen for map tiles render toggle events from React
        EventBus.on(IN_UI_TOGGLE_RENDER_MAP_TILES, (enabled: boolean) => {
            const currentMap = this.getCurrentMap();
            if (enabled) {
                currentMap.renderMapTiles(this);
            } else {
                currentMap.destroyMapTiles(this);
            }
        });

        // Listen for map objects render toggle events from React
        EventBus.on(IN_UI_TOGGLE_RENDER_MAP_OBJECTS, (enabled: boolean) => {
            const currentMap = this.getCurrentMap();
            if (enabled) {
                currentMap.renderMapObjects(this);
            } else {
                currentMap.destroyMapObjects();
            }
        });

        // Listen for debug mode toggle events from React
        EventBus.on(IN_UI_TOGGLE_DEBUG_MODE, (enabled: boolean) => {
            setDebugModeEnabled(this, enabled);
        });

        // Listen for grid display toggle events from React
        EventBus.on(IN_UI_TOGGLE_GRID_DISPLAY, (enabled: boolean) => {
            const currentMap = this.getCurrentMap();
            if (enabled) {
                currentMap.enableGridDisplay(this);
            } else {
                currentMap.disableGridDisplay();
            }
        });

        // Listen for display large items toggle events from React
        EventBus.on(IN_UI_TOGGLE_DISPLAY_LARGE_ITEMS, (enabled: boolean) => {
            setDisplayLargeItemsEnabled(this, enabled);
        });

        // Listen for weather change events from React
        EventBus.on(IN_UI_CHANGE_WEATHER, (weather: import('../../ui/store/MapDialog.store').WeatherMode) => {
            this.weatherManager?.setWeather(weather);
        });
    }

    private setupInputManager(): void {
        this.inputManager = new InputManager({
            scene: this,
            isEnabled: () => !this.loadingMap,
            onPointerMove: (worldPixelX, worldPixelY) => {
                this.getCurrentMap().updateHoverCell(this, worldPixelX, worldPixelY);
            },
            onPointerDown: (pointer) => {
                if (pointer.leftButtonDown() && this.player && this.cameras?.main) {
                    if (this.castManager?.getPendingEffectKey() || this.player.hasPendingSpell()) {
                        return;
                    }
                    const monster = this.getMonsterUnderPointer(pointer);
                    if (monster) {
                        this.player.attack(monster);
                    }
                } else if (pointer.rightButtonDown() && this.player) {
                    if (this.castManager?.getPendingEffectKey()) {
                        this.castManager.clearPendingEffect();
                        return;
                    }
                    if (this.player.hasPendingSpell()) {
                        this.player.onRightClick();
                        return;
                    }
                    this.player.cancelMovement();
                }
            },
            onPointerUp: (pointer) => {
                if (!this.player || !this.cameras?.main) {
                    return;
                }
                if (this.castManager?.getPendingEffectKey() || this.player.hasPendingSpell()) {
                    return;
                }
                if (this.castManager?.getCastReady()) {
                    this.castManager.setCastReady(false);
                    return;
                }
                const monster = this.getMonsterUnderPointer(pointer);
                if (monster && !monster.getIsDead()) {
                    this.player.attack(monster);
                    if (getDistance(
                        this.player.getWorldX(),
                        this.player.getWorldY(),
                        monster.getWorldX(),
                        monster.getWorldY()
                    ) > this.player.getAttackRange()) {
                        this.player.setDestination(monster.getWorldX(), monster.getWorldY(), false);
                    }
                    return;
                }
                const camera = this.cameras.main;
                const worldPixelX = pointer.x + camera.scrollX;
                const worldPixelY = pointer.y + camera.scrollY;
                let destX = convertPixelPosToWorldPos(worldPixelX);
                let destY = convertPixelPosToWorldPos(worldPixelY);
                const distanceToDest = getDistance(
                    this.player.getWorldX(),
                    this.player.getWorldY(),
                    destX,
                    destY
                );
                if (distanceToDest === 0) {
                    // Click on own cell: switch to PickUp mode (play pickup animation)
                    this.player.requestPickUp();
                    return;
                }
                if (distanceToDest < 2) {
                    // If player is moving towards adjacent cell, stop the movement, instead of trying to find pathfinded route
                    this.player.cancelMovement();
                    return;
                }
                const map = this.getCurrentMap();
                if (!isCellMovable(map, destX, destY)) {
                    const movableLocation = findMovableLocation(map, destX, destY);
                    if (movableLocation) {
                        destX = movableLocation.x;
                        destY = movableLocation.y;
                    }
                }
                this.player.setDestination(destX, destY, false);
            }
        });
        this.inputManager.setup();
    }

    private setupCameraStatsUpdateInterval(): void {
        // Track actual cursor position for elementFromPoint - Phaser's pointer can be stale when cursor is over DOM overlays (e.g. inventory dialog)
        const handleMouseMove = (e: MouseEvent) => {
            this.lastCursorPosition = { x: e.clientX, y: e.clientY };
        };
        document.addEventListener('mousemove', handleMouseMove, { passive: true });
        this.cursorPositionCleanup = () => {
            document.removeEventListener('mousemove', handleMouseMove);
        };

        // Set up interval to emit FPS, camera position, and player position updates every 20ms
        this.updateInterval = window.setInterval(() => {
            // Check if game, cameras, and main camera are still valid
            if (!this.game || !this.cameras || !this.cameras.main) {
                return;
            }

            try {
                const fps = Math.round(this.game.loop.actualFps);
                const camX = Math.round(this.cameras.main.scrollX);
                const camY = Math.round(this.cameras.main.scrollY);

                // Include player position if player exists
                let playerSceneX: number | undefined = undefined;
                let playerSceneY: number | undefined = undefined;
                let playerWorldX: number | undefined = undefined;
                let playerWorldY: number | undefined = undefined;

                let playerGender: Gender | undefined = undefined;
                if (this.player) {
                    playerSceneX = Math.round(this.player.getPixelX());
                    playerSceneY = Math.round(this.player.getPixelY());
                    playerWorldX = this.player.getWorldX();
                    playerWorldY = this.player.getWorldY();
                    playerGender = this.player.getGender();
                }

                EventBus.emit(OUT_UI_GAME_STATS_UPDATE, {
                    fps,
                    cameraX: camX,
                    cameraY: camY,
                    playerSceneX,
                    playerSceneY,
                    playerWorldX,
                    playerWorldY,
                    playerGender,
                });

                // Broadcast monster and ground item hover state
                const pointer = this.input.activePointer;
                const hoveredMonster = pointer ? this.getMonsterUnderPointer(pointer) : undefined;
                const hoveredGroundItem = pointer ? this.getGroundItemUnderPointer(pointer) : undefined;
                EventBus.emit(OUT_UI_HOVER_GROUND_ITEM, !!hoveredGroundItem);
                // Use actual cursor position for elementFromPoint - Phaser's pointer can be stale when cursor is over DOM overlays (inventory, etc.)
                const checkX = this.lastCursorPosition?.x ?? (pointer ? canvasToScreenPosition(pointer.x, pointer.y, this.game).screenX : 0);
                const checkY = this.lastCursorPosition?.y ?? (pointer ? canvasToScreenPosition(pointer.x, pointer.y, this.game).screenY : 0);
                const el = document.elementFromPoint(checkX, checkY);
                if (el === this.game.canvas && pointer) {
                    const { screenX, screenY } = canvasToScreenPosition(pointer.x, pointer.y, this.game);
                    EventBus.emit(
                        OUT_UI_HOVER_GROUND_ITEM_INFO,
                        hoveredGroundItem ? hoveredGroundItem.getHoverInfo(screenX, screenY) : undefined
                    );
                }
                if (hoveredMonster && !hoveredMonster.getIsDead()) {
                    const anchorX = hoveredMonster.getAnimatedPixelX();
                    const anchorY = hoveredMonster.getAnimatedPixelY() + MONSTER_HOVER_OVERLAY_ANCHOR_OFFSET_Y;
                    const camera = this.cameras.main;
                    const canvasX = anchorX - camera.scrollX;
                    const canvasY = anchorY - camera.scrollY;
                    const { screenX: overlayScreenX, screenY: overlayScreenY } = canvasToScreenPosition(canvasX, canvasY, this.game);
                    const info: MonsterHoverInfo = {
                        name: hoveredMonster.getDisplayName(),
                        hp: hoveredMonster.getHp(),
                        maxHp: hoveredMonster.getMaxHp(),
                        overlayScreenX,
                        overlayScreenY,
                        damage: hoveredMonster.getAttackDamage(),
                        movementSpeed: hoveredMonster.getMovementSpeed(),
                        attackSpeed: hoveredMonster.getAttackSpeed(),
                        attackType: hoveredMonster.getAttackType(),
                        followDistance: hoveredMonster.getFollowDistance(),
                        attackDistance: hoveredMonster.getAttackDistance(),
                    };
                    EventBus.emit(OUT_UI_HOVER_MONSTER, info);
                } else {
                    EventBus.emit(OUT_UI_HOVER_MONSTER, undefined);
                }
            } catch (error) {
                console.warn('Failed to update game stats:', error);
            }
        }, GAME_STATS_UPDATE_INTERVAL_MS);
    }

    /**
     * Initializes game objects (player and NPCs) after minimap capture is complete.
     * This is called by captureMinimap() to ensure objects don't appear in the minimap.
     */
    private initializeGameObjects(): void {
        // Get GameStateManager using helper function
        const gameStateManager = getGameStateManager(this.game);
        const map = this.getCurrentMap();

        let playerWorldX: number;
        let playerWorldY: number;

        const savedWorldPosX = gameStateManager.getWorldPosX();
        const savedWorldPosY = gameStateManager.getWorldPosY();

        if (savedWorldPosX === -1 || savedWorldPosY === -1) {
            // Coordinates are -1, indicating map change - use center position
            playerWorldX = Math.floor(map.sizeX / 2);
            playerWorldY = Math.floor(map.sizeY / 2);
            console.log('[GameWorld] Map change detected (coords = -1), using center position:', { playerWorldX, playerWorldY });
        } else {
            // Same map - use saved coordinates
            playerWorldX = savedWorldPosX;
            playerWorldY = savedWorldPosY;
            console.log('[GameWorld] Using saved coordinates:', { playerWorldX, playerWorldY });
        }

        // Check if the calculated position is movable, if not find nearest movable location
        const initialTile = map.getTile(playerWorldX, playerWorldY);
        if (!initialTile || !initialTile.isMoveAllowed) {
            console.log('[GameWorld] Initial position is not movable, searching for movable location...');
            const movableLocation = findMovableLocation(map, playerWorldX, playerWorldY);
            if (movableLocation) {
                playerWorldX = movableLocation.x;
                playerWorldY = movableLocation.y;
                console.log('[GameWorld] Found movable location:', { playerWorldX, playerWorldY });
            } else {
                console.warn('[GameWorld] No movable location found near initial position, using original coordinates');
            }
        }

        // Create player at saved coordinates or default center position
        const gear = {
            ...DEFAULT_GEAR,
            underwearColorIndex: gameStateManager.getUnderwearColorIndex(),
            hairStyleIndex: gameStateManager.getHairStyleIndex(),
        };
        this.player = new Player(this, playerWorldX, playerWorldY, 1, this.soundManager, map, gear);

        // Update GameStateManager with initial player position
        gameStateManager.setWorldPos(playerWorldX, playerWorldY);

        // Apply saved movement speed from GameStateManager
        const savedMovementSpeed = gameStateManager.getMovementSpeed();
        this.player.setMovementSpeed(savedMovementSpeed);

        // Apply saved attack speed, range, type, cast speed, attack mode, and run mode from GameStateManager
        this.player.setAttackSpeed(gameStateManager.getAttackSpeed());
        this.player.setAttackRange(gameStateManager.getAttackRange());
        this.player.setDamage(playerDialogStore.state.damage);
        this.player.setAttackType(gameStateManager.getAttackType());
        this.player.setCastSpeed(gameStateManager.getCastSpeed());
        this.player.setAttackMode(gameStateManager.getAttackMode());
        this.player.setRunMode(gameStateManager.getRunMode());

        // Apply transparency and effects from PlayerDialog store
        this.player.setTransparency(playerDialogStore.state.transparency);
        this.player.setChilledEffect(playerDialogStore.state.chilledEffect);
        this.player.setBerserkEffect(playerDialogStore.state.berserkedEffect);

        // Apply saved music volume from GameStateManager
        const savedMusicVolume = gameStateManager.getMusicVolume();
        getMusicManager(this).setMusicVolume(savedMusicVolume);

        // Apply saved sound volume from GameStateManager
        const savedSoundVolume = gameStateManager.getSoundVolume();
        this.soundManager.setSoundVolume(savedSoundVolume);

        // Center camera around player
        this.cameraManager?.centerOn(convertWorldPosToPixelPos(playerWorldX), convertWorldPosToPixelPos(playerWorldY));
    }

    /**
     * Completes map setup after minimap capture by initializing game objects
     * and setting up overlay removal timing.
     * This is called AFTER the minimap snapshot has been taken, so it's safe to apply the saved zoom here.
     */
    private setupMap(map: HBMap): void {
        this.displayedMap = map;
        // Now initialize game objects (player, NPCs, etc.)
        this.initializeGameObjects();

        // Apply camera zoom AFTER minimap snapshot has been taken
        // This ensures the zoom is applied to the main camera, not the minimap snapshot camera
        // Get camera zoom from GameStateManager (saved zoom level as percentage 20-200, where 100 = zoom 1.0)
        const gameStateManager = getGameStateManager(this.game);
        const savedCameraZoom = gameStateManager.getCameraZoom();
        // Convert percentage to zoom value (e.g., 100% = 1.0, 50% = 0.5, 200% = 2.0)
        const cameraZoom = savedCameraZoom / 100;
        this.cameraManager?.setZoom(cameraZoom);
        console.log('[GameWorld] Applied saved camera zoom after minimap snapshot:', savedCameraZoom, '% =', cameraZoom);

        // Defer overlay removal using frame-based approach
        // Wait many frames after camera restoration to ensure no flash is visible
        this.framesUntilOverlayRemoval = FRAMES_UNTIL_OVERLAY_REMOVAL;

        // Map has been fully loaded
        this.loadingMap = false;
    }

    /**
     * Checks for collisions between the player and static map objects.
     * If the player collides with a map object and the player is behind it (lower depth),
     * makes the map object 50% transparent.
     * 
     * Uses spatial grid for efficient object lookup:
     * - Phase 1: Get objects within 20 grid cells using spatial grid (fast)
     * - Phase 2: Filter by accurate 10-cell radius distance (precise)
     * - Phase 3: Check pixel-perfect collision (accurate)
     */
    private handleMapObjectCollisions(): void {
        if (!this.player) {
            return;
        }

        const map = this.getCurrentMap();
        const spatialGrid = map.getSpatialGrid();

        // Get player's cell bounds (current cell position + 4 cells above, 1 cell horizontal padding)
        const playerWorldX = this.player.getWorldX();
        const playerWorldY = this.player.getWorldY();
        const playerCellX = convertWorldPosToPixelPos(playerWorldX);
        const playerCellY = convertWorldPosToPixelPos(playerWorldY);
        const boundsRadiusCells = 1; // Horizontal and vertical padding around player for collision check
        const playerCellBounds = {
            x: playerCellX - (boundsRadiusCells * TILE_SIZE),
            y: playerCellY - (4 * TILE_SIZE), // Extend 4 cells upward
            width: TILE_SIZE * (1 + boundsRadiusCells * 2),
            height: TILE_SIZE * 5 // Current cell + 4 cells above
        };

        // Get player depth
        const playerDepth = this.player.getDepth();

        // Phase 1: Use spatial grid to get objects within radius (fast)
        const candidateObjects = spatialGrid.getNearby(playerCellX, playerCellY, MAP_OBJECT_COLLISION_GRID_RADIUS_CELLS);

        // Phase 2: Filter candidates by accurate distance check (precise)
        const radiusSquared = MAP_OBJECT_COLLISION_RADIUS_CELLS * MAP_OBJECT_COLLISION_RADIUS_CELLS; // Use squared distance to avoid sqrt
        const nearbyMapObjects = candidateObjects.filter((mapObject) => {
            // Get map object's pixel position
            const mapObjectPixelX = mapObject.sprite.x;
            const mapObjectPixelY = mapObject.sprite.y;

            // Convert to world coordinates (cell coordinates)
            const mapObjectWorldX = convertPixelPosToWorldPos(mapObjectPixelX);
            const mapObjectWorldY = convertPixelPosToWorldPos(mapObjectPixelY);

            // Calculate squared distance (avoid sqrt for performance)
            const dx = mapObjectWorldX - playerWorldX;
            const dy = mapObjectWorldY - playerWorldY;
            const distanceSquared = dx * dx + dy * dy;

            // Return true if within radius
            return distanceSquared <= radiusSquared;
        });

        // Track which objects are currently colliding
        const currentlyColliding = new Set<GameAsset>();

        // Phase 3: Check accurate pixel-perfect collision with nearby map objects
        for (const mapObject of nearbyMapObjects) {
            const mapObjectBounds = mapObject.getBounds();
            const mapObjectDepth = mapObject.getDepth();

            // Check if player cell bounds intersect with map object sprite bounds
            const isColliding = this.rectanglesIntersect(playerCellBounds, mapObjectBounds);

            if (isColliding) {
                currentlyColliding.add(mapObject);

                // If player is behind the map object (player depth < map object depth), make it transparent
                if (playerDepth < mapObjectDepth) {
                    mapObject.setAlpha(MAP_OBJECT_COLLISION_ALPHA);
                } else {
                    // Player is in front, keep it opaque
                    mapObject.setAlpha(1.0);
                }
            } else {
                // Not colliding, restore full opacity if it was previously colliding
                if (this.collidingMapObjects.has(mapObject)) {
                    mapObject.setAlpha(1.0);
                }
            }
        }

        // Phase 4: Restore opacity for objects that were colliding but are no longer nearby.
        // When the player runs out from behind overlapping trees, some previously colliding
        // objects may fall outside the nearby radius and thus never get processed above.
        // Without this step, those objects would remain transparent indefinitely.
        for (const mapObject of this.collidingMapObjects) {
            if (!currentlyColliding.has(mapObject)) {
                mapObject.setAlpha(1.0);
            }
        }

        // Update the set of colliding objects
        this.collidingMapObjects = currentlyColliding;
    }

    /**
     * Checks if two rectangles intersect.
     * 
     * @param rect1 - First rectangle with x, y, width, height
     * @param rect2 - Second rectangle with x, y, width, height
     * @returns True if the rectangles intersect, false otherwise
     */
    private rectanglesIntersect(
        rect1: { x: number; y: number; width: number; height: number },
        rect2: { x: number; y: number; width: number; height: number }
    ): boolean {
        return (
            rect1.x < rect2.x + rect2.width &&
            rect1.x + rect1.width > rect2.x &&
            rect1.y < rect2.y + rect2.height &&
            rect1.y + rect1.height > rect2.y
        );
    }

}
