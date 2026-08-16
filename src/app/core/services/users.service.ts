import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

import { API_BASE_URL } from '../config/api.config';
import {
  AdminAuditLog,
  AssignRoleRequest,
  BlockUserRequest,
  RoleInfo,
  UpdateProfileRequest,
  UserProfile
} from '../models/user-profile';

@Injectable({
  providedIn: 'root'
})
export class UsersService {
  private readonly baseUrl = `${API_BASE_URL}/api/users`;
  private readonly adminUrl = `${API_BASE_URL}/api/admin/users`;

  constructor(private http: HttpClient) {}

  getProfile(): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${this.baseUrl}/perfil`);
  }

  updateProfile(payload: UpdateProfileRequest): Observable<UserProfile> {
    return this.http.put<UserProfile>(`${this.baseUrl}/perfil`, payload);
  }

  createProfile(payload: UpdateProfileRequest): Observable<UserProfile> {
    return this.http.post<UserProfile>(`${this.baseUrl}/perfil`, payload);
  }

  getUserById(id: string): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${this.baseUrl}/${id}`);
  }

  getAllUsers(): Observable<UserProfile[]> {
    return this.http.get<UserProfile[]>(this.adminUrl);
  }

  getActiveUsers(): Observable<UserProfile[]> {
    return this.http.get<UserProfile[]>(`${this.adminUrl}/active`);
  }

  countUsers(): Observable<number> {
    return this.http.get<number>(`${this.adminUrl}/count`);
  }

  countActiveUsers(): Observable<number> {
    return this.http.get<number>(`${this.adminUrl}/active/count`);
  }

  blockUser(email: string, body: BlockUserRequest): Observable<UserProfile> {
    return this.http.post<UserProfile>(`${this.adminUrl}/${encodeURIComponent(email)}/block`, body);
  }

  activateUser(email: string): Observable<UserProfile> {
    return this.http.post<UserProfile>(`${this.adminUrl}/${encodeURIComponent(email)}/activate`, {});
  }

  deactivateUser(email: string, body?: BlockUserRequest): Observable<UserProfile> {
    return this.http.post<UserProfile>(`${this.adminUrl}/${encodeURIComponent(email)}/deactivate`, body || {});
  }

  getInactiveUsers(): Observable<UserProfile[]> {
    return this.http.get<UserProfile[]>(`${this.adminUrl}/inactive`);
  }

  searchUsers(name?: string, disability?: string): Observable<UserProfile[]> {
    const params: Record<string, string> = {};
    if (name?.trim()) {
      params['name'] = name.trim();
    }
    if (disability?.trim()) {
      params['disability'] = disability.trim();
    }
    return this.http.get<UserProfile[]>(`${this.adminUrl}/search`, { params });
  }

  deleteUser(email: string): Observable<{ status?: string; message?: string }> {
    return this.http.delete<{ status?: string; message?: string }>(`${this.adminUrl}/${encodeURIComponent(email)}`);
  }

  bulkDeleteUsers(emails: string[]): Observable<{
    succeeded: number;
    failed: number;
    succeededEmails?: string[];
    failedEmails?: string[];
    errors?: string[];
  }> {
    return this.http.post<{
      succeeded: number;
      failed: number;
      succeededEmails?: string[];
      failedEmails?: string[];
      errors?: string[];
    }>(`${this.adminUrl}/bulk/delete`, { emails });
  }

  getRoles(): Observable<RoleInfo[]> {
    return this.http.get<RoleInfo[]>(`${this.adminUrl}/roles`);
  }

  getRolesByEmail(email: string): Observable<string[]> {
    return this.http.get<string[]>(`${this.adminUrl}/roles-by-email`, { params: { email } });
  }

  assignRole(email: string, body: AssignRoleRequest): Observable<unknown> {
    return this.http.post(`${this.adminUrl}/${encodeURIComponent(email)}/roles`, body);
  }

  replaceRoles(email: string, roleNames: string[]): Observable<unknown> {
    return this.http.put(`${this.adminUrl}/${encodeURIComponent(email)}/roles`, { roleNames });
  }

  removeRole(email: string, roleId: number): Observable<unknown> {
    return this.http.delete(`${this.adminUrl}/${encodeURIComponent(email)}/roles/${roleId}`);
  }

  getAuditLogs(params?: { targetEmail?: string; adminEmail?: string }): Observable<AdminAuditLog[]> {
    return this.http.get<AdminAuditLog[]>(`${this.adminUrl}/audit`, { params: params as Record<string, string> });
  }
}
