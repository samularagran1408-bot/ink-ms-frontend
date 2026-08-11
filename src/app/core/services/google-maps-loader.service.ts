import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

interface MapsRuntimeConfig {
  googleMapsApiKey?: string;
}

/**
 * Carga Maps JavaScript API (+ Places) una sola vez.
 * La API key vive en assets/config.json (local) o se inyecta en Docker.
 */
@Injectable({ providedIn: 'root' })
export class GoogleMapsLoaderService {
  private loadPromise: Promise<void> | null = null;
  private apiKey = '';

  constructor(private http: HttpClient) {}

  get hasApiKey(): boolean {
    return !!this.apiKey;
  }

  async ensureLoaded(): Promise<boolean> {
    if (typeof window === 'undefined') {
      return false;
    }
    if (window.google?.maps?.places) {
      return true;
    }
    if (!this.loadPromise) {
      this.loadPromise = this.loadScript();
    }
    try {
      await this.loadPromise;
      return !!window.google?.maps?.places;
    } catch {
      this.loadPromise = null;
      return false;
    }
  }

  private async loadScript(): Promise<void> {
    const cfg = await firstValueFrom(
      this.http.get<MapsRuntimeConfig>('assets/config.json')
    ).catch(() => ({} as MapsRuntimeConfig));

    this.apiKey = (cfg.googleMapsApiKey || '').trim();
    if (!this.apiKey) {
      throw new Error('GOOGLE_MAPS_API_KEY no configurada en assets/config.json');
    }

    if (window.google?.maps?.places) {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      const existing = document.getElementById('inkl-google-maps');
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('No se pudo cargar Google Maps')));
        return;
      }

      window.__inklMapsInit = () => resolve();

      const script = document.createElement('script');
      script.id = 'inkl-google-maps';
      script.async = true;
      script.defer = true;
      script.src =
        `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(this.apiKey)}` +
        `&libraries=places&language=es&region=CO&callback=__inklMapsInit`;
      script.onerror = () => reject(new Error('No se pudo cargar Google Maps'));
      document.head.appendChild(script);
    });
  }
}
