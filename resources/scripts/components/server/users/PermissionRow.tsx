import React from 'react';
import Checkbox from '@/components/elements/Checkbox';
import { useStoreState } from 'easy-peasy';

interface Props {
    permission: string;
    disabled: boolean;
}

const PermissionRow = ({ permission, disabled }: Props) => {
    const [key, pkey] = permission.split('.', 2);
    const permissions = useStoreState((state) => state.permissions.data);
    const description = permissions[key]?.keys?.[pkey] || '';

    return (
        <label
            htmlFor={`permission_${permission}`}
            className={`flex items-start gap-3 p-3 rounded-lg border border-[#141414] bg-[#000000] transition-all select-none m-0 ${
                disabled
                    ? 'opacity-40 cursor-not-allowed'
                    : 'cursor-pointer hover:bg-[#050505] hover:border-[#1F1F1F]'
            } [&:not(:first-of-type)]:mt-2`}
        >
            <div className="pt-0.5 shrink-0">
                <Checkbox
                    id={`permission_${permission}`}
                    name={'permissions'}
                    value={permission}
                    className="w-4 h-4"
                    disabled={disabled}
                />
            </div>
            <div className="flex-1 min-w-0">
                <p className="font-mono text-xs font-semibold uppercase tracking-wider text-[#FFFFFF] m-0 leading-tight">
                    {pkey}
                </p>
                {description.length > 0 && (
                    <p className="text-[11px] font-sans text-[#737373] mt-1 m-0 leading-relaxed">
                        {description}
                    </p>
                )}
            </div>
        </label>
    );
};

export default PermissionRow;

