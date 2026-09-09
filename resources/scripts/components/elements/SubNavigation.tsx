import styled from 'styled-components/macro';
import tw, { theme } from 'twin.macro';

const SubNavigation = styled.div`
    ${tw`w-full bg-zinc-950/60 border border-zinc-800/80 p-1.5 mb-6 rounded-xl backdrop-blur-sm shadow-xs`};

    & > div {
        ${tw`flex items-center space-x-1.5 text-xs max-w-[1440px] mx-auto overflow-x-auto`};

        & > a,
        & > div {
            ${tw`inline-flex items-center justify-center py-1.5 px-3.5 rounded-lg text-xs font-medium text-zinc-400 no-underline whitespace-nowrap transition-all duration-150`};

            &:hover {
                ${tw`text-zinc-200 bg-zinc-900/60`};
            }

            &:active,
            &.active {
                ${tw`text-zinc-100 font-medium bg-zinc-800 shadow-xs border border-zinc-700/50`};
            }
        }
    }
`;

export default SubNavigation;
