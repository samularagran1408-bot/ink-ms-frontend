import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../config/api.config';
import {
  AuditExportRequest,
  DashboardFilters,
  DashboardResponse,
  PanelDashboardResponse
} from '../models/reports';

@Injectable({
  providedIn: 'root'
})
export class ReportsService {
  private readonly dashboardUrl = `${API_BASE_URL}/api/dashboard`;

  constructor(private http: HttpClient) {}

  getDashboard(filters?: DashboardFilters): Observable<DashboardResponse> {
    return this.http.get<DashboardResponse>(this.dashboardUrl, {
      params: this.toParams(filters)
    });
  }

  getHomePanel(userId?: string): Observable<PanelDashboardResponse> {
    return this.http.get<PanelDashboardResponse>(`${this.dashboardUrl}/home`, {
      params: userId ? { userId } : undefined
    });
  }

  getTrainerPanel(trainerId?: string): Observable<PanelDashboardResponse> {
    return this.http.get<PanelDashboardResponse>(`${this.dashboardUrl}/trainer`, {
      params: trainerId ? { trainerId } : undefined
    });
  }

  getOrganizerPanel(organizerId?: string): Observable<PanelDashboardResponse> {
    return this.http.get<PanelDashboardResponse>(`${this.dashboardUrl}/organizer`, {
      params: organizerId ? { organizerId } : undefined
    });
  }

  getEventsPanel(userId?: string, mode: 'user' | 'manage' = 'user'): Observable<PanelDashboardResponse> {
    const params: Record<string, string> = { mode };
    if (userId) {
      params['userId'] = userId;
    }
    return this.http.get<PanelDashboardResponse>(`${this.dashboardUrl}/events`, { params });
  }

  getAssociationsPanel(): Observable<PanelDashboardResponse> {
    return this.http.get<PanelDashboardResponse>(`${this.dashboardUrl}/associations`);
  }

  getSessionsPanel(trainerId?: string): Observable<PanelDashboardResponse> {
    return this.http.get<PanelDashboardResponse>(`${this.dashboardUrl}/sessions`, {
      params: trainerId ? { trainerId } : undefined
    });
  }

  getAthletesPanel(organizerId?: string, allEvents = false): Observable<PanelDashboardResponse> {
    const params: Record<string, string> = { allEvents: String(allEvents) };
    if (organizerId) {
      params['organizerId'] = organizerId;
    }
    return this.http.get<PanelDashboardResponse>(`${this.dashboardUrl}/athletes`, { params });
  }

  getSportsPanel(): Observable<PanelDashboardResponse> {
    return this.http.get<PanelDashboardResponse>(`${this.dashboardUrl}/sports`);
  }

  getDisabilitiesPanel(): Observable<PanelDashboardResponse> {
    return this.http.get<PanelDashboardResponse>(`${this.dashboardUrl}/disabilities`);
  }

  getUsersPanel(filter: 'active' | 'all' | 'inactive' = 'active'): Observable<PanelDashboardResponse> {
    return this.http.get<PanelDashboardResponse>(`${this.dashboardUrl}/users`, {
      params: { filter }
    });
  }

  getRolesPanel(): Observable<PanelDashboardResponse> {
    return this.http.get<PanelDashboardResponse>(`${this.dashboardUrl}/roles`);
  }

  getAuditPanel(): Observable<PanelDashboardResponse> {
    return this.http.get<PanelDashboardResponse>(`${this.dashboardUrl}/audit`);
  }

  getQuizPanel(role: 'trainer' | 'organizer', userId?: string): Observable<PanelDashboardResponse> {
    const params: Record<string, string> = { role };
    if (userId) {
      params['userId'] = userId;
    }
    return this.http.get<PanelDashboardResponse>(`${this.dashboardUrl}/quiz`, { params });
  }

  exportDashboardPdf(filters?: DashboardFilters): Observable<Blob> {
    return this.http.get(`${this.dashboardUrl}/export/pdf`, {
      params: this.toParams(filters),
      responseType: 'blob'
    });
  }

  exportAuditPdf(request: AuditExportRequest): Observable<Blob> {
    return this.http.post(`${this.dashboardUrl}/export/audit/pdf`, request, {
      responseType: 'blob'
    });
  }

  exportAnalysisPdf(request: AuditExportRequest, filters?: DashboardFilters): Observable<Blob> {
    return this.http.post(`${this.dashboardUrl}/export/analysis/pdf`, request, {
      params: this.toParams(filters),
      responseType: 'blob'
    });
  }

  downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  private toParams(filters?: DashboardFilters): HttpParams {
    let params = new HttpParams();
    if (!filters) {
      return params;
    }
    if (filters.startDate) {
      params = params.set('startDate', filters.startDate);
    }
    if (filters.endDate) {
      params = params.set('endDate', filters.endDate);
    }
    if (filters.module) {
      params = params.set('module', filters.module);
    }
    return params;
  }
}
