import { Store } from '@tanstack/react-store';
import { EventBus } from '../../game/EventBus';
import { IN_UI_SUMMON_MONSTER } from '../../constants/EventNames';
import { Direction } from '../../utils/CoordinateUtils';
import { AttackType, SummonMonsterEvent } from '../../Types';
import { MONSTER_DEFAULT_MOVEMENT_SPEED, MONSTER_DEFAULT_ATTACK_SPEED } from '../../Config';

interface MonsterDialogState {
    isOpen: boolean;
    selectedMonster: string;
    selectedDirection: Direction;
    health: number;
    damage: number;
    movementSpeed: number;
    attackSpeed: number;
    followDistance: number;
    attackDistance: number;
    attackType: AttackType;
    transparency: number;
    chilledEffect: boolean;
    berserkedEffect: boolean;
}

const initialState: MonsterDialogState = {
    isOpen: false,
    selectedMonster: 'ettin', // Default to first monster
    selectedDirection: Direction.South, // Default to South
    health: 100,
    damage: 30,
    movementSpeed: MONSTER_DEFAULT_MOVEMENT_SPEED, // Default movement speed
    attackSpeed: MONSTER_DEFAULT_ATTACK_SPEED, // Default attack speed
    followDistance: 0, // Default to no following (0 = disabled)
    attackDistance: 0, // Default to no attacking (0 = disabled)
    attackType: AttackType.Interrupt,
    transparency: 0,
    chilledEffect: false,
    berserkedEffect: false,
};

export const monsterDialogStore = new Store<MonsterDialogState>(initialState);

export const toggleMonsterDialog = () => {
    monsterDialogStore.setState((state) => ({ ...state, isOpen: !state.isOpen }));
};

export const setMonsterDialogOpen = (value: boolean) => {
    monsterDialogStore.setState((state) => ({ ...state, isOpen: value }));
};

export const setSelectedMonster = (spriteName: string) => {
    monsterDialogStore.setState((state) => ({ ...state, selectedMonster: spriteName }));
};

export const setSelectedDirection = (direction: Direction) => {
    monsterDialogStore.setState((state) => ({ ...state, selectedDirection: direction }));
};

export const setHealth = (health: number) => {
    monsterDialogStore.setState((state) => ({ ...state, health }));
};

export const setDamage = (damage: number) => {
    monsterDialogStore.setState((state) => ({ ...state, damage }));
};

export const setMovementSpeed = (speed: number) => {
    monsterDialogStore.setState((state) => ({ ...state, movementSpeed: speed }));
};

export const setAttackSpeed = (speed: number) => {
    monsterDialogStore.setState((state) => ({ ...state, attackSpeed: speed }));
};

export const setFollowDistance = (distance: number) => {
    monsterDialogStore.setState((state) => ({ ...state, followDistance: distance }));
};

export const setAttackDistance = (distance: number) => {
    monsterDialogStore.setState((state) => ({ ...state, attackDistance: distance }));
};

export const setAttackType = (attackType: AttackType) => {
    monsterDialogStore.setState((state) => ({ ...state, attackType }));
};

export const setTransparency = (value: number) => {
    monsterDialogStore.setState((state) => ({ ...state, transparency: value }));
};

export const setChilledEffect = (enabled: boolean) => {
    monsterDialogStore.setState((state) => ({ ...state, chilledEffect: enabled }));
};

export const setBerserkedEffect = (enabled: boolean) => {
    monsterDialogStore.setState((state) => ({ ...state, berserkedEffect: enabled }));
};

export const summonMonster = () => {
    const state = monsterDialogStore.state;
    const payload: SummonMonsterEvent = {
        spriteName: state.selectedMonster,
        direction: state.selectedDirection,
        health: state.health,
        damage: state.damage,
        movementSpeed: state.movementSpeed,
        attackSpeed: state.attackSpeed,
        followDistance: state.followDistance,
        attackDistance: state.attackDistance,
        attackType: state.attackType,
        transparency: state.transparency,
        chilledEffect: state.chilledEffect,
        berserkedEffect: state.berserkedEffect,
    };
    EventBus.emit(IN_UI_SUMMON_MONSTER, payload);
};
