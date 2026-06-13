import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserStatus } from '@prisma/client';

/** Utilisateur attaché à la requête par la JwtStrategy. */
export interface AuthUser {
  id: string;
  phone: string;
  fullName: string;
  status: UserStatus;
  /** id du profil prestataire, null si l'utilisateur n'en a pas. */
  providerId: string | null;
  /** Position/quartier du compte — sert d'origine au calcul des distances. */
  quarter: string | null;
  lat: number | null;
  lng: number | null;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthUser }>();
    return request.user;
  },
);
