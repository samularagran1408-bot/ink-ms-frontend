import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';

export type AppLanguage = 'es' | 'en';

const LANG_STORAGE_KEY = 'inklusport_lang';

@Injectable({
  providedIn: 'root'
})
export class LanguageService {
  constructor(private translate: TranslateService) {
    this.translate.addLangs(['es', 'en']);
    this.translate.setDefaultLang('es');
  }

  get currentLang(): AppLanguage {
    return this.normalize(this.translate.currentLang || this.translate.defaultLang || 'es');
  }

  /**
   * Idioma local (storage / sistema) hasta que accesibilidad hidrate la preferencia del usuario.
   */
  init(): Observable<AppLanguage> {
    const stored = this.normalize(localStorage.getItem(LANG_STORAGE_KEY));
    const system = this.detectSystemLanguage();
    const lang = localStorage.getItem(LANG_STORAGE_KEY) ? stored : system;
    this.apply(lang);
    return of(lang);
  }

  setLanguage(language: string | null | undefined): AppLanguage {
    const lang = this.normalize(language);
    this.apply(lang);
    return lang;
  }

  detectSystemLanguage(): AppLanguage {
    if (typeof navigator === 'undefined') {
      return 'es';
    }
    return this.normalize(navigator.language || navigator.languages?.[0]);
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
