import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LogoComponent } from './logo.component';
import { TranslatePipe } from './translate.pipe';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink, LogoComponent, TranslatePipe],
  template: `
    <footer class="hexbg">
      <div class="container cols">
        <div><app-logo /><p class="tag">{{ 'Le réseau international qui valorise les parcours et les projets académiques.' | translate }}</p></div>
        <div><h4>{{ 'Explorer' | translate }}</h4><a routerLink="/memoires">{{ 'Projets et mémoires' | translate }}</a><a routerLink="/postes">{{ 'Postes TA/RA' | translate }}</a><a routerLink="/opportunites">{{ 'Opportunités' | translate }}</a></div>
        <div><h4>{{ 'GradHive' }}</h4><a routerLink="/a-propos">{{ 'À propos' | translate }}</a><a routerLink="/conditions-generales">{{ 'Conditions générales' | translate }}</a><a routerLink="/confidentialite">{{ 'Confidentialité' | translate }}</a></div>
        <div><h4>{{ 'Application' | translate }}</h4><a routerLink="/telecharger">{{ 'Télécharger l’application' | translate }}</a><a routerLink="/reglages">{{ 'Réglages' | translate }}</a><a routerLink="/connexion">{{ 'Connexion' | translate }}</a><a routerLink="/inscription">{{ 'Inscription' | translate }}</a></div>
      </div>
      <div class="container legal">© {{ year }} GradHive · {{ 'Projet de mémoire de licence. Les profils et universités de démonstration sont fictifs.' | translate }}</div>
    </footer>`,
  styles: [`
    footer { background-color: #fff; border-top: 1px solid var(--line); padding: 2.6rem 0 1.2rem; margin-top: 3rem; }
    .cols { display: grid; grid-template-columns: 1.7fr 1fr 1fr 1fr; gap: 1.5rem; }
    h4 { margin-bottom: .6rem; } a { display: block; color: var(--muted); text-decoration: none; padding: .18rem 0; transition: color .2s, transform .2s; } a:hover { color: var(--sky-700); transform: translateX(3px); }
    .tag { margin-top: .8rem; color: var(--muted); max-width: 40ch; font-size: .95rem; } .tag i { color: var(--sky-600); }
    .legal { border-top: 1px solid var(--line); margin-top: 1.6rem; padding-top: 1rem; font-size: .8rem; color: var(--muted); }
    @media (max-width: 700px) { .cols { grid-template-columns: 1fr; } }
  `],
})
export class FooterComponent { year = new Date().getFullYear(); }
