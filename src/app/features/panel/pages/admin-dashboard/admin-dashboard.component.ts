import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { EventItem } from '../../../../core/models/sports';
import { UserProfile } from '../../../../core/models/user-profile';
import { UsersService } from '../../../../core/services/users.service';
import { SportsService } from '../../../../core/services/sports.service';

@Component({
  selector: 'app-admin-dashboard',
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss'
})
export class AdminDashboardComponent implements OnInit {
  loading = true;
  totalUsers = 0;
  activeUsers = 0;
  activeEvents = 0;
  sportsCount = 0;
  recentUsers: UserProfile[] = [];
  events: EventItem[] = [];
  disabilitiesCount = 0;
  errorMessage: string | null = null;

  constructor(
    private usersService: UsersService,
    private sportsService: SportsService,
    private router: Router
  ) {}

  ngOnInit(): void {
    forkJoin({
      totalUsers: this.usersService.countUsers().pipe(catchError(() => of(0))),
      activeUsers: this.usersService.countActiveUsers().pipe(catchError(() => of(0))),
      activeEvents: this.sportsService.countActiveEvents().pipe(catchError(() => of(0))),
      sportsCount: this.sportsService.countSports().pipe(catchError(() => of(0))),
      users: this.usersService.getAllUsers().pipe(catchError(() => of([] as UserProfile[]))),
      events: this.sportsService.getEvents().pipe(catchError(() => of([] as EventItem[]))),
      disabilities: this.sportsService.getDisabilities().pipe(catchError(() => of([])))
    }).subscribe({
      next: (data) => {
        this.totalUsers = data.totalUsers;
        this.activeUsers = data.activeUsers;
        this.activeEvents = data.activeEvents;
        this.sportsCount = data.sportsCount;
        this.recentUsers = data.users.slice(0, 6);
        this.events = data.events.slice(0, 4);
        this.disabilitiesCount = data.disabilities.length;
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'No se pudo cargar el dashboard admin.';
        this.loading = false;
      }
    });
  }

  go(path: string): void {
    this.router.navigate([path]);
  }

  statusClass(user: UserProfile): string {
    if (user.blockedPermanently || user.blockReason) return 'status-pill--bad';
    if (user.isActive === false) return 'status-pill--warn';
    return 'status-pill--ok';
  }

  statusLabel(user: UserProfile): string {
    if (user.blockedPermanently || user.blockReason) return 'Bloqueado';
    if (user.isActive === false) return 'Inactivo';
    return 'Activo';
  }
}
