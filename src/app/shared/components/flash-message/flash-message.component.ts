import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';

import { FlashMessage, FlashMessageService } from '@shared/services/flash-message.service';

@Component({
  selector: 'app-flash-message',
  templateUrl: './flash-message.component.html',
  styleUrl: './flash-message.component.scss'
})
export class FlashMessageComponent implements OnInit, OnDestroy {
  message: FlashMessage | null = null;
  private sub: Subscription | null = null;

  constructor(
    private flash: FlashMessageService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.sub = this.flash.current$.subscribe((message) => {
      this.message = message;
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  dismiss(): void {
    this.flash.dismiss();
  }
}
