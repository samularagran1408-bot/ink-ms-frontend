import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, DetachedRouteHandle, RouteReuseStrategy } from '@angular/router';

/**
 * Mantiene las páginas del panel vivas al cambiar de sección del sidebar.
 * Evita volver a crear el componente y a pedir los mismos datos.
 *
 * Importante: los query params (p. ej. ?vista=historial) NO deben forzar
 * detach/attach del padre ni del hijo. Si shouldReuseRoute compara query,
 * Angular recrea PanelShell y reengancha handles viejos → la URL dice
 * /home/events pero el outlet muestra Inicio u otra vista cacheada.
 */
@Injectable()
export class PanelRouteReuseStrategy implements RouteReuseStrategy {
  private readonly stored = new Map<string, DetachedRouteHandle>();
  private readonly maxStored = 8;

  clear(): void {
    this.stored.clear();
  }

  shouldDetach(route: ActivatedRouteSnapshot): boolean {
    return this.isPanelLeaf(route);
  }

  store(route: ActivatedRouteSnapshot, handle: DetachedRouteHandle | null): void {
    if (!handle || !this.isPanelLeaf(route)) {
      return;
    }
    const key = this.key(route);
    if (!key) {
      return;
    }
    this.stored.set(key, handle);
    while (this.stored.size > this.maxStored) {
      const oldest = this.stored.keys().next().value;
      if (oldest === undefined) {
        break;
      }
      this.stored.delete(oldest);
    }
  }

  shouldAttach(route: ActivatedRouteSnapshot): boolean {
    const key = this.key(route);
    return !!key && this.stored.has(key);
  }

  retrieve(route: ActivatedRouteSnapshot): DetachedRouteHandle | null {
    const key = this.key(route);
    const handle = key ? this.stored.get(key) ?? null : null;
    const detached = handle as { componentRef?: { changeDetectorRef?: { markForCheck(): void } } } | null;
    detached?.componentRef?.changeDetectorRef?.markForCheck();
    return handle;
  }

  shouldReuseRoute(future: ActivatedRouteSnapshot, curr: ActivatedRouteSnapshot): boolean {
    // Solo path params: mismo routeConfig + mismos :params → reutilizar.
    // Los query params los maneja el componente (queryParamMap).
    return future.routeConfig === curr.routeConfig && this.samePathParams(future, curr);
  }

  private isPanelLeaf(route: ActivatedRouteSnapshot): boolean {
    if (route.firstChild || !route.routeConfig) {
      return false;
    }
    const path = this.path(route);
    if (!path || path === 'login' || path === 'register' || path === 'guest' || path === 'welcome') {
      return false;
    }
    return path.startsWith('home')
      || path.startsWith('admin')
      || path.startsWith('trainer')
      || path.startsWith('organizer')
      || path.startsWith('asistencia');
  }

  /**
   * Incluye query para cachear catalog vs historial por separado al salir
   * del panel. Entre ambos, shouldReuseRoute reutiliza in-place y no detach.
   */
  private key(route: ActivatedRouteSnapshot): string {
    const path = this.path(route);
    if (!path) {
      return '';
    }
    const query = route.queryParamMap.keys
      .map((name) => `${name}=${route.queryParamMap.get(name) || ''}`)
      .join('&');
    return query ? `${path}?${query}` : path;
  }

  private path(route: ActivatedRouteSnapshot): string {
    return route.pathFromRoot
      .map((item) => item.url.map((seg) => seg.path).join('/'))
      .filter(Boolean)
      .join('/');
  }

  private samePathParams(a: ActivatedRouteSnapshot, b: ActivatedRouteSnapshot): boolean {
    return JSON.stringify(a.params) === JSON.stringify(b.params);
  }
}
