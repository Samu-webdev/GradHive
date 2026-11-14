import { Component, Input, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ApiService, toApiError } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { ReportTargetType } from '../core/models';
import { ToastService } from '../core/toast.service';
import { TranslatePipe } from './translate.pipe';

@Component({
  selector: 'app-report-button',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe],
  template: `
    @if (auth.isLoggedIn() && auth.user()?.id !== ownerId) {
      @if (!open()) { <button class="btn ghost sm" type="button" (click)="open.set(true)">{{ 'Signaler' | translate }}</button> }
      @else {
        <form class="report card" [formGroup]="form" (ngSubmit)="submit()">
          <label class="field"><span>{{ 'Motif du signalement' | translate }}</span><select formControlName="reason">
            <option value="inaccurate">{{ 'Information inexacte' | translate }}</option>
            <option value="inappropriate">{{ 'Contenu inapproprié' | translate }}</option>
            <option value="fraud">{{ 'Fraude ou usurpation' | translate }}</option>
            <option value="spam">{{ 'Spam' | translate }}</option>
            <option value="other">{{ 'Autre motif' | translate }}</option>
          </select></label>
          <label class="field"><span>{{ 'Précisions (facultatif)' | translate }}</span><textarea formControlName="details" maxlength="1000"></textarea></label>
          <div class="row"><button class="btn danger sm" type="submit" [disabled]="busy() || form.invalid">{{ (busy() ? 'Envoi…' : 'Envoyer le signalement') | translate }}</button>
            <button class="btn ghost sm" type="button" (click)="open.set(false)">{{ 'Annuler' | translate }}</button></div>
        </form>
      }
    }
  `,
  styles: [`.report { margin-top: .8rem; padding: 1rem; box-shadow: none; } .field { margin-bottom: .7rem; } .field textarea { min-height: 70px; }`],
})
export class ReportButtonComponent {
  @Input({ required: true }) targetType!: ReportTargetType;
  @Input({ required: true }) targetId!: number;
  @Input() ownerId: number | null = null;
  readonly auth = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  readonly open = signal(false);
  readonly busy = signal(false);
  readonly form = this.fb.nonNullable.group({
    reason: ['inappropriate', Validators.required],
    details: ['', Validators.maxLength(1000)],
  });

  submit(): void {
    if (this.form.invalid || this.busy()) return;
    this.busy.set(true);
    const value = this.form.getRawValue();
    this.api.createReport(this.targetType, this.targetId, value.reason, value.details).subscribe({
      next: () => { this.busy.set(false); this.open.set(false); this.form.reset({ reason: 'inappropriate', details: '' }); this.toast.success('Votre signalement a été transmis à l’équipe GradHive.'); },
      error: error => { this.busy.set(false); this.toast.error(toApiError(error).message); },
    });
  }
}
