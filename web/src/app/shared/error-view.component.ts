import { Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Router } from '@angular/router';
import { inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from './translate.pipe';
import { I18nService } from '../core/i18n.service';

interface ErrInfo { title: string; text: string; primary?: 'login' | 'retry' | 'home'; }

const INFO: Record<number, ErrInfo> = {
  401: { title: 'Connexion requise', text: 'Connectez-vous pour accéder à cette page et poursuivre votre navigation.', primary: 'login' },
  402: { title: 'Accès non disponible', text: 'Cette ressource n’est pas accessible pour le moment.', primary: 'home' },
  403: { title: 'Accès refusé', text: 'Votre compte ne dispose pas des autorisations nécessaires pour consulter cette page.', primary: 'home' },
  404: { title: 'Page introuvable', text: 'La page demandée n’existe pas ou a été déplacée. Vous pouvez retourner à l’accueil ou consulter les projets.', primary: 'home' },
  408: { title: 'La demande a expiré', text: 'Le serveur a mis trop de temps à répondre. Vérifiez votre connexion, puis réessayez.', primary: 'retry' },
  429: { title: 'Trop de demandes', text: 'Veuillez patienter quelques instants avant de réessayer.', primary: 'retry' },
  500: { title: 'Une erreur est survenue', text: 'Le service rencontre un problème. Réessayez dans quelques instants.', primary: 'retry' },
  503: { title: 'Service temporairement indisponible', text: 'Le service est momentanément indisponible. Veuillez réessayer plus tard.', primary: 'retry' },
  0:   { title: 'Connexion au serveur impossible', text: 'Vérifiez votre connexion Internet, puis réessayez.', primary: 'retry' },
};

/** Écran d'erreur animé, utilisé en pleine page (/erreur/:code, 404) et en version compacte dans les listes. */
@Component({
  selector: 'app-error-view',
  standalone: true,
  imports: [RouterLink, FormsModule, TranslatePipe],
  template: `
    <section class="err" [class.compact]="compact">
      <div class="stage" aria-hidden="true">
        <span>GH</span>
      </div>
      @if (code() > 0) {
        <div class="code" [attr.aria-label]="('Erreur' | translate) + ' ' + code()">
          @for (d of digits(); track $index) {
            @if (d === '0') { <svg class="zero" viewBox="0 0 64 64" aria-hidden="true"><polygon points="32,3 58,18 58,46 32,61 6,46 6,18" fill="none" stroke="currentColor" stroke-width="7" stroke-linejoin="round"/></svg> }
            @else { <span>{{ d }}</span> }
          }
        </div>
      }
      <h1>{{ info().title | translate }}</h1>
      <p class="txt">{{ info().text | translate }}</p>
      @if (message) { <p class="small muted">{{ 'Détail :' | translate }} {{ message | translate }}</p> }
      <div class="row center-row">
        @switch (info().primary) {
          @case ('login') { <a routerLink="/connexion" [queryParams]="{ redirect: currentUrl }" class="btn lg">{{ 'Se connecter' | translate }}</a> }
          @case ('retry') { <button type="button" class="btn lg" (click)="retry.emit()">{{ 'Réessayer' | translate }}</button> }
          @default { <a routerLink="/" class="btn lg">{{ 'Retour à l’accueil' | translate }}</a> }
        }
        @if (!compact) { <a routerLink="/memoires" class="btn ghost lg">{{ 'Voir les projets' | translate }}</a> }
      </div>
      @if (code() === 404 && !compact) {
        <form class="search" (ngSubmit)="search()">
          <input name="q" [(ngModel)]="q" [placeholder]="'Chercher un projet ou un mémoire…' | translate" [attr.aria-label]="'Rechercher' | translate">
          <button class="btn" type="submit">{{ 'Chercher' | translate }}</button>
        </form>
        <div class="chips center-row"><a class="chip" routerLink="/memoires">{{ 'Projets et mémoires' | translate }}</a><a class="chip" routerLink="/postes">{{ 'Postes TA / RA' | translate }}</a></div>
      }
    </section>`,
  styles: [`
    .err { text-align: center; padding: 2.5rem 1rem 3rem; animation: pageIn .5s var(--ease) both; }
    .err.compact { padding: 1.2rem 1rem; background: #fff; border: 1px solid var(--line); border-radius: var(--radius); }
    .stage { display: grid; place-items: center; width: 72px; height: 72px; margin: 0 auto 1rem; border-radius: 20px; color: #fff; background: linear-gradient(135deg, var(--sky-700), var(--sky-500)); font-size: 1.3rem; font-weight: 800; letter-spacing: -.05em; animation: fadeUp .45s var(--ease) both; }
    .compact .stage { width: 48px; height: 48px; border-radius: 14px; font-size: 1rem; }
    .code { display: flex; justify-content: center; align-items: center; gap: .1em; font-size: clamp(4rem, 14vw, 7.5rem); font-weight: 900; line-height: 1; color: var(--sky-500); margin: .2em 0 .1em; }
    .code span { animation: fadeUp .45s var(--ease) both; } .code span:nth-child(2) { animation-delay: .08s; } .code span:nth-child(3) { animation-delay: .16s; }
    .zero { width: .78em; height: .78em; color: var(--sky-400); }
    .compact h1 { font-size: 1.35rem; } .txt { color: var(--muted); max-width: 52ch; margin: 0 auto 1.4rem; }
    .center-row { justify-content: center; } .search { display: flex; gap: .6rem; max-width: 460px; margin: 1.6rem auto 1rem; }
  `],
})
export class ErrorViewComponent {
  private router = inject(Router);
  private i18n = inject(I18nService);
  codeSig = signal(404);
  @Input() set status(v: number | null | undefined) { this.codeSig.set(v === undefined || v === null ? 404 : v); }
  @Input() compact = false;
  @Input() message = '';
  @Output() retry = new EventEmitter<void>();
  q = '';
  code = computed(() => this.codeSig());
  info = computed<ErrInfo>(() => {
    const info = INFO[this.codeSig()] ?? (this.codeSig() >= 500 ? INFO[500] : INFO[404]);
    return { ...info, title: this.i18n.translate(info.title), text: this.i18n.translate(info.text) };
  });
  digits = computed(() => String(this.codeSig()).split(''));
  get currentUrl() { return this.router.url; }
  search() { this.router.navigate(['/memoires'], { queryParams: { q: this.q || null } }); }
}
