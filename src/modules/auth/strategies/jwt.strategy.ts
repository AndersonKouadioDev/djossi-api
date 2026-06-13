import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthUser } from '../../../common/decorators/current-user.decorator';
import { Env } from '../../../core/config/env';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { AccessPayload } from '../token.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get('JWT_SECRET', { infer: true }),
    });
  }

  async validate(payload: AccessPayload): Promise<AuthUser> {
    // Un registration_token (scope présent) ne donne pas accès à l'API.
    if (payload.scope) {
      throw new UnauthorizedException('Token invalide.');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { provider: { select: { id: true } } },
    });
    if (!user) {
      throw new UnauthorizedException('Compte introuvable.');
    }
    return {
      id: user.id,
      phone: user.phone,
      fullName: user.fullName,
      status: user.status,
      providerId: user.provider?.id ?? null,
      quarter: user.quarter,
      lat: user.lat,
      lng: user.lng,
    };
  }
}
