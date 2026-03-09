import * as SeparatorPrimitive from '@radix-ui/react-separator';
import '../rpg-ui.css';

export function RpgHorizontalSeparator() {
    return (
        <SeparatorPrimitive.Root
            className="rpg-horizontal-separator"
            decorative
            orientation="horizontal"
        />
    );
}
