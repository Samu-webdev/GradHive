import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ApiService, toApiError } from '../../core/api.service';
import { LEVEL_LABELS, ROLE_LABELS, WORK_TYPE_LABELS } from '../../core/labels';
import { Member } from '../../core/models';
import { ReportButtonComponent } from '../../shared/report-button.component';
import { TranslatePipe } from '../../shared/translate.pipe';

@Component({
  selector: 'app-member-detail',
  standalone: true,
  imports: [RouterLink, TranslatePipe, ReportButtonComponent],
  template: `
    <div class="page"><div class="container">
      <a routerLink="/annuaire" class="back">{{ '← Retour à l’annuaire' | translate }}</a>
      @if (loading()) { <div class="card skeleton" style="height:260px"></div> }
      @else if (error()) { <div class="card empty"><h1>{{ 'Profil indisponible' | translate }}</h1><p>{{ error() | translate }}</p></div> }
      @else {
        @if (member(); as user) {
        <section class="card profile">
          <div class="eyebrow">{{ roleLabel(user.role) | translate }}</div><h1>{{ user.name }}</h1>
          @if (user.headline) { <p class="headline">{{ user.headline }}</p> }
          <div class="chips">
            @if (user.institution) { <span class="badge">{{ user.institution }}</span> }
            @if (user.field_of_study) { <span class="badge">{{ user.field_of_study }}</span> }
            @if (user.level) { <span class="badge">{{ levelLabel(user.level) | translate }}</span> }
            @if (user.country) { <span class="badge">{{ user.country }}</span> }
            @if (user.connections_count !== undefined) { <span class="badge">{{ user.connections_count }} {{ 'connexion(s)' | translate }}</span> }
          </div>
          @if (user.bio) { <p class="bio">{{ user.bio }}</p> }
          @if (user.website) { <a [href]="user.website" target="_blank" rel="noopener noreferrer">{{ 'Site Internet' | translate }} ↗</a> }
          <div class="report"><app-report-button targetType="member" [targetId]="user.id" [ownerId]="user.id" /></div>
        </section>
        @if (user.works?.length) {
          <section class="section"><h2>{{ 'Travaux académiques publics' | translate }}</h2><div class="grid g2">
            @for (work of user.works; track work.id) {
              <article class="card"><div class="chips"><span class="badge">{{ workType(work.type) | translate }}</span><span class="badge">{{ work.year }}</span></div>
                <h3><a [routerLink]="['/memoires', work.id]">{{ work.title }}</a></h3><p>{{ work.abstract }}</p>
              </article>
              }
          </div></section>
        }
        @if (user.members?.length) {
          <section class="section"><h2>{{ 'Membres de cet établissement' | translate }}</h2><div class="chips">
            @for (student of user.members; track student.id) { <a class="chip" [routerLink]="['/etudiants', student.id]">{{ student.name }}</a> }
          </div></section>
        }
      }
      }
    </div></div>`,
  styles: [`
    .back { display: inline-block; margin-bottom: 1rem; text-decoration: none; } .profile { padding: clamp(1.5rem, 5vw, 3rem); }
    .profile h1 { margin: .4rem 0; font-size: clamp(2rem, 6vw, 3rem); } .eyebrow { color: var(--sky-700); font-size: .75rem; font-weight: 750; text-transform: uppercase; }
    .headline { color: var(--muted); font-size: 1.15rem; } .bio { max-width: 760px; white-space: pre-line; line-height: 1.7; margin: 1.4rem 0; }
    .section { margin-top: 2rem; } .section h2 { font-size: 1.35rem; } article h3 a { text-decoration: none; }
  `],
})
export class MemberDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ApiService);
  member = signal<Member | null>(null);
  loading = signal(true);
  error = signal('');

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isSafeInteger(id) || id < 1) {
      this.error.set('Profil introuvable.');
      this.loading.set(false);
      return;
    }
    this.api.member(id).subscribe({
      next: response => { this.member.set(response.data); this.loading.set(false); },
      error: error => { this.error.set(toApiError(error).message); this.loading.set(false); },
    });
  }

  roleLabel(role: string): string { return ROLE_LABELS[role] ?? role; }
  levelLabel(level: string): string { return LEVEL_LABELS[level] ?? level; }
  workType(type: string): string { return WORK_TYPE_LABELS[type] ?? type; }
}
