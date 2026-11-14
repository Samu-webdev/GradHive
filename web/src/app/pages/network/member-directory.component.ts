import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { debounceTime } from 'rxjs';
import { ApiService, toApiError } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { LEVEL_LABELS, ROLE_LABELS } from '../../core/labels';
import { Member } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { I18nService } from '../../core/i18n.service';
import { ErrorViewComponent } from '../../shared/error-view.component';
import { TranslatePipe } from '../../shared/translate.pipe';

@Component({
  selector: 'app-member-directory',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, ErrorViewComponent, TranslatePipe],
  template: `
    <div class="page"><div class="container">
      <div class="page-head"><h1>{{ 'Annuaire des membres' | translate }}</h1><p>{{ 'Découvrez les étudiants, établissements, entreprises, mentors et organismes de GradHive.' | translate }}</p></div>
      <form class="filters" [formGroup]="form">
        <input class="grow" type="search" formControlName="q" [placeholder]="'Nom, établissement, domaine…' | translate" [attr.aria-label]="'Rechercher' | translate">
        <select formControlName="role" [attr.aria-label]="'Type de membre' | translate"><option value="">{{ 'Tous les profils' | translate }}</option>@for (role of roles; track role[0]) { <option [value]="role[0]">{{ role[1] | translate }}</option> }</select>
        <select formControlName="level" [attr.aria-label]="'Niveau' | translate"><option value="">{{ 'Tous niveaux' | translate }}</option>@for (level of levels; track level[0]) { <option [value]="level[0]">{{ level[1] | translate }}</option> }</select>
        <input formControlName="country" [placeholder]="'Pays' | translate" [attr.aria-label]="'Pays' | translate">
      </form>

      @if (loading()) { <div class="grid g3">@for (i of [1,2,3,4,5,6]; track i) { <div class="card skeleton" style="height:190px"></div> }</div> }
      @else if (error() !== null) { <app-error-view [status]="error()" [compact]="true" (retry)="load()" /> }
      @else if (!members().length) { <div class="card empty">{{ 'Aucun membre ne correspond à ces critères.' | translate }}</div> }
      @else {
        <p class="muted small">{{ total() }} {{ 'membre(s)' | translate }}</p>
        <div class="grid g3">
          @for (member of members(); track member.id) {
            <article class="card member lift">
              <div class="eyebrow">{{ roleLabel(member.role) | translate }}</div>
              <h2><a [routerLink]="profileLink(member)">{{ member.name }}</a></h2>
              @if (member.headline) { <p>{{ member.headline }}</p> }
              @if (member.institution) { <p class="muted small">{{ member.institution }}</p> }
              <div class="chips">
                @if (member.field_of_study) { <span class="chip">{{ member.field_of_study }}</span> }
                @if (member.level) { <span class="badge">{{ levelLabel(member.level) | translate }}</span> }
                @if (member.country) { <span class="badge">{{ member.country }}</span> }
              </div>
              @if (auth.isLoggedIn() && member.connection !== 'self') {
                <div class="actions">
                  @switch (member.connection) {
                    @case ('connected') { <span class="badge ok">{{ 'Connecté' | translate }}</span> }
                    @case ('pending_out') { <span class="badge">{{ 'Demande envoyée' | translate }}</span> }
                    @case ('pending_in') { <a routerLink="/connexions" class="btn ghost sm">{{ 'Répondre à la demande' | translate }}</a> }
                    @default { <button class="btn ghost sm" type="button" [disabled]="connectingId() === member.id" (click)="connect(member)">{{ (connectingId() === member.id ? 'Envoi de la demande…' : 'Envoyer une demande') | translate }}</button> }
                  }
                </div>
              }
            </article>
          }
        </div>
      }
    </div></div>`,
  styles: [`
    .member h2 { font-size: 1.15rem; margin: .45rem 0; } .member h2 a { color: inherit; text-decoration: none; }
    .member h2 a:hover { color: var(--sky-700); } .member p { line-height: 1.5; } .eyebrow { color: var(--sky-700); font-size: .75rem; font-weight: 750; text-transform: uppercase; }
    .actions { margin-top: 1rem; } .muted { color: var(--muted); }
  `],
})
export class MemberDirectoryComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  auth = inject(AuthService);
  roles = Object.entries(ROLE_LABELS).filter(([role]) => role !== 'admin');
  levels = Object.entries(LEVEL_LABELS);
  form = this.fb.nonNullable.group({ q: [''], role: [''], country: [''], level: [''] });
  members = signal<Member[]>([]);
  total = signal(0);
  loading = signal(true);
  error = signal<number | null>(null);
  connectingId = signal<number | null>(null);

  ngOnInit(): void {
    this.load();
    this.form.valueChanges.pipe(debounceTime(250)).subscribe(() => this.load());
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.members(this.form.getRawValue()).subscribe({
      next: response => { this.members.set(response.data); this.total.set(response.meta.total); this.loading.set(false); },
      error: error => { this.error.set(toApiError(error).status ?? 500); this.loading.set(false); },
    });
  }

  roleLabel(role: string): string { return ROLE_LABELS[role] ?? role; }
  levelLabel(level: string): string { return LEVEL_LABELS[level] ?? level; }
  profileLink(member: Member): string[] {
    if (member.role === 'student') return ['/etudiants', String(member.id)];
    if (member.role === 'school') return ['/etablissements', String(member.id)];
    return ['/membres', String(member.id)];
  }

  connect(member: Member): void {
    if (!this.auth.isLoggedIn()) return;
    this.connectingId.set(member.id);
    this.api.createConnection(member.id).subscribe({
      next: response => {
        this.connectingId.set(null);
        this.toast.success(this.i18n.translate(response.message));
        this.load();
      },
      error: error => { this.connectingId.set(null); this.toast.error(this.i18n.translate(toApiError(error).message)); },
    });
  }
}
