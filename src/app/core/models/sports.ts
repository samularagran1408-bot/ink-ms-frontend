export interface Sport {
  id: number;
  name: string;
  description?: string;
  difficulty?: string;
  requiredMaterials?: string;
  isActive?: boolean;
  disabilities?: Disability[];
}

export interface SportRequest {
  name: string;
  description?: string;
  difficulty?: string;
  requiredMaterials?: string;
  isActive?: boolean;
}

export interface EventItem {
  id: string;
  sportId: number;
  sportName?: string;
  name: string;
  description?: string;
  eventDate: string;
  eventTime: string;
  location?: string;
  imageUrl?: string;
  latitude?: number | null;
  longitude?: number | null;
  maxCapacity: number;
  availableCapacity?: number;
  status?: string;
  createdBy?: string;
  createdAt?: string;
}

export interface EventRequest {
  sportId: number;
  name: string;
  description?: string;
  eventDate: string;
  eventTime: string;
  location?: string;
  imageUrl?: string;
  latitude?: number | null;
  longitude?: number | null;
  maxCapacity: number;
  createdBy?: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  startDate: string;
  startTime?: string;
  location?: string;
  sportName?: string;
  availableCapacity?: number;
  maxCapacity?: number;
}

export interface Disability {
  id: number;
  name: string;
  description?: string;
  category?: string;
  isActive?: boolean;
}

export interface DisabilityRequest {
  name: string;
  description?: string;
  category?: string;
  isActive?: boolean;
}

export interface SportDisability {
  sportId: number;
  sportName?: string;
  disabilityId: number;
  disabilityName?: string;
  adaptations?: string;
}

export interface SportDisabilityRequest {
  sportId: number;
  disabilityId: number;
  adaptations: string;
}

export interface Registration {
  id: string;
  userId: string;
  userFullName?: string;
  userEmail?: string;
  eventId: string;
  eventName?: string;
  eventDate?: string;
  eventTime?: string;
  eventStatus?: string;
  registrationDate?: string;
  attended?: boolean;
  waitlistPosition?: number;
  qrCode?: string;
  message?: string;
}

export interface AttendanceActionResponse {
  status: string;
  message: string;
  succeeded?: number;
  failed?: number;
  errors?: string[];
}

export interface QrAttendanceInfo {
  qrCode?: string;
  registrationId?: string;
  eventId?: string;
  eventName?: string;
  eventDate?: string;
  eventTime?: string;
  location?: string;
  attended?: boolean;
  ownedByCurrentUser?: boolean;
}

export interface AttendanceReportAttendee {
  registrationId: string;
  userId?: string;
  fullName?: string;
  email?: string;
  checkInTime?: string;
  checkInMethod?: string;
  verifiedBy?: string;
}

export interface AttendanceReportAbsent {
  registrationId: string;
  userId?: string;
  fullName?: string;
  email?: string;
}

export interface AttendanceReport {
  eventId: string;
  eventName?: string;
  totalRegistered: number;
  totalAttended: number;
  totalAbsent?: number;
  attendanceRatePercent?: number;
  attendees: AttendanceReportAttendee[];
  absentees?: AttendanceReportAbsent[];
}

export interface Routine {
  id: string;
  trainerId?: string;
  sportId?: number;
  sportName?: string;
  name: string;
  description?: string;
  disabilityFocus?: string;
  level?: string;
  durationMinutes?: number;
  exercisesJson?: string;
  status?: string;
  maxCapacity?: number;
  availableCapacity?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface RoutineRequest {
  trainerId?: string;
  sportId?: number;
  name: string;
  description?: string;
  disabilityFocus?: string;
  level?: string;
  durationMinutes?: number;
  exercisesJson?: string;
  maxCapacity?: number;
}

export interface RoutineRegistration {
  id: string;
  userId: string;
  routineId: string;
  status?: string;
  registeredAt?: string;
}
