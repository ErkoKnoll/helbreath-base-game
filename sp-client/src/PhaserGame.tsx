import { forwardRef, useEffect, useLayoutEffect, useRef } from 'react';
import StartGame from './game/main';
import { EventBus } from './game/EventBus';
import { CURRENT_SCENE_READY } from './constants/EventNames';

export interface IRefPhaserGame
{
    game: Phaser.Game | null;
    scene: Phaser.Scene | null;
}

interface IProps
{
    currentActiveScene?: (scene_instance: Phaser.Scene) => void
}

export const PhaserGame = forwardRef<IRefPhaserGame, IProps>(function PhaserGame({ currentActiveScene }, ref)
{
    const game = useRef<Phaser.Game | null>(null);

    useLayoutEffect(() =>
    {
        if (game.current === null)
        {

            game.current = StartGame("game-container");

            if (typeof ref === 'function')
            {
                ref({ game: game.current, scene: null });
            } else if (ref)
            {
                ref.current = { game: game.current, scene: null };
            }

        }

        return () =>
        {
            if (game.current)
            {
                game.current.destroy(true);
                if (game.current !== null)
                {
                    game.current = null;
                }
            }
        }
    }, [ref]);

    // Handle window focus/blur to mute/unmute audio when browser window becomes inactive
    useEffect(() => {
        let savedVolume = 1.0;
        let fadeInterval: number | undefined;
        let fadeTimeout: number | undefined;

        const handleWindowBlur = () => {
            if (!game.current) {
                return;
            }
            
            console.log('[PhaserGame] Browser window lost focus, muting all audio');
            // Clear any pending fade operations
            if (fadeInterval !== undefined) {
                clearInterval(fadeInterval);
                fadeInterval = undefined;
            }
            if (fadeTimeout !== undefined) {
                clearTimeout(fadeTimeout);
                fadeTimeout = undefined;
            }
            
            // Save current volume and mute immediately
            savedVolume = game.current.sound.volume;
            game.current.sound.volume = 0;
        };

        const handleWindowFocus = () => {
            if (!game.current) {
                return;
            }
            
            console.log('[PhaserGame] Browser window gained focus, will fade in audio after 1 second');
            
            // Wait 1 second before starting fade-in
            fadeTimeout = window.setTimeout(() => {
                if (!game.current) {
                    return;
                }
                
                console.log('[PhaserGame] Starting audio fade-in');
                // Ensure volume starts at 0
                game.current.sound.volume = 0;
                
                // Gradually fade in over 300ms (30 steps of 10ms each)
                const steps = 30;
                const stepDuration = 10;
                let currentStep = 0;
                
                fadeInterval = window.setInterval(() => {
                    currentStep++;
                    if (game.current && currentStep <= steps) {
                        const progress = currentStep / steps;
                        game.current.sound.volume = savedVolume * progress;
                    }
                    
                    if (currentStep >= steps) {
                        if (fadeInterval !== undefined) {
                            clearInterval(fadeInterval);
                            fadeInterval = undefined;
                        }
                        console.log('[PhaserGame] Audio fade-in complete');
                    }
                }, stepDuration);
                
                fadeTimeout = undefined;
            }, 1000);
        };

        // Listen for window focus/blur events (detects when entire browser window becomes inactive)
        window.addEventListener('blur', handleWindowBlur);
        window.addEventListener('focus', handleWindowFocus);
        console.log('[PhaserGame] Window focus/blur listeners set up');

        return () => {
            window.removeEventListener('blur', handleWindowBlur);
            window.removeEventListener('focus', handleWindowFocus);
            if (fadeInterval !== undefined) {
                clearInterval(fadeInterval);
            }
            if (fadeTimeout !== undefined) {
                clearTimeout(fadeTimeout);
            }
            console.log('[PhaserGame] Window focus/blur listeners removed');
        };
    }, []);

    useEffect(() =>
    {
        EventBus.on(CURRENT_SCENE_READY, (scene_instance: Phaser.Scene) =>
        {
            if (currentActiveScene && typeof currentActiveScene === 'function')
            {

                currentActiveScene(scene_instance);

            }

            if (typeof ref === 'function')
            {
                ref({ game: game.current, scene: scene_instance });
            } else if (ref)
            {
                ref.current = { game: game.current, scene: scene_instance };
            }
            
        });
        return () =>
        {
            EventBus.off(CURRENT_SCENE_READY);
        }
    }, [currentActiveScene, ref]);

    return (
        <div id="game-container"></div>
    );

});
