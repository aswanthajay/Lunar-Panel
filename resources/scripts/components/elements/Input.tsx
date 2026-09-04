import styled, { css } from 'styled-components/macro';
import tw from 'twin.macro';

export interface Props {
    isLight?: boolean;
    hasError?: boolean;
}

const light = css<Props>`
    ${tw`bg-[#000000] border-[#1F1F1F] text-[#FFFFFF]`};
    &:focus {
        border-color: #FFFFFF;
    }

    &:disabled {
        ${tw`bg-[#050505] border-[#1A1A1A] text-[#707070]`};
    }
`;

const checkboxStyle = css<Props>`
    ${tw`bg-[#000000] cursor-pointer appearance-none inline-block align-middle select-none flex-shrink-0 w-4 h-4 text-[#FFFFFF] border border-[#222222] rounded`};
    color-adjust: exact;
    background-origin: border-box;
    transition: all 75ms linear, box-shadow 25ms linear;

    &:checked {
        ${tw`border-[#FFFFFF] bg-[#FFFFFF] bg-no-repeat bg-center`};
        background-image: url("data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='black' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M5.707 7.293a1 1 0 0 0-1.414 1.414l2 2a1 1 0 0 0 1.414 0l4-4a1 1 0 0 0-1.414-1.414L7 8.586 5.707 7.293z'/%3e%3c/svg%3e");
        background-color: #FFFFFF;
        background-size: 100% 100%;
    }

    &:focus {
        outline: none;
        border-color: #FFFFFF;
        box-shadow: 0 0 0 1px #FFFFFF;
    }
`;

const inputStyle = css<Props>`
    resize: none;
    ${tw`appearance-none outline-none w-full min-w-0 font-sans`};
    ${tw`p-2.5 rounded-md text-xs transition-all duration-150`};
    background-color: #000000;
    border: 1px solid #2B2B2B;
    color: #FFFFFF;
    font-family: var(--font-sans, 'Inter', sans-serif);

    &:hover:not(:disabled):not(:read-only) {
        border-color: #484848;
    }

    &:focus {
        border-color: #FFFFFF;
        box-shadow: 0 0 0 1px #FFFFFF;
    }

    &:disabled,
    &:read-only {
        background-color: #050505;
        border-color: #1A1A1A;
        color: #707070;
        cursor: not-allowed;
    }

    & + .input-help {
        ${tw`mt-1 text-xs text-[#5E5E67]`};
        ${(props) => (props.hasError ? tw`text-red-400` : tw`text-[#5E5E67]`)};
    }

    &:required,
    &:invalid {
        ${tw`shadow-none`};
    }

    ${(props) => props.isLight && light};
    ${(props) => props.hasError && tw`text-red-100 border-red-400 hover:border-red-300`};
`;

const Input = styled.input<Props>`
    &:not([type='checkbox']):not([type='radio']) {
        ${inputStyle};
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
    ${inputStyle}
`;

export { Textarea };
export default Input;
