import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class AddFavoriteDto {
  @ApiProperty({ example: 'p1', description: 'Identifiant du prestataire à ajouter aux favoris.' })
  @IsString()
  @Length(1, 64)
  provider_id!: string;
}
