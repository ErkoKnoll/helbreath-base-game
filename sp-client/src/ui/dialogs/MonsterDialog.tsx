import { useStore } from '@tanstack/react-store';
import { DraggableDialog } from './DraggableDialog';
import { RpgButton } from '../components/RpgButton';
import { RpgHorizontalSeparator } from '../components/RpgHorizontalSeparator';
import { RpgVerticalSeparator } from '../components/RpgVerticalSeparator';
import { RpgSlider } from '../components/RpgSlider';
import { RpgCheckbox } from '../components/RpgCheckbox';
import { monsterDialogStore, setSelectedMonster, setSelectedDirection, setHealth, setDamage, setMovementSpeed, setAttackSpeed, setFollowDistance, setAttackDistance, setAttackType, setTransparency, setChilledEffect, setBerserkedEffect, summonMonster, setMonsterDialogOpen } from '../store/MonsterDialog.store';
import { getAllMonsterOptions } from '../../constants/Monsters';
import { Direction, toDirection } from '../../utils/CoordinateUtils';
import { AttackType } from '../../Types';
import { MONSTER_MAX_FOLLOW_DISTANCE, MAX_MONSTER_ATTACK_RANGE } from '../../Config';
import { EventBus } from '../../game/EventBus';
import { IN_UI_KILL_ALL_MONSTERS } from '../../constants/EventNames';

interface MonsterDialogProps {
    position: { x: number; y: number };
    zIndex?: number;
    onBringToFront?: () => void;
}

const MONSTER_OPTIONS = getAllMonsterOptions().sort((a, b) => a.label.localeCompare(b.label));

const DIRECTION_OPTIONS = [
    { label: 'North', value: Direction.North },
    { label: 'North East', value: Direction.NorthEast },
    { label: 'East', value: Direction.East },
    { label: 'South East', value: Direction.SouthEast },
    { label: 'South', value: Direction.South },
    { label: 'South West', value: Direction.SouthWest },
    { label: 'West', value: Direction.West },
    { label: 'North West', value: Direction.NorthWest },
];

export function MonsterDialog({
    position,
    zIndex,
    onBringToFront,
}: MonsterDialogProps) {
    const selectedMonster = useStore(monsterDialogStore, (state) => state.selectedMonster);
    const selectedDirection = useStore(monsterDialogStore, (state) => state.selectedDirection);
    const health = useStore(monsterDialogStore, (state) => state.health);
    const damage = useStore(monsterDialogStore, (state) => state.damage);
    const movementSpeed = useStore(monsterDialogStore, (state) => state.movementSpeed);
    const attackSpeed = useStore(monsterDialogStore, (state) => state.attackSpeed);
    const followDistance = useStore(monsterDialogStore, (state) => state.followDistance);
    const attackDistance = useStore(monsterDialogStore, (state) => state.attackDistance);
    const attackType = useStore(monsterDialogStore, (state) => state.attackType);
    const transparency = useStore(monsterDialogStore, (state) => state.transparency);
    const chilledEffect = useStore(monsterDialogStore, (state) => state.chilledEffect);
    const berserkedEffect = useStore(monsterDialogStore, (state) => state.berserkedEffect);

    const handleSummon = () => {
        summonMonster();
    };
    
    const handleKillAll = () => {
        EventBus.emit(IN_UI_KILL_ALL_MONSTERS);
    };
    
    const handleMovementSpeedChange = (speed: number) => {
        setMovementSpeed(speed);
    };
    
    const handleAttackSpeedChange = (speed: number) => {
        setAttackSpeed(speed);
    };
    
    const handleFollowDistanceChange = (distance: number) => {
        setFollowDistance(distance);
    };
    
    const handleAttackDistanceChange = (distance: number) => {
        setAttackDistance(distance);
    };

    return (
        <DraggableDialog 
            title="Summon Monster" 
            position={position} 
            id="monster-dialog" 
            zIndex={zIndex} 
            onBringToFront={onBringToFront}
            onContextMenu={(e) => {
                e.preventDefault();
                setMonsterDialogOpen(false);
            }}
        >
            <div style={{ display: 'flex', flexDirection: 'column', minHeight: 220, flex: 1 }}>
                <div style={{ display: 'flex', flexDirection: 'row', flex: 1, minHeight: 0 }}>
                    <div style={{ flex: 1, minWidth: 0, overflow: 'auto', paddingRight: 8 }}>
                        <div style={{ marginBottom: '3px' }}>
                            <div className="rpg-section-title" style={{ marginBottom: '3px' }}>Monster</div>
                            <select
                                id="monster-select"
                                className="rpg-select"
                                value={selectedMonster}
                                onChange={(e) => setSelectedMonster(e.target.value)}
                                style={{ width: '100%' }}
                            >
                                {MONSTER_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div style={{ marginBottom: '3px' }}>
                            <div className="rpg-section-title" style={{ marginBottom: '3px' }}>Direction</div>
                            <select
                                id="direction-select"
                                className="rpg-select"
                                value={selectedDirection}
                                onChange={(e) => setSelectedDirection(toDirection(Number(e.target.value)))}
                                style={{ width: '100%' }}
                            >
                                {DIRECTION_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div style={{ marginBottom: '3px' }}>
                            <div className="rpg-section-title" style={{ marginBottom: '3px' }}>Attack type</div>
                            <select
                                id="monster-attack-type-select"
                                className="rpg-select"
                                value={attackType}
                                onChange={(e) => setAttackType(Number(e.target.value) as AttackType)}
                                style={{ width: '100%' }}
                            >
                                <option value={AttackType.NoInterrupt}>No Interrupt</option>
                                <option value={AttackType.Interrupt}>Interrupt</option>
                                <option value={AttackType.InterruptKnockback}>Interrupt Knockback</option>
                            </select>
                        </div>
                        <RpgHorizontalSeparator />
                        <div className="rpg-section-title" style={{ marginTop: '6px', marginBottom: '0px' }}>
                            Health
                            <span style={{ marginLeft: '8px', color: '#ffa500', fontSize: '12px' }}>
                                ({health})
                            </span>
                        </div>
                        <div className="rpg-zoom-container">
                            <RpgSlider
                                value={[health]}
                                onValueChange={(value) => setHealth(value[0])}
                                min={1}
                                max={1000}
                                step={1}
                            />
                        </div>
                        <RpgHorizontalSeparator />
                        <div className="rpg-section-title" style={{ marginTop: '6px', marginBottom: '0px' }}>
                            Damage
                            <span style={{ marginLeft: '8px', color: '#ffa500', fontSize: '12px' }}>
                                ({damage})
                            </span>
                        </div>
                        <div className="rpg-zoom-container">
                            <RpgSlider
                                value={[damage]}
                                onValueChange={(value) => setDamage(value[0])}
                                min={1}
                                max={1000}
                                step={1}
                            />
                        </div>
                    </div>
                    <RpgVerticalSeparator />
                    <div style={{ flex: 1, minWidth: 0, overflow: 'auto', paddingLeft: 8 }}>
                        <div className="rpg-section-title" style={{ marginTop: '6px', marginBottom: '0px' }}>
                            Movement speed
                            <span style={{ marginLeft: '8px', color: '#ffa500', fontSize: '12px' }}>
                                ({movementSpeed}{movementSpeed === 0 ? ' - Idle Only' : ''})
                            </span>
                        </div>
                        <div className="rpg-zoom-container">
                            <RpgSlider
                                value={[movementSpeed]}
                                onValueChange={(value) => handleMovementSpeedChange(value[0])}
                                min={0}
                                max={100}
                                step={1}
                            />
                        </div>
                        <RpgHorizontalSeparator />
                        <div className="rpg-section-title" style={{ marginTop: '6px', marginBottom: '0px' }}>
                            Attack speed
                            <span style={{ marginLeft: '8px', color: '#ffa500', fontSize: '12px' }}>
                                ({attackSpeed})
                            </span>
                        </div>
                        <div className="rpg-zoom-container">
                            <RpgSlider
                                value={[attackSpeed]}
                                onValueChange={(value) => handleAttackSpeedChange(value[0])}
                                min={1}
                                max={100}
                                step={1}
                            />
                        </div>
                        <RpgHorizontalSeparator />
                        <div className="rpg-section-title" style={{ marginTop: '6px', marginBottom: '0px' }}>
                            Follow distance
                            <span style={{ marginLeft: '8px', color: '#ffa500', fontSize: '12px' }}>
                                {followDistance === 0 ? '(Disabled)' : `(${followDistance} cells)`}
                            </span>
                        </div>
                        <div className="rpg-zoom-container">
                            <RpgSlider
                                value={[followDistance]}
                                onValueChange={(value) => handleFollowDistanceChange(value[0])}
                                min={0}
                                max={MONSTER_MAX_FOLLOW_DISTANCE}
                                step={1}
                            />
                        </div>
                        <RpgHorizontalSeparator />
                        <div className="rpg-section-title" style={{ marginTop: '6px', marginBottom: '0px' }}>
                            Attack distance
                            <span style={{ marginLeft: '8px', color: '#ffa500', fontSize: '12px' }}>
                                {attackDistance === 0 ? '(Disabled)' : `(${attackDistance} cells)`}
                            </span>
                        </div>
                        <div className="rpg-zoom-container">
                            <RpgSlider
                                value={[attackDistance]}
                                onValueChange={(value) => handleAttackDistanceChange(value[0])}
                                min={0}
                                max={MAX_MONSTER_ATTACK_RANGE}
                                step={1}
                            />
                        </div>
                        <RpgHorizontalSeparator />
                        <div className="rpg-section-title" style={{ marginTop: '6px', marginBottom: '0px' }}>
                            Transparency
                        </div>
                        <div className="rpg-zoom-container">
                            <RpgSlider
                                value={[transparency]}
                                onValueChange={(value) => setTransparency(value[0])}
                                min={0}
                                max={100}
                                step={1}
                            />
                        </div>
                        <RpgHorizontalSeparator />
                        <div className="rpg-zoom-container" style={{ marginTop: '6px', marginBottom: '6px' }}>
                            <RpgCheckbox
                                id="monster-chilled-effect-checkbox"
                                label="Chilled effect"
                                checked={chilledEffect}
                                onCheckedChange={(checked) => setChilledEffect(checked === true)}
                            />
                        </div>
                        <div className="rpg-zoom-container" style={{ marginTop: '6px', marginBottom: '6px' }}>
                            <RpgCheckbox
                                id="monster-berserked-effect-checkbox"
                                label="Berserked effect"
                                checked={berserkedEffect}
                                onCheckedChange={(checked) => setBerserkedEffect(checked === true)}
                            />
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '12px', flexShrink: 0 }}>
                    <RpgButton
                        onClick={handleSummon}
                        style={{
                            padding: '8px 24px',
                            fontSize: '14px',
                            minWidth: '100px',
                        }}
                    >
                        Summon
                    </RpgButton>
                    <RpgButton
                        onClick={handleKillAll}
                        style={{
                            padding: '8px 24px',
                            fontSize: '14px',
                            minWidth: '100px',
                        }}
                    >
                        Kill all
                    </RpgButton>
                </div>
            </div>
        </DraggableDialog>
    );
}
