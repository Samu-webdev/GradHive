import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { ApiService } from './api.service';
import { AuthResponse, User } from './models';
import { ToastService } from './toast.service';
import { I18nService } from './i18n.service';

const TOKEN_KEY = 'gradhive_token';
const USER_KEY = 'gradhive_user';
const EXPIRES_KEY = 'gradhive_expires';
// Emplacement du jeton. localStorage : la session survit à la fermeture de l'onglet.
// Pour un réglage plus strict (session perdue à la fermeture), remplacez par : sessionStorage.
const storage: Storage = localStorage;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private api = inject(ApiService);
  private router = inject(Router);
  private toast = inject(ToastService);
  private i18n = inject(I18nService);
  private _user = signal<User | null>(this.readSessionUser());
  private expiryTimer?: number;
  readonly user = this._user.asReadonly();
  readonly isLoggedIn = computed(() => this._user() !== null && this.hasUsableSession());

  constructor() {
    if (this._user()) this.scheduleExpiry();
  }

  get token(): string | null {
    const token = storage.getItem(TOKEN_KEY);
    if (!token || !this.hasUsableSession()) {
      if (token) this.clear();
      return null;
    }
    return token;
  }

  private hasUsableSession(): boolean {
    const token = storage.getItem(TOKEN_KEY);
    const expiresAt = storage.getItem(EXPIRES_KEY);
    return !!token && (!expiresAt || (Number.isFinite(Date.parse(expiresAt)) && Date.parse(expiresAt) > Date.now()));
  }

  private readSessionUser(): User | null {
    if (!this.hasUsableSession()) return null;
    return this.readUser();
  }

  private readUser(): User | null {
    try { return JSON.parse(storage.getItem(USER_KEY) ?? 'null') as User | null; } catch { return null; }
  }
  private store(res: AuthResponse) {
    if (res.token) {
      storage.setItem(TOKEN_KEY, res.token);
      storage.setItem(USER_KEY, JSON.stringify(res.user));
      if (res.expires_at) storage.setItem(EXPIRES_KEY, res.expires_at);
      else storage.removeItem(EXPIRES_KEY);
      this._user.set(res.user);
      this.scheduleExpiry();
    }
  }
  hasRole(...roles: string[]): boolean {
    const u = this._user();
    return this.isLoggedIn() && !!u && roles.includes(u.role);
  }

  login(email: string, password: string) { return this.api.login({ email, password }).pipe(tap(r => this.store(r))); }
  register(body: Record<string, unknown>) { return this.api.register(body).pipe(tap(r => this.store(r))); }

  /** Recharge le profil au démarrage ; déconnecte si le jeton est invalide. */
  refresh() {
    if (!this.token) return;
    this.api.me().subscribe({
      next: r => { this._user.set(r.user); storage.setItem(USER_KEY, JSON.stringify(r.user)); },
      error: (error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 401) return;
        this.toast.error(this.i18n.translate('Impossible de vérifier la session auprès du serveur. Réessayez lorsque la connexion sera rétablie.'));
      },
    });
  }
  private clear() {
    if (this.expiryTimer !== undefined) window.clearTimeout(this.expiryTimer);
    this.expiryTimer = undefined;
    storage.removeItem(TOKEN_KEY); storage.removeItem(USER_KEY); storage.removeItem(EXPIRES_KEY); this._user.set(null);
  }

  private scheduleExpiry(): void {
    if (this.expiryTimer !== undefined) window.clearTimeout(this.expiryTimer);
    this.expiryTimer = undefined;
    const expiresAt = storage.getItem(EXPIRES_KEY);
    if (!expiresAt) return;
    const remaining = Date.parse(expiresAt) - Date.now();
    if (!Number.isFinite(remaining)) return;
    if (remaining <= 0) { this.sessionExpired(); return; }
    this.expiryTimer = window.setTimeout(() => {
      if (!this.hasUsableSession()) this.sessionExpired();
      else this.scheduleExpiry();
    }, Math.min(remaining, 2_147_000_000));
  }
  /** Appelée par l'intercepteur quand le jeton n'est plus valide. */
  sessionExpired() {
    this.clear();
    this.router.navigate(['/connexion'], { queryParams: { expired: 1, redirect: this.router.url } });
  }
  logout() {
    const finish = () => { this.clear(); this.router.navigateByUrl('/'); };
    if (!this.token) { finish(); return; }
    this.api.logout().subscribe({
      next: finish,
      error: () => {
        finish();
        this.toast.error(this.i18n.translate('La session a été fermée sur cet appareil, mais le jeton serveur n’a pas pu être révoqué.'));
      },
    });
  }
}
