import React from 'react';
import PageContentBlock from '@/components/elements/PageContentBlock';
import styled, { keyframes } from 'styled-components/macro';
import tw from 'twin.macro';
import Button from '@/components/elements/Button';
import NotFoundSvg from '@/assets/images/not_found.svg';
import ServerErrorSvg from '@/assets/images/server_error.svg';

interface BaseProps {
    title: string;
    image: string;
    message: string;
    onRetry?: () => void;
    onBack?: () => void;
}

interface PropsWithRetry extends BaseProps {
    onRetry?: () => void;
    onBack?: never;
}

interface PropsWithBack extends BaseProps {
    onBack?: () => void;
    onRetry?: never;
}

export type ScreenBlockProps = PropsWithBack | PropsWithRetry;

const spin = keyframes`
    to { transform: rotate(360deg) }
`;

const ActionButton = styled(Button)`
    ${tw`rounded-md w-8 h-8 flex items-center justify-center p-0 bg-zinc-950 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-100 transition-colors shadow-xs`};

    &.hover\\:spin:hover {
        animation: ${spin} 2s linear infinite;
    }
`;

// Inline SVG icons — no FA dependency, no colored artifacts
const IconSync = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="23 4 23 10 17 10" />
        <polyline points="1 20 1 14 7 14" />
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
);

const IconArrowLeft = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <line x1="19" y1="12" x2="5" y2="12" />
        <polyline points="12 19 5 12 12 5" />
    </svg>
);

const ScreenBlock = ({ title, image, message, onBack, onRetry }: ScreenBlockProps) => (
    <PageContentBlock>
        <div className="flex justify-center items-center min-h-[60vh] px-4 select-none font-sans">
            <div className="w-full max-w-md p-8 sm:p-10 bg-zinc-950 border border-zinc-800/80 rounded-xl shadow-2xl text-center relative overflow-hidden backdrop-blur-sm">
                {(typeof onBack === 'function' || typeof onRetry === 'function') && (
                    <div className="absolute left-0 top-0 ml-5 mt-5">
                        <ActionButton
                            onClick={() => (onRetry ? onRetry() : onBack ? onBack() : null)}
                            className={onRetry ? 'hover:spin' : undefined}
                        >
                            {onRetry ? <IconSync /> : <IconArrowLeft />}
                        </ActionButton>
                    </div>
                )}
                
                {image && (
                    <div className="w-12 h-12 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center mx-auto mb-5 shadow-xs">
                        <img src={image} className="w-6 h-6 object-contain filter invert opacity-80" alt={title} />
                    </div>
                )}
                
                <h2 className="font-sans text-xl font-semibold text-zinc-100 tracking-tight m-0">
                    {title}
                </h2>
                <p className="text-xs text-zinc-400 font-sans mt-2 max-w-sm mx-auto leading-relaxed m-0">
                    {message}
                </p>
            </div>
        </div>
    </PageContentBlock>
);

type ServerErrorProps = (Omit<PropsWithBack, 'image' | 'title'> | Omit<PropsWithRetry, 'image' | 'title'>) & {
    title?: string;
};

const ServerError = ({ title, ...props }: ServerErrorProps) => (
    <ScreenBlock title={title || 'Something went wrong'} image={ServerErrorSvg} {...props} />
);

const NotFound = ({ title, message, onBack }: Partial<Pick<ScreenBlockProps, 'title' | 'message' | 'onBack'>>) => (
    <ScreenBlock
        title={title || '404 - Not Found'}
        image={NotFoundSvg}
        message={message || 'The requested resource was not found on this node.'}
        onBack={onBack}
    />
);

export { ServerError, NotFound };
export default ScreenBlock;

