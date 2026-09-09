import React, { useMemo } from 'react';
import styled from 'styled-components/macro';
import { v4 } from 'uuid';
import tw from 'twin.macro';
import Label from '@/components/elements/Label';
import Input from '@/components/elements/Input';

const ToggleContainer = styled.div`
    ${tw`relative select-none leading-normal`};
    width: 2.25rem; /* 36px */
    height: 1.25rem; /* 20px */

    & > input[type='checkbox'] {
        ${tw`hidden`};

        &:checked + label {
            background-color: #fafafa;
            border-color: #fafafa;
        }

        &:checked + label:before {
            transform: translateX(1rem); /* 16px shift */
            background-color: #09090b;
        }

        &:disabled + label {
            opacity: 0.5;
            cursor: not-allowed;
        }
    }

    & > label {
        margin-bottom: 0;
        display: block;
        position: relative;
        cursor: pointer;
        background-color: #27272a;
        border: 1px solid #27272a;
        border-radius: 9999px;
        width: 2.25rem;
        height: 1.25rem;
        transition: background-color 150ms ease, border-color 150ms ease;

        &::before {
            position: absolute;
            display: block;
            background-color: #a1a1aa;
            height: 1rem;
            width: 1rem;
            border-radius: 9999px;
            top: 1px;
            left: 1px;
            content: '';
            box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.2);
            transition: transform 150ms ease, background-color 150ms ease;
        }

        &:hover {
            border-color: #3f3f46;
        }
    }
`;

export interface SwitchProps {
    name: string;
    label?: string;
    description?: string;
    defaultChecked?: boolean;
    readOnly?: boolean;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    children?: React.ReactNode;
}

const Switch = ({ name, label, description, defaultChecked, readOnly, onChange, children }: SwitchProps) => {
    const uuid = useMemo(() => v4(), []);

    return (
        <div css={tw`flex items-center`}>
            <ToggleContainer css={tw`flex-none`}>
                {children || (
                    <Input
                        id={uuid}
                        name={name}
                        type={'checkbox'}
                        onChange={(e) => onChange && onChange(e)}
                        defaultChecked={defaultChecked}
                        disabled={readOnly}
                    />
                )}
                <Label htmlFor={uuid} />
            </ToggleContainer>
            {(label || description) && (
                <div css={tw`ml-4 w-full`}>
                    {label && (
                        <Label css={[tw`cursor-pointer`, !!description && tw`mb-0`]} htmlFor={uuid}>
                            {label}
                        </Label>
                    )}
                    {description && <p className={'text-zinc-400 text-xs mt-0.5 m-0 font-sans'}>{description}</p>}
                </div>
            )}
        </div>
    );
};

export default Switch;
