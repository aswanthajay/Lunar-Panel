import InitialsAvatar, { extractInitials } from '@/components/elements/InitialsAvatar';

const Avatar = Object.assign(InitialsAvatar, {
    User: InitialsAvatar,
    Initials: InitialsAvatar,
});

export { InitialsAvatar, extractInitials };
export default Avatar;
