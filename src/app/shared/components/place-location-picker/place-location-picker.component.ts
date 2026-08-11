import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild
} from '@angular/core';

import { GoogleMapsLoaderService } from '../../../core/services/google-maps-loader.service';
import { EventPlaceLocation } from '../../../core/utils/maps.util';

@Component({
  selector: 'app-place-location-picker',
  templateUrl: './place-location-picker.component.html',
  styleUrl: './place-location-picker.component.scss'
})
export class PlaceLocationPickerComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() address = '';
  @Input() latitude: number | null = null;
  @Input() longitude: number | null = null;
  @Input() label = 'Ubicación';
  @Input() placeholder = 'Busca una dirección o lugar…';
  @Input() country = 'co';

  @Output() placeChange = new EventEmitter<EventPlaceLocation>();

  @ViewChild('searchInput') searchInput?: ElementRef<HTMLInputElement>;
  @ViewChild('previewMap') previewMap?: ElementRef<HTMLDivElement>;

  mapsReady = false;
  mapsError: string | null = null;
  hint = 'Elige una sugerencia de Google para fijar el punto en el mapa.';

  private autocomplete: google.maps.places.Autocomplete | null = null;
  private placeListener: google.maps.MapsEventListener | null = null;
  private map: google.maps.Map | null = null;
  private marker: google.maps.Marker | null = null;

  constructor(private mapsLoader: GoogleMapsLoaderService) {}

  ngAfterViewInit(): void {
    void this.initMaps();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['latitude'] || changes['longitude'] || changes['address']) {
      this.renderPreview();
      if (this.searchInput?.nativeElement && this.address
          && this.searchInput.nativeElement.value !== this.address) {
        this.searchInput.nativeElement.value = this.address;
      }
    }
  }

  ngOnDestroy(): void {
    this.placeListener?.remove();
    this.placeListener = null;
    this.marker?.setMap(null);
    this.map = null;
    this.marker = null;
    this.autocomplete = null;
  }

  onManualInput(value: string): void {
    this.address = value;
    this.latitude = null;
    this.longitude = null;
    this.placeChange.emit({ address: value, latitude: null, longitude: null });
    this.renderPreview();
  }

  private async initMaps(): Promise<void> {
    const ok = await this.mapsLoader.ensureLoaded();
    if (!ok) {
      this.mapsError = 'Configura GOOGLE_MAPS_API_KEY en assets/config.json para usar el buscador de lugares.';
      this.mapsReady = false;
      return;
    }
    this.mapsReady = true;
    this.mapsError = null;
    this.bindAutocomplete();
    this.renderPreview();
  }

  private bindAutocomplete(): void {
    const input = this.searchInput?.nativeElement;
    if (!input || !window.google?.maps?.places || this.autocomplete) {
      return;
    }

    this.autocomplete = new google.maps.places.Autocomplete(input, {
      fields: ['formatted_address', 'geometry', 'name'],
      componentRestrictions: { country: this.country }
    });

    this.placeListener = this.autocomplete.addListener('place_changed', () => {
      const place = this.autocomplete?.getPlace();
      const loc = place?.geometry?.location;
      if (!loc) {
        this.hint = 'Selecciona una sugerencia de la lista (no solo texto libre).';
        return;
      }
      const address = place.formatted_address || place.name || input.value;
      this.address = address;
      this.latitude = loc.lat();
      this.longitude = loc.lng();
      this.hint = 'Ubicación fijada con Google Maps.';
      this.placeChange.emit({
        address,
        latitude: this.latitude,
        longitude: this.longitude
      });
      this.renderPreview();
    });
  }

  private renderPreview(): void {
    if (!this.mapsReady || !this.previewMap?.nativeElement || !window.google?.maps) {
      return;
    }
    if (this.latitude == null || this.longitude == null) {
      this.marker?.setMap(null);
      return;
    }

    const center = { lat: this.latitude, lng: this.longitude };
    if (!this.map) {
      this.map = new google.maps.Map(this.previewMap.nativeElement, {
        center,
        zoom: 15,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: true
      });
      this.marker = new google.maps.Marker({
        map: this.map,
        position: center,
        title: this.address || 'Ubicación del evento'
      });
    } else {
      this.map.setCenter(center);
      this.map.setZoom(15);
      if (!this.marker) {
        this.marker = new google.maps.Marker({ map: this.map, position: center });
      } else {
        this.marker.setPosition(center);
        this.marker.setMap(this.map);
      }
    }
  }
}
