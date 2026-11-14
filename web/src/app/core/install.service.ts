import { Injectable, signal } from '@angular/core';

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

@Injectable({ providedIn: 'root' })
export class InstallService {
  private promptEvent: InstallPromptEvent | null = null;
  readonly available = signal(false);
  readonly installed = signal(false);

  constructor() {
    window.addEventListener('beforeinstallprompt', event => {
      event.preventDefault();
      this.promptEvent = event as InstallPromptEvent;
      this.available.set(true);
    });
    window.addEventListener('appinstalled', () => {
      this.promptEvent = null;
      this.available.set(false);
      this.installed.set(true);
    });
    this.installed.set(window.matchMedia('(display-mode: standalone)').matches);
  }

  async install(): Promise<void> {
    if (!this.promptEvent) return;
    const prompt = this.promptEvent;
    this.promptEvent = null;
    this.available.set(false);
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === 'accepted') this.installed.set(true);
  }
}
