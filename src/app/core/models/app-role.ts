export type AppRole = 'ADMIN' | 'USUARIO' | 'ORGANIZADOR' | 'ENTRENADOR';

export const ROLE_LABELS: Record<AppRole, string> = {
  ADMIN: 'Administrador',
  USUARIO: 'Atleta Adaptado',
  ORGANIZADOR: 'Organizador',
  ENTRENADOR: 'Entrenador',
};

export const ROLE_HOME: Record<AppRole, string> = {
  ADMIN: '/admin',
  ORGANIZADOR: '/organizer',
  ENTRENADOR: '/trainer',
  USUARIO: '/home',
};

const ROLE_PRIORITY: AppRole[] = ['ADMIN', 'ORGANIZADOR', 'ENTRENADOR', 'USUARIO'];

export function normalizeRoles(roles: string[] | null | undefined): AppRole[] {
  if (!roles?.length) {
    return ['USUARIO'];
  }

  const normalized = roles
    .map((role) => role?.toUpperCase().replace(/^ROLE_/, ''))
    .map((role) => {
      if (role === 'ADMINISTRADOR' || role === 'ADMIN') return 'ADMIN' as AppRole;
      if (role === 'ORGANIZER' || role === 'ORGANIZADOR') return 'ORGANIZADOR' as AppRole;
      if (role === 'COACH' || role === 'TRAINER' || role === 'ENTRENADOR') return 'ENTRENADOR' as AppRole;
      if (role === 'USER' || role === 'USUARIO') return 'USUARIO' as AppRole;
      return null;
    })
    .filter((role): role is AppRole => !!role);

  return normalized.length ? Array.from(new Set(normalized)) : ['USUARIO'];
}

export function resolvePrimaryRole(roles: string[] | null | undefined): AppRole {
  const normalized = normalizeRoles(roles);
  return ROLE_PRIORITY.find((role) => normalized.includes(role)) ?? 'USUARIO';
}
