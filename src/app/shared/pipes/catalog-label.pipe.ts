import { Pipe, PipeTransform } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

const DISABILITY_KEYS: Record<string, string> = {
  VISUAL: 'PROFILE.DISABILITY_VISUAL',
  MOTRIZ: 'PROFILE.DISABILITY_MOTOR',
  MOTOR: 'PROFILE.DISABILITY_MOTOR',
  AUDITIVA: 'PROFILE.DISABILITY_HEARING',
  HEARING: 'PROFILE.DISABILITY_HEARING',
  INTELECTUAL: 'PROFILE.DISABILITY_INTELLECTUAL',
  INTELLECTUAL: 'PROFILE.DISABILITY_INTELLECTUAL',
  COGNITIVA: 'PROFILE.DISABILITY_COGNITIVE',
  COGNITIVE: 'PROFILE.DISABILITY_COGNITIVE',
  MULTIPLE: 'PROFILE.DISABILITY_MULTIPLE'
};

@Pipe({
  name: 'disabilityLabel',
  pure: false
})
export class DisabilityLabelPipe implements PipeTransform {
  constructor(private translate: TranslateService) {}

  transform(value: string | null | undefined): string {
    if (!value?.trim()) {
      return this.translate.instant('COMMON.NONE');
    }
    const key = DISABILITY_KEYS[value.trim().toUpperCase()];
    return key ? this.translate.instant(key) : value;
  }
}

@Pipe({
  name: 'rolesLabel',
  pure: false
})
export class RolesLabelPipe implements PipeTransform {
  constructor(private translate: TranslateService) {}

  transform(roles: string[] | null | undefined): string {
    const list = roles?.length ? roles : ['USUARIO'];
    return list
      .map((role) => {
        const key = `ROLES.${String(role || '').toUpperCase().replace(/^ROLE_/, '')}`;
        const translated = this.translate.instant(key);
        return translated === key ? role : translated;
      })
      .join(', ');
  }
}
