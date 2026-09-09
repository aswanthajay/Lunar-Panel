import React from 'react';
import Spinner, { SpinnerSize } from '@/components/elements/Spinner';
import Fade from '@/components/elements/Fade';
import tw from 'twin.macro';

interface Props {
    visible: boolean;
    fixed?: boolean;
    size?: SpinnerSize;
    backgroundOpacity?: number;
}

const SpinnerOverlay: React.FC<Props> = ({ size, fixed, visible, backgroundOpacity, children }) => (
    <Fade timeout={150} in={visible} unmountOnExit>
        <div
            css={[
                tw`top-0 left-0 flex items-center justify-center w-full h-full rounded-md flex-col z-40 backdrop-blur-sm`,
                !fixed ? tw`absolute` : tw`fixed`,
            ]}
            style={{ background: `rgba(9, 9, 11, ${backgroundOpacity || 0.6})` }}
        >
            <Spinner size={size} />
            {children && (typeof children === 'string' ? <p css={tw`mt-4 text-xs font-medium text-zinc-400`}>{children}</p> : children)}
        </div>
    </Fade>
);

export default SpinnerOverlay;
