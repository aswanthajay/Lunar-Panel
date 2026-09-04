import styled, { css } from 'styled-components/macro';
import tw from 'twin.macro';

interface Props {
    hideDropdownArrow?: boolean;
}

const Select = styled.select<Props>`
    ${tw`shadow-none block p-2.5 pr-8 rounded-md border w-full text-xs font-sans transition-colors duration-150 ease-linear`};
    background-color: #070708;
    border-color: #1C1C20;
    color: #FFFFFF;

    &,
    &:hover:not(:disabled),
    &:focus {
        ${tw`outline-none`};
    }

    &:hover:not(:disabled) {
        border-color: #4E4E5A;
    }

    &:focus {
        border-color: #FFFFFF;
        box-shadow: 0 0 0 1px #FFFFFF;
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
            background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3e%3cpath fill='%239A9AA2' d='M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z'/%3e%3c/svg%3e ");
        `};
`;

export default Select;
