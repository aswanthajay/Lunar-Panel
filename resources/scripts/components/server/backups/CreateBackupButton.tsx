import React, { useEffect, useState } from 'react';
import Modal, { RequiredModalProps } from '@/components/elements/Modal';
import { Field as FormikField, Form, Formik, FormikHelpers, useFormikContext } from 'formik';
import { boolean, object, string } from 'yup';
import Field from '@/components/elements/Field';
import FormikFieldWrapper from '@/components/elements/FormikFieldWrapper';
import useFlash from '@/plugins/useFlash';
import createServerBackup from '@/api/server/backups/createServerBackup';
import FlashMessageRender from '@/components/FlashMessageRender';
import Button from '@/components/elements/Button';
import tw from 'twin.macro';
import { Textarea } from '@/components/elements/Input';
import getServerBackups from '@/api/swr/getServerBackups';
import { ServerContext } from '@/state/server';
import FormikSwitch from '@/components/elements/FormikSwitch';
import Can from '@/components/elements/Can';

interface Values {
    name: string;
    ignored: string;
    isLocked: boolean;
}

interface Props {
    className?: string;
    buttonText?: string;
}

const ModalContent = ({ ...props }: RequiredModalProps) => {
    const { isSubmitting } = useFormikContext<Values>();

    return (
        <Modal {...props} showSpinnerOverlay={isSubmitting}>
            <Form className="m-0">
                <FlashMessageRender byKey={'backups:create'} className="mb-4" />

                <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-lg bg-[#0F0F0F] border border-[#1F1F1F] flex items-center justify-center text-neutral-300 shrink-0">
                        <svg className="w-5 h-5 text-neutral-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                    </div>
                    <div>
                        <h2 className="font-sans font-semibold text-lg text-white m-0 tracking-tight" style={{ WebkitFontSmoothing: 'antialiased' }}>
                            Create Server Snapshot
                        </h2>
                        <p className="text-xs text-neutral-400 mt-0.5">
                            Generate a point-in-time compressed archive of your server directory and data.
                        </p>
                    </div>
                </div>

                <div className="space-y-4">
                    <Field
                        name={'name'}
                        label={'Backup Name (Optional)'}
                        placeholder={'e.g. Pre-Update Snapshot'}
                        description={'A descriptive name for easy identification. Leave blank for auto-timestamped naming.'}
                    />

                    <div>
                        <FormikFieldWrapper
                            name={'ignored'}
                            label={'Ignored Files & Directories'}
                            description={'Specify files or directories to exclude (one per line or comma-separated). Leave empty to use root .pteroignore.'}
                        >
                            <FormikField
                                as={Textarea}
                                name={'ignored'}
                                rows={4}
                                placeholder={'cache/*\n*.log\ntmp/'}
                                className="font-mono text-xs"
                            />
                        </FormikFieldWrapper>
                    </div>

                    <Can action={'backup.delete'}>
                        <div className="bg-[#0A0A0A] border border-[#1F1F1F] hover:border-[#2E2E2E] transition-colors p-3.5 rounded-lg">
                            <FormikSwitch
                                name={'isLocked'}
                                label={'Lock Backup Protection'}
                                description={'Protects this snapshot from being deleted or pruned by automated retention policies.'}
                            />
                        </div>
                    </Can>
                </div>

                <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-[#1F1F1F]">
                    <button
                        type="button"
                        onClick={() => props.onDismissed()}
                        disabled={isSubmitting}
                        className="px-3.5 py-2 rounded-lg text-xs font-medium text-neutral-400 hover:text-white bg-[#0A0A0A] hover:bg-[#141414] border border-[#1F1F1F] transition-colors cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="px-4 py-2 rounded-lg bg-[#FFFFFF] hover:bg-[#EAEAEA] text-[#0A0A0A] text-xs font-semibold transition-all inline-flex items-center gap-2 cursor-pointer border border-[#E5E5E5] shadow-sm active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? (
                            <>
                                <svg className="w-3.5 h-3.5 animate-spin text-[#0A0A0A]" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                </svg>
                                <span>Generating...</span>
                            </>
                        ) : (
                            <>
                                <svg className="w-3.5 h-3.5 text-[#0A0A0A]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                                </svg>
                                <span>Start Backup</span>
                            </>
                        )}
                    </button>
                </div>
            </Form>
        </Modal>
    );
};

export default ({ className, buttonText }: Props) => {
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const { clearFlashes, clearAndAddHttpError } = useFlash();
    const [visible, setVisible] = useState(false);
    const { mutate } = getServerBackups();

    useEffect(() => {
        clearFlashes('backups:create');
    }, [visible]);

    const submit = (values: Values, { setSubmitting }: FormikHelpers<Values>) => {
        clearFlashes('backups:create');
        createServerBackup(uuid, values)
            .then((backup) => {
                mutate(
                    (data) => ({ ...data, items: data.items.concat(backup), backupCount: data.backupCount + 1 }),
                    false
                );
                setVisible(false);
            })
            .catch((error) => {
                clearAndAddHttpError({ key: 'backups:create', error });
                setSubmitting(false);
            });
    };

    return (
        <>
            {visible && (
                <Formik
                    onSubmit={submit}
                    initialValues={{ name: '', ignored: '', isLocked: false }}
                    validationSchema={object().shape({
                        name: string().max(191),
                        ignored: string(),
                        isLocked: boolean(),
                    })}
                >
                    <ModalContent appear visible={visible} onDismissed={() => setVisible(false)} />
                </Formik>
            )}
            <button
                type="button"
                onClick={() => setVisible(true)}
                className={`px-3.5 py-1.5 rounded-lg bg-[#FFFFFF] hover:bg-[#EAEAEA] text-[#0A0A0A] text-xs font-semibold transition-all inline-flex items-center justify-center gap-1.5 cursor-pointer border border-[#E5E5E5] shadow-sm active:scale-[0.98] select-none ${className || ''}`}
                style={{ WebkitFontSmoothing: 'antialiased' }}
            >
                <svg className="w-3.5 h-3.5 text-[#0A0A0A]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                <span>{buttonText || 'Create Backup'}</span>
            </button>
        </>
    );
};
