import { Scene } from 'phaser';
import { unzip } from 'fflate';

import { HBSpriteFile } from '../assets/HBSprite';
import { HBMap } from '../assets/HBMap';
import { getMapNames } from '../../constants/Maps';
import { drawAppTitle, drawVersionNumber } from '../../utils/SpriteUtils';
import { getAssets, AssetType, getCreatePhaseTotalActivities } from '../../constants/Assets';
import { getIgnoreZip, setIgnoreZip, getLoadingBgKey, setItemPackSpriteSheets, setItemPackEmittedTintKeys, setMap } from '../../utils/RegistryUtils';

// Total number of asset loading activities in create() phase
// Derived from the Assets collection
const CREATE_PHASE_TOTAL_ACTIVITIES = getCreatePhaseTotalActivities();

/**
 * Initial loading scene. Displays progress bar while loading assets (sprites, maps, music).
 * After loading, transitions to LoginScreen.
 */
export class LoadingScreen extends Scene {
    private progressBar!: Phaser.GameObjects.Rectangle;
    private progressBarOutline!: Phaser.GameObjects.Rectangle;
    private progressBarTrack!: Phaser.GameObjects.Rectangle;
    private createPhaseProgress: number = 0;
    private backgroundImage!: Phaser.GameObjects.Image;
    private progressBarLeftEdge!: number;
    private progressBarMaxWidth!: number;
    private currentProgress: number = 0; // Overall progress 0-1
    private loadingStartTime!: number;
    private usingZipLoading: boolean = false;
    
    // Timing metrics
    private phaseTimings: {
        downloadAssets?: number;
        downloadZip?: number;
        decompressZip?: number;
        registerBinary?: number;
        registerMusic?: number;
        parseSprites?: number;
        loadMaps?: number;
    } = {};

    constructor() {
        super('LoadingScreen');
    }

    public init() {
        // Store loading start time for performance measurement
        this.loadingStartTime = Date.now();
        
        // Set black background as fallback before image loads
        this.cameras.main.setBackgroundColor(0x000000);
        
        // Get scene dimensions
        const width = this.scale.width;
        const height = this.scale.height;

        // Display background image immediately (loaded in Boot.ts)
        // Get loading background image key from registry (loaded in Boot.ts)
        const loadingBgKey = getLoadingBgKey(this);
        
        // Add background image immediately so it displays before cache fetching
        if (loadingBgKey && this.textures.exists(loadingBgKey)) {
            this.backgroundImage = this.add.image(width / 2, height / 2, loadingBgKey);
            // Scale background to cover the entire scene
            const scaleX = width / this.backgroundImage.width;
            const scaleY = height / this.backgroundImage.height;
            const scale = Math.max(scaleX, scaleY);
            this.backgroundImage.setScale(scale);
            // Send background to back so progress bar appears on top
            this.backgroundImage.setDepth(0);
        }

        // RPG-themed progress bar at the bottom
        // Colors matching UI theme: leather border, brown-dark background, gold fill
        const barWidth = 320;
        const barHeight = 12;
        const barY = height - 40; // 40px from bottom
        const barX = width / 2;

        // Calculate track boundaries
        const trackLeftEdge = barX - barWidth / 2;
        const trackRightEdge = barX + barWidth / 2;
        
        // Progress bar should fit inside track with 1px padding on each side
        const padding = 1;
        this.progressBarLeftEdge = trackLeftEdge + padding;
        const progressBarRightEdge = trackRightEdge - padding;
        this.progressBarMaxWidth = progressBarRightEdge - this.progressBarLeftEdge;

        // Progress bar outline (border) - leather color
        this.progressBarOutline = this.add.rectangle(barX, barY, barWidth + 4, barHeight + 4, 0x704214);
        this.progressBarOutline.setStrokeStyle(2, 0x704214);
        this.progressBarOutline.setAlpha(1.0); // Fully opaque

        // Progress bar background track - dark brown
        this.progressBarTrack = this.add.rectangle(barX, barY, barWidth, barHeight, 0x2d1810);
        this.progressBarTrack.setAlpha(1.0); // Fully opaque

        // Progress bar fill - gold color (starts at 0 width, aligned with track)
        // Height is barHeight - 2 to have 1px padding top and bottom
        // Set origin to left-center so it grows from left to right
        this.progressBar = this.add.rectangle(
            this.progressBarLeftEdge, 
            barY, 
            0, 
            barHeight - 2, 
            0xd4af37
        );
        this.progressBar.setOrigin(0, 0.5); // Left-center origin
        this.progressBar.setAlpha(1.0); // Fully opaque

        drawVersionNumber(this);

        // Ensure progress bar elements are on top of background
        if (this.progressBarOutline) {
            this.progressBarOutline.setDepth(10);
        }
        if (this.progressBarTrack) {
            this.progressBarTrack.setDepth(10);
        }
        if (this.progressBar) {
            this.progressBar.setDepth(11);
        }

        // Check if we're using zip loading or traditional loading
        this.usingZipLoading = !getIgnoreZip(this);
        
        if (this.usingZipLoading) {
            // For zip loading, we manually control progress in create()
            // Progress phases: 0-25% fetch, 25-50% decompress, 50-100% process
        } else {
            // Use the 'progress' event emitted by the LoaderPlugin to update the loading bar
            // LoaderPlugin progress (0-1) maps to 0-50% of total progress
            this.load.on('progress', (progress: number) => {
                // Update current progress and refresh bar
                this.currentProgress = progress * 0.5;
                this.updateProgressBar();
            });
        }
    }

    private updateProgressBar() {
        // Guard: progress bar might not exist yet
        if (!this.progressBar || this.progressBarMaxWidth === undefined) {
            return;
        }
        
        // Clamp progress between 0 and 1
        const clampedProgress = Math.max(0, Math.min(1, this.currentProgress));
        
        // Calculate bar width from progress
        // Progress goes from 0 to 1, bar width goes from 0 to progressBarMaxWidth
        // Since origin is left-center, we just set the width directly
        const newWidth = this.progressBarMaxWidth * clampedProgress;
        this.progressBar.width = newWidth;
    }

    private reportCreatePhaseProgress() {
        this.createPhaseProgress++;
        // create() phase progress maps to 50-100% of total progress
        const createPhaseProgressRatio = this.createPhaseProgress / CREATE_PHASE_TOTAL_ACTIVITIES;
        this.currentProgress = 0.5 + (createPhaseProgressRatio * 0.5);
        this.updateProgressBar();
    }

    private setProgress(progress: number) {
        this.currentProgress = progress;
        this.updateProgressBar();
    }

    public preload() {
        // Draw application title and subtitle with black stripe background
        drawAppTitle(this);

        //  Load the assets for the game - Replace with your own assets
        this.load.setPath('assets');

        // LoadingBg is already loaded in Boot.ts and available via registry

        // Only load assets individually if ignore-zip is true (backward compatibility mode)
        if (getIgnoreZip(this)) {
            console.log('[LoadingScreen] Using traditional asset loading (ignore-zip=true)');
            const downloadStart = performance.now();
            
            // Load all assets dynamically from the Assets collection
            const assets = getAssets();
            assets.forEach((asset) => {
                switch (asset.assetType) {
                    case AssetType.MAP:
                        // Load maps as binary files
                        this.load.binary(asset.key, `maps/${asset.fileName}`);
                        break;
                    case AssetType.TILE_SPRITE:
                    case AssetType.SPRITE:
                        // Load sprites as binary files
                        this.load.binary(asset.key, `sprites/${asset.fileName}`);
                        break;
                    case AssetType.MUSIC:
                    case AssetType.SOUND: {
                        const folder = asset.assetType === AssetType.MUSIC ? 'music' : 'sounds';
                        this.load.audio(asset.key, `${folder}/${asset.fileName}`);
                        break;
                    }
                }
            });
            
            // Track when all files are loaded
            this.load.once('complete', () => {
                this.phaseTimings.downloadAssets = performance.now() - downloadStart;
                console.log(`[LoadingScreen] ⏱️  Download assets: ${this.phaseTimings.downloadAssets.toFixed(2)}ms`);
            });
        } else {
            console.log('[LoadingScreen] Using zip asset loading (ignore-zip=false)');
            // Assets will be loaded from zip in create()
        }
    }

    async create() {
        if (this.usingZipLoading) {
            try {
                await this.loadAssetsFromZip();
            } catch (error) {
                console.error('[LoadingScreen] Failed to load from zip, falling back to traditional loading:', error);
                // Set ignore-zip to true and reload the scene
                setIgnoreZip(this, true);
                this.scene.restart();
                return;
            }
        }
        
        // Process loaded assets (both zip and traditional paths converge here)
        await this.processAssets();
        
        // Calculate loading time and log summary
        const loadingTime = Date.now() - this.loadingStartTime;
        console.log('\n═══════════════════════════════════════════════════');
        console.log('📊 LOADING PERFORMANCE SUMMARY');
        console.log('═══════════════════════════════════════════════════');
        
        if (this.usingZipLoading) {
            console.log('Loading Mode: ZIP-based (optimized)');
            console.log('---------------------------------------------------');
            if (this.phaseTimings.downloadZip) {
                console.log(`  Download assets.zip:     ${this.phaseTimings.downloadZip.toFixed(2)}ms`);
            }
            if (this.phaseTimings.decompressZip) {
                console.log(`  Decompress zip:          ${this.phaseTimings.decompressZip.toFixed(2)}ms`);
            }
            if (this.phaseTimings.registerBinary) {
                console.log(`  Register binary cache:   ${this.phaseTimings.registerBinary.toFixed(2)}ms`);
            }
            if (this.phaseTimings.registerMusic) {
                console.log(`  Register music cache:    ${this.phaseTimings.registerMusic.toFixed(2)}ms`);
            }
        } else {
            console.log('Loading Mode: Traditional (individual files)');
            console.log('---------------------------------------------------');
            if (this.phaseTimings.downloadAssets) {
                console.log(`  Download assets:         ${this.phaseTimings.downloadAssets.toFixed(2)}ms`);
            }
        }
        
        console.log('---------------------------------------------------');
        if (this.phaseTimings.parseSprites) {
            console.log(`  Parse sprites:           ${this.phaseTimings.parseSprites.toFixed(2)}ms`);
        }
        if (this.phaseTimings.loadMaps) {
            console.log(`  Load maps:               ${this.phaseTimings.loadMaps.toFixed(2)}ms`);
        }
        console.log('---------------------------------------------------');
        console.log(`  TOTAL:                   ${loadingTime.toFixed(2)}ms`);
        console.log('═══════════════════════════════════════════════════\n');
        
        // Wait briefly to ensure progress bar renders at 100% before transitioning
        this.time.delayedCall(300, () => {
            this.scene.start('LoginScreen');
        });
    }

    private async loadAssetsFromZip(): Promise<void> {
        const downloadStart = performance.now();
        console.log('[LoadingScreen] Fetching assets.zip...');
        
        // Phase 1: Fetch zip file (0-25% progress)
        const zipUrl = './assets.zip';
        const response = await fetch(zipUrl);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch ${zipUrl}: ${response.status} ${response.statusText}`);
        }
        
        const contentLength = response.headers.get('content-length');
        const total = contentLength ? parseInt(contentLength, 10) : 0;
        
        let loaded = 0;
        const reader = response.body?.getReader();
        
        if (!reader) {
            throw new Error('Response body is not readable');
        }
        
        const chunks: Uint8Array[] = [];
        
        // Accumulate chunks until we reach 1MB before updating progress
        const PROGRESS_UPDATE_THRESHOLD = 1024 * 1024; // 1MB
        let lastProgressUpdateBytes = 0;
        
        while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
                break;
            }
            
            chunks.push(value);
            loaded += value.length;
            
            // Update progress (0-25%) only when we've accumulated enough data
            // or when we're done (to ensure 100% is shown)
            if (total > 0) {
                const bytesSinceLastUpdate = loaded - lastProgressUpdateBytes;
                if (bytesSinceLastUpdate >= PROGRESS_UPDATE_THRESHOLD || done) {
                    const fetchProgress = loaded / total;
                    this.setProgress(fetchProgress * 0.25);
                    lastProgressUpdateBytes = loaded;
                }
            }
        }
        
        // Ensure final progress update if we didn't hit the threshold
        if (total > 0 && loaded > lastProgressUpdateBytes) {
            this.setProgress((loaded / total) * 0.25);
        }
        
        // Combine chunks into single Uint8Array
        const zipData = new Uint8Array(loaded);
        let offset = 0;
        for (const chunk of chunks) {
            zipData.set(chunk, offset);
            offset += chunk.length;
        }
        
        this.phaseTimings.downloadZip = performance.now() - downloadStart;
        console.log(`[LoadingScreen] ⏱️  Download assets.zip: ${this.phaseTimings.downloadZip.toFixed(2)}ms (${loaded} bytes)`);
        
        // Phase 2: Decompress zip file (25-35% progress, 10%)
        this.setProgress(0.25);
        const decompressStart = performance.now();
        
        const decompressed = await this.decompressZipWithProgress(zipData);
        const fileNames = Object.keys(decompressed);
        
        this.phaseTimings.decompressZip = performance.now() - decompressStart;
        console.log(`[LoadingScreen] ⏱️  Decompress assets.zip: ${this.phaseTimings.decompressZip.toFixed(2)}ms (${fileNames.length} files)`);
        
        // Phase 3: Register files with Phaser cache (35-50% progress, 15%)
        await this.registerDecompressedFiles(decompressed);
        
        // Validate against Assets.ts
        this.validateDecompressedFiles(fileNames);
    }

    private async decompressZipWithProgress(zipData: Uint8Array): Promise<Record<string, Uint8Array>> {
        return new Promise((resolve, reject) => {
            console.log('[LoadingScreen] Starting async decompression...');
            
            // Track decompression progress (25-35%, 10% range)
            let lastProgressUpdate = 0;
            const progressInterval = setInterval(() => {
                // Animate progress smoothly from 25% to 35% during decompression
                // This is a time-based estimate since we can't track individual file progress with the simple unzip API
                lastProgressUpdate += 0.005;
                if (lastProgressUpdate <= 0.1) {
                    this.setProgress(0.25 + lastProgressUpdate);
                }
            }, 50);
            
            // Use the async unzip function which handles all files correctly
            unzip(zipData, (err, decompressed) => {
                clearInterval(progressInterval);
                
                if (err) {
                    console.error('[LoadingScreen] Decompression error:', err);
                    reject(err);
                    return;
                }
                
                const fileCount = Object.keys(decompressed).length;
                console.log(`[LoadingScreen] Successfully decompressed ${fileCount} files`);
                
                // Set progress to 35% (decompression complete, ready for registration)
                this.setProgress(0.35);
                
                resolve(decompressed);
            });
        });
    }

    private async registerDecompressedFiles(decompressed: Record<string, Uint8Array>): Promise<void> {
        console.log('[LoadingScreen] Registering decompressed files with Phaser cache...');
        
        const entries = Object.entries(decompressed);
        const totalFiles = entries.length;
        let binaryDuration = 0;
        let musicDuration = 0;
        
        // Separate binary and audio files for different processing strategies
        const binaryFiles: Array<[string, Uint8Array]> = [];
        const audioFiles: Array<[string, Uint8Array]> = [];
        
        for (const [filePath, data] of entries) {
            const asset = this.findAssetByFilePath(filePath);
            if (!asset) {
                console.warn(`[LoadingScreen] Unknown file in zip: ${filePath}`);
                continue;
            }
            
            switch (asset.assetType) {
                case AssetType.MAP:
                case AssetType.TILE_SPRITE:
                case AssetType.SPRITE:
                    binaryFiles.push([filePath, data]);
                    break;
                case AssetType.MUSIC:
                case AssetType.SOUND:
                    audioFiles.push([filePath, data]);
                    break;
            }
        }
        
        // Register binary files (fast, synchronous)
        const binaryStart = performance.now();
        let processedFiles = 0;
        
        for (const [filePath, data] of binaryFiles) {
            const asset = this.findAssetByFilePath(filePath);
            if (asset) {
                const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
                this.cache.binary.add(asset.key, arrayBuffer);
                processedFiles++;
                this.setProgress(0.35 + (processedFiles / totalFiles * 0.15));
            }
        }
        binaryDuration = performance.now() - binaryStart;
        
        // Decode audio files in parallel (much faster!)
        const musicStart = performance.now();
        const soundManager = this.sound as any;
        const audioContext = soundManager.context as AudioContext | undefined;
        
        if (!audioContext) {
            console.warn('[LoadingScreen] No audio context available, skipping audio files');
        } else {
            // Decode all audio files in parallel
            const decodePromises = audioFiles.map(([filePath, data]) => {
                const asset = this.findAssetByFilePath(filePath);
                if (!asset) {
                    return Promise.resolve();
                }
                
                const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
                
                return audioContext.decodeAudioData(arrayBuffer.slice(0))
                    .then(audioBuffer => {
                        this.cache.audio.add(asset.key, audioBuffer);
                        processedFiles++;
                        this.setProgress(0.35 + (processedFiles / totalFiles * 0.15));
                    })
                    .catch(error => {
                        console.error(`[LoadingScreen] Failed to decode audio ${asset.key}:`, error);
                        throw error;
                    });
            });
            
            // Wait for all audio files to decode
            await Promise.all(decodePromises);
        }
        
        musicDuration = performance.now() - musicStart;
        
        this.phaseTimings.registerBinary = binaryDuration;
        this.phaseTimings.registerMusic = musicDuration;
        console.log(`[LoadingScreen] ⏱️  Register binary cache: ${binaryDuration.toFixed(2)}ms (${binaryFiles.length} files)`);
        console.log(`[LoadingScreen] ⏱️  Register music cache: ${musicDuration.toFixed(2)}ms (${audioFiles.length} files, decoded in parallel)`);
        console.log('[LoadingScreen] All files registered with cache');
    }

    private findAssetByFilePath(filePath: string): ReturnType<typeof getAssets>[number] | undefined {
        // Normalize file path (handle both unix and windows paths, remove directory prefix)
        // File paths in zip are like: assets/maps/aresden.amd, assets/sprites/wm.spr, etc.
        const normalizedPath = filePath.replace(/\\/g, '/');
        const fileName = normalizedPath.split('/').pop() || filePath;
        
        const assets = getAssets();
        return assets.find(asset => asset.fileName === fileName);
    }

    private validateDecompressedFiles(fileNames: string[]): void {
        // Extract just the file names from paths (handle both unix and windows paths)
        const decompressedFileNames = new Set(
            fileNames.map(path => {
                // Handle both forward and backward slashes
                const parts = path.replace(/\\/g, '/').split('/');
                return parts[parts.length - 1];
            })
        );
        
        // Get expected file names from Assets.ts
        const assets = getAssets();
        const expectedFileNames = new Set(assets.map(asset => asset.fileName));
        
        // Check for missing files
        const missingFiles: string[] = [];
        expectedFileNames.forEach(fileName => {
            if (!decompressedFileNames.has(fileName)) {
                missingFiles.push(fileName);
            }
        });
        
        if (missingFiles.length > 0) {
            console.error('[LoadingScreen] Missing files:', missingFiles);
            console.error('[LoadingScreen] Files we have:', Array.from(decompressedFileNames));
            throw new Error(`Missing files in assets.zip: ${missingFiles.join(', ')}`);
        }
        
        console.log('[LoadingScreen] All expected files found in assets.zip');
    }

    private async processAssets(): Promise<void> {
        // Create map instances for all maps dynamically
        const mapInstances: Map<string, HBMap> = new Map();
        getMapNames().forEach((mapData) => {
            const mapKey = `map-${mapData.mapFile.replace('.amd', '')}`;
            mapInstances.set(mapKey, new HBMap(mapKey));
        });
        
        // Progress callback for sprite loading
        const onSpriteLoaded = () => {
            this.reportCreatePhaseProgress();
        };
        
        // Load sprites dynamically from Assets collection
        const assets = getAssets();
        const spriteAssets = assets.filter(
            asset => asset.assetType === AssetType.TILE_SPRITE || asset.assetType === AssetType.SPRITE
        );
        
        const spritesStart = performance.now();
        await Promise.all(
            spriteAssets.map(async asset => {
                if (!asset.spriteType) {
                    throw new Error(`Sprite asset ${asset.key} is missing spriteType`);
                }
                try {
                    console.log(`[LoadingScreen] Loading sprite: ${asset.key} (${asset.fileName})`);
                    const hbFile = new HBSpriteFile(
                        asset.key,
                        asset.spriteType,
                        asset.exportFramesAsDataUrls || false,
                        asset.tileStartIndex
                    );
                    await hbFile.load(this);
                    if (asset.key === 'sprite-item-pack') {
                        setItemPackSpriteSheets(this.game, hbFile.spriteSheets);
                        setItemPackEmittedTintKeys(this.game, new Set<string>());
                    }
                    onSpriteLoaded();
                } catch (error) {
                    console.error(`[LoadingScreen] ❌ Failed to load sprite: ${asset.key} (${asset.fileName})`);
                    console.error(`[LoadingScreen] Error details:`, error);
                    throw error; // Re-throw to fail the loading process
                }
            })
        );
        
        this.phaseTimings.parseSprites = performance.now() - spritesStart;
        console.log(`[LoadingScreen] ⏱️  Parse sprites: ${this.phaseTimings.parseSprites.toFixed(2)}ms (${spriteAssets.length} sprites)`);
        
        // Load all maps after sprites are loaded (maps need tile textures)
        // Process maps asynchronously to allow UI updates between each map
        const mapsStart = performance.now();
        for (const [mapKey, mapInstance] of mapInstances) {
            mapInstance.load(this);
            this.reportCreatePhaseProgress();
            
            // Store map in registry for use in GameWorld
            setMap(this, mapKey, mapInstance);
            
            // Yield control back to the browser to update UI
            await new Promise(resolve => setTimeout(resolve, 0));
        }
        
        this.phaseTimings.loadMaps = performance.now() - mapsStart;
        console.log(`[LoadingScreen] ⏱️  Load maps: ${this.phaseTimings.loadMaps.toFixed(2)}ms (${mapInstances.size} maps)`);
    }

}
