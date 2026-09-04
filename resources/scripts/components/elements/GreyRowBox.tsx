import styled from 'styled-components/macro';
import tw from 'twin.macro';

export default styled.div<{ $hoverable?: boolean }>`
    ${tw`flex rounded-md no-underline text-[#FFFFFF] items-center p-3.5 border transition-all duration-150 overflow-hidden`};
    background-color: #000000;
    border-color: #1F1F1F;
    font-family: var(--font-sans, 'Inter', sans-serif);

    ${(props) => props.$hoverable !== false && tw`hover:border-[#383838] hover:bg-[#0A0A0A]`};

    & .icon {
        ${tw`rounded w-8 h-8 flex items-center justify-center p-1.5 mr-3 border border-[#1F1F1F]`};
        background-color: #0A0A0A;
        color: #A0A0A0;
    }
`;
