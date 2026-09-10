import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';

import { ConfirmDialogService, ConfirmState } from '@shared/services/confirm-dialog.service';

@Component({
  selector: 'app-confirm-dialog',
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss'
})
export class ConfirmDialogComponent implements OnInit, OnDestroy {
  state: ConfirmState | null = null;
  private sub: Subscription | null = null;

  constructor(
    private confirm: ConfirmDialogService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.sub = this.confirm.state$.subscribe((state) => {
      this.state = state;
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.state) {
      this.cancel();
    }
  }

  confirmAction(): void {
    this.confirm.resolve(true);
  }

  cancel(): void {
    this.confirm.resolve(this.state?.variant === 'ack');
  }
}
