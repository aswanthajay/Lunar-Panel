import React, { memo, useCallback } from 'react';
import { useField } from 'formik';
import Input from '@/components/elements/Input';
import isEqual from 'react-fast-compare';

interface Props {
    isEditable: boolean;
    title: string;
    permissions: string[];
    className?: string;
    children?: React.ReactNode;
}

const PermissionTitleBox: React.FC<Props> = memo(({ isEditable, title, permissions, className, children }) => {
    const [{ value }, , { setValue }] = useField<string[]>('permissions');

    const isAllChecked = permissions.length > 0 && permissions.every((p) => value.includes(p));

    const onCheckboxClicked = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            if (e.currentTarget.checked) {
                setValue([...value, ...permissions.filter((p) => !value.includes(p))]);
            } else {
                setValue(value.filter((p) => !permissions.includes(p)));
            }
        },
        [permissions, value]
    );

    return (
        <div className={`rounded-xl bg-[#000000] border border-[#1F1F1F] overflow-hidden shadow-sm select-none ${className || ''}`}>
            {/* Header with full width alignment */}
            <div className="bg-[#050505] px-5 py-3 border-b border-[#141414] flex items-center justify-between">
                <span className="font-mono text-xs uppercase tracking-wider font-semibold text-[#FFFFFF]">
                    {title}
                </span>

                {isEditable && (
                    <label className="flex items-center gap-2 cursor-pointer text-[11px] font-mono text-[#737373] hover:text-[#FFFFFF] transition-colors select-none m-0">
                        <span>Select all</span>
                        <Input
                            type={'checkbox'}
                            checked={isAllChecked}
                            onChange={onCheckboxClicked}
                        />
                    </label>
                )}
            </div>

            {/* Body */}
            <div className="p-5 text-[#D4D4D4] font-sans">
                {children}
            </div>
        </div>
    );
}, isEqual);

export default PermissionTitleBox;

