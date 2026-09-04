import styled from 'styled-components/macro';
import tw, { theme } from 'twin.macro';

const SubNavigation = styled.div`
    ${tw`w-full bg-[#101216] border-b border-[#1e2229] py-3 px-4 mb-6 rounded-2xl`};

    & > div {
        ${tw`flex items-center space-x-2 text-sm max-w-[1440px] mx-auto`};

        & > a,
        & > div {
            ${tw`inline-block py-2 px-4 rounded-full text-xs font-medium text-[#8b949e] no-underline whitespace-nowrap transition-all duration-150`};

            &:hover {
                ${tw`text-white bg-[#151820]`};
            }

            &:active,
            &.active {
                ${tw`text-white font-bold bg-[#10b981]`};
                box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25);
            }
        }
    }
`;

export default SubNavigation;
