import { Component, Input } from '@angular/core';

import { BodyMapData } from '../../../core/models/body-map';

@Component({
  selector: 'app-body-map',
  templateUrl: './body-map.component.html',
  styleUrl: './body-map.component.scss'
})
export class BodyMapComponent {
  @Input() mapa: BodyMapData | null = null;
  @Input() compact = false;

  esDolor(zona: string): boolean {
    return (this.mapa?.zonas_dolor || []).includes(zona);
  }

  get etiquetas(): string[] {
    return this.mapa?.etiquetas || [];
  }

  get nota(): string {
    return this.mapa?.nota || 'Las zonas en rojo marcan el dolor o la limitación reportada.';
  }

  get limitacion(): string {
    return (this.mapa?.limitacion || '').trim();
  }
}
