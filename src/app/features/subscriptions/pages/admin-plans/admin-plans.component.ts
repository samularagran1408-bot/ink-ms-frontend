import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { SubscriptionService } from '../../services/subscription.service';
import { Plan, PlanRequest } from '../../models/subscription-models';

interface PlanForm {
  nombre: string;
  descripcion: string;
  precio: number;
  limiteEventosMes: number;
  porcentajeComision: number;
  duracionDias: number;
  esGratuito: boolean;
  esPlanInicial: boolean;
}

const FORM_VACIO: PlanForm = {
  nombre: '',
  descripcion: '',
  precio: 0,
  limiteEventosMes: 0,
  porcentajeComision: 0,
  duracionDias: 30,
  esGratuito: false,
  esPlanInicial: false,
};

/** M09 - Administración de planes (RF65, solo ADMIN). */
@Component({
  standalone: true,
  imports: [CommonModule, FormsModule],
  selector: 'app-admin-plans',
  templateUrl: './admin-plans.component.html',
  styleUrl: './admin-plans.component.scss'
})
export class AdminPlansComponent implements OnInit {
  planes: Plan[] = [];
  cargando = true;
  guardando = false;
  error: string | null = null;
  formError: string | null = null;

  editando: Plan | null = null;
  form: PlanForm = { ...FORM_VACIO };
  beneficiosTexto = '';

  constructor(private readonly subscriptions: SubscriptionService) {}

  ngOnInit(): void {
    this.cargarPlanes();
  }

  private cargarPlanes(): void {
    this.cargando = true;
    this.subscriptions.getPlanesAdmin().subscribe({
      next: (planes) => {
        this.planes = planes;
        this.cargando = false;
      },
      error: () => {
        this.error = 'No se pudieron cargar los planes.';
        this.cargando = false;
      },
    });
  }

  nuevoPlan(): void {
    this.editando = null;
    this.form = { ...FORM_VACIO };
    this.beneficiosTexto = '';
    this.formError = null;
  }

  editarPlan(plan: Plan): void {
    this.editando = plan;
    this.form = {
      nombre: plan.nombre,
      descripcion: plan.descripcion ?? '',
      precio: plan.precio,
      limiteEventosMes: plan.limiteEventosMes ?? 0,
      porcentajeComision: plan.porcentajeComision ?? 0,
      duracionDias: plan.duracionDias,
      esGratuito: plan.esGratuito,
      esPlanInicial: plan.esPlanInicial,
    };
    this.beneficiosTexto = (plan.beneficios ?? []).join('\n');
    this.formError = null;
  }

  guardar(): void {
    if (!this.form.nombre.trim()) {
      this.formError = 'El nombre del plan es obligatorio.';
      return;
    }
    this.formError = null;
    this.guardando = true;

    const body: PlanRequest = {
      nombre: this.form.nombre.trim(),
      descripcion: this.form.descripcion.trim() || null,
      precio: Number(this.form.precio) || 0,
      limiteEventosMes: Number(this.form.limiteEventosMes) || 0,
      porcentajeComision: Number(this.form.porcentajeComision) || 0,
      duracionDias: Number(this.form.duracionDias) || 1,
      esGratuito: this.form.esGratuito,
      esPlanInicial: this.form.esPlanInicial,
      beneficios: this.beneficiosTexto
        .split('\n')
        .map((linea) => linea.trim())
        .filter((linea) => linea.length > 0),
    };

    const peticion$ = this.editando
      ? this.subscriptions.actualizarPlan(this.editando.id, body)
      : this.subscriptions.crearPlan(body);

    peticion$.subscribe({
      next: () => {
        this.guardando = false;
        this.nuevoPlan();
        this.cargarPlanes();
      },
      error: (err) => {
        this.guardando = false;
        this.formError = err?.error?.message ?? 'No se pudo guardar el plan.';
      },
    });
  }

  desactivar(plan: Plan): void {
    this.subscriptions.desactivarPlan(plan.id).subscribe({
      next: () => this.cargarPlanes(),
      error: () => (this.error = `No se pudo desactivar el plan "${plan.nombre}".`),
    });
  }
}
