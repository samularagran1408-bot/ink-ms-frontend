import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  ViewEncapsulation
} from '@angular/core';
import { BodyChart, BodyState, ViewSide } from 'body-muscles';

import { BodyMapData } from '../../../core/models/body-map';
import { bodyStateDesdeMapa } from './body-map-zones';

@Component({
  selector: 'app-body-map',
  templateUrl: './body-map.component.html',
  styleUrl: './body-map.component.scss',
  encapsulation: ViewEncapsulation.ShadowDom
})
export class BodyMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() mapa: BodyMapData | null = null;
  @Input() compact = false;

  @ViewChild('frenteChart') frenteEl?: ElementRef<HTMLElement>;
  @ViewChild('espaldaChart') espaldaEl?: ElementRef<HTMLElement>;

  private frente?: BodyChart;
  private espalda?: BodyChart;

  constructor(private zone: NgZone) {}

  ngAfterViewInit(): void {
    this.crearCharts();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['mapa'] && !changes['mapa'].firstChange) {
      this.syncState();
    }
  }

  ngOnDestroy(): void {
    this.destruirCharts();
  }

  get etiquetas(): string[] {
    return this.mapa?.etiquetas || [];
  }

  get nota(): string {
    return this.mapa?.nota || '';
  }

  get limitacion(): string {
    return (this.mapa?.limitacion || '').trim();
  }

  private crearCharts(): void {
    const frenteHost = this.frenteEl?.nativeElement;
    const espaldaHost = this.espaldaEl?.nativeElement;
    if (!frenteHost || !espaldaHost) {
      return;
    }

    const bodyState = bodyStateDesdeMapa(this.mapa);
    this.zone.runOutsideAngular(() => {
      this.frente = new BodyChart(frenteHost, {
        view: ViewSide.FRONT,
        bodyState,
        showViewLabel: false,
        ariaLabel: 'Vista frontal del cuerpo'
      });
      this.espalda = new BodyChart(espaldaHost, {
        view: ViewSide.BACK,
        bodyState,
        showViewLabel: false,
        ariaLabel: 'Vista posterior del cuerpo'
      });
    });
  }

  private syncState(): void {
    const bodyState: BodyState = bodyStateDesdeMapa(this.mapa);
    this.zone.runOutsideAngular(() => {
      this.frente?.update({ bodyState });
      this.espalda?.update({ bodyState });
    });
  }

  private destruirCharts(): void {
    this.zone.runOutsideAngular(() => {
      this.frente?.destroy();
      this.espalda?.destroy();
    });
    this.frente = undefined;
    this.espalda = undefined;
  }
}
