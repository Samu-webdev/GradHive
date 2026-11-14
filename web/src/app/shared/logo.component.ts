import { Component, Input } from '@angular/core';

/** Logo GradHive : monogramme GH dans une tuile bleue à effet de verre. */
@Component({
  selector: 'app-logo',
  standalone: true,
  template: `
    <span class="logo">
      <svg [attr.width]="size" [attr.height]="size" viewBox="0 0 64 64" aria-hidden="true">
        <defs>
          <linearGradient id="gh-glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#269ed8"/><stop offset="1" stop-color="#55bbed"/></linearGradient>
          <linearGradient id="gh-shine" x1="0" y1="0" x2=".8" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".3"/><stop offset=".55" stop-color="#fff" stop-opacity=".06"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
          <clipPath id="gh-clip"><rect x="1" y="1" width="62" height="62" rx="17"/></clipPath>
        </defs>
        <rect x="1" y="1" width="62" height="62" rx="17" fill="url(#gh-glass)"/>
        <g clip-path="url(#gh-clip)"><path d="M1 1h62v28Q32 37 1 22z" fill="url(#gh-shine)"/></g>
        <text x="32" y="43" text-anchor="middle" fill="#fff" font-family="Arial, Helvetica, sans-serif" font-size="38" font-weight="800" letter-spacing="-2.5">GH</text>
      </svg>
      @if (text) { <span class="name">Grad<b>Hive</b></span> }
    </span>`,
  styles: [`
    .logo { display: inline-flex; align-items: center; gap: .45rem; }
    .name { font-size: 1.45rem; font-weight: 700; color: var(--ink); letter-spacing: -.02em; }
    b { font-weight: 800; background: linear-gradient(90deg, #1e93d6, #5bc0f5); -webkit-background-clip: text; background-clip: text; color: transparent; }
    svg { transition: transform .25s cubic-bezier(.2,.8,.2,1); } .logo:hover svg { transform: scale(1.04); }
  `],
})
export class LogoComponent {
  @Input() size = 38;
  @Input() text = true;
}
