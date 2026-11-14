import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, toApiError } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { InstitutionHighlight, Profile, ProfileUpdate, PublicStudent } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { I18nService } from '../../core/i18n.service';
import { TranslatePipe } from '../../shared/translate.pipe';

@Component({
  selector: 'app-my-profile',
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, RouterLink, TranslatePipe],
  template: `
    <div class="page"><div class="container narrow">
      <div class="page-head row between">
        <div><h1>{{ 'Mon profil' | translate }}</h1><p>{{ 'Présentez votre parcours et gérez sa visibilité.' | translate }}</p></div>
        @if (profile(); as p) {
          @if (p.profile_visibility === 'public') {
          <a class="btn ghost" [routerLink]="p.role === 'student' ? ['/etudiants', p.id] : ['/etablissements', p.id]">{{ 'Voir le profil public' | translate }}</a>
          } @else { <span class="muted small">{{ 'Votre profil est privé.' | translate }}</span> }
        }
      </div>

      @if (loading()) { <div class="card skeleton" style="height:280px"></div> }
      @else if (error()) { <div class="alert error" role="alert">{{ error() | translate }}</div><button class="btn" type="button" (click)="load()">{{ 'Réessayer' | translate }}</button> }
      @else {
        <section class="card">
          <h2>{{ 'Informations du profil' | translate }}</h2>
          <form [formGroup]="form" (ngSubmit)="saveProfile()">
            <div class="two">
              <div class="field"><label for="name">{{ 'Nom complet' | translate }}</label><input id="name" formControlName="name" maxlength="120"></div>
              <div class="field"><label for="country">{{ 'Pays' | translate }}</label><input id="country" formControlName="country" maxlength="80"></div>
            </div>
            <div class="field"><label for="headline">{{ 'Titre professionnel ou académique' | translate }}</label><input id="headline" formControlName="headline" maxlength="120"></div>
            <div class="field"><label for="bio">{{ 'Présentation' | translate }}</label><textarea id="bio" formControlName="bio" maxlength="5000"></textarea></div>
            <div class="field"><label for="website">{{ 'Site Internet' | translate }}</label><input id="website" type="url" formControlName="website" placeholder="https://"></div>
            @if (profile()?.role === 'student') {
              <div class="two">
                <div class="field"><label for="institution">{{ 'Établissement' | translate }}</label><input id="institution" formControlName="institution" maxlength="150"></div>
                <div class="field"><label for="field">{{ 'Filière' | translate }}</label><input id="field" formControlName="field_of_study" maxlength="120"></div>
              </div>
              <div class="two">
                <div class="field"><label for="level">{{ 'Niveau d’études' | translate }}</label>
                  <select id="level" formControlName="level"><option value="">{{ 'Non renseigné' | translate }}</option><option value="licence">{{ 'Licence' | translate }}</option><option value="master">{{ 'Master' | translate }}</option><option value="doctorat">{{ 'Doctorat' | translate }}</option></select>
                </div>
                <div class="field"><label for="visibility">{{ 'Visibilité du profil' | translate }}</label>
                  <select id="visibility" formControlName="visibility"><option value="private">{{ 'Privé' | translate }}</option><option value="public">{{ 'Public' | translate }}</option></select>
                  <span class="hint">{{ 'Votre profil est privé par défaut. Seuls les profils publics peuvent être consultés et mis à l’honneur.' | translate }}</span>
                </div>
              </div>
            } @else {
              <div class="field"><label for="institution">{{ 'Nom de l’établissement' | translate }}</label><input id="institution" formControlName="institution" maxlength="150"></div>
              <div class="field"><label for="visibility">{{ 'Visibilité du profil institutionnel' | translate }}</label>
                <select id="visibility" formControlName="visibility"><option value="public">{{ 'Public' | translate }}</option><option value="private">{{ 'Privé' | translate }}</option></select>
              </div>
            }
            <button class="btn" type="submit" [disabled]="saving() || form.invalid">{{ (saving() ? 'Enregistrement…' : 'Enregistrer le profil') | translate }}</button>
          </form>
        </section>

        @if (profile()?.role === 'school') {
          <section class="card highlights">
            <h2>{{ 'Étudiants à l’honneur' | translate }}</h2>
            <p class="muted">{{ 'Cette sélection valorise des parcours et ne constitue pas une certification académique.' | translate }}</p>
            <form class="search" (submit)="$event.preventDefault(); searchStudents()">
              <input name="candidateSearch" [(ngModel)]="candidateSearch" [placeholder]="'Rechercher un étudiant public de votre établissement' | translate">
              <button class="btn ghost" type="submit" [disabled]="searching()">{{ 'Rechercher' | translate }}</button>
            </form>
            @if (candidates().length) {
              <form class="highlight-form" [formGroup]="highlightForm" (ngSubmit)="addHighlight()">
                <div class="field"><label for="candidate">{{ 'Étudiant' | translate }}</label>
                  <select id="candidate" formControlName="student_id"><option value="">{{ 'Sélectionner un étudiant' | translate }}</option>
                    @for (student of candidates(); track student.id) { <option [value]="student.id">{{ student.name }} · {{ student.field_of_study || student.institution }}</option> }
                  </select>
                </div>
                <div class="field"><label for="highlightTitle">{{ 'Titre de la mise en avant' | translate }}</label><input id="highlightTitle" formControlName="title" maxlength="120"></div>
                <div class="field"><label for="highlightMessage">{{ 'Présentation' | translate }}</label><textarea id="highlightMessage" formControlName="message" maxlength="1000"></textarea></div>
                <button class="btn" type="submit" [disabled]="adding() || highlightForm.invalid">{{ (adding() ? 'Enregistrement…' : 'Ajouter à la sélection') | translate }}</button>
              </form>
            }
            @if (highlightsLoading()) { <div class="skeleton" style="height:90px"></div> }
            @else if (!highlights().length) { <p class="empty">{{ 'Aucun étudiant n’est actuellement mis à l’honneur.' | translate }}</p> }
            @else {
              <div class="highlight-list">
                @for (item of highlights(); track item.id; let i = $index) {
                  <article class="highlight">
                    @if (editingId() === item.id) {
                      <form [formGroup]="editHighlightForm" (ngSubmit)="saveHighlight(item.id)">
                        <div class="field"><label>{{ 'Titre' | translate }}</label><input formControlName="title" maxlength="120"></div>
                        <div class="field"><label>{{ 'Présentation' | translate }}</label><textarea formControlName="message" maxlength="1000"></textarea></div>
                        <div class="row"><button class="btn sm" type="submit" [disabled]="savingHighlight() || editHighlightForm.invalid">{{ 'Enregistrer' | translate }}</button><button class="btn ghost sm" type="button" (click)="editingId.set(null)">{{ 'Annuler' | translate }}</button></div>
                      </form>
                    } @else {
                      <div class="row between"><div><b>{{ item.student_name }}</b><p class="muted small">{{ item.title }}</p></div>
                        <div class="row">
                          <button class="btn ghost sm" type="button" [disabled]="orderingHighlights() || i === 0" [attr.aria-label]="'Monter dans la sélection' | translate" (click)="moveHighlight(i, -1)">↑</button>
                          <button class="btn ghost sm" type="button" [disabled]="orderingHighlights() || i === highlights().length - 1" [attr.aria-label]="'Descendre dans la sélection' | translate" (click)="moveHighlight(i, 1)">↓</button>
                          <button class="btn ghost sm" type="button" (click)="editHighlight(item)">{{ 'Modifier' | translate }}</button><button class="btn danger sm" type="button" (click)="removeHighlight(item.id)">{{ 'Retirer' | translate }}</button>
                        </div>
                      </div><p>{{ item.message }}</p>
                    }
                  </article>
                }
              </div>
            }
          </section>
        }
      }
    </div></div>`,
  styles: [`
    .narrow { max-width: 860px; } section + section { margin-top: 1.25rem; } h2 { margin-top: 0; }
    .field { margin-bottom: 1rem; } .two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
    .hint, .muted, .empty { color: var(--muted); font-size: .9rem; } .hint { display: block; margin-top: .35rem; }
    .search { display: flex; gap: .6rem; margin: 1rem 0; } .search input { flex: 1; }
    .highlight-form { padding: 1rem; margin: 1rem 0; background: var(--sky-50); border-radius: var(--radius); }
    .highlight-list { display: grid; gap: .75rem; } .highlight { border: 1px solid var(--line); border-radius: var(--radius); padding: 1rem; }
    .highlight p { margin: .3rem 0 0; } .danger { color: var(--bad); }
    @media (max-width: 640px) { .two { grid-template-columns: 1fr; gap: 0; } .search { flex-direction: column; } }
  `],
})
export class MyProfileComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);

  profile = signal<Profile | null>(null);
  loading = signal(true);
  saving = signal(false);
  error = signal('');
  highlights = signal<InstitutionHighlight[]>([]);
  highlightsLoading = signal(false);
  candidates = signal<PublicStudent[]>([]);
  searching = signal(false);
  adding = signal(false);
  savingHighlight = signal(false);
  orderingHighlights = signal(false);
  editingId = signal<number | null>(null);
  candidateSearch = '';

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    country: [''],
    headline: [''],
    bio: [''],
    website: ['', Validators.pattern(/^$|https?:\/\/.+/i)],
    institution: [''],
    field_of_study: [''],
    level: [''],
    visibility: ['private'],
  });
  highlightForm = this.fb.nonNullable.group({
    student_id: ['', Validators.required],
    title: ['Étudiant à l’honneur', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    message: ['Un parcours que notre établissement souhaite mettre en valeur.', [Validators.required, Validators.minLength(10), Validators.maxLength(1000)]],
  });
  editHighlightForm = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(120)]],
    message: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(1000)]],
  });

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.myProfile().subscribe({
      next: ({ data }) => {
        this.profile.set(data);
        this.form.reset({
          name: data.name ?? '', country: data.country ?? '', headline: data.headline ?? '', bio: data.bio ?? '',
          website: data.website ?? '', institution: data.institution ?? '', field_of_study: data.field_of_study ?? '',
          level: data.level ?? '', visibility: data.profile_visibility ?? 'private',
        });
        this.loading.set(false);
        if (data.role === 'school') this.loadHighlights();
      },
      error: error => { this.error.set(this.i18n.translate(toApiError(error).message)); this.loading.set(false); },
    });
  }

  saveProfile(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || !this.profile()) return;
    this.saving.set(true);
    const values = this.form.getRawValue();
    const visibility = values.visibility === 'public' ? 'public' : 'private';
    const body: ProfileUpdate = {
      name: values.name.trim(), country: values.country.trim(), headline: values.headline.trim(),
      bio: values.bio.trim(), website: values.website.trim(),
    };
    if (this.profile()?.role === 'student') {
      Object.assign(body, {
        institution: values.institution.trim(), field_of_study: values.field_of_study.trim(),
        level: values.level, student_profile_visibility: visibility,
      });
    } else {
      body.institution_profile_visibility = visibility;
      body.institution = values.institution.trim();
    }
    this.api.updateMyProfile(body).subscribe({
      next: ({ data }) => {
        this.profile.set(data);
        this.saving.set(false);
        this.toast.success(this.i18n.translate('Profil mis à jour.'));
        this.auth.refresh();
      },
      error: error => {
        this.saving.set(false);
        this.toast.error(this.i18n.translate(toApiError(error).message));
      },
    });
  }

  searchStudents(): void {
    this.searching.set(true);
    this.api.eligibleStudents(this.candidateSearch.trim()).subscribe({
      next: response => { this.candidates.set(response.data); this.searching.set(false); },
      error: error => { this.searching.set(false); this.toast.error(this.i18n.translate(toApiError(error).message)); },
    });
  }

  loadHighlights(): void {
    this.highlightsLoading.set(true);
    this.api.institutionHighlights().subscribe({
      next: response => { this.highlights.set(response.data); this.highlightsLoading.set(false); },
      error: error => { this.highlightsLoading.set(false); this.toast.error(this.i18n.translate(toApiError(error).message)); },
    });
  }

  addHighlight(): void {
    this.highlightForm.markAllAsTouched();
    if (this.highlightForm.invalid) return;
    this.adding.set(true);
    const values = this.highlightForm.getRawValue();
    this.api.createHighlight({ student_id: Number(values.student_id), title: values.title.trim(), message: values.message.trim() }).subscribe({
      next: () => { this.adding.set(false); this.highlightForm.controls.student_id.setValue(''); this.loadHighlights(); this.toast.success(this.i18n.translate('Mise en avant créée.')); },
      error: error => { this.adding.set(false); this.toast.error(this.i18n.translate(toApiError(error).message)); },
    });
  }

  editHighlight(item: InstitutionHighlight): void {
    this.editingId.set(item.id);
    this.editHighlightForm.reset({ title: item.title, message: item.message });
  }

  saveHighlight(id: number): void {
    this.editHighlightForm.markAllAsTouched();
    if (this.editHighlightForm.invalid) return;
    this.savingHighlight.set(true);
    const values = this.editHighlightForm.getRawValue();
    this.api.updateHighlight(id, { title: values.title.trim(), message: values.message.trim() }).subscribe({
      next: () => { this.savingHighlight.set(false); this.editingId.set(null); this.loadHighlights(); this.toast.success(this.i18n.translate('Mise en avant mise à jour.')); },
      error: error => { this.savingHighlight.set(false); this.toast.error(this.i18n.translate(toApiError(error).message)); },
    });
  }

  removeHighlight(id: number): void {
    this.api.deleteHighlight(id).subscribe({
      next: () => { this.loadHighlights(); this.toast.success(this.i18n.translate('Mise en avant supprimée.')); },
      error: error => this.toast.error(this.i18n.translate(toApiError(error).message)),
    });
  }

  moveHighlight(index: number, offset: -1 | 1): void {
    const items = [...this.highlights()];
    const target = index + offset;
    if (target < 0 || target >= items.length || this.orderingHighlights()) return;
    [items[index], items[target]] = [items[target], items[index]];
    this.orderingHighlights.set(true);
    this.highlights.set(items);
    this.api.reorderHighlights(items.map(item => item.id)).subscribe({
      next: () => this.orderingHighlights.set(false),
      error: error => {
        this.orderingHighlights.set(false);
        this.loadHighlights();
        this.toast.error(this.i18n.translate(toApiError(error).message));
      },
    });
  }
}
