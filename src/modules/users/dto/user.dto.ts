import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Représentation publique d'un utilisateur — clés snake_case (contrat app Flutter). */
export class UserDto {
  @ApiProperty({ example: 'cm9x1a2b3c4d5e6f7g8h9i0j1' })
  id!: string;

  @ApiProperty({ example: '0707070707' })
  phone!: string;

  @ApiProperty({ example: 'Kouame Aya' })
  full_name!: string;

  @ApiPropertyOptional({ example: 'aya@djossi.ci', nullable: true })
  email!: string | null;

  @ApiPropertyOptional({ nullable: true })
  avatar_url!: string | null;

  @ApiPropertyOptional({ example: 'Yopougon Selmer', nullable: true })
  quarter!: string | null;

  @ApiProperty({ example: '2026-01-15T00:00:00.000Z' })
  created_at!: string;

  @ApiProperty({ description: 'Vrai si un profil prestataire existe.' })
  is_provider!: boolean;

  @ApiPropertyOptional({ nullable: true })
  provider_id!: string | null;
}
