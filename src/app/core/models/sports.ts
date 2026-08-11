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
  eventId: string;
  eventName?: string;
  registrationDate?: string;
  attended?: boolean;
  waitlistPosition?: number;
  qrCode?: string;
  message?: string;
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
