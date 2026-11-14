import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService, toApiError } from '../../core/api.service';
import { ConnectionsResponse, ConnectionItem } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { ErrorViewComponent } from '../../shared/error-view.component';
import { TranslatePipe } from '../../shared/translate.pipe';
import { I18nService } from '../../core/i18n.service';

@Component({
  selector: 'app-connections',
  standalone: true,
  imports: [CommonModule, RouterLink, ErrorViewComponent, TranslatePipe],
  template: `
    <div class="page"><div class="container">
      <div class="page-head"><h1>{{ 'Mes connexions' | translate }}</h1><p>{{ 'Gérez vos demandes et vos relations professionnelles.' | translate }}</p></div>
      @if (error() !== null) { <app-error-view [status]="error()" [compact]="true" (retry)="load()" /> }
      @else if (loading()) { <div class="grid g2">@for (i of [1,2]; track i) { <div class="card skeleton" style="height:150px"></div> }</div> }
      @else {
        <section class="card section"><h2>{{ 'Demandes reçues' | translate }} <span class="badge">{{ connections().incoming.length }}</span></h2>
          @if (!connections().incoming.length) { <p class="muted">{{ 'Aucune demande en attente.' | translate }}</p> }
          <div class="grid g2">@for (item of connections().incoming; track item.id) { <article class="connection"><ng-container *ngTemplateOutlet="card; context: {$implicit: item}"></ng-container>
            <div class="row"><button class="btn sm" type="button" [disabled]="busyId() === item.id" (click)="accept(item)">{{ 'Accepter' | translate }}</button><button class="btn ghost sm" type="button" [disabled]="busyId() === item.id" (click)="decline(item)">{{ 'Refuser' | translate }}</button></div>
          </article> }</div>
        </section>
        <section class="card section"><h2>{{ 'Relations établies' | translate }} <span class="badge">{{ connections().accepted.length }}</span></h2>
          @if (!connections().accepted.length) { <p class="muted">{{ 'Aucune connexion pour le moment.' | translate }}</p> }
          <div class="grid g2">@for (item of connections().accepted; track item.id) { <article class="connection"><ng-container *ngTemplateOutlet="card; context: {$implicit: item}"></ng-container>
            <button class="btn ghost sm" type="button" [disabled]="busyId() === item.id" (click)="remove(item)">{{ 'Supprimer la connexion' | translate }}</button>
          </article> }</div>
        </section>
        <section class="card section"><h2>{{ 'Demandes envoyées' | translate }} <span class="badge">{{ connections().outgoing.length }}</span></h2>
          @if (!connections().outgoing.length) { <p class="muted">{{ 'Aucune demande envoyée.' | translate }}</p> }
          <div class="grid g2">@for (item of connections().outgoing; track item.id) { <article class="connection"><ng-container *ngTemplateOutlet="card; context: {$implicit: item}"></ng-container>
            <button class="btn ghost sm" type="button" [disabled]="busyId() === item.id" (click)="remove(item)">{{ 'Annuler la demande' | translate }}</button>
          </article> }</div>
        </section>
      }
      <ng-template #card let-item><div class="row member"><span class="avatar">{{ initials(item.user.name) }}</span><div><a [routerLink]="profileLink(item.user.id,item.user.role)"><b>{{ item.user.name }}</b></a><p class="muted small">{{ item.user.headline || item.user.institution || item.user.country }}</p></div></div></ng-template>
    </div></div>`,
  styles: [`
    .section { margin-bottom: 1rem; } .section h2 { margin-top: 0; font-size: 1.2rem; }
    .connection { border: 1px solid var(--line); border-radius: var(--radius); padding: 1rem; }
    .member { gap: .75rem; margin-bottom: .8rem; } .member a { color: inherit; text-decoration: none; }
    .avatar { width: 42px; height: 42px; display: grid; place-items: center; border-radius: 50%; color: var(--sky-700); background: var(--sky-100); font-weight: 750; }
    .muted { color: var(--muted); } .member p { margin: .2rem 0 0; }
  `],
})
export class ConnectionsComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  connections = signal<ConnectionsResponse>({ accepted: [], incoming: [], outgoing: [] });
  loading = signal(true);
  error = signal<number | null>(null);
  busyId = signal<number | null>(null);

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.connections().subscribe({
      next: response => { this.connections.set(response); this.loading.set(false); },
      error: error => { this.error.set(toApiError(error).status ?? 500); this.loading.set(false); },
    });
  }

  initials(name: string): string {
    return name.split(/\s+/).slice(0, 2).map(part => part[0] ?? '').join('').toUpperCase();
  }

  profileLink(id: number, role: string): string[] {
    if (role === 'student') return ['/etudiants', String(id)];
    if (role === 'school') return ['/etablissements', String(id)];
    return ['/membres', String(id)];
  }

  accept(item: ConnectionItem): void {
    this.busyId.set(item.id);
    this.api.acceptConnection(item.id).subscribe({
      next: response => { this.busyId.set(null); this.toast.success(this.i18n.translate(response.message)); this.load(); },
      error: error => { this.busyId.set(null); this.toast.error(this.i18n.translate(toApiError(error).message)); },
    });
  }

  decline(item: ConnectionItem): void {
    this.busyId.set(item.id);
    this.api.declineConnection(item.id).subscribe({
      next: response => { this.busyId.set(null); this.toast.success(this.i18n.translate(response.message)); this.load(); },
      error: error => { this.busyId.set(null); this.toast.error(this.i18n.translate(toApiError(error).message)); },
    });
  }

  remove(item: ConnectionItem): void {
    this.busyId.set(item.id);
    this.api.removeConnection(item.id).subscribe({
      next: response => { this.busyId.set(null); this.toast.success(this.i18n.translate(response.message)); this.load(); },
      error: error => { this.busyId.set(null); this.toast.error(this.i18n.translate(toApiError(error).message)); },
    });
  }
}
