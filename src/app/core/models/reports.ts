import { AdminAuditLog, RoleInfo, UserProfile } from './user-profile';
import { AttendanceReport, Disability, EventItem, Registration, Routine, RoutineRegistration, Sport, SportDisability } from './sports';

export interface DashboardResponse {
  metrics: {
    total_users?: number;
    active_users?: number;
    active_events?: number;
    total_sports?: number;
    total_disabilities?: number;
    [key: string]: number | undefined;
  };
  eventCounts: Record<string, number>;
  weeklyTrend: Record<string, number>;
  recentUsers?: UserProfile[];
  recentEvents?: EventItem[];
}

export interface PanelDashboardResponse {
  metrics?: Record<string, number>;
  events?: EventItem[];
  registrations?: Registration[];
  routines?: Routine[];
  routineRegistrations?: RoutineRegistration[];
  sports?: Sport[];
  disabilities?: Disability[];
  associations?: SportDisability[];
  waitlists?: Record<string, Registration[]>;
  athleteSummaries?: Array<{
    event: EventItem;
    waitlist?: Registration[];
    attendanceReport?: AttendanceReport;
  }>;
  users?: UserProfile[];
  roles?: RoleInfo[];
  auditLogs?: AdminAuditLog[];
  quizPrep?: Record<string, unknown>;
  eventCounts?: Record<string, number>;
  weeklyTrend?: Record<string, number>;
  athleteCount?: number;
  attendanceRatePercent?: number | null;
  attendanceSampledEvents?: number;
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
