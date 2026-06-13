import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingStatus, ServiceCategory } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class CreateBookingDto {
  @ApiProperty({ example: 'p1' })
  @IsString()
  provider_id!: string;

  @ApiPropertyOptional({
    enum: ServiceCategory,
    description: 'Par défaut : la catégorie du prestataire.',
  })
  @IsOptional()
  @IsEnum(ServiceCategory, { message: 'Catégorie inconnue.' })
  service_category?: ServiceCategory;

  @ApiProperty({ example: '2026-07-01T14:00:00.000Z' })
  @IsISO8601(
    { strict: true },
    { message: 'scheduled_at doit être une date ISO 8601.' },
  )
  scheduled_at!: string;

  @ApiPropertyOptional({ example: 'Soudure portail entrée, prévoir échelle.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional({
    example: 8000,
    description: 'Montant convenu (FCFA).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  amount_fcfa?: number;
}

export class UpdateBookingStatusDto {
  @ApiProperty({ enum: BookingStatus, example: 'confirmed' })
  @IsEnum(BookingStatus, { message: 'Statut de réservation inconnu.' })
  status!: BookingStatus;

  @ApiPropertyOptional({ example: 'Indisponible à cette date.' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}

export class ListBookingsQuery extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: ['client', 'provider'],
    description: 'Côté du compte à lister (défaut : client).',
  })
  @IsOptional()
  @IsIn(['client', 'provider'])
  role?: 'client' | 'provider';

  @ApiPropertyOptional({ enum: BookingStatus })
  @IsOptional()
  @IsEnum(BookingStatus, { message: 'Statut de réservation inconnu.' })
  status?: BookingStatus;
}

export class BookingDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'p1' })
  provider_id!: string;

  @ApiProperty({ example: 'Kouame Yao' })
  provider_name!: string;

  @ApiProperty({ enum: ServiceCategory })
  provider_category!: ServiceCategory;

  @ApiProperty()
  client_id!: string;

  @ApiProperty({ example: 'Kouame Aya' })
  client_name!: string;

  @ApiProperty({ enum: ServiceCategory })
  service_category!: ServiceCategory;

  @ApiProperty()
  scheduled_at!: string;

  @ApiPropertyOptional({ nullable: true })
  notes!: string | null;

  @ApiProperty({ enum: BookingStatus })
  status!: BookingStatus;

  @ApiPropertyOptional({ nullable: true, example: 8000 })
  amount_fcfa!: number | null;

  @ApiPropertyOptional({ nullable: true })
  cancel_reason!: string | null;

  @ApiPropertyOptional({ nullable: true })
  completed_at!: string | null;

  @ApiProperty()
  created_at!: string;
}
