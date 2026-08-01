import { DisabilityType } from './disability-type';

export interface RegisterRequest {
  fullName: string;
  email: string;
  phone: string;
  disabilityType: DisabilityType | '';
  password: string;
  confirmPassword: string;
  acceptTerms: boolean;
}
