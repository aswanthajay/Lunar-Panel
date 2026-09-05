import styled from 'styled-components/macro';
import tw from 'twin.macro';

export default styled.div<{ $hoverable?: boolean }>`
    ${tw`flex rounded-xl no-underline text-[#1a1a1a] dark:text-[#ededed] items-center p-4 border transition-all duration-150 overflow-hidden`};
    background-color: #ffffff;
    border-color: #dedfdf;
    font-family: var(--font-sans, 'Inter', sans-serif);

    .dark & {
        background-color: #000000;
        border-color: #262626;
    }

    ${(props) => props.$hoverable !== false && tw`hover:border-[#a7aaaa] dark:hover:border-[#52525b]`};

    & .icon {
        ${tw`rounded-lg w-9 h-9 flex items-center justify-center p-1.5 mr-3 border border-[#dedfdf] dark:border-[#262626]`};
        background-color: #f4f5f5;
        color: #1a1a1a;

        .dark & {
            background-color: #1a1a1a;
            color: #ededed;
        }
    }
`;
