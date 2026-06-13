import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NotificationType } from '@prisma/client';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class RegisterDeviceDto {
  @ApiProperty({ description: 'Token Firebase Cloud Messaging.' })
  @IsString()
  @MaxLength(4096)
  fcm_token!: string;

  @ApiPropertyOptional({ enum: ['android', 'ios'] })
  @IsOptional()
  @IsIn(['android', 'ios'])
  platform?: string;
}

export class NotificationDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: NotificationType })
  type!: NotificationType;

  @ApiPropertyOptional({ nullable: true })
  title!: string | null;

  @ApiProperty({ example: 'Ta réservation avec Kouame Yao est confirmée.' })
  message!: string;

  @ApiPropertyOptional({ nullable: true, type: Object })
  data!: Record<string, unknown> | null;

  @ApiProperty()
  is_read!: boolean;

  @ApiProperty()
  created_at!: string;
}
