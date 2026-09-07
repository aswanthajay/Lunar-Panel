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
    ${tw`rounded-full w-9 h-9 flex items-center justify-center p-0 bg-[#000000] border border-[#1F1F1F] hover:border-[#383838] text-[#A0A0A0] hover:text-[#FFFFFF] transition-colors`};

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
            <div className="w-full max-w-lg p-10 sm:p-14 bg-[#0A0A0A] border border-[#1F1F1F] rounded-2xl shadow-2xl text-center relative overflow-hidden">
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
                    <div className="w-16 h-16 rounded-2xl bg-[#000000] border border-[#1F1F1F] flex items-center justify-center mx-auto mb-6 shadow-inner">
                        <img src={image} className="w-8 h-8 object-contain filter invert opacity-80" alt={title} />
                    </div>
                )}
                
                <h2 className="font-serif text-2xl sm:text-3xl font-normal text-[#FFFFFF] tracking-tight m-0">
                    {title}
                </h2>
                <p className="text-xs text-[#8A8A8A] font-sans mt-3 max-w-sm mx-auto leading-relaxed m-0">
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

