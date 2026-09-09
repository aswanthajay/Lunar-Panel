import React, { useContext } from 'react';
import tw from 'twin.macro';
import Button from '@/components/elements/Button';
import asModal from '@/hoc/asModal';
import ModalContext from '@/context/ModalContext';

type Props = {
    title: string;
    buttonText: string;
    onConfirmed: () => void;
    showSpinnerOverlay?: boolean;
};

const ConfirmationModal: React.FC<Props> = ({ title, children, buttonText, onConfirmed }) => {
    const { dismiss } = useContext(ModalContext);

    return (
        <>
            <h2 className={'font-sans text-lg font-semibold text-zinc-100 mb-2 tracking-tight'}>{title}</h2>
            <div className={'text-zinc-400 text-xs leading-relaxed mb-6'}>{children}</div>
            <div css={tw`flex flex-wrap items-center justify-end mt-6 gap-2`}>
                <Button isSecondary onClick={() => dismiss()} css={tw`w-full sm:w-auto`}>
                    Cancel
                </Button>
                <Button color={'red'} css={tw`w-full sm:w-auto`} onClick={() => onConfirmed()}>
                    {buttonText}
                </Button>
            </div>
        </>
    );
};

ConfirmationModal.displayName = 'ConfirmationModal';

export default asModal<Props>((props) => ({
    showSpinnerOverlay: props.showSpinnerOverlay,
}))(ConfirmationModal);
