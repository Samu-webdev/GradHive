import { Component, inject, signal } from '@angular/core';
import { InstallService } from '../../core/install.service';
import { TranslatePipe } from '../../shared/translate.pipe';

@Component({
  selector: 'app-install',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div class="page"><section class="narrow card install-card">
      <div class="app-mark">GH</div>
      <span class="eyebrow">{{ 'GRADHIVE MOBILE' }}</span>
      <h1>{{ 'Emportez GradHive avec vous.' | translate }}</h1>
      <p>{{ 'Ajoutez GradHive à l’écran d’accueil de votre téléphone pour un accès rapide, comme une application.' | translate }}</p>
      @if (install.installed()) {
        <div class="alert success">{{ 'GradHive est installé sur cet appareil.' | translate }}</div>
      } @else if (install.available()) {
        <button type="button" class="btn block" (click)="installApp()">{{ 'Installer GradHive' | translate }}</button>
      } @else {
        <div class="steps">
          <h2>{{ 'Installation depuis le navigateur' | translate }}</h2>
          <p><b>Android :</b> {{ 'Ouvrez le menu du navigateur puis choisissez « Installer l’application » ou « Ajouter à l’écran d’accueil ».' | translate }}</p>
          <p><b>iPhone :</b> {{ 'Dans Safari, touchez Partager puis « Sur l’écran d’accueil ».' | translate }}</p>
          <p class="muted small">{{ 'L’installation est proposée lorsque le navigateur et la connexion sécurisée le permettent.' | translate }}</p>
        </div>
      }
      @if (error()) { <p class="alert error" role="alert">{{ 'L’installation n’a pas pu être lancée. Utilisez le menu de votre navigateur.' | translate }}</p> }
    </section></div>`,
  styles: [`
    .install-card { max-width: 620px; padding: clamp(1.5rem, 5vw, 3rem); }
    .app-mark { display: grid; width: 68px; height: 68px; place-items: center; margin-bottom: 1rem; border-radius: 19px; color: #fff; background: linear-gradient(135deg, var(--sky-600), var(--sky-400)); font-size: 1.3rem; font-weight: 900; }
    .eyebrow { color: var(--sky-700); font-size: .65rem; font-weight: 850; letter-spacing: .14em; }
    h1 { margin: .45rem 0; }
    p { color: var(--muted); line-height: 1.65; }
    .steps { margin-top: 1.4rem; padding: 1rem 1.1rem; border: 1px solid var(--line); border-radius: 13px; background: #fbfdff; }
    .steps h2 { font-size: 1.02rem; }
    .steps p { margin-bottom: .65rem; font-size: .85rem; }
    .muted { color: var(--muted); }
  `],
})
export class InstallComponent {
  readonly install = inject(InstallService);
  readonly error = signal(false);

  async installApp(): Promise<void> {
    this.error.set(false);
    try {
      await this.install.install();
    } catch {
      this.error.set(true);
    }
  }
}
