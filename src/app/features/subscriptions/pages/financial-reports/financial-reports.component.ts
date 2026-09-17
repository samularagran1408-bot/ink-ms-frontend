import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { SubscriptionService } from '../../services/subscription.service';
import { SportsService } from '@features/sports-disabilities/services/sports.service';
import { ReporteEventoItem, ReporteFinancieroResponse } from '../../models/subscription-models';

interface DetalleEventoVista extends ReporteEventoItem {
  nombreEvento: string;
  sportName: string;
  location: string;
  maxCapacity: number | null;
}

type Atajo = '7d' | '30d' | 'trimestre' | 'anio';
type Orden = 'monto' | 'inscritos' | 'nombre';

/** M09 - Reportes financieros (RF62): propios (organizador) o globales (admin), según la ruta. */
@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  selector: 'app-financial-reports',
  templateUrl: './financial-reports.component.html',
  styleUrl: './financial-reports.component.scss'
})
export class FinancialReportsComponent implements OnInit {
  modo: 'own' | 'global' = 'own';

  reporte: ReporteFinancieroResponse | null = null;
  detalle: DetalleEventoVista[] = [];

  desde = '';
  hasta = '';
  atajo: Atajo = '30d';
  eventoFiltro = '';
  busqueda = '';
  orden: Orden = 'monto';

  cargando = true;
  error: string | null = null;
  ultimaActualizacion: Date | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly subscriptions: SubscriptionService,
    private readonly sports: SportsService,
  ) {}

  ngOnInit(): void {
    this.modo = this.route.snapshot.data['mode'] === 'global' ? 'global' : 'own';
    this.aplicarAtajo('30d');
  }

  aplicarAtajo(atajo: Atajo): void {
    this.atajo = atajo;
    const hoy = new Date();
    let desde = new Date(hoy);

    switch (atajo) {
      case '7d':
        desde.setDate(hoy.getDate() - 7);
        break;
      case 'trimestre':
        desde.setMonth(hoy.getMonth() - 3);
        break;
      case 'anio':
        desde = new Date(hoy.getFullYear(), 0, 1);
        break;
      default:
        desde.setDate(hoy.getDate() - 30);
    }

    this.desde = this.aIso(desde);
    this.hasta = this.aIso(hoy);
    this.cargar();
  }

  private aIso(fecha: Date): string {
    return fecha.toISOString().slice(0, 10);
  }

  cargar(): void {
    this.cargando = true;
    this.error = null;
    this.eventoFiltro = '';

    const peticion$ = this.modo === 'global'
      ? this.subscriptions.getReporteFinancieroGlobal(this.desde, this.hasta)
      : this.subscriptions.getReporteFinancieroPropio(this.desde, this.hasta);

    peticion$.subscribe({
      next: (reporte) => {
        this.reporte = reporte;
        this.ultimaActualizacion = new Date();
        this.resolverNombresEventos(reporte.detallePorEvento);
      },
      error: (err) => {
        this.cargando = false;
        this.error = err?.error?.message ?? 'No se pudo cargar el reporte financiero.';
      },
    });
  }

  private resolverNombresEventos(items: ReporteEventoItem[]): void {
    if (!items.length) {
      this.detalle = [];
      this.cargando = false;
      return;
    }

    const peticiones = items.map((item) =>
      this.sports.getEvent(item.eventoId).pipe(
        map((evento): DetalleEventoVista => ({
          ...item,
          nombreEvento: item.nombreEvento || evento.name,
          sportName: evento.sportName ?? '—',
          location: evento.location ?? 'Ubicación por definir',
          maxCapacity: evento.maxCapacity ?? null,
        })),
        catchError(() => of<DetalleEventoVista>({
          ...item,
          nombreEvento: item.nombreEvento || `Evento ${item.eventoId.slice(0, 8)}`,
          sportName: '—',
          location: '—',
          maxCapacity: null,
        })),
      )
    );

    forkJoin(peticiones).subscribe((detalle) => {
      this.detalle = detalle;
      this.cargando = false;
    });
  }

  get detalleFiltrado(): DetalleEventoVista[] {
    let items = this.detalle;

    if (this.eventoFiltro) {
      items = items.filter((d) => d.eventoId === this.eventoFiltro);
    }

    const texto = this.busqueda.trim().toLowerCase();
    if (texto) {
      items = items.filter((d) => d.nombreEvento.toLowerCase().includes(texto));
    }

    const ordenado = [...items];
    switch (this.orden) {
      case 'inscritos':
        ordenado.sort((a, b) => b.numeroInscritos - a.numeroInscritos);
        break;
      case 'nombre':
        ordenado.sort((a, b) => a.nombreEvento.localeCompare(b.nombreEvento));
        break;
      default:
        ordenado.sort((a, b) => b.montoTotal - a.montoTotal);
    }
    return ordenado;
  }

  get totalRecaudado(): number {
    return (this.reporte?.ingresosPorEventos ?? 0) + (this.reporte?.ingresosPorSuscripciones ?? 0);
  }

  get comisionTotalEstimada(): number {
    return this.detalle.reduce((acc, d) => acc + (d.comisionEstimada ?? 0), 0);
  }

  get promedioInscritosPorEvento(): number {
    if (!this.detalle.length) {
      return 0;
    }
    return Math.round(((this.reporte?.numeroInscritos ?? 0) / this.detalle.length) * 10) / 10;
  }

  get porcentajeEventos(): number {
    return this.totalRecaudado > 0
      ? Math.round(((this.reporte?.ingresosPorEventos ?? 0) / this.totalRecaudado) * 1000) / 10
      : 0;
  }

  get porcentajeSuscripciones(): number {
    return this.totalRecaudado > 0 ? Math.round((100 - this.porcentajeEventos) * 10) / 10 : 0;
  }

  porcentajeDelTotalEventos(monto: number): number {
    const base = this.reporte?.ingresosPorEventos ?? 0;
    return base > 0 ? Math.round((monto / base) * 1000) / 10 : 0;
  }

  porcentajeComision(item: DetalleEventoVista): number {
    return item.montoTotal > 0 ? Math.round((item.comisionEstimada / item.montoTotal) * 1000) / 10 : 0;
  }

  porcentajeAforo(item: DetalleEventoVista): number | null {
    if (!item.maxCapacity) {
      return null;
    }
    return Math.round((item.numeroInscritos / item.maxCapacity) * 100);
  }

  scrollArriba(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /** Exporta el desglose por evento actualmente cargado (real) a un CSV generado en el navegador. */
  exportarCsv(): void {
    const filas = this.detalleFiltrado;
    const encabezado = ['Evento', 'Disciplina', 'Inscritos', 'Monto Total (COP)', 'Comision Estimada (COP)'];
    const lineas = filas.map((d) => [
      d.nombreEvento,
      d.sportName,
      String(d.numeroInscritos),
      d.montoTotal.toFixed(2),
      d.comisionEstimada.toFixed(2),
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
    const csv = [encabezado.join(','), ...lineas].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte-financiero-${this.desde}-a-${this.hasta}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
