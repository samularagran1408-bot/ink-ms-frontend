import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';

import { PreferencesApiService } from './preferences-api.service';
import { SessionService } from './session.service';

export type AppLanguage = 'es' | 'en';

const LANG_STORAGE_KEY = 'inklusport_lang';

@Injectable({
  providedIn: 'root'
})
export class LanguageService {
  constructor(
    private translate: TranslateService,
    private preferencesApi: PreferencesApiService,
    private session: SessionService
  ) {
    this.translate.addLangs(['es', 'en']);
    this.translate.setDefaultLang('es');
  }

  get currentLang(): AppLanguage {
    return this.normalize(this.translate.currentLang || this.translate.defaultLang || 'es');
  }

  /**
   * Arranca el idioma: preferencia del usuario si hay sesión, si no localStorage / español.
   */
  init(): Observable<AppLanguage> {
    const fallback = this.normalize(localStorage.getItem(LANG_STORAGE_KEY) || 'es');
    this.apply(fallback);

    if (!this.session.isAuthenticated()) {
      return of(fallback);
    }

    return this.preferencesApi.getPreferences().pipe(
      map((prefs) => this.normalize(prefs.language || fallback)),
      tap((lang) => this.apply(lang)),
      catchError(() => of(fallback))
    );
  }

  setLanguage(language: string | null | undefined): AppLanguage {
    const lang = this.normalize(language);
    this.apply(lang);
    return lang;
  }

  voiceLanguageFor(language: string | null | undefined): string {
    return this.normalize(language) === 'en' ? 'en-US' : 'es-ES';
  }

  normalize(language: string | null | undefined): AppLanguage {
    if (!language) {
      return 'es';
    }
    const value = language.trim().toLowerCase();
    if (value.startsWith('en')) {
      return 'en';
    }
    return 'es';
  }

  private apply(lang: AppLanguage): void {
    this.translate.use(lang);
    localStorage.setItem(LANG_STORAGE_KEY, lang);
    document.documentElement.lang = lang;
  }
}
