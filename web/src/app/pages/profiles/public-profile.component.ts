import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService, toApiError } from '../../core/api.service';
import { InstitutionHighlight, Profile, Work } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { ReportButtonComponent } from '../../shared/report-button.component';
import { TranslatePipe } from '../../shared/translate.pipe';

@Component({
  selector: 'app-public-profile',
  standalone: true,
  imports: [RouterLink, TranslatePipe, ReportButtonComponent],
  template: `
    <div class="page"><div class="container">
      @if (loading()) { <div class="card skeleton" style="height:260px"></div> }
      @else if (error()) { <div class="card empty"><h1>{{ 'Profil indisponible' | translate }}</h1><p>{{ error() | translate }}</p><a class="btn" routerLink="/">{{ 'Retour à l’accueil' | translate }}</a></div> }
      @else {
        @if (profile(); as p) {
        <section class="card profile">
          <div class="eyebrow">{{ (p.role === 'student' ? 'Profil étudiant' : 'Profil établissement') | translate }}</div>
          <h1>{{ p.name }}</h1>
          @if (p.headline) { <p class="headline">{{ p.headline }}</p> }
          <div class="chips">
            @if (p.institution) { <span class="badge">{{ p.institution }}</span> }
            @if (p.field_of_study) { <span class="badge">{{ p.field_of_study }}</span> }
            @if (p.level) { <span class="badge">{{ level(p.level) | translate }}</span> }
            @if (p.country) { <span class="badge">{{ p.country }}</span> }
          </div>
          @if (p.bio) { <p class="bio">{{ p.bio }}</p> }
          @if (p.website) { <a [href]="p.website" target="_blank" rel="noopener noreferrer">{{ 'Site Internet' | translate }} ↗</a> }
          <div class="report"><app-report-button targetType="member" [targetId]="p.id" [ownerId]="p.id" /></div>
        </section>

        @if (p.role === 'student') {
          <section class="section">
            <div class="page-head"><h2>{{ 'Travaux académiques publics' | translate }}</h2><p>{{ 'Les travaux sont publiés par les étudiants et ne constituent pas une certification de l’établissement.' | translate }}</p></div>
            @if (worksLoading()) { <div class="skeleton" style="height:130px"></div> }
            @else if (worksError()) { <div class="alert error" role="alert">{{ 'Impossible de charger les travaux publics.' | translate }} <button type="button" class="btn ghost sm" (click)="loadWorks(p.id)">{{ 'Réessayer' | translate }}</button></div> }
            @else if (!works().length) { <div class="card empty">{{ 'Aucun travail public pour le moment.' | translate }}</div> }
            @else {
              <div class="grid g2">
                @for (work of works(); track work.id) {
                  <article class="card work">
                    <div class="chips"><span class="badge">{{ workType(work.type) | translate }}</span><span class="badge">{{ work.year }}</span><span class="badge">{{ level(work.level) | translate }}</span></div>
                    <h3>{{ work.title }}</h3><p class="muted">{{ work.theme }}</p><p>{{ work.abstract }}</p>
                    @if (work.file_available) { <button class="btn sm" type="button" (click)="download(work)">{{ 'Télécharger le PDF' | translate }}</button> }
                  </article>
                }
              </div>
            }
          </section>
        } @else {
          <section class="section">
            <div class="page-head"><h2>{{ 'Étudiants à l’honneur' | translate }}</h2><p>{{ 'Une démarche de valorisation institutionnelle, sans validation académique des travaux.' | translate }}</p></div>
            @if (!p.highlights?.length) { <div class="card empty">{{ 'Aucun étudiant n’est actuellement mis à l’honneur.' | translate }}</div> }
            @else {
              <div class="grid g2">
                @for (item of p.highlights; track item.id) {
                  <article class="card highlight">
                    <div class="eyebrow">{{ 'Mise en avant institutionnelle' | translate }}</div>
                    <h3>{{ item.student_name }}</h3><h4>{{ item.title }}</h4><p>{{ item.message }}</p>
                    <a class="btn ghost sm" [routerLink]="['/etudiants', item.student_id]">{{ 'Découvrir le profil' | translate }}</a>
                  </article>
                }
              </div>
            }
          </section>
        }
      }
      }
    </div></div>`,
  styles: [`
    .profile { padding: clamp(1.5rem, 5vw, 3rem); } .profile h1 { margin: .4rem 0; font-size: clamp(2rem, 6vw, 3.2rem); }
    .eyebrow { color: var(--sky-700); font-weight: 750; letter-spacing: .08em; text-transform: uppercase; font-size: .75rem; }
    .headline { font-size: 1.15rem; color: var(--muted); } .bio { max-width: 760px; white-space: pre-line; line-height: 1.7; margin: 1.4rem 0; }
    .section { margin-top: 2rem; } .work h3 { margin: .8rem 0 .25rem; } .work p { line-height: 1.6; }
    .highlight h3 { margin-bottom: .35rem; } .highlight h4 { color: var(--sky-700); margin: 0; } .highlight p { white-space: pre-line; }
  `],
})
export class PublicProfileComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ApiService);
  private readonly toast = inject(ToastService);
  profile = signal<Profile | null>(null);
  works = signal<Work[]>([]);
  loading = signal(true);
  worksLoading = signal(false);
  worksError = signal(false);
  error = signal('');

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isSafeInteger(id) || id < 1) {
      this.error.set('Profil introuvable.');
      this.loading.set(false);
      return;
    }
    const isInstitution = this.route.snapshot.routeConfig?.path?.startsWith('etablissements/');
    const request = isInstitution ? this.api.institutionProfile(id) : this.api.studentProfile(id);
    request.subscribe({
      next: ({ data }) => {
        this.profile.set(data);
        this.loading.set(false);
        if (data.role === 'student') {
          this.loadWorks(id);
        }
      },
      error: error => { this.error.set(toApiError(error).message); this.loading.set(false); },
    });
  }

  loadWorks(id: number): void {
    this.worksLoading.set(true);
    this.worksError.set(false);
    this.api.works({ author_id: id }).subscribe({
      next: response => { this.works.set(response.data); this.worksLoading.set(false); },
      error: () => { this.worksLoading.set(false); this.worksError.set(true); },
    });
  }

  level(value: string): string {
    return ({ licence: 'Licence', master: 'Master', doctorat: 'Doctorat' } as Record<string, string>)[value] ?? value;
  }
  workType(value: string): string {
    return ({ project: 'Projet académique', thesis: 'Mémoire', dissertation: 'Thèse', publication: 'Publication', portfolio: 'Portfolio' } as Record<string, string>)[value] ?? value;
  }

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
