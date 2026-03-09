import { Scene } from 'phaser';
import { drawAppTitle, drawVersionNumber } from '../../utils/SpriteUtils';
import { createGameStateManager, getInventoryManager, getLoginScreenBgKey } from '../../utils/RegistryUtils';

/**
 * Login screen scene. Displays title, version, and Log In button.
 * Creates GameStateManager and transitions to GameWorld on button click.
 */
export class LoginScreen extends Scene {
    private backgroundImage!: Phaser.GameObjects.Image;

    constructor() {
        super('LoginScreen');
    }

    public init() {
        // Set black background as fallback before image loads
        this.cameras.main.setBackgroundColor(0x000000);
        
        // Get scene dimensions
        const width = this.scale.width;
        const height = this.scale.height;

        // Display background image immediately (loaded in Boot.ts)
        // Get login screen background image key from registry (loaded in Boot.ts)
        const loginBgKey = getLoginScreenBgKey(this);
        
        // Add background image immediately so it displays before cache fetching
        if (loginBgKey && this.textures.exists(loginBgKey)) {
            this.backgroundImage = this.add.image(width / 2, height / 2, loginBgKey);
            // Scale background to cover the entire scene
            const scaleX = width / this.backgroundImage.width;
            const scaleY = height / this.backgroundImage.height;
            const scale = Math.max(scaleX, scaleY);
            this.backgroundImage.setScale(scale);
            // Send background to back so button appears on top
            this.backgroundImage.setDepth(0);
        }

        createGameStateManager(this.game);
    }

    public create() {
        // Get scene dimensions
        const width = this.scale.width;
        const height = this.scale.height;

        // Draw application title and subtitle with black stripe background
        drawAppTitle(this);
        drawVersionNumber(this);

        // Create Log In button with RPG styling (moved below)
        const buttonWidth = 140;
        const buttonHeight = 40;
        const buttonX = width / 2;
        const buttonY = height * 0.65; // Moved below the titles

        // Button background with gradient effect (using multiple rectangles for gradient)
        const buttonBg = this.add.rectangle(buttonX, buttonY, buttonWidth, buttonHeight, 0x8b5a2b);
        const buttonBgTop = this.add.rectangle(buttonX, buttonY - buttonHeight / 4, buttonWidth, buttonHeight / 2, 0x4a2c1a);
        buttonBgTop.setAlpha(0.6);

        // Button border - leather color
        const buttonBorder = this.add.rectangle(buttonX, buttonY, buttonWidth + 4, buttonHeight + 4, 0x704214);
        buttonBorder.setStrokeStyle(2, 0x704214);
        buttonBorder.setFillStyle(0x000000, 0); // Transparent fill

        // Button text
        const buttonText = this.add.text(buttonX, buttonY, 'Log in', {
            fontFamily: 'Georgia, serif',
            fontSize: '20px',
            color: '#f4e4c1',
            fontStyle: 'bold',
        });
        buttonText.setOrigin(0.5, 0.5);
        buttonText.setShadow(1, 1, '#1a0f0a', 2, true);

        // Set initial alpha for all button elements
        buttonBg.setAlpha(1.0);
        buttonBgTop.setAlpha(0.6); // Maintain relative alpha
        buttonBorder.setAlpha(1.0);
        buttonText.setAlpha(1.0);

        // Make the main background interactive
        buttonBg.setInteractive();
        buttonBg.setDepth(20);
        buttonBorder.setDepth(20);
        buttonBgTop.setDepth(19);
        buttonText.setDepth(21);

        // Hover effect
        buttonBg.on('pointerover', () => {
            buttonBg.setAlpha(1.0);
            buttonBgTop.setAlpha(0.6);
            buttonBorder.setAlpha(1.0);
            buttonText.setAlpha(1.0);
            buttonBorder.setStrokeStyle(2, 0xd4af37); // Gold border on hover
            buttonText.setColor('#f4d03f'); // Gold text on hover
        });

        buttonBg.on('pointerout', () => {
            buttonBg.setAlpha(1.0);
            buttonBgTop.setAlpha(0.6);
            buttonBorder.setAlpha(1.0);
            buttonText.setAlpha(1.0);
            buttonBorder.setStrokeStyle(2, 0x704214); // Leather border
            buttonText.setColor('#f4e4c1'); // Parchment text
        });

        // Click handler
        buttonBg.on('pointerdown', () => {
            getInventoryManager(this.game);
            this.scene.start('GameWorld');
        });
    }
}
