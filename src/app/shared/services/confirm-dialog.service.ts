import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'primary' | 'danger';
}

export interface ConfirmState extends Required<Omit<ConfirmOptions, 'tone'>> {
  tone: 'primary' | 'danger';
}

@Injectable({
  providedIn: 'root'
})
export class ConfirmDialogService {
  private pending: ((value: boolean) => void) | null = null;
  readonly state$ = new BehaviorSubject<ConfirmState | null>(null);

  ask(options: ConfirmOptions): Promise<boolean> {
    if (this.pending) {
      this.pending(false);
      this.pending = null;
    }

    return new Promise((resolve) => {
      this.pending = resolve;
      this.state$.next({
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel || 'Confirmar',
        cancelLabel: options.cancelLabel || 'Cancelar',
        tone: options.tone || 'primary'
      });
    });
  }

  resolve(result: boolean): void {
    const pending = this.pending;
    this.pending = null;
    this.state$.next(null);
    pending?.(result);
  }
}
