import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService, toApiError } from '../../core/api.service';
import { OpportunityApplication, OpportunityApplicationStatus } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { TranslatePipe } from '../../shared/translate.pipe';

@Component({
  selector: 'app-my-opportunity-applications',
  standalone: true,
  imports: [DatePipe, RouterLink, TranslatePipe],
  template: `
    <div class="page"><div class="container">
      <div class="page-head"><h1>{{ 'Mes candidatures aux opportunités' | translate }}</h1><p>{{ 'Suivez l’évolution de vos candidatures et consultez leur historique.' | translate }}</p></div>
      @if (loading()) { <div class="spinner" role="status"></div> }
      @else if (!items().length) { <div class="card empty"><p>{{ 'Vous n’avez envoyé aucune candidature pour le moment.' | translate }}</p><a class="btn" routerLink="/opportunites">{{ 'Découvrir les opportunités' | translate }}</a></div> }
      @else { <div class="grid">
        @for (item of items(); track item.id) {
          <article class="card">
            <div class="row between"><h2>{{ item.opportunity?.title }}</h2><span class="badge" [class.ok]="item.status === 'accepted'" [class.bad]="item.status === 'rejected' || item.status === 'withdrawn'">{{ statusLabel(item.status) | translate }}</span></div>
            <p class="muted small">{{ item.opportunity?.organization_name || item.opportunity?.owner?.name }} · {{ 'Envoyée le' | translate }} {{ item.created_at | date:'mediumDate' }}</p>
            @if (item.motivation) { <p>{{ item.motivation }}</p> }
            @if (item.documents.length) { <div class="chips">@for (doc of item.documents; track doc.id) { <button class="chip document" type="button" (click)="download(item, doc.id)">{{ doc.name }}</button> }</div> }
            <h3 class="history-title">{{ 'Historique' | translate }}</h3>
            <ol class="history">@for (change of item.history ?? []; track $index) {
              <li><b>{{ statusLabel(change.to_status) | translate }}</b> <span class="muted small">{{ change.created_at | date:'medium' }}</span></li>
            }</ol>
            @if (canWithdraw(item.status)) { <button class="btn ghost sm" type="button" [disabled]="busyId() === item.id" (click)="withdraw(item)">{{ 'Retirer ma candidature' | translate }}</button> }
          </article>
        }
      </div> }
    </div></div>`,
  styles: [`.history-title { margin: 1.2rem 0 .4rem; font-size: 1rem; } .history { margin: 0 0 1rem; padding-left: 1.3rem; } .history li { padding: .2rem 0; } .document { border: 0; cursor: pointer; }`],
})
export class MyOpportunityApplicationsComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  readonly items = signal<OpportunityApplication[]>([]);
  readonly loading = signal(true);
  readonly busyId = signal<number | null>(null);

  ngOnInit(): void { this.load(); }

  load(): void {
    this.api.myOpportunityApplications().subscribe({
      next: response => { this.items.set(response.data); this.loading.set(false); },
      error: error => { this.loading.set(false); this.toast.error(toApiError(error).message); },
    });
  }

  canWithdraw(status: OpportunityApplicationStatus): boolean {
    return ['submitted', 'under_review', 'shortlisted'].includes(status);
  }

  statusLabel(status: OpportunityApplicationStatus): string {
    return ({
      submitted: 'Envoyée', under_review: 'En cours d’étude', shortlisted: 'Présélectionnée',
      accepted: 'Acceptée', rejected: 'Refusée', withdrawn: 'Retirée',
    })[status];
  }

  withdraw(item: OpportunityApplication): void {
    this.busyId.set(item.id);
    this.api.withdrawOpportunityApplication(item.id).subscribe({
      next: () => { this.busyId.set(null); this.load(); },
      error: error => { this.busyId.set(null); this.toast.error(toApiError(error).message); },
    });
  }

  download(item: OpportunityApplication, documentId: number): void {
    this.api.opportunityDocument(item.id, documentId).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = item.documents.find(document => document.id === documentId)?.name ?? 'document.pdf';
        link.click();
        URL.revokeObjectURL(url);
      },
      error: error => this.toast.error(toApiError(error).message),
    });
  }
}
