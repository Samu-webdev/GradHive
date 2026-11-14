import { Injectable, signal } from '@angular/core';

export interface Toast { id: number; kind: 'success' | 'error'; text: string; }

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private n = 0;
  show(kind: Toast['kind'], text: string) {
    const t = { id: ++this.n, kind, text };
    this.toasts.update(l => [...l, t]);
    setTimeout(() => this.toasts.update(l => l.filter(x => x.id !== t.id)), 5000);
  }
  success(text: string) { this.show('success', text); }
  error(text: string) { this.show('error', text); }
}
