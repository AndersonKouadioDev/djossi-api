import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { normalizePhone } from '../../../common/utils/phone.util';
import { TokenService } from '../services/token.service';

/**
 * Protège POST /auth/register : exige un registration_token (Bearer) émis par
 * verify-otp, et vérifie qu'il correspond bien au téléphone du body.
 * NB : les guards s'exécutent avant les pipes — le body est encore brut,
 * d'où la normalisation locale du téléphone.
 */
@Injectable()
export class RegistrationTokenGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'registration_token requis (vérifie d’abord ton numéro par OTP).',
      );
    }
    const phone = await this.tokens.verifyRegistrationToken(header.slice(7));

    const body = request.body as { phone?: unknown };
    const bodyPhone =
      typeof body?.phone === 'string' ? normalizePhone(body.phone) : null;
    if (!bodyPhone || bodyPhone !== phone) {
      throw new UnauthorizedException(
        'Le téléphone ne correspond pas au registration_token.',
      );
    }
    return true;
  }
}
