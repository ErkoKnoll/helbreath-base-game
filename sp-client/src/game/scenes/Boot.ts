import { Scene } from 'phaser';
import { EventBus } from '../EventBus';
import { CURRENT_SCENE_READY } from '../../constants/EventNames';
import { LOADING_BG_KEY, LOGIN_SCREEN_BG_KEY } from '../../constants/RegistryKeys';
import { setIgnoreZip, setDebugModeEnabled, setDisplayLargeItemsEnabled } from '../../utils/RegistryUtils';
import { IGNORE_ZIP_ASSETS } from '../../Config';

/**
 * Initial Phaser scene. Loads loading/login backgrounds, sets registry flags (ignoreZip, debug, displayLargeItems),
 * then starts LoadingScreen.
 */
export class Boot extends Scene {
    constructor() {
        super('Boot');
    }

    public preload() {
        this.load.setPath('assets');
        this.load.image('loading-bg', 'images/LoadingBg.jpg');
        this.load.image('login-screen-bg', 'images/LoginScreenBg.jpg');
    }

    public create() {
        // Initialize global debug mode
        setDebugModeEnabled(this, false);
        setDisplayLargeItemsEnabled(this, false);

        // Set ignoreZip from config, or check URL params if config is false
        let ignoreZip = IGNORE_ZIP_ASSETS;
        if (!IGNORE_ZIP_ASSETS) {
            const urlParams = new URLSearchParams(window.location.search);
            const ignoreZipParam = urlParams.get('ignoreZip');
            ignoreZip = ignoreZipParam === 'true';
        }
        setIgnoreZip(this, ignoreZip);

        this.registry.set(LOADING_BG_KEY, 'loading-bg');
        this.registry.set(LOGIN_SCREEN_BG_KEY, 'login-screen-bg');

        EventBus.emit(CURRENT_SCENE_READY, this);

        this.scene.start('LoadingScreen');
    }
}
