import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { debounceTime } from 'rxjs';
import { ApiService, toApiError } from '../../core/api.service';
import { ToastService } from '../../core/toast.service';
import { Position } from '../../core/models';
import { LEVEL_LABELS } from '../../core/labels';
import { ErrorViewComponent } from '../../shared/error-view.component';
import { TranslatePipe } from '../../shared/translate.pipe';
import { I18nService } from '../../core/i18n.service';

export function daysLeft(deadline: string): number {
  const end = new Date(deadline + 'T23:59:59').getTime();
  return Math.ceil((end - Date.now()) / 86400000);
}

@Component({
  selector: 'app-positions-list',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, DatePipe, ErrorViewComponent, TranslatePipe],
  template: `
    <div class="page"><div class="container">
      <div class="page-head"><h1>{{ 'Postes TA / RA' | translate }}</h1>
        <p>{{ 'Assistanats d’enseignement (TA) et de recherche (RA) proposés par les universités. Chaque poste précise ses conditions d’admission : vous pouvez vérifier votre éligibilité avant de postuler.' | translate }}</p></div>
      <div class="alert warn small">{{ 'Les universités et les postes affichés sont des' | translate }} <b>{{ 'données de démonstration' | translate }}</b> : {{ 'vérifiez toujours les conditions officielles auprès de l’université.' | translate }}</div>
      <form class="filters" [formGroup]="form">
        <div class="seg" role="group" [attr.aria-label]="'Type de poste' | translate">
          @for (t of types; track t[0]) { <button type="button" [class.on]="form.controls.type.value === t[0]" (click)="form.controls.type.setValue(t[0])">{{ t[1] | translate }}</button> }
        </div>
        <input class="grow" formControlName="q" type="search" [placeholder]="'Domaine, université, intitulé…' | translate" [attr.aria-label]="'Rechercher' | translate">
        <select formControlName="country" [attr.aria-label]="'Pays' | translate"><option value="">{{ 'Tous les pays' | translate }}</option>@for (c of countries(); track c) { <option [value]="c">{{ c }}</option> }</select>
      </form>
      @if (loading()) { <div class="grid g2">@for (n of [1,2,3,4]; track n) { <div class="skeleton" style="height:230px;border-radius:16px"></div> }</div> }
      @else if (error() !== null) { <app-error-view [status]="error()" [compact]="true" (retry)="load()" /> }
      @else if (!positions().length) { <div class="card empty"><p>{{ 'Aucun poste ne correspond à votre recherche.' | translate }}</p></div> }
      @else {
        <div class="grid g2">
          @for (p of positions(); track p.id) {
            <article class="card lift pos" [class.closed]="closed(p)">
              <div class="row between">
                <div class="chips"><span class="badge" [class.ta]="p.type === 'TA'" [class.ra]="p.type === 'RA'">{{ (p.type === 'TA' ? 'Assistanat d’enseignement (TA)' : 'Assistanat de recherche (RA)') | translate }}</span>
                  <span class="badge">{{ p.university.country | translate }}</span></div>
                @if (closed(p)) { <span class="badge bad">{{ 'Clôturé' | translate }}</span> }
                @else if (daysLeft(p.deadline) <= 30) { <span class="badge warn">J-{{ daysLeft(p.deadline) }}</span> }
              </div>
              <h3>{{ p.title }}</h3>
              <p class="muted small">{{ p.university.name }} · {{ p.university.city }} · {{ p.department }}</p>
              <p class="small"><b>{{ 'Financement :' | translate }}</b> {{ p.funding }}</p>
              <div class="chips">
                <span class="chip">{{ lv(p.required_level) | translate }} {{ 'minimum' | translate }}</span>
                <span class="chip">{{ 'Moyenne ≥' | translate }} {{ p.min_average }}/20</span>
                @for (t of langs(p); track t) { <span class="chip">{{ t }}</span> }
                <span class="chip">{{ p.required_documents.length }} {{ 'documents' | translate }}</span>
              </div>
              <div class="row between" style="margin-top:1rem">
                <span class="small muted">{{ 'Date limite :' | translate }} {{ p.deadline | date: (i18n.language() === 'en' ? 'MMM d, y' : 'dd/MM/yyyy') }} · {{ p.seats }} {{ 'place(s)' | translate }}</span>
                <a [routerLink]="['/postes', p.id]" class="btn sm" [class.ghost]="closed(p)">{{ (closed(p) ? 'Voir les conditions' : 'Vérifier et postuler') | translate }}</a>
              </div>
            </article>
          }
        </div>
      }
    </div></div>`,
  styles: [`.pos h3 { margin-top: .7rem; } .pos.closed { opacity: .8; }`],
})
export class PositionsListComponent implements OnInit {
  private api = inject(ApiService); private fb = inject(FormBuilder); private toast = inject(ToastService);
  i18n = inject(I18nService);
  types: [string, string][] = [['', 'Tous'], ['TA', 'TA'], ['RA', 'RA']];
  form = this.fb.nonNullable.group({ type: [''], q: [''], country: [''] });
  positions = signal<Position[]>([]); loading = signal(true); error = signal<number | null>(null);
  private all = signal<string[]>([]);
  countries = computed(() => this.all());
  daysLeft = daysLeft; closed = (p: Position) => daysLeft(p.deadline) < 0;
  lv = (l: string) => LEVEL_LABELS[l] ?? l;
  langs(p: Position): string[] { return Object.entries(p.language_requirements).map(([t, s]) => `${t} ≥ ${s}`); }
  ngOnInit() {
    this.load();
    this.form.valueChanges.pipe(debounceTime(250)).subscribe(() => this.load());
  }
  load() {
    this.loading.set(true); this.error.set(null);
    this.api.positions(this.form.getRawValue()).subscribe({
      next: r => {
        this.positions.set(r.data); this.loading.set(false);
        if (!this.all().length) this.all.set([...new Set(r.data.map(p => p.university.country))].sort());
      },
      error: e => { this.loading.set(false); this.error.set(toApiError(e).status ?? 500); },
    });
  }
}
