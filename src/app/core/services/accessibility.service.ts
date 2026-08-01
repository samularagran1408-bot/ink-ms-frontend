import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AccessibilityService {
  private readonly highContrastSubject = new BehaviorSubject<boolean>(false);
  private readonly fontOffsetSubject = new BehaviorSubject<number>(0);

  readonly highContrast$ = this.highContrastSubject.asObservable();
  readonly fontOffset$ = this.fontOffsetSubject.asObservable();

  private readonly maxFontOffset = 4;
  private readonly minFontOffset = -2;

  toggleContrast(): void {
    this.highContrastSubject.next(!this.highContrastSubject.value);
  }

  increaseFont(): void {
    if (this.fontOffsetSubject.value < this.maxFontOffset) {
      this.fontOffsetSubject.next(this.fontOffsetSubject.value + 1);
    }
  }

  decreaseFont(): void {
    if (this.fontOffsetSubject.value > this.minFontOffset) {
      this.fontOffsetSubject.next(this.fontOffsetSubject.value - 1);
    }
  }

  resetFont(): void {
    this.fontOffsetSubject.next(0);
  }
}
