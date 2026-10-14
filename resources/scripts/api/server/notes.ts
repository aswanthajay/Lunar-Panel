import http from '@/api/http';

export interface ServerNotesAuthor {
    id: number;
    username: string;
    name: string;
}

export interface ServerNotesResponse {
    notes: string;
    updated_at: string | null;
    updated_by: ServerNotesAuthor | null;
    can_edit: boolean;
    is_admin: boolean;
    admin_notes?: string;
    admin_updated_at?: string | null;
    admin_updated_by?: ServerNotesAuthor | null;
}

export const getServerNotes = async (uuid: string): Promise<ServerNotesResponse> => {
    const { data } = await http.get(`/api/client/servers/${uuid}/notes`);
    return data;
};

export const saveServerNotes = async (
    uuid: string,
    notes: string
): Promise<{
    success: boolean;
    message: string;
    notes: string;
    updated_at: string;
    updated_by: ServerNotesAuthor;
}> => {
    const { data } = await http.post(`/api/client/servers/${uuid}/notes`, { notes });
    return data;
};

export const saveAdminScratchpad = async (
    uuid: string,
    adminNotes: string
): Promise<{
    success: boolean;
    message: string;
    admin_notes: string;
    admin_updated_at: string;
    admin_updated_by: ServerNotesAuthor;
}> => {
    const { data } = await http.post(`/api/client/servers/${uuid}/notes/admin`, {
        admin_notes: adminNotes,
    });
    return data;
};
