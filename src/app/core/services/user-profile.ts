export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  profilePicture?: string;
  bio?: string;
  disability?: string;
  companionFullName?: string;
  companionPhone?: string;
  companionRelationship?: string;
  companionEmail?: string;
  supportPreference?: string;
  supportPreferenceNotes?: string;
  isActive?: boolean;
  blockReason?: string;
  blockedUntil?: string;
  blockedPermanently?: boolean;
  deleted?: boolean;
  deletedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string;
  roles?: string[];
  emailVerified?: boolean;
  phoneVerified?: boolean;
  eventsAttended?: number;
  eventsCreated?: number;
  platformDays?: number;
  testEventCreated?: boolean;
  organizerQuizScore?: number;
  organizerQuizPassed?: boolean;
  organizerVerificationStatus?: string;
  certificationFile?: string;
  experienceMonths?: number;
  experienceYears?: number;
  eventsAsTrainer?: number;
  trainerQuizScore?: number;
  trainerQuizPassed?: boolean;
  trainerQuizAttempts?: number;
  organizerQuizAttempts?: number;
  quizDisciplines?: string;
  disciplineSportIds?: number[];
  identityDocument?: string;
  trainerVerificationStatus?: string;
  verifiedRoles?: string;
}

export interface UpdateProfileRequest {
  fullName?: string;
  phone?: string;
  profilePicture?: string;
  bio?: string;
  disability?: string;
  companionFullName?: string;
  companionPhone?: string;
  companionRelationship?: string;
  companionEmail?: string;
  supportPreference?: string;
  supportPreferenceNotes?: string;
}

export interface RoleInfo {
  id: number;
  name: string;
  description?: string;
}

export interface AdminAuditLog {
  id: string;
  adminEmail: string;
  action: string;
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

export interface BlockUserRequest {
  reason?: string;
  permanent?: boolean;
  blockedUntil?: string;
}

export interface AssignRoleRequest {
  roleId?: number;
  roleName?: string;
}
