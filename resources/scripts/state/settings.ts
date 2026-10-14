import { action, Action } from 'easy-peasy';

export interface OAuthProviderSetting {
    id: string;
    name: string;
    icon: string;
    color: string;
    url: string;
}

export interface SiteSettings {
    name: string;
    locale: string;
    recaptcha: {
        enabled: boolean;
        siteKey: string;
    };
    authentik?: {
        enabled: boolean;
        enforced: boolean;
        title: string;
        url: string;
    };
    oauth_providers?: OAuthProviderSetting[];
}

export interface SettingsStore {
    data?: SiteSettings;
    setSettings: Action<SettingsStore, SiteSettings>;
}

const settings: SettingsStore = {
    data: undefined,

    setSettings: action((state, payload) => {
        state.data = payload;
    }),
};

export default settings;
