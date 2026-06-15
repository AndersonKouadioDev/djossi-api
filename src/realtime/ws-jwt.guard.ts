import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { AccessPayload } from '../modules/auth/services/token.service';

/** Socket authentifié : son user id est attaché par le WsJwtGuard. */
export interface AuthSocket extends Socket {
  data: Socket['data'] & { userId?: string };
}

/**
 * Garde WebSocket : authentifie une connexion Socket.IO avec le MÊME JWT et le
 * MÊME secret que l'auth HTTP (le `JwtService` du `JwtModule` partagé via
 * `AuthModule`).
 *
 * Le token est lu depuis `handshake.auth.token` (recommandé côté client), avec
 * repli sur la query `?token=`. Un token de scope `registration` est refusé
 * (comme côté HTTP). En cas de succès, `socket.data.userId` est renseigné.
 */
@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const client = context.switchToWs().getClient<AuthSocket>();
    const userId = await this.authenticate(client);
    client.data.userId = userId;
    return true;
  }

  /**
   * Vérifie le token porté par le handshake et renvoie le user id.
   * Réutilisable hors pipeline de guard (ex. à la connexion du gateway).
   * Lève une `WsException` si le token est absent ou invalide.
   */
  async authenticate(client: Socket): Promise<string> {
    const token = extractToken(client);
    if (!token) {
      throw new WsException('Token manquant.');
    }
    try {
      const payload = await this.jwt.verifyAsync<AccessPayload>(token);
      // Un registration_token (scope présent) ne donne pas accès au temps réel.
      if (payload.scope) {
        throw new WsException('Token invalide.');
      }
      return payload.sub;
    } catch (error) {
      if (error instanceof WsException) throw error;
      this.logger.debug(`Handshake WS rejeté : ${String(error)}`);
      throw new WsException('Token invalide ou expiré.');
    }
  }
}

/** Lit le JWT depuis handshake.auth.token, repli sur la query `token`. */
function extractToken(client: Socket): string | null {
  const auth = client.handshake.auth as { token?: unknown } | undefined;
  if (auth && typeof auth.token === 'string' && auth.token.length > 0) {
    return auth.token;
  }
  const queryToken = client.handshake.query?.token;
  if (typeof queryToken === 'string' && queryToken.length > 0) {
    return queryToken;
  }
  if (Array.isArray(queryToken) && typeof queryToken[0] === 'string') {
    return queryToken[0];
  }
  return null;
}
