import * as SliderPrimitive from '@radix-ui/react-slider';
import '../rpg-ui.css';

interface RpgSliderProps {
    value: number[];
    onValueChange: (value: number[]) => void;
    onValueCommit?: (value: number[]) => void;
    min: number;
    max: number;
    step: number;
    disabled?: boolean;
}

export function RpgSlider({ value, onValueChange, onValueCommit, min, max, step, disabled = false }: RpgSliderProps) {
    return (
        <SliderPrimitive.Root
            className="rpg-slider-root"
            value={value}
            onValueChange={onValueChange}
            onValueCommit={onValueCommit}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
        >
            <SliderPrimitive.Track className="rpg-slider-track">
                <SliderPrimitive.Range className="rpg-slider-range" />
            </SliderPrimitive.Track>
            <SliderPrimitive.Thumb className="rpg-slider-thumb" />
        </SliderPrimitive.Root>
    );
}
