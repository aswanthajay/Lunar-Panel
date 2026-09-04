import React, { useEffect, useCallback } from 'react';

export interface ModalActionConfig {
    label: string;
    onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
    isLoading?: boolean;
    isDisabled?: boolean;
}

export interface ProductActionModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    confirmAction?: ModalActionConfig;
    cancelAction?: ModalActionConfig;
    isDestructive?: boolean;
    children?: React.ReactNode;
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
}

const maxWidthMap = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
};

export const ProductActionModal: React.FC<ProductActionModalProps> = ({
    isOpen,
    onClose,
    title,
    description,
    confirmAction,
    cancelAction,
    isDestructive = false,
    children,
    maxWidth = 'md',
}) => {
    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        },
        [isOpen, onClose]
    );

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            window.addEventListener('keydown', handleKeyDown);
        } else {
            document.body.style.overflow = '';
        }

        return () => {
            document.body.style.overflow = '';
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, handleKeyDown]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
        >
            <div
                onClick={onClose}
                className="fixed inset-0 bg-[#000000]/85 backdrop-blur-md transition-opacity duration-200"
                aria-hidden="true"
            />

            <div
                className={`relative w-full ${maxWidthMap[maxWidth]} bg-[#0A0A0A] border border-[#222222] rounded-lg shadow-2xl p-6 z-10 flex flex-col justify-between transition-transform duration-200 animate-in fade-in zoom-in-95`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-start justify-between pb-4 border-b border-[#141414]">
                    <div>
                        <h2 id="modal-title" className="text-xl font-serif font-normal text-[#FFFFFF] tracking-tight leading-6 m-0">
                            {title}
                        </h2>
                        {description && (
                            <p className="text-xs text-[#8A8A8A] font-normal leading-relaxed mt-1 m-0">
                                {description}
                            </p>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close dialog"
                        className="text-[#737373] hover:text-[#FFFFFF] hover:bg-[#141414] p-1.5 rounded transition-colors bg-transparent border-none cursor-pointer"
                    >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {children && <div className="py-4 text-xs text-[#A0A0A0] leading-relaxed">{children}</div>}

                {(confirmAction || cancelAction) && (
                    <div className="flex items-center justify-end space-x-3 pt-4 border-t border-[#141414] mt-2">
                        {cancelAction && (
                            <button
                                type="button"
                                disabled={cancelAction.isDisabled || cancelAction.isLoading}
                                onClick={cancelAction.onClick}
                                className="px-4 py-2 text-xs font-medium text-[#A0A0A0] hover:text-[#FFFFFF] bg-[#050505] hover:bg-[#141414] border border-[#1F1F1F] hover:border-[#383838] rounded-md transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                                {cancelAction.label}
                            </button>
                        )}

                        {confirmAction && (
                            <button
                                type="button"
                                disabled={confirmAction.isDisabled || confirmAction.isLoading}
                                onClick={confirmAction.onClick}
                                className={`px-4 py-2 text-xs font-semibold rounded transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center space-x-2 ${
                                    isDestructive
                                        ? 'bg-[#EF4444] hover:bg-[#DC2626] text-[#FFFFFF] border border-[#EF4444]'
                                        : 'bg-[#FFFFFF] hover:bg-[#EAEAEA] text-[#000000] border border-[#FFFFFF]'
                                }`}
                            >
                                {confirmAction.isLoading && (
                                    <svg className="animate-spin -ml-1 mr-2 h-3.5 w-3.5 text-current" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                )}
                                <span>{confirmAction.label}</span>
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
