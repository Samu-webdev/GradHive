import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService, toApiError } from '../../core/api.service';
import { Application } from '../../core/models';
import { APP_STATUS } from '../../core/labels';
import { ErrorViewComponent } from '../../shared/error-view.component';
import { TranslatePipe } from '../../shared/translate.pipe';
import { I18nService } from '../../core/i18n.service';

@Component({
  selector: 'app-my-applications',
  standalone: true,
  imports: [RouterLink, DatePipe, ErrorViewComponent, TranslatePipe],
  template: `
    <div class="page"><div class="container">
      <div class="page-head"><h1>{{ 'Mes candidatures' | translate }}</h1><p>{{ 'Suivez vos demandes de postes TA / RA.' | translate }}</p></div>
      @if (loading()) { <div class="spinner"></div> }
      @else if (error() !== null) { <app-error-view [status]="error()" [compact]="true" (retry)="load()" /> }
      @else if (!items().length) { <div class="card empty"><p>{{ 'Vous n’avez pas encore postulé.' | translate }}</p><a routerLink="/postes" class="btn">{{ 'Découvrir les postes' | translate }}</a></div> }
      @else {
        <div class="grid">
          @for (a of items(); track a.id) {
            <article class="card">
              <div class="row between"><h3 style="margin:0">{{ a.position.title }}</h3>
                <span class="badge" [class.ok]="a.status === 'accepted'" [class.bad]="a.status === 'rejected'" [class.warn]="a.status !== 'accepted' && a.status !== 'rejected'">{{ st(a.status) | translate }}</span></div>
              <p class="muted small">{{ a.position.university.name }} · {{ a.position.type }} · {{ 'envoyée le' | translate }} {{ a.created_at | date: (i18n.language() === 'en' ? 'MMM d, y' : 'dd/MM/yyyy') }}</p>
            </article>
          }
        </div>
      }
    </div></div>`,
})
export class MyApplicationsComponent implements OnInit {
  private api = inject(ApiService);
  i18n = inject(I18nService);
  items = signal<Application[]>([]); loading = signal(true); error = signal<number | null>(null);
  st = (s: string) => APP_STATUS[s] ?? s;
  ngOnInit() { this.load(); }
  load() {
    this.loading.set(true);
    this.error.set(null);
    this.api.myApplications().subscribe({
      next: r => { this.items.set(r.data); this.loading.set(false); },
      error: e => { this.loading.set(false); this.error.set(toApiError(e).status ?? 500); },
    });
  }
}
