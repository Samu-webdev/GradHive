import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { debounceTime } from 'rxjs';
import { RouterLink } from '@angular/router';
import { ApiService, toApiError } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { Work } from '../../core/models';
import { LEVEL_LABELS, MENTION_LABELS, WORK_TYPE_LABELS } from '../../core/labels';
import { ErrorViewComponent } from '../../shared/error-view.component';
import { RevealDirective } from '../../shared/reveal.directive';
import { ActivatedRoute } from '@angular/router';
import { TranslatePipe } from '../../shared/translate.pipe';
import { I18nService } from '../../core/i18n.service';

@Component({
  selector: 'app-works-list',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, ErrorViewComponent, RevealDirective, TranslatePipe],
  template: `
    <div class="page"><div class="container">
      <div class="page-head row between">
        <div><h1>{{ 'Projets et' | translate }} <span class="grad-text">{{ 'mémoires' | translate }}</span></h1><p>{{ 'Découvrez les travaux publiés par les étudiants. Les établissements disposent d’un profil distinct pour mettre en valeur les parcours de leurs étudiants.' | translate }}</p></div>
        @if (auth.hasRole('student')) { <a routerLink="/memoires/publier" class="btn honey">{{ '+ Publier mon projet' | translate }}</a> }
      </div>
      <form class="filters" [formGroup]="form">
        <input class="grow" formControlName="q" type="search" [placeholder]="'Titre, thème, auteur, mot-clé…' | translate" [attr.aria-label]="'Rechercher' | translate">
        <select formControlName="level" [attr.aria-label]="'Niveau' | translate"><option value="">{{ 'Tous niveaux' | translate }}</option>@for (l of levels; track l[0]) { <option [value]="l[0]">{{ l[1] | translate }}</option> }</select>
        <select formControlName="type" [attr.aria-label]="'Type de travail' | translate"><option value="">{{ 'Tous les types' | translate }}</option>@for (t of workTypes; track t[0]) { <option [value]="t[0]">{{ t[1] | translate }}</option> }</select>
        <select formControlName="mention" [attr.aria-label]="'Mention' | translate"><option value="">{{ 'Toutes mentions' | translate }}</option>@for (m of mentions; track m[0]) { <option [value]="m[0]">{{ m[1] | translate }}</option> }</select>
        <input formControlName="year" type="number" [placeholder]="'Année' | translate" [attr.aria-label]="'Année' | translate" style="width:110px">
        <input formControlName="institution" [placeholder]="'Établissement' | translate" [attr.aria-label]="'Établissement' | translate">
        <input formControlName="field_of_study" [placeholder]="'Filière' | translate" [attr.aria-label]="'Filière' | translate">
      </form>
      @if (loading()) { <div class="grid g2">@for (n of [1,2,3,4]; track n) { <div class="skeleton" style="height:210px;border-radius:16px"></div> }</div> }
      @else if (error() !== null) { <app-error-view [status]="error()" [compact]="true" (retry)="load()" /> }
      @else if (!works().length) { <div class="card empty"><p>{{ 'Aucun projet ne correspond à votre recherche.' | translate }}</p></div> }
      @else {
        <p class="muted small">{{ works().length }} {{ 'résultat(s)' | translate }}</p>
        <div class="grid g2">
          @for (w of works(); track w.id; let i = $index) {
            <article class="card lift work" [appReveal]="($index % 4) * 70">
              <div class="chips"><span class="badge">{{ workType(w.type || 'project') | translate }}</span><span class="badge">{{ lv(w.level) | translate }}</span><span class="badge">{{ w.year }}</span>
                @if (w.mention) { <span class="badge ok">{{ mn(w.mention) | translate }}</span> }<span class="badge warn">{{ w.theme | translate }}</span></div>
              <h3><a [routerLink]="['/memoires', w.id]">{{ w.title }}</a></h3>
              <p class="muted small">{{ w.author_name }} · {{ w.institution }}@if (w.supervisor) { · {{ 'Encadreur :' | translate }} {{ w.supervisor }} }</p>
              <p class="abstract" [class.clamp]="open() !== w.id">{{ w.abstract }}</p>
              <div class="chips">@for (k of w.keywords; track k) { <span class="chip">{{ k }}</span> }</div>
              <div class="row" style="margin-top:1rem">
                <button class="btn ghost sm" type="button" [attr.aria-expanded]="open() === w.id" (click)="open.set(open() === w.id ? 0 : w.id)">{{ (open() === w.id ? 'Réduire le résumé' : 'Lire le résumé complet') | translate }}</button>
                @if (w.file_available) {
                  @if (w.visibility === 'public' || auth.user()?.id === w.author_id) {
                    <button class="btn sm" type="button" (click)="download(w)">{{ 'Télécharger le PDF' | translate }}</button>
                  } @else {
                    <span class="muted small">{{ 'Document privé' | translate }}</span>
                  }
                } @else {
                  <span class="muted small file-status">{{ 'Document non fourni' | translate }}</span>
                }
              </div>
              <a class="small" [routerLink]="['/memoires', w.id]">{{ 'Consulter le détail' | translate }} →</a>
            </article>
          }
        </div>
      }
    </div></div>`,
  styles: [`.clamp { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; } .work h3 { margin-top: .7rem; } .abstract { line-height: 1.75; white-space: pre-line; } .file-status { padding: .42rem .2rem; }`],
})
export class WorksListComponent implements OnInit {
  private api = inject(ApiService); private fb = inject(FormBuilder); private toast = inject(ToastService);
  private i18n = inject(I18nService);
  auth = inject(AuthService);
  levels = Object.entries(LEVEL_LABELS); mentions = Object.entries(MENTION_LABELS); workTypes = Object.entries(WORK_TYPE_LABELS);
  lv = (l: string) => LEVEL_LABELS[l] ?? l; mn = (m: string) => MENTION_LABELS[m] ?? m;
  workType = (type: string) => WORK_TYPE_LABELS[type] ?? type;
  form = this.fb.nonNullable.group({ q: [''], level: [''], type: [''], mention: [''], year: [''], institution: [''], field_of_study: [''] });
  private route = inject(ActivatedRoute);
  works = signal<Work[]>([]); loading = signal(true); open = signal(0); error = signal<number | null>(null);
  ngOnInit() {
    const q = this.route.snapshot.queryParamMap.get('q'); if (q) this.form.controls.q.setValue(q, { emitEvent: false });
    this.load();
    this.form.valueChanges.pipe(debounceTime(300)).subscribe(() => this.load());
  }
  load() {
    this.loading.set(true); this.error.set(null);
    this.api.works(this.form.getRawValue()).subscribe({
      next: r => { this.works.set(r.data); this.loading.set(false); },
      error: e => { this.loading.set(false); this.error.set(toApiError(e).status ?? 500); },
    });
  }
  download(w: Work) {
    this.api.downloadWork(w.id).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob); const a = document.createElement('a');
        a.href = url; a.download = `${w.title.slice(0, 50)}.pdf`; a.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      error: e => this.toast.error(this.i18n.translate(toApiError(e).status === 404 ? 'Le fichier de ce projet n’est plus disponible.' : toApiError(e).message)),
    });
  }
}
