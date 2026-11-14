import { Directive, ElementRef, Input, OnDestroy, OnInit, inject } from '@angular/core';

/** Fait apparaître l'élément en douceur quand il entre dans l'écran. */
@Directive({ selector: '[appReveal]', standalone: true })
export class RevealDirective implements OnInit, OnDestroy {
  private el = inject<ElementRef<HTMLElement>>(ElementRef);
  private io?: IntersectionObserver;
  @Input() appReveal: number | string = 0;
  ngOnInit() {
    const n = this.el.nativeElement;
    n.classList.add('reveal'); n.style.setProperty('--d', `${Number(this.appReveal) || 0}ms`);
    if (typeof IntersectionObserver === 'undefined') { n.classList.add('in'); return; }
    this.io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { n.classList.add('in'); this.io?.disconnect(); } }), { threshold: .12 });
    this.io.observe(n);
  }
  ngOnDestroy() { this.io?.disconnect(); }
}

/** Compteur animé : 0 → valeur. */
@Directive({ selector: '[appCountUp]', standalone: true })
export class CountUpDirective implements OnDestroy {
  private el = inject<ElementRef<HTMLElement>>(ElementRef);
  private raf = 0;
  @Input() set appCountUp(v: number | null | undefined) {
    const target = Number(v ?? 0); const n = this.el.nativeElement;
    cancelAnimationFrame(this.raf);
    if (!target) { n.textContent = v == null ? '–' : '0'; return; }
    const t0 = performance.now(), dur = 1100;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / dur); const e = 1 - Math.pow(1 - p, 3);
      n.textContent = String(Math.round(target * e));
      if (p < 1) this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }
  ngOnDestroy() { cancelAnimationFrame(this.raf); }
}
