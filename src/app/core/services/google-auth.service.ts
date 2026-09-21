import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, from, of, throwError } from 'rxjs';
import { map, switchMap, catchError, shareReplay } from 'rxjs/operators';

interface RuntimeConfig {
  googleMapsApiKey?: string;
  googleClientId?: string;
}

export type GoogleCredentialCallback = (credential: string) => void;

declare global {
  interface Window {
    google?: {
      accounts?: {
        id: {
          initialize(config: {
            client_id: string;
            callback: (response: { credential?: string }) => void;
            auto_select?: boolean;
            ux_mode?: string;
            context?: string;
          }): void;
          renderButton(
            parent: HTMLElement,
            options: Record<string, string | number>
          ): void;
          prompt(): void;
          cancel(): void;
        };
      };
    };
  }
}

/**
 * Google Identity Services: carga el SDK, lee Client ID de assets/config.json
 * y monta el botón / obtiene el ID token para POST /api/auth/google.
 */
@Injectable({ providedIn: 'root' })
export class GoogleAuthService {
  private config$?: Observable<string>;
  private scriptPromise?: Promise<void>;
  private initializedFor?: string;

  constructor(private readonly http: HttpClient) {}

  getClientId(): Observable<string> {
    if (!this.config$) {
      this.config$ = this.http.get<RuntimeConfig>('assets/config.json').pipe(
        map((cfg) => (cfg.googleClientId || '').trim()),
        catchError(() => of('')),
        shareReplay(1)
      );
    }
    return this.config$;
  }

  isEnabled(): Observable<boolean> {
    return this.getClientId().pipe(map((id) => !!id));
  }

  /**
   * Inicializa GIS y pinta el botón oficial de Google en `host`.
   * Cada clic válido invoca `onCredential` con el ID token.
   */
  mountButton(host: HTMLElement, onCredential: GoogleCredentialCallback, width = 320): Observable<void> {
    return this.getClientId().pipe(
      switchMap((clientId) => {
        if (!clientId) {
          return throwError(() => new Error('GOOGLE_CLIENT_ID no configurado'));
        }
        return from(this.loadScript().then(() => this.doMount(host, clientId, onCredential, width)));
      })
    );
  }

  /** Alternativa: dispara el prompt One Tap / cuenta (útil desde un botón custom). */
  requestCredential(): Observable<string> {
    return this.getClientId().pipe(
      switchMap((clientId) => {
        if (!clientId) {
          return throwError(() => new Error('GOOGLE_CLIENT_ID no configurado'));
        }
        return from(this.loadScript().then(() => this.promptOnce(clientId)));
      })
    );
  }

  private doMount(
    host: HTMLElement,
    clientId: string,
    onCredential: GoogleCredentialCallback,
    width: number
  ): void {
    if (!window.google?.accounts?.id) {
      throw new Error('Google Identity Services no disponible');
    }

    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => {
        if (response?.credential) {
          onCredential(response.credential);
        }
      },
      ux_mode: 'popup',
      context: 'signin',
      auto_select: false,
    });
    this.initializedFor = clientId;

    host.innerHTML = '';
    window.google.accounts.id.renderButton(host, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text: 'continue_with',
      shape: 'rectangular',
      logo_alignment: 'left',
      width,
    });
  }

  private promptOnce(clientId: string): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!window.google?.accounts?.id) {
        reject(new Error('Google Identity Services no disponible'));
        return;
      }

      let done = false;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          if (done) {
            return;
          }
          done = true;
          if (response?.credential) {
            resolve(response.credential);
          } else {
            reject(new Error('Google no devolvió credential'));
          }
        },
        ux_mode: 'popup',
        context: 'signin',
        auto_select: false,
      });
      this.initializedFor = clientId;
      window.google.accounts.id.prompt();

      setTimeout(() => {
        if (!done) {
          done = true;
          reject(
            new Error(
              'No se completó el inicio con Google. Usa el botón de Google o revisa los orígenes autorizados en Google Cloud.'
            )
          );
        }
      }, 120000);
    });
  }

  private loadScript(): Promise<void> {
    if (window.google?.accounts?.id) {
      return Promise.resolve();
    }
    if (this.scriptPromise) {
      return this.scriptPromise;
    }

    this.scriptPromise = new Promise<void>((resolve, reject) => {
      const existing = document.getElementById('inkl-google-gsi') as HTMLScriptElement | null;
      if (existing) {
        if (window.google?.accounts?.id) {
          resolve();
          return;
        }
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('No se pudo cargar Google Identity Services')));
        return;
      }
      const script = document.createElement('script');
      script.id = 'inkl-google-gsi';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('No se pudo cargar Google Identity Services'));
      document.head.appendChild(script);
    });

    return this.scriptPromise;
  }
}
