import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../config/api.config';
import {
  AuditExportRequest,
  DashboardFilters,
  DashboardResponse
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
