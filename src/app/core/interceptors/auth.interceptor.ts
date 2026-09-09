import { Injectable } from '@angular/core';
import {
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest
} from '@angular/common/http';
import { Observable } from 'rxjs';

import { SessionService } from '../services/session.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(private session: SessionService) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const token = this.session.getToken();
    let headers = req.headers;

    if (this.shouldBypassCache(req)) {
      const noCacheHeaders = {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        Pragma: 'no-cache'
      };
      Object.entries(noCacheHeaders).forEach(([key, value]) => {
        if (!headers.has(key)) {
          headers = headers.set(key, value);
        }
      });
    }

    if (token && !headers.has('Authorization')) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }

    return next.handle(req.clone({ headers }));
  }

  private shouldBypassCache(req: HttpRequest<unknown>): boolean {
    if (this.isStaticAsset(req.url)) {
      return false;
    }
    const method = req.method.toUpperCase();
    return method !== 'GET' && method !== 'HEAD';
  }

  private isStaticAsset(url: string): boolean {
    return url.includes('/assets/');
  }
}
