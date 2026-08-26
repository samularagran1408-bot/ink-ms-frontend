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

export type CompanionRequirement = 'required' | 'optional' | 'none';

const REQUIRED_COMPANION = new Set([
  'visual',
  'vision',
  'intelectual',
  'intellectual',
  'cognitiva',
  'cognitive',
  'multiple',
  'multiple_disability',
]);

const OPTIONAL_COMPANION = new Set([
  'motriz',
  'fisica',
  'fisica_motora',
  'motora',
  'physical',
]);

export function normalizeDisabilityKey(type: string | null | undefined): string {
  if (!type) {
    return '';
  }
  return type.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

/** Nivel de exigencia del acompañante según el tipo de discapacidad. */
export function companionRequirement(type: string | null | undefined): CompanionRequirement {
  const normalized = normalizeDisabilityKey(type);
  if (!normalized || normalized === 'otra' || normalized === 'ninguna' || normalized === 'none') {
    return 'none';
  }
  if (REQUIRED_COMPANION.has(normalized)) {
    return 'required';
  }
  if (OPTIONAL_COMPANION.has(normalized)) {
    return 'optional';
  }
  return 'none';
}

export function disabilityRequiresCompanion(type: string | null | undefined): boolean {
  return companionRequirement(type) === 'required';
}

export function disabilityAllowsCompanion(type: string | null | undefined): boolean {
  return companionRequirement(type) !== 'none';
}

export function hasCompanionData(companion: {
  fullName?: string;
  phone?: string;
  relationship?: string;
  email?: string;
} | null | undefined): boolean {
  if (!companion) {
    return false;
  }
  return !!(
    companion.fullName?.trim()
    || companion.phone?.trim()
    || companion.relationship?.trim()
    || companion.email?.trim()
  );
}
