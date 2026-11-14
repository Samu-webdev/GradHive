import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService); const router = inject(Router);
  return auth.isLoggedIn() ? true : router.createUrlTree(['/connexion'], { queryParams: { redirect: state.url } });
};
export const roleGuard = (...roles: string[]): CanActivateFn => (_route, state) => {
  const auth = inject(AuthService); const router = inject(Router);
  if (!auth.isLoggedIn()) return router.createUrlTree(['/connexion'], { queryParams: { redirect: state.url } });
  return auth.hasRole(...roles) ? true : router.createUrlTree(['/erreur', 403]);
};
