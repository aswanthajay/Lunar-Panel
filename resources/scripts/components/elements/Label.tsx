import styled from 'styled-components/macro';
import tw from 'twin.macro';

const Label = styled.label<{ isLight?: boolean }>`
    ${tw`block text-xs font-medium text-zinc-300 mb-1.5 font-sans tracking-normal leading-none`};
    ${(props) => props.isLight && tw`text-zinc-400`};
`;

export default Label;
