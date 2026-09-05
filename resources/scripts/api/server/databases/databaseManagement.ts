import http from '@/api/http';

export interface DatabaseImportResponse {
    success: boolean;
    queries_executed: number;
    message: string;
}

export interface PhpMyAdminResponse {
    installed: boolean;
    url?: string;
    message?: string;
}

/**
 * Export a database and trigger a .sql file download in the browser.
 */
export const exportDatabase = async (uuid: string, databaseId: string, databaseName: string): Promise<void> => {
    const response = await http.get(`/api/client/servers/${uuid}/databases/${databaseId}/export`, {
        responseType: 'blob',
    });

    const blob = new Blob([response.data], { type: 'application/sql' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    link.setAttribute('download', `${databaseName}_${dateStr}.sql`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
};

/**
 * Upload and import a .sql or .sql.gz file into the specified database.
 */
export const importDatabase = async (
    uuid: string,
    databaseId: string,
    file: File,
    onUploadProgress?: (progressEvent: any) => void
): Promise<DatabaseImportResponse> => {
    const formData = new FormData();
    formData.append('file', file);

    const { data } = await http.post(`/api/client/servers/${uuid}/databases/${databaseId}/import`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
        onUploadProgress,
    });

    return data;
};

/**
 * Get the one-time single sign-on (SSO) URL for built-in phpMyAdmin.
 */
export const getPhpMyAdminUrl = async (uuid: string, databaseId: string): Promise<PhpMyAdminResponse> => {
    const { data } = await http.get(`/api/client/servers/${uuid}/databases/${databaseId}/pma`);
    return data;
};
