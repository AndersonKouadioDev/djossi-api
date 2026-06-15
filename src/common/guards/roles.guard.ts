import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthUser } from '../decorators/current-user.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '../enums/role.enum';

/**
 * Contrôle d'accès basé sur les rôles, en opt-in via `@Roles(...)`.
 *
 * - Sans `@Roles`, la route passe (aucun impact sur l'existant).
 * - `Role.Provider` exige un profil prestataire (`user.providerId` présent).
 *
 * À appliquer par route avec `@UseGuards(RolesGuard)` : les guards de route
 * s'exécutent APRÈS l'auth JWT globale, donc `request.user` est garanti.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const { user } = context
      .switchToHttp()
      .getRequest<{ user?: AuthUser }>();
    if (!user) throw new ForbiddenException('Authentification requise.');

    if (required.includes(Role.Provider) && !user.providerId) {
      throw new ForbiddenException('Action réservée aux prestataires.');
    }
    return true;
  }
}
