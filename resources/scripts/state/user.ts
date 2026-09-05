import { Action, action, Thunk, thunk } from 'easy-peasy';
import updateAccountEmail from '@/api/account/updateAccountEmail';
import updateAccountProfile, { UpdateProfilePayload } from '@/api/account/updateAccountProfile';

export interface UserData {
    uuid: string;
    username: string;
    email: string;
    nameFirst?: string;
    nameLast?: string;
    language: string;
    rootAdmin: boolean;
    useTotp: boolean;
    createdAt: Date;
    updatedAt: Date;
}

export interface UserStore {
    data?: UserData;
    setUserData: Action<UserStore, UserData>;
    updateUserData: Action<UserStore, Partial<UserData>>;
    updateUserEmail: Thunk<UserStore, { email: string; password: string }, any, UserStore, Promise<void>>;
    updateUserProfile: Thunk<UserStore, UpdateProfilePayload, any, UserStore, Promise<void>>;
}

const user: UserStore = {
    data: undefined,
    setUserData: action((state, payload) => {
        state.data = payload;
    }),

    updateUserData: action((state, payload) => {
        // @ts-expect-error limitation of Typescript, can't do much about that currently unfortunately.
        state.data = { ...state.data, ...payload };
    }),

    updateUserEmail: thunk(async (actions, payload) => {
        await updateAccountEmail(payload.email, payload.password);

        actions.updateUserData({ email: payload.email });
    }),

    updateUserProfile: thunk(async (actions, payload) => {
        await updateAccountProfile(payload);

        actions.updateUserData({
            username: payload.username,
            nameFirst: payload.name_first,
            nameLast: payload.name_last,
        });
    }),
};

export default user;
