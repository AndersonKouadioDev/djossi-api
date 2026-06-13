import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { AuthUser } from '../decorators/current-user.decorator';

/**
 * Bloque les écritures des comptes suspendus (auto-modération des signalements).
 * À poser sur les endpoints d'écriture sensibles ; les suspendus gardent la lecture.
 */
@Injectable()
export class ActiveUserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context
      .switchToHttp()
      .getRequest<{ user: AuthUser | undefined }>();
    if (user && user.status === 'suspended') {
      throw new ForbiddenException(
        'Compte suspendu : cette action est indisponible.',
      );
    }
    return true;
  }
}
