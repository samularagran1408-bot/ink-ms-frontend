import { Component, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { Observable, Subscription } from 'rxjs';

import { AdminAuditLog, RoleInfo, UpdateProfileRequest, UserProfile } from '../../../../core/models/user-profile';
import { UsersService } from '../../../../core/services/users.service';
import { SessionService } from '../../../../core/services/session.service';
import { ConfirmDialogService } from '../../../../core/services/confirm-dialog.service';
import { disabilityRequiresCompanion } from '../../../auth/models/register-request';

@Component({
  selector: 'app-admin-user-detail',
  templateUrl: './admin-user-detail.component.html',
  styleUrl: './admin-user-detail.component.scss'
})
export class AdminUserDetailComponent implements OnInit, OnDestroy {
  form: FormGroup;
  user: UserProfile | null = null;
  email = '';
  rolesLabel = '';
  catalogRoles: RoleInfo[] = [];
  selectedRoleNames = new Set<string>();
  auditLogs: AdminAuditLog[] = [];
  loading = true;
  isSaving = false;
  isSavingRoles = false;
  isProcessingPhoto = false;
  actionBusy = false;
  showCompanionFields = false;
  profilePicturePreview: string | null = null;
  message: string | null = null;
  errorMessage: string | null = null;

  readonly disabilityOptions = [
    { value: 'VISUAL', labelKey: 'PROFILE.DISABILITY_VISUAL' },
    { value: 'MOTRIZ', labelKey: 'PROFILE.DISABILITY_MOTOR' },
    { value: 'AUDITIVA', labelKey: 'PROFILE.DISABILITY_HEARING' },
    { value: 'INTELECTUAL', labelKey: 'PROFILE.DISABILITY_INTELLECTUAL' },
    { value: 'COGNITIVA', labelKey: 'PROFILE.DISABILITY_COGNITIVE' },
    { value: 'MULTIPLE', labelKey: 'PROFILE.DISABILITY_MULTIPLE' },
    { value: '', labelKey: 'PROFILE.DISABILITY_NONE' }
  ];

  private routeSub?: Subscription;
  private disabilitySub?: Subscription;
  private readonly maxPhotoBytes = 2 * 1024 * 1024;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private usersService: UsersService,
    private session: SessionService,
    private confirm: ConfirmDialogService,
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

    this.usersService.getRoles().subscribe({
      next: (roles) => { this.catalogRoles = roles; },
      error: () => undefined
    });

    this.routeSub = this.route.paramMap.subscribe((params) => {
      const raw = params.get('email') || '';
      this.email = this.decodeEmail(raw);
      if (this.email) {
        this.reload();
      } else {
        this.loading = false;
        this.errorMessage = this.translate.instant('ADMIN_USERS.LOAD_ERROR');
      }
    });
  }

  ngOnDestroy(): void {
    this.routeSub?.unsubscribe();
    this.disabilitySub?.unsubscribe();
  }

  get initials(): string {
    const name = (this.form.get('fullName')?.value || this.user?.fullName || this.email || 'U').trim();
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((part: string) => part.charAt(0).toUpperCase())
      .join('') || 'U';
  }

  get isSelf(): boolean {
    const me = this.session.getProfile()?.email;
    return !!me && me.toLowerCase() === this.email.toLowerCase();
  }

  get statusKey(): string {
    if (!this.user) {
      return 'COMMON.NONE';
    }
    if (this.user.blockedPermanently || this.user.blockReason) {
      return 'COMMON.BLOCKED';
    }
    if (this.user.isActive === false) {
      return 'COMMON.INACTIVE';
    }
    return 'COMMON.ACTIVE';
  }

  get statusClass(): string {
    if (!this.user) {
      return 'status-pill--warn';
    }
    if (this.user.blockedPermanently || this.user.blockReason) {
      return 'status-pill--bad';
    }
    if (this.user.isActive === false) {
      return 'status-pill--warn';
    }
    return 'status-pill--ok';
  }

  reload(): void {
    this.loading = true;
    this.errorMessage = null;
    this.usersService.getUserByEmail(this.email).subscribe({
      next: (user) => {
        this.applyUser(user);
        this.loading = false;
        this.loadAudit();
      },
      error: (error) => {
        this.loading = false;
        this.user = null;
        this.errorMessage = error?.error?.message || this.translate.instant('ADMIN_USERS.LOAD_ERROR');
      }
    });
  }

  back(): void {
    void this.router.navigate(['/admin/users']);
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

  save(): void {
    this.message = null;
    this.errorMessage = null;

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const phone = (raw.phone || '').trim();
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
    this.usersService.adminUpdateProfile(this.email, payload).subscribe({
      next: (profile) => {
        this.isSaving = false;
        this.message = this.translate.instant('ADMIN_USERS.PROFILE_SAVED');
        this.applyUser(profile);
        if (this.isSelf) {
          this.session.loadProfile().subscribe();
        }
      },
      error: (error) => {
        this.isSaving = false;
        this.errorMessage = error?.error?.message || this.translate.instant('PROFILE.UPDATE_ERROR');
      }
    });
  }

  isRoleSelected(name: string): boolean {
    return this.selectedRoleNames.has(name);
  }

  toggleRole(name: string, checked: boolean): void {
    if (checked) {
      this.selectedRoleNames.add(name);
    } else {
      this.selectedRoleNames.delete(name);
    }
  }

  saveRoles(): void {
    const roleNames = [...this.selectedRoleNames];
    if (!roleNames.length) {
      this.errorMessage = this.translate.instant('ADMIN_USERS.ROLES_REQUIRED');
      return;
    }
    if (this.isSelf && !roleNames.includes('ADMIN')) {
      this.errorMessage = this.translate.instant('ADMIN_USERS.CANNOT_DROP_OWN_ADMIN');
      return;
    }

    this.isSavingRoles = true;
    this.errorMessage = null;
    this.usersService.replaceRoles(this.email, roleNames).subscribe({
      next: () => {
        this.isSavingRoles = false;
        this.message = this.translate.instant('ADMIN_USERS.ROLES_UPDATED');
        this.reload();
      },
      error: (error) => {
        this.isSavingRoles = false;
        this.errorMessage = error?.error?.message || this.translate.instant('ADMIN_USERS.ROLES_ERROR');
      }
    });
  }

  block(): void {
    if (!this.user) {
      return;
    }
    void this.confirmAndRun(
      'ADMIN_USERS.BLOCK_TITLE',
      'ADMIN_USERS.BLOCK_CONFIRM',
      'danger',
      () => this.usersService.blockUser(this.email, { reason: 'Bloqueo administrativo', permanent: false }),
      'ADMIN_USERS.BLOCKED_OK'
    );
  }

  activate(): void {
    if (!this.user) {
      return;
    }
    void this.confirmAndRun(
      'ADMIN_USERS.ACTIVATE_TITLE',
      'ADMIN_USERS.ACTIVATE_CONFIRM',
      undefined,
      () => this.usersService.activateUser(this.email),
      'ADMIN_USERS.ACTIVATED_OK'
    );
  }

  deleteUser(): void {
    if (!this.user || this.isSelf) {
      this.errorMessage = this.translate.instant('ADMIN_USERS.CANNOT_DELETE_SELF');
      return;
    }
    void this.confirmAndRun(
      'ADMIN_USERS.DELETE_TITLE',
      'ADMIN_USERS.DELETE_CONFIRM',
      'danger',
      () => this.usersService.deleteUser(this.email),
      'ADMIN_USERS.DELETED_OK',
      true
    );
  }

  formatDate(value?: string): string {
    if (!value) {
      return '—';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  yesNo(value?: boolean): string {
    if (value === true) {
      return this.translate.instant('ADMIN_USERS.YES');
    }
    if (value === false) {
      return this.translate.instant('ADMIN_USERS.NO');
    }
    return '—';
  }

  displayValue(value?: string | number | null): string {
    if (value === null || value === undefined || value === '') {
      return '—';
    }
    return String(value);
  }

  isImageSrc(value?: string | null): boolean {
    if (!value) {
      return false;
    }
    return value.startsWith('data:image/') || /^https?:\/\/.+\.(png|jpe?g|gif|webp)(\?|$)/i.test(value);
  }

  isOpenableSrc(value?: string | null): boolean {
    if (!value) {
      return false;
    }
    return value.startsWith('data:') || /^https?:\/\//i.test(value);
  }

  private applyUser(user: UserProfile): void {
    this.user = user;
    this.email = user.email || this.email;
    this.rolesLabel = user.roles?.join(', ') || 'USUARIO';
    this.profilePicturePreview = user.profilePicture || null;
    this.selectedRoleNames = new Set(user.roles?.length ? user.roles : ['USUARIO']);
    this.form.patchValue({
      fullName: user.fullName || '',
      phone: user.phone || '',
      bio: user.bio || '',
      disability: this.normalizeDisability(user.disability),
      companionFullName: user.companionFullName || '',
      companionPhone: user.companionPhone || '',
      companionRelationship: user.companionRelationship || '',
      companionEmail: user.companionEmail || '',
      supportPreference: user.supportPreference || '',
      supportPreferenceNotes: user.supportPreferenceNotes || '',
      profilePicture: user.profilePicture || ''
    });
    this.applyCompanionValidators(this.form.get('disability')?.value);
  }

  private loadAudit(): void {
    this.usersService.getAuditLogs({ targetEmail: this.email }).subscribe({
      next: (logs) => {
        this.auditLogs = (logs || []).slice(0, 8);
      },
      error: () => {
        this.auditLogs = [];
      }
    });
  }

  private async confirmAndRun(
    titleKey: string,
    messageKey: string,
    tone: 'danger' | undefined,
    request: () => Observable<unknown>,
    successKey: string,
    goBack = false
  ): Promise<void> {
    const ok = await this.confirm.ask({
      title: this.translate.instant(titleKey),
      message: this.translate.instant(messageKey, { name: this.user?.fullName || this.email }),
      confirmLabel: this.translate.instant('COMMON.CONFIRM'),
      cancelLabel: this.translate.instant('COMMON.CANCEL'),
      tone
    });
    if (!ok) {
      return;
    }

    this.actionBusy = true;
    this.errorMessage = null;
    request().subscribe({
      next: () => {
        this.actionBusy = false;
        this.message = this.translate.instant(successKey, { name: this.user?.fullName || this.email });
        if (goBack) {
          this.back();
          return;
        }
        this.reload();
      },
      error: (error) => {
        this.actionBusy = false;
        this.errorMessage = error?.error?.message || this.translate.instant('ADMIN_USERS.ACTION_ERROR');
      }
    });
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

  private normalizeDisability(value?: string): string {
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
      INTELECTUAL: 'INTELECTUAL'
    };
    return aliases[upper] ?? upper;
  }

  private decodeEmail(raw: string): string {
    if (!raw) {
      return '';
    }
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }

  private applyCompanionValidators(disability: string): void {
    this.showCompanionFields = disabilityRequiresCompanion(disability);
    const fullName = this.form.get('companionFullName')!;
    const phone = this.form.get('companionPhone')!;

    if (this.showCompanionFields) {
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
}
