export interface ServerCustomDomain {
    id: number;
    server_id: number;
    allocation_id: number;
    domain: string;
    protocol: 'http' | 'game_srv' | 'tcp_stream';
    target_type: 'web' | 'game';
    ssl_enabled: boolean;
    ssl_status: 'none' | 'pending' | 'active' | 'failed';
    ssl_cert_path?: string | null;
    ssl_key_path?: string | null;
    nginx_status: 'pending' | 'configured' | 'error' | 'disabled';
    nginx_config_path?: string | null;
    dns_status: 'pending' | 'verified' | 'failed';
    dns_last_checked_at?: string | null;
    notes?: string | null;
    allocation?: {
        id: number;
        ip: string;
        ip_alias?: string | null;
        port: number;
        notes?: string | null;
    };
    created_at: string;
    updated_at: string;
}

export interface DnsDiagnostics {
    domain: string;
    verified: boolean;
    status: string;
    resolved_ips: string[];
    expected_node_fqdn: string;
    expected_node_ip: string;
    cname_target?: string | null;
    srv_records: Array<{
        target?: string;
        port?: number;
        priority?: number;
        weight?: number;
    }>;
    expected_srv_format: string;
    checked_at: string;
}