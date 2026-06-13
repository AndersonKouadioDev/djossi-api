import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReportStatus } from '@prisma/client';
import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class CreateReportDto {
  @ApiPropertyOptional({
    description: 'User id signalé (ou provider_id ci-dessous).',
  })
  @IsOptional()
  @IsString()
  target_user_id?: string;

  @ApiPropertyOptional({
    example: 'p1',
    description: 'Provider id signalé — résolu vers son user.',
  })
  @IsOptional()
  @IsString()
  provider_id?: string;

  @ApiPropertyOptional({ description: 'Réservation concernée (optionnel).' })
  @IsOptional()
  @IsString()
  booking_id?: string;

  @ApiProperty({ example: 'no_show' })
  @IsString()
  @Length(2, 80, { message: 'Le motif doit faire entre 2 et 80 caractères.' })
  reason!: string;

  @ApiPropertyOptional({ example: 'Le prestataire n’est jamais venu.' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}

export class ReportDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  target_user_id!: string;

  @ApiProperty({ example: 'no_show' })
  reason!: string;

  @ApiProperty({ enum: ReportStatus })
  status!: ReportStatus;

  @ApiProperty()
  created_at!: string;

  @ApiProperty({
    example:
      'Signalement enregistré. Merci de contribuer à la confiance du quartier.',
  })
  message!: string;
}
