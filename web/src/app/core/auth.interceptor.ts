import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

/** Ajoute le jeton Sanctum à chaque requête vers l'API. */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).token;
  return next(token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}`, Accept: 'application/json' } })
                    : req.clone({ setHeaders: { Accept: 'application/json' } }));
};
