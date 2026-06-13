import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

/** Démarre le paiement de l'acompte (montant fixe serveur) via Wave Checkout. */
export class CheckoutDepositDto {
  @ApiProperty({ example: 'b-demo-pending' })
  @IsString()
  booking_id!: string;
}

/** Session de paiement créée : l'app ouvre `launch_url` dans une webview. */
export class CheckoutSessionDto {
  @ApiProperty()
  payment_id!: string;

  @ApiProperty({ example: 'PAY-abc123' })
  reference!: string;

  @ApiProperty({ example: 2000, description: 'Acompte FCFA.' })
  amount_fcfa!: number;

  @ApiProperty({ example: 'https://pay.wave.com/c/cos-18qq25rgr100a' })
  launch_url!: string;
}

export class InitPaymentDto {
  @ApiProperty()
  @IsString()
  booking_id!: string;

  @ApiProperty({ enum: PaymentMethod, example: 'wave' })
  @IsEnum(PaymentMethod, { message: 'Moyen de paiement inconnu.' })
  method!: PaymentMethod;

  @ApiPropertyOptional({
    example: '0707070707',
    description: 'Numéro Mobile Money à débiter (mock : finir par 00 → échec).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone_number?: string;

  @ApiPropertyOptional({
    example: 8000,
    description: 'FCFA — par défaut, le montant de la réservation.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'Le montant doit être positif.' })
  amount_fcfa?: number;
}

export class PaymentCallbackDto {
  @ApiProperty({ example: 'PAY-abc123' })
  @IsString()
  reference!: string;

  @ApiProperty({ enum: ['completed', 'failed'] })
  @IsIn(['completed', 'failed'])
  status!: 'completed' | 'failed';

  @ApiPropertyOptional({ example: 'Solde insuffisant' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  failure_reason?: string;
}

export class PaymentDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  booking_id!: string;

  @ApiProperty({ example: 8000 })
  amount_fcfa!: number;

  @ApiProperty({ enum: PaymentMethod })
  method!: PaymentMethod;

  @ApiProperty({ enum: PaymentStatus })
  status!: PaymentStatus;

  @ApiProperty({ example: 'PAY-abc123' })
  reference!: string;

  @ApiPropertyOptional({ nullable: true })
  phone_number!: string | null;

  @ApiPropertyOptional({ nullable: true })
  failure_reason!: string | null;

  @ApiPropertyOptional({ nullable: true })
  completed_at!: string | null;

  @ApiProperty()
  created_at!: string;
}
