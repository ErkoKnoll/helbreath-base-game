import { Boot } from './scenes/Boot';
import { GameWorld } from './scenes/GameWorld';
import { Game, Scale, WEBGL } from 'phaser';
import { LoadingScreen } from './scenes/LoadingScreen';
import { LoginScreen } from './scenes/LoginScreen';
import { FXAAPostFX } from './pipelines/FXAAPostFX';

//  Find out more information about the Game Config at:
//  https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
const config = {
    type: WEBGL,
    width: 1024,
    height: 576,
    parent: 'game-container',
    // fps: {
    //     target: 30,
    //     forceSetTimeOut: true
    // },
    render: {
        pixelArt: true, // Disable texture smoothing/filtering
        antialias: false, // Disable antialiasing
        roundPixels: true // Round pixel positions to prevent sub-pixel rendering
    },
    scale: {
        mode: Scale.NONE,
        autoCenter: Scale.CENTER_BOTH
    },
    pipeline: { FXAAPostFX } as unknown as Phaser.Types.Core.PipelineConfig,
    scene: [
        Boot,
        LoadingScreen,
        LoginScreen,
        GameWorld,
    ]
} as Phaser.Types.Core.GameConfig;

const StartGame = (parent: string) => {
    return new Game({ ...config, parent });
}

export default StartGame;
