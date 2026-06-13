import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateMeDto {
  @ApiPropertyOptional({ example: 'Kouame Aya' })
  @IsOptional()
  @IsString()
  @Length(2, 80, {
    message: 'Le nom complet doit faire entre 2 et 80 caractères.',
  })
  full_name?: string;

  @ApiPropertyOptional({ example: 'aya@djossi.ci' })
  @IsOptional()
  @IsEmail({}, { message: 'Email invalide.' })
  email?: string;

  @ApiPropertyOptional({ example: 'Yopougon Selmer' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  quarter?: string;

  @ApiPropertyOptional({ example: 5.3364 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @ApiPropertyOptional({ example: -4.0892 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;
}
