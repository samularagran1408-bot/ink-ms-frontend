import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ConfirmTone = 'primary' | 'danger' | 'success' | 'warning' | 'info';
export type ConfirmVariant = 'confirm' | 'ack';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
  variant?: ConfirmVariant;
  kindLabel?: string;
}

export interface ConfirmState extends Required<Omit<ConfirmOptions, 'tone' | 'variant' | 'kindLabel'>> {
  tone: ConfirmTone;
  variant: ConfirmVariant;
  kindLabel: string;
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
          variant,
          kindLabel: options.kindLabel || this.defaultKindLabel(tone, variant)
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

  error(options: ConfirmOptions): Promise<boolean> {
    return this.ack({ ...options, tone: 'danger', kindLabel: options.kindLabel || 'Error' });
  }

  warning(options: ConfirmOptions): Promise<boolean> {
    return this.ask({
      ...options,
      tone: 'warning',
      variant: options.variant || 'confirm',
      kindLabel: options.kindLabel || 'Advertencia'
    });
  }

  info(options: ConfirmOptions): Promise<boolean> {
    return this.ack({ ...options, tone: 'info', kindLabel: options.kindLabel || 'Información' });
  }

  private defaultKindLabel(tone: ConfirmTone, variant: ConfirmVariant): string {
    if (tone === 'danger' && variant === 'ack') {
      return 'Error';
    }
    if (tone === 'warning') {
      return 'Advertencia';
    }
    if (tone === 'info' || tone === 'success') {
      return 'Información';
    }
    return 'Confirmación';
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
