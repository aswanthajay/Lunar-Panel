import http from '@/api/http';

export interface SftpTransferRecord {
    id: number;
    serverId: number;
    userId: number;
    direction: 'import' | 'export';
    status: 'pending' | 'connecting' | 'transferring' | 'extracting' | 'completed' | 'failed' | 'cancelled';
    host: string;
    port: number;
    username: string;
    remotePath: string;
    wipeExisting: boolean;
    totalFiles: number;
    transferredFiles: number;
    totalBytes: number;
    transferredBytes: number;
    currentFile: string | null;
    log: string | null;
    errorMessage: string | null;
    startedAt: string | null;
    completedAt: string | null;
    createdAt: string;
    updatedAt: string;
}

export interface TestConnectionPayload {
    host: string;
    port: number;
    username: string;
    password: string;
    remote_path?: string;
}

export interface TestConnectionResponse {
    success: boolean;
    message: string;
    file_count?: number;
    preview?: Array<{
        name: string;
        type: 'file' | 'dir';
        size: number;
        size_formatted: string;
        mtime: string | null;
    }>;
}

export interface StartTransferPayload {
    direction: 'import' | 'export';
    host: string;
    port: number;
    username: string;
    password: string;
    remote_path?: string;
    wipe_existing?: boolean;
}

export interface GetTransfersResponse {
    active: SftpTransferRecord | null;
    history: SftpTransferRecord[];
}

export const rawDataToTransfer = (data: any): SftpTransferRecord => ({
    id: data.id,
    serverId: data.server_id ?? data.serverId,
    userId: data.user_id ?? data.userId,
    direction: data.direction,
    status: data.status,
    host: data.host,
    port: data.port,
    username: data.username,
    remotePath: data.remote_path ?? data.remotePath ?? '/',
    wipeExisting: Boolean(data.wipe_existing ?? data.wipeExisting),
    totalFiles: data.total_files ?? data.totalFiles ?? 0,
    transferredFiles: data.transferred_files ?? data.transferredFiles ?? 0,
    totalBytes: data.total_bytes ?? data.totalBytes ?? 0,
    transferredBytes: data.transferred_bytes ?? data.transferredBytes ?? 0,
    currentFile: data.current_file ?? data.currentFile ?? null,
    log: data.log ?? null,
    errorMessage: data.error_message ?? data.errorMessage ?? null,
    startedAt: data.started_at ?? data.startedAt ?? null,
    completedAt: data.completed_at ?? data.completedAt ?? null,
    createdAt: data.created_at ?? data.createdAt,
    updatedAt: data.updated_at ?? data.updatedAt,
});

export const getSftpTransfers = async (serverUuid: string): Promise<GetTransfersResponse> => {
    const { data } = await http.get(`/api/client/servers/${serverUuid}/sftp-transfer`);
    return {
        active: data.active ? rawDataToTransfer(data.active) : null,
        history: (data.history || []).map(rawDataToTransfer),
    };
};

export const testSftpConnection = async (
    serverUuid: string,
    payload: TestConnectionPayload
): Promise<TestConnectionResponse> => {
    const { data } = await http.post(`/api/client/servers/${serverUuid}/sftp-transfer/test`, payload);
    return data;
};

export const startSftpTransfer = async (
    serverUuid: string,
    payload: StartTransferPayload
): Promise<SftpTransferRecord> => {
    const { data } = await http.post(`/api/client/servers/${serverUuid}/sftp-transfer/start`, payload);
    return rawDataToTransfer(data.transfer);
};

export const getSftpTransferStatus = async (
    serverUuid: string,
    transferId: number
): Promise<SftpTransferRecord> => {
    const { data } = await http.get(`/api/client/servers/${serverUuid}/sftp-transfer/${transferId}/status`);
    return rawDataToTransfer(data.transfer);
};

export const cancelSftpTransfer = async (
    serverUuid: string,
    transferId: number
): Promise<SftpTransferRecord> => {
    const { data } = await http.post(`/api/client/servers/${serverUuid}/sftp-transfer/${transferId}/cancel`);
    return rawDataToTransfer(data.transfer);
};

export const deleteSftpTransfer = async (
    serverUuid: string,
    transferId: number
): Promise<void> => {
    await http.delete(`/api/client/servers/${serverUuid}/sftp-transfer/${transferId}`);
};
