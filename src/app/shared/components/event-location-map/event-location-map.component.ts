import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild
} from '@angular/core';

import { GoogleMapsLoaderService } from '../../../core/services/google-maps-loader.service';
import { googleMapsDirectionsUrl } from '../../../core/utils/maps.util';

@Component({
  selector: 'app-event-location-map',
  templateUrl: './event-location-map.component.html',
  styleUrl: './event-location-map.component.scss'
})
export class EventLocationMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() location: string | null | undefined;
  @Input() latitude: number | null | undefined;
  @Input() longitude: number | null | undefined;
  @Input() compact = false;

  @ViewChild('mapHost') mapHost?: ElementRef<HTMLDivElement>;

  mapsReady = false;
  private map: google.maps.Map | null = null;
  private marker: google.maps.Marker | null = null;

  constructor(private mapsLoader: GoogleMapsLoaderService) {}

  get directionsUrl(): string | null {
    return googleMapsDirectionsUrl({
      location: this.location,
      latitude: this.latitude,
      longitude: this.longitude
    });
  }

  get hasCoords(): boolean {
    return this.latitude != null && this.longitude != null
      && !Number.isNaN(this.latitude) && !Number.isNaN(this.longitude);
  }

  get hasLocation(): boolean {
    return !!this.location?.trim() || this.hasCoords;
  }

  ngAfterViewInit(): void {
    void this.init();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['latitude'] || changes['longitude'] || changes['location']) {
      if (this.hasCoords && !this.mapsReady) {
        void this.init();
      } else {
        this.renderMap();
      }
    }
  }

  ngOnDestroy(): void {
    this.marker?.setMap(null);
    this.map = null;
    this.marker = null;
  }

  private async init(): Promise<void> {
    if (!this.hasCoords) {
      return;
    }
    const ok = await this.mapsLoader.ensureLoaded();
    this.mapsReady = ok;
    if (ok) {
      setTimeout(() => this.renderMap(), 0);
    }
  }

  private renderMap(): void {
    if (!this.mapsReady || !this.hasCoords || !this.mapHost?.nativeElement || !window.google?.maps) {
      return;
    }
    const center = { lat: this.latitude as number, lng: this.longitude as number };
    if (!this.map) {
      this.map = new google.maps.Map(this.mapHost.nativeElement, {
        center,
        zoom: 15,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: this.compact ? false : true,
        zoomControl: true
      });
      this.marker = new google.maps.Marker({
        map: this.map,
        position: center,
        title: this.location || 'Evento'
      });
    } else {
      this.map.setCenter(center);
      this.marker?.setPosition(center);
    }
  }
}
