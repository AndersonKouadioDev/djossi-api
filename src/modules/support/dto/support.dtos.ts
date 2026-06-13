import { ApiProperty } from '@nestjs/swagger';
import { SupportSender, SupportTicketStatus } from '@prisma/client';
import { IsString, Length } from 'class-validator';

export class CreateTicketDto {
  @ApiProperty({ example: 'Problème de paiement sur ma réservation' })
  @IsString()
  @Length(3, 120, {
    message: 'Le sujet doit faire entre 3 et 120 caractères.',
  })
  subject!: string;

  @ApiProperty({ example: 'Bonjour, mon paiement a été débité mais la réservation est restée en attente.' })
  @IsString()
  @Length(1, 2000, {
    message: 'Le message doit faire entre 1 et 2000 caractères.',
  })
  message!: string;
}

export class ReplyTicketDto {
  @ApiProperty({ example: 'Merci, voici la référence de la transaction : ABC123.' })
  @IsString()
  @Length(1, 2000, {
    message: 'Le message doit faire entre 1 et 2000 caractères.',
  })
  body!: string;
}

export class SupportMessageDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  ticket_id!: string;

  @ApiProperty({ enum: SupportSender, example: SupportSender.user })
  sender!: SupportSender;

  @ApiProperty()
  body!: string;

  @ApiProperty()
  created_at!: string;
}

export class SupportTicketDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  user_id!: string;

  @ApiProperty({ example: 'Problème de paiement sur ma réservation' })
  subject!: string;

  @ApiProperty({ enum: SupportTicketStatus, example: SupportTicketStatus.open })
  status!: SupportTicketStatus;

  @ApiProperty()
  created_at!: string;

  @ApiProperty()
  updated_at!: string;

  @ApiProperty({
    type: SupportMessageDto,
    nullable: true,
    description: 'Dernier message du ticket (présent dans la liste).',
  })
  last_message!: SupportMessageDto | null;
}

export class SupportTicketDetailDto extends SupportTicketDto {
  @ApiProperty({ type: [SupportMessageDto] })
  messages!: SupportMessageDto[];
}
