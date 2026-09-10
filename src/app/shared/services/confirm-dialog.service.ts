import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ConfirmTone = 'primary' | 'danger' | 'success';
export type ConfirmVariant = 'confirm' | 'ack';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  variant?: ConfirmVariant;
}

export interface ConfirmState extends Required<Omit<ConfirmOptions, 'tone' | 'variant'>> {
  tone: ConfirmTone;
  variant: ConfirmVariant;
}

@Injectable({
  providedIn: 'root'
})
export class ConfirmDialogService {
  private pending: ((value: boolean) => void) | null = null;
  readonly state$ = new BehaviorSubject<ConfirmState | null>(null);

  constructor(private zone: NgZone) {}

  ask(options: ConfirmOptions): Promise<boolean> {
    if (this.pending) {
      this.pending(false);
      this.pending = null;
    }

    const variant: ConfirmVariant = options.variant || 'confirm';
    const tone: ConfirmTone = options.tone || (variant === 'ack' ? 'success' : 'primary');

    return new Promise((resolve) => {
      this.zone.run(() => {
        this.pending = resolve;
        this.state$.next({
          title: options.title,
          message: options.message,
          confirmLabel: options.confirmLabel || (variant === 'ack' ? 'Entendido' : 'Confirmar'),
          cancelLabel: options.cancelLabel || 'Cancelar',
          tone,
          variant
        });
      });
    });
  }

  ack(options: ConfirmOptions): Promise<boolean> {
    return this.ask({
      ...options,
      variant: 'ack',
      tone: options.tone || 'success',
      confirmLabel: options.confirmLabel || 'Entendido'
    });
  }

  resolve(result: boolean): void {
    this.zone.run(() => {
      const pending = this.pending;
      this.pending = null;
      this.state$.next(null);
      pending?.(result);
    });
  }
}
