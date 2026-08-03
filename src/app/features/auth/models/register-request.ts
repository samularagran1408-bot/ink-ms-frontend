import { DisabilityType } from './disability-type';

export interface CompanionRequest {
  fullName: string;
  phone: string;
  relationship?: string;
  email?: string;
}

export interface RegisterRequest {
  fullName: string;
  email: string;
  phone: string;
  disabilityType: DisabilityType | '';
  companion?: CompanionRequest;
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
}

/** Discapacidades graves que exigen datos del acompañante. */
export function disabilityRequiresCompanion(type: string | null | undefined): boolean {
  if (!type) {
    return false;
  }
  const normalized = type.trim().toLowerCase().replace(/[\s-]+/g, '_');
  return normalized === 'motriz'
    || normalized === 'auditiva'
    || normalized === 'fisica'
    || normalized === 'fisica_motora'
    || normalized === 'motora'
    || normalized === 'physical';
}
