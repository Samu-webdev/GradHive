import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService, toApiError } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { Work } from '../../core/models';
import { LEVEL_LABELS, MENTION_LABELS, WORK_TYPE_LABELS } from '../../core/labels';
import { ErrorViewComponent } from '../../shared/error-view.component';
import { TranslatePipe } from '../../shared/translate.pipe';
import { I18nService } from '../../core/i18n.service';

@Component({
  selector: 'app-my-works',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, ErrorViewComponent, TranslatePipe],
  template: `
    <div class="page"><div class="container">
      <div class="page-head row between"><div><h1>{{ 'Mes' | translate }} <span class="grad-text">{{ 'projets' | translate }}</span></h1><p>{{ 'Les projets que vous présentez au réseau.' | translate }}</p></div>
        <a routerLink="/memoires/publier" class="btn">{{ '+ Nouveau projet' | translate }}</a></div>
      @if (error() !== null) { <app-error-view [status]="error()" [compact]="true" (retry)="load()" /> }
      @else if (loading()) { <div class="skeleton" style="height:120px;border-radius:16px"></div> }
      @else if (!works().length) { <div class="card empty"><p>{{ 'Vous n’avez encore présenté aucun projet.' | translate }}</p><a routerLink="/memoires/publier" class="btn">{{ 'Publier mon premier projet' | translate }}</a></div> }
      @else {
        <div class="grid">
          @for (w of works(); track w.id) {
            <article class="card lift">
              <div class="row between"><div class="chips"><span class="badge">{{ lv(w.level) | translate }}</span><span class="badge">{{ w.year }}</span><span class="badge warn">{{ w.theme | translate }}</span></div>
                <span class="muted small">{{ w.views }} {{ 'vue(s)' | translate }}</span></div>
              <div class="chips"><span class="badge">{{ typeLabel(w.type) | translate }}</span><span class="badge">{{ (w.visibility === 'public' ? 'Public' : 'Privé') | translate }}</span></div>
              <h3 style="margin-top:.6rem">{{ w.title }}</h3>
              <p>{{ w.abstract }}</p>
              <div class="row">
                <a class="btn ghost sm" [routerLink]="['/memoires', w.id]">{{ 'Consulter le détail' | translate }}</a>
                <button class="btn ghost sm" type="button" (click)="startEditing(w)">{{ (editingId() === w.id ? 'Fermer' : 'Modifier') | translate }}</button>
                <button class="btn danger sm" type="button" [disabled]="deletingId() === w.id" (click)="remove(w)">{{ (deletingId() === w.id ? 'Suppression…' : 'Supprimer') | translate }}</button>
              </div>
              @if (editingId() === w.id) {
                <form class="edit-form" [formGroup]="editForm" (ngSubmit)="save(w.id)">
                  <div class="field"><label>{{ 'Titre du travail' | translate }}</label><input formControlName="title" maxlength="250"></div>
                  <div class="field"><label>{{ 'Résumé' | translate }}</label><textarea formControlName="abstract" maxlength="20000"></textarea></div>
                  <div class="two">
                    <div class="field"><label>{{ 'Type de travail' | translate }}</label><select formControlName="type">@for (item of workTypes; track item[0]) { <option [value]="item[0]">{{ item[1] | translate }}</option> }</select></div>
                    <div class="field"><label>{{ 'Visibilité' | translate }}</label><select formControlName="visibility"><option value="public">{{ 'Public' | translate }}</option><option value="private">{{ 'Privé' | translate }}</option></select></div>
                  </div>
                  <div class="two">
                    <div class="field"><label>{{ 'Thème' | translate }}</label><input formControlName="theme" maxlength="100"></div>
                    <div class="field"><label>{{ 'Niveau' | translate }}</label><select formControlName="level"><option value="licence">{{ 'Licence' | translate }}</option><option value="master">{{ 'Master' | translate }}</option><option value="doctorat">{{ 'Doctorat' | translate }}</option></select></div>
                  </div>
                  <div class="two">
                    <div class="field"><label>{{ 'Année' | translate }}</label><input type="number" formControlName="year"></div>
                    <div class="field"><label>{{ 'Mention' | translate }}</label><select formControlName="mention"><option value="">{{ 'Non renseignée' | translate }}</option>@for (item of mentions; track item[0]) { <option [value]="item[0]">{{ item[1] | translate }}</option> }</select></div>
                  </div>
                  <div class="field"><label>{{ 'Encadreur (facultatif)' | translate }}</label><input formControlName="supervisor" maxlength="120"></div>
                  <div class="field"><label>{{ 'Mots-clés et technologies' | translate }}</label><input formControlName="keywords" maxlength="1000"></div>
                  <button class="btn" type="submit" [disabled]="savingId() === w.id || editForm.invalid">{{ (savingId() === w.id ? 'Enregistrement…' : 'Enregistrer les modifications') | translate }}</button>
                </form>
              }
              <div class="row between">
                <p class="muted small">{{ (w.file_name || 'Aucun fichier PDF joint') | translate }}</p>
                @if (w.file_available) {
                  <button class="btn sm" type="button" (click)="download(w)">{{ 'Télécharger le PDF' | translate }}</button>
                } @else {
                  <span class="muted small">{{ 'Document non fourni' | translate }}</span>
                }
              </div>
            </article>
          }
        </div>
      }
    </div></div>`,
  styles: [`
    .edit-form { padding: 1rem; margin-top: 1rem; border-radius: var(--radius); background: var(--sky-50); }
    .field { margin: .8rem 0; } .two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .8rem; }
    .danger { color: var(--bad); } @media (max-width: 640px) { .two { grid-template-columns: 1fr; gap: 0; } }
  `],
})
export class MyWorksComponent implements OnInit {
  private api = inject(ApiService); private toast = inject(ToastService); private fb = inject(FormBuilder);
  private i18n = inject(I18nService);
  works = signal<Work[]>([]); loading = signal(true); error = signal<number | null>(null);
  editingId = signal<number | null>(null);
  savingId = signal<number | null>(null);
  deletingId = signal<number | null>(null);
  lv = (l: string) => LEVEL_LABELS[l] ?? l;
  workTypes = Object.entries(WORK_TYPE_LABELS);
  mentions = Object.entries(MENTION_LABELS);
  typeLabel = (t: string) => WORK_TYPE_LABELS[t] ?? t;
  editForm = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(250)]],
    abstract: ['', [Validators.required, Validators.minLength(30), Validators.maxLength(20000)]],
    theme: ['', [Validators.required, Validators.maxLength(100)]],
    type: ['project'],
    visibility: ['public'],
    level: ['master'],
    year: [new Date().getFullYear(), [Validators.required, Validators.min(1990), Validators.max(new Date().getFullYear() + 1)]],
    mention: [''],
    supervisor: [''],
    keywords: ['', Validators.required],
  });

  startEditing(work: Work): void {
    if (this.editingId() === work.id) { this.editingId.set(null); return; }
    this.editingId.set(work.id);
    this.editForm.reset({
      title: work.title, abstract: work.abstract, theme: work.theme, type: work.type, visibility: work.visibility,
      level: work.level, year: work.year, mention: work.mention ?? '', supervisor: work.supervisor ?? '',
      keywords: work.keywords.join(', '),
    });
  }

  save(id: number): void {
    this.editForm.markAllAsTouched();
    if (this.editForm.invalid) return;
    const values = this.editForm.getRawValue();
    this.savingId.set(id);
    this.api.updateWork(id, {
      title: values.title.trim(), abstract: values.abstract.trim(), theme: values.theme.trim(),
      type: values.type, visibility: values.visibility, level: values.level, year: values.year,
      mention: values.mention || null, supervisor: values.supervisor.trim() || null, keywords: values.keywords.trim(),
    }).subscribe({
      next: response => {
        this.works.update(items => items.map(item => item.id === id ? response.data : item));
        this.savingId.set(null);
        this.editingId.set(null);
        this.toast.success('Travail mis à jour.');
      },
      error: error => { this.savingId.set(null); this.toast.error(toApiError(error).message); },
    });
  }

  remove(work: Work): void {
    if (!window.confirm(this.i18n.translate('Confirmer la suppression de ce travail ?'))) return;
    this.deletingId.set(work.id);
    this.api.deleteWork(work.id).subscribe({
      next: response => {
        this.works.update(items => items.filter(item => item.id !== work.id));
        this.deletingId.set(null);
        this.toast.success(response.message);
      },
      error: error => { this.deletingId.set(null); this.toast.error(toApiError(error).message); },
    });
  }

  download(w: Work) {
    this.api.downloadWork(w.id).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob); const a = document.createElement('a');
        a.href = url; a.download = w.file_name ?? `${w.title.slice(0, 50)}.pdf`; a.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      error: e => this.toast.error(this.i18n.translate(toApiError(e).status === 404 ? 'Le fichier de ce projet n’est plus disponible.' : toApiError(e).message)),
    });
  }
  ngOnInit() { this.load(); }
  load() {
    this.loading.set(true); this.error.set(null);
    this.api.myWorks().subscribe({ next: r => { this.works.set(r.data); this.loading.set(false); }, error: e => { this.loading.set(false); this.error.set(toApiError(e).status ?? 500); } });
  }
}
