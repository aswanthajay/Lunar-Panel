import React from 'react';
import { ServerContext } from '@/state/server';

interface FileActionCheckboxProps {
    name?: string;
    value?: string;
    checked?: boolean;
    type?: string;
    onChange?: (e: any) => void;
    className?: string;
    [key: string]: any;
}

export const FileActionCheckbox: React.FC<FileActionCheckboxProps> = ({
    name,
    value,
    checked = false,
    onChange,
    className = '',
}) => {
    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (onChange) {
            onChange({
                target: { name, value, checked: !checked },
                currentTarget: { name, value, checked: !checked },
            });
        }
    };

    return (
        <button
            type="button"
            role="checkbox"
            aria-checked={checked}
            name={name}
            value={value}
            onClick={handleClick}
            className={`w-4 h-4 rounded-[4px] border flex items-center justify-center transition-all cursor-pointer select-none shrink-0 outline-none ${
                checked
                    ? 'bg-white border-white'
                    : 'bg-[#0A0A0A] border-[#313131] hover:border-[#656B6B]'
            } ${className}`}
        >
            {checked && (
                <svg className="w-3 h-3 text-black stroke-[3.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
            )}
        </button>
    );
};

export default ({ name }: { name: string }) => {
    const isChecked = ServerContext.useStoreState((state) => state.files.selectedFiles.indexOf(name) >= 0);
    const appendSelectedFile = ServerContext.useStoreActions((actions) => actions.files.appendSelectedFile);
    const removeSelectedFile = ServerContext.useStoreActions((actions) => actions.files.removeSelectedFile);

    const handleToggle = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (isChecked) {
            removeSelectedFile(name);
        } else {
            appendSelectedFile(name);
        }
    };

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={handleToggle}
            onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    handleToggle(e as any);
                }
            }}
            className="flex-none flex items-center justify-center px-4 py-2.5 cursor-pointer z-10 select-none"
        >
            <div
                className={`w-4 h-4 rounded-[4px] border flex items-center justify-center transition-all cursor-pointer select-none shrink-0 ${
                    isChecked
                        ? 'bg-white border-white'
                        : 'bg-[#0A0A0A] border-[#313131] hover:border-[#656B6B]'
                }`}
            >
                {isChecked && (
                    <svg className="w-3 h-3 text-black stroke-[3.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                )}
            </div>
        </div>
    );
};
