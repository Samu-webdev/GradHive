import { Component, HostListener, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../core/auth.service';
import { ROLE_LABELS } from '../core/labels';
import { I18nService } from '../core/i18n.service';
import { AvatarComponent } from './avatar.component';
import { LogoComponent } from './logo.component';
import { TranslatePipe } from './translate.pipe';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, ReactiveFormsModule, LogoComponent, AvatarComponent, TranslatePipe],
  template: `
    <header class="bar" [class.scrolled]="scrolled()">
      <div class="container inner">
        <div class="brand-search">
          <a routerLink="/" class="brand" [attr.aria-label]="'GradHive, accueil' | translate" (click)="close()"><app-logo /></a>
          <form class="global-search" [formGroup]="searchForm" (ngSubmit)="search()" role="search">
            <label class="sr-only" for="site-search">{{ 'Rechercher dans GradHive' | translate }}</label>
            <input id="site-search" type="search" formControlName="q" [placeholder]="'Rechercher dans GradHive…' | translate">
            <button type="submit" [attr.aria-label]="'Rechercher' | translate"><span aria-hidden="true">⌕</span></button>
          </form>
        </div>
        <button class="burger" type="button" (click)="toggle()" [attr.aria-expanded]="open()" [attr.aria-label]="'Menu' | translate"><span></span><span></span><span></span></button>
        <nav [class.open]="open()" (click)="close()">
          <a routerLink="/memoires" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">{{ 'Projets' | translate }}</a>
          <a routerLink="/postes" routerLinkActive="active">{{ 'Postes TA/RA' | translate }}</a>
          <a routerLink="/opportunites" routerLinkActive="active">{{ 'Opportunités' | translate }}</a>
          <a routerLink="/annuaire" routerLinkActive="active">{{ 'Annuaire' | translate }}</a>
          <span class="sep"></span>
          @if (auth.isLoggedIn() && auth.user(); as u) {
            @if (auth.hasRole('student')) { <a routerLink="/memoires/publier" class="btn sm">{{ '+ Publier un projet' | translate }}</a> }
            <div class="menu" (click)="$event.stopPropagation()">
              <button type="button" class="me" (click)="menu.set(!menu())" [attr.aria-expanded]="menu()">
                <app-avatar [name]="u.name" [role]="u.role" [size]="34" /><span class="nm">{{ u.name }}</span><span class="caret">▾</span>
              </button>
              @if (menu()) {
                <div class="drop" (click)="menu.set(false); close()">
                  <div class="who"><b>{{ u.name }}</b><small>{{ role(u.role) }}</small></div>
                  @if (u.role === 'student' || u.role === 'school') { <a routerLink="/mon-profil">{{ 'Mon profil' | translate }}</a> }
                  @if (u.role === 'school') { <a routerLink="/publications-institutionnelles">{{ 'Publications de l’établissement' | translate }}</a> }
                  <a routerLink="/connexions">{{ 'Mes connexions' | translate }}</a>
                  <a routerLink="/actualites">{{ 'Actualités du réseau' | translate }}</a>
                  <a routerLink="/notifications">{{ 'Notifications' | translate }}</a>
                  @if (u.role === 'student') { <a routerLink="/mes-memoires">{{ 'Mes projets' | translate }}</a><a routerLink="/mes-candidatures">{{ 'Mes candidatures TA/RA' | translate }}</a><a routerLink="/mes-candidatures-opportunites">{{ 'Mes candidatures aux opportunités' | translate }}</a> }
                  @if (u.role === 'school' || u.role === 'company' || u.role === 'organization') { <a routerLink="/gestion-opportunites">{{ 'Gestion des opportunités' | translate }}</a> }
                  @if (u.role === 'admin') { <a routerLink="/administration">{{ 'Administration' | translate }}</a> }
                  <button type="button" (click)="auth.logout()">{{ 'Déconnexion' | translate }}</button>
                </div>
              }
            </div>
          } @else {
            <a routerLink="/connexion" class="btn ghost sm">{{ 'Connexion' | translate }}</a>
            <a routerLink="/inscription" class="btn sm">{{ 'Créer un compte' | translate }}</a>
          }
          <div class="language-switch" role="group" [attr.aria-label]="'Langue' | translate">
            <button type="button" [class.selected]="i18n.language() === 'fr'" [attr.aria-pressed]="i18n.language() === 'fr'" (click)="i18n.setLanguage('fr')">FR</button>
            <button type="button" [class.selected]="i18n.language() === 'en'" [attr.aria-pressed]="i18n.language() === 'en'" (click)="i18n.setLanguage('en')">EN</button>
          </div>
        </nav>
      </div>
    </header>`,
  changeDetection: ChangeDetectionStrategy.Default,
  styles: [`
    .bar { background: rgba(255,255,255,.88); backdrop-filter: blur(10px); border-bottom: 1px solid transparent; position: sticky; top: 0; z-index: 30; transition: border-color .25s, box-shadow .25s; }
    .bar.scrolled { border-color: var(--line); box-shadow: 0 6px 24px rgba(30,90,140,.07); }
    .inner { display: flex; align-items: center; justify-content: space-between; gap: 1rem; min-height: 76px; width: 100%; }
    .brand-search { display: flex; min-width: 0; flex: 0 1 490px; align-items: center; }
    .brand { flex-shrink: 0; text-decoration: none; }
    .global-search { display: flex; flex: 1 1 auto; min-width: 150px; width: auto; align-items: center; overflow: hidden; border: 1px solid var(--line); border-radius: 999px; background: #f9fcfe; }
    .global-search:focus-within { border-color: var(--sky-400); box-shadow: 0 0 0 3px rgba(91,192,245,.16); }
    .global-search input { min-width: 0; padding: .48rem .35rem .48rem .9rem; border: 0; outline: 0; background: transparent; box-shadow: none; font-size: .82rem; }
    .global-search input:focus { box-shadow: none; }
    .global-search button { display: grid; flex: 0 0 36px; place-items: center; width: 36px; height: 36px; margin-right: 3px; border: 0; border-radius: 50%; color: #fff; background: var(--sky-600); font: inherit; cursor: pointer; }
    .global-search button:hover { background: var(--sky-700); }
    .global-search button span { font-size: 1.3rem; line-height: 1; transform: rotate(-20deg); }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; clip-path: inset(50%); }
    nav { display: flex; flex: 1 1 auto; min-width: 0; align-items: center; justify-content: flex-end; gap: .15rem; flex-wrap: nowrap; white-space: nowrap; }
    nav > a:not(.btn) { text-decoration: none; color: var(--ink); font-weight: 600; font-size: .94rem; padding: .45rem .55rem; border-radius: 999px; transition: background .2s, color .2s; }
    nav > a:not(.btn):hover { background: var(--sky-50); color: var(--sky-700); } nav > a.active { background: var(--sky-100); color: var(--sky-700); }
    .sep { width: 1px; height: 24px; background: var(--line); margin: 0 .25rem; }
    .language-switch { display: inline-flex; align-items: center; gap: .1rem; margin-left: .15rem; padding: 3px; border: 1px solid var(--line); border-radius: 999px; background: #fff; flex-shrink: 0; }
    .language-switch button { border: 0; border-radius: 999px; padding: .3rem .48rem; background: transparent; color: var(--muted); font: inherit; font-size: .72rem; font-weight: 750; cursor: pointer; }
    .language-switch button.selected { background: var(--sky-600); color: #fff; }
    .menu { position: relative; margin-left: .3rem; }
    .me { display: inline-flex; align-items: center; gap: .5rem; background: #fff; border: 1.5px solid var(--line); border-radius: 999px; padding: 3px 12px 3px 4px; cursor: pointer; font: inherit; font-weight: 600; font-size: .9rem; color: var(--ink); transition: border-color .2s; }
    .me:hover { border-color: var(--sky-300); } .nm { max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .caret { color: var(--muted); font-size: .75rem; }
    .drop { position: absolute; right: 0; top: calc(100% + 8px); min-width: 230px; background: #fff; border: 1px solid var(--line); border-radius: 14px; box-shadow: var(--shadow-lg); padding: .4rem; animation: pop .2s var(--ease); z-index: 40; }
    .drop a, .drop button { display: block; width: 100%; text-align: left; padding: .55rem .8rem; border-radius: 9px; border: 0; background: none; font: inherit; color: var(--ink); text-decoration: none; cursor: pointer; font-size: .92rem; }
    .drop a:hover, .drop button:hover { background: var(--sky-50); color: var(--sky-700); }
    .who { padding: .5rem .8rem .6rem; border-bottom: 1px solid var(--line); margin-bottom: .3rem; } .who small { display: block; color: var(--muted); }
    .burger { display: none; background: none; border: 0; cursor: pointer; padding: .5rem; }
    .burger span { display: block; width: 24px; height: 3px; background: var(--sky-600); margin: 4px 0; border-radius: 2px; }
    @media (max-width: 960px) {
      .burger { display: block; }
      nav { display: none; position: absolute; top: 68px; left: 0; right: 0; background: #fff; padding: 1rem; flex-direction: column; align-items: stretch; border-bottom: 1px solid var(--line); box-shadow: var(--shadow); }
      nav.open { display: flex; animation: pop .2s var(--ease); } .sep { display: none; } nav .btn { flex-shrink: 0; white-space: nowrap; } .drop { position: static; box-shadow: none; margin-top: .4rem; }
    }
    @media (max-width: 960px) {
      .brand-search { flex: 1; gap: .55rem; }
      .brand-search app-logo { transform: scale(.88); transform-origin: left center; }
      .global-search { width: min(45vw, 205px); }
      .global-search input { padding-left: .65rem; font-size: .72rem; }
      .global-search button { flex-basis: 31px; width: 31px; height: 31px; }
      .inner { gap: .25rem; }
    }
  `],
})
export class HeaderComponent {
  auth = inject(AuthService);
  i18n = inject(I18nService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  readonly searchForm = this.fb.nonNullable.group({ q: '' });
  open = signal(false); menu = signal(false); scrolled = signal(false);
  search(): void {
    const query = this.searchForm.controls.q.value.trim();
    this.router.navigate(['/recherche'], { queryParams: query ? { q: query } : {} });
  }
  toggle() { this.open.update(v => !v); }
  close() { this.open.set(false); }
  role(r: string) { return this.i18n.translate(ROLE_LABELS[r] ?? r); }
  @HostListener('window:scroll') onScroll() { this.scrolled.set(window.scrollY > 8); }
  @HostListener('document:click') onDoc() { this.menu.set(false); }
}
