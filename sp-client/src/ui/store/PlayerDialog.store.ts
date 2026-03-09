import { Store } from '@tanstack/react-store';
import { EventBus } from '../../game/EventBus';
import {
    OUT_UI_SET_MOVEMENT_SPEED,
    OUT_UI_SET_ATTACK_SPEED,
    OUT_UI_SET_ATTACK_RANGE,
    OUT_UI_SET_DAMAGE,
    OUT_UI_SET_TRANSPARENCY,
    OUT_UI_SET_ATTACK_TYPE,
    OUT_UI_SET_CAST_SPEED,
    OUT_UI_SET_ATTACK_MODE,
    OUT_UI_SET_RUN_MODE,
    OUT_UI_SET_CHILLED_EFFECT,
    OUT_UI_SET_BERSERKED_EFFECT,
    OUT_UI_SET_GENDER,
    OUT_UI_SET_SKIN_COLOR,
    OUT_UI_SET_UNDERWEAR_COLOR,
    OUT_UI_SET_HAIR_STYLE,
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
    IN_UI_CHANGE_GENDER,
    IN_UI_CHANGE_SKIN_COLOR,
    IN_UI_CHANGE_UNDERWEAR_COLOR,
    IN_UI_CHANGE_HAIR_STYLE,
} from '../../constants/EventNames';
import { DEFAULT_MOVEMENT_SPEED } from '../../Config';
import { DEFAULT_PLAYER_ATTACK_SPEED, DEFAULT_PLAYER_ATTACK_RANGE } from '../../Config';
import { AttackType, Gender, SkinColor } from '../../Types';

interface PlayerDialogState {
    isOpen: boolean;
    gender: Gender;
    skinColor: SkinColor;
    underwearColorIndex: number;
    /** Hair style: 0-7 = Style 1-8. Index 2 renders no hair. */
    hairStyleIndex: number;
    movementSpeed: number;
    attackSpeed: number;
    attackRange: number;
    damage: number;
    transparency: number;
    attackType: AttackType;
    castSpeed: number;
    attackMode: boolean;
    runMode: boolean;
    allowDashAttack: boolean;
    ghostEffect: boolean;
    chilledEffect: boolean;
    berserkedEffect: boolean;
}

const initialState: PlayerDialogState = {
    isOpen: false,
    gender: Gender.MALE,
    skinColor: SkinColor.Light,
    underwearColorIndex: 0,
    hairStyleIndex: 0,
    movementSpeed: DEFAULT_MOVEMENT_SPEED,
    attackSpeed: DEFAULT_PLAYER_ATTACK_SPEED,
    attackRange: DEFAULT_PLAYER_ATTACK_RANGE,
    damage: 30,
    transparency: 0,
    attackType: AttackType.Interrupt,
    castSpeed: 60, // Default slider value that maps to 1500ms cast speed
    attackMode: true,
    runMode: true,
    allowDashAttack: true,
    ghostEffect: false,
    chilledEffect: false,
    berserkedEffect: false,
};

export const playerDialogStore = new Store<PlayerDialogState>(initialState);

export const togglePlayerDialog = () => {
    playerDialogStore.setState((state) => ({ ...state, isOpen: !state.isOpen }));
};

export const setPlayerDialogOpen = (value: boolean) => {
    playerDialogStore.setState((state) => ({ ...state, isOpen: value }));
};

export const setMovementSpeed = (speed: number, notifyPhaser = true) => {
    playerDialogStore.setState((state) => ({ ...state, movementSpeed: speed }));
    if (notifyPhaser) {
        EventBus.emit(IN_UI_CHANGE_MOVEMENT_SPEED, speed);
    }
};

export const setAttackSpeed = (speed: number, notifyPhaser = true) => {
    playerDialogStore.setState((state) => ({ ...state, attackSpeed: speed }));
    if (notifyPhaser) {
        EventBus.emit(IN_UI_CHANGE_ATTACK_SPEED, speed);
    }
};

export const setAttackRange = (range: number, notifyPhaser = true) => {
    playerDialogStore.setState((state) => ({ ...state, attackRange: range }));
    if (notifyPhaser) {
        EventBus.emit(IN_UI_CHANGE_ATTACK_RANGE, range);
    }
};

export const setDamage = (damage: number, notifyPhaser = true) => {
    playerDialogStore.setState((state) => ({ ...state, damage }));
    if (notifyPhaser) {
        EventBus.emit(IN_UI_CHANGE_DAMAGE, damage);
    }
};

export const setTransparency = (value: number, notifyPhaser = true) => {
    playerDialogStore.setState((state) => ({ ...state, transparency: value }));
    if (notifyPhaser) {
        EventBus.emit(IN_UI_CHANGE_TRANSPARENCY, value);
    }
};

export const setAttackType = (attackType: AttackType, notifyPhaser = true) => {
    playerDialogStore.setState((state) => ({ ...state, attackType }));
    if (notifyPhaser) {
        EventBus.emit(IN_UI_CHANGE_ATTACK_TYPE, attackType);
    }
};

export const setCastSpeed = (speed: number, notifyPhaser = true) => {
    playerDialogStore.setState((state) => ({ ...state, castSpeed: speed }));
    if (notifyPhaser) {
        EventBus.emit(IN_UI_CHANGE_CAST_SPEED, speed);
    }
};

export const setAttackMode = (enabled: boolean, notifyPhaser = true) => {
    playerDialogStore.setState((state) => ({ ...state, attackMode: enabled }));
    if (notifyPhaser) {
        EventBus.emit(IN_UI_CHANGE_ATTACK_MODE, enabled);
    }
};

export const setRunMode = (enabled: boolean, notifyPhaser = true) => {
    playerDialogStore.setState((state) => ({ ...state, runMode: enabled }));
    if (notifyPhaser) {
        EventBus.emit(IN_UI_CHANGE_RUN_MODE, enabled);
    }
};

export const setAllowDashAttack = (enabled: boolean) => {
    playerDialogStore.setState((state) => ({ ...state, allowDashAttack: enabled }));
};

export const setGhostEffect = (enabled: boolean) => {
    playerDialogStore.setState((state) => ({ ...state, ghostEffect: enabled }));
};

export const setChilledEffect = (enabled: boolean, notifyPhaser = true) => {
    playerDialogStore.setState((state) => ({ ...state, chilledEffect: enabled }));
    if (notifyPhaser) {
        EventBus.emit(IN_UI_CHANGE_CHILLED_EFFECT, enabled);
    }
};

export const setBerserkedEffect = (enabled: boolean, notifyPhaser = true) => {
    playerDialogStore.setState((state) => ({ ...state, berserkedEffect: enabled }));
    if (notifyPhaser) {
        EventBus.emit(IN_UI_CHANGE_BERSERKED_EFFECT, enabled);
    }
};

export const setGender = (gender: Gender, notifyPhaser = true) => {
    playerDialogStore.setState((state) => ({ ...state, gender }));
    if (notifyPhaser) {
        EventBus.emit(IN_UI_CHANGE_GENDER, gender);
    }
};

export const setSkinColor = (skinColor: SkinColor, notifyPhaser = true) => {
    playerDialogStore.setState((state) => ({ ...state, skinColor }));
    if (notifyPhaser) {
        EventBus.emit(IN_UI_CHANGE_SKIN_COLOR, skinColor);
    }
};

export const setUnderwearColorIndex = (index: number, notifyPhaser = true) => {
    playerDialogStore.setState((state) => ({ ...state, underwearColorIndex: Math.max(0, Math.min(7, index)) }));
    if (notifyPhaser) {
        EventBus.emit(IN_UI_CHANGE_UNDERWEAR_COLOR, Math.max(0, Math.min(7, index)));
    }
};

export const setHairStyleIndex = (index: number, notifyPhaser = true) => {
    const clamped = index < 0 ? 0 : index > 7 ? 7 : index;
    playerDialogStore.setState((state) => ({ ...state, hairStyleIndex: clamped }));
    if (notifyPhaser) {
        EventBus.emit(IN_UI_CHANGE_HAIR_STYLE, clamped);
    }
};

// Initialize EventBus listeners to update state when emitted from Phaser
EventBus.on(OUT_UI_SET_MOVEMENT_SPEED, (speed: number) => {
    setMovementSpeed(speed, false);
});

EventBus.on(OUT_UI_SET_ATTACK_SPEED, (speed: number) => {
    setAttackSpeed(speed, false);
});

EventBus.on(OUT_UI_SET_ATTACK_RANGE, (range: number) => {
    setAttackRange(range, false);
});

EventBus.on(OUT_UI_SET_DAMAGE, (damage: number) => {
    setDamage(damage, false);
});

EventBus.on(OUT_UI_SET_TRANSPARENCY, (value: number) => {
    setTransparency(value, false);
});

EventBus.on(OUT_UI_SET_ATTACK_TYPE, (attackType: AttackType) => {
    setAttackType(attackType, false);
});

EventBus.on(OUT_UI_SET_CAST_SPEED, (speed: number) => {
    setCastSpeed(speed, false);
});

EventBus.on(OUT_UI_SET_ATTACK_MODE, (enabled: boolean) => {
    setAttackMode(enabled, false);
});

EventBus.on(OUT_UI_SET_RUN_MODE, (enabled: boolean) => {
    setRunMode(enabled, false);
});

EventBus.on(OUT_UI_SET_CHILLED_EFFECT, (enabled: boolean) => {
    setChilledEffect(enabled, false);
});

EventBus.on(OUT_UI_SET_BERSERKED_EFFECT, (enabled: boolean) => {
    setBerserkedEffect(enabled, false);
});

EventBus.on(OUT_UI_SET_GENDER, (gender: Gender) => {
    setGender(gender, false);
});

EventBus.on(OUT_UI_SET_SKIN_COLOR, (skinColor: SkinColor) => {
    setSkinColor(skinColor, false);
});

EventBus.on(OUT_UI_SET_UNDERWEAR_COLOR, (index: number) => {
    setUnderwearColorIndex(index, false);
});

EventBus.on(OUT_UI_SET_HAIR_STYLE, (index: number) => {
    setHairStyleIndex(index, false);
});
