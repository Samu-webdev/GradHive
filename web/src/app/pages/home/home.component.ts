import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { FeedItem, Opportunity, Position, Stats, Work } from '../../core/models';
import { CountUpDirective, RevealDirective } from '../../shared/reveal.directive';
import { TranslatePipe } from '../../shared/translate.pipe';
import { I18nService } from '../../core/i18n.service';
import { daysLeft } from '../positions/positions-list.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, DatePipe, RevealDirective, CountUpDirective, TranslatePipe],
  template: `
    <div class="home">
    <section class="hero">
      <div class="hero-grid" aria-hidden="true"></div>
      <div class="container hero-in">
        <div class="copy">
          <span class="kicker"><i aria-hidden="true"></i>{{ 'SAVOIR · RÉSEAU · OPPORTUNITÉS' | translate }}</span>
          <h1>{{ 'Le talent académique rencontre' | translate }} <span>{{ 'l’opportunité mondiale.' | translate }}</span></h1>
          <div class="brand-line">
            <span class="brand-line-label">{{ 'SIGNATURE DE MARQUE' | translate }}</span>
            <div class="slogan-display" aria-live="polite" aria-atomic="true">
              <p [class.alt]="sloganIndex() % 2 === 1">{{ slogans[sloganIndex()] | translate }}</p>
              <span>{{ (sloganIndex() + 1).toString().padStart(2, '0') }} / {{ slogans.length.toString().padStart(2, '0') }}</span>
            </div>
            <div class="slogan-controls" role="group" [attr.aria-label]="'Navigation des signatures' | translate">
              <button type="button" class="slogan-arrow" [attr.aria-label]="'Signature précédente' | translate" (click)="stepSlogan(-1)">←</button>
              @for (slogan of slogans; track $index) {
                <button type="button" class="slogan-dot" [class.active]="sloganIndex() === $index"
                  [attr.aria-label]="('Afficher la signature' | translate) + ' ' + ($index + 1)"
                  [attr.aria-pressed]="sloganIndex() === $index" (click)="showSlogan($index)"></button>
              }
              <button type="button" class="slogan-arrow" [attr.aria-label]="'Signature suivante' | translate" (click)="stepSlogan(1)">→</button>
            </div>
          </div>
          <p class="lead">{{ 'Présentez vos travaux, développez votre réseau et découvrez des opportunités qui font avancer votre parcours.' | translate }}</p>
          <div class="actions">
            @if (auth.isLoggedIn()) {
              <a routerLink="/opportunites" class="btn primary">{{ 'Explorer les opportunités' | translate }} <span aria-hidden="true">↗</span></a>
              @if (auth.hasRole('student')) { <a routerLink="/memoires/publier" class="btn secondary">{{ 'Publier un projet' | translate }}</a> }
            } @else {
              <a routerLink="/inscription" class="btn primary">{{ 'Rejoindre GradHive' | translate }} <span aria-hidden="true">↗</span></a>
              <a routerLink="/memoires" class="btn secondary">{{ 'Explorer les projets' | translate }}</a>
            }
          </div>
          <p class="trust-note"><span aria-hidden="true">GH</span>{{ 'Les profils et travaux sont présentés par leurs auteurs.' | translate }}</p>
        </div>

        <div class="visual" [attr.aria-label]="'Recherche, innovation et talents' | translate">
          <div class="photo-frame">
            @for (slide of researcherSlides; track slide.id; let i = $index) {
              <img class="hero-photo" [class.active]="photoIndex() === i" [src]="slide.src"
                [alt]="slide.alt | translate" [attr.aria-hidden]="photoIndex() !== i" [loading]="i === 0 ? 'eager' : 'lazy'">
            }
            <div class="photo-shade" aria-hidden="true"></div>
            <div class="photo-brand"><span>GH</span><b>GradHive</b></div>
            <div class="photo-caption" aria-live="polite" aria-atomic="true">
              <span>{{ researcherSlides[photoIndex()].category | translate }}</span>
              <strong>{{ researcherSlides[photoIndex()].title | translate }}</strong>
              <p>{{ researcherSlides[photoIndex()].description | translate }}</p>
            </div>
            <div class="photo-controls" role="group" [attr.aria-label]="'Navigation des images' | translate">
              <button type="button" class="photo-arrow" [attr.aria-label]="'Image précédente' | translate" (click)="stepPhoto(-1)">←</button>
              @for (slide of researcherSlides; track slide.id; let i = $index) {
                <button type="button" class="photo-dot" [class.active]="photoIndex() === i"
                  [attr.aria-label]="('Afficher l’image' | translate) + ' ' + (i + 1)"
                  [attr.aria-pressed]="photoIndex() === i" (click)="showPhoto(i)"></button>
              }
              <button type="button" class="photo-arrow" [attr.aria-label]="'Image suivante' | translate" (click)="stepPhoto(1)">→</button>
              <button type="button" class="photo-arrow pause" [attr.aria-label]="(photoPaused() ? 'Reprendre le défilement' : 'Mettre le défilement en pause') | translate"
                [attr.aria-pressed]="photoPaused()" (click)="togglePhotoPause()">{{ photoPaused() ? '▶' : 'Ⅱ' }}</button>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="container activity-block">
      <div class="section-head" appReveal>
        <div><span class="section-kicker">{{ 'ACTUALITÉS RÉCENTES' | translate }}</span><h2>{{ 'Les dernières actualités' | translate }}</h2></div>
        <a routerLink="/actualites" class="all-link">{{ 'Voir le fil d’actualité' | translate }} <b aria-hidden="true">↗</b></a>
      </div>
      @if (feedLoading()) {
        <div class="activity-grid">@for (item of [1, 2, 3]; track item) { <div class="skeleton activity-skeleton"></div> }</div>
      } @else if (feedError()) {
        <div class="activity-empty" role="alert">
          <p>{{ 'Le fil d’actualité ne peut pas être chargé pour le moment.' | translate }}</p>
          <button type="button" class="btn ghost sm" (click)="loadFeed()">{{ 'Réessayer' | translate }}</button>
        </div>
      } @else if (feedItems().length || positions().length) {
        <div class="activity-grid">
          @if (positions().length) {
            @let featured = positions()[0];
            <a class="activity-card spotlight" [routerLink]="['/postes', featured.id]" appReveal="0">
              <span class="activity-type">{{ 'GH À LA UNE' | translate }} · {{ featured.type }}</span>
              <h3>{{ featured.title }}</h3>
              <p>{{ featured.university.name }} · {{ featured.university.country }}</p>
              <span class="activity-date">{{ 'Voir le poste' | translate }} <b aria-hidden="true">↗</b></span>
            </a>
          }
          @for (item of feedItems().slice(0, positions().length ? 2 : 3); track item.type + item.data.id) {
            <a class="activity-card" [routerLink]="feedLink(item)" [appReveal]="($index + (positions().length ? 1 : 0)) * 70">
              <span class="activity-type">{{ feedType(item.type) | translate }}</span>
              <h3>{{ feedTitle(item) }}</h3>
              <p>{{ feedDescription(item) }}</p>
              <span class="activity-date">{{ item.created_at | date: (i18n.language() === 'en' ? 'MMM d, y' : 'dd/MM/yyyy') }}</span>
            </a>
          }
        </div>
      } @else {
        <div class="activity-empty">
          <p>{{ 'Les nouveaux travaux, opportunités et annonces apparaîtront ici.' | translate }}</p>
          <a routerLink="/opportunites" class="btn ghost sm">{{ 'Explorer les opportunités' | translate }}</a>
        </div>
      }
    </section>

    <section class="proof container" [attr.aria-label]="'GradHive en chiffres' | translate">
      <div class="proof-intro"><span>{{ 'UN RÉSEAU EN MOUVEMENT' | translate }}</span><b>{{ 'Des idées aux possibilités.' | translate }}</b></div>
      <ul class="stats">
        <li><b [appCountUp]="stats()?.users">–</b><span>{{ 'membres' | translate }}</span></li>
        <li><b [appCountUp]="stats()?.works">–</b><span>{{ 'travaux académiques' | translate }}</span></li>
        <li><b [appCountUp]="stats()?.positions">–</b><span>{{ 'postes TA / RA' | translate }}</span></li>
      </ul>
      @if (dataUnavailable()) {
        <div class="data-notice" role="status">
          <span>{{ 'Certaines données ne sont pas disponibles pour le moment.' | translate }}</span>
          <button type="button" (click)="loadData()">{{ 'Réessayer' | translate }}</button>
        </div>
      }
    </section>

    <section class="container block">
      <div class="section-head" appReveal>
        <div><span class="section-kicker">{{ 'LA COMMUNAUTÉ EN MOUVEMENT' | translate }}</span><h2>{{ 'Tout votre parcours. Un seul réseau.' | translate }}</h2></div>
        <p>{{ 'Du travail académique à la prochaine opportunité.' | translate }}</p>
      </div>
      <div class="feature-grid">
        <a routerLink="/memoires" class="feature-tile tile-work" appReveal="0">
          <span class="tile-number">01</span><span class="tile-icon" aria-hidden="true">S</span>
          <h3>{{ 'Valorisez votre savoir' | translate }}</h3>
          <p>{{ 'Publiez vos travaux et rendez vos projets visibles.' | translate }}</p>
          <span class="tile-link">{{ 'Explorer les projets' | translate }} <b aria-hidden="true">↗</b></span>
        </a>
        <a routerLink="/annuaire" class="feature-tile tile-network" appReveal="100">
          <span class="tile-number">02</span><span class="tile-icon" aria-hidden="true">N</span>
          <h3>{{ 'Développez votre réseau' | translate }}</h3>
          <p>{{ 'Rencontrez des talents, écoles et professionnels.' | translate }}</p>
          <span class="tile-link">{{ 'Découvrir les membres' | translate }} <b aria-hidden="true">↗</b></span>
        </a>
        <a routerLink="/opportunites" class="feature-tile tile-opportunity" appReveal="200">
          <span class="tile-number">03</span><span class="tile-icon" aria-hidden="true">O</span>
          <h3>{{ 'Ouvrez de nouvelles voies' | translate }}</h3>
          <p>{{ 'Repérez des offres académiques et professionnelles.' | translate }}</p>
          <span class="tile-link">{{ 'Voir les opportunités' | translate }} <b aria-hidden="true">↗</b></span>
        </a>
      </div>
    </section>

    <section class="opportunities">
      <div class="container">
        <div class="section-head" appReveal>
          <div><span class="section-kicker">{{ 'PROCHAINES ÉTAPES' | translate }}</span><h2>{{ 'Des opportunités à saisir.' | translate }}</h2></div>
          <a routerLink="/postes" class="all-link">{{ 'Tous les postes TA / RA' | translate }} <b aria-hidden="true">↗</b></a>
        </div>
        @if (positions().length) {
          <div class="position-grid">
            @for (position of positions(); track position.id; let i = $index) {
              <article class="position-card" [appReveal]="i * 90">
                <div class="position-meta"><span [class.ra]="position.type === 'RA'">{{ position.type }}</span><span>{{ position.university.country }}</span></div>
                <h3>{{ position.title }}</h3>
                <p>{{ position.university.name }}</p>
                <div class="position-foot"><span>{{ 'Échéance' | translate }} · {{ position.deadline | date: (i18n.language() === 'en' ? 'MMM d, y' : 'dd/MM/yyyy') }}</span><a [routerLink]="['/postes', position.id]" [attr.aria-label]="('Voir le poste' | translate) + ' : ' + position.title">↗</a></div>
              </article>
            }
          </div>
        } @else if (!positionsLoading()) {
          <div class="empty-opportunities">
            <p>{{ 'Les nouvelles offres apparaîtront ici.' | translate }}</p>
            <a routerLink="/opportunites">{{ 'Explorer toutes les opportunités' | translate }} ↗</a>
          </div>
        }
      </div>
    </section>

    <section class="container closing">
      <div class="closing-card" appReveal>
        <div class="closing-mark" aria-hidden="true">GH</div>
        <div><span class="section-kicker">{{ 'VOTRE PROCHAIN CHAPITRE' | translate }}</span><h2>{{ 'Faites avancer votre ambition.' | translate }}</h2><p>{{ 'Rejoignez une communauté qui transforme le savoir en possibilités.' | translate }}</p></div>
        <a routerLink="/inscription" class="btn primary">{{ 'Créer mon profil' | translate }} <span aria-hidden="true">↗</span></a>
      </div>
    </section>
    </div>`,
})
export class HomeComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  readonly auth = inject(AuthService);
  readonly i18n = inject(I18nService);
  readonly stats = signal<Stats | null>(null);
  readonly positions = signal<Position[]>([]);
  readonly feedItems = signal<FeedItem[]>([]);
  readonly statsLoading = signal(true);
  readonly positionsLoading = signal(true);
  readonly feedLoading = signal(true);
  readonly feedError = signal(false);
  readonly dataUnavailable = signal(false);
  readonly photoPaused = signal(false);
  readonly photoIndex = signal(0);
  readonly researcherSlides = [
    {
      id: 'research',
      src: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=1400&q=85',
      alt: 'Des chercheurs réalisent une expérience dans un laboratoire.',
      category: 'SCIENCE · RECHERCHE',
      title: 'Faire avancer la recherche.',
      description: 'Des idées rigoureuses, des découvertes qui ouvrent de nouvelles voies.',
    },
    {
      id: 'computing',
      src: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=1400&q=85',
      alt: 'Une jeune chercheuse travaille sur un ordinateur en laboratoire.',
      category: 'TECHNOLOGIE · INNOVATION',
      title: 'Créer les solutions de demain.',
      description: 'Les talents transforment leurs compétences en projets concrets.',
    },
    {
      id: 'cybersecurity',
      src: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=1400&q=85',
      alt: 'Un écran affiche des visualisations de cybersécurité.',
      category: 'CYBERSÉCURITÉ · RÉSEAUX',
      title: 'Sécuriser un monde connecté.',
      description: 'Les expertises numériques répondent aux défis d’un monde connecté.',
    },
    {
      id: 'data',
      src: 'https://images.unsplash.com/photo-1527474305487-b87b222841cc?auto=format&fit=crop&w=1400&q=85',
      alt: 'Une équipe étudie des données et échange autour d’un écran.',
      category: 'DONNÉES · COLLABORATION',
      title: 'Donner du sens aux données.',
      description: 'Croiser les perspectives pour faire émerger de nouvelles réponses.',
    },
  ];
  readonly slogans = [
    'Où le savoir rencontre l’opportunité mondiale.',
    'Le pont entre les talents et l’innovation mondiale.',
    'Savoir · Mentorat · Opportunités.',
  ];
  readonly sloganIndex = signal(0);
  private sloganTimer?: ReturnType<typeof setInterval>;
  private photoTimer?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.sloganTimer = setInterval(() => {
        this.sloganIndex.update(index => (index + 1) % this.slogans.length);
      }, 6500);
      this.photoTimer = setInterval(() => {
        if (!this.photoPaused()) this.showRandomPhoto();
      }, 7000);
    }
    this.loadData();
    this.loadFeed();
  }

  loadData(): void {
    this.dataUnavailable.set(false);
    this.statsLoading.set(true);
    this.positionsLoading.set(true);
    this.api.stats().subscribe({
      next: stats => { this.stats.set(stats); this.statsLoading.set(false); },
      error: () => { this.statsLoading.set(false); this.dataUnavailable.set(true); },
    });
    this.api.positions({}).subscribe({
      next: response => {
        this.positions.set(response.data.filter(position => daysLeft(position.deadline) >= 0).slice(0, 3));
        this.positionsLoading.set(false);
      },
      error: () => { this.positionsLoading.set(false); this.dataUnavailable.set(true); },
    });
  }

  loadFeed(): void {
    this.feedLoading.set(true);
    this.feedError.set(false);
    this.feedItems.set([]);
    this.api.feed().subscribe({
      next: response => {
        this.feedItems.set(response.data.slice(0, 3));
        this.feedLoading.set(false);
      },
      error: () => {
        this.feedLoading.set(false);
        this.feedError.set(true);
      },
    });
  }

  feedType(type: FeedItem['type']): string {
    return {
      work: 'NOUVEAU TRAVAIL',
      opportunity: 'NOUVELLE OPPORTUNITÉ',
      highlight: 'TALENT À L’HONNEUR',
      institution_post: 'ANNONCE INSTITUTIONNELLE',
    }[type];
  }

  feedTitle(item: FeedItem): string {
    return item.type === 'highlight' ? item.data.student?.name ?? item.data.title : item.data.title;
  }

  feedDescription(item: FeedItem): string {
    switch (item.type) {
      case 'work': return `${item.data.author_name} · ${item.data.institution ?? ''}`;
      case 'opportunity': return item.data.organization_name ?? item.data.owner?.name ?? item.data.type;
      case 'highlight': return item.data.message;
      case 'institution_post': return item.data.institution?.name ?? item.data.body;
    }
  }

  feedLink(item: FeedItem): string[] {
    switch (item.type) {
      case 'work': return ['/memoires', String(item.data.id)];
      case 'opportunity': return ['/opportunites', String(item.data.id)];
      case 'highlight': return item.data.student ? ['/etudiants', String(item.data.student.id)] : ['/opportunites'];
      case 'institution_post': return item.data.institution ? ['/etablissements', String(item.data.institution.id)] : ['/annuaire'];
    }
  }

  showPhoto(index: number): void {
    this.photoIndex.set(index);
  }

  stepPhoto(direction: number): void {
    const count = this.researcherSlides.length;
    this.photoIndex.update(index => (index + direction + count) % count);
  }

  togglePhotoPause(): void {
    this.photoPaused.update(paused => !paused);
  }

  private showRandomPhoto(): void {
    const current = this.photoIndex();
    const next = Math.floor(Math.random() * (this.researcherSlides.length - 1));
    this.photoIndex.set(next >= current ? next + 1 : next);
  }

  showSlogan(index: number): void {
    this.sloganIndex.set(index);
  }

  stepSlogan(direction: number): void {
    const count = this.slogans.length;
    this.sloganIndex.update(index => (index + direction + count) % count);
  }

  ngOnDestroy(): void {
    if (this.sloganTimer) clearInterval(this.sloganTimer);
    if (this.photoTimer) clearInterval(this.photoTimer);
  }
}
