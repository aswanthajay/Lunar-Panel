import React, { useState, useRef, useEffect } from 'react';

export interface DropdownOption {
    id: string;
    label: string;
    icon?: React.ReactNode;
    badge?: string;
    isDestructive?: boolean;
    isDisabled?: boolean;
    onClick: () => void;
}

export interface ProductDropdownProps {
    trigger: React.ReactNode;
    options: DropdownOption[];
    align?: 'left' | 'right';
    menuWidth?: string;
}

export const ProductDropdown: React.FC<ProductDropdownProps> = ({
    trigger,
    options,
    align = 'right',
    menuWidth = 'w-48',
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    return (
        <div className="relative inline-block text-left" ref={dropdownRef}>
            <div onClick={() => setIsOpen((prev) => !prev)}>
                {trigger}
            </div>

            {isOpen && (
                <div
                    className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} mt-1.5 ${menuWidth} bg-[#0E0E11] border border-[#2B2B32] rounded-md shadow-2xl py-1 z-50 focus:outline-none`}
                    role="menu"
                >
                    {options.map((option) => (
                        <button
                            key={option.id}
                            type="button"
                            disabled={option.isDisabled}
                            onClick={() => {
                                setIsOpen(false);
                                option.onClick();
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors cursor-pointer bg-transparent border-none text-left disabled:opacity-40 disabled:cursor-not-allowed ${
                                option.isDestructive
                                    ? 'text-[#EF4444] hover:bg-[#1F1315]'
                                    : 'text-[#9A9AA2] hover:text-[#FFFFFF] hover:bg-[#16161A]'
                            }`}
                            role="menuitem"
                        >
                            <div className="flex items-center space-x-2">
                                {option.icon && <span className="w-3.5 h-3.5">{option.icon}</span>}
                                <span>{option.label}</span>
                            </div>
                            {option.badge && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#16161A] text-[#9A9AA2] border border-[#2B2B32]">
                                    {option.badge}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
