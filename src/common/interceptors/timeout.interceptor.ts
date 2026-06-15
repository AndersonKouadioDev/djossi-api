import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  RequestTimeoutException,
} from '@nestjs/common';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

/** Au-delà de cette durée, une requête est coupée (408). */
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Coupe toute requête HTTP dépassant {@link DEFAULT_TIMEOUT_MS} en levant une
 * RequestTimeoutException (408). Les réponses normales (rapides) passent
 * inchangées : aucun impact sur le contrat HTTP.
 */
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    return next.handle().pipe(
      timeout(DEFAULT_TIMEOUT_MS),
      catchError((err: unknown) =>
        throwError(() =>
          err instanceof TimeoutError ? new RequestTimeoutException() : err,
        ),
      ),
    );
  }
}
