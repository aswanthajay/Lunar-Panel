import React, { useMemo } from 'react';
import styled from 'styled-components/macro';
import { v4 } from 'uuid';
import tw from 'twin.macro';
import Label from '@/components/elements/Label';
import Input from '@/components/elements/Input';

const ToggleContainer = styled.div`
    ${tw`relative select-none w-11 leading-normal`};

    & > input[type='checkbox'] {
        ${tw`hidden`};

        &:checked + label {
            background-color: #FFFFFF;
            border-color: #FFFFFF;
            box-shadow: none;
        }

        &:checked + label:before {
            right: 0.125rem;
            background-color: #000000;
        }
    }

    & > label {
        margin-bottom: 0;
        display: block;
        overflow: hidden;
        cursor: pointer;
        background-color: #1F1F1F;
        border: 1px solid #333333;
        border-radius: 9999px;
        height: 1.375rem;
        transition: all 120ms ease;

        &::before {
            position: absolute;
            display: block;
            background-color: #737373;
            height: 1.125rem;
            width: 1.125rem;
            border-radius: 9999px;
            top: 0.125rem;
            right: calc(50% + 0.125rem);
            content: '';
            transition: all 120ms ease;
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
                    {description && <p className={'text-[#737373] text-xs mt-1 m-0 font-sans'}>{description}</p>}
                </div>
            )}
        </div>
    );
};

export default Switch;
