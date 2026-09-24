import { Component, OnInit } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';

import { SessionService } from '@core/services/session.service';
import { PreferencesApiService } from '@features/accessibility/services/preferences-api.service';
import { LanguageService } from '@features/accessibility/services/language.service';
import { AccessibilityService } from '@features/accessibility/services/accessibility.service';
import { TtsService } from '@features/accessibility/services/tts.service';
import { NotificationAnnounceService } from '@features/accessibility/services/notification-announce.service';
import { ReportsService } from '@features/reports/services/reports.service';
import { SharedModule } from '@shared/shared.module';
import { catchError, of, switchMap } from 'rxjs';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule, SharedModule],
  selector: 'app-accessibility-page',
  templateUrl: './accessibility-page.component.html',
  styleUrl: './accessibility-page.component.scss'
})
export class AccessibilityPageComponent implements OnInit {
  form: FormGroup;
  message: string | null = null;
  errorMessage: string | null = null;
  scheduleActive = false;
  private hydrating = true;

  constructor(
    private fb: FormBuilder,
    private session: SessionService,
    private preferencesApi: PreferencesApiService,
    private languageService: LanguageService,
    private accessibility: AccessibilityService,
    private translate: TranslateService,
    private tts: TtsService,
    private notificationAnnounce: NotificationAnnounceService,
    private reportsService: ReportsService
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
      attendanceCheckInMethod: ['qr'],
      weeklyReportEmailEnabled: [false]
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
          voiceLanguage: this.languageService.voiceLanguageFor(language),
          attendanceCheckInMethod: prefs.attendanceCheckInMethod === 'form' ? 'form' : 'qr',
          weeklyReportEmailEnabled: !!prefs.weeklyReportEmailEnabled
        }, { emitEvent: false });
        this.accessibility.applyPreferences(prefs);
        this.tts.applyPreferences(this.form.value);
        this.notificationAnnounce.start();
        this.hydrating = false;
        this.syncScheduleStatus();
      },
      error: () => {
        this.hydrating = false;
        this.errorMessage = this.translate.instant('ACCESSIBILITY.LOAD_ERROR');
      }
    });
  }

  private syncScheduleStatus(): void {
    this.reportsService.getWeeklySchedule().subscribe({
      next: (schedule) => {
        this.scheduleActive = !!schedule.enabled;
        if (schedule.enabled !== !!this.form.value.weeklyReportEmailEnabled) {
          this.form.patchValue(
            { weeklyReportEmailEnabled: !!schedule.enabled },
            { emitEvent: false }
          );
        }
      },
      error: () => {
        this.scheduleActive = !!this.form.value.weeklyReportEmailEnabled;
      }
    });
  }

  testVoice(): void {
    this.tts.unlock();
    this.tts.applyPreferences(this.form.value);
    const phrase = this.languageService.normalize(this.form.value.language) === 'en'
      ? 'This is an English accessibility voice test.'
      : 'Esta es una prueba de voz de accesibilidad en español.';
    this.tts.speak(phrase, { force: true });
  }

  save(): void {
    const enableWeekly = !!this.form.value.weeklyReportEmailEnabled;
    const payloadLanguage = this.form.value.followSystemLanguage
      ? this.accessibility.detectSystemLanguage()
      : this.languageService.normalize(this.form.value.language);
    const payload = {
      ...this.form.value,
      language: payloadLanguage,
      followSystemLanguage: !!this.form.value.followSystemLanguage,
      voiceLanguage: this.languageService.voiceLanguageFor(payloadLanguage),
      weeklyReportEmailEnabled: enableWeekly
    };

    this.preferencesApi.updatePreferences(payload).pipe(
      switchMap((saved) => {
        this.accessibility.applyPreferences(saved);
        this.tts.applyPreferences(payload);
        this.notificationAnnounce.start();
        const schedule$ = enableWeekly
          ? this.reportsService.scheduleWeeklyReport()
          : this.reportsService.cancelWeeklyReport();
        return schedule$.pipe(
          catchError(() => {
            this.message = this.translate.instant('ACCESSIBILITY.WEEKLY_REPORT_SYNC_ERROR');
            this.errorMessage = null;
            return of(null);
          }),
          switchMap((schedule) => of({ saved, schedule }))
        );
      })
    ).subscribe({
      next: ({ schedule }) => {
        if (schedule) {
          this.scheduleActive = !!schedule.enabled;
          this.message = this.translate.instant('ACCESSIBILITY.SAVED');
          this.errorMessage = null;
        } else if (!this.message) {
          this.message = this.translate.instant('ACCESSIBILITY.SAVED');
          this.errorMessage = null;
        }
      },
      error: () => {
        this.message = null;
        this.errorMessage = this.translate.instant('ACCESSIBILITY.SAVE_ERROR');
      }
    });
  }
}
