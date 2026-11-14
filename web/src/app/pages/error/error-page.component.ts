import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ErrorViewComponent } from '../../shared/error-view.component';

@Component({
  selector: 'app-error-page',
  standalone: true,
  imports: [ErrorViewComponent],
  template: `<div class="container"><app-error-view [status]="code" (retry)="reload()" /></div>`,
})
export class ErrorPageComponent {
  private route = inject(ActivatedRoute);
  code = Number(this.route.snapshot.paramMap.get('code') ?? this.route.snapshot.data['code'] ?? 404);
  reload() { location.reload(); }
}
