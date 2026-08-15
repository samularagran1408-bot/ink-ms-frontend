export type AttendanceCheckInMethod = 'form' | 'qr';

export interface Preference {
  disabilityType?: string;
  language?: string;
  highContrast?: boolean;
  fontSize?: string;
  screenReader?: boolean;
  reducedMotion?: boolean;
  keyboardNavigation?: boolean;
  readerMode?: boolean;
  notificationsEnabled?: boolean;
  voiceCommandsEnabled?: boolean;
  ttsEnabled?: boolean;
  voiceLanguage?: string;
  attendanceCheckInMethod?: AttendanceCheckInMethod | string;
  notificationPreferences?: unknown;
  trainingPreferences?: unknown;
}

export interface PreferenceRequest {
  disabilityType?: string;
  language?: string;
  highContrast?: boolean;
  fontSize?: string;
  screenReader?: boolean;
  reducedMotion?: boolean;
  keyboardNavigation?: boolean;
  readerMode?: boolean;
  notificationsEnabled?: boolean;
  voiceCommandsEnabled?: boolean;
  ttsEnabled?: boolean;
  voiceLanguage?: string;
  attendanceCheckInMethod?: AttendanceCheckInMethod | string;
}

export function normalizeAttendanceCheckInMethod(
  value: string | null | undefined
): AttendanceCheckInMethod {
  return value === 'form' ? 'form' : 'qr';
}

export interface AppNotification {
  id: string;
  userId?: string;
  type?: string;
  title: string;
  body?: string;
  eventId?: string;
  priority?: string;
  read?: boolean;
  readAt?: string;
  createdAt?: string;
  scheduledFor?: string;
}
