import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

import { Disability } from '../../../../core/models/sports';
import { SportsService } from '../../../../core/services/sports.service';

@Component({
  selector: 'app-disabilities-page',
  templateUrl: './disabilities-page.component.html',
  styleUrl: './disabilities-page.component.scss'
})
export class DisabilitiesPageComponent implements OnInit {
  items: Disability[] = [];
  form: FormGroup;
  errorMessage: string | null = null;

  constructor(
    private sportsService: SportsService,
    private fb: FormBuilder
  ) {
    this.form = this.fb.group({
      name: ['', Validators.required],
      description: [''],
      category: ['fisica', Validators.required],
      isActive: [true]
    });
  }

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.sportsService.getDisabilities().subscribe({
      next: (items) => this.items = items,
      error: (error) => this.errorMessage = error?.error?.message || 'No se pudieron cargar discapacidades.'
    });
  }

  create(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.sportsService.createDisability(this.form.value).subscribe({
      next: () => {
        this.form.reset({ category: 'fisica', isActive: true });
        this.reload();
      },
      error: (error) => this.errorMessage = error?.error?.message || 'No se pudo crear.'
    });
  }

  remove(item: Disability): void {
    this.sportsService.deleteDisability(item.id).subscribe({
      next: () => this.reload(),
      error: (error) => this.errorMessage = error?.error?.message || 'No se pudo eliminar.'
    });
  }
}
