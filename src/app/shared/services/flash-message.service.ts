import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type FlashKind = 'error' | 'warning' | 'info' | 'success';

export interface FlashMessage {
  kind: FlashKind;
  title: string;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class FlashMessageService {
  readonly current$ = new BehaviorSubject<FlashMessage | null>(null);
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private zone: NgZone) {}

  show(kind: FlashKind, title: string, message: string, durationMs = 7000): void {
    this.clearTimer();
    this.zone.run(() => this.current$.next({ kind, title, message }));
    if (durationMs > 0) {
      this.timer = setTimeout(() => this.dismiss(), durationMs);
    }
  }

  error(title: string, message: string): void {
    this.show('error', title, message);
  }

  warning(title: string, message: string): void {
    this.show('warning', title, message);
  }

  info(title: string, message: string): void {
    this.show('info', title, message);
  }

  success(title: string, message: string): void {
    this.show('success', title, message);
  }

  dismiss(): void {
    this.clearTimer();
    this.zone.run(() => this.current$.next(null));
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
