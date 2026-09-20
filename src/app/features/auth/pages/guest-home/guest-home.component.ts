import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

import { ROLE_HOME } from '@core/models/app-role';
import { SessionService } from '@core/services/session.service';

interface Disciplina {
  img: string;
  alt: string;
  nombre: string;
  tags: string[];
  filtro: string;
}

@Component({
  selector: 'app-guest-home',
  templateUrl: './guest-home.component.html',
  styleUrl: './guest-home.component.scss'
})
export class GuestHomeComponent implements OnInit {
  readonly filtros = ['Todos', 'Individual', 'Equipo', 'Acuático'];
  selectedFiltro = 'Todos';

  readonly disciplinas: Disciplina[] = [
    {
      img: 'assets/events/baloncesto-silla.png',
      alt: 'Baloncesto en silla de ruedas',
      nombre: 'Baloncesto en silla',
      tags: ['Equipo', 'Adaptado'],
      filtro: 'Equipo'
    },
    {
      img: 'assets/events/natacion.png',
      alt: 'Natación adaptada',
      nombre: 'Natación adaptada',
      tags: ['Individual', 'Acuático'],
      filtro: 'Acuático'
    },
    {
      img: 'assets/events/futbol-sala.png',
      alt: 'Fútbol sala adaptado',
      nombre: 'Fútbol sala adaptado',
      tags: ['Equipo', 'Adaptado'],
      filtro: 'Equipo'
    },
    {
      img: 'assets/events/default.png',
      alt: 'Atletismo adaptado',
      nombre: 'Atletismo adaptado',
      tags: ['Individual', 'Pista'],
      filtro: 'Individual'
    }
  ];

  constructor(
    private router: Router,
    private session: SessionService
  ) {}

  ngOnInit(): void {
    if (this.session.isAuthenticated()) {
      const role = this.session.getPrimaryRole();
      void this.router.navigateByUrl(ROLE_HOME[role] || '/home');
    }
  }

  get disciplinasVisibles(): Disciplina[] {
    if (this.selectedFiltro === 'Todos') {
      return this.disciplinas;
    }
    return this.disciplinas.filter((d) => d.filtro === this.selectedFiltro || d.tags.includes(this.selectedFiltro));
  }

  goLogin(): void {
    void this.router.navigate(['/login']);
  }

  goRegister(): void {
    void this.router.navigate(['/register']);
  }
}
