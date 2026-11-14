import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService, toApiError } from '../../core/api.service';
import { I18nService } from '../../core/i18n.service';
import {
  Level, Opportunity, OpportunityApplication, OpportunityApplicationStatus, OpportunityStatus, OpportunityType,
} from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { TranslatePipe } from '../../shared/translate.pipe';

@Component({
  selector: 'app-opportunity-management',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, TranslatePipe],
  template: `
    <div class="page"><div class="container">
      <div class="page-head"><h1>{{ 'Gestion des opportunités' | translate }}</h1><p>{{ 'Publiez des opportunités, gérez leur visibilité et traitez les candidatures reçues.' | translate }}</p></div>
      <form class="card editor" [formGroup]="form" (ngSubmit)="save()">
        <h2>{{ editingId() ? ('Modifier une opportunité' | translate) : ('Publier une opportunité' | translate) }}</h2>
        <div class="two">
          <label class="field"><span>{{ 'Type' | translate }}</span><select formControlName="type">
            @for (type of types; track type) { <option [value]="type">{{ typeLabel(type) | translate }}</option> }
          </select></label>
          <label class="field"><span>{{ 'Intitulé' | translate }}</span><input formControlName="title" maxlength="200"></label>
          <label class="field"><span>{{ 'Organisation affichée' | translate }}</span><input formControlName="organization_name" maxlength="150"></label>
          <label class="field"><span>{{ 'Pays ou lieu' | translate }}</span><input formControlName="location" maxlength="150"></label>
          <label class="field"><span>{{ 'Pays' | translate }}</span><input formControlName="country" maxlength="80"></label>
          <label class="field"><span>{{ 'Niveau d’études visé' | translate }}</span><select formControlName="study_level">
            <option value="">{{ 'Tous niveaux' | translate }}</option><option value="licence">{{ 'Licence' | translate }}</option><option value="master">{{ 'Master' | translate }}</option><option value="doctorat">{{ 'Doctorat' | translate }}</option>
          </select></label>
          <label class="field"><span>{{ 'Modalité d’emploi' | translate }}</span><input formControlName="employment_type" maxlength="30" [placeholder]="'Temps plein, stage…' | translate"></label>
          <label class="field"><span>{{ 'Financement' | translate }}</span><input formControlName="funding" maxlength="150"></label>
          <label class="field"><span>{{ 'Date limite' | translate }}</span><input type="date" formControlName="deadline"></label>
          <label class="field"><span>{{ 'Compétences recherchées (séparées par des virgules)' | translate }}</span><input formControlName="skills"></label>
          <label class="field"><span>{{ 'Statut de publication' | translate }}</span><select formControlName="status">
            <option value="draft">{{ 'Brouillon' | translate }}</option><option value="open">{{ 'Ouverte' | translate }}</option><option value="closed">{{ 'Clôturée' | translate }}</option>
          </select></label>
        </div>
        <fieldset class="field document-options"><legend>{{ 'Documents demandés' | translate }}</legend>
          @for (document of documentTypes; track document[0]) {
            <label class="check"><input type="checkbox" [checked]="form.controls.required_documents.value.includes(document[0])" (change)="toggleRequiredDocument(document[0], $event)"> {{ document[1] | translate }}</label>
          }
        </fieldset>
        <label class="remote"><input type="checkbox" formControlName="remote"> {{ 'Possibilité de télétravail' | translate }}</label>
        <label class="field"><span>{{ 'Description et critères' | translate }}</span><textarea formControlName="description" minlength="20" maxlength="10000"></textarea></label>
        <label class="field"><span>{{ 'Conditions d’admission' | translate }}</span><textarea formControlName="requirements" maxlength="5000"></textarea></label>
        <label class="field"><span>{{ 'Modalités de candidature' | translate }}</span><textarea formControlName="application_method" maxlength="2000"></textarea></label>
        <div class="row"><button class="btn" type="submit" [disabled]="form.invalid || saving()">{{ (saving() ? 'Enregistrement…' : (editingId() ? 'Enregistrer les modifications' : 'Publier')) | translate }}</button>
          @if (editingId()) { <button class="btn ghost" type="button" (click)="cancelEdit()">{{ 'Annuler' | translate }}</button> }
        </div>
      </form>

      <section class="section"><h2>{{ 'Mes opportunités' | translate }}</h2>
        @if (loading()) { <div class="spinner" role="status"></div> }
        @else if (!items().length) { <div class="card empty">{{ 'Aucune opportunité publiée.' | translate }}</div> }
        @else { <div class="grid">
          @for (item of items(); track item.id) {
            <article class="card">
              <div class="row between"><div><span class="badge" [class.ok]="item.status === 'open'" [class.warn]="item.status !== 'open'">{{ statusLabel(item.status) | translate }}</span>
                <h3 class="item-title">{{ item.title }}</h3><p class="muted small">{{ typeLabel(item.type) | translate }} · {{ item.deadline || ('Aucune échéance' | translate) }}</p></div>
                <div class="row"><button class="btn ghost sm" type="button" (click)="edit(item)">{{ 'Modifier' | translate }}</button>
                  @if (item.status === 'open') { <button class="btn ghost sm" type="button" (click)="setStatus(item, 'closed')">{{ 'Clôturer' | translate }}</button> }
                  @else if (item.status === 'closed') { <button class="btn ghost sm" type="button" (click)="setStatus(item, 'open')">{{ 'Rouvrir' | translate }}</button> }
                  <button class="btn danger sm" type="button" (click)="remove(item)">{{ 'Supprimer' | translate }}</button>
                </div>
              </div>
              <button class="btn ghost sm" type="button" (click)="toggleApplications(item)">{{ (selectedOpportunity() === item.id ? 'Masquer les candidatures' : 'Voir les candidatures') | translate }}</button>
              @if (selectedOpportunity() === item.id) {
                @if (applicationsLoading()) { <div class="spinner" role="status"></div> }
                @else if (!applications().length) { <p class="muted">{{ 'Aucune candidature reçue.' | translate }}</p> }
                @else { <div class="applications">
                  @for (application of applications(); track application.id) {
                    <section class="application">
                      <div class="row between"><b>{{ application.applicant?.name || ('Candidat' | translate) }}</b><span class="badge">{{ applicationStatus(application.status) | translate }}</span></div>
                      @if (application.motivation) { <p class="motivation">{{ application.motivation }}</p> }
                      @if (application.documents.length) { <div class="chips">@for (doc of application.documents; track doc.id) { <button class="chip document" type="button" (click)="download(application, doc.id)">{{ doc.name }}</button> }</div> }
                      @if (nextStatuses(application.status).length) {
                        <div class="row actions">@for (status of nextStatuses(application.status); track status) {
                          <button class="btn sm" type="button" [disabled]="busyApplication() === application.id" (click)="review(application, status)">{{ applicationStatus(status) | translate }}</button>
                        }</div>
                      }
                      @if (latestHistory(application); as lastUpdate) { <p class="muted small">{{ 'Dernière mise à jour :' | translate }} {{ lastUpdate | date:'medium' }}</p> }
                    </section>
                  }
                </div> }
              }
            </article>
          }
        </div> }
      </section>
    </div></div>`,
  styles: [`
    .editor { margin-bottom: 2rem; } .editor h2 { margin-bottom: 1.2rem; }
    .remote { display: flex; align-items: center; gap: .45rem; margin-bottom: 1rem; }
    .remote input { width: auto; } .section { margin-top: 2rem; } .item-title { margin: .45rem 0 .2rem; }
    .applications { border-top: 1px solid var(--line); margin-top: 1rem; padding-top: 1rem; }
    .application { padding: .9rem 0; border-bottom: 1px solid var(--line); }
    .motivation { white-space: pre-wrap; margin: .7rem 0; }
    .document { border: 0; cursor: pointer; } .actions { margin: .7rem 0; }
  `],
})
export class OpportunityManagementComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  readonly types: OpportunityType[] = ['employment', 'internship', 'scholarship', 'ta', 'ra', 'mobility_program', 'research_program', 'other'];
  readonly documentTypes: [string, string][] = [
    ['cv', 'CV'], ['transcripts', 'Relevés de notes'], ['motivation_letter', 'Lettre de motivation'],
    ['recommendation_letter', 'Lettre de recommandation'], ['research_proposal', 'Projet de recherche'],
    ['language_certificate', 'Certificat de langue'], ['passport', 'Passeport'], ['other', 'Autre document'],
  ];
  readonly form = this.fb.nonNullable.group({
    type: 'internship' as OpportunityType,
    title: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(200)]],
    organization_name: '',
    location: '',
    country: '',
    study_level: '' as Level | '',
    remote: false,
    employment_type: '',
    funding: '',
    deadline: '',
    description: ['', [Validators.required, Validators.minLength(20), Validators.maxLength(10000)]],
    requirements: '',
    skills: '',
    required_documents: this.fb.nonNullable.control<string[]>([]),
    application_method: '',
    status: 'open' as OpportunityStatus,
  });
  readonly items = signal<Opportunity[]>([]);
  readonly applications = signal<OpportunityApplication[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly applicationsLoading = signal(false);
  readonly editingId = signal<number | null>(null);
  readonly selectedOpportunity = signal<number | null>(null);
  readonly busyApplication = signal<number | null>(null);

  ngOnInit(): void { this.load(); }

  load(): void {
    this.api.myOpportunities().subscribe({
      next: response => { this.items.set(response.data); this.loading.set(false); },
      error: error => { this.loading.set(false); this.toast.error(toApiError(error).message); },
    });
  }

  typeLabel(type: OpportunityType): string {
    return ({
      employment: 'Emploi', internship: 'Stage', scholarship: 'Bourse', ta: 'Teaching Assistant (TA)',
      ra: 'Research Assistant (RA)', mobility_program: 'Programme de mobilité',
      research_program: 'Programme de recherche', other: 'Autre',
    })[type];
  }

  statusLabel(status: OpportunityStatus): string {
    return ({ draft: 'Brouillon', open: 'Ouverte', closed: 'Clôturée' })[status];
  }

  applicationStatus(status: OpportunityApplicationStatus): string {
    return ({
      submitted: 'Envoyée', under_review: 'En cours d’étude', shortlisted: 'Présélectionnée',
      accepted: 'Acceptée', rejected: 'Refusée', withdrawn: 'Retirée',
    })[status];
  }

  save(): void {
    if (this.form.invalid || this.saving()) return;
    const value = this.form.getRawValue();
    const body = {
      ...value,
      organization_name: value.organization_name.trim() || null,
      location: value.location.trim() || null,
      country: value.country.trim() || null,
      study_level: value.study_level || null,
      employment_type: value.employment_type.trim() || null,
      funding: value.funding.trim() || null,
      deadline: value.deadline || null,
      requirements: value.requirements.trim() || null,
      skills: value.skills.split(',').map(skill => skill.trim()).filter(Boolean),
      required_documents: value.required_documents,
      application_method: value.application_method.trim() || null,
    };
    this.saving.set(true);
    this.api.saveOpportunity(body, this.editingId() ?? undefined).subscribe({
      next: () => { this.saving.set(false); this.cancelEdit(); this.load(); },
      error: error => { this.saving.set(false); this.toast.error(toApiError(error).message); },
    });
  }

  edit(item: Opportunity): void {
    this.editingId.set(item.id);
    this.form.patchValue({
      type: item.type, title: item.title, organization_name: item.organization_name ?? '',
      location: item.location ?? '', country: item.country ?? '', study_level: item.study_level ?? '',
      remote: item.remote, employment_type: item.employment_type ?? '',
      funding: item.funding ?? '', deadline: item.deadline ?? '', description: item.description,
      requirements: item.requirements ?? '', skills: item.skills.join(', '),
      required_documents: item.required_documents, application_method: item.application_method ?? '', status: item.status,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.form.reset({
      type: 'internship', title: '', organization_name: '', location: '', country: '', study_level: '',
      remote: false, employment_type: '', funding: '', deadline: '', description: '',
      requirements: '', skills: '', required_documents: [], application_method: '', status: 'open',
    });
  }

  toggleRequiredDocument(key: string, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const current = this.form.controls.required_documents.value;
    if (checked && current.length >= 7) {
      (event.target as HTMLInputElement).checked = false;
      this.toast.error(this.i18n.translate('Vous pouvez demander au maximum sept documents.'));
      return;
    }
    this.form.controls.required_documents.setValue(
      checked ? [...new Set([...current, key])] : current.filter(value => value !== key),
    );
  }

  setStatus(item: Opportunity, status: OpportunityStatus): void {
    this.api.saveOpportunity({
      type: item.type, title: item.title, description: item.description, status,
    }, item.id).subscribe({
      next: () => this.load(),
      error: error => this.toast.error(toApiError(error).message),
    });
  }

  remove(item: Opportunity): void {
    if (!window.confirm(this.i18n.translate('Confirmer la suppression de cette opportunité ?'))) return;
    this.api.deleteOpportunity(item.id).subscribe({
      next: () => this.load(),
      error: error => this.toast.error(toApiError(error).message),
    });
  }

  latestHistory(application: OpportunityApplication): string | null {
    const history = application.history ?? [];
    return history.length ? history[history.length - 1].created_at : null;
  }

  toggleApplications(item: Opportunity): void {
    if (this.selectedOpportunity() === item.id) { this.selectedOpportunity.set(null); return; }
    this.selectedOpportunity.set(item.id);
    this.applicationsLoading.set(true);
    this.api.receivedOpportunityApplications(item.id).subscribe({
      next: response => { this.applications.set(response.data); this.applicationsLoading.set(false); },
      error: error => { this.applicationsLoading.set(false); this.toast.error(toApiError(error).message); },
    });
  }

  nextStatuses(status: OpportunityApplicationStatus): OpportunityApplicationStatus[] {
    if (status === 'submitted') return ['under_review'];
    if (status === 'under_review') return ['shortlisted', 'accepted', 'rejected'];
    if (status === 'shortlisted') return ['accepted', 'rejected'];
    return [];
  }

  review(application: OpportunityApplication, status: OpportunityApplicationStatus): void {
    this.busyApplication.set(application.id);
    this.api.reviewOpportunityApplication(application.opportunity_id, application.id, status).subscribe({
      next: () => {
        this.busyApplication.set(null);
        const opportunityId = this.selectedOpportunity();
        if (opportunityId !== null) this.api.receivedOpportunityApplications(opportunityId).subscribe({
          next: response => this.applications.set(response.data),
          error: error => this.toast.error(toApiError(error).message),
        });
      },
      error: error => { this.busyApplication.set(null); this.toast.error(toApiError(error).message); },
    });
  }

  download(application: OpportunityApplication, documentId: number): void {
    this.api.opportunityDocument(application.id, documentId).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = application.documents.find(document => document.id === documentId)?.name ?? 'document.pdf';
        link.click();
        URL.revokeObjectURL(url);
      },
      error: error => this.toast.error(toApiError(error).message),
    });
  }
}
