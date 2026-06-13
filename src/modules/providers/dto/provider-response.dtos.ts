import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ServiceCategory } from '@prisma/client';

/** Carte prestataire des listes (home, recherche) — contrat ProviderSummary de l'app. */
export class ProviderSummaryDto {
  @ApiProperty({ example: 'p1' })
  id!: string;

  @ApiProperty({ example: 'Kouame Yao' })
  full_name!: string;

  @ApiProperty({ enum: ServiceCategory, example: 'soudeur' })
  category!: ServiceCategory;

  @ApiProperty({ example: 200 })
  distance_meters!: number;

  @ApiProperty({ example: 4.8 })
  rating!: number;

  @ApiProperty({ example: 89 })
  missions_done!: number;

  @ApiProperty()
  is_verified!: boolean;

  @ApiProperty()
  is_pro!: boolean;

  @ApiPropertyOptional({ nullable: true })
  photo_url!: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Yopougon Selmer' })
  quarter!: string | null;
}

export class ProviderDetailDto extends ProviderSummaryDto {
  @ApiProperty({ example: 'Soudure' })
  trade!: string;

  @ApiPropertyOptional({ nullable: true })
  trade_description!: string | null;

  @ApiPropertyOptional({ nullable: true })
  bio!: string | null;

  @ApiProperty({ example: '1km' })
  work_radius!: string;

  @ApiProperty({ type: [String], example: ['Portails', 'Grilles'] })
  services!: string[];

  @ApiProperty({ example: 42 })
  reviews_count!: number;

  @ApiProperty({ type: [String] })
  portfolio_urls!: string[];

  @ApiPropertyOptional({ nullable: true, example: 5000 })
  hourly_rate_min!: number | null;

  @ApiPropertyOptional({ nullable: true, example: 10000 })
  hourly_rate_max!: number | null;

  @ApiProperty()
  member_since!: string;
}

export class ProviderSearchPageDto {
  @ApiProperty({ type: [ProviderSummaryDto] })
  items!: ProviderSummaryDto[];

  @ApiProperty({ example: 5 })
  total!: number;

  @ApiProperty({ example: 20 })
  limit!: number;

  @ApiProperty({ example: 0 })
  offset!: number;

  @ApiProperty({ example: false })
  has_more!: boolean;
}
