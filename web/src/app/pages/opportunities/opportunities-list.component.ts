import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { debounceTime } from 'rxjs';
import { ApiService, toApiError } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Opportunity, OpportunityType } from '../../core/models';
import { LEVEL_LABELS } from '../../core/labels';
import { ToastService } from '../../core/toast.service';
import { ErrorViewComponent } from '../../shared/error-view.component';
import { TranslatePipe } from '../../shared/translate.pipe';

@Component({
  selector: 'app-opportunities-list',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, RouterLink, ErrorViewComponent, TranslatePipe],
  template: `
    <div class="page"><div class="container">
      <div class="row between page-head"><div><h1>{{ (favoritesOnly() ? 'Mes opportunités enregistrées' : 'Opportunités') | translate }}</h1><p>{{ 'Découvrez des emplois, stages, bourses et programmes académiques publiés par des organisations.' | translate }}</p></div>
        @if (auth.hasRole('student')) { <button class="btn ghost sm" type="button" (click)="toggleFavorites()">{{ (favoritesOnly() ? 'Toutes les opportunités' : 'Mes favoris') | translate }}</button> }
      </div>
      @if (!favoritesOnly()) { <form class="filters" [formGroup]="form">
        <input class="grow" type="search" formControlName="q" [placeholder]="'Intitulé, organisation ou domaine' | translate" [attr.aria-label]="'Rechercher' | translate">
        <select formControlName="type" [attr.aria-label]="'Type d’opportunité' | translate">
          <option value="">{{ 'Tous les types' | translate }}</option>
          @for (type of types; track type) { <option [value]="type">{{ typeLabel(type) | translate }}</option> }
        </select>
        <input type="search" formControlName="country" [placeholder]="'Pays' | translate" [attr.aria-label]="'Pays' | translate">
        <input type="search" formControlName="location" [placeholder]="'Ville ou région' | translate" [attr.aria-label]="'Lieu' | translate">
        <select formControlName="study_level" [attr.aria-label]="'Niveau d’études' | translate">
          <option value="">{{ 'Tous niveaux' | translate }}</option><option value="licence">{{ 'Licence' | translate }}</option><option value="master">{{ 'Master' | translate }}</option><option value="doctorat">{{ 'Doctorat' | translate }}</option>
        </select>
        <label class="remote"><input type="checkbox" formControlName="remote"> {{ 'À distance' | translate }}</label>
      </form> }
      @if (loading()) { <div class="spinner" role="status" [attr.aria-label]="'Chargement' | translate"></div> }
      @else if (error() !== null) { <app-error-view [status]="error()" [compact]="true" (retry)="load()" /> }
      @else if (!items().length) { <div class="card empty"><p>{{ 'Aucune opportunité ne correspond à ces critères.' | translate }}</p></div> }
      @else {
        <p class="muted small">{{ items().length }} {{ 'opportunité(s)' | translate }}</p>
        <div class="grid g2">
          @for (item of items(); track item.id) {
            <article class="card lift">
              <div class="row between"><span class="badge">{{ typeLabel(item.type) | translate }}</span>
                @if (auth.hasRole('student')) {
                  <button type="button" class="save" [attr.aria-label]="(item.is_favorited ? 'Retirer des favoris' : 'Ajouter aux favoris') | translate"
                    [attr.aria-pressed]="item.is_favorited" (click)="toggleFavorite(item)">{{ item.is_favorited ? '★' : '☆' }}</button>
                }
              </div>
              <h2 class="title">{{ item.title }}</h2>
              <p class="muted small">{{ item.organization_name || item.owner?.name }} · {{ item.location || item.country || ('Lieu non précisé' | translate) }}</p>
              <div class="chips">
                @if (item.remote) { <span class="chip">{{ 'À distance' | translate }}</span> }
                @if (item.study_level) { <span class="chip">{{ levelLabel(item.study_level) | translate }}</span> }
                @if (item.employment_type) { <span class="chip">{{ item.employment_type }}</span> }
                @if (item.funding) { <span class="chip">{{ item.funding }}</span> }
              </div>
              <p class="summary">{{ item.description }}</p>
              <div class="row between foot">
                <span class="muted small">{{ item.deadline ? (('Date limite :' | translate) + ' ' + (item.deadline | date:'mediumDate')) : ('Candidatures ouvertes' | translate) }}</span>
                <a class="btn sm" [routerLink]="['/opportunites', item.id]">{{ 'Consulter' | translate }}</a>
              </div>
            </article>
          }
        </div>
      }
    </div></div>`,
  styles: [`
    .remote { display: inline-flex; gap: .45rem; align-items: center; white-space: nowrap; color: var(--muted); }
    .remote input { width: auto; } .title { margin: .8rem 0 .4rem; font-size: 1.28rem; }
    .save { border: 0; background: transparent; color: var(--sky-700); font-size: 1.6rem; cursor: pointer; }
    .summary { margin: 1rem 0; display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
    .foot { margin-top: 1.2rem; }
  `],
})
export class OpportunitiesListComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);
  readonly types: OpportunityType[] = ['employment', 'internship', 'scholarship', 'ta', 'ra', 'mobility_program', 'research_program', 'other'];
  readonly form = this.fb.nonNullable.group({ q: '', type: '' as OpportunityType | '', country: '', location: '', study_level: '', remote: false });
  readonly items = signal<Opportunity[]>([]);
  readonly favoritesOnly = signal(false);
  readonly loading = signal(true);
  readonly error = signal<number | null>(null);
  ngOnInit(): void {
    this.load();
    this.form.valueChanges.pipe(debounceTime(250)).subscribe(() => this.load());
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    const request = this.favoritesOnly()
      ? this.api.favoriteOpportunities()
      : this.api.opportunities({ ...this.form.getRawValue(), remote: this.form.controls.remote.value ? 'true' : '' });
    request.subscribe({
      next: response => { this.items.set(response.data); this.loading.set(false); },
      error: error => { this.error.set(toApiError(error).status ?? 500); this.loading.set(false); },
    });
  }

  toggleFavorites(): void {
    this.favoritesOnly.update(value => !value);
    this.load();
  }

  typeLabel(type: OpportunityType): string {
    return ({
      employment: 'Emploi', internship: 'Stage', scholarship: 'Bourse', ta: 'Teaching Assistant (TA)',
      ra: 'Research Assistant (RA)', mobility_program: 'Programme de mobilité',
      research_program: 'Programme de recherche', other: 'Autre',
    })[type];
  }

  levelLabel(level: string): string { return LEVEL_LABELS[level] ?? level; }

  toggleFavorite(item: Opportunity): void {
    this.api.favoriteOpportunity(item.id, !item.is_favorited).subscribe({
      next: () => this.items.update(items => items.map(current => current.id === item.id ? { ...current, is_favorited: !current.is_favorited } : current)),
      error: error => this.toast.error(toApiError(error).message),
    });
  }
}
