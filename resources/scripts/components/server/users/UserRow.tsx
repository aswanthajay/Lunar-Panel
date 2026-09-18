import React, { useState } from 'react';
import { Subuser } from '@/state/server/subusers';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPencilAlt, faUnlockAlt, faUserLock } from '@fortawesome/free-solid-svg-icons';
import RemoveSubuserButton from '@/components/server/users/RemoveSubuserButton';
import EditSubuserModal from '@/components/server/users/EditSubuserModal';
import Can from '@/components/elements/Can';
import { useStoreState } from 'easy-peasy';
import tw from 'twin.macro';
import GreyRowBox from '@/components/elements/GreyRowBox';
import InitialsAvatar from '@/components/elements/InitialsAvatar';

interface Props {
    subuser: Subuser;
}

export default ({ subuser }: Props) => {
    const uuid = useStoreState((state) => state.user!.data!.uuid);
    const [visible, setVisible] = useState(false);

    return (
        <GreyRowBox css={tw`mb-2`}>
            <EditSubuserModal subuser={subuser} visible={visible} onModalDismissed={() => setVisible(false)} />
            <div className="hidden md:flex shrink-0">
                <InitialsAvatar
                    name={subuser.username || subuser.email}
                    size="md"
                />
            </div>
            <div css={tw`ml-4 flex-1 overflow-hidden`}>
                {subuser.username && subuser.username !== subuser.email ? (
                    <div>
                        <p css={tw`text-sm font-medium text-white truncate`}>{subuser.username}</p>
                        <p css={tw`text-xs text-neutral-400 truncate`}>{subuser.email}</p>
                    </div>
                ) : (
                    <p css={tw`text-sm font-medium text-white truncate`}>{subuser.email}</p>
                )}
            </div>
            <div css={tw`ml-4`}>
                <p css={tw`font-medium text-center`}>
                    &nbsp;
                    <FontAwesomeIcon
                        icon={subuser.twoFactorEnabled ? faUserLock : faUnlockAlt}
                        fixedWidth
                        css={!subuser.twoFactorEnabled ? tw`text-red-400` : undefined}
                    />
                    &nbsp;
                </p>
                <p className={'text-[10px] text-[#6B7280] uppercase tracking-wider hidden md:block'}>2FA Enabled</p>
            </div>
            <div css={tw`ml-4 hidden md:block`}>
                <p css={tw`font-medium text-center`}>
                    {subuser.permissions.filter((permission) => permission !== 'websocket.connect').length}
                </p>
                <p className={'text-[10px] text-[#6B7280] uppercase tracking-wider'}>Permissions</p>
            </div>
            {subuser.uuid !== uuid && (
                <>
                    <Can action={'user.update'}>
                        <button
                            type={'button'}
                            aria-label={'Edit subuser'}
                            className={'block text-sm p-1 md:p-2 text-[#707070] hover:text-[#FFFFFF] transition-colors duration-150 mx-4'}
                            onClick={() => setVisible(true)}
                        >
                            <FontAwesomeIcon icon={faPencilAlt} />
                        </button>
                    </Can>
                    <Can action={'user.delete'}>
                        <RemoveSubuserButton subuser={subuser} />
                    </Can>
                </>
            )}
        </GreyRowBox>
    );
};
