import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Journalise chaque requête HTTP : méthode, URL, code de statut et durée.
 * Transparent (ne modifie ni la réponse ni les erreurs) — contrat HTTP inchangé.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const { method, originalUrl } = req;
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () =>
          this.logger.log(
            `${method} ${originalUrl} ${res.statusCode} +${Date.now() - start}ms`,
          ),
        error: (err: { status?: number }) =>
          this.logger.warn(
            `${method} ${originalUrl} ${err?.status ?? 500} +${Date.now() - start}ms`,
          ),
      }),
    );
  }
}
