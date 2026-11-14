import { Component, computed, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { toApiError } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { LEVEL_LABELS, ROLE_LABELS } from '../../core/labels';
import { I18nService } from '../../core/i18n.service';
import { TranslatePipe } from '../../shared/translate.pipe';

function matchPasswords(g: AbstractControl): ValidationErrors | null {
  return g.get('password')?.value === g.get('password_confirmation')?.value ? null : { mismatch: true };
}
const ROLE_CARDS = [
  { id: 'student', icon: '01', text: 'Présenter mes projets et mon parcours' },
  { id: 'school', icon: '02', text: 'Représenter un établissement' },
  { id: 'company', icon: '03', text: 'Représenter une entreprise' },
  { id: 'mentor', icon: '04', text: 'Partager mon expérience' },
  { id: 'organization', icon: '05', text: 'Représenter une organisation' },
];

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe],
  template: `
    <div class="page"><div class="narrow">
      <div class="card registration">
        <p class="eyebrow">GRADHIVE · {{ 'RÉSEAU INTERNATIONAL' | translate }}</p>
        <h1>{{ 'Créez votre' | translate }} <span class="grad-text">{{ 'profil' | translate }}</span></h1>
        <p class="muted">{{ 'Un espace professionnel pour valoriser les parcours, les projets et les opportunités académiques.' | translate }}</p>
        @if (done()) {
          <div class="alert success" role="status">{{ done() | translate }}</div>
          <a routerLink="/connexion" class="btn">{{ 'Aller à la connexion' | translate }}</a>
        } @else {
          @if (error()) { <div class="alert error" role="alert">{{ error() | translate }}</div> }
          <div class="progress-label"><span>{{ 'ÉTAPE' | translate }} {{ step() }} {{ 'SUR 2' | translate }}</span><b>{{ (step() === 1 ? 'Votre profil' : 'Vos informations') | translate }}</b></div>
          <div class="progress-track" role="progressbar" [attr.aria-valuenow]="step()" aria-valuemin="1" aria-valuemax="2"><span [style.width.%]="step() * 50"></span></div>
          @if (step() === 1) {
            <h2 class="step-title">{{ 'Quel profil vous correspond ?' | translate }}</h2>
            <div class="roles" role="radiogroup" [attr.aria-label]="'Type de profil' | translate">
              @for (r of roles; track r.id) {
                <button type="button" class="role" [class.on]="role() === r.id" role="radio" [attr.aria-checked]="role() === r.id" (click)="pick(r.id)">
                  <span class="i">{{ r.icon }}</span><span class="role-copy"><b>{{ label(r.id) }}</b><small>{{ r.text | translate }}</small></span><span class="selected" aria-hidden="true"></span>
                </button>
              }
            </div>
            <button type="button" class="btn block" (click)="continue()">{{ 'Continuer' | translate }}</button>
          } @else {
          <div class="step-head"><button type="button" class="back" (click)="step.set(1)">{{ '← Modifier le profil' | translate }}</button><span class="badge">{{ label(role()) }}</span></div>
          <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
            <div class="field">
              <label for="name">{{ (role() === 'student' || role() === 'mentor' ? 'Nom complet' : 'Nom de l’organisation') | translate }}</label>
              <input id="name" formControlName="name" [class.invalid]="bad('name')" autocomplete="name">
              @if (bad('name')) { <span class="err">{{ fieldErr('name', 'Ce champ est obligatoire.') | translate }}</span> }
            </div>
            <div class="field">
              <label for="email">{{ 'Adresse e-mail' | translate }}</label>
              <input id="email" type="email" formControlName="email" [class.invalid]="bad('email')" autocomplete="email">
              @if (bad('email')) { <span class="err">{{ fieldErr('email', 'Adresse e-mail invalide.') | translate }}</span> }
            </div>
            <div class="two">
              <div class="field">
                <label for="country">{{ 'Pays' | translate }}</label>
                <input id="country" formControlName="country" [class.invalid]="bad('country')" [placeholder]="'Sénégal' | translate">
                @if (bad('country')) { <span class="err">{{ fieldErr('country', 'Le pays est obligatoire.') | translate }}</span> }
              </div>
              @if (role() !== 'mentor') {
                <div class="field">
                  <label for="institution">{{ (role() === 'student' ? 'École / Université' : 'Nom de l’établissement') | translate }}</label>
                  <input id="institution" formControlName="institution" [class.invalid]="bad('institution')" [placeholder]="role() === 'student' ? 'SUP\\'INFO Dakar' : ''">
                  @if (bad('institution')) { <span class="err">{{ fieldErr('institution', 'Ce champ est obligatoire.') | translate }}</span> }
                  @if (role() === 'student') { <span class="hint">{{ 'Indiquez votre établissement de formation. Son profil lui permet de mettre en valeur les parcours de ses étudiants.' | translate }}</span> }
                </div>
              }
            </div>
            @if (role() === 'student') {
              <div class="two">
                <div class="field">
                  <label for="field">{{ 'Filière' | translate }}</label>
                  <input id="field" formControlName="field_of_study" [class.invalid]="bad('field_of_study')" [placeholder]="'Informatique' | translate">
                  @if (bad('field_of_study')) { <span class="err">{{ fieldErr('field_of_study', 'La filière est obligatoire.') | translate }}</span> }
                </div>
                <div class="field">
                  <label for="level">{{ 'Niveau d’études' | translate }}</label>
                  <select id="level" formControlName="level">
                    @for (l of levels; track l[0]) { <option [value]="l[0]">{{ l[1] | translate }}</option> }
                  </select>
                </div>
              </div>
            }
            <div class="two">
              <div class="field">
                <label for="password">{{ 'Mot de passe' | translate }}</label>
                <input id="password" type="password" formControlName="password" [class.invalid]="bad('password')" autocomplete="new-password">
                <div class="meter" aria-hidden="true"><i [style.width.%]="strength() * 25" [class]="'s' + strength()"></i></div>
                <span class="hint">{{ strengthText() }}</span>
                @if (bad('password')) { <span class="err">{{ fieldErr('password', '8 caractères minimum.') | translate }}</span> }
              </div>
              <div class="field">
                <label for="pc">{{ 'Confirmation' | translate }}</label>
                <input id="pc" type="password" formControlName="password_confirmation" autocomplete="new-password" [class.invalid]="form.touched && form.hasError('mismatch')">
                @if (form.touched && form.hasError('mismatch')) { <span class="err">{{ 'Les mots de passe ne correspondent pas.' | translate }}</span> }
              </div>
            </div>
            <button class="btn block" type="submit" [disabled]="loading()">{{ (loading() ? 'Création…' : 'Créer mon compte') | translate }}</button>
          </form>
          }
          <p class="center small" style="margin-top:1.2rem">{{ 'Déjà inscrit ?' | translate }} <a routerLink="/connexion">{{ 'Se connecter' | translate }}</a></p>
        }
      </div>
    </div></div>`,
  styles: [`
    .registration { padding: clamp(1.25rem, 4vw, 2.4rem); }
    .eyebrow { color: var(--sky-700); font-size: .72rem; font-weight: 750; letter-spacing: .12em; margin-bottom: .65rem; }
    .progress-label { display: flex; justify-content: space-between; gap: 1rem; margin-top: 1.7rem; font-size: .78rem; color: var(--muted); }
    .progress-label b { color: var(--ink); font-size: .88rem; } .progress-track { height: 4px; background: var(--gray-100); border-radius: 4px; margin: .55rem 0 1.25rem; overflow: hidden; }
    .progress-track span { display: block; height: 100%; background: linear-gradient(90deg, var(--sky-500), var(--sky-300)); transition: width .3s var(--ease); }
    .step-title { font-size: 1.14rem; margin: 0 0 .85rem; }
    .roles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: .65rem; margin: 0 0 1.1rem; }
    .role { text-align: left; min-height: 76px; border: 1.5px solid var(--line); background: #fff; border-radius: 13px; padding: .8rem; cursor: pointer; font: inherit; display: flex; align-items: center; gap: .75rem; transition: border-color .2s, background .2s, transform .2s;
      &.on { border-color: var(--sky-400); background: var(--sky-50); } &:hover { border-color: var(--sky-300); transform: translateY(-1px); }
      .i { display: grid; place-items: center; width: 36px; height: 36px; flex: none; border-radius: 10px; background: var(--sky-100); color: var(--sky-700); font-size: .73rem; font-weight: 750; }
      .role-copy { display: grid; gap: .15rem; } small { color: var(--muted); font-size: .75rem; line-height: 1.35; } .selected { margin-left: auto; width: 15px; height: 15px; flex: none; border: 1.5px solid var(--line); border-radius: 50%; }
      &.on .selected { border: 4px solid var(--sky-600); background: white; }
    }
    .step-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; }
    .back { border: 0; background: none; color: var(--sky-700); font: inherit; font-size: .88rem; font-weight: 650; cursor: pointer; padding: .35rem 0; }
    @media (max-width: 520px) { .roles { grid-template-columns: 1fr; } }
    .meter { height: 6px; background: var(--line); border-radius: 3px; overflow: hidden; margin-top: .2rem; }
    .meter i { display: block; height: 100%; transition: width .2s; } .s1 { background: #e66; } .s2 { background: var(--sky-300); } .s3 { background: var(--sky-500); } .s4 { background: var(--ok); }
  `],
})
export class RegisterComponent {
  private fb = inject(FormBuilder); private auth = inject(AuthService);
  private router = inject(Router); private toast = inject(ToastService);
  private i18n = inject(I18nService);
  roles = ROLE_CARDS;
  levels = Object.entries(LEVEL_LABELS);
  role = signal('student');
  step = signal(1);
  loading = signal(false); error = signal(''); done = signal('');
  serverErrors = signal<Record<string, string[]>>({});
  label = (r: string) => this.i18n.translate(ROLE_LABELS[r] ?? r);

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    country: ['', Validators.required],
    institution: ['', Validators.required],
    field_of_study: ['', Validators.required],
    level: ['master'],
    password: ['', [Validators.required, Validators.minLength(8)]],
    password_confirmation: ['', Validators.required],
  }, { validators: matchPasswords });

  private pw = signal('');
  strength = computed(() => {
    const p = this.pw(); let s = 0;
    if (p.length >= 8) s++; if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++; if (/\d/.test(p)) s++; if (/[^A-Za-z0-9]/.test(p) || p.length >= 12) s++;
    return s;
  });
  strengthText = computed(() => this.i18n.translate(['Au moins 8 caractères', 'Faible', 'Moyen', 'Bon', 'Fort'][this.strength()]));

  constructor() { this.form.controls.password.valueChanges.subscribe(v => this.pw.set(v)); }

  pick(r: string) {
    this.role.set(r);
    const needInst = r !== 'mentor', isStudent = r === 'student';
    const c = this.form.controls;
    needInst ? c.institution.addValidators(Validators.required) : c.institution.clearValidators();
    isStudent ? c.field_of_study.addValidators(Validators.required) : c.field_of_study.clearValidators();
    c.institution.updateValueAndValidity(); c.field_of_study.updateValueAndValidity();
  }
  continue() { this.step.set(2); }
  bad(name: string) {
    const c = this.form.get(name);
    return !!c && ((c.invalid && (c.touched || c.dirty)) || !!this.serverErrors()[name]);
  }
  fieldErr(name: string, fallback: string) { return this.i18n.translate(this.serverErrors()[name]?.[0] ?? fallback); }

  submit() {
    this.form.markAllAsTouched(); this.serverErrors.set({});
    if (this.form.invalid) return;
    this.loading.set(true); this.error.set('');
    const v = this.form.getRawValue(); const r = this.role();
    const body: Record<string, unknown> = {
      name: v.name, email: v.email, password: v.password, password_confirmation: v.password_confirmation, role: r, country: v.country,
      institution: r === 'mentor' ? null : v.institution,
      ...(r === 'student' ? { field_of_study: v.field_of_study, level: v.level } : {}),
    };
    this.auth.register(body).subscribe({
      next: res => {
        this.loading.set(false);
        if (res.token) { this.toast.success('Bienvenue sur GradHive.'); this.router.navigateByUrl('/'); }
        else this.done.set(res.message ?? 'Compte créé. Il sera activé après validation.');
      },
      error: e => {
        this.loading.set(false);
        const a = toApiError(e); this.error.set(a.message); this.serverErrors.set(a.errors ?? {});
      },
    });
  }
}
