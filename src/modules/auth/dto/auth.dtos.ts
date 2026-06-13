import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { normalizePhone } from '../../../common/utils/phone.util';
import { UserDto } from '../../users/dto/user.dto';

const PHONE_MESSAGE =
  'Numéro de téléphone invalide (mobile ivoirien attendu, ex: 0707070707).';

/** Normalise le téléphone avant validation ("+225 07 07 07 07 07" → "0707070707"). */
const TransformPhone = () =>
  Transform(({ value }): unknown =>
    typeof value === 'string' ? (normalizePhone(value) ?? value) : value,
  );

export class SendOtpDto {
  @ApiProperty({ example: '0707070707' })
  @TransformPhone()
  @Matches(/^0[157]\d{8}$/, { message: PHONE_MESSAGE })
  phone!: string;
}

export class VerifyOtpDto {
  @ApiProperty({ example: '0707070707' })
  @TransformPhone()
  @Matches(/^0[157]\d{8}$/, { message: PHONE_MESSAGE })
  phone!: string;

  @ApiProperty({ example: '123456' })
  @Matches(/^\d{6}$/, { message: 'Le code OTP doit contenir 6 chiffres.' })
  code!: string;
}

export class RegisterDto {
  @ApiProperty({ example: 'Kouame Aya' })
  @IsString()
  @Length(2, 80, {
    message: 'Le nom complet doit faire entre 2 et 80 caractères.',
  })
  full_name!: string;

  @ApiProperty({ example: '0707070707' })
  @TransformPhone()
  @Matches(/^0[157]\d{8}$/, { message: PHONE_MESSAGE })
  phone!: string;

  @ApiPropertyOptional({ example: 'aya@djossi.ci' })
  @IsOptional()
  @IsEmail({}, { message: 'Email invalide.' })
  email?: string;

  @ApiPropertyOptional({ example: 'Yopougon Selmer' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  quarter?: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  @MinLength(20, { message: 'refresh_token invalide.' })
  refresh_token!: string;
}

export class LogoutDto {
  @ApiPropertyOptional({
    description: 'Si absent, toutes les sessions sont révoquées.',
  })
  @IsOptional()
  @IsString()
  refresh_token?: string;
}

// ---------- Réponses ----------

export class SendOtpResponseDto {
  @ApiProperty({ example: 'Code envoyé par SMS.' })
  message!: string;

  @ApiProperty({ example: 300 })
  expires_in!: number;
}

export class AuthSessionDto {
  @ApiProperty({ type: UserDto })
  user!: UserDto;

  @ApiProperty()
  access_token!: string;

  @ApiProperty()
  refresh_token!: string;
}

export class VerifyOtpResponseDto {
  @ApiPropertyOptional({
    type: UserDto,
    nullable: true,
    description: 'null si le numéro n’a pas encore de compte.',
  })
  user!: UserDto | null;

  @ApiPropertyOptional({ description: 'Présent si le compte existe.' })
  access_token?: string;

  @ApiPropertyOptional({ description: 'Présent si le compte existe.' })
  refresh_token?: string;

  @ApiPropertyOptional({
    description:
      'Présent si le compte n’existe pas : à passer en Bearer sur POST /auth/register (valide 10 min).',
  })
  registration_token?: string;
}

export class TokenPairDto {
  @ApiProperty()
  access_token!: string;

  @ApiProperty()
  refresh_token!: string;
}
