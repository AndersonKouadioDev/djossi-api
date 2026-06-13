import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import {
  AuthSessionDto,
  LogoutDto,
  RefreshDto,
  RegisterDto,
  SendOtpDto,
  SendOtpResponseDto,
  TokenPairDto,
  VerifyOtpDto,
  VerifyOtpResponseDto,
} from './dto/auth.dtos';
import { AuthService } from './auth.service';
import { RegistrationTokenGuard } from './guards/registration-token.guard';
import { TokenService } from './token.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
  ) {}

  @Public()
  @Post('otp/send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Envoie un code OTP par SMS.' })
  @ApiOkResponse({ type: SendOtpResponseDto })
  sendOtp(@Body() dto: SendOtpDto): Promise<SendOtpResponseDto> {
    return this.auth.sendOtp(dto.phone);
  }

  @Public()
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Vérifie le code OTP. Compte existant → tokens ; sinon → registration_token.',
  })
  @ApiOkResponse({ type: VerifyOtpResponseDto })
  verifyOtp(@Body() dto: VerifyOtpDto): Promise<VerifyOtpResponseDto> {
    return this.auth.verifyOtp(dto.phone, dto.code);
  }

  @Public()
  @UseGuards(RegistrationTokenGuard)
  @Post('register')
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Crée le compte (registration_token de verify-otp requis en Bearer).',
  })
  @ApiCreatedResponse({ type: AuthSessionDto })
  register(@Body() dto: RegisterDto): Promise<AuthSessionDto> {
    return this.auth.register(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rafraîchit la session (rotation du refresh token).',
  })
  @ApiOkResponse({ type: TokenPairDto })
  refresh(@Body() dto: RefreshDto): Promise<TokenPairDto> {
    return this.tokens.rotate(dto.refresh_token);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Révoque la session donnée, ou toutes si refresh_token absent.',
  })
  @ApiNoContentResponse()
  async logout(
    @CurrentUser() user: AuthUser,
    @Body() dto: LogoutDto,
  ): Promise<void> {
    await this.tokens.revoke(user.id, dto.refresh_token);
  }
}
