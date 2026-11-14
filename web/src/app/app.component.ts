import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HeaderComponent } from './shared/header.component';
import { FooterComponent } from './shared/footer.component';
import { ToastService } from './core/toast.service';
import { TranslatePipe } from './shared/translate.pipe';
import { LogoComponent } from './shared/logo.component';
import { ClientPreferencesService } from './core/client-preferences.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HeaderComponent, FooterComponent, TranslatePipe, LogoComponent],
  template: `
    <app-header />
    <main><router-outlet /></main>
    <app-footer />
    <div class="toasts" aria-live="polite">
      @for (t of toast.toasts(); track t.id) { <div class="toast" [class.err]="t.kind === 'error'">{{ t.text | translate }}</div> }
    </div>
    @if (splashVisible()) {
      <div class="startup-splash" [class.leaving]="splashLeaving()" role="status" [attr.aria-label]="'Démarrage de GradHive' | translate">
        <app-logo [size]="96" [text]="false" />
        <strong>GradHive</strong>
        <span>{{ 'Savoir · Mentorat · Opportunités.' | translate }}</span>
      </div>
    }`,
  styles: [`
    main { min-height: 70vh; }
    .toasts { position: fixed; right: 1rem; bottom: 1rem; display: flex; flex-direction: column; gap: .5rem; z-index: 50; max-width: min(420px, 92vw); }
    .toast { background: #fff; color: var(--ink); padding: .85rem 1.1rem; border-radius: 14px; box-shadow: var(--shadow-lg); border: 1px solid var(--line); border-left: 5px solid var(--sky-500); animation: pop .35s var(--ease); }
    .toast.err { border-left-color: var(--bad); }
    .startup-splash { position: fixed; inset: 0; z-index: 100; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .9rem; color: #1e2a3a; background: radial-gradient(ellipse at 50% 43%, #e8f7ff, #fff 62%); animation: splashIn .55s ease both; }
    .startup-splash strong { font-size: clamp(2rem, 8vw, 3rem); font-weight: 780; letter-spacing: -.055em; }
    .startup-splash > span { color: #617587; font-size: .88rem; letter-spacing: .08em; }
    .startup-splash.leaving { opacity: 0; transition: opacity .3s ease; }
    @keyframes splashIn { from { opacity: 0; } to { opacity: 1; } }
    @media (prefers-reduced-motion: reduce) { .startup-splash { animation: none; } .startup-splash.leaving { transition: none; } }
  `],
})
export class AppComponent implements OnInit, OnDestroy {
  toast = inject(ToastService);
  private readonly preferences = inject(ClientPreferencesService);
  readonly splashVisible = signal(this.preferences.shouldShowStartupSplash());
  readonly splashLeaving = signal(false);
  private splashFadeTimer?: number;
  private splashDismissTimer?: number;

  ngOnInit(): void {
    if (!this.splashVisible()) return;
    this.splashFadeTimer = window.setTimeout(() => this.splashLeaving.set(true), 4700);
    this.splashDismissTimer = window.setTimeout(() => this.splashVisible.set(false), 5000);
  }

  ngOnDestroy(): void {
    if (this.splashFadeTimer !== undefined) window.clearTimeout(this.splashFadeTimer);
    if (this.splashDismissTimer !== undefined) window.clearTimeout(this.splashDismissTimer);
  }
}
