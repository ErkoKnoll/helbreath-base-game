import * as SeparatorPrimitive from '@radix-ui/react-separator';
import '../rpg-ui.css';

export function RpgVerticalSeparator() {
    return (
        <SeparatorPrimitive.Root
            className="rpg-vertical-separator"
            decorative
            orientation="vertical"
        />
    );
}
