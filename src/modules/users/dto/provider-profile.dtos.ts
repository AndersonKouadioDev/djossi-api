import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ServiceCategory } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  Min,
} from 'class-validator';

export const WORK_RADII = ['500m', '1km', '3km', 'Toute la ville'] as const;

/**
 * L'app Flutter envoie les tarifs en String ("5 000") : on coerce vers un
 * entier FCFA en ne gardant que les chiffres. Valeur illisible → undefined.
 */
const TransformRate = () =>
  Transform(({ value }): unknown => {
    if (value == null || value === '') return undefined;
    if (typeof value === 'number') return Math.round(value);
    if (typeof value === 'string') {
      const digits = value.replace(/\D/g, '');
      return digits ? parseInt(digits, 10) : undefined;
    }
    return value;
  });

export class UpsertProviderProfileDto {
  @ApiProperty({ enum: ServiceCategory, example: 'soudeur' })
  @IsEnum(ServiceCategory, { message: 'Catégorie de service inconnue.' })
  category!: ServiceCategory;

  @ApiProperty({ example: 'Soudure' })
  @IsString()
  @Length(2, 60, { message: 'Le métier doit faire entre 2 et 60 caractères.' })
  trade!: string;

  @ApiPropertyOptional({ example: 'Portails, grilles, rampes d’escalier…' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  trade_description?: string;

  @ApiPropertyOptional({ example: 'Spécialisé en portails depuis 10 ans.' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string;

  @ApiPropertyOptional({ example: 'Yopougon Selmer' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  work_quarter?: string;

  @ApiPropertyOptional({ enum: WORK_RADII, example: '1km' })
  @IsOptional()
  @IsIn(WORK_RADII, { message: 'Rayon de travail invalide.' })
  work_radius?: string;

  @ApiPropertyOptional({
    example: '5000',
    description: 'FCFA — String ou nombre, coercé en entier.',
  })
  @TransformRate()
  @IsOptional()
  @IsInt()
  @Min(0)
  hourly_rate_min?: number;

  @ApiPropertyOptional({ example: '10000' })
  @TransformRate()
  @IsOptional()
  @IsInt()
  @Min(0)
  hourly_rate_max?: number;

  @ApiPropertyOptional({ example: '0707070707' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  mobile_money_number?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['Portails', 'Grilles de fenêtres'],
    description: 'Libellés des services proposés (remplace la liste).',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  services?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  kyc_selfie_done?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  kyc_cni_done?: boolean;

  @ApiPropertyOptional({
    description: 'Disponibilité du prestataire pour de nouvelles missions.',
  })
  @IsOptional()
  @IsBoolean()
  is_available?: boolean;
}

export class ProviderProfileDto {
  @ApiProperty({ example: 'p1' })
  id!: string;

  @ApiProperty()
  user_id!: string;

  @ApiProperty({ enum: ServiceCategory })
  category!: ServiceCategory;

  @ApiProperty({ example: 'Soudure' })
  trade!: string;

  @ApiPropertyOptional({ nullable: true })
  trade_description!: string | null;

  @ApiPropertyOptional({ nullable: true })
  bio!: string | null;

  @ApiPropertyOptional({ nullable: true })
  work_quarter!: string | null;

  @ApiProperty({ example: '1km' })
  work_radius!: string;

  @ApiPropertyOptional({ nullable: true, example: 5000 })
  hourly_rate_min!: number | null;

  @ApiPropertyOptional({ nullable: true, example: 10000 })
  hourly_rate_max!: number | null;

  @ApiPropertyOptional({ nullable: true })
  mobile_money_number!: string | null;

  @ApiProperty()
  kyc_selfie_done!: boolean;

  @ApiProperty()
  kyc_cni_done!: boolean;

  @ApiProperty()
  is_verified!: boolean;

  @ApiProperty()
  is_pro!: boolean;

  @ApiProperty({ example: true })
  is_available!: boolean;

  @ApiProperty({ example: 4.8 })
  rating!: number;

  @ApiProperty({ example: 42 })
  reviews_count!: number;

  @ApiProperty({ example: 89 })
  missions_done!: number;

  @ApiProperty({ type: [String] })
  services!: string[];

  @ApiProperty({ type: [String] })
  portfolio_urls!: string[];

  @ApiProperty()
  created_at!: string;
}
