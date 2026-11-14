import { Component, Input } from '@angular/core';

const PALETTE: Record<string, [string, string]> = {
  student: ['#8fd2f6', '#38aeef'], school: ['#bfe5fa', '#1e93d6'], company: ['#a9b8cc', '#5f7592'], mentor: ['#c3e8fb', '#5bc0f5'], organization: ['#9ddcf0', '#2aa0c8'], admin: ['#cfd6df', '#7d8a9b'],
};

@Component({
  selector: 'app-avatar',
  standalone: true,
  template: `<span class="av" [style.width.px]="size" [style.height.px]="size" [style.fontSize.px]="size * .38" [style.background]="bg()">{{ initials() }}</span>`,
  styles: [`.av { display: inline-grid; place-items: center; color: #0e2a43; font-weight: 800; flex: none; clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%); letter-spacing: .02em; }`],
})
export class AvatarComponent {
  @Input() name = '';
  @Input() role = 'student';
  @Input() size = 48;
  initials() { return (this.name || '?').split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase(); }
  bg() { const c = PALETTE[this.role] ?? PALETTE['student']; return `linear-gradient(135deg, ${c[0]}, ${c[1]})`; }
}
