import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiService, toApiError } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Level, Opportunity, OpportunityType } from '../../core/models';
import { LEVEL_LABELS } from '../../core/labels';
import { ToastService } from '../../core/toast.service';
import { ErrorViewComponent } from '../../shared/error-view.component';
import { ReportButtonComponent } from '../../shared/report-button.component';
import { TranslatePipe } from '../../shared/translate.pipe';

@Component({
  selector: 'app-opportunity-detail',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, RouterLink, ErrorViewComponent, ReportButtonComponent, TranslatePipe],
  template: `
    <div class="page"><div class="narrow">
      @if (item(); as opportunity) {
        <a routerLink="/opportunites" class="back">← {{ 'Toutes les opportunités' | translate }}</a>
        <article class="card detail">
          <div class="row"><span class="badge">{{ typeLabel(opportunity.type) | translate }}</span>
            @if (opportunity.status !== 'open') { <span class="badge warn">{{ 'Clôturée' | translate }}</span> }
          </div>
          <h1>{{ opportunity.title }}</h1>
          <p class="muted">{{ opportunity.organization_name || opportunity.owner?.name }}
            @if (opportunity.location || opportunity.country) { · {{ opportunity.location || opportunity.country }} }
            @if (opportunity.remote) { · {{ 'À distance' | translate }} }
          </p>
          <div class="chips">
            @if (opportunity.employment_type) { <span class="chip">{{ opportunity.employment_type }}</span> }
            @if (opportunity.funding) { <span class="chip">{{ opportunity.funding }}</span> }
            @if (opportunity.study_level) { <span class="chip">{{ levelLabel(opportunity.study_level) | translate }}</span> }
            @if (opportunity.deadline) { <span class="chip">{{ 'Date limite :' | translate }} {{ opportunity.deadline | date:'mediumDate' }}</span> }
          </div>
          <hr><h2>{{ 'Description' | translate }}</h2><p class="description">{{ opportunity.description }}</p>
          @if (opportunity.requirements) { <h2>{{ 'Conditions d’admission' | translate }}</h2><p class="description">{{ opportunity.requirements }}</p> }
          @if (opportunity.skills.length) { <h2>{{ 'Compétences recherchées' | translate }}</h2><div class="chips">@for (skill of opportunity.skills; track skill) { <span class="chip">{{ skill }}</span> }</div> }
          @if (opportunity.required_documents.length) { <h2>{{ 'Documents demandés' | translate }}</h2><ul>@for (document of opportunity.required_documents; track document) { <li>{{ document }}</li> }</ul> }
          @if (opportunity.application_method) { <h2>{{ 'Modalités de candidature' | translate }}</h2><p class="description">{{ opportunity.application_method }}</p> }
          <app-report-button targetType="opportunity" [targetId]="opportunity.id" [ownerId]="opportunity.owner_id" />
        </article>
        @if (auth.hasRole('student') && opportunity.status === 'open') {
          <form class="card apply" [formGroup]="form" (ngSubmit)="submit(opportunity)">
            <h2>{{ 'Présenter ma candidature' | translate }}</h2>
            <label class="field"><span>{{ 'Message de motivation (facultatif)' | translate }}</span>
              <textarea formControlName="motivation" [placeholder]="'Présentez brièvement votre intérêt pour cette opportunité.' | translate"></textarea>
            </label>
            @if (opportunity.required_documents.length) {
              @for (documentType of opportunity.required_documents; track documentType) {
                <label class="field"><span>{{ documentLabel(documentType) | translate }}</span>
                  <input type="file" accept="application/pdf,.pdf" (change)="selectRequiredFile(documentType, $event)">
                </label>
              }
            } @else {
              <label class="field"><span>{{ 'Documents PDF (7 maximum, 5 Mo chacun)' | translate }}</span>
                <input type="file" accept="application/pdf,.pdf" multiple (change)="selectFiles($event)">
              </label>
              @if (files().length) { <p class="small muted">{{ files().length }} {{ 'document(s) sélectionné(s)' | translate }}</p> }
            }
            <button class="btn" type="submit" [disabled]="form.invalid || submitting() || missingRequiredDocuments(opportunity)">{{ (submitting() ? 'Envoi en cours…' : 'Envoyer ma candidature') | translate }}</button>
          </form>
        } @else if (!auth.isLoggedIn()) {
          <div class="card apply"><p>{{ 'Connectez-vous avec un compte étudiant pour candidater.' | translate }}</p><a class="btn" routerLink="/connexion">{{ 'Connexion' | translate }}</a></div>
        }
      } @else if (loading()) { <div class="spinner" role="status"></div> }
      @else { <app-error-view [status]="error()" [compact]="true" (retry)="load()" /> }
    </div></div>`,
  styles: [`
    .back { display: inline-block; margin-bottom: 1rem; text-decoration: none; font-weight: 650; }
    .detail h1 { font-size: clamp(1.8rem, 4vw, 2.6rem); margin: 1rem 0 .4rem; }
    .detail hr { border: 0; border-top: 1px solid var(--line); margin: 1.5rem 0; }
    .description { white-space: pre-wrap; line-height: 1.8; } .apply { margin-top: 1.2rem; }
  `],
})
export class OpportunityDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);
  readonly item = signal<Opportunity | null>(null);
  readonly files = signal<File[]>([]);
  readonly requiredFiles = signal<Record<string, File>>({});
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly error = signal<number | null>(null);
  readonly form = this.fb.nonNullable.group({ motivation: ['', [Validators.minLength(20), Validators.maxLength(5000)]] });
  private id = 0;

  ngOnInit(): void {
    this.id = Number(this.route.snapshot.paramMap.get('id'));
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.opportunity(this.id).subscribe({
      next: response => { this.item.set(response.data); this.loading.set(false); },
      error: error => { this.error.set(toApiError(error).status ?? 500); this.loading.set(false); },
    });
  }

  selectFiles(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.files.set(Array.from(input.files ?? []));
  }

  selectRequiredFile(type: string, event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.requiredFiles.update(files => ({ ...files, [type]: file }));
  }

  missingRequiredDocuments(opportunity: Opportunity): boolean {
    return opportunity.required_documents.some(type => !this.requiredFiles()[type]);
  }

  documentLabel(type: string): string {
    return ({
      cv: 'CV', transcripts: 'Relevés de notes', motivation_letter: 'Lettre de motivation',
      recommendation_letter: 'Lettre de recommandation', research_proposal: 'Projet de recherche',
      language_certificate: 'Certificat de langue', passport: 'Passeport', other: 'Autre document',
    })[type] ?? type;
  }

  typeLabel(type: OpportunityType): string {
    return ({
      employment: 'Emploi', internship: 'Stage', scholarship: 'Bourse', ta: 'Teaching Assistant (TA)',
      ra: 'Research Assistant (RA)', mobility_program: 'Programme de mobilité',
      research_program: 'Programme de recherche', other: 'Autre',
    })[type];
  }

  levelLabel(level: Level): string { return LEVEL_LABELS[level] ?? level; }

  submit(opportunity: Opportunity): void {
    if (this.form.invalid || this.submitting()) return;
    if (this.missingRequiredDocuments(opportunity)) {
      this.toast.error('Veuillez joindre chacun des documents obligatoires.');
      return;
    }
    const body = new FormData();
    const motivation = this.form.controls.motivation.value.trim();
    if (motivation) body.append('motivation', motivation);
    if (opportunity.required_documents.length) {
      opportunity.required_documents.forEach(type => {
        const file = this.requiredFiles()[type];
        if (file) body.append(`documents[${type}]`, file);
      });
    } else {
      this.files().forEach(file => body.append('documents[]', file));
    }
    this.submitting.set(true);
    this.api.applyToOpportunity(opportunity.id, body).subscribe({
      next: () => {
        this.submitting.set(false);
        this.toast.success('Votre candidature a été envoyée.');
        this.router.navigateByUrl('/mes-candidatures-opportunites');
      },
      error: error => { this.submitting.set(false); this.toast.error(toApiError(error).message); },
    });
  }
}
