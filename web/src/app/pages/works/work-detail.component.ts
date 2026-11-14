import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService, toApiError } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Work } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { LEVEL_LABELS, MENTION_LABELS, WORK_TYPE_LABELS } from '../../core/labels';
import { ReportButtonComponent } from '../../shared/report-button.component';
import { TranslatePipe } from '../../shared/translate.pipe';

@Component({
  selector: 'app-work-detail',
  standalone: true,
  imports: [RouterLink, TranslatePipe, ReportButtonComponent],
  template: `
    <div class="page"><div class="container narrow">
      <a routerLink="/memoires" class="back">{{ '← Tous les travaux' | translate }}</a>
      @if (loading()) { <div class="card skeleton" style="height:260px"></div> }
      @else if (error()) { <div class="card empty"><h1>{{ 'Travail indisponible' | translate }}</h1><p>{{ error() | translate }}</p></div> }
      @else {
        @if (work(); as item) {
        <article class="card detail">
          <div class="chips">
            <span class="badge">{{ typeLabel(item.type) | translate }}</span>
            <span class="badge">{{ levelLabel(item.level) | translate }}</span>
            <span class="badge">{{ item.year }}</span>
            @if (item.mention) { <span class="badge ok">{{ mentionLabel(item.mention) | translate }}</span> }
            <span class="badge warn">{{ (item.visibility === 'private' ? 'Privé' : 'Public') | translate }}</span>
          </div>
          <h1>{{ item.title }}</h1>
          <p class="meta">{{ item.author_name }} · {{ item.institution || ('Établissement non renseigné' | translate) }}</p>
          <div class="chips"><span class="chip">{{ item.theme }}</span>@if (item.supervisor) { <span class="chip">{{ 'Encadreur :' | translate }} {{ item.supervisor }}</span> }</div>
          <h2>{{ 'Résumé' | translate }}</h2><p class="abstract">{{ item.abstract }}</p>
          @if (item.keywords.length) { <h2>{{ 'Mots-clés' | translate }}</h2><div class="chips">@for (keyword of item.keywords; track keyword) { <span class="chip">{{ keyword }}</span> }</div> }
          <div class="row between actions">
            <span class="muted small">{{ item.views }} {{ 'vue(s)' | translate }}</span>
            @if (item.file_available && (item.visibility === 'public' || auth.user()?.id === item.author_id)) {
              <button class="btn" type="button" (click)="download(item)">{{ 'Télécharger le PDF' | translate }}</button>
            }
          </div>
          <app-report-button targetType="work" [targetId]="item.id" [ownerId]="item.author_id" />
        </article>
        }
      }
    </div></div>`,
  styles: [`
    .narrow { max-width: 860px; } .back { display: inline-block; margin-bottom: 1rem; text-decoration: none; }
    .detail { padding: clamp(1.25rem, 4vw, 2.5rem); } .detail h1 { margin: 1rem 0 .4rem; font-size: clamp(1.8rem, 5vw, 2.7rem); }
    .detail h2 { margin: 1.6rem 0 .5rem; font-size: 1.15rem; } .meta, .muted { color: var(--muted); }
    .abstract { white-space: pre-line; line-height: 1.8; } .actions { margin-top: 2rem; }
  `],
})
export class WorkDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  auth = inject(AuthService);
  work = signal<Work | null>(null);
  loading = signal(true);
  error = signal('');

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isSafeInteger(id) || id < 1) {
      this.error.set('Travail introuvable.');
      this.loading.set(false);
      return;
    }
    this.api.work(id).subscribe({
      next: response => { this.work.set(response.data); this.loading.set(false); },
      error: error => { this.error.set(toApiError(error).message); this.loading.set(false); },
    });
  }

  typeLabel(type: string): string { return WORK_TYPE_LABELS[type] ?? type; }
  levelLabel(level: string): string { return LEVEL_LABELS[level] ?? level; }
  mentionLabel(mention: string): string { return MENTION_LABELS[mention] ?? mention; }

  download(work: Work): void {
    this.api.downloadWork(work.id).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `work-${work.id}.pdf`;
        anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      error: error => this.toast.error(toApiError(error).message),
    });
  }
}
