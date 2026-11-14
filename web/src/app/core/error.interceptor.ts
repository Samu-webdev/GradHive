import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

/** Si le jeton est refusé (401) alors qu'une session existe, on la ferme proprement et on renvoie vers la connexion. */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  return next(req).pipe(catchError((e: unknown) => {
    if (e instanceof HttpErrorResponse && e.status === 401 && auth.token && !req.url.endsWith('/login')) auth.sessionExpired();
    return throwError(() => e);
  }));
};
