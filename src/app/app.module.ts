import { NgModule, LOCALE_ID } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { CommonModule, registerLocaleData } from '@angular/common';
import { HTTP_INTERCEPTORS, HttpClient, HttpClientModule } from '@angular/common/http';
<<<<<<< Updated upstream
import { RouteReuseStrategy } from '@angular/router';
=======
import localeEsCO from '@angular/common/locales/es-CO';
>>>>>>> Stashed changes
import { TranslateLoader, TranslateModule } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { AuthInterceptor } from '@core/interceptors/auth.interceptor';
import { PanelRouteReuseStrategy } from '@core/routing/panel-route-reuse.strategy';
import { SharedModule } from './shared/shared.module';

registerLocaleData(localeEsCO);

export function httpLoaderFactory(http: HttpClient): TranslateHttpLoader {
  return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    CommonModule,
    AppRoutingModule,
    HttpClientModule,
    SharedModule,
    TranslateModule.forRoot({
      defaultLanguage: 'es',
      loader: {
        provide: TranslateLoader,
        useFactory: httpLoaderFactory,
        deps: [HttpClient]
      }
    })
  ],
  providers: [
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
<<<<<<< Updated upstream
    PanelRouteReuseStrategy,
    { provide: RouteReuseStrategy, useExisting: PanelRouteReuseStrategy }
=======
    { provide: LOCALE_ID, useValue: 'es-CO' }
>>>>>>> Stashed changes
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
