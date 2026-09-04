import http from '@/api/http';

export interface TicketMessage {
    id: number;
    ticket_id: number;
    user_id: number | null;
    is_staff: boolean;
    message: string;
    attachment_path?: string | null;
    attachment_name?: string | null;
    attachment_type?: 'image' | 'text' | 'file' | null;
    attachment_size?: number | null;
    created_at: string;
    updated_at: string;
    user?: {
        id: number;
        username: string;
        email: string;
    };
}

export interface Ticket {
    id: number;
    ticket_id: string;
    user_id: number;
    server_id: number | null;
    title: string;
    department: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    status: 'open' | 'in_progress' | 'answered' | 'closed';
    created_at: string;
    updated_at: string;
    user?: {
        id: number;
        username: string;
        email: string;
    };
    server?: {
        id: number;
        name: string;
        uuid: string;
        uuidShort?: string;
    };
    messages?: TicketMessage[];
}

export interface CreateTicketPayload {
    title: string;
    department: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    server_id?: number | null;
    attachment?: File | null;
}

export interface TicketFilters {
    status?: string;
    department?: string;
    priority?: string;
    search?: string;
    admin?: boolean;
}

export const getTickets = async (filters?: TicketFilters): Promise<Ticket[]> => {
    const params: Record<string, string> = {};
    if (filters?.status && filters.status !== 'all') params.status = filters.status;
    if (filters?.department && filters.department !== 'all') params.department = filters.department;
    if (filters?.priority && filters.priority !== 'all') params.priority = filters.priority;
    if (filters?.search) params.search = filters.search;
    if (filters?.admin) params.admin = 'true';

    const { data } = await http.get('/api/client/tickets', { params });
    return data.data;
};

export const getTicket = async (id: number): Promise<Ticket> => {
    const { data } = await http.get(`/api/client/tickets/${id}`);
    return data.data;
};

export const createTicket = async (payload: CreateTicketPayload): Promise<Ticket> => {
    if (payload.attachment) {
        const formData = new FormData();
        formData.append('title', payload.title);
        formData.append('department', payload.department);
        formData.append('priority', payload.priority);
        formData.append('message', payload.message);
        if (payload.server_id) formData.append('server_id', String(payload.server_id));
        formData.append('attachment', payload.attachment);

        const { data } = await http.post('/api/client/tickets', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return data.data;
    }

    const { data } = await http.post('/api/client/tickets', payload);
    return data.data;
};

export const replyTicket = async (
    id: number,
    message: string,
    isStaff = false,
    attachment?: File | null
): Promise<{ message: TicketMessage; ticket: Ticket }> => {
    if (attachment) {
        const formData = new FormData();
        formData.append('message', message);
        if (isStaff) formData.append('is_staff', '1');
        formData.append('attachment', attachment);

        const { data } = await http.post(`/api/client/tickets/${id}/messages`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return { message: data.data, ticket: data.ticket };
    }

    const { data } = await http.post(`/api/client/tickets/${id}/messages`, { message, is_staff: isStaff });
    return { message: data.data, ticket: data.ticket };
};

export const updateTicketStatus = async (id: number, status?: string, priority?: string): Promise<Ticket> => {
    const { data } = await http.patch(`/api/client/tickets/${id}`, { status, priority });
    return data.data;
};

export const deleteTicket = async (id: number): Promise<void> => {
    await http.delete(`/api/client/tickets/${id}`);
};
