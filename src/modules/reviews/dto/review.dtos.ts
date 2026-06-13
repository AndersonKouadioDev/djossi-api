import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** Tags proposés par l'écran d'avis de l'app Flutter. */
export const REVIEW_TAGS = [
  'Ponctuel',
  'Travail propre',
  'Bon prix',
  'Pro',
  'Sympa',
  'Materiel apporte',
  'Communicatif',
] as const;

export class CreateReviewDto {
  @ApiProperty()
  @IsString()
  booking_id!: string;

  @ApiPropertyOptional({
    example: 'p1',
    description: 'Optionnel — doit correspondre au prestataire du booking.',
  })
  @IsOptional()
  @IsString()
  provider_id?: string;

  @ApiProperty({ minimum: 1, maximum: 5, example: 5 })
  @Type(() => Number)
  @IsInt({ message: 'La note doit être un entier entre 1 et 5.' })
  @Min(1, { message: 'La note doit être au moins 1.' })
  @Max(5, { message: 'La note doit être au plus 5.' })
  rating!: number;

  @ApiPropertyOptional({ enum: REVIEW_TAGS, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @IsIn(REVIEW_TAGS, { each: true, message: 'Tag d’avis inconnu.' })
  tags?: string[];

  @ApiPropertyOptional({ example: 'Très satisfait, travail soigné !' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comment?: string;
}

export class ReviewDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  booking_id!: string;

  @ApiProperty({ example: 'p1' })
  provider_id!: string;

  @ApiProperty({ example: 'Kouame Aya' })
  client_name!: string;

  @ApiPropertyOptional({ nullable: true })
  client_avatar_url!: string | null;

  @ApiProperty({ example: 5 })
  rating!: number;

  @ApiProperty({ type: [String] })
  tags!: string[];

  @ApiPropertyOptional({ nullable: true })
  comment!: string | null;

  @ApiProperty()
  created_at!: string;
}
