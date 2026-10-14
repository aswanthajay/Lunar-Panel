import React, { useContext, useEffect, useRef } from 'react';
import { Subuser } from '@/state/server/subusers';
import { Form, Formik } from 'formik';
import { array, object, string } from 'yup';
import Field from '@/components/elements/Field';
import { Actions, useStoreActions, useStoreState } from 'easy-peasy';
import { ApplicationStore } from '@/state';
import createOrUpdateSubuser from '@/api/server/users/createOrUpdateSubuser';
import { ServerContext } from '@/state/server';
import FlashMessageRender from '@/components/FlashMessageRender';
import Can from '@/components/elements/Can';
import { usePermissions } from '@/plugins/usePermissions';
import { useDeepCompareMemo } from '@/plugins/useDeepCompareMemo';
import tw from 'twin.macro';
import Button from '@/components/elements/Button';
import PermissionTitleBox from '@/components/server/users/PermissionTitleBox';
import asModal from '@/hoc/asModal';
import PermissionRow from '@/components/server/users/PermissionRow';
import ModalContext from '@/context/ModalContext';

type Props = {
    subuser?: Subuser;
};

interface Values {
    email: string;
    permissions: string[];
}

const EditSubuserModal = ({ subuser }: Props) => {
    const ref = useRef<HTMLHeadingElement>(null);
    const uuid = ServerContext.useStoreState((state) => state.server.data!.uuid);
    const appendSubuser = ServerContext.useStoreActions((actions) => actions.subusers.appendSubuser);
    const { clearFlashes, clearAndAddHttpError } = useStoreActions(
        (actions: Actions<ApplicationStore>) => actions.flashes
    );
    const { dismiss, setPropOverrides } = useContext(ModalContext);

    const isRootAdmin = useStoreState((state) => state.user.data!.rootAdmin);
    const permissions = useStoreState((state) => state.permissions.data);
    // The currently logged in user's permissions. We're going to filter out any permissions
    // that they should not need.
    const loggedInPermissions = ServerContext.useStoreState((state) => state.server.permissions);
    const [canEditUser] = usePermissions(subuser ? ['user.update'] : ['user.create']);

    // The permissions that can be modified by this user.
    const editablePermissions = useDeepCompareMemo(() => {
        const cleaned = Object.keys(permissions).map((key) =>
            Object.keys(permissions[key].keys).map((pkey) => `${key}.${pkey}`)
        );

        const list: string[] = ([] as string[]).concat.apply([], Object.values(cleaned));

        if (isRootAdmin || (loggedInPermissions.length === 1 && loggedInPermissions[0] === '*')) {
            return list;
        }

        return list.filter((key) => loggedInPermissions.indexOf(key) >= 0);
    }, [isRootAdmin, permissions, loggedInPermissions]);

    const submit = (values: Values) => {
        setPropOverrides({ showSpinnerOverlay: true });
        clearFlashes('user:edit');

        createOrUpdateSubuser(uuid, values, subuser)
            .then((subuser) => {
                appendSubuser(subuser);
                dismiss();
            })
            .catch((error) => {
                console.error(error);
                setPropOverrides(null);
                clearAndAddHttpError({ key: 'user:edit', error });

                if (ref.current) {
                    ref.current.scrollIntoView();
                }
            });
    };

    useEffect(
        () => () => {
            clearFlashes('user:edit');
        },
        []
    );

    return (
        <Formik
            onSubmit={submit}
            initialValues={
                {
                    email: subuser?.email || '',
                    permissions: subuser?.permissions || [],
                } as Values
            }
            validationSchema={object().shape({
                email: string()
                    .max(191, 'Email addresses must not exceed 191 characters.')
                    .email('A valid email address must be provided.')
                    .required('A valid email address must be provided.'),
                permissions: array().of(string()),
            })}
        >
            <Form>
                {/* Modal Header */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6 pr-12 border-b border-[#141414] pb-5">
                    <div>
                        <h2 className="font-serif text-2xl font-normal text-[#FFFFFF] tracking-tight m-0" ref={ref}>
                            {subuser
                                ? `${canEditUser ? 'Modify' : 'View'} permissions for ${subuser.email}`
                                : 'Create new subuser'}
                        </h2>
                        <p className="text-xs text-[#737373] font-sans mt-1.5 m-0 leading-relaxed">
                            Configure granular access control and operational capabilities for this server.
                        </p>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                        <button
                            type="submit"
                            className="px-4 py-2 rounded-md text-xs font-semibold bg-[#FFFFFF] text-[#000000] hover:bg-[#E5E5E5] transition-colors cursor-pointer border-none shadow-sm"
                        >
                            {subuser ? 'Save Changes' : 'Invite User'}
                        </button>
                    </div>
                </div>

                <FlashMessageRender byKey={'user:edit'} css={tw`mb-4`} />

                {!isRootAdmin && loggedInPermissions[0] !== '*' && (
                    <div className="mb-6 p-4 rounded-lg bg-[#050505] border-l-2 border-[#10B981] border border-[#1F1F1F]">
                        <p className="text-xs text-[#A0A0A0] font-sans m-0">
                            Only permissions which your account is currently assigned may be selected when creating or
                            modifying other users.
                        </p>
                    </div>
                )}

                {!subuser && (
                    <div className="bg-[#000000] border border-[#1F1F1F] rounded-xl p-5 mb-6 shadow-sm">
                        <Field
                            name={'email'}
                            label={'User Email'}
                            placeholder="collaborator@example.com"
                            description={
                                'Enter the email address of the user you wish to invite as a subuser for this server.'
                            }
                        />
                    </div>
                )}

                <div className="space-y-4 my-6">
                    {Object.keys(permissions)
                        .filter((key) => key !== 'websocket')
                        .map((key) => (
                            <PermissionTitleBox
                                key={`permission_${key}`}
                                title={key}
                                isEditable={canEditUser}
                                permissions={Object.keys(permissions[key].keys).map((pkey) => `${key}.${pkey}`)}
                            >
                                <p className="text-xs font-sans text-[#737373] mb-4 m-0 leading-relaxed">
                                    {permissions[key].description}
                                </p>
                                <div className="space-y-2">
                                    {Object.keys(permissions[key].keys).map((pkey) => (
                                        <PermissionRow
                                            key={`permission_${key}.${pkey}`}
                                            permission={`${key}.${pkey}`}
                                            disabled={!canEditUser || editablePermissions.indexOf(`${key}.${pkey}`) < 0}
                                        />
                                    ))}
                                </div>
                            </PermissionTitleBox>
                        ))}
                </div>

                <Can action={subuser ? 'user.update' : 'user.create'}>
                    <div className="pt-6 border-t border-[#141414] flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={dismiss}
                            className="px-4 py-2 rounded-md text-xs font-sans font-medium bg-[#0A0A0A] hover:bg-[#141414] text-[#A0A0A0] hover:text-[#FFFFFF] border border-[#1F1F1F] hover:border-[#383838] transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-5 py-2 rounded-md text-xs font-sans font-semibold bg-[#FFFFFF] text-[#000000] hover:bg-[#E5E5E5] transition-colors cursor-pointer border-none shadow-sm"
                        >
                            {subuser ? 'Save Changes' : 'Invite User'}
                        </button>
                    </div>
                </Can>
            </Form>
        </Formik>
    );
};

export default asModal<Props>({
    top: false,
})(EditSubuserModal);
