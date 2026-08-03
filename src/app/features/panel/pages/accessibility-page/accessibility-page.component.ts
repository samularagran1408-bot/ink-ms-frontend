import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';

import { SessionService } from '../../../../core/services/session.service';
import { PreferencesApiService } from '../../../../core/services/preferences-api.service';
import { LanguageService } from '../../../../core/services/language.service';
import { TtsService } from '../../../../core/services/tts.service';
import { NotificationAnnounceService } from '../../../../core/services/notification-announce.service';

@Component({
  selector: 'app-accessibility-page',
  templateUrl: './accessibility-page.component.html',
  styleUrl: './accessibility-page.component.scss'
})
export class AccessibilityPageComponent implements OnInit {
  form: FormGroup;
  message: string | null = null;
  errorMessage: string | null = null;

  constructor(
    private fb: FormBuilder,
    private session: SessionService,
    private preferencesApi: PreferencesApiService,
    private languageService: LanguageService,
    private translate: TranslateService,
    private tts: TtsService,
    private notificationAnnounce: NotificationAnnounceService
  ) {
    this.form = this.fb.group({
      language: [this.languageService.currentLang],
      highContrast: [false],
      fontSize: ['medium'],
      screenReader: [false],
      reducedMotion: [false],
      keyboardNavigation: [true],
      readerMode: [false],
      notificationsEnabled: [true],
      voiceCommandsEnabled: [false],
      ttsEnabled: [false],
      voiceLanguage: [this.languageService.voiceLanguageFor(this.languageService.currentLang)],
      disabilityType: ['']
    });
  }

  ngOnInit(): void {
    // Vista previa inmediata del idioma de texto (toda la UI); no fuerza el idioma de voz.
    this.form.get('language')!.valueChanges.subscribe((lang) => {
      this.languageService.setLanguage(lang);
    });

    this.preferencesApi.getPreferences().subscribe({
      next: (prefs) => {
        const language = this.languageService.normalize(prefs.language || this.languageService.currentLang);
        this.form.patchValue({
          language,
          highContrast: !!prefs.highContrast,
          fontSize: prefs.fontSize || 'medium',
          screenReader: !!prefs.screenReader,
          reducedMotion: !!prefs.reducedMotion,
          keyboardNavigation: prefs.keyboardNavigation !== false,
          readerMode: !!prefs.readerMode,
          notificationsEnabled: prefs.notificationsEnabled !== false,
          voiceCommandsEnabled: !!prefs.voiceCommandsEnabled,
          ttsEnabled: !!prefs.ttsEnabled,
          voiceLanguage: prefs.voiceLanguage || this.languageService.voiceLanguageFor(language),
          disabilityType: prefs.disabilityType || ''
        });
        this.languageService.setLanguage(language);
        this.tts.applyPreferences(this.form.value);
        this.notificationAnnounce.start();
        this.applyLocalUi();
      },
      error: () => {
        this.errorMessage = this.translate.instant('ACCESSIBILITY.LOAD_ERROR');
      }
    });
  }

  testVoice(): void {
    this.tts.unlock();
    this.tts.applyPreferences(this.form.value);
    const voiceLang = String(this.form.value.voiceLanguage || 'es-ES');
    const phrase = voiceLang.toLowerCase().startsWith('en')
      ? 'Audio notifications are on. This is how your alerts will sound.'
      : 'Notificaciones en audio activadas. Así se escucharán tus avisos.';
    this.tts.speak(phrase, { force: true });
  }

  get fixedSidebar(): boolean {
    return this.session.getPrimaryRole() !== 'USUARIO';
  }

  save(): void {
    const payload = {
      ...this.form.value,
      language: this.languageService.normalize(this.form.value.language),
      voiceLanguage: this.form.value.voiceLanguage
        || this.languageService.voiceLanguageFor(this.form.value.language)
    };

    this.preferencesApi.updatePreferences(payload).subscribe({
      next: () => {
        this.languageService.setLanguage(payload.language);
        this.tts.applyPreferences(payload);
        this.notificationAnnounce.start();
        this.message = this.translate.instant('ACCESSIBILITY.SAVED');
        this.errorMessage = null;
        this.applyLocalUi();
      },
      error: () => {
        this.message = null;
        this.errorMessage = this.translate.instant('ACCESSIBILITY.SAVE_ERROR');
      }
    });
  }

  private applyLocalUi(): void {
    if (this.form.value.highContrast) {
      document.body.classList.add('high-contrast-mode');
    } else {
      document.body.classList.remove('high-contrast-mode');
    }
  }
}
