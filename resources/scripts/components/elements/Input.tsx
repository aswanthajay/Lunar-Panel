import styled, { css } from 'styled-components/macro';
import tw from 'twin.macro';

export interface Props {
    isLight?: boolean;
    hasError?: boolean;
}

const light = css<Props>`
    background-color: #09090b;
    border-color: #27272a;
    color: #f4f4f5;

    &:focus {
        border-color: #a1a1aa;
        box-shadow: 0 0 0 1px #a1a1aa;
    }

    &:disabled {
        background-color: #09090b;
        border-color: #18181b;
        color: #71717a;
    }
`;

const checkboxStyle = css<Props>`
    ${tw`cursor-pointer appearance-none inline-block align-middle select-none flex-shrink-0 w-4 h-4 rounded-[4px] transition-all duration-150`};
    background-color: #09090b;
    border: 1px solid #27272a;
    color-adjust: exact;
    background-origin: border-box;

    &:hover:not(:disabled) {
        border-color: #3f3f46;
    }

    &:checked {
        border-color: #fafafa;
        background-color: #fafafa;
        background-image: url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='%2309090b' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 0 1 0 1.414l-5 5a1 1 0 0 1-1.414 0l-2-2a1 1 0 0 1 1.414-1.414L6.5 9.086l4.293-4.293a1 1 0 0 1 1.414 0z'/%3e%3c/svg%3e");
        background-repeat: no-repeat;
        background-position: center;
        background-size: 100% 100%;
    }

    &:focus-visible {
        outline: none;
        border-color: #a1a1aa;
        box-shadow: 0 0 0 1px #a1a1aa;
    }

    &:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }
`;

const inputStyle = css<Props>`
    resize: none;
    ${tw`appearance-none outline-none w-full min-w-0 font-sans`};
    ${tw`px-3 py-2 rounded-md text-xs transition-all duration-150`};
    background-color: #09090b;
    border: 1px solid #27272a;
    color: #f4f4f5;
    font-family: var(--font-sans, 'Inter', sans-serif);
    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);

    &::placeholder {
        color: #71717a;
    }

    &:hover:not(:disabled):not(:read-only) {
        border-color: #3f3f46;
    }

    &:focus-visible,
    &:focus {
        border-color: #a1a1aa;
        outline: none;
        box-shadow: 0 0 0 1px #a1a1aa;
    }

    &:disabled,
    &:read-only {
        background-color: #09090b;
        border-color: #18181b;
        color: #71717a;
        cursor: not-allowed;
        opacity: 0.6;
    }

    & + .input-help {
        ${tw`mt-1 text-xs text-zinc-500`};
        ${(props) => (props.hasError ? tw`text-red-400 font-medium` : tw`text-zinc-500`)};
    }

    &:required,
    &:invalid {
        ${tw`shadow-none`};
    }

    ${(props) => props.isLight && light};
    ${(props) =>
        props.hasError &&
        css`
            border-color: rgba(239, 68, 68, 0.7);
            color: #fca5a5;

            &:focus {
                border-color: #ef4444;
                box-shadow: 0 0 0 1px #ef4444;
            }
        `};
`;

const Input = styled.input<Props>`
    &:not([type='checkbox']):not([type='radio']) {
        ${inputStyle};
        height: 2.25rem; /* 36px / h-9 */
    }

    &[type='checkbox'],
    &[type='radio'] {
        ${checkboxStyle};

        &[type='radio'] {
            ${tw`rounded-full`};
        }
    }
`;

const Textarea = styled.textarea<Props>`
    ${inputStyle};
    min-height: 5rem;
`;

export { Textarea };
export default Input;
