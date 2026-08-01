import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup } from '@angular/forms';

import { SessionService } from '../../../../core/services/session.service';
import { PreferencesApiService } from '../../../../core/services/preferences-api.service';

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
    private preferencesApi: PreferencesApiService
  ) {
    this.form = this.fb.group({
      language: ['es'],
      highContrast: [false],
      fontSize: ['medium'],
      screenReader: [false],
      reducedMotion: [false],
      keyboardNavigation: [true],
      readerMode: [false],
      notificationsEnabled: [true],
      voiceCommandsEnabled: [false],
      ttsEnabled: [false],
      voiceLanguage: ['es-ES'],
      disabilityType: ['']
    });
  }

  ngOnInit(): void {
    this.preferencesApi.getPreferences().subscribe({
      next: (prefs) => {
        this.form.patchValue({
          language: prefs.language || 'es',
          highContrast: !!prefs.highContrast,
          fontSize: prefs.fontSize || 'medium',
          screenReader: !!prefs.screenReader,
          reducedMotion: !!prefs.reducedMotion,
          keyboardNavigation: prefs.keyboardNavigation !== false,
          readerMode: !!prefs.readerMode,
          notificationsEnabled: prefs.notificationsEnabled !== false,
          voiceCommandsEnabled: !!prefs.voiceCommandsEnabled,
          ttsEnabled: !!prefs.ttsEnabled,
          voiceLanguage: prefs.voiceLanguage || 'es-ES',
          disabilityType: prefs.disabilityType || ''
        });
        this.applyLocalUi();
      },
      error: (error) => {
        this.errorMessage = error?.error?.message || 'No se pudieron cargar preferencias.';
      }
    });
  }

  get fixedSidebar(): boolean {
    return this.session.getPrimaryRole() !== 'USUARIO';
  }

  save(): void {
    this.preferencesApi.updatePreferences(this.form.value).subscribe({
      next: () => {
        this.message = 'Preferencias guardadas.';
        this.errorMessage = null;
        this.applyLocalUi();
      },
      error: (error) => {
        this.message = null;
        this.errorMessage = error?.error?.message || 'No se pudieron guardar.';
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
