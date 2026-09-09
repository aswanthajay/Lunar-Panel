import React from 'react';
import styled, { css } from 'styled-components/macro';
import tw from 'twin.macro';
import Spinner from '@/components/elements/Spinner';

interface Props {
    isLoading?: boolean;
    size?: 'xsmall' | 'small' | 'large' | 'xlarge';
    color?: 'green' | 'red' | 'primary' | 'grey';
    isSecondary?: boolean;
}

const ButtonStyle = styled.button<Omit<Props, 'isLoading'>>`
    /* shadcn/ui button base */
    ${tw`relative inline-flex items-center justify-center rounded-md text-xs font-medium transition-all duration-150 border select-none outline-none font-sans`};
    font-family: var(--font-sans, 'Inter', sans-serif);
    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);

    &:active:not(:disabled) {
        transform: scale(0.98);
    }

    &:focus-visible {
        outline: none;
        box-shadow: 0 0 0 1px #a1a1aa, 0 0 0 2px rgba(0, 0, 0, 0.8);
    }

    /* Primary / Default variant */
    ${(props) =>
        ((!props.isSecondary && !props.color) || props.color === 'primary') &&
        css<Props>`
            ${(props) =>
                !props.isSecondary &&
                css`
                    background-color: #fafafa;
                    border-color: #fafafa;
                    color: #09090b;

                    &:hover:not(:disabled) {
                        background-color: #e4e4e7;
                        border-color: #e4e4e7;
                    }
                `};
        `};

    /* Grey / Neutral variant */
    ${(props) =>
        props.color === 'grey' &&
        css`
            background-color: #18181b;
            border-color: #27272a;
            color: #f4f4f5;

            &:hover:not(:disabled) {
                background-color: #27272a;
                border-color: #3f3f46;
                color: #ffffff;
            }
        `};

    /* Green / Success variant */
    ${(props) =>
        props.color === 'green' &&
        css<Props>`
            background-color: rgba(6, 78, 59, 0.35);
            border-color: rgba(16, 185, 129, 0.4);
            color: #6ee7b7;

            &:hover:not(:disabled) {
                background-color: rgba(6, 78, 59, 0.55);
                border-color: rgba(16, 185, 129, 0.6);
                color: #a7f3d0;
            }

            ${(props) =>
                props.isSecondary &&
                css`
                    background-color: transparent;
                    border-color: rgba(16, 185, 129, 0.3);
                    color: #34d399;

                    &:hover:not(:disabled) {
                        background-color: rgba(6, 78, 59, 0.25);
                        border-color: rgba(16, 185, 129, 0.5);
                    }
                `};
        `};

    /* Red / Destructive variant */
    ${(props) =>
        props.color === 'red' &&
        css<Props>`
            background-color: rgba(127, 29, 29, 0.35);
            border-color: rgba(239, 68, 68, 0.4);
            color: #fca5a5;

            &:hover:not(:disabled) {
                background-color: rgba(127, 29, 29, 0.55);
                border-color: rgba(239, 68, 68, 0.6);
                color: #fecaca;
            }

            ${(props) =>
                props.isSecondary &&
                css`
                    background-color: transparent;
                    border-color: rgba(239, 68, 68, 0.3);
                    color: #f87171;

                    &:hover:not(:disabled) {
                        background-color: rgba(127, 29, 29, 0.25);
                        border-color: rgba(239, 68, 68, 0.5);
                    }
                `};
        `};

    /* Sizes */
    ${(props) => props.size === 'xsmall' && tw`h-7 px-2.5 text-xs`};
    ${(props) => (!props.size || props.size === 'small') && tw`h-9 px-3.5 text-xs`};
    ${(props) => props.size === 'large' && tw`h-10 px-5 text-sm`};
    ${(props) => props.size === 'xlarge' && tw`h-11 px-6 text-sm w-full`};

    /* Secondary / Outline variant */
    ${(props) =>
        props.isSecondary &&
        css<Props>`
            background-color: #121215;
            border-color: #27272a;
            color: #f4f4f5;

            &:hover:not(:disabled) {
                background-color: #1c1c21;
                border-color: #3f3f46;
                color: #ffffff;
            }
        `};

    &:disabled {
        opacity: 0.45;
        cursor: not-allowed;
        pointer-events: none;
    }
`;

type ComponentProps = Omit<JSX.IntrinsicElements['button'], 'ref' | keyof Props> & Props;

const Button: React.FC<ComponentProps> = ({ children, isLoading, ...props }) => (
    <ButtonStyle {...props}>
        {isLoading && (
            <div css={tw`flex absolute justify-center items-center w-full h-full left-0 top-0`}>
                <Spinner size={'small'} />
            </div>
        )}
        <span css={isLoading ? tw`text-transparent` : undefined} className="select-none font-medium flex items-center gap-1.5">{children}</span>
    </ButtonStyle>
);

type LinkProps = Omit<JSX.IntrinsicElements['a'], 'ref' | keyof Props> & Props;

const LinkButton: React.FC<LinkProps> = (props) => <ButtonStyle as={'a'} {...props} />;

export { LinkButton, ButtonStyle };
export default Button;
