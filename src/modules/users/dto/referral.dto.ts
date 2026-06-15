import { ApiProperty } from '@nestjs/swagger';

/**
 * Parrainage de l'utilisateur connecté — clés snake_case (contrat app Flutter).
 *
 * Le `code` est dérivé de façon déterministe de l'id user (voir
 * UsersService.referral), donc stable sans migration ni colonne dédiée.
 */
export class ReferralDto {
  @ApiProperty({
    description: 'Code de parrainage stable de l’utilisateur.',
    example: 'DJAB12CD34',
  })
  code!: string;

  @ApiProperty({
    description: 'Texte prêt à partager (contient le code).',
    example:
      'Rejoins-moi sur DJOSSI, les talents de ton quartier ! Utilise mon code DJAB12CD34.',
  })
  share_message!: string;

  @ApiProperty({
    description:
      'Nombre de filleuls inscrits en saisissant ce code de parrainage.',
    example: 3,
  })
  invited_count!: number;
}
