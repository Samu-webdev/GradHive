import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ApiService, toApiError } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { LEVEL_LABELS, MENTION_LABELS, THEMES, WORK_TYPE_LABELS } from '../../core/labels';
import { I18nService } from '../../core/i18n.service';
import { TranslatePipe } from '../../shared/translate.pipe';

const MAX_MB = 20;

@Component({
  selector: 'app-work-publish',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe],
  template: `
    <div class="page"><div class="narrow" style="width:min(820px,100% - 2rem)">
      <div class="page-head"><h1>{{ 'Présentez votre' | translate }} <span class="grad-text">{{ 'projet' | translate }}</span></h1>
        <p>{{ 'Votre projet sera immédiatement visible du réseau. Sa publication ne constitue pas une validation académique. Les établissements disposent d’un profil distinct pour mettre en valeur les parcours de leurs étudiants.' | translate }}</p></div>
      <div class="card">
        @if (error()) { <div class="alert error" role="alert">{{ error() | translate }}</div> }
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="field"><label for="title">{{ 'Titre du mémoire' | translate }}</label>
            <input id="title" formControlName="title" [class.invalid]="bad('title')" maxlength="250">
            @if (bad('title')) { <span class="err">{{ fe('title', 'Le titre est obligatoire (5 caractères minimum).') | translate }}</span> }</div>
          <div class="field"><label for="abstract">{{ 'Résumé' | translate }}</label>
            <textarea id="abstract" formControlName="abstract" [class.invalid]="bad('abstract')" [placeholder]="'Problématique, méthode, résultats principaux…' | translate"></textarea>
            <span class="hint">{{ form.controls.abstract.value.length }} {{ 'caractères (30 minimum)' | translate }}</span>
            @if (bad('abstract')) { <span class="err">{{ fe('abstract', 'Le résumé est obligatoire (30 caractères minimum).') | translate }}</span> }</div>
          <div class="two">
            <div class="field"><label for="type">{{ 'Type de travail' | translate }}</label>
              <select id="type" formControlName="type">@for (t of workTypes; track t[0]) { <option [value]="t[0]">{{ t[1] | translate }}</option> }</select>
            </div>
            <div class="field"><label for="visibility">{{ 'Visibilité' | translate }}</label>
              <select id="visibility" formControlName="visibility"><option value="public">{{ 'Public' | translate }}</option><option value="private">{{ 'Privé' | translate }}</option></select>
              <span class="hint">{{ 'Les travaux sont publics par défaut. Un travail privé reste accessible uniquement à son auteur.' | translate }}</span>
            </div>
          </div>
          <div class="two">
            <div class="field"><label for="theme">{{ 'Thème' | translate }}</label>
              <select id="theme" formControlName="theme" [class.invalid]="bad('theme')"><option value="">{{ 'Choisir…' | translate }}</option>@for (t of themes; track t) { <option [value]="t">{{ t | translate }}</option> }</select>
              @if (bad('theme')) { <span class="err">{{ fe('theme', 'Le thème est obligatoire.') | translate }}</span> }</div>
            <div class="field"><label for="level">{{ 'Niveau' | translate }}</label>
              <select id="level" formControlName="level">@for (l of levels; track l[0]) { <option [value]="l[0]">{{ l[1] | translate }}</option> }</select></div>
          </div>
          <div class="two">
            <div class="field"><label for="year">{{ 'Année de soutenance' | translate }}</label>
              <input id="year" type="number" formControlName="year" [class.invalid]="bad('year')">
              @if (bad('year')) { <span class="err">{{ fe('year', 'Année invalide.') | translate }}</span> }</div>
            <div class="field"><label for="mention">{{ 'Mention' | translate }}</label>
              <select id="mention" formControlName="mention"><option value="">{{ 'Non renseignée' | translate }}</option>@for (m of mentions; track m[0]) { <option [value]="m[0]">{{ m[1] | translate }}</option> }</select></div>
          </div>
          <div class="field"><label for="supervisor">{{ 'Encadreur (facultatif)' | translate }}</label><input id="supervisor" formControlName="supervisor"></div>
          <div class="field"><label for="kw">{{ 'Mots-clés et technologies' | translate }}</label>
            <input id="kw" formControlName="keywords" [class.invalid]="bad('keywords')" [placeholder]="'mentorat, Laravel, Angular' | translate">
            <span class="hint">{{ 'Séparez les mots-clés par des virgules.' | translate }}</span>
            @if (kwList().length) { <div class="chips">@for (k of kwList(); track k) { <span class="chip">{{ k }}</span> }</div> }
            @if (bad('keywords')) { <span class="err">{{ fe('keywords', 'Au moins un mot-clé est obligatoire.') | translate }}</span> }</div>

          <div class="field">
            <span class="lbl">{{ 'Fichier PDF (20 Mo maximum)' | translate }}</span>
            <label class="drop" [class.has]="file()" [class.invalid]="fileErr()" (dragover)="$event.preventDefault()" (drop)="onDrop($event)">
              <input type="file" accept="application/pdf,.pdf" (change)="onFile($event)" hidden>
              @if (file(); as f) { <span><b>PDF</b> · {{ f.name }} ({{ size(f) }})</span> } @else { <span>{{ 'Glissez votre PDF ici ou' | translate }} <u>{{ 'parcourez' | translate }}</u></span> }
            </label>
            @if (fileErr()) { <span class="err">{{ fileErr() }}</span> }
          </div>
          <div class="row">
            <button class="btn" type="submit" [disabled]="loading()">{{ (loading() ? 'Publication…' : 'Publier mon projet') | translate }}</button>
            <a routerLink="/mes-memoires" class="btn ghost">{{ 'Annuler' | translate }}</a>
          </div>
        </form>
      </div>
    </div></div>`,
  styles: [`
    .drop { display: grid; place-items: center; text-align: center; min-height: 110px; border: 2px dashed #b9c2d4; border-radius: 12px; cursor: pointer; padding: 1rem; background: #fafbff;
      &.has { border-color: var(--ok); background: var(--ok-bg); } &.invalid { border-color: var(--bad); } &:hover { border-color: var(--sky-400); background: var(--sky-50); } transition: all .2s; }
  `],
})
export class WorkPublishComponent {
  private fb = inject(FormBuilder); private api = inject(ApiService);
  private router = inject(Router); private toast = inject(ToastService);
  private i18n = inject(I18nService);
  themes = THEMES; levels = Object.entries(LEVEL_LABELS); mentions = Object.entries(MENTION_LABELS);
  workTypes = Object.entries(WORK_TYPE_LABELS);
  form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(5)]],
    abstract: ['', [Validators.required, Validators.minLength(30)]],
    type: ['project'],
    visibility: ['public'],
    theme: ['', Validators.required],
    level: ['master'],
    year: [new Date().getFullYear(), [Validators.required, Validators.min(1990), Validators.max(new Date().getFullYear() + 1)]],
    mention: [''], supervisor: [''],
    keywords: ['', Validators.required],
  });
  file = signal<File | null>(null); fileErr = signal(''); loading = signal(false); error = signal('');
  serverErrors = signal<Record<string, string[]>>({});
  private kw = signal('');
  kwList = computed(() => this.kw().split(',').map(s => s.trim()).filter(Boolean));
  constructor() { this.form.controls.keywords.valueChanges.subscribe(v => this.kw.set(v)); }

  bad(n: string) { const c = this.form.get(n); return !!c && ((c.invalid && (c.touched || c.dirty)) || !!this.serverErrors()[n]); }
  fe(n: string, fb: string) { return this.i18n.translate(this.serverErrors()[n]?.[0] ?? fb); }
  size(f: File) { return f.size > 1048576 ? `${(f.size / 1048576).toFixed(1)} Mo` : `${Math.ceil(f.size / 1024)} Ko`; }

  private setFile(f: File | undefined) {
    this.fileErr.set(''); this.file.set(null);
    if (!f) return;
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) { this.fileErr.set('Le fichier doit être au format PDF.'); return; }
    if (f.size > MAX_MB * 1048576) { this.fileErr.set(`Le fichier dépasse ${MAX_MB} Mo.`); return; }
    this.file.set(f);
  }
  onFile(e: Event) { this.setFile((e.target as HTMLInputElement).files?.[0]); }
  onDrop(e: DragEvent) { e.preventDefault(); this.setFile(e.dataTransfer?.files?.[0]); }

  submit() {
    this.form.markAllAsTouched(); this.serverErrors.set({}); this.error.set('');
    if (!this.file() && !this.fileErr()) this.fileErr.set('Le fichier PDF est obligatoire.');
    if (this.form.invalid || !this.file()) return;
    const v = this.form.getRawValue(); const fd = new FormData();
    (Object.keys(v) as (keyof typeof v)[]).forEach(k => fd.append(k, String(v[k] ?? '')));
    fd.append('file', this.file() as File);
    this.loading.set(true);
    this.api.createWork(fd).subscribe({
      next: r => { this.toast.success(r.message); this.router.navigateByUrl('/mes-memoires'); },
      error: e => {
        this.loading.set(false); const a = toApiError(e);
        this.error.set(a.message); this.serverErrors.set(a.errors ?? {});
        if (a.errors?.['file']) this.fileErr.set(a.errors['file'][0]);
      },
    });
  }
}
