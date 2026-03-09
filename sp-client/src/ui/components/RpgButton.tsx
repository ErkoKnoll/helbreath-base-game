import { ButtonHTMLAttributes } from 'react';
import '../rpg-ui.css';

interface RpgButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    children: React.ReactNode;
    variant?: 'primary' | 'compact';
}

export function RpgButton({ children, variant = 'primary', className, onPointerDown, ...props }: RpgButtonProps) {
    return (
        <button 
            className={`button ${className || ''}`}
            onPointerDown={(e) => {
                e.stopPropagation();
                onPointerDown?.(e);
            }}
            {...props}
        >
            {children}
        </button>
    );
}
