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
  serviceId: string;
  branchId: string;
  channel?: 'KIOSK' | 'WEB' | 'MOBILE';
}

export type Branch = {
  id: string;
  name: string;
};

export type Service = {
  id: string;
  branchId: string;
  name: string;
  counterLabel: string | null;
  isActive: boolean;
};

export interface Ticket {
  id: string;
  ticketNo: string;
  customerName: string | null;
  phone: string;
  status: 'WAITING' | 'SERVING' | 'COMPLETED' | 'CANCELLED';
  serviceType: string;
  serviceId: string | null;
  branchId: string;
  createdAt: string;
  calledAt: string | null;
  completedAt: string | null;
  branch: {
    id: string;
    name: string;
  };
  service?: {
    id: string;
    name: string;
    counterLabel: string | null;
    branchId: string;
    isActive: boolean;
  } | null;
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
  serviceId?: string | null;
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

export type QueueVolumeRow = {
  bucket: string;
  branchId: string;
  branchName: string;
  serviceId: string | null;
  serviceName: string | null;
  channel: 'KIOSK' | 'WEB' | 'MOBILE';
  count: number;
};

export type QuantilesRow = {
  groupType: 'branch' | 'service' | 'staff';
  groupId: string;
  groupLabel: string;
  samples: number;
  meanMinutes: number;
  medianMinutes: number;
  p90Minutes: number;
};

export type SlaRow = {
  bucket: string;
  branchId: string;
  branchName: string;
  serviceId: string | null;
  serviceName: string | null;
  served: number;
  withinSla: number;
  thresholdMinutes: number;
  slaPercent: number;
};

export type ThroughputRow = {
  bucket: string;
  branchId: string;
  branchName: string;
  serviceId: string | null;
  serviceName: string | null;
  completed: number;
  activeStaff: number;
  completedPerActiveStaff: number;
};

export type StaffPerformanceRow = {
  staffId: string;
  staffEmail: string;
  ticketsCalled: number;
  ticketsCompleted: number;
  meanHandleMinutes: number;
  medianHandleMinutes: number;
  p90HandleMinutes: number;
  meanIdleMinutes: number;
  medianIdleMinutes: number;
};

export type AnalyticsSummary = {
  range: { start: string; end: string };
  params: { volumeGranularity: 'hour' | 'day' | 'week'; slaThresholdMinutes: number };
  queueVolume: QueueVolumeRow[];
  averageWaitTime: QuantilesRow[];
  serviceDuration: Array<Omit<QuantilesRow, 'groupType'> & { groupType: 'service' | 'staff' }>;
  slaCompliance: SlaRow[];
  abandonment: {
    totalCreated: number;
    cancelled: number;
    noShow: number;
    cancelledRate: number;
    noShowRate: number;
    p50TimeToAbandonMinutes: number;
    p90TimeToAbandonMinutes: number;
  };
  throughput: ThroughputRow[];
  staffPerformance: { giniWorkload: number; staffRows: StaffPerformanceRow[] };
};

export const queueApi = {
  joinQueue: async (data: JoinQueueDto): Promise<JoinQueueResponse> => {
    const response = await api.post<JoinQueueResponse>('/queue/join', data);
    return response.data;
  },

  getActiveQueue: async (branchId: string, serviceId?: string | null): Promise<Ticket[]> => {
    const response = await api.get<Ticket[]>('/queue/active', {
      params: { branchId, serviceId: serviceId ?? undefined },
    });
    return response.data;
  },

  getCurrentServing: async (branchId: string, serviceId?: string | null): Promise<Ticket | null> => {
    const response = await api.get<Ticket | null>('/queue/current-serving', {
      params: { branchId, serviceId: serviceId ?? undefined },
    });
    return response.data;
  },

  callNext: async (branchId: string, serviceId?: string | null): Promise<Ticket> => {
    // IMPORTANT: don't send `null` as JSON body; Nest/Express JSON parser rejects primitives.
    const response = await api.patch<Ticket>('/queue/call-next', {}, {
      params: { branchId, serviceId: serviceId ?? undefined },
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

export const branchesApi = {
  list: async (): Promise<Branch[]> => {
    const response = await api.get<Branch[]>('/branches');
    return response.data;
  },
};

export const servicesApi = {
  listForBranch: async (branchId: string, activeOnly = true): Promise<Service[]> => {
    const response = await api.get<Service[]>(`/branches/${branchId}/services`, {
      params: { activeOnly },
    });
    return response.data;
  },
};

export const adminBranchesApi = {
  list: async (): Promise<Branch[]> => {
    const response = await api.get<Branch[]>('/admin/branches');
    return response.data;
  },
  create: async (name: string): Promise<Branch> => {
    const response = await api.post<Branch>('/admin/branches', { name });
    return response.data;
  },
  update: async (branchId: string, data: { name?: string }): Promise<Branch> => {
    const response = await api.patch<Branch>(`/admin/branches/${branchId}`, data);
    return response.data;
  },
  remove: async (branchId: string): Promise<Branch> => {
    const response = await api.delete<Branch>(`/admin/branches/${branchId}`);
    return response.data;
  },
};

export const adminServicesApi = {
  create: async (
    branchId: string,
    data: { name: string; counterLabel?: string; isActive?: boolean },
  ): Promise<Service> => {
    const response = await api.post<Service>(`/admin/branches/${branchId}/services`, data);
    return response.data;
  },
  update: async (
    branchId: string,
    serviceId: string,
    data: { name?: string; counterLabel?: string; isActive?: boolean },
  ): Promise<Service> => {
    const response = await api.patch<Service>(
      `/admin/branches/${branchId}/services/${serviceId}`,
      data,
    );
    return response.data;
  },
  remove: async (branchId: string, serviceId: string): Promise<Service> => {
    const response = await api.delete<Service>(`/admin/branches/${branchId}/services/${serviceId}`);
    return response.data;
  },
};

export type Staff = {
  id: string;
  email: string;
  role: 'STAFF' | 'ADMIN';
  branchId: string;
  serviceId: string | null;
  createdAt: string;
  updatedAt: string;
  branch?: Branch;
  service?: Service | null;
};

export const adminStaffApi = {
  list: async (): Promise<Staff[]> => {
    const response = await api.get<Staff[]>('/admin/staff');
    return response.data;
  },
  create: async (data: {
    email: string;
    password: string;
    role?: 'STAFF' | 'ADMIN';
    branchId: string;
    serviceId?: string | null;
  }): Promise<Staff> => {
    const response = await api.post<Staff>('/admin/staff', data);
    return response.data;
  },
  update: async (
    staffId: string,
    data: {
      email?: string;
      password?: string;
      role?: 'STAFF' | 'ADMIN';
      branchId?: string;
      serviceId?: string | null;
    },
  ): Promise<Staff> => {
    const response = await api.patch<Staff>(`/admin/staff/${staffId}`, data);
    return response.data;
  },
  remove: async (staffId: string): Promise<{ id: string; email: string }> => {
    const response = await api.delete<{ id: string; email: string }>(`/admin/staff/${staffId}`);
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

  getSummary: async (params: {
    branchId?: string;
    start?: string;
    end?: string;
    volumeGranularity?: 'hour' | 'day' | 'week';
    slaThresholdMinutes?: number;
  }): Promise<AnalyticsSummary> => {
    const response = await api.get<AnalyticsSummary>('/analytics/summary', { params });
    return response.data;
  },

  exportReportCsv: async (params: {
    report:
      | 'queue-volume'
      | 'wait-times'
      | 'service-durations'
      | 'sla'
      | 'abandonment'
      | 'throughput'
      | 'staff-performance';
    branchId?: string;
    start?: string;
    end?: string;
    volumeGranularity?: 'hour' | 'day' | 'week';
    slaThresholdMinutes?: number;
  }): Promise<Blob> => {
    const response = await api.get('/analytics/export', {
      params,
      responseType: 'blob',
      headers: { Accept: 'text/csv' },
    });
    return response.data as Blob;
  },
};

export default api;

