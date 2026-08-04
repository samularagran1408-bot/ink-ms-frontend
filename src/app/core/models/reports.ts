export interface DashboardResponse {
  metrics: {
    total_users?: number;
    active_users?: number;
    active_events?: number;
    total_sports?: number;
    [key: string]: number | undefined;
  };
  eventCounts: Record<string, number>;
  weeklyTrend: Record<string, number>;
}

export interface DashboardFilters {
  startDate?: string;
  endDate?: string;
  module?: string;
}

export interface AuditLogExportItem {
  id?: string;
  adminEmail?: string;
  action?: string;
  targetEmail?: string;
  targetUserId?: string;
  details?: string;
  ipAddress?: string;
  createdAt?: string;
}

export interface AuditExportRequest {
  logs: AuditLogExportItem[];
}
