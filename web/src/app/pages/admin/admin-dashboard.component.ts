import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { debounceTime } from 'rxjs';
import { ApiService, toApiError } from '../../core/api.service';
import { AdminDashboard, AdminReport, AdminUser } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { ErrorViewComponent } from '../../shared/error-view.component';
import { TranslatePipe } from '../../shared/translate.pipe';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [DatePipe, ErrorViewComponent, ReactiveFormsModule, RouterLink, TranslatePipe],
  template: `
    <div class="page"><div class="container">
      <div class="page-head"><h1>{{ 'Administration' | translate }}</h1><p>{{ 'Indicateurs de la plateforme et gestion des comptes utilisateurs.' | translate }}</p></div>
      @if (dashboard(); as data) {
        <div class="grid g4 metrics">
          <article class="card metric"><span>{{ 'Comptes' | translate }}</span><strong>{{ data.accounts.total }}</strong><small>{{ data.accounts.active }} {{ 'actifs' | translate }} · {{ data.accounts.suspended }} {{ 'suspendus' | translate }}</small></article>
          <article class="card metric"><span>{{ 'Opportunités' | translate }}</span><strong>{{ data.opportunities.open }} / {{ data.opportunities.total }}</strong><small>{{ 'ouvertes / au total' | translate }}</small></article>
          <article class="card metric"><span>{{ 'Travaux académiques' | translate }}</span><strong>{{ data.academic_works }}</strong></article>
          <article class="card metric"><span>{{ 'Candidatures aux opportunités' | translate }}</span><strong>{{ data.opportunity_applications }}</strong></article>
          <article class="card metric"><span>{{ 'Postes et candidatures TA/RA' | translate }}</span><strong>{{ data.opportunities.ta_ra_positions }} / {{ data.ta_ra_applications }}</strong></article>
          <article class="card metric"><span>{{ 'Signalements à traiter' | translate }}</span><strong>{{ data.open_reports }}</strong></article>
        </div>
        <section class="card roles">
          <h2>{{ 'Comptes par rôle' | translate }}</h2>
          <div class="chips">@for (role of roleList(data); track role) { <span class="chip">{{ roleLabel(role) | translate }} : {{ data.accounts.by_role[role] }}</span> }</div>
        </section>
      } @else if (dashboardLoading()) { <div class="spinner" role="status"></div> }
      @else if (dashboardError() !== null) { <app-error-view [status]="dashboardError()" [compact]="true" (retry)="loadDashboard()" /> }
      @else { <div class="card empty">{{ 'Les indicateurs sont indisponibles.' | translate }}</div> }

      <section class="users">
        <div class="row between"><div><h2>{{ 'Gestion des comptes' | translate }}</h2><p class="muted small">{{ 'Recherchez un utilisateur et suspendez ou réactivez son compte.' | translate }}</p></div></div>
        <form class="filters" [formGroup]="form">
          <input class="grow" type="search" formControlName="q" [placeholder]="'Nom ou adresse e-mail' | translate">
          <select formControlName="role"><option value="">{{ 'Tous les rôles' | translate }}</option>@for (role of roles; track role) { <option [value]="role">{{ roleLabel(role) | translate }}</option> }</select>
          <select formControlName="status"><option value="">{{ 'Tous les statuts' | translate }}</option><option value="active">{{ 'Actif' | translate }}</option><option value="suspended">{{ 'Suspendu' | translate }}</option></select>
        </form>
        @if (usersLoading()) { <div class="spinner" role="status"></div> }
        @else if (usersError() !== null) { <app-error-view [status]="usersError()" [compact]="true" (retry)="loadUsers()" /> }
        @else if (!users().length) { <div class="card empty">{{ 'Aucun utilisateur ne correspond à la recherche.' | translate }}</div> }
        @else {
          <div class="card table-wrap"><table>
            <thead><tr><th>{{ 'Utilisateur' | translate }}</th><th>{{ 'Rôle' | translate }}</th><th>{{ 'Statut' | translate }}</th><th>{{ 'Inscription' | translate }}</th><th>{{ 'Action' | translate }}</th></tr></thead>
            <tbody>@for (user of users(); track user.id) {
              <tr><td><b>{{ user.name }}</b><small>{{ user.email }}</small></td>
                <td>{{ roleLabel(user.role) | translate }}</td>
                <td><span class="badge" [class.ok]="user.status === 'active'" [class.bad]="user.status === 'suspended'">{{ (user.status === 'active' ? 'Actif' : 'Suspendu') | translate }}</span></td>
                <td>{{ 'Date d’inscription' | translate }} {{ user.created_at | date:'mediumDate' }}</td>
                <td><button class="btn sm" [class.danger]="user.status === 'active'" [class.ghost]="user.status === 'suspended'" type="button"
                  [disabled]="busyId() === user.id" (click)="toggle(user)">{{ (user.status === 'active' ? 'Suspendre' : 'Réactiver') | translate }}</button></td>
              </tr>
            }</tbody>
          </table></div>
        }
      </section>

      <section class="reports">
        <h2>{{ 'Signalements' | translate }}</h2>
        @if (reportsLoading()) { <div class="spinner" role="status"></div> }
        @else if (reportsError() !== null) { <app-error-view [status]="reportsError()" [compact]="true" (retry)="loadReports()" /> }
        @else if (!reports().length) { <div class="card empty">{{ 'Aucun signalement en attente.' | translate }}</div> }
        @else { <div class="grid">
          @for (report of reports(); track report.id) {
            <article class="card report">
              <div class="row between"><div><span class="badge" [class.warn]="report.status === 'open'" [class.ok]="report.status === 'reviewed'">{{ statusLabel(report.status) | translate }}</span>
                <h3>{{ targetLabel(report.target_type) | translate }} · {{ report.target_label || ('Contenu indisponible' | translate) }}</h3>
                <p class="muted small">{{ 'Signalé par' | translate }} {{ report.reporter?.name || ('Compte supprimé' | translate) }} · {{ report.created_at | date:'medium' }}</p>
              </div><a class="btn ghost sm" [routerLink]="targetPath(report)">{{ 'Ouvrir la ressource' | translate }}</a></div>
              <p><b>{{ reasonLabel(report.reason) | translate }}</b></p>
              @if (report.details) { <p class="details">{{ report.details }}</p> }
              @if (report.admin_note) { <p class="muted small">{{ 'Note de modération :' | translate }} {{ report.admin_note }}</p> }
              @if (report.status === 'open') { <div class="row">
                <button class="btn sm" type="button" [disabled]="busyReport() === report.id" (click)="reviewReport(report, 'reviewed')">{{ 'Marquer comme traité' | translate }}</button>
                <button class="btn ghost sm" type="button" [disabled]="busyReport() === report.id" (click)="reviewReport(report, 'dismissed')">{{ 'Écarter' | translate }}</button>
              </div> }
            </article>
          }
        </div> }
      </section>
    </div></div>`,
  styles: [`
    .metrics { margin-bottom: 1.2rem; } .metric { display: flex; flex-direction: column; gap: .3rem; }
    .metric strong { font-size: 1.8rem; color: var(--sky-700); } .metric small { color: var(--muted); }
    .roles { margin-bottom: 2rem; } .roles h2, .users h2, .reports h2 { font-size: 1.3rem; }
    .reports { margin-top: 2rem; } .report h3 { margin: .6rem 0 .25rem; font-size: 1rem; }
    .report .details { white-space: pre-wrap; } .report > .row { align-items: flex-start; }
    .table-wrap { overflow-x: auto; padding: 0; } table { width: 100%; border-collapse: collapse; min-width: 700px; }
    th, td { padding: .8rem 1rem; text-align: left; border-bottom: 1px solid var(--line); }
    th { color: var(--muted); font-size: .83rem; } td small { display: block; color: var(--muted); }
  `],
})
export class AdminDashboardComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  readonly roles = ['student', 'school', 'company', 'mentor', 'organization', 'admin'];
  readonly form = this.fb.nonNullable.group({ q: '', role: '', status: '' });
  readonly dashboard = signal<AdminDashboard | null>(null);
  readonly users = signal<AdminUser[]>([]);
  readonly reports = signal<AdminReport[]>([]);
  readonly dashboardLoading = signal(true);
  readonly usersLoading = signal(true);
  readonly reportsLoading = signal(true);
  readonly dashboardError = signal<number | null>(null);
  readonly usersError = signal<number | null>(null);
  readonly reportsError = signal<number | null>(null);
  readonly busyId = signal<number | null>(null);
  readonly busyReport = signal<number | null>(null);

  ngOnInit(): void {
    this.loadDashboard();
    this.loadUsers();
    this.loadReports();
    this.form.valueChanges.pipe(debounceTime(250)).subscribe(() => this.loadUsers());
  }

  loadDashboard(): void {
    this.dashboardLoading.set(true);
    this.dashboardError.set(null);
    this.api.adminDashboard().subscribe({
      next: response => { this.dashboard.set(response.data); this.dashboardLoading.set(false); },
      error: error => { this.dashboardLoading.set(false); this.dashboardError.set(toApiError(error).status ?? 500); },
    });
  }

  loadReports(): void {
    this.reportsLoading.set(true);
    this.reportsError.set(null);
    this.api.adminReports({ status: 'open' }).subscribe({
      next: response => { this.reports.set(response.data); this.reportsLoading.set(false); },
      error: error => { this.reportsLoading.set(false); this.reportsError.set(toApiError(error).status ?? 500); },
    });
  }

  loadUsers(): void {
    this.usersLoading.set(true);
    this.usersError.set(null);
    this.api.adminUsers(this.form.getRawValue()).subscribe({
      next: response => { this.users.set(response.data); this.usersLoading.set(false); },
      error: error => { this.usersLoading.set(false); this.usersError.set(toApiError(error).status ?? 500); },
    });
  }

  roleList(data: AdminDashboard): string[] { return Object.keys(data.accounts.by_role); }

  roleLabel(role: string): string {
    return ({
      student: 'Étudiant / Diplômé', school: 'École / Université', company: 'Entreprise',
      mentor: 'Mentor', organization: 'Organisme', admin: 'Administrateur',
    })[role] ?? role;
  }

  statusLabel(status: string): string {
    return ({ open: 'À traiter', reviewed: 'Traité', dismissed: 'Écarté' })[status] ?? status;
  }

  targetLabel(type: string): string {
    return ({ member: 'Profil', work: 'Travail académique', opportunity: 'Opportunité' })[type] ?? type;
  }

  reasonLabel(reason: string): string {
    return ({
      inaccurate: 'Information inexacte', inappropriate: 'Contenu inapproprié',
      fraud: 'Fraude ou usurpation', spam: 'Spam', other: 'Autre motif',
    })[reason] ?? reason;
  }

  targetPath(report: AdminReport): string {
    if (report.target_type === 'member') return `/membres/${report.target_id}`;
    if (report.target_type === 'work') return `/memoires/${report.target_id}`;
    return `/opportunites/${report.target_id}`;
  }

  toggle(user: AdminUser): void {
    this.busyId.set(user.id);
    this.api.setUserStatus(user.id, user.status === 'active' ? 'suspended' : 'active').subscribe({
      next: () => {
        this.busyId.set(null);
        this.loadUsers();
        this.api.adminDashboard().subscribe({
          next: response => { this.dashboard.set(response.data); this.dashboardError.set(null); },
          error: error => this.toast.error(toApiError(error).message),
        });
      },
      error: error => { this.busyId.set(null); this.toast.error(toApiError(error).message); },
    });
  }

  reviewReport(report: AdminReport, status: 'reviewed' | 'dismissed'): void {
    this.busyReport.set(report.id);
    this.api.reviewReport(report.id, status, '').subscribe({
      next: () => {
        this.busyReport.set(null);
        this.loadReports();
        this.api.adminDashboard().subscribe({
          next: response => { this.dashboard.set(response.data); this.dashboardError.set(null); },
          error: error => this.toast.error(toApiError(error).message),
        });
      },
      error: error => { this.busyReport.set(null); this.toast.error(toApiError(error).message); },
    });
  }
}
