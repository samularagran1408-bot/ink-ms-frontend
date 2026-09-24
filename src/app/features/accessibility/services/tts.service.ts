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
  private speakTimer: ReturnType<typeof setTimeout> | null = null;
  private resumeWatch: ReturnType<typeof setInterval> | null = null;
  private audioCtx: AudioContext | null = null;
  private voicesHooked = false;
  /** Texto pendiente hasta el primer gesto (obligatorio en iOS/Android). */
  private pendingSpeak: { text: string; notificationId?: string; force?: boolean } | null = null;
  private readonly spokenIds = new Set<string>();
  private readonly unlockedSubject = new BehaviorSubject<boolean>(false);
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
  readonly unlocked$ = this.unlockedSubject.asObservable();

  applyPreferences(prefs: Partial<Preference> | null | undefined): void {
    if (!prefs) {
      return;
    }
    this.voiceCommandsEnabled = !!prefs.voiceCommandsEnabled;
    this.ttsEnabled = !!prefs.ttsEnabled;
    this.notificationsEnabled = prefs.notificationsEnabled !== false;
    if (prefs.language) {
      this.voiceLanguage = prefs.language.toLowerCase().startsWith('en') ? 'en-US' : 'es-ES';
    } else if (prefs.voiceLanguage) {
      this.voiceLanguage = prefs.voiceLanguage.toLowerCase().startsWith('en') ? 'en-US' : 'es-ES';
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

  /** True tras el primer toque/clic del usuario (requisito móvil). */
  get isUnlocked(): boolean {
    return this.unlocked;
  }

  /** Hay un aviso en cola esperando el gesto para sonar. */
  get hasPendingSpeak(): boolean {
    return !!this.pendingSpeak;
  }

  /**
   * Desbloquea audio con un gesto del usuario.
   * Después de esto, los avisos nuevos deben sonar solos (como en PC).
   */
  unlock(): void {
    this.ensureVoicesHook();
    const firstUnlock = !this.unlocked;
    this.unlocked = true;
    this.unlockedSubject.next(true);
    this.resumeAudio();
    this.primeSpeechEngine();
    this.startResumeWatch();

    if (!this.isSupported) {
      this.flushPendingSpeak();
      return;
    }

    if (firstUnlock) {
      try {
        // Volumen mínimo (no 0): iOS a veces ignora utterances silenciosos.
        const warmUp = new SpeechSynthesisUtterance(' ');
        warmUp.volume = 0.01;
        warmUp.rate = 2;
        warmUp.lang = this.voiceLanguage;
        this.resumeSpeechEngine();
        window.speechSynthesis.speak(warmUp);
      } catch {
        // Ignorar errores de warm-up.
      }
    }

    this.flushPendingSpeak();
  }

  /** Pitido corto para avisar aunque el texto a voz esté bloqueado. */
  playAlertChime(): void {
    if (!this.unlocked) {
      return;
    }
    this.resumeAudio();
    const ctx = this.audioCtx;
    if (!ctx) {
      return;
    }
    try {
      const now = ctx.currentTime;
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, now);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.09, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.3);
    } catch {
      // Sin audio de alerta.
    }
  }

  stop(): void {
    if (this.speakTimer) {
      clearTimeout(this.speakTimer);
      this.speakTimer = null;
    }
    this.pendingSpeak = null;
    if (!this.isSupported) {
      return;
    }
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
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

    if (!this.unlocked) {
      this.pendingSpeak = {
        text: content,
        notificationId: options?.notificationId,
        force: options?.force
      };
      return;
    }

    this.enqueueSpeak(content, options?.notificationId);
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
    const text = parts.join('. ');
    if (!this.unlocked) {
      this.pendingSpeak = {
        text,
        notificationId: note.id,
        force: options?.force
      };
      return;
    }
    this.speak(text, { ...options, notificationId: note.id });
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

    if (this.unlocked && options?.markSpoken !== false) {
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

  private flushPendingSpeak(): void {
    if (!this.pendingSpeak) {
      return;
    }
    const pending = this.pendingSpeak;
    this.pendingSpeak = null;
    if (!pending.force && !this.isAudioNotificationsActive) {
      return;
    }
    this.enqueueSpeak(pending.text, pending.notificationId);
    if (pending.notificationId) {
      this.spokenIds.add(pending.notificationId);
    }
  }

  private enqueueSpeak(content: string, notificationId?: string): void {
    if (this.speakTimer) {
      clearTimeout(this.speakTimer);
      this.speakTimer = null;
    }

    this.setPlayingId(notificationId || null);
    this.resumeAudio();
    this.resumeSpeechEngine();

    // Ya desbloqueado: reproducir al llegar el aviso (mismo comportamiento que PC).
    // En móvil evitamos delays; en desktop un pequeño gap evita solapar utterances.
    const delayMs = this.isMobileLike() ? 0 : 60;
    const run = () => {
      this.speakTimer = null;
      this.resumeSpeechEngine();

      // Si hay algo hablando, cortar y seguir (iOS necesita resume tras cancel).
      try {
        if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
          window.speechSynthesis.cancel();
          this.resumeSpeechEngine();
        }
      } catch {
        // ignore
      }

      const utterance = new SpeechSynthesisUtterance(content);
      utterance.lang = this.voiceLanguage;
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 1;
      const voice = this.pickVoice(this.voiceLanguage);
      if (voice) {
        utterance.voice = voice;
      }
      utterance.onend = () => {
        this.setPlayingId(null);
        this.resumeSpeechEngine();
      };
      utterance.onerror = () => {
        this.setPlayingId(null);
        this.resumeSpeechEngine();
        // Reintento único: iOS a veces falla el primer speak tras poll async.
        this.speakTimer = setTimeout(() => {
          this.speakTimer = null;
          this.resumeSpeechEngine();
          try {
            const retry = new SpeechSynthesisUtterance(content);
            retry.lang = this.voiceLanguage;
            retry.volume = 1;
            const retryVoice = this.pickVoice(this.voiceLanguage);
            if (retryVoice) {
              retry.voice = retryVoice;
            }
            retry.onend = () => this.setPlayingId(null);
            retry.onerror = () => this.setPlayingId(null);
            window.speechSynthesis.speak(retry);
          } catch {
            this.setPlayingId(null);
          }
        }, 180);
      };

      try {
        window.speechSynthesis.speak(utterance);
        // Safari a veces deja el motor en paused justo al encolar.
        this.resumeSpeechEngine();
      } catch {
        this.setPlayingId(null);
      }
    };

    if (delayMs <= 0) {
      run();
    } else {
      this.speakTimer = setTimeout(run, delayMs);
    }
  }

  /** iOS: speechSynthesis se queda en paused y deja de leer avisos nuevos. */
  private resumeSpeechEngine(): void {
    if (!this.isSupported) {
      return;
    }
    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    } catch {
      // ignore
    }
  }

  private startResumeWatch(): void {
    if (this.resumeWatch || typeof window === 'undefined') {
      return;
    }
    this.resumeWatch = setInterval(() => this.resumeSpeechEngine(), 2500);
  }

  private primeSpeechEngine(): void {
    this.resumeSpeechEngine();
    try {
      void window.speechSynthesis?.getVoices();
    } catch {
      // ignore
    }
  }

  private isMobileLike(): boolean {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return false;
    }
    return (
      window.matchMedia('(pointer: coarse)').matches
      || window.matchMedia('(max-width: 700px)').matches
      || /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || '')
    );
  }

  private setPlayingId(id: string | null): void {
    this.playingId = id;
    this.playingIdSubject.next(id);
  }

  private ensureVoicesHook(): void {
    if (this.voicesHooked || !this.isSupported) {
      return;
    }
    this.voicesHooked = true;
    try {
      window.speechSynthesis.addEventListener('voiceschanged', () => undefined);
      void window.speechSynthesis.getVoices();
    } catch {
      // ignore
    }
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

  private resumeAudio(): void {
    if (!this.unlocked || typeof window === 'undefined') {
      return;
    }
    try {
      const AudioCtx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) {
        return;
      }
      if (!this.audioCtx) {
        this.audioCtx = new AudioCtx();
      }
      if (this.audioCtx.state === 'suspended') {
        void this.audioCtx.resume().catch(() => undefined);
      }
    } catch {
      // Sin Web Audio.
    }
  }
}
