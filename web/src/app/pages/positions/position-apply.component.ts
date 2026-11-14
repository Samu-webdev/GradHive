import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, Subscription, debounceTime, switchMap } from 'rxjs';
import { ApiService, toApiError } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { Check, CheckPayload, Eligibility, Position } from '../../core/models';
import { LEVEL_LABELS } from '../../core/labels';
import { daysLeft } from './positions-list.component';
import { ErrorViewComponent } from '../../shared/error-view.component';
import { TranslatePipe } from '../../shared/translate.pipe';
import { I18nService } from '../../core/i18n.service';

const MAX_DOC_MB = 5;

@Component({
  selector: 'app-position-apply',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, DatePipe, ErrorViewComponent, TranslatePipe],
  template: `
    <div class="page"><div class="container">
      <a routerLink="/postes" class="small">{{ '← Tous les postes' | translate }}</a>
      @if (pos(); as p) {
        <div class="head card">
          <div class="chips"><span class="badge" [class.ta]="p.type === 'TA'" [class.ra]="p.type === 'RA'">{{ (p.type === 'TA' ? 'Assistanat d’enseignement (TA)' : 'Assistanat de recherche (RA)') | translate }}</span>
            <span class="badge">{{ p.university.country | translate }}</span><span class="badge warn">{{ p.field | translate }}</span>
            @if (isClosed()) { <span class="badge bad">{{ 'Clôturé' | translate }}</span> } @else { <span class="badge ok">{{ 'Ouvert · J-' | translate }}{{ left() }}</span> }</div>
          <h1>{{ p.title }}</h1>
          <p class="muted">{{ p.university.name }} · {{ p.university.city | translate }} · {{ p.department | translate }}</p>
          <p>{{ p.description }}</p>
          <p class="small"><b>{{ 'Financement :' | translate }}</b> {{ p.funding }} · <b>{{ p.seats }}</b> {{ 'place(s)' | translate }} · {{ 'Date limite' | translate }} <b>{{ p.deadline | date: (i18n.language() === 'en' ? 'MMM d, y' : 'dd/MM/yyyy') }}</b></p>
        </div>

        <div class="layout">
          <section class="card">
            <h2>{{ 'Votre candidature' | translate }}</h2>
            @if (!auth.isLoggedIn()) {
              <div class="alert info">{{ 'Vous pouvez vérifier votre éligibilité sans compte. Pour envoyer votre candidature,' | translate }} <a [routerLink]="['/connexion']" [queryParams]="{ redirect: '/postes/' + p.id }">{{ 'connectez-vous' | translate }}</a> {{ 'ou' | translate }} <a routerLink="/inscription">{{ 'créez un compte étudiant' | translate }}</a>.</div>
            } @else if (!auth.hasRole('student')) {
              <div class="alert warn">{{ 'Seuls les comptes étudiants peuvent postuler à un poste.' | translate }}</div>
            }
            @if (isClosed()) { <div class="alert error">{{ 'La date limite de candidature est dépassée.' | translate }}</div> }
            @if (error()) { <div class="alert error" role="alert">{{ error() | translate }}</div> }
            <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
              <div class="two">
                <div class="field"><label for="level">{{ 'Niveau d’études actuel' | translate }}</label>
                  <select id="level" formControlName="level">@for (l of levels; track l[0]) { <option [value]="l[0]">{{ l[1] | translate }}</option> }</select></div>
                <div class="field"><label for="gpa">{{ 'Moyenne générale (sur 20)' | translate }}</label>
                  <input id="gpa" type="number" step="0.1" min="0" max="20" formControlName="gpa" [class.invalid]="bad('gpa')" placeholder="ex. 14.5">
                  @if (bad('gpa')) { <span class="err">{{ 'Saisissez une moyenne entre 0 et 20.' | translate }}</span> }</div>
              </div>

              @if (testNames().length) {
                <fieldset class="fs"><legend>{{ 'Test de langue' | translate }}</legend>
                  @if (p.language_waiver_allowed) {
                    <label class="chk"><input type="checkbox" formControlName="language_waiver"> {{ 'Je suis dispensé(e) (études antérieures dans la langue d’enseignement)' | translate }}</label>
                  }
                  @if (!form.controls.language_waiver.value) {
                    <div class="two">
                      <div class="field"><label for="lt">{{ 'Test passé' | translate }}</label>
                        <select id="lt" formControlName="language_test"><option value="">{{ 'Choisir…' | translate }}</option>
                          @for (t of testNames(); track t) { <option [value]="t">{{ t }} (min. {{ p.language_requirements[t] }})</option> }</select></div>
                      <div class="field"><label for="ls">{{ 'Score obtenu' | translate }}</label><input id="ls" type="number" step="0.5" formControlName="language_score"></div>
                    </div>
                  }
                </fieldset>
              }

              <fieldset class="fs"><legend>{{ 'Documents requis (PDF,' | translate }} {{ maxDoc }} {{ 'Mo max.)' | translate }}</legend>
                @for (d of p.required_documents_labels; track d.key) {
                  <div class="doc">
                    <span class="docname">{{ d.label | translate }}</span>
                    <label class="btn ghost sm filebtn">{{ (files()[d.key] ? 'Remplacer' : 'Choisir un fichier') | translate }}
                      <input type="file" accept="application/pdf,.pdf" hidden (change)="onFile(d.key, $event)"></label>
                    @if (files()[d.key]; as f) { <span class="ok small">✔ {{ f.name }}</span> }
                    @if (docErr()[d.key]) { <span class="err">{{ docErr()[d.key] }}</span> }
                  </div>
                }
              </fieldset>

              <div class="field"><label for="m">{{ 'Message au comité d’admission' | translate }}</label>
                <textarea id="m" formControlName="motivation" [class.invalid]="bad('motivation')" [placeholder]="'Présentez votre parcours et votre motivation (50 caractères minimum)' | translate"></textarea>
                @if (bad('motivation')) { <span class="err">{{ (serverErr()['motivation'] || ['50 caractères minimum.'])[0] | translate }}</span> }</div>

              @if (auth.isLoggedIn()) {
                <button class="btn block" type="submit" [disabled]="sending() || isClosed() || !auth.hasRole('student')">
                  {{ (sending() ? 'Envoi…' : (elig()?.eligible ? 'Envoyer ma candidature' : 'Envoyer (conditions non remplies)')) | translate }}</button>
              } @else {
                <a class="btn block" [routerLink]="['/connexion']" [queryParams]="{ redirect: '/postes/' + p.id }">{{ 'Se connecter pour postuler' | translate }}</a>
              }
            </form>
          </section>

          <aside class="card sticky" aria-live="polite">
            <h2>{{ 'Conditions d’admission' | translate }}</h2>
            <p class="small muted">{{ 'Vérification instantanée selon les exigences de' | translate }} {{ p.university.name }}.</p>
            @if (elig(); as e) {
              <div class="verdict" [class.yes]="e.eligible">{{ (e.eligible ? '✔ Vous remplissez toutes les conditions' : (missing() + ' condition(s) à remplir')) | translate }}</div>
              <ul class="checks">@for (c of e.checks; track c.key) {
                <li [class.ok]="c.ok"><span class="ic">{{ c.ok ? '✔' : '✖' }}</span><div><b>{{ c.label | translate }}</b><small>{{ 'Votre valeur :' | translate }} {{ c.actual }}</small></div></li> }</ul>
            } @else if (eligibilityError()) {
              <div class="alert error" role="alert">{{ 'La vérification des conditions est momentanément indisponible.' | translate }}</div>
              <button class="btn ghost sm" type="button" (click)="retryEligibility()">{{ 'Réessayer' | translate }}</button>
            } @else { <div class="spinner" role="status"></div> }
          </aside>
        </div>
      } @else if (loading()) { <div class="spinner"></div> }
      @else { <app-error-view [status]="positionError()" [compact]="true" (retry)="loadPosition()" /> }
    </div></div>`,
  styles: [`
    .head h1 { margin: .8rem 0 .3rem; }
    .layout { display: grid; grid-template-columns: 1.4fr 1fr; gap: 1.2rem; margin-top: 1.2rem; align-items: start; }
    .sticky { position: sticky; top: 84px; }
    @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } .sticky { position: static; order: -1; } }
    .fs { border: 1.5px solid var(--line); border-radius: 12px; padding: .8rem 1rem; margin: 0 0 1rem; } .fs legend { font-weight: 700; color: var(--navy); padding: 0 .4rem; font-size: .92rem; }
    .chk { display: flex; gap: .6rem; align-items: center; font-size: .92rem; margin-bottom: .8rem; } .chk input { width: auto; }
    .doc { display: flex; align-items: center; gap: .7rem; flex-wrap: wrap; padding: .45rem 0; border-bottom: 1px dashed var(--line); } .doc:last-child { border-bottom: 0; }
    .docname { flex: 1 1 200px; font-weight: 600; font-size: .92rem; } .filebtn { margin: 0; } .ok { color: var(--ok); }
    .verdict { background: var(--bad-bg); color: #8f2121; transition: background .3s, color .3s; border-radius: 10px; padding: .6rem .8rem; font-weight: 700; margin-bottom: .8rem; } .verdict.yes { background: var(--ok-bg); color: #14693c; }
    .checks { list-style: none; padding: 0; margin: 0; } .checks li { display: flex; gap: .6rem; padding: .5rem 0; border-bottom: 1px solid var(--line); }
    .checks li:last-child { border-bottom: 0; } .checks small { display: block; color: var(--muted); } .checks b { font-size: .9rem; }
    .ic { width: 22px; height: 22px; border-radius: 50%; display: grid; place-items: center; font-size: .75rem; background: var(--bad-bg); color: var(--bad); flex: none; margin-top: 2px; }
    li.ok .ic { background: var(--ok-bg); color: var(--ok); }
  `],
})
export class PositionApplyComponent implements OnInit, OnDestroy {
  private api = inject(ApiService); private fb = inject(FormBuilder); private route = inject(ActivatedRoute);
  private router = inject(Router); private toast = inject(ToastService);
  i18n = inject(I18nService);
  auth = inject(AuthService);
  maxDoc = MAX_DOC_MB; levels = Object.entries(LEVEL_LABELS);
  pos = signal<Position | null>(null); loading = signal(true);
  positionError = signal(404);
  elig = signal<Eligibility | null>(null);
  eligibilityError = signal(false);
  files = signal<Record<string, File>>({}); docErr = signal<Record<string, string>>({});
  sending = signal(false); error = signal(''); serverErr = signal<Record<string, string[]>>({});
  left = computed(() => { const p = this.pos(); return p ? daysLeft(p.deadline) : 0; });
  isClosed = computed(() => this.left() < 0);
  testNames = computed(() => Object.keys(this.pos()?.language_requirements ?? {}));
  missing = computed(() => (this.elig()?.checks ?? []).filter((c: Check) => !c.ok).length);

  form = this.fb.nonNullable.group({
    level: ['master'], gpa: [null as number | null, [Validators.required, Validators.min(0), Validators.max(20)]],
    language_test: [''], language_score: [null as number | null], language_waiver: [false],
    motivation: ['', [Validators.required, Validators.minLength(50)]],
  });
  private trigger = new Subject<void>(); private sub = new Subscription();

  ngOnInit() {
    const lvl = this.auth.user()?.level; if (lvl) this.form.controls.level.setValue(lvl);
    this.sub.add(this.trigger.pipe(debounceTime(300), switchMap(() => {
      this.eligibilityError.set(false);
      return this.api.check(this.positionId(), this.payload());
    })).subscribe({
      next: e => { this.elig.set(e); this.eligibilityError.set(false); },
      error: () => { this.elig.set(null); this.eligibilityError.set(true); },
    }));
    this.sub.add(this.form.valueChanges.subscribe(() => this.trigger.next()));
    this.loadPosition();
  }
  ngOnDestroy() { this.sub.unsubscribe(); }

  private positionId(): number {
    return Number(this.route.snapshot.paramMap.get('id'));
  }

  loadPosition(): void {
    const id = this.positionId();
    this.loading.set(true);
    this.pos.set(null);
    if (!Number.isSafeInteger(id) || id < 1) {
      this.positionError.set(404);
      this.loading.set(false);
      return;
    }
    this.api.position(id).subscribe({
      next: response => { this.pos.set(response.data); this.loading.set(false); this.positionError.set(404); this.trigger.next(); },
      error: error => { this.loading.set(false); this.positionError.set(toApiError(error).status ?? 500); },
    });
  }

  retryEligibility(): void {
    this.trigger.next();
  }

  private payload(): CheckPayload {
    const v = this.form.getRawValue();
    return {
      gpa: v.gpa, level: v.level, language_test: v.language_test || null,
      language_score: v.language_score, language_waiver: v.language_waiver, documents: Object.keys(this.files()),
    };
  }
  bad(n: string) { const c = this.form.get(n); return !!c && ((c.invalid && (c.touched || c.dirty)) || !!this.serverErr()[n]); }

  onFile(key: string, e: Event) {
    const input = e.target as HTMLInputElement; const f = input.files?.[0]; if (!f) return;
    const errs = { ...this.docErr() }; delete errs[key];
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) errs[key] = this.i18n.translate('Format PDF requis.');
    else if (f.size > MAX_DOC_MB * 1048576) errs[key] = this.i18n.translate('Fichier trop volumineux (') + `${MAX_DOC_MB} MB max.).`;
    this.docErr.set(errs);
    const files = { ...this.files() };
    if (errs[key]) delete files[key]; else files[key] = f;
    this.files.set(files); input.value = ''; this.trigger.next();
  }

  submit() {
    const p = this.pos(); if (!p) return;
    this.form.markAllAsTouched(); this.error.set(''); this.serverErr.set({});
    if (this.form.invalid) return;
    if (!this.elig()?.eligible) { this.error.set(this.i18n.translate('Vous ne remplissez pas encore toutes les conditions listées à droite.')); return; }
    const v = this.form.getRawValue(); const fd = new FormData();
    fd.append('level', v.level); fd.append('gpa', String(v.gpa)); fd.append('motivation', v.motivation);
    fd.append('language_waiver', v.language_waiver ? '1' : '0');
    if (v.language_test) fd.append('language_test', v.language_test);
    if (v.language_score !== null) fd.append('language_score', String(v.language_score));
    for (const [k, f] of Object.entries(this.files())) fd.append(`documents[${k}]`, f);
    this.sending.set(true);
    this.api.apply(p.id, fd).subscribe({
      next: r => { this.toast.success(r.message); this.router.navigateByUrl('/mes-candidatures'); },
      error: e => {
        this.sending.set(false); const a = toApiError(e);
        this.error.set(a.message); this.serverErr.set(a.errors ?? {});
        const checks = (e as { error?: { checks?: Check[] } }).error?.checks;
        if (checks) this.elig.set({ eligible: false, checks });
      },
    });
  }
}
