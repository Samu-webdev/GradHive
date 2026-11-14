import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable, catchError, distinctUntilChanged, forkJoin, map, of, switchMap, tap } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { I18nService } from '../../core/i18n.service';
import { Member, Opportunity, Position, Work } from '../../core/models';
import { TranslatePipe } from '../../shared/translate.pipe';

type SearchResponse<T> = { data: T; failed: boolean };
interface SearchResultSet {
  works: SearchResponse<Work[]>;
  opportunities: SearchResponse<Opportunity[]>;
  positions: SearchResponse<Position[]>;
  members: SearchResponse<Member[]>;
}

function settle<T>(request: Observable<{ data: T }>, fallback: T): Observable<SearchResponse<T>> {
  return request.pipe(
    map(response => ({ data: response.data, failed: false })),
    catchError(() => of({ data: fallback, failed: true })),
  );
}

@Component({
  selector: 'app-search',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  template: `
    <div class="page"><div class="container">
      <header class="page-head">
        <span class="eyebrow">{{ 'RECHERCHE GRADHIVE' | translate }}</span>
        <h1>{{ 'Résultats de recherche' | translate }}</h1>
        @if (query()) { <p>{{ 'Recherche pour' | translate }} <strong>“{{ query() }}”</strong></p> }
      </header>

      @if (query().length < 2) {
        <div class="card empty">{{ 'Saisissez au moins deux caractères pour lancer la recherche.' | translate }}</div>
      } @else if (loading()) {
        <div class="spinner" role="status" [attr.aria-label]="'Chargement' | translate"></div>
      } @else {
        @if (partialFailure()) {
          <div class="alert warn" role="status">{{ 'Certains résultats sont momentanément indisponibles.' | translate }}</div>
        }
        @if (!works().length && !opportunities().length && !positions().length && !members().length) {
          <div class="card empty">
            <h2>{{ partialFailure() ? ('Résultats indisponibles' | translate) : ('Introuvable' | translate) }}</h2>
            <p>{{ partialFailure() ? ('Réessayez dans quelques instants.' | translate) : ('Aucun résultat ne correspond à cette recherche.' | translate) }}</p>
            @if (partialFailure()) { <button type="button" class="btn ghost" (click)="search(query())">{{ 'Réessayer' | translate }}</button> }
          </div>
        } @else {
          <div class="result-groups">
            @if (works().length) {
              <section class="result-group">
                <h2>{{ 'Travaux académiques' | translate }} <span>{{ works().length }}</span></h2>
                @for (work of works(); track work.id) {
                  <a class="result-card" [routerLink]="['/memoires', work.id]">
                    <span class="kind">{{ 'PROJET' | translate }}</span>
                    <strong>{{ work.title }}</strong>
                    <small>{{ work.author_name }} · {{ work.institution }}</small>
                  </a>
                }
              </section>
            }
            @if (opportunities().length) {
              <section class="result-group">
                <h2>{{ 'Opportunités' | translate }} <span>{{ opportunities().length }}</span></h2>
                @for (item of opportunities(); track item.id) {
                  <a class="result-card" [routerLink]="['/opportunites', item.id]">
                    <span class="kind">{{ opportunityLabel(item.type) | translate }}</span>
                    <strong>{{ item.title }}</strong>
                    <small>{{ item.organization_name || item.owner?.name }} · {{ item.location || item.country }}</small>
                  </a>
                }
              </section>
            }
            @if (positions().length) {
              <section class="result-group">
                <h2>{{ 'Postes TA/RA' | translate }} <span>{{ positions().length }}</span></h2>
                @for (position of positions(); track position.id) {
                  <a class="result-card" [routerLink]="['/postes', position.id]">
                    <span class="kind">{{ position.type }}</span>
                    <strong>{{ position.title }}</strong>
                    <small>{{ position.university.name }} · {{ position.university.country }}</small>
                  </a>
                }
              </section>
            }
            @if (members().length) {
              <section class="result-group">
                <h2>{{ 'Membres et établissements' | translate }} <span>{{ members().length }}</span></h2>
                @for (member of members(); track member.id) {
                  <a class="result-card" [routerLink]="['/membres', member.id]">
                    <span class="kind">{{ roleLabel(member.role) | translate }}</span>
                    <strong>{{ member.name }}</strong>
                    <small>{{ member.headline || member.institution || member.country }}</small>
                  </a>
                }
              </section>
            }
          </div>
        }
      }
    </div></div>`,
  styles: [`
    .eyebrow { color: var(--sky-700); font-size: .68rem; font-weight: 800; letter-spacing: .13em; }
    .page-head h1 { margin-top: .35rem; }
    .page-head p { color: var(--muted); }
    .result-groups { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr)); gap: 1.5rem; }
    .result-group h2 { display: flex; align-items: center; gap: .55rem; margin-bottom: .7rem; font-size: 1.12rem; }
    .result-group h2 span { display: grid; min-width: 24px; height: 24px; place-items: center; border-radius: 50%; color: var(--sky-700); background: var(--sky-100); font-size: .68rem; }
    .result-card { display: grid; gap: .25rem; margin-bottom: .55rem; padding: .9rem 1rem; border: 1px solid var(--line); border-radius: 12px; color: var(--ink); background: #fff; text-decoration: none; transition: border-color .2s, transform .2s, box-shadow .2s; }
    .result-card:hover { transform: translateY(-2px); border-color: var(--sky-300); box-shadow: var(--shadow); }
    .result-card strong { line-height: 1.35; }
    .result-card small { overflow: hidden; color: var(--muted); text-overflow: ellipsis; white-space: nowrap; }
    .kind { color: var(--sky-700); font-size: .6rem; font-weight: 800; letter-spacing: .08em; }
  `],
})
export class SearchComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ApiService);
  readonly i18n = inject(I18nService);
  readonly query = signal('');
  readonly works = signal<Work[]>([]);
  readonly opportunities = signal<Opportunity[]>([]);
  readonly positions = signal<Position[]>([]);
  readonly members = signal<Member[]>([]);
  readonly loading = signal(false);
  readonly partialFailure = signal(false);

  ngOnInit(): void {
    this.route.queryParamMap.pipe(
      map(params => (params.get('q') ?? '').trim()),
      distinctUntilChanged(),
      tap(query => {
        this.query.set(query);
        this.loading.set(query.length >= 2);
        this.partialFailure.set(false);
        this.works.set([]);
        this.opportunities.set([]);
        this.positions.set([]);
        this.members.set([]);
      }),
      switchMap(query => query.length < 2 ? of(null) : this.requests(query)),
    ).subscribe(results => {
      if (!results) {
        this.loading.set(false);
        return;
      }
      this.applyResults(results);
    });
  }

  search(query: string): void {
    this.loading.set(true);
    this.requests(query).subscribe(results => this.applyResults(results));
  }

  private requests(query: string): Observable<SearchResultSet> {
    return forkJoin({
      works: settle(this.api.works({ q: query }), [] as Work[]),
      opportunities: settle(this.api.opportunities({ q: query }), [] as Opportunity[]),
      positions: settle(this.api.positions({ q: query }), [] as Position[]),
      members: settle(this.api.searchPublicMembers(query), [] as Member[]),
    });
  }

  private applyResults(results: SearchResultSet): void {
    this.works.set(results.works.data);
    this.opportunities.set(results.opportunities.data);
    this.positions.set(results.positions.data);
    this.members.set(results.members.data);
    this.partialFailure.set(Object.values(results).some(result => result.failed));
    this.loading.set(false);
  }

  opportunityLabel(type: Opportunity['type']): string {
    return ({
      employment: 'Emploi', internship: 'Stage', scholarship: 'Bourse', ta: 'Teaching Assistant (TA)',
      ra: 'Research Assistant (RA)', mobility_program: 'Programme de mobilité',
      research_program: 'Programme de recherche', other: 'Autre',
    })[type];
  }

  roleLabel(role: Member['role']): string {
    return ({
      student: 'Étudiant / Diplômé', school: 'École / Université', company: 'Entreprise',
      mentor: 'Mentor', organization: 'Organisme', admin: 'Administrateur',
    })[role];
  }
}
