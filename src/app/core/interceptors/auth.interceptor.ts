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
    if (!token || req.headers.has('Authorization')) {
      return next.handle(req);
    }

    return next.handle(
      req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`
        }
      })
    );
  }
}
