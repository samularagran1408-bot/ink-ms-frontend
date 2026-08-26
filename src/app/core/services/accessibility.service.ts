import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';

import { Preference, PreferenceRequest } from '../models/accessibility-api';
import { AppLanguage, LanguageService } from './language.service';
import { PreferencesApiService } from './preferences-api.service';
import { SessionService } from './session.service';

export type FontSizePref = 'small' | 'medium' | 'large' | 'xlarge';

interface A11ySnapshot {
  fontSize: FontSizePref;
  highContrast: boolean;
  readerMode: boolean;
  reducedMotion: boolean;
  screenReader: boolean;
  language: AppLanguage;
  followSystemLanguage: boolean;
  contrastManual: boolean;
}

const STORAGE_KEY = 'inklusport_a11y';
const FONT_ORDER: FontSizePref[] = ['small', 'medium', 'large', 'xlarge'];
const FONT_OFFSETS: Record<FontSizePref, number> = {
  small: -1,
  medium: 0,
  large: 2,
  xlarge: 4
};

@Injectable({
  providedIn: 'root'
})
export class AccessibilityService implements OnDestroy {
  private readonly highContrastSubject = new BehaviorSubject<boolean>(false);
  private readonly fontOffsetSubject = new BehaviorSubject<number>(0);
  private readonly snapshotSubject = new BehaviorSubject<A11ySnapshot>(this.defaultSnapshot());

  readonly highContrast$ = this.highContrastSubject.asObservable();
  readonly fontOffset$ = this.fontOffsetSubject.asObservable();
  readonly snapshot$ = this.snapshotSubject.asObservable();

  private persistTimer: ReturnType<typeof setTimeout> | undefined;
  private mediaContrast: MediaQueryList | null = null;
  private mediaMotion: MediaQueryList | null = null;
  private readonly onContrastChange = (event: MediaQueryListEvent) => this.handleSystemContrast(event.matches);
  private readonly onMotionChange = (event: MediaQueryListEvent) => this.handleSystemMotion(event.matches);
  private readonly onLanguageChange = () => this.handleSystemLanguage();

  constructor(
    private languageService: LanguageService,
    private preferencesApi: PreferencesApiService,
    private session: SessionService
  ) {}

  get snapshot(): A11ySnapshot {
    return this.snapshotSubject.value;
  }

  init(): Observable<Preference | A11ySnapshot | null> {
    const restored = this.readLocal() ?? this.snapshotFromSystem();
    this.applySnapshot(restored, { persistLocal: true, persistRemote: false });
    this.bindSystemListeners();

    if (!this.session.isAuthenticated()) {
      return of(restored);
    }
    return this.syncFromServer();
  }

  syncFromServer(): Observable<Preference | null> {
    if (!this.session.isAuthenticated()) {
      return of(null);
    }
    return this.preferencesApi.getPreferences().pipe(
      tap((prefs) => this.applyPreferences(prefs, { persistRemote: false })),
      catchError(() => of(null))
    );
  }

  applyPreferences(prefs: Partial<Preference> | null | undefined, options?: { persistRemote?: boolean }): void {
    if (!prefs) {
      return;
    }
    const followSystem = prefs.followSystemLanguage === true;
    const language = followSystem
      ? this.detectSystemLanguage()
      : this.languageService.normalize(prefs.language);
    const next: A11ySnapshot = {
      fontSize: this.normalizeFontSize(prefs.fontSize),
      highContrast: !!prefs.highContrast,
      readerMode: !!prefs.readerMode,
      reducedMotion: !!prefs.reducedMotion || this.detectSystemReducedMotion(),
      screenReader: !!prefs.screenReader,
      language,
      followSystemLanguage: followSystem,
      contrastManual: this.snapshot.contrastManual || prefs.highContrast != null
    };
    this.applySnapshot(next, { persistLocal: true, persistRemote: options?.persistRemote === true });
  }

  toggleContrast(): void {
    const current = this.snapshot;
    this.applySnapshot({
      ...current,
      highContrast: !current.highContrast,
      contrastManual: true
    }, { persistLocal: true, persistRemote: true });
  }

  increaseFont(): void {
    this.shiftFont(1);
  }

  decreaseFont(): void {
    this.shiftFont(-1);
  }

  resetFont(): void {
    this.applySnapshot({
      ...this.snapshot,
      fontSize: 'medium'
    }, { persistLocal: true, persistRemote: true });
  }

  setFollowSystemLanguage(follow: boolean): void {
    const language = follow ? this.detectSystemLanguage() : this.snapshot.language;
    this.applySnapshot({
      ...this.snapshot,
      followSystemLanguage: follow,
      language
    }, { persistLocal: true, persistRemote: true });
  }

  setLanguage(language: string | null | undefined, followSystem = false): AppLanguage {
    const lang = this.languageService.normalize(language);
    this.applySnapshot({
      ...this.snapshot,
      language: lang,
      followSystemLanguage: followSystem
    }, { persistLocal: true, persistRemote: true });
    return lang;
  }

  applyFormPreview(value: Partial<Preference> & { followSystemLanguage?: boolean }): void {
    this.applyPreferences({
      ...this.snapshot,
      ...value
    }, { persistRemote: false });
  }

  ngOnDestroy(): void {
    this.unbindSystemListeners();
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
    }
  }

  private shiftFont(step: number): void {
    const index = FONT_ORDER.indexOf(this.snapshot.fontSize);
    const next = FONT_ORDER[Math.min(FONT_ORDER.length - 1, Math.max(0, index + step))];
    this.applySnapshot({
      ...this.snapshot,
      fontSize: next
    }, { persistLocal: true, persistRemote: true });
  }

  private applySnapshot(
    snapshot: A11ySnapshot,
    options: { persistLocal: boolean; persistRemote: boolean }
  ): void {
    this.snapshotSubject.next(snapshot);
    this.highContrastSubject.next(snapshot.highContrast);
    this.fontOffsetSubject.next(FONT_OFFSETS[snapshot.fontSize]);
    this.languageService.setLanguage(snapshot.language);
    this.applyToDocument(snapshot);
    if (options.persistLocal) {
      this.writeLocal(snapshot);
    }
    if (options.persistRemote) {
      this.scheduleRemotePersist(snapshot);
    }
  }

  private applyToDocument(snapshot: A11ySnapshot): void {
    if (typeof document === 'undefined') {
      return;
    }
    const root = document.documentElement;
    root.dataset['fontSize'] = snapshot.fontSize;
    root.style.setProperty('--font-offset', `${FONT_OFFSETS[snapshot.fontSize]}px`);
    root.style.setProperty('--a11y-font-scale', String(1 + FONT_OFFSETS[snapshot.fontSize] * 0.08));
    document.body.classList.toggle('high-contrast-mode', snapshot.highContrast);
    document.body.classList.toggle('reader-mode', snapshot.readerMode);
    document.body.classList.toggle('reduced-motion', snapshot.reducedMotion);
    document.body.classList.toggle('screen-reader-mode', snapshot.screenReader);
  }

  private scheduleRemotePersist(snapshot: A11ySnapshot): void {
    if (!this.session.isAuthenticated()) {
      return;
    }
    if (this.persistTimer) {
      clearTimeout(this.persistTimer);
    }
    this.persistTimer = setTimeout(() => {
      const payload: PreferenceRequest = {
        language: snapshot.language,
        followSystemLanguage: snapshot.followSystemLanguage,
        highContrast: snapshot.highContrast,
        fontSize: snapshot.fontSize,
        readerMode: snapshot.readerMode,
        reducedMotion: snapshot.reducedMotion,
        screenReader: snapshot.screenReader,
        voiceLanguage: this.languageService.voiceLanguageFor(snapshot.language)
      };
      this.preferencesApi.updatePreferences(payload).subscribe({ error: () => undefined });
    }, 400);
  }

  private bindSystemListeners(): void {
    if (typeof window === 'undefined') {
      return;
    }
    this.mediaContrast = window.matchMedia('(prefers-contrast: more)');
    this.mediaMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.mediaContrast.addEventListener('change', this.onContrastChange);
    this.mediaMotion.addEventListener('change', this.onMotionChange);
    window.addEventListener('languagechange', this.onLanguageChange);
  }

  private unbindSystemListeners(): void {
    this.mediaContrast?.removeEventListener('change', this.onContrastChange);
    this.mediaMotion?.removeEventListener('change', this.onMotionChange);
    if (typeof window !== 'undefined') {
      window.removeEventListener('languagechange', this.onLanguageChange);
    }
  }

  private handleSystemLanguage(): void {
    if (!this.snapshot.followSystemLanguage) {
      return;
    }
    this.applySnapshot({
      ...this.snapshot,
      language: this.detectSystemLanguage()
    }, { persistLocal: true, persistRemote: true });
  }

  private handleSystemContrast(matches: boolean): void {
    if (this.snapshot.contrastManual) {
      return;
    }
    this.applySnapshot({
      ...this.snapshot,
      highContrast: matches
    }, { persistLocal: true, persistRemote: true });
  }

  private handleSystemMotion(matches: boolean): void {
    this.applySnapshot({
      ...this.snapshot,
      reducedMotion: matches || this.snapshot.reducedMotion
    }, { persistLocal: true, persistRemote: false });
  }

  detectSystemLanguage(): AppLanguage {
    if (typeof navigator === 'undefined') {
      return 'es';
    }
    return this.languageService.normalize(navigator.language || navigator.languages?.[0]);
  }

  detectSystemContrast(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia('(prefers-contrast: more)').matches
      || window.matchMedia('(-ms-high-contrast: active)').matches;
  }

  detectSystemReducedMotion(): boolean {
    if (typeof window === 'undefined') {
      return false;
    }
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  private snapshotFromSystem(): A11ySnapshot {
    return {
      ...this.defaultSnapshot(),
      language: this.detectSystemLanguage(),
      followSystemLanguage: true,
      highContrast: this.detectSystemContrast(),
      reducedMotion: this.detectSystemReducedMotion()
    };
  }

  private defaultSnapshot(): A11ySnapshot {
    return {
      fontSize: 'medium',
      highContrast: false,
      readerMode: false,
      reducedMotion: false,
      screenReader: false,
      language: 'es',
      followSystemLanguage: true,
      contrastManual: false
    };
  }

  private normalizeFontSize(value: string | null | undefined): FontSizePref {
    if (value === 'small' || value === 'large' || value === 'xlarge') {
      return value;
    }
    return 'medium';
  }

  private readLocal(): A11ySnapshot | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as Partial<A11ySnapshot>;
      return {
        ...this.defaultSnapshot(),
        ...parsed,
        fontSize: this.normalizeFontSize(parsed.fontSize),
        language: this.languageService.normalize(parsed.language)
      };
    } catch {
      return null;
    }
  }

  private writeLocal(snapshot: A11ySnapshot): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  }
}
