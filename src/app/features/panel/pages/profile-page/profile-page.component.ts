import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';

import { SessionService } from '../../../../core/services/session.service';
import { UsersService } from '../../../../core/services/users.service';
import { UpdateProfileRequest } from '../../../../core/models/user-profile';
import { companionRequirement, hasCompanionData } from '../../../auth/models/register-request';

@Component({
  selector: 'app-profile-page',
  templateUrl: './profile-page.component.html',
  styleUrl: './profile-page.component.scss'
})
export class ProfilePageComponent implements OnInit, OnDestroy {
  form: FormGroup;
  message: string | null = null;
  errorMessage: string | null = null;
  rolesLabel = '';
  showCompanionFields = false;
  companionRequired = false;
  profilePicturePreview: string | null = null;
  isSaving = false;
  isProcessingPhoto = false;

  readonly disabilityOptions = [
    { value: 'VISUAL', labelKey: 'PROFILE.DISABILITY_VISUAL' },
    { value: 'MOTRIZ', labelKey: 'PROFILE.DISABILITY_MOTOR' },
    { value: 'AUDITIVA', labelKey: 'PROFILE.DISABILITY_HEARING' },
    { value: 'INTELECTUAL', labelKey: 'PROFILE.DISABILITY_INTELLECTUAL' },
    { value: 'COGNITIVA', labelKey: 'PROFILE.DISABILITY_COGNITIVE' },
    { value: 'MULTIPLE', labelKey: 'PROFILE.DISABILITY_MULTIPLE' },
    { value: '', labelKey: 'PROFILE.DISABILITY_NONE' },
  ];

  private disabilitySub?: Subscription;
  private readonly maxPhotoBytes = 2 * 1024 * 1024;

  constructor(
    private fb: FormBuilder,
    private session: SessionService,
    private usersService: UsersService,
    private translate: TranslateService
  ) {
    this.form = this.fb.group({
      fullName: ['', Validators.required],
      phone: ['', [Validators.maxLength(20), Validators.pattern(/^([+]?[0-9\s()-]{7,20})?$/)]],
      bio: [''],
      disability: [''],
      companionFullName: [''],
      companionPhone: [''],
      companionRelationship: [''],
      companionEmail: ['', Validators.email],
      supportPreference: [''],
      supportPreferenceNotes: [''],
      profilePicture: ['']
    });
  }

  ngOnInit(): void {
    this.disabilitySub = this.form.get('disability')!.valueChanges.subscribe((value) => {
      this.applyCompanionValidators(value);
    });

    this.session.loadProfile().subscribe((profile) => {
      if (!profile) {
        this.errorMessage = this.translate.instant('PROFILE.LOAD_ERROR');
        return;
      }
      this.rolesLabel = profile.roles?.join(', ') || this.session.getPrimaryRole();
      this.profilePicturePreview = profile.profilePicture || null;
      this.form.patchValue({
        fullName: profile.fullName || '',
        phone: profile.phone || '',
        bio: profile.bio || '',
        disability: this.normalizeDisability(profile.disability),
        companionFullName: profile.companionFullName || '',
        companionPhone: profile.companionPhone || '',
        companionRelationship: profile.companionRelationship || '',
        companionEmail: profile.companionEmail || '',
        supportPreference: profile.supportPreference || '',
        supportPreferenceNotes: profile.supportPreferenceNotes || '',
        profilePicture: profile.profilePicture || ''
      });
      this.applyCompanionValidators(this.form.get('disability')?.value);
    });
  }

  ngOnDestroy(): void {
    this.disabilitySub?.unsubscribe();
  }

  get fixedSidebar(): boolean {
    return this.session.getPrimaryRole() !== 'USUARIO';
  }

  get initials(): string {
    const name = (this.form.get('fullName')?.value || this.session.getDisplayName() || 'U').trim();
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((part: string) => part.charAt(0).toUpperCase())
      .join('') || 'U';
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    this.errorMessage = null;

    if (!file.type.startsWith('image/')) {
      this.errorMessage = this.translate.instant('PROFILE.PHOTO_INVALID');
      input.value = '';
      return;
    }

    if (file.size > this.maxPhotoBytes) {
      this.errorMessage = this.translate.instant('PROFILE.PHOTO_TOO_LARGE');
      input.value = '';
      return;
    }

    this.isProcessingPhoto = true;
    this.readAndResizeImage(file)
      .then((dataUrl) => {
        this.profilePicturePreview = dataUrl;
        this.form.patchValue({ profilePicture: dataUrl });
        this.message = this.translate.instant('PROFILE.PHOTO_READY');
        this.errorMessage = null;
      })
      .catch(() => {
        this.errorMessage = this.translate.instant('PROFILE.PHOTO_PROCESS_ERROR');
      })
      .finally(() => {
        this.isProcessingPhoto = false;
        input.value = '';
      });
  }

  removePhoto(): void {
    this.profilePicturePreview = null;
    this.form.patchValue({ profilePicture: '' });
    this.message = this.translate.instant('PROFILE.PHOTO_REMOVED');
    this.errorMessage = null;
  }

  private readAndResizeImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('read failed'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('image failed'));
        img.onload = () => {
          const maxSize = 400;
          let { width, height } = img;
          if (width > maxSize || height > maxSize) {
            const ratio = Math.min(maxSize / width, maxSize / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('canvas failed'));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.85));
        };
        img.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    });
  }

  private normalizeDisability(value?: string | null): string {
    if (!value) {
      return '';
    }
    const upper = value.trim().toUpperCase();
    const aliases: Record<string, string> = {
      VISUAL: 'VISUAL',
      MOTRIZ: 'MOTRIZ',
      FISICA: 'MOTRIZ',
      MOTORA: 'MOTRIZ',
      AUDITIVA: 'AUDITIVA',
      INTELECTUAL: 'INTELECTUAL',
      INTELLECTUAL: 'INTELECTUAL',
      COGNITIVA: 'COGNITIVA',
      COGNITIVE: 'COGNITIVA',
      MULTIPLE: 'MULTIPLE',
      MULTIPLE_DISABILITY: 'MULTIPLE',
    };
    return aliases[upper] ?? upper;
  }

  private applyCompanionValidators(disability: string): void {
    const requirement = companionRequirement(disability);
    this.showCompanionFields = requirement !== 'none';
    this.companionRequired = requirement === 'required';
    const fullName = this.form.get('companionFullName')!;
    const phone = this.form.get('companionPhone')!;

    if (this.companionRequired) {
      fullName.setValidators([Validators.required, Validators.minLength(3), Validators.maxLength(150)]);
      phone.setValidators([
        Validators.required,
        Validators.minLength(7),
        Validators.maxLength(20),
        Validators.pattern(/^[+]?[0-9\s()-]{7,20}$/)
      ]);
    } else {
      fullName.clearValidators();
      phone.clearValidators();
    }

    fullName.updateValueAndValidity({ emitEvent: false });
    phone.updateValueAndValidity({ emitEvent: false });
  }

  save(): void {
    this.message = null;
    this.errorMessage = null;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const phone = (raw.phone || '').trim();
    const companion = {
      fullName: raw.companionFullName,
      phone: raw.companionPhone,
      relationship: raw.companionRelationship,
      email: raw.companionEmail
    };
    if (this.companionRequired || hasCompanionData(companion)) {
      if (!raw.companionFullName?.trim() || !raw.companionPhone?.trim()) {
        this.form.markAllAsTouched();
        this.errorMessage = this.translate.instant('PROFILE.COMPANION_INCOMPLETE');
        return;
      }
    }

    const payload: UpdateProfileRequest = {
      fullName: raw.fullName,
      bio: raw.bio || '',
      disability: raw.disability || '',
      companionFullName: this.showCompanionFields ? raw.companionFullName : (raw.companionFullName || ''),
      companionPhone: this.showCompanionFields ? raw.companionPhone : (raw.companionPhone || ''),
      companionRelationship: raw.companionRelationship || '',
      companionEmail: raw.companionEmail || '',
      supportPreference: raw.supportPreference || '',
      supportPreferenceNotes: raw.supportPreferenceNotes || '',
      profilePicture: raw.profilePicture || ''
    };

    if (phone) {
      payload.phone = phone;
    }

    this.isSaving = true;
    this.usersService.updateProfile(payload).subscribe({
      next: (profile) => {
        this.isSaving = false;
        this.message = this.translate.instant('PROFILE.UPDATED');
        this.errorMessage = null;
        this.profilePicturePreview = profile.profilePicture || null;
        this.rolesLabel = profile.roles?.join(', ') || this.rolesLabel;
        this.session.loadProfile().subscribe();
      },
      error: (error) => {
        this.isSaving = false;
        this.message = null;
        this.errorMessage = error?.error?.message || this.translate.instant('PROFILE.UPDATE_ERROR');
      }
    });
  }
}
