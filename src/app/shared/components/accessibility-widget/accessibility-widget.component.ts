import { Component, OnDestroy } from '@angular/core';
import { AccessibilityService } from '../../../core/services/accessibility.service';
import { LanguageService } from '../../../core/services/language.service';

@Component({
  selector: 'app-accessibility-widget',
  templateUrl: './accessibility-widget.component.html',
  styleUrl: './accessibility-widget.component.scss'
})
export class AccessibilityWidgetComponent implements OnDestroy {
  isOpen = false;
  isClosing = false;

  private closeTimeoutId: ReturnType<typeof setTimeout> | undefined;
  private readonly closeAnimationMs = 200;

  constructor(
    public accessibilityService: AccessibilityService,
    private languageService: LanguageService
  ) {}

  ngOnDestroy(): void {
    if (this.closeTimeoutId) clearTimeout(this.closeTimeoutId);
  }

  toggleMenu(): void {
    if (this.isOpen) {
      this.isClosing = true;
      this.closeTimeoutId = setTimeout(() => {
        this.isOpen = false;
        this.isClosing = false;
      }, this.closeAnimationMs);
    } else {
      this.isOpen = true;
    }
  }

  toggleContrast(): void {
    this.accessibilityService.toggleContrast();
  }

  increaseFont(): void {
    this.accessibilityService.increaseFont();
  }

  decreaseFont(): void {
    this.accessibilityService.decreaseFont();
  }

  resetFont(): void {
    this.accessibilityService.resetFont();
  }

  toggleLanguage(): void {
    const next = this.languageService.currentLang === 'en' ? 'es' : 'en';
    this.accessibilityService.setLanguage(next, false);
  }
}
