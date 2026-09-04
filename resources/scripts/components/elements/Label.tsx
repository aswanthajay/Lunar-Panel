import styled from 'styled-components/macro';
import tw from 'twin.macro';

const Label = styled.label<{ isLight?: boolean }>`
    ${tw`block text-[10px] font-semibold uppercase tracking-wider text-[#737373] mb-1 sm:mb-2 font-sans`};
    ${(props) => props.isLight && tw`text-[#525252]`};
`;

export default Label;
