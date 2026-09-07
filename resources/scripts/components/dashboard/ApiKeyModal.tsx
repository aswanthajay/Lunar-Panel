import React, { useContext } from 'react';
import tw from 'twin.macro';
import Button from '@/components/elements/Button';
import asModal from '@/hoc/asModal';
import ModalContext from '@/context/ModalContext';
import CopyOnClick from '@/components/elements/CopyOnClick';

interface Props {
    apiKey: string;
}

const ApiKeyModal = ({ apiKey }: Props) => {
    const { dismiss } = useContext(ModalContext);

    return (
        <>
            <h3 className={'font-serif text-2xl font-normal text-[#FFFFFF] mb-6 tracking-tight'}>Your API Key</h3>
            <p className={'text-sm text-[#A0A0A0] mb-6 font-sans'}>
                The API key you have requested is shown below. Please store this in a safe location, it will not be
                shown again.
            </p>
            <pre className={'text-sm bg-[#050505] border border-[#1F1F1F] rounded-md py-3 px-4 font-mono text-[#D4D4D4]'}>
                <CopyOnClick text={apiKey}>
                    <code className={'font-mono text-[#FFFFFF]'}>{apiKey}</code>
                </CopyOnClick>
            </pre>
            <div css={tw`flex justify-end mt-6`}>
                <Button type={'button'} onClick={() => dismiss()}>
                    Close
                </Button>
            </div>
        </>
    );
};

ApiKeyModal.displayName = 'ApiKeyModal';

export default asModal<Props>({
    closeOnEscape: false,
    closeOnBackground: false,
})(ApiKeyModal);
