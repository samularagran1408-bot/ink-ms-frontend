import { Component } from '@angular/core';
import { Location } from '@angular/common';

interface Disciplina {
  img: string;
  alt: string;
  nombre: string;
  tags: string[];
}

interface Evento {
  dia: string;
  mes: string;
  nombre: string;
  lugar: string;
}

@Component({
  selector: 'app-guest-home',
  templateUrl: './guest-home.component.html',
  styleUrl: './guest-home.component.scss'
})
export class GuestHomeComponent {
  readonly filtros = ['Todos', 'Paralímpico', 'Recreativo', 'Deportes de Equipo'];
  selectedFiltro = 'Todos';

  readonly disciplinas: Disciplina[] = [
    {
      img: 'https://images.unsplash.com/photo-1562771379-e71d25bd9ce3?w=400&h=300&fit=crop',
      alt: 'Baloncesto en silla de ruedas',
      nombre: 'Baloncesto en silla de ruedas',
      tags: ['Alta Intensidad', 'En Equipo']
    },
    {
      img: 'https://images.unsplash.com/photo-1530549387789-4c1017266635?w=400&h=300&fit=crop',
      alt: 'Para-Natación',
      nombre: 'Para-Natación',
      tags: ['Resistencia', 'Individual']
    },
    {
      img: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=400&h=300&fit=crop',
      alt: 'Atletismo Adaptado',
      nombre: 'Atletismo Adaptado',
      tags: ['Sprint', 'Precisión']
    },
    {
      img: 'https://images.unsplash.com/photo-1517649763962-0c623066013b?w=400&h=300&fit=crop',
      alt: 'Para-Ciclismo',
      nombre: 'Para-Ciclismo',
      tags: ['Al Aire Libre', 'Fuerza']
    }
  ];

  readonly eventos: Evento[] = [
    { dia: '12', mes: 'oct', nombre: 'Entrenamiento Maratón Adaptado', lugar: 'Estadio Central, Parque A' },
    { dia: '18', mes: 'oct', nombre: 'Abierto de Tenis en Silla', lugar: 'Club Deportivo de la Ciudad' },
    { dia: '24', mes: 'oct', nombre: 'Taller Tech Biomecánica', lugar: 'Laboratorios Inklusport' }
  ];

  constructor(private location: Location) {}

  goBack(): void {
    this.location.back();
  }

  onViewEventDetails(nombre: string): void {
    alert(`Detalles de "${nombre}" próximamente disponibles.`);
  }

  onJoinLeague(event: Event): void {
    event.preventDefault();
    alert('¡Gracias! Pronto nos pondremos en contacto contigo.');
  }
}
