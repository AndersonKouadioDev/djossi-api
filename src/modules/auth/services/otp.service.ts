import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomOtpCode, sha256 } from '../../../common/utils/hash.util';
import { Env } from '../../../core/config/env';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { SmsPort } from '../../../integrations/sms/sms.port';

/** Code accepté en dev quand OTP_ACCEPT_DEV_CODE=true — celui du mock Flutter. */
const DEV_CODE = '123456';
const OTP_HOURLY_LIMIT = 3;

@Injectable()
export class OtpService {
  private readonly ttlSeconds: number;
  private readonly maxAttempts: number;
  private readonly acceptDevCode: boolean;
  private readonly throttleDisabled: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sms: SmsPort,
    config: ConfigService<Env, true>,
  ) {
    this.ttlSeconds = config.get('OTP_TTL_SECONDS', { infer: true });
    this.maxAttempts = config.get('OTP_MAX_ATTEMPTS', { infer: true });
    this.acceptDevCode = config.get('OTP_ACCEPT_DEV_CODE', { infer: true });
    this.throttleDisabled = config.get('OTP_THROTTLE_DISABLED', {
      infer: true,
    });
  }

  get ttl(): number {
    return this.ttlSeconds;
  }

  async send(phone: string): Promise<void> {
    if (!this.throttleDisabled) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recent = await this.prisma.otpCode.count({
        where: { phone, createdAt: { gte: oneHourAgo } },
      });
      if (recent >= OTP_HOURLY_LIMIT) {
        throw new HttpException(
          'Trop de demandes de code. Réessaie dans une heure.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const code = randomOtpCode();
    await this.prisma.$transaction([
      // Un seul code actif par numéro : les précédents sont consommés.
      this.prisma.otpCode.updateMany({
        where: { phone, consumedAt: null },
        data: { consumedAt: new Date() },
      }),
      this.prisma.otpCode.create({
        data: {
          phone,
          codeHash: sha256(code),
          expiresAt: new Date(Date.now() + this.ttlSeconds * 1000),
        },
      }),
    ]);

    await this.sms.sendOtp(phone, code);
  }

  /** Vérifie le code et le consomme. Lève 401/429 sinon. */
  async verify(phone: string, code: string): Promise<void> {
    if (this.acceptDevCode && code === DEV_CODE) {
      await this.prisma.otpCode.updateMany({
        where: { phone, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      return;
    }

    const otp = await this.prisma.otpCode.findFirst({
      where: { phone, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp || otp.expiresAt < new Date()) {
      throw new UnauthorizedException('Code OTP invalide ou expiré.');
    }
    if (otp.attempts >= this.maxAttempts) {
      throw new HttpException(
        'Trop de tentatives. Redemande un nouveau code.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (sha256(code) !== otp.codeHash) {
      await this.prisma.otpCode.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException('Code OTP invalide.');
    }

    await this.prisma.otpCode.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    });
  }
}
