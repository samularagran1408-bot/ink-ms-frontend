import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';

import { SessionService } from '../../../../core/services/session.service';
import { PreferencesApiService } from '../../../../core/services/preferences-api.service';
import { LanguageService } from '../../../../core/services/language.service';
import { AccessibilityService } from '../../../../core/services/accessibility.service';
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
  private hydrating = true;

  constructor(
    private fb: FormBuilder,
    private session: SessionService,
    private preferencesApi: PreferencesApiService,
    private languageService: LanguageService,
    private accessibility: AccessibilityService,
    private translate: TranslateService,
    private tts: TtsService,
    private notificationAnnounce: NotificationAnnounceService
  ) {
    this.form = this.fb.group({
      language: [this.languageService.currentLang],
      followSystemLanguage: [false],
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
      disabilityType: [''],
      attendanceCheckInMethod: ['qr']
    });
  }

  ngOnInit(): void {
    this.form.get('language')!.valueChanges.subscribe((lang) => {
      if (this.hydrating) {
        return;
      }
      if (this.form.get('followSystemLanguage')!.value) {
        this.form.patchValue({ followSystemLanguage: false }, { emitEvent: false });
      }
      this.accessibility.setLanguage(lang, false);
    });

    this.form.get('followSystemLanguage')!.valueChanges.subscribe((follow) => {
      if (this.hydrating) {
        return;
      }
      if (follow) {
        const systemLang = this.accessibility.detectSystemLanguage();
        this.form.patchValue({ language: systemLang }, { emitEvent: false });
      }
      this.accessibility.setFollowSystemLanguage(!!follow);
    });

    this.form.valueChanges.subscribe((value) => {
      if (this.hydrating) {
        return;
      }
      this.accessibility.applyFormPreview(value);
      this.tts.applyPreferences(value);
    });

    this.preferencesApi.getPreferences(false).subscribe({
      next: (prefs) => {
        const followSystem = prefs.followSystemLanguage === true;
        const language = followSystem
          ? this.accessibility.detectSystemLanguage()
          : this.languageService.normalize(prefs.language || this.languageService.currentLang);
        this.form.patchValue({
          language,
          followSystemLanguage: followSystem,
          highContrast: !!prefs.highContrast,
          fontSize: prefs.fontSize || 'medium',
          screenReader: !!prefs.screenReader,
          reducedMotion: !!prefs.reducedMotion,
          keyboardNavigation: prefs.keyboardNavigation !== false,
          readerMode: !!prefs.readerMode,
          notificationsEnabled: prefs.notificationsEnabled !== false,
          voiceCommandsEnabled: !!prefs.voiceCommandsEnabled,
          ttsEnabled: prefs.ttsEnabled !== false,
          voiceLanguage: prefs.voiceLanguage || this.languageService.voiceLanguageFor(language),
          disabilityType: prefs.disabilityType || '',
          attendanceCheckInMethod: prefs.attendanceCheckInMethod === 'form' ? 'form' : 'qr'
        }, { emitEvent: false });
        this.accessibility.applyPreferences(prefs);
        this.tts.applyPreferences(this.form.value);
        this.notificationAnnounce.start();
        this.hydrating = false;
      },
      error: () => {
        this.hydrating = false;
        this.errorMessage = this.translate.instant('ACCESSIBILITY.LOAD_ERROR');
      }
    });
  }

  testVoice(): void {
    this.tts.unlock();
    this.tts.applyPreferences(this.form.value);
    const voiceLang = String(this.form.value.voiceLanguage || 'es-ES');
    const phrase = voiceLang.toLowerCase().startsWith('en')
      ? this.translate.instant('ACCESSIBILITY.TTS_TEST_PHRASE')
      : this.translate.instant('ACCESSIBILITY.TTS_TEST_PHRASE');
    this.tts.speak(phrase, { force: true });
  }

  get fixedSidebar(): boolean {
    return this.session.getPrimaryRole() !== 'USUARIO';
  }

  save(): void {
    const payload = {
      ...this.form.value,
      language: this.form.value.followSystemLanguage
        ? this.accessibility.detectSystemLanguage()
        : this.languageService.normalize(this.form.value.language),
      followSystemLanguage: !!this.form.value.followSystemLanguage,
      voiceLanguage: this.form.value.voiceLanguage
        || this.languageService.voiceLanguageFor(this.form.value.language)
    };

    this.preferencesApi.updatePreferences(payload).subscribe({
      next: (saved) => {
        this.accessibility.applyPreferences(saved);
        this.tts.applyPreferences(payload);
        this.notificationAnnounce.start();
        this.message = this.translate.instant('ACCESSIBILITY.SAVED');
        this.errorMessage = null;
      },
      error: () => {
        this.message = null;
        this.errorMessage = this.translate.instant('ACCESSIBILITY.SAVE_ERROR');
      }
    });
  }
}
