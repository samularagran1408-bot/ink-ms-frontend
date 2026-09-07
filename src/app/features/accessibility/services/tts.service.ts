import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

import { AppNotification, Preference } from '../models/accessibility-api';

@Injectable({
  providedIn: 'root'
})
export class TtsService {
  private voiceCommandsEnabled = false;
  private ttsEnabled = false;
  private notificationsEnabled = true;
  private voiceLanguage = 'es-ES';
  private unlocked = false;
  private playingId: string | null = null;
  private readonly spokenIds = new Set<string>();
  private readonly prefsSubject = new BehaviorSubject<{
    voiceCommandsEnabled: boolean;
    ttsEnabled: boolean;
    notificationsEnabled: boolean;
    voiceLanguage: string;
  }>({
    voiceCommandsEnabled: false,
    ttsEnabled: false,
    notificationsEnabled: true,
    voiceLanguage: 'es-ES'
  });
  private readonly playingIdSubject = new BehaviorSubject<string | null>(null);

  readonly preferences$ = this.prefsSubject.asObservable();
  readonly playingId$ = this.playingIdSubject.asObservable();

  applyPreferences(prefs: Partial<Preference> | null | undefined): void {
    if (!prefs) {
      return;
    }
    this.voiceCommandsEnabled = !!prefs.voiceCommandsEnabled;
    this.ttsEnabled = !!prefs.ttsEnabled;
    this.notificationsEnabled = prefs.notificationsEnabled !== false;
    if (prefs.voiceLanguage) {
      this.voiceLanguage = prefs.voiceLanguage;
    }
    this.prefsSubject.next({
      voiceCommandsEnabled: this.voiceCommandsEnabled,
      ttsEnabled: this.ttsEnabled,
      notificationsEnabled: this.notificationsEnabled,
      voiceLanguage: this.voiceLanguage
    });
  }

  /** Audio de notificaciones activo: TTS + notificaciones habilitadas. */
  get isAudioNotificationsActive(): boolean {
    return this.ttsEnabled && this.notificationsEnabled && this.isSupported;
  }

  /** Canal visual (lista, badge y toast) cuando las notificaciones están activas. */
  get isVisualNotificationsActive(): boolean {
    return this.notificationsEnabled;
  }

  get isVoiceCommandsEnabled(): boolean {
    return this.voiceCommandsEnabled;
  }

  get currentVoiceLanguage(): string {
    return this.voiceLanguage;
  }

  get currentPlayingId(): string | null {
    return this.playingId;
  }

  get isSupported(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window;
  }

  /** Los navegadores suelen exigir un gesto del usuario antes de reproducir audio. */
  unlock(): void {
    if (this.unlocked || !this.isSupported) {
      return;
    }
    this.unlocked = true;
    try {
      window.speechSynthesis.cancel();
      const warmUp = new SpeechSynthesisUtterance(' ');
      warmUp.volume = 0;
      warmUp.lang = this.voiceLanguage;
      window.speechSynthesis.speak(warmUp);
      window.speechSynthesis.cancel();
    } catch {
      // Ignorar errores de warm-up.
    }
  }

  stop(): void {
    if (!this.isSupported) {
      return;
    }
    window.speechSynthesis.cancel();
    this.setPlayingId(null);
  }

  speak(text: string, options?: { force?: boolean; notificationId?: string }): void {
    const content = (text || '').trim();
    if (!content || !this.isSupported) {
      return;
    }
    if (!options?.force && !this.isAudioNotificationsActive) {
      return;
    }

    this.unlock();
    window.speechSynthesis.cancel();
    this.setPlayingId(options?.notificationId || null);

    const utterance = new SpeechSynthesisUtterance(content);
    utterance.lang = this.voiceLanguage;
    utterance.rate = 1;
    utterance.pitch = 1;
    const voice = this.pickVoice(this.voiceLanguage);
    if (voice) {
      utterance.voice = voice;
    }
    utterance.onend = () => {
      this.setPlayingId(null);
    };
    utterance.onerror = () => {
      this.setPlayingId(null);
    };
    window.speechSynthesis.speak(utterance);
  }

  speakNotification(note: AppNotification, options?: { force?: boolean; skipIfSpoken?: boolean }): void {
    if (!note) {
      return;
    }
    if (options?.skipIfSpoken !== false && note.id && this.spokenIds.has(note.id)) {
      return;
    }
    const parts = [note.title, note.body].filter((part) => !!part && String(part).trim());
    if (!parts.length) {
      return;
    }
    this.speak(parts.join('. '), { ...options, notificationId: note.id });
    if (note.id) {
      this.spokenIds.add(note.id);
    }
  }

  announceNotifications(
    notes: AppNotification[],
    options?: { onlyUnread?: boolean; force?: boolean; markSpoken?: boolean }
  ): void {
    const list = (notes || []).filter((note) => {
      if (options?.onlyUnread && note.read) {
        return false;
      }
      if (options?.markSpoken !== false && note.id && this.spokenIds.has(note.id)) {
        return false;
      }
      return true;
    });

    if (!list.length) {
      return;
    }

    const separator = this.voiceLanguage.toLowerCase().startsWith('en')
      ? '. Next alert: '
      : '. Siguiente aviso: ';

    const text = list
      .map((note) => [note.title, note.body].filter(Boolean).join('. '))
      .filter(Boolean)
      .join(separator);

    this.speak(text, { force: options?.force, notificationId: list[0]?.id });

    if (options?.markSpoken !== false) {
      list.forEach((note) => {
        if (note.id) {
          this.spokenIds.add(note.id);
        }
      });
    }
  }

  wasSpoken(notificationId: string | undefined | null): boolean {
    return !!notificationId && this.spokenIds.has(notificationId);
  }

  clearSpokenHistory(): void {
    this.spokenIds.clear();
  }

  private setPlayingId(id: string | null): void {
    this.playingId = id;
    this.playingIdSubject.next(id);
  }

  private pickVoice(lang: string): SpeechSynthesisVoice | null {
    try {
      const voices = window.speechSynthesis.getVoices() || [];
      if (!voices.length) {
        return null;
      }
      const exact = voices.find((v) => v.lang === lang);
      if (exact) {
        return exact;
      }
      const prefix = lang.split('-')[0].toLowerCase();
      return voices.find((v) => v.lang.toLowerCase().startsWith(prefix)) || null;
    } catch {
      return null;
    }
  }
}
