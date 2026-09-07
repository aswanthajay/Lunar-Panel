export interface AvailableDomain {
    id: number;
    domain: string;
    protocol: 'both' | 'srv_only' | 'a_only';
    egg_ids: number[] | null;
}

export interface SubdomainAllocation {
    id: number;
    ip: string;
    port: number;
    ip_alias: string | null;
}

export interface ServerSubdomain {
    id: number;
    server_id: number;
    subdomain_domain_id: number;
    subdomain: string;
    full_subdomain: string;
    record_type: 'both' | 'srv' | 'a';
    target_ip: string;
    target_port: number;
    cloudflare_dns_id: string | null;
    cloudflare_srv_id: string | null;
    created_at: string;
    domain?: AvailableDomain;
}

export interface SubdomainsData {
    subdomains: ServerSubdomain[];
    available_domains: AvailableDomain[];
    allocations: SubdomainAllocation[];
}

export interface CreateSubdomainPayload {
    subdomain: string;
    subdomain_domain_id: number;
    allocation_id: number;
}
