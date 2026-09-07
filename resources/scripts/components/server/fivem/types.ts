export interface PlayerGeo {
    country?: string;
    country_code?: string;
    city?: string;
    isp?: string;
    is_local?: boolean;
}

export interface FiveMPlayer {
    id: number;
    name: string;
    ping: number | null;
    endpoint?: string | null;
    ip?: string | null;
    port?: number | null;
    geo?: PlayerGeo | null;
    hwids: string[];
    identifiers: {
        steam?: string;
        steam_id64?: string;
        discord?: string;
        license?: string;
        license2?: string;
        fivem?: string;
        xbl?: string;
        live?: string;
        ip?: string;
        [key: string]: string | undefined;
    };
    raw_identifiers: string[];
    play_time?: string | null;
    play_time_minutes?: number | null;
    first_joined?: string | null;
    last_seen?: string | null;
}

export interface ServerData {
    offline: boolean;
    online: number;
    max: number;
    server_name: string;
    project_desc?: string | null;
    gametype?: string;
    mapname?: string;
    cfx_id?: string | null;
    join_url?: string | null;
    players: FiveMPlayer[];
}
