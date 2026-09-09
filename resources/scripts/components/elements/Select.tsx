import styled, { css } from 'styled-components/macro';
import tw from 'twin.macro';

interface Props {
    hideDropdownArrow?: boolean;
}

const Select = styled.select<Props>`
    ${tw`block px-3 py-1.5 pr-8 rounded-md border w-full text-xs font-sans transition-all duration-150 outline-none select-none`};
    height: 2.25rem; /* 36px / h-9 */
    background-color: #09090b;
    border-color: #27272a;
    color: #f4f4f5;
    font-family: var(--font-sans, 'Inter', sans-serif);
    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);

    &:hover:not(:disabled) {
        border-color: #3f3f46;
    }

    &:focus-visible,
    &:focus {
        border-color: #a1a1aa;
        outline: none;
        box-shadow: 0 0 0 1px #a1a1aa;
    }

    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    -webkit-appearance: none;
    -moz-appearance: none;
    background-size: 1rem;
    background-repeat: no-repeat;
    background-position-x: calc(100% - 0.75rem);
    background-position-y: center;

    &::-ms-expand {
        display: none;
    }

    ${(props) =>
        !props.hideDropdownArrow &&
        css`
            background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23a1a1aa' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
        `};
`;

export default Select;
