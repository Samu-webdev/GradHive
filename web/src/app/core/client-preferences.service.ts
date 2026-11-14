import { Injectable, signal } from '@angular/core';

const MOTION_KEY = 'gradhive-reduced-motion';
const SPLASH_KEY = 'gradhive-startup-splash';
const SPLASH_SESSION_KEY = 'gradhive-startup-shown';

@Injectable({ providedIn: 'root' })
export class ClientPreferencesService {
  readonly reducedMotion = signal(localStorage.getItem(MOTION_KEY) === 'true');
  readonly startupSplash = signal(localStorage.getItem(SPLASH_KEY) !== 'false');

  constructor() {
    this.applyMotionPreference();
  }

  setReducedMotion(enabled: boolean): void {
    this.reducedMotion.set(enabled);
    localStorage.setItem(MOTION_KEY, String(enabled));
    this.applyMotionPreference();
  }

  setStartupSplash(enabled: boolean): void {
    this.startupSplash.set(enabled);
    localStorage.setItem(SPLASH_KEY, String(enabled));
  }

  shouldShowStartupSplash(): boolean {
    if (!this.startupSplash() || sessionStorage.getItem(SPLASH_SESSION_KEY) === 'true') return false;
    sessionStorage.setItem(SPLASH_SESSION_KEY, 'true');
    return true;
  }

  private applyMotionPreference(): void {
    document.documentElement.classList.toggle('reduce-motion', this.reducedMotion());
  }
}
