import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface JoinQueueDto {
  customerName: string;
  phone: string;
  serviceType: string;
  branchId: string;
}

export interface Ticket {
  id: string;
  ticketNo: string;
  customerName: string | null;
  phone: string;
  status: 'WAITING' | 'SERVING' | 'COMPLETED' | 'CANCELLED';
  serviceType: string;
  branchId: string;
  createdAt: string;
  calledAt: string | null;
  completedAt: string | null;
  branch: {
    id: string;
    name: string;
  };
}

export interface JoinQueueResponse {
  ticketId: string;
  ticketNo: string;
  position: number;
  estimatedWaitTime: number;
}

export type StaffUser = {
  id: string;
  email: string;
  role: 'STAFF' | 'ADMIN';
  branchId: string;
};

export type DailyAnalyticsStats = {
  date: string; // YYYY-MM-DD
  total: number;
  completed: number;
  cancelled: number;
  waiting: number;
  serving: number;
  averageWaitTime: number; // minutes
  averageServiceTime: number; // minutes
};

export const queueApi = {
  joinQueue: async (data: JoinQueueDto): Promise<JoinQueueResponse> => {
    const response = await api.post<JoinQueueResponse>('/queue/join', data);
    return response.data;
  },

  getActiveQueue: async (branchId: string): Promise<Ticket[]> => {
    const response = await api.get<Ticket[]>('/queue/active', {
      params: { branchId },
    });
    return response.data;
  },

  getCurrentServing: async (branchId: string): Promise<Ticket | null> => {
    const response = await api.get<Ticket | null>('/queue/current-serving', {
      params: { branchId },
    });
    return response.data;
  },

  callNext: async (branchId: string): Promise<Ticket> => {
    // IMPORTANT: don't send `null` as JSON body; Nest/Express JSON parser rejects primitives.
    const response = await api.patch<Ticket>('/queue/call-next', {}, {
      params: { branchId },
    });
    return response.data;
  },

  completeTicket: async (ticketId: string): Promise<Ticket> => {
    const response = await api.patch<Ticket>(`/queue/complete/${ticketId}`);
    return response.data;
  },

  cancelTicket: async (
    ticketId: string,
    reason: 'no-show' | 'cancelled' = 'cancelled',
  ): Promise<Ticket> => {
    // IMPORTANT: don't send `null` as JSON body; Nest/Express JSON parser rejects primitives.
    const response = await api.patch<Ticket>(`/queue/cancel/${ticketId}`, {}, {
      params: { reason },
    });
    return response.data;
  },
};

export const authApi = {
  login: async (email: string, password: string): Promise<{ user: StaffUser }> => {
    const response = await api.post<{ user: StaffUser }>('/auth/login', { email, password });
    return response.data;
  },

  logout: async (): Promise<{ ok: true }> => {
    const response = await api.post<{ ok: true }>('/auth/logout');
    return response.data;
  },

  me: async (): Promise<{ user: StaffUser }> => {
    const response = await api.get<{ user: StaffUser }>('/auth/me');
    return response.data;
  },
};

export const analyticsApi = {
  getDailyStats: async (
    branchId: string,
    date?: string,
  ): Promise<DailyAnalyticsStats> => {
    const response = await api.get<DailyAnalyticsStats>('/analytics/daily', {
      params: { branchId, date },
    });
    return response.data;
  },
};

export default api;

