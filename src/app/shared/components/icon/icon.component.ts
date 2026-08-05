import { Component, Input } from '@angular/core';

import { HEROICON_OUTLINE_PATHS, HeroIconName } from '../../icons/heroicons-outline';

@Component({
  selector: 'app-icon',
  templateUrl: './icon.component.html',
  styleUrl: './icon.component.scss'
})
export class IconComponent {
  @Input({ required: true }) name!: HeroIconName;
  @Input() size: number | string = 20;
  @Input() strokeWidth: number | string = 1.5;
  /** Accessible label; if empty the icon is decorative (aria-hidden). */
  @Input() label = '';

  get paths(): readonly string[] {
    return HEROICON_OUTLINE_PATHS[this.name] || [];
  }

  get pixelSize(): string {
    return typeof this.size === 'number' ? `${this.size}px` : this.size;
  }
}
