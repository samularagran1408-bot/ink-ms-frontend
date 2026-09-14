import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';

/**
 * M09 - Reportes financieros (RF62). Scaffold: pendiente de diseño.
 * Se reutiliza para organizador (mode='own') y admin (mode='global') vía `data: { mode }`
 * en la ruta, igual que EventsPageComponent hace con `mode: 'user' | 'manage'`.
 * Backend ya disponible: GET /api/reportes/financiero, GET /api/reportes/admin/financiero
 * (ver SubscriptionService.getReporteFinancieroPropio / .getReporteFinancieroGlobal).
 */
@Component({
  standalone: true,
  imports: [CommonModule],
  selector: 'app-financial-reports',
  templateUrl: './financial-reports.component.html',
  styleUrl: './financial-reports.component.scss'
})
export class FinancialReportsComponent implements OnInit {
  mode: 'own' | 'global' = 'own';

  constructor(private readonly route: ActivatedRoute) {}

  ngOnInit(): void {
    this.mode = (this.route.snapshot.data['mode'] as 'own' | 'global') || 'own';
  }
}
