import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/prisma/prisma.service';
import { toUserDto } from '../users/users.mapper';
import {
  AuthSessionDto,
  RegisterDto,
  SendOtpResponseDto,
  VerifyOtpResponseDto,
} from './dto/auth.dtos';
import { OtpService } from './otp.service';
import { TokenService } from './token.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly tokens: TokenService,
  ) {}

  async sendOtp(phone: string): Promise<SendOtpResponseDto> {
    await this.otp.send(phone);
    return { message: 'Code envoyé par SMS.', expires_in: this.otp.ttl };
  }

  /**
   * Compte existant → session complète.
   * Numéro inconnu → registration_token pour finaliser l'inscription.
   */
  async verifyOtp(phone: string, code: string): Promise<VerifyOtpResponseDto> {
    await this.otp.verify(phone, code);

    const user = await this.prisma.user.findUnique({
      where: { phone },
      include: { provider: { select: { id: true } } },
    });
    if (!user) {
      return {
        user: null,
        registration_token: await this.tokens.signRegistrationToken(phone),
      };
    }
    const pair = await this.tokens.issuePair(user);
    return { user: toUserDto(user), ...pair };
  }

  async register(dto: RegisterDto): Promise<AuthSessionDto> {
    const existing = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'Un compte existe déjà avec ce numéro. Connecte-toi par OTP.',
      );
    }
    const user = await this.prisma.user.create({
      data: {
        phone: dto.phone,
        fullName: dto.full_name,
        email: dto.email ?? null,
        quarter: dto.quarter ?? null,
      },
    });
    const pair = await this.tokens.issuePair(user);
    return { user: toUserDto(user), ...pair };
  }
}
