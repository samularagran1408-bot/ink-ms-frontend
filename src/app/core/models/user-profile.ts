/** Contratos del microservicio `ink-ms-users`. */

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  phone?: string | null;
  profilePicture?: string | null;
  bio?: string | null;
  disability?: string | null;
  companionFullName?: string | null;
  companionPhone?: string | null;
  companionRelationship?: string | null;
  companionEmail?: string | null;
  supportPreference?: string | null;
  supportPreferenceNotes?: string | null;
  isActive?: boolean | null;
  blockReason?: string | null;
  blockedUntil?: string | null;
  blockedPermanently?: boolean | null;
  deleted?: boolean | null;
  deletedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  lastLoginAt?: string | null;
  roles?: string[] | null;
  emailVerified?: boolean | null;
  phoneVerified?: boolean | null;
  eventsAttended?: number | null;
  eventsCreated?: number | null;
  platformDays?: number | null;
  testEventCreated?: boolean | null;
  organizerQuizScore?: number | null;
  organizerQuizPassed?: boolean | null;
  organizerVerificationStatus?: string | null;
  certificationFile?: string | null;
  experienceMonths?: number | null;
  experienceYears?: number | null;
  eventsAsTrainer?: number | null;
  trainerQuizScore?: number | null;
  trainerQuizPassed?: boolean | null;
  trainerQuizAttempts?: number | null;
  organizerQuizAttempts?: number | null;
  quizDisciplines?: string | null;
  disciplineSportIds?: number[] | null;
  identityDocument?: string | null;
  trainerVerificationStatus?: string | null;
  verifiedRoles?: string | null;
}

export interface UpdateProfileRequest {
  fullName?: string | null;
  phone?: string | null;
  profilePicture?: string | null;
  bio?: string | null;
  disability?: string | null;
  companionFullName?: string | null;
  companionPhone?: string | null;
  companionRelationship?: string | null;
  companionEmail?: string | null;
  supportPreference?: string | null;
  supportPreferenceNotes?: string | null;
}

export interface RoleInfo {
  id: number;
  name: string;
  description?: string | null;
}

export interface AssignRoleRequest {
  roleId?: number | null;
  roleName?: string | null;
}

export interface BlockUserRequest {
  reason?: string | null;
  permanent?: boolean;
  blockedUntil?: string | null;
}

export interface AdminAuditLog {
  id?: string;
  adminEmail?: string;
  action?: string;
  targetEmail?: string;
  targetUserId?: string;
  details?: string;
  ipAddress?: string;
  createdAt?: string;
}

export interface AdminUserActivityItem {
  action?: string;
  details?: string;
  ipAddress?: string;
  createdAt?: string;
  source?: string;
}

export interface AdminUserActivityResponse {
  lastLoginAt?: string;
  items?: AdminUserActivityItem[];
}
