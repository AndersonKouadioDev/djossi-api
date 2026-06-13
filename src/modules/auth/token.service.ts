import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { User } from '@prisma/client';
import { randomToken, sha256 } from '../../common/utils/hash.util';
import { Env } from '../../core/config/env';
import { PrismaService } from '../../core/prisma/prisma.service';

export interface TokenPair {
  access_token: string;
  refresh_token: string;
}

export interface AccessPayload {
  sub: string;
  phone: string;
  scope?: string;
}

@Injectable()
export class TokenService {
  private readonly refreshTtlDays: number;
  private readonly registrationTtl: JwtSignOptions['expiresIn'];

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    this.refreshTtlDays = config.get('REFRESH_TTL_DAYS', { infer: true });
    this.registrationTtl = config.get('REGISTRATION_TOKEN_TTL', {
      infer: true,
    });
  }

  /** Access JWT (15 min) + refresh opaque (30 j) stocké hashé. */
  async issuePair(user: Pick<User, 'id' | 'phone'>): Promise<TokenPair> {
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      phone: user.phone,
    } satisfies AccessPayload);

    const refreshToken = randomToken();
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: sha256(refreshToken),
        expiresAt: new Date(
          Date.now() + this.refreshTtlDays * 24 * 60 * 60 * 1000,
        ),
      },
    });

    return { access_token: accessToken, refresh_token: refreshToken };
  }

  /**
   * Rotation : l'ancien refresh est révoqué, une nouvelle paire est émise.
   * Si un token déjà révoqué est rejoué (vol probable), toutes les sessions
   * de l'utilisateur sont révoquées.
   */
  async rotate(refreshToken: string): Promise<TokenPair> {
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(refreshToken) },
      include: { user: { select: { id: true, phone: true } } },
    });
    if (!row) {
      throw new UnauthorizedException('Session invalide. Reconnecte-toi.');
    }
    if (row.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: row.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException('Session révoquée. Reconnecte-toi.');
    }
    if (row.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expirée. Reconnecte-toi.');
    }

    await this.prisma.refreshToken.update({
      where: { id: row.id },
      data: { revokedAt: new Date() },
    });
    return this.issuePair(row.user);
  }

  /** Révoque une session précise, ou toutes celles de l'utilisateur. */
  async revoke(userId: string, refreshToken?: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
        ...(refreshToken ? { tokenHash: sha256(refreshToken) } : {}),
      },
      data: { revokedAt: new Date() },
    });
  }

  /** JWT court scoped "registration", lié au téléphone vérifié par OTP. */
  signRegistrationToken(phone: string): Promise<string> {
    return this.jwt.signAsync(
      { sub: phone, scope: 'registration' },
      { expiresIn: this.registrationTtl },
    );
  }

  /** Retourne le téléphone porté par un registration_token valide. */
  async verifyRegistrationToken(token: string): Promise<string> {
    try {
      const payload = await this.jwt.verifyAsync<{
        sub: string;
        scope?: string;
      }>(token);
      if (payload.scope !== 'registration') throw new Error('wrong scope');
      return payload.sub;
    } catch {
      throw new UnauthorizedException(
        'registration_token invalide ou expiré. Recommence la vérification OTP.',
      );
    }
  }
}
