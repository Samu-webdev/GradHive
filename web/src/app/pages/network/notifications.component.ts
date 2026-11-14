import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService, toApiError } from '../../core/api.service';
import { NotificationItem } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { TranslatePipe } from '../../shared/translate.pipe';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [DatePipe, RouterLink, TranslatePipe],
  template: `
    <div class="page"><div class="narrow">
      <div class="row between page-head"><div><h1>{{ 'Notifications' | translate }}</h1><p>{{ 'Les mises à jour importantes de votre réseau et de vos candidatures.' | translate }}</p></div>
        @if (unread() > 0) { <button class="btn ghost sm" type="button" [disabled]="busy()" (click)="markAllRead()">{{ 'Tout marquer comme lu' | translate }}</button> }
      </div>
      @if (loading()) { <div class="spinner" role="status"></div> }
      @else if (!items().length) { <div class="card empty">{{ 'Vous n’avez aucune notification.' | translate }}</div> }
      @else { <div class="grid">
        @for (item of items(); track item.id) {
          <article class="card notification" [class.unread]="!item.read_at">
            <div class="row between"><b>{{ message(item) | translate }}</b><time class="muted small">{{ item.created_at | date:'medium' }}</time></div>
            <div class="row actions">
              <a class="btn ghost sm" [routerLink]="link(item)">{{ 'Consulter' | translate }}</a>
              @if (!item.read_at) { <button class="btn sm" type="button" [disabled]="busy()" (click)="markRead(item)">{{ 'Marquer comme lu' | translate }}</button> }
            </div>
          </article>
        }
      </div> }
    </div></div>`,
  styles: [`.notification { border-left: 4px solid transparent; } .notification.unread { border-left-color: var(--sky-500); background: #fbfdff; } .actions { margin-top: .8rem; }`],
})
export class NotificationsComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  readonly items = signal<NotificationItem[]>([]);
  readonly unread = signal(0);
  readonly loading = signal(true);
  readonly busy = signal(false);

  ngOnInit(): void { this.load(); }

  load(): void {
    this.api.notifications().subscribe({
      next: response => { this.items.set(response.data); this.unread.set(response.meta.unread_count); this.loading.set(false); },
      error: error => { this.loading.set(false); this.toast.error(toApiError(error).message); },
    });
  }

  message(item: NotificationItem): string {
    const event = item.data['event'];
    if (event === 'connection_request_received') return 'Vous avez reçu une demande de connexion.';
    if (event === 'connection_request_accepted') return 'Votre demande de connexion a été acceptée.';
    if (event === 'connection_request_declined') return 'Votre demande de connexion a été refusée.';
    if (event === 'opportunity_published') return 'Une nouvelle opportunité correspond peut-être à votre parcours.';
    if (event === 'student_highlighted') return 'Votre établissement vous a mis à l’honneur.';
    if (event === 'opportunity_application_received') return 'Une nouvelle candidature a été reçue.';
    if (event === 'opportunity_application_withdrawn') return 'Une candidature a été retirée.';
    if (event === 'opportunity_application_status_changed') {
      const status = item.data['status'];
      if (status === 'under_review') return 'Votre candidature est maintenant en cours d’étude.';
      if (status === 'shortlisted') return 'Votre candidature a été présélectionnée.';
      if (status === 'accepted') return 'Votre candidature a été acceptée.';
      if (status === 'rejected') return 'Votre candidature a été refusée.';
    }
    return 'Vous avez une nouvelle notification GradHive.';
  }

  link(item: NotificationItem): string[] {
    const applicationId = Number(item.data['application_id']);
    const opportunityId = Number(item.data['opportunity_id']);
    if (item.data['event'] === 'opportunity_published' && opportunityId) return ['/opportunites', String(opportunityId)];
    if (item.data['event'] === 'student_highlighted') return ['/mon-profil'];
    if (item.data['event'] === 'opportunity_application_received' || item.data['event'] === 'opportunity_application_withdrawn') {
      return ['/gestion-opportunites'];
    }
    if (applicationId) return ['/mes-candidatures-opportunites'];
    return ['/connexions'];
  }

  markRead(item: NotificationItem): void {
    this.busy.set(true);
    this.api.markNotificationRead(item.id).subscribe({
      next: () => { this.busy.set(false); this.load(); },
      error: error => { this.busy.set(false); this.toast.error(toApiError(error).message); },
    });
  }

  markAllRead(): void {
    this.busy.set(true);
    this.api.markAllNotificationsRead().subscribe({
      next: () => { this.busy.set(false); this.load(); },
      error: error => { this.busy.set(false); this.toast.error(toApiError(error).message); },
    });
  }
}
