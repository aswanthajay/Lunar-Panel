import styled, { css } from 'styled-components/macro';
import tw from 'twin.macro';

export default styled.div<{ $hoverable?: boolean }>`
    ${tw`flex rounded-lg no-underline text-zinc-100 items-center p-3.5 border transition-all duration-150 overflow-hidden font-sans shadow-xs`};
    background-color: #09090b;
    border-color: #27272a;
    font-family: var(--font-sans, 'Inter', sans-serif);

    ${(props) =>
        props.$hoverable !== false &&
        css`
            &:hover {
                background-color: #121215;
                border-color: #3f3f46;
            }
        `};

    & .icon {
        ${tw`rounded-md w-8 h-8 flex items-center justify-center p-1.5 mr-3 border border-zinc-800 text-zinc-300 transition-colors`};
        background-color: #18181b;
    }
`;
