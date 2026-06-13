import { ApiPropertyOptional } from '@nestjs/swagger';
import { ServiceCategory } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';

export class SearchProvidersQuery extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Texte libre : nom, métier ou description.',
    example: 'soudeur',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  query?: string;

  @ApiPropertyOptional({ enum: ServiceCategory })
  @IsOptional()
  @IsEnum(ServiceCategory, { message: 'Catégorie inconnue.' })
  category?: ServiceCategory;

  @ApiPropertyOptional({ example: 'Yopougon' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  quarter?: string;

  @ApiPropertyOptional({
    description: 'Position du chercheur (sinon celle du compte).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;
}
