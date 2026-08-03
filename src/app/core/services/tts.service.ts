import { Injectable } from '@angular/core';

import { AppNotification, Preference } from '../models/accessibility-api';

@Injectable({
  providedIn: 'root'
})
export class TtsService {
  private ttsEnabled = false;
  private notificationsEnabled = true;
  private voiceLanguage = 'es-ES';
  private unlocked = false;
  private readonly spokenIds = new Set<string>();

  applyPreferences(prefs: Partial<Preference> | null | undefined): void {
    if (!prefs) {
      return;
    }
    this.ttsEnabled = !!prefs.ttsEnabled;
    this.notificationsEnabled = prefs.notificationsEnabled !== false;
    if (prefs.voiceLanguage) {
      this.voiceLanguage = prefs.voiceLanguage;
    }
  }

  get isAudioNotificationsActive(): boolean {
    return this.ttsEnabled && this.notificationsEnabled && this.isSupported;
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
      // Ignorar errores de warm-up; el siguiente speak reintentará.
    }
  }

  stop(): void {
    if (!this.isSupported) {
      return;
    }
    window.speechSynthesis.cancel();
  }

  speak(text: string, options?: { force?: boolean }): void {
    const content = (text || '').trim();
    if (!content || !this.isSupported) {
      return;
    }
    if (!options?.force && !this.isAudioNotificationsActive) {
      return;
    }

    this.unlock();
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(content);
    utterance.lang = this.voiceLanguage;
    utterance.rate = 1;
    utterance.pitch = 1;
    const voice = this.pickVoice(this.voiceLanguage);
    if (voice) {
      utterance.voice = voice;
    }
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
    this.speak(parts.join('. '), options);
    if (note.id) {
      this.spokenIds.add(note.id);
    }
  }

  /**
   * Encola varias notificaciones (p. ej. no leídas) en orden.
   * Usa una sola utterance concatenada para evitar cortes entre piezas.
   */
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

    const text = list
      .map((note) => [note.title, note.body].filter(Boolean).join('. '))
      .filter(Boolean)
      .join('. Siguiente aviso: ');

    this.speak(text, { force: options?.force });

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
