import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

import { SessionService } from '../../../../core/services/session.service';
import { UsersService } from '../../../../core/services/users.service';

@Component({
  selector: 'app-profile-page',
  templateUrl: './profile-page.component.html',
  styleUrl: './profile-page.component.scss'
})
export class ProfilePageComponent implements OnInit {
  form: FormGroup;
  message: string | null = null;
  errorMessage: string | null = null;
  rolesLabel = '';

  constructor(
    private fb: FormBuilder,
    private session: SessionService,
    private usersService: UsersService
  ) {
    this.form = this.fb.group({
      fullName: ['', Validators.required],
      phone: [''],
      bio: [''],
      disability: [''],
      supportPreference: [''],
      supportPreferenceNotes: ['']
    });
  }

  ngOnInit(): void {
    this.session.loadProfile().subscribe((profile) => {
      if (!profile) {
        this.errorMessage = 'No se pudo cargar el perfil.';
        return;
      }
      this.rolesLabel = profile.roles?.join(', ') || this.session.getPrimaryRole();
      this.form.patchValue({
        fullName: profile.fullName || '',
        phone: profile.phone || '',
        bio: profile.bio || '',
        disability: profile.disability || '',
        supportPreference: profile.supportPreference || '',
        supportPreferenceNotes: profile.supportPreferenceNotes || ''
      });
    });
  }

  get fixedSidebar(): boolean {
    return this.session.getPrimaryRole() !== 'USUARIO';
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.usersService.updateProfile(this.form.value).subscribe({
      next: (profile) => {
        this.message = 'Perfil actualizado.';
        this.errorMessage = null;
        this.session.loadProfile().subscribe();
        this.rolesLabel = profile.roles?.join(', ') || this.rolesLabel;
      },
      error: (error) => {
        this.message = null;
        this.errorMessage = error?.error?.message || 'No se pudo actualizar el perfil.';
      }
    });
  }
}
