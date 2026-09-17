import { AuthResponse } from './auth-response';
import { PendingRoleRequest } from '@core/models/user-profile';

export interface RegisterResult extends AuthResponse {
  pendingRoleRequest: PendingRoleRequest | null;
}
