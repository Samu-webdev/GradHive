import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService, toApiError } from '../../core/api.service';
import { I18nService } from '../../core/i18n.service';
import { InstitutionPost } from '../../core/models';
import { ToastService } from '../../core/toast.service';
import { TranslatePipe } from '../../shared/translate.pipe';

@Component({
  selector: 'app-institution-posts',
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, TranslatePipe],
  template: `
    <div class="page"><div class="narrow">
      <div class="page-head"><h1>{{ 'Publications de l’établissement' | translate }}</h1><p>{{ 'Partagez des actualités institutionnelles avec la communauté GradHive. Les publications apparaissent dans le fil si le profil de l’établissement est public.' | translate }}</p></div>
      <form class="card editor" [formGroup]="form" (ngSubmit)="save()">
        <h2>{{ editingId() ? ('Modifier une publication' | translate) : ('Nouvelle publication' | translate) }}</h2>
        <label class="field"><span>{{ 'Titre' | translate }}</span><input formControlName="title" maxlength="200"></label>
        <label class="field"><span>{{ 'Message' | translate }}</span><textarea formControlName="body" minlength="20" maxlength="5000"></textarea></label>
        <div class="row"><button class="btn" type="submit" [disabled]="form.invalid || saving()">{{ (saving() ? 'Enregistrement…' : (editingId() ? 'Enregistrer les modifications' : 'Publier')) | translate }}</button>
          @if (editingId()) { <button class="btn ghost" type="button" (click)="cancelEdit()">{{ 'Annuler' | translate }}</button> }
        </div>
      </form>
      @if (loading()) { <div class="spinner" role="status"></div> }
      @else if (!posts().length) { <div class="card empty">{{ 'Aucune publication pour le moment.' | translate }}</div> }
      @else { <div class="grid">
        @for (post of posts(); track post.id) {
          <article class="card">
            <div class="row between"><time class="muted small">{{ post.created_at | date:'mediumDate' }}</time>
              <div class="row"><button class="btn ghost sm" type="button" (click)="edit(post)">{{ 'Modifier' | translate }}</button><button class="btn danger sm" type="button" (click)="remove(post)">{{ 'Supprimer' | translate }}</button></div>
            </div>
            <h2>{{ post.title }}</h2><p class="body">{{ post.body }}</p>
          </article>
        }
      </div> }
    </div></div>`,
  styles: [`.editor { margin-bottom: 1.4rem; } .body { white-space: pre-wrap; line-height: 1.7; }`],
})
export class InstitutionPostsComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(200)]],
    body: ['', [Validators.required, Validators.minLength(20), Validators.maxLength(5000)]],
  });
  readonly posts = signal<InstitutionPost[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly editingId = signal<number | null>(null);

  ngOnInit(): void { this.load(); }

  load(): void {
    this.api.myInstitutionPosts().subscribe({
      next: response => { this.posts.set(response.data); this.loading.set(false); },
      error: error => { this.loading.set(false); this.toast.error(toApiError(error).message); },
    });
  }

  save(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.api.saveInstitutionPost(this.form.getRawValue(), this.editingId() ?? undefined).subscribe({
      next: () => { this.saving.set(false); this.cancelEdit(); this.load(); },
      error: error => { this.saving.set(false); this.toast.error(toApiError(error).message); },
    });
  }

  edit(post: InstitutionPost): void {
    this.editingId.set(post.id);
    this.form.setValue({ title: post.title, body: post.body });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.form.reset({ title: '', body: '' });
  }

  remove(post: InstitutionPost): void {
    if (!window.confirm(this.i18n.translate('Confirmer la suppression de cette publication ?'))) return;
    this.api.deleteInstitutionPost(post.id).subscribe({
      next: () => this.load(),
      error: error => this.toast.error(toApiError(error).message),
    });
  }
}
