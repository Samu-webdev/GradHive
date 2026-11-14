import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslatePipe } from '../../shared/translate.pipe';

type InfoPageKey = 'about' | 'terms' | 'privacy';

@Component({
  selector: 'app-info-page',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  template: `
    <div class="page"><article class="container card info">
      @switch (page()) {
        @case ('about') {
          <span class="eyebrow">{{ 'GRADHIVE' }}</span>
          <h1>{{ 'À propos de GradHive' | translate }}</h1>
          <p class="intro">{{ 'Un réseau pour valoriser les parcours académiques, partager des travaux et découvrir des opportunités.' | translate }}</p>
          <h2>{{ 'Une communauté tournée vers le savoir' | translate }}</h2>
          <p>{{ 'GradHive rassemble étudiants, diplômés, établissements, organisations et mentors autour des projets, de la recherche et de l’évolution professionnelle.' | translate }}</p>
          <p>{{ 'Les publications de démonstration sont fictives et ne constituent pas des offres ou des validations académiques réelles.' | translate }}</p>
        }
        @case ('terms') {
          <span class="eyebrow">{{ 'INFORMATIONS JURIDIQUES' | translate }}</span>
          <h1>{{ 'Conditions générales' | translate }}</h1>
          <div class="alert warn">{{ 'Version de travail : les conditions doivent être relues et complétées avant une mise en production.' | translate }}</div>
          <h2>{{ 'Utilisation du service' | translate }}</h2>
          <p>{{ 'Les utilisateurs sont responsables de l’exactitude des informations, travaux et documents qu’ils publient ou transmettent.' | translate }}</p>
          <h2>{{ 'Contenus et opportunités' | translate }}</h2>
          <p>{{ 'Les contenus publiés par les membres leur sont attribués. Vérifiez les critères, les échéances et les informations auprès de l’organisme émetteur avant toute candidature.' | translate }}</p>
          <h2>{{ 'Comportement attendu' | translate }}</h2>
          <p>{{ 'N’utilisez pas GradHive pour publier du contenu illicite, trompeur, discriminatoire ou portant atteinte aux droits d’autrui.' | translate }}</p>
        }
        @case ('privacy') {
          <span class="eyebrow">{{ 'INFORMATIONS JURIDIQUES' | translate }}</span>
          <h1>{{ 'Confidentialité' | translate }}</h1>
          <div class="alert warn">{{ 'Information : cette page résume le fonctionnement actuel du projet et ne remplace pas une politique de confidentialité validée.' | translate }}</div>
          <h2>{{ 'Données du compte' | translate }}</h2>
          <p>{{ 'GradHive traite les informations de compte, de profil et les contenus que vous choisissez de publier, ainsi que les candidatures et documents transmis dans l’application.' | translate }}</p>
          <h2>{{ 'Visibilité et session' | translate }}</h2>
          <p>{{ 'La visibilité des profils étudiants peut être contrôlée dans le profil. Le navigateur conserve la session de connexion et certaines préférences locales, notamment la langue et les réglages d’affichage.' | translate }}</p>
          <h2>{{ 'Vos choix' | translate }}</h2>
          <p>{{ 'Vous pouvez modifier vos préférences et la visibilité de votre profil depuis les réglages et votre espace personnel. Les coordonnées du responsable de traitement devront être ajoutées avant publication du service.' | translate }}</p>
          <a routerLink="/reglages" class="btn ghost">{{ 'Ouvrir les réglages' | translate }}</a>
        }
      }
    </article></div>`,
  styles: [`
    .info { max-width: 860px; padding: clamp(1.3rem, 5vw, 3.2rem); }
    .eyebrow { color: var(--sky-700); font-size: .68rem; font-weight: 850; letter-spacing: .13em; }
    h1 { margin-top: .5rem; }
    h2 { margin: 1.8rem 0 .45rem; font-size: 1.18rem; }
    p { max-width: 72ch; color: var(--muted); line-height: 1.75; }
    .intro { font-size: 1.08rem; }
  `],
})
export class InfoPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  readonly page = signal<InfoPageKey>('about');

  ngOnInit(): void {
    const key = this.route.snapshot.data['page'] as InfoPageKey | undefined;
    if (key) this.page.set(key);
  }
}
