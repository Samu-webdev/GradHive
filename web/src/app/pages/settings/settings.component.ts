import { Component, inject } from '@angular/core';
import { ClientPreferencesService } from '../../core/client-preferences.service';
import { I18nService } from '../../core/i18n.service';
import { TranslatePipe } from '../../shared/translate.pipe';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div class="page"><div class="narrow">
      <header class="page-head"><span class="eyebrow">{{ 'VOTRE ESPACE' | translate }}</span><h1>{{ 'Réglages' | translate }}</h1><p>{{ 'Personnalisez cette application sur votre appareil.' | translate }}</p></header>
      <section class="card setting-group">
        <h2>{{ 'Langue' | translate }}</h2>
        <p>{{ 'Choisissez la langue de l’interface.' | translate }}</p>
        <div class="choices" role="group" [attr.aria-label]="'Langue' | translate">
          <button type="button" [class.selected]="i18n.language() === 'fr'" [attr.aria-pressed]="i18n.language() === 'fr'" (click)="i18n.setLanguage('fr')">Français</button>
          <button type="button" [class.selected]="i18n.language() === 'en'" [attr.aria-pressed]="i18n.language() === 'en'" (click)="i18n.setLanguage('en')">English</button>
        </div>
      </section>
      <section class="card setting-group">
        <div><h2>{{ 'Animations réduites' | translate }}</h2><p>{{ 'Désactive les animations et mouvements décoratifs.' | translate }}</p></div>
        <button class="switch" type="button" role="switch" [attr.aria-checked]="preferences.reducedMotion()" (click)="preferences.setReducedMotion(!preferences.reducedMotion())">
          <span>{{ (preferences.reducedMotion() ? 'Activé' : 'Désactivé') | translate }}</span><i></i>
        </button>
      </section>
      <section class="card setting-group">
        <div><h2>{{ 'Écran de démarrage' | translate }}</h2><p>{{ 'Afficher le logo GradHive pendant cinq secondes au premier lancement de cette session.' | translate }}</p></div>
        <button class="switch" type="button" role="switch" [attr.aria-checked]="preferences.startupSplash()" (click)="preferences.setStartupSplash(!preferences.startupSplash())">
          <span>{{ (preferences.startupSplash() ? 'Activé' : 'Désactivé') | translate }}</span><i></i>
        </button>
      </section>
      <p class="note">{{ 'Ces réglages sont enregistrés uniquement dans ce navigateur.' | translate }}</p>
    </div></div>`,
  styles: [`
    .eyebrow { color: var(--sky-700); font-size: .68rem; font-weight: 800; letter-spacing: .13em; }
    .setting-group { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: .85rem; }
    .setting-group h2 { margin: 0 0 .25rem; font-size: 1.06rem; }
    .setting-group p { margin: 0; color: var(--muted); font-size: .84rem; }
    .choices { display: flex; flex-wrap: wrap; gap: .45rem; }
    .choices button { padding: .5rem .85rem; border: 1px solid var(--line); border-radius: 999px; color: var(--ink); background: #fff; font: inherit; font-size: .8rem; cursor: pointer; }
    .choices button.selected { border-color: var(--sky-600); color: #fff; background: var(--sky-600); }
    .switch { display: flex; flex: 0 0 auto; align-items: center; gap: .65rem; padding: .4rem .7rem; border: 1px solid var(--line); border-radius: 999px; color: var(--muted); background: #fff; font: inherit; font-size: .75rem; cursor: pointer; }
    .switch i { position: relative; width: 31px; height: 18px; border-radius: 99px; background: #bdc9d2; transition: background .2s; }
    .switch i::after { position: absolute; top: 3px; left: 3px; width: 12px; height: 12px; border-radius: 50%; background: #fff; content: ''; transition: transform .2s; }
    .switch[aria-checked="true"] { color: var(--sky-700); }
    .switch[aria-checked="true"] i { background: var(--sky-600); }
    .switch[aria-checked="true"] i::after { transform: translateX(13px); }
    .note { margin-top: 1rem; color: var(--muted); font-size: .78rem; }
    @media (max-width: 560px) { .setting-group { align-items: flex-start; flex-direction: column; } }
  `],
})
export class SettingsComponent {
  readonly preferences = inject(ClientPreferencesService);
  readonly i18n = inject(I18nService);
}
