import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

import { Sport } from '../../../../core/models/sports';
import { SportsService } from '../../../../core/services/sports.service';

@Component({
  selector: 'app-sports-page',
  templateUrl: './sports-page.component.html',
  styleUrl: './sports-page.component.scss'
})
export class SportsPageComponent implements OnInit {
  sports: Sport[] = [];
  form: FormGroup;
  errorMessage: string | null = null;

  constructor(
    private sportsService: SportsService,
    private fb: FormBuilder
  ) {
    this.form = this.fb.group({
      name: ['', Validators.required],
      description: [''],
      difficulty: ['bajo'],
      requiredMaterials: [''],
      isActive: [true]
    });
  }

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.sportsService.getSports().subscribe({
      next: (sports) => this.sports = sports,
      error: (error) => this.errorMessage = error?.error?.message || 'No se pudieron cargar deportes.'
    });
  }

  create(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.sportsService.createSport(this.form.value).subscribe({
      next: () => {
        this.form.reset({ difficulty: 'bajo', isActive: true });
        this.reload();
      },
      error: (error) => this.errorMessage = error?.error?.message || 'No se pudo crear el deporte.'
    });
  }

  remove(sport: Sport): void {
    this.sportsService.deleteSport(sport.id).subscribe({
      next: () => this.reload(),
      error: (error) => this.errorMessage = error?.error?.message || 'No se pudo eliminar.'
    });
  }
}
