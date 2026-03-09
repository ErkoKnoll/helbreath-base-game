import { MonsterShadow } from '../game/objects/Monster';


/**
 * Animation configuration for a specific state.
 */
export interface StateAnimationConfig {
    /** 
     * Start sprite sheet index (defaults to standard monster mapping if not specified).
     * For example, 0 for idle. Directions are added on top of this value.
     */
    startSpriteSheet?: number;
    
    /** 
     * Starting frame index within the animation (defaults to 0).
     * Used for SubFrame animations like wyverns (e.g., 4 for wyvern attack frames 4-7).
     */
    startAnimationFrame?: number;
    
    /** 
     * Number of frames in the animation (defaults to 8).
     * Wyverns use 4 for some states, giant frogs use 5 for movement.
     */
    animationFrames?: number;
    
    /** 
     * Sprite name to override the base sprite for this animation (optional).
     * When specified, this sprite will be used instead of the base monster sprite for this state.
     * Opacity from the base monster configuration will be applied to the override sprite.
     */
    spriteName?: string;
}

/**
 * State configuration including sound and animation data.
 */
export interface MonsterStateConfig {
    /** Sound file to play for this state (with extension, e.g., 'M91.mp3') */
    sound?: string;
    
    /** Animation configuration for this state */
    animation?: StateAnimationConfig;
}

/**
 * Monster states configuration.
 */
export interface MonsterStatesConfig {
    /** Idle state configuration (usually not needed as defaults work for most monsters) */
    idle?: MonsterStateConfig;
    
    /** Move state configuration */
    move?: MonsterStateConfig;
    
    /** Attack state configuration */
    attack?: MonsterStateConfig;
    
    /** Take damage state configuration (sound plays once at original duration when switching to this state) */
    takeDamage?: MonsterStateConfig;
    
    /** Death state configuration */
    death?: MonsterStateConfig;
}

/**
 * Monster data structure with display name and sprite name.
 */
export interface MonsterData {
    /** Display name of the monster */
    name: string;
    
    /** Sprite name without extension (e.g., 'ettin') */
    spriteName: string;
    
    /** State-specific configuration (sound and animation data) */
    states?: MonsterStatesConfig;
    
    /** Time in seconds before corpse starts fading */
    corpseDecayTime: number;
    
    /** Temporal coefficient controlling animation speed (defaults to 1.0) */
    temporalCoefficient?: number;
    
    /** Shadow display option (defaults to BodyShadow) */
    shadow?: MonsterShadow;
    
    /** Opacity/transparency of the monster sprite (defaults to 1.0, range 0.0-1.0) */
    opacity?: number;

    /** Estimated height of the monster in pixels. Used to position damage indicator above the monster. */
    height?: number;

    /** When true, monster spawns ArrowProjectile toward player instead of dealing damage immediately. */
    bowAttack?: boolean;
}

/**
 * List of available monsters in the game.
 */
export const MONSTERS: MonsterData[] = [
    { 
        name: 'Ettin', 
        spriteName: 'ettin',
        states: {
            move: { sound: 'M91.mp3' },
            attack: { sound: 'M92.mp3' },
            takeDamage: { sound: 'M93.mp3' },
            death: { sound: 'M94.mp3' }
        },
        corpseDecayTime: 3
    },
    { 
        name: 'Slime', 
        spriteName: 'slm',
        states: {
            move: { sound: 'M1.mp3' },
            attack: { sound: 'M2.mp3' },
            takeDamage: { sound: 'M3.mp3' },
            death: { sound: 'M4.mp3' }
        },
        corpseDecayTime: 3,
        temporalCoefficient: 0.5,
        shadow: MonsterShadow.NoShadow
    },
    { 
        name: 'Ant', 
        spriteName: 'ant',
        states: {
            move: { sound: 'M29.mp3' },
            attack: { sound: 'M30.mp3' },
            takeDamage: { sound: 'M31.mp3' },
            death: { sound: 'M32.mp3' }
        },
        temporalCoefficient: 0.5,
        corpseDecayTime: 3,
        shadow: MonsterShadow.NoShadow
    },
    { 
        name: 'Snake', 
        spriteName: 'amp',
        states: {
            move: { sound: 'M25.mp3' },
            attack: { sound: 'M26.mp3' },
            takeDamage: { sound: 'M27.mp3' },
            death: { sound: 'M28.mp3' }
        },
        corpseDecayTime: 3,
        temporalCoefficient: 0.5,
        shadow: MonsterShadow.NoShadow
    },
    { 
        name: 'Armored Battle Steed', 
        spriteName: 'abs',
        states: { // Unicorn sounds, not sure if they are correct
            move: { sound: 'M63.mp3' },
            attack: { sound: 'M64.mp3' },
            takeDamage: { sound: 'M65.mp3' },
            death: { sound: 'M66.mp3' }
        },
        corpseDecayTime: 3,
        height: 80,
    },
    { 
        name: 'Dragon', 
        spriteName: 'barlog',
        states: {
            move: { sound: 'M130.mp3' },
            attack: { sound: 'M131.mp3' },
            takeDamage: { sound: 'M128.mp3' },
            death: { sound: 'M129.mp3' }
        },
        corpseDecayTime: 3
    },
    { 
        name: 'Bunny', 
        spriteName: 'bunny',
        states: {
            move: { sound: 'M71.mp3' },
            attack: { sound: 'M75.mp3' },
            takeDamage: { sound: 'M79.mp3' },
            death: { sound: 'M83.mp3' }
        },
        corpseDecayTime: 3
    },
    { 
        name: 'Beholder', 
        spriteName: 'beholder',
        states: {
            move: { sound: 'E46.mp3' },
            attack: {
                sound: 'C6.mp3',
                animation: {
                    animationFrames: 12
                }
            },
            takeDamage: { sound: 'M3.mp3' },
            death: { sound: 'C7.mp3' }
        },
        corpseDecayTime: 3
    },
    { 
        name: 'Battle Golem', 
        spriteName: 'bg',
        states: {
            move: { sound: 'M33.mp3' },
            attack: { sound: 'M34.mp3' },
            takeDamage: { sound: 'M35.mp3' },
            death: { sound: 'M36.mp3' }
        },
        corpseDecayTime: 3
    },
    { 
        name: 'Cannibal Plant', 
        spriteName: 'canplant',
        states: {
            move: { sound: 'M95.mp3' },
            attack: { sound: 'M96.mp3' },
            takeDamage: { sound: 'M97.mp3' },
            death: { sound: 'M98.mp3' }
        },
        corpseDecayTime: 3
    },
    { 
        name: 'Cat', 
        spriteName: 'cat',
        states: {
            move: { sound: 'M72.mp3' },
            attack: { sound: 'M76.mp3' },
            takeDamage: { sound: 'M80.mp3' },
            death: { sound: 'M84.mp3' }
        },
        corpseDecayTime: 3,
        shadow: MonsterShadow.NoShadow
    },
    { 
        name: 'Catapult', // Not sure what the sounds are
        spriteName: 'catapult',
        corpseDecayTime: 3,
        shadow: MonsterShadow.NoShadow
    },
    { 
        name: 'Centaurus', 
        spriteName: 'centaurus',
        states: {
            move: { sound: 'M117.mp3' },
            attack: { sound: 'M119.mp3' },
            takeDamage: { sound: 'M116.mp3' },
            death: { sound: 'C7.mp3' } // Probably not correct
        },
        corpseDecayTime: 3
    },
    { 
        name: 'Clay Golem', 
        spriteName: 'cla',
        states: {
            move: { sound: 'M37.mp3' },
            attack: { sound: 'M38.mp3' },
            takeDamage: { sound: 'M39.mp3' },
            death: { sound: 'M40.mp3' }
        },
        corpseDecayTime: 3,
        temporalCoefficient: 0.5,
    },
    { 
        name: 'Claw Turtle', 
        spriteName: 'clawturtle',
        states: {
            move: { sound: 'M114.mp3' },
            attack: { sound: 'M115.mp3' },
            takeDamage: { sound: 'M112.mp3' },
            death: { sound: 'M113.mp3' }
        },
        corpseDecayTime: 3
    },
    { 
        name: 'Cyclops', 
        spriteName: 'cyc',
        states: {
            move: { sound: 'M41.mp3' },
            attack: { sound: 'M42.mp3' },
            takeDamage: { sound: 'M43.mp3' },
            death: { sound: 'M44.mp3' }
        },
        corpseDecayTime: 3,
        temporalCoefficient: 0.5,
    },
    { 
        name: 'Dark Elf', 
        spriteName: 'darkelf',
        states: {
            move: { sound: 'C8.mp3' },
            attack: { sound: 'C3.mp3' },
            takeDamage: { sound: 'C13.mp3' },
            death: { sound: 'M150.mp3' }
        },
        corpseDecayTime: 3,
        bowAttack: true,
    },
    { 
        name: 'Elf Master', 
        spriteName: 'elfmaster',
        states: {
            move: { sound: 'C8.mp3' },
            attack: { sound: 'C3.mp3' },
            takeDamage: { sound: 'C13.mp3' },
            death: { sound: 'M150.mp3' }
        },
        corpseDecayTime: 3,
        bowAttack: true,
    },
    { 
        name: 'Dark Shadow Knight', 
        spriteName: 'darkknight',
        states: {
            move: { sound: 'M148.mp3' }, // Probably not correct
            attack: { sound: 'M145.mp3' },
            takeDamage: { sound: 'M147.mp3' },
            death: { sound: 'M146.mp3' }
        },
        corpseDecayTime: 3
    },
    { 
        name: 'Demon', 
        spriteName: 'demon',
        states: {
            move: { sound: 'M59.mp3' },
            attack: { sound: 'M61.mp3' },
            takeDamage: { sound: 'M60.mp3' },
            death: { sound: 'M62.mp3' }
        },
        corpseDecayTime: 3
    },
    { 
        name: 'Detector', 
        spriteName: 'detector',
        corpseDecayTime: 3
    },
    { 
        name: 'Fire Elemental (incomplete)', // Seems to be having incorrect pivot points
        spriteName: 'fireelemental',
        states: {
            move: { sound: 'E9.mp3' },
            attack: { sound: 'E1.mp3' },
            death: { sound: 'M58.mp3' }
        },
        corpseDecayTime: 3
    },
    { 
        name: 'Frost', 
        spriteName: 'frost',
        states: {
            move: { sound: 'M23.mp3' },
            attack: { sound: 'C4.mp3' },
            takeDamage: { sound: 'C13.mp3' },
            death: { sound: 'C7.mp3' }
        },
        corpseDecayTime: 3
    },
    { 
        name: 'Gargoyle', 
        spriteName: 'gagoyle', // Note: actual sprite file has typo in filename
        states: {
            move: { sound: 'M37.mp3' },
            attack: { sound: 'C2.mp3' },
            takeDamage: { sound: 'M43.mp3' },
            death: { sound: 'C7.mp3' }
        },
        corpseDecayTime: 3
    },
    { 
        name: 'God\'s Hand Knight', 
        spriteName: 'ghk',
        states: {
            move: { sound: 'C8.mp3' },
            attack: { sound: 'C2.mp3' },
            takeDamage: { sound: 'C12.mp3' },
            death: { sound: 'C7.mp3' }
        },
        corpseDecayTime: 3
    },
    { 
        name: 'God\'s Hand Knight on Armored Battle Steed', 
        spriteName: 'ghkabs',
        states: {
            move: { sound: 'M63.mp3' },
            attack: { sound: 'C2.mp3' },
            takeDamage: { sound: 'C12.mp3' },
            death: { sound: 'C7.mp3' }
        },
        corpseDecayTime: 3,
        shadow: MonsterShadow.NoShadow
    },
    { 
        name: 'Giant Cray Fish', 
        spriteName: 'giantcrayfish',
        states: {
            move: { sound: 'M99.mp3' },
            attack: { sound: 'M100.mp3' },
            takeDamage: { sound: 'M101.mp3' },
            death: { sound: 'M98.mp3' }
        },
        corpseDecayTime: 3
    },
    { 
        name: 'Giant Frog', 
        spriteName: 'giantfrog',
        states: {
            move: {
                sound: 'M73.mp3',
                animation: {
                    startAnimationFrame: 3, // Frames 3-7
                    animationFrames: 5
                }
            },
            attack: { sound: 'M77.mp3' },
            takeDamage: { sound: 'M81.mp3' },
            death: { sound: 'M85.mp3' }
        },
        corpseDecayTime: 3
    },
    { 
        name: 'Giant Lizard', 
        spriteName: 'giantlizard',
        states: {
            move: { sound: 'M126.mp3' },
            attack: { sound: 'M127.mp3' },
            takeDamage: { sound: 'M124.mp3' },
            death: { sound: 'M125.mp3' }
        },
        corpseDecayTime: 3
    },
    { 
        name: 'Giant Tree', 
        spriteName: 'giantplant',
        states: {
            move: { sound: 'M122.mp3' },
            attack: { sound: 'M123.mp3' },
            takeDamage: { sound: 'M120.mp3' },
            death: { sound: 'M121.mp3' }
        },
        corpseDecayTime: 3
    },
    { 
        name: 'Stone Golem', 
        spriteName: 'gol',
        states: {
            move: { sound: 'M33.mp3' },
            attack: { sound: 'M34.mp3' },
            takeDamage: { sound: 'M35.mp3' },
            death: { sound: 'M36.mp3' }
        },
        corpseDecayTime: 3,
        temporalCoefficient: 0.5
    },
    { 
        name: 'Arrow Guard Tower', 
        spriteName: 'gt-arrow',
        states: {
            attack: { sound: 'C2.mp3' },
            death: { sound: 'C7.mp3' }
        },
        corpseDecayTime: 3,
        temporalCoefficient: 0.5
    },
    { 
        name: 'Cannon Guard Tower', 
        spriteName: 'gt-cannon',
        states: {
            attack: { sound: 'C2.mp3' },
            death: { sound: 'C7.mp3' }
        },
        corpseDecayTime: 3,
        temporalCoefficient: 0.5
    },
    { 
        name: 'Guard', 
        spriteName: 'guard',
        states: {
            move: { sound: 'C8.mp3' },
            attack: { sound: 'C2.mp3' },
            takeDamage: { sound: 'C12.mp3' },
            death: { sound: 'C7.mp3' }
        },
        corpseDecayTime: 3,
        temporalCoefficient: 0.5
    },
    { 
        name: 'Hellhound', 
        spriteName: 'helb',
        states: {
            move: { sound: 'M5.mp3' },
            attack: { sound: 'M6.mp3' },
            takeDamage: { sound: 'M7.mp3' },
            death: { sound: 'M8.mp3' }
        },
        corpseDecayTime: 3,
        temporalCoefficient: 0.5
    },
    { 
        name: 'Hellclaw', 
        spriteName: 'hellclaw',
        states: {
            move: { sound: 'M41.mp3' },
            attack: { sound: 'M42.mp3' },
            takeDamage: { sound: 'M43.mp3' },
            death: { sound: 'M44.mp3' }
        },
        corpseDecayTime: 3
    },
    { 
        name: 'Ice Golem', 
        spriteName: 'icegolem',
        states: {
            move: { sound: 'M33.mp3' },
            attack: { sound: 'M34.mp3' },   
            takeDamage: { sound: 'M35.mp3' },
            death: { sound: 'M36.mp3' }
        },
        corpseDecayTime: 3
    },
    { 
        name: 'Light War Beetle', 
        spriteName: 'lwb',
        states: {
            move: { sound: 'M29.mp3' },
            attack: { sound: 'M30.mp3' },
            takeDamage: { sound: 'M31.mp3' },
            death: { sound: 'M32.mp3' }
        },
        corpseDecayTime: 3
    },
    { 
        name: 'Magma Bull (incomplete)', // Seems to be having incorrect pivot points
        spriteName: 'magmabull',
        states: {
            move: { sound: 'M46.mp3' }, // Incorrect sounds
            attack: { sound: 'M30.mp3' },
            death: { sound: 'M103.mp3' }
        },
        corpseDecayTime: 3,
        shadow: MonsterShadow.NoShadow
    },
    { 
        name: 'Master Mage Orc', 
        spriteName: 'mastermageorc',
        states: {
            move: { sound: 'M74.mp3' },
            attack: { sound: 'M78.mp3' },
            takeDamage: { sound: 'M86.mp3' },
            death: { sound: 'M86.mp3' }
        },
        corpseDecayTime: 3
    },
    { 
        name: 'Minotaur', 
        spriteName: 'minotaurs',
        states: {
            move: { sound: 'M46.mp3' },
            attack: { sound: 'M123.mp3' }, // Incorrect sound, should be M104, but is missing
            takeDamage: { sound: 'M102.mp3' },
            death: { sound: 'M103.mp3' }
        },
        corpseDecayTime: 3
    },
    { 
        name: 'Mountain Giant', 
        spriteName: 'mtgiant',
        states: {
            move: { sound: 'M87.mp3' },
            attack: { sound: 'M88.mp3' },
            takeDamage: { sound: 'M89.mp3' },
            death: { sound: 'M90.mp3' }
        },
        corpseDecayTime: 3
    },
    { 
        name: 'Nizie', 
        spriteName: 'nizie',
        states: {
            move: { sound: 'M134.mp3' },
            attack: { sound: 'M135.mp3' },
            takeDamage: { sound: 'M132.mp3' },
            death: { sound: 'M133.mp3' }
        },
        corpseDecayTime: 3
    },
    { 
        name: 'Orc', 
        spriteName: 'orc',
        states: {
            move: { sound: 'M9.mp3' },
            attack: { sound: 'M10.mp3' },
            takeDamage: { sound: 'M11.mp3' },
            death: { sound: 'M12.mp3' }
        },
        corpseDecayTime: 3,
        temporalCoefficient: 0.5
    },
    { 
        name: 'Dire Boar', 
        spriteName: 'direboar',
        states: {
            move: { sound: 'M87.mp3' },
            attack: { sound: 'M78.mp3' },
            takeDamage: { sound: 'M78.mp3' },
            death: { sound: 'C7.mp3' }
        },
        corpseDecayTime: 3,
        shadow: MonsterShadow.NoShadow
    },
    { 
        name: 'Dummy', 
        spriteName: 'dummy',
        corpseDecayTime: 3,
        temporalCoefficient: 0.5
    },
    { 
        name: 'Fire Wyvern', 
        spriteName: 'firewyvern',
        states: {
            idle: {
                animation: {
                    startSpriteSheet: 0, // Same as regular monsters
                    startAnimationFrame: 0, // Frames 0-3
                    animationFrames: 4
                }
            },
            move: {
                sound: 'M106.mp3',
                animation: {
                    startSpriteSheet: 8 // Standard move sprite sheet
                    // Uses default: 8 frames starting at 0
                }
            },
            attack: {
                sound: 'M107.mp3',
                animation: {
                    startSpriteSheet: 0, // Same as idle
                    startAnimationFrame: 3, // Frames 4-7, for some reason only works when starting from 3, otherwise causes Phaser crash
                    animationFrames: 4
                }
            },
            takeDamage: { 
                animation: { // Reuse idle frames for take damage
                    startSpriteSheet: 0,
                    startAnimationFrame: 0,
                    animationFrames: 4
                }
            },
            death: {
                sound: 'M105.mp3',
                animation: {
                    startSpriteSheet: 16 // Custom sprite sheet for wyvern death
                    // Uses default: 8 frames starting at 0
                }
            }
        },
        height: 120,
        corpseDecayTime: 3,
        opacity: 0.7,
    },
    { 
        name: 'Wyvern', 
        spriteName: 'wyvern',
        states: {
            idle: {
                animation: {
                    startSpriteSheet: 0, // Same as regular monsters
                    startAnimationFrame: 0, // Frames 0-3
                    animationFrames: 4
                }
            },
            move: {
                sound: 'M106.mp3',
                animation: {
                    startSpriteSheet: 8 // Standard move sprite sheet
                    // Uses default: 8 frames starting at 0
                }
            },
            attack: {
                sound: 'M107.mp3',
                animation: {
                    startSpriteSheet: 0, // Same as idle
                    startAnimationFrame: 3, // Frames 4-7, for some reason only works when starting from 3, otherwise causes Phaser crash
                    animationFrames: 4
                }
            },
            takeDamage: { 
                animation: { // Reuse idle frames for take damage
                    startSpriteSheet: 0,
                    startAnimationFrame: 0,
                    animationFrames: 4
                }
            },
            death: {
                sound: 'M105.mp3',
                animation: {
                    startSpriteSheet: 16 // Custom sprite sheet for wyvern death
                    // Uses default: 8 frames starting at 0
                }
            }
        },
        height: 120,
        corpseDecayTime: 3,
        opacity: 0.7,
    },
    { 
        name: 'Ugly Wyvern', 
        spriteName: 'uglywyvern',
        states: {
            idle: {
                animation: {
                    startSpriteSheet: 0, // Same as regular monsters
                    startAnimationFrame: 0, // Frames 0-3
                    animationFrames: 4
                }
            },
            move: {
                sound: 'M106.mp3',
                animation: {
                    startSpriteSheet: 8 // Standard move sprite sheet
                    // Uses default: 8 frames starting at 0
                }
            },
            attack: {
                sound: 'M107.mp3',
                animation: {
                    startSpriteSheet: 0, // Same as idle
                    startAnimationFrame: 3, // Frames 4-7, for some reason only works when starting from 3, otherwise causes Phaser crash
                    animationFrames: 4
                }
            },
            takeDamage: { 
                animation: { // Reuse idle frames for take damage
                    startSpriteSheet: 0,
                    startAnimationFrame: 0,
                    animationFrames: 4
                }
            },
            death: {
                sound: 'M105.mp3',
                animation: {
                    startSpriteSheet: 16 // Custom sprite sheet for wyvern death
                    // Uses default: 8 frames starting at 0
                }
            }
        },
        height: 120,
        corpseDecayTime: 3,
        opacity: 0.7,
    },
    { 
        name: 'Lich', 
        spriteName: 'liche',
        states: {
            idle: {
                animation: {
                    animationFrames: 4
                }
            },
            move: {
                sound: 'M55.mp3',
                animation: {
                    animationFrames: 8
                }
            },
            attack: {
                sound: 'M56.mp3',
                animation: {
                    animationFrames: 6
                }
            },
            takeDamage: {
                sound: 'M57.mp3',
                animation: {
                    animationFrames: 5
                }
            },
            death: {
                sound: 'M58.mp3',
                animation: {
                    animationFrames: 6
                }
            }
        },
        corpseDecayTime: 3
    },
    { 
        name: 'Ogre', 
        spriteName: 'orge',
        states: {
            idle: {
                animation: {
                    animationFrames: 4
                }
            },
            move: {
                sound: 'M51.mp3',
                animation: {
                    animationFrames: 8
                }
            },
            attack: {
                sound: 'M52.mp3',
                animation: {
                    animationFrames: 6
                }
            },
            takeDamage: {
                sound: 'M53.mp3',
                animation: {
                    animationFrames: 4
                }
            },
            death: {
                sound: 'M54.mp3',
                animation: {
                    animationFrames: 6
                }
            }
        },
        corpseDecayTime: 3
    },
    { 
        name: 'Rudolph', 
        spriteName: 'rudolph',
        states: {
            move: { sound: 'C11.mp3' },
            attack: { sound: 'M38.mp3' },
            takeDamage: { sound: 'M59.mp3' },
            death: { sound: 'M65.mp3' }
        },
        corpseDecayTime: 3
    },
    { 
        name: 'Scarecrow', 
        spriteName: 'scarecrow',
        corpseDecayTime: 3,
        temporalCoefficient: 0.5
    },
    { 
        name: 'Scorpion', 
        spriteName: 'scp',
        states: {
            move: { sound: 'M21.mp3' },
            attack: { sound: 'M22.mp3' },
            takeDamage: { sound: 'M23.mp3' },
            death: { sound: 'M24.mp3' }
        },
        corpseDecayTime: 3,
        temporalCoefficient: 0.5,
        shadow: MonsterShadow.NoShadow
    },
    { 
        name: 'Skeleton', 
        spriteName: 'ske',
        states: {
            move: { sound: 'M13.mp3' },
            attack: { sound: 'M14.mp3' },
            takeDamage: { sound: 'M15.mp3' },
            death: { sound: 'M16.mp3' }
        },
        corpseDecayTime: 3,
        temporalCoefficient: 0.5,
    },
    { 
        name: 'Sorceress', 
        spriteName: 'sorceress',
        states: {
            move: { sound: 'M149.mp3' },
            attack: { sound: 'C2.mp3' },
            takeDamage: { sound: 'M116.mp3' },
            death: { sound: 'M129.mp3' }
        },
        corpseDecayTime: 3
    },
    { 
        name: 'Stalker', 
        spriteName: 'stalker',
        states: {
            move: { sound: 'M9.mp3' },
            attack: { sound: 'M10.mp3' },
            takeDamage: { sound: 'M11.mp3' },
            death: { sound: 'M12.mp3' }
        },
        corpseDecayTime: 3
    },
    { 
        name: 'Tentocle', 
        spriteName: 'tentocle',
        states: {
            move: { sound: 'M110.mp3' },
            attack: { sound: 'M111.mp3' },
            takeDamage: { sound: 'M108.mp3' },
            death: { sound: 'M109.mp3' }
        },
        corpseDecayTime: 3
    },
    { 
        name: 'Tigerworm', 
        spriteName: 'tigerworm',
        states: {
            move: { sound: 'M1.mp3' },
            attack: { sound: 'C1.mp3' },
            death: { sound: 'M58.mp3' }
        },
        corpseDecayTime: 3,
        shadow: MonsterShadow.NoShadow
    },
    { 
        name: 'Temple Knight', 
        spriteName: 'tk',
        states: {
            move: { sound: 'C8.mp3' },
            attack: { sound: 'C2.mp3' },
            takeDamage: { sound: 'C12.mp3' },
            death: { sound: 'C14.mp3' }
        },
        corpseDecayTime: 3,
    },
    { 
        name: 'Ancient Temple Knight', 
        spriteName: 'tpknight',
        states: {
            move: { sound: 'M142.mp3' },
            attack: { sound: 'M140.mp3' },
            takeDamage: { sound: 'M143.mp3' },
            death: { sound: 'M141.mp3' }
        },
        corpseDecayTime: 3,
    },
    { 
        name: 'Troll', 
        spriteName: 'troll',
        states: {
            idle: {
                animation: {
                    animationFrames: 4
                }
            },
            move: {
                sound: 'M46.mp3',
                animation: {
                    animationFrames: 8
                }
            },
            attack: {
                sound: 'M47.mp3',
                animation: {
                    animationFrames: 6
                }
            },
            takeDamage: { 
                sound: 'M48.mp3',
                animation: {
                    animationFrames: 4
                }
            },
            death: {
                sound: 'M49.mp3',
                animation: {
                    animationFrames: 6
                }
            }
        },
        corpseDecayTime: 3
    },
    { 
        name: 'Unicorn', 
        spriteName: 'unicorn',
        states: {
            idle: {
                animation: {
                    animationFrames: 4
                }
            },
            move: {
                sound: 'M63.mp3',
                animation: {
                    animationFrames: 8
                }
            },
            attack: {
                sound: 'M64.mp3',
                animation: {
                    animationFrames: 8
                }
            },
            takeDamage: {
                sound: 'M65.mp3',
                animation: {
                    animationFrames: 4
                }
            },
            death: {
                sound: 'M66.mp3',
                animation: {
                    animationFrames: 8
                }
            }
        },
        corpseDecayTime: 3,
        shadow: MonsterShadow.NoShadow
    },
    { 
        name: 'Werewolf', 
        spriteName: 'werewolf',
        states: {
            idle: {
                animation: {
                    animationFrames: 4
                }
            },
            move: {
                sound: 'M67.mp3',
                animation: {
                    animationFrames: 8
                }
            },
            attack: {
                sound: 'M68.mp3',
                animation: {
                    animationFrames: 8
                }
            },
            takeDamage: {
                sound: 'M69.mp3',
                animation: {
                    animationFrames: 4
                }
            },
            death: {
                sound: 'M70.mp3',
                animation: {
                    animationFrames: 8
                }
            }
        },
        corpseDecayTime: 3,
    },
    { 
        name: 'Zombie', 
        spriteName: 'zom',
        states: {
            move: { sound: 'M17.mp3' },
            attack: { sound: 'M18.mp3' },
            takeDamage: { sound: 'M19.mp3' },
            death: { sound: 'M20.mp3' }
        },
        corpseDecayTime: 3,
        temporalCoefficient: 0.5
    },
    { 
        name: 'Abaddon (incomplete)', 
        spriteName: 'yspro',
        states: {
            death: { 
                animation: {
                    spriteName: 'yseffect2',
                    startSpriteSheet: 0,
                    animationFrames: 16
                }
            }
        },
        corpseDecayTime: 3,
        height: 120,
        shadow: MonsterShadow.NoShadow
    },
];

/**
 * Get all available monsters as dropdown options.
 * 
 * @returns Array of options with label and value
 */
export function getAllMonsterOptions(): Array<{ label: string; value: string }> {
    return MONSTERS.map(monster => ({ 
        label: monster.name, 
        value: monster.spriteName 
    }));
}

/**
 * Get monster data by sprite name.
 * 
 * @param spriteName - The sprite name without extension (e.g., 'ettin')
 * @returns The monster data or undefined if not found
 */
export function getMonsterData(spriteName: string): MonsterData | undefined {
    return MONSTERS.find(monster => monster.spriteName === spriteName);
}