import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class CreateConversationDto {
  @ApiProperty({ example: 'p1' })
  @IsString()
  provider_id!: string;
}

export class SendMessageDto {
  @ApiProperty({ example: 'Bonjour, vous êtes disponible demain ?' })
  @IsString()
  @Length(1, 2000, {
    message: 'Le message doit faire entre 1 et 2000 caractères.',
  })
  text!: string;
}

export class ConversationDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'p1' })
  provider_id!: string;

  @ApiProperty({ example: 'Kouame Yao' })
  provider_name!: string;

  @ApiPropertyOptional({ nullable: true })
  provider_avatar_url!: string | null;

  @ApiProperty()
  client_id!: string;

  @ApiProperty({ example: 'Kouame Aya' })
  client_name!: string;

  @ApiPropertyOptional({ nullable: true })
  client_avatar_url!: string | null;

  @ApiPropertyOptional({ nullable: true })
  last_message!: string | null;

  @ApiPropertyOptional({ nullable: true })
  last_message_at!: string | null;

  @ApiProperty({ example: 2 })
  unread_count!: number;

  @ApiProperty()
  created_at!: string;
}

export class MessageDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  conversation_id!: string;

  @ApiProperty({ description: 'User id de l’expéditeur.' })
  sender_id!: string;

  @ApiProperty()
  text!: string;

  @ApiProperty()
  sent_at!: string;

  @ApiPropertyOptional({ nullable: true })
  read_at!: string | null;
}
