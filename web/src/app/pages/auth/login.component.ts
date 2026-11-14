import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toApiError } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { ToastService } from '../../core/toast.service';
import { TranslatePipe } from '../../shared/translate.pipe';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe],
  template: `
    <div class="page"><div class="narrow auth">
      <div class="card">
        <div class="hi"><div class="mark" aria-hidden="true">GH</div><div><h1>{{ 'Ravi de vous retrouver' | translate }}</h1><p class="muted">{{ 'Connectez-vous pour retrouver vos projets et candidatures.' | translate }}</p></div></div>
        @if (expired) { <div class="alert info" role="status">{{ 'Votre session a expiré. Reconnectez-vous pour continuer.' | translate }}</div> }
        @if (error()) { <div class="alert error" role="alert">{{ error() | translate }}</div> }
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="field">
            <label for="email">{{ 'Adresse e-mail' | translate }}</label>
            <input id="email" type="email" formControlName="email" autocomplete="email" [class.invalid]="show('email')" [placeholder]="'vous@exemple.com' | translate">
            @if (show('email')) { <span class="err">{{ 'Saisissez une adresse e-mail valide.' | translate }}</span> }
          </div>
          <div class="field">
            <label for="password">{{ 'Mot de passe' | translate }}</label>
            <div class="pwd">
              <input id="password" [type]="visible() ? 'text' : 'password'" formControlName="password" autocomplete="current-password" [class.invalid]="show('password')">
              <button type="button" class="eye" (click)="visible.set(!visible())" [attr.aria-label]="(visible() ? 'Masquer le mot de passe' : 'Afficher le mot de passe') | translate">{{ (visible() ? 'Masquer' : 'Afficher') | translate }}</button>
            </div>
            @if (show('password')) { <span class="err">{{ 'Le mot de passe est obligatoire.' | translate }}</span> }
          </div>
          <button class="btn block" type="submit" [disabled]="loading()">{{ (loading() ? 'Connexion…' : 'Se connecter') | translate }}</button>
        </form>
        <p class="center small" style="margin-top:1.2rem">{{ 'Pas encore de compte ?' | translate }} <a routerLink="/inscription">{{ 'Créer un compte' | translate }}</a></p>
        <div class="alert info small demo">{{ 'Compte de démonstration :' | translate }} <b>student&#64;gradhive.test</b> / <b>password</b></div>
      </div>
    </div></div>`,
  styles: [`
    .auth { max-width: 520px; } .pwd { position: relative; } .pwd input { padding-right: 2.8rem; }
    .eye { position: absolute; right: .55rem; top: 50%; transform: translateY(-50%); border: 0; background: none; cursor: pointer; font: inherit; font-size: .75rem; font-weight: 650; color: var(--sky-700); }
    .demo { margin: 1rem 0 0; } .hi { display: flex; align-items: center; gap: .8rem; margin-bottom: 1.5rem; } .hi h1 { font-size: 1.6rem; margin: 0 0 .2rem; }
    .mark { width: 58px; height: 58px; flex: none; display: grid; place-items: center; border-radius: 17px; color: #fff; background: linear-gradient(135deg, var(--sky-600), var(--sky-400)); font-size: 1.12rem; font-weight: 800; letter-spacing: -.04em; }
  `],
})
export class LoginComponent {
  private fb = inject(FormBuilder); private auth = inject(AuthService);
  private router = inject(Router); private route = inject(ActivatedRoute); private toast = inject(ToastService);
  form = this.fb.nonNullable.group({ email: ['', [Validators.required, Validators.email]], password: ['', Validators.required] });
  loading = signal(false); error = signal(''); visible = signal(false);
  expired = this.route.snapshot.queryParamMap.get('expired') === '1';
  show(c: 'email' | 'password') { const x = this.form.controls[c]; return x.invalid && (x.touched || x.dirty); }
  submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.loading.set(true); this.error.set('');
    const { email, password } = this.form.getRawValue();
    this.auth.login(email, password).subscribe({
      next: r => {
        this.toast.success(`Bienvenue, ${r.user.name} !`);
        const redirect = this.route.snapshot.queryParamMap.get('redirect');
        this.router.navigateByUrl(redirect && redirect.startsWith('/') ? redirect : '/');
      },
      error: e => { this.loading.set(false); this.error.set(toApiError(e).message); },
    });
  }
}
