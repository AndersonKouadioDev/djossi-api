import { SetMetadata } from '@nestjs/common';
import { Role } from '../enums/role.enum';

/** Clé de métadonnée lue par le {@link RolesGuard}. */
export const ROLES_KEY = 'roles';

/**
 * Restreint une route (méthode ou contrôleur) à un ou plusieurs rôles.
 * À combiner avec `@UseGuards(RolesGuard)` (après l'auth JWT globale).
 *
 * @example
 * `@Roles(Role.Provider)` // réservé aux comptes prestataires
 */
export const Roles = (...roles: Role[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
