import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService, toApiError } from '../../core/api.service';
import { FeedItem, InstitutionPost, Member, Opportunity, Work } from '../../core/models';
import { ErrorViewComponent } from '../../shared/error-view.component';
import { TranslatePipe } from '../../shared/translate.pipe';

type HighlightData = { id: number; title: string; message: string; institution: Member | null; student: Member | null };

@Component({
  selector: 'app-feed',
  standalone: true,
  imports: [DatePipe, RouterLink, ErrorViewComponent, TranslatePipe],
  template: `
    <div class="page"><div class="narrow">
      <div class="page-head"><h1>{{ 'Actualités du réseau' | translate }}</h1><p>{{ 'Suivez les projets, opportunités et talents mis en avant sur GradHive.' | translate }}</p></div>
      @if (error() !== null) { <app-error-view [status]="error()" [compact]="true" (retry)="load()" /> }
      @else if (loading()) { <div class="spinner" role="status"></div> }
      @else if (!items().length) { <div class="card empty">{{ 'Aucune actualité pour le moment.' | translate }}</div> }
      @else { <div class="feed">
        @for (item of items(); track item.type + '-' + item.data.id) {
          <article class="card">
            <div class="row between"><span class="badge">{{ typeLabel(item) | translate }}</span><time class="muted small">{{ item.created_at | date:'medium' }}</time></div>
            <h2>{{ title(item) }}</h2><p class="muted small">{{ byline(item) }}</p>
            <p class="content">{{ summary(item) }}</p>
            <a class="btn ghost sm" [routerLink]="link(item)">{{ 'Découvrir' | translate }}</a>
          </article>
        }
      </div> }
    </div></div>`,
  styles: [`.feed { display: grid; gap: 1rem; } .feed h2 { margin: 1rem 0 .3rem; font-size: 1.35rem; } .content { white-space: pre-wrap; }`],
})
export class FeedComponent implements OnInit {
  private readonly api = inject(ApiService);
  readonly items = signal<FeedItem[]>([]);
  readonly loading = signal(true);
  readonly error = signal<number | null>(null);

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.feed().subscribe({
      next: response => { this.items.set(response.data); this.loading.set(false); },
      error: error => { this.error.set(toApiError(error).status ?? 500); this.loading.set(false); },
    });
  }

  typeLabel(item: FeedItem): string {
    return ({
      work: 'Nouveau travail académique', opportunity: 'Nouvelle opportunité',
      highlight: 'Étudiant à l’honneur', institution_post: 'Publication institutionnelle',
    })[item.type];
  }

  title(item: FeedItem): string {
    if (item.type === 'highlight') return (item.data as HighlightData).title;
    return (item.data as Work | Opportunity | InstitutionPost).title;
  }

  summary(item: FeedItem): string {
    if (item.type === 'work') return (item.data as Work).abstract;
    if (item.type === 'opportunity') return (item.data as Opportunity).description;
    if (item.type === 'institution_post') return (item.data as InstitutionPost).body;
    return (item.data as HighlightData).message;
  }

  byline(item: FeedItem): string {
    if (item.type === 'work') {
      const work = item.data as Work;
      return work.author_name + (work.institution ? ` · ${work.institution}` : '');
    }
    if (item.type === 'opportunity') {
      const opportunity = item.data as Opportunity;
      return opportunity.organization_name || opportunity.owner?.name || '';
    }
    if (item.type === 'institution_post') return (item.data as InstitutionPost).institution?.name ?? '';
    const highlight = item.data as HighlightData;
    return [highlight.institution?.name, highlight.student?.name].filter(Boolean).join(' · ');
  }

  link(item: FeedItem): string[] {
    if (item.type === 'work') return ['/memoires', String(item.data.id)];
    if (item.type === 'opportunity') return ['/opportunites', String(item.data.id)];
    if (item.type === 'institution_post') {
      const institution = (item.data as InstitutionPost).institution;
      return institution ? ['/etablissements', String(institution.id)] : ['/annuaire'];
    }
    const student = (item.data as HighlightData).student;
    return student ? ['/etudiants', String(student.id)] : ['/annuaire'];
  }
}
