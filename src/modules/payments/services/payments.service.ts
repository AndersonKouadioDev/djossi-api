import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Payment } from '@prisma/client';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { AuthUser } from '../../../common/decorators/current-user.decorator';
import { buildPage, Page } from '../../../common/dto/page';
import { Env } from '../../../core/config/env';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { PaymentGatewayPort } from '../../../integrations/payments-gateway/payment-gateway.port';
import { NotificationsService } from '../../notifications/services/notifications.service';
import {
  CheckoutDepositDto,
  CheckoutSessionDto,
  InitPaymentDto,
  PaymentCallbackDto,
  PaymentDto,
} from '../dto/payment.dtos';

/** Forme minimale d'un événement webhook Wave. */
interface WaveWebhookEvent {
  type: string;
  data?: {
    client_reference?: string | null;
    payment_status?: string;
    last_payment_error?: { message?: string } | null;
  };
}

/** Statuts de réservation pour lesquels un encaissement a du sens. */
const PAYABLE_STATUSES = ['confirmed', 'in_progress', 'completed'] as const;

@Injectable()
export class PaymentsService implements OnModuleInit {
  private readonly webhookSecret: string;
  private readonly gatewayMode: 'mock' | 'wave';
  private readonly depositFcfa: number;
  private readonly successUrl: string;
  private readonly errorUrl: string;
  private readonly waveWebhookSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: PaymentGatewayPort,
    private readonly notifications: NotificationsService,
    config: ConfigService<Env, true>,
  ) {
    this.webhookSecret = config.get('WEBHOOK_SECRET', { infer: true });
    this.gatewayMode = config.get('PAYMENT_GATEWAY', { infer: true });
    this.depositFcfa = config.get('BOOKING_DEPOSIT_FCFA', { infer: true });
    this.successUrl = config.get('WAVE_SUCCESS_URL', { infer: true });
    this.errorUrl = config.get('WAVE_ERROR_URL', { infer: true });
    this.waveWebhookSecret =
      config.get('WAVE_WEBHOOK_SECRET', { infer: true }) ?? '';
  }

  onModuleInit(): void {
    // Le mock simule le webhook du fournisseur via ce handler.
    this.gateway.onSettlement(async (event) => {
      await this.applySettlement(
        event.reference,
        event.status,
        event.failureReason,
      );
    });
  }

  async init(user: AuthUser, dto: InitPaymentDto): Promise<PaymentDto> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.booking_id },
      include: { provider: { select: { userId: true } } },
    });
    if (!booking || booking.clientId !== user.id) {
      throw new NotFoundException('Réservation introuvable.');
    }
    if (!PAYABLE_STATUSES.includes(booking.status as never)) {
      throw new UnprocessableEntityException(
        'La réservation doit être confirmée avant le paiement.',
      );
    }
    const amount = dto.amount_fcfa ?? booking.amountFcfa;
    if (!amount || amount <= 0) {
      throw new BadRequestException(
        'Aucun montant défini : précise amount_fcfa.',
      );
    }

    const reference = `PAY-${randomBytes(8).toString('hex')}`;
    const payment = await this.prisma.payment.create({
      data: {
        bookingId: booking.id,
        payerId: user.id,
        amountFcfa: amount,
        method: dto.method,
        reference,
        phoneNumber: dto.phone_number ?? null,
      },
    });

    const result = await this.gateway.initiate({
      reference,
      amountFcfa: amount,
      method: dto.method,
      phoneNumber: dto.phone_number,
    });
    if (result.status === 'completed') {
      await this.applySettlement(reference, 'completed');
    }

    const fresh = await this.prisma.payment.findUniqueOrThrow({
      where: { id: payment.id },
    });
    return toPaymentDto(fresh);
  }

  /**
   * Démarre le paiement de l'acompte (montant fixe serveur) via Wave Checkout.
   * Crée un Payment `pending` et retourne la `launch_url` à ouvrir en webview.
   * Le règlement est confirmé par le webhook (ou la page mock en dev).
   */
  async checkout(
    user: AuthUser,
    dto: CheckoutDepositDto,
  ): Promise<CheckoutSessionDto> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.booking_id },
    });
    if (!booking || booking.clientId !== user.id) {
      throw new NotFoundException('Réservation introuvable.');
    }
    if (booking.status === 'cancelled' || booking.status === 'completed') {
      throw new UnprocessableEntityException(
        'Cette réservation ne peut plus être payée.',
      );
    }

    const amount = this.depositFcfa;
    const reference = `PAY-${randomBytes(8).toString('hex')}`;
    const payment = await this.prisma.payment.create({
      data: {
        bookingId: booking.id,
        payerId: user.id,
        amountFcfa: amount,
        method: 'wave',
        reference,
      },
    });

    const session = await this.gateway.createCheckout({
      reference,
      amountFcfa: amount,
      successUrl: this.successUrl,
      errorUrl: this.errorUrl,
    });

    return {
      payment_id: payment.id,
      reference,
      amount_fcfa: amount,
      launch_url: session.launchUrl,
    };
  }

  /** Page de paiement factice (dev) → règle le paiement. Mock uniquement. */
  async confirmMockCheckout(reference: string, success: boolean): Promise<void> {
    if (this.gatewayMode !== 'mock') {
      throw new NotFoundException();
    }
    await this.applySettlement(
      reference,
      success ? 'completed' : 'failed',
      success ? undefined : 'Paiement annulé',
    );
  }

  /**
   * Webhook Wave (signé HMAC-SHA256, header `Wave-Signature`). Source de
   * vérité du paiement : confirme/échoue le règlement de façon idempotente.
   */
  async handleWaveWebhook(
    rawBody: string,
    signature: string | undefined,
  ): Promise<void> {
    if (!this.verifyWaveSignature(rawBody, signature)) {
      throw new UnauthorizedException('Signature webhook Wave invalide.');
    }
    const event = JSON.parse(rawBody) as WaveWebhookEvent;
    if (event.type !== 'checkout.session.completed') return;

    const reference = event.data?.client_reference;
    if (!reference) return;
    const succeeded = event.data?.payment_status === 'succeeded';
    await this.applySettlement(
      reference,
      succeeded ? 'completed' : 'failed',
      event.data?.last_payment_error?.message,
    );
  }

  /** Vérifie `Wave-Signature: t=…,v1=…` (HMAC-SHA256 de `timestamp+rawBody`). */
  private verifyWaveSignature(
    rawBody: string,
    header: string | undefined,
    toleranceSeconds = 300,
  ): boolean {
    if (!header || !this.waveWebhookSecret) return false;
    const parts = header.split(',');
    const timestamp = parts.find((p) => p.startsWith('t='))?.slice(2);
    const signatures = parts
      .filter((p) => p.startsWith('v1='))
      .map((p) => p.slice(3));
    if (!timestamp || signatures.length === 0) return false;

    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - Number(timestamp)) > toleranceSeconds) return false;

    const expected = createHmac('sha256', this.waveWebhookSecret)
      .update(`${timestamp}${rawBody}`)
      .digest('hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    return signatures.some((sig) => {
      const sigBuf = Buffer.from(sig, 'hex');
      return (
        sigBuf.length === expectedBuf.length &&
        timingSafeEqual(sigBuf, expectedBuf)
      );
    });
  }

  /** Webhook fournisseur (signé par x-webhook-secret). */
  async handleCallback(
    dto: PaymentCallbackDto,
    secret: string | undefined,
  ): Promise<{ message: string }> {
    if (secret !== this.webhookSecret) {
      throw new UnauthorizedException('Signature webhook invalide.');
    }
    const applied = await this.applySettlement(
      dto.reference,
      dto.status,
      dto.failure_reason,
    );
    return { message: applied ? 'ok' : 'already processed' };
  }

  async history(
    user: AuthUser,
    limit: number,
    offset: number,
  ): Promise<Page<PaymentDto>> {
    const where = { payerId: user.id };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.payment.count({ where }),
    ]);
    return buildPage(rows.map(toPaymentDto), total, limit, offset);
  }

  /**
   * Idempotent : seul un paiement `pending` est transitionnable.
   * Retourne false si la référence est inconnue ou déjà traitée.
   */
  private async applySettlement(
    reference: string,
    status: 'completed' | 'failed',
    failureReason?: string,
  ): Promise<boolean> {
    const result = await this.prisma.payment.updateMany({
      where: { reference, status: 'pending' },
      data: {
        status,
        failureReason: status === 'failed' ? (failureReason ?? null) : null,
        completedAt: status === 'completed' ? new Date() : null,
      },
    });
    if (result.count === 0) return false;

    const payment = await this.prisma.payment.findUnique({
      where: { reference },
      include: {
        booking: { include: { provider: { select: { userId: true } } } },
      },
    });
    if (!payment) return true;

    if (status === 'completed') {
      // L'acompte confirme la réservation (pending → confirmed).
      if (payment.booking.status === 'pending') {
        await this.prisma.booking.update({
          where: { id: payment.bookingId },
          data: { status: 'confirmed' },
        });
      }
      await this.notifications.notify(
        payment.payerId,
        'payment',
        `Paiement de ${payment.amountFcfa.toLocaleString('fr-FR')} FCFA effectué.`,
        { title: 'Paiement confirmé', data: { payment_id: payment.id } },
      );
      await this.notifications.notify(
        payment.booking.provider.userId,
        'payment',
        `Tu as reçu ${payment.amountFcfa.toLocaleString('fr-FR')} FCFA (${payment.method}).`,
        { title: 'Paiement reçu', data: { payment_id: payment.id } },
      );
    } else {
      await this.notifications.notify(
        payment.payerId,
        'payment',
        `Paiement échoué : ${failureReason ?? 'erreur du fournisseur'}.`,
        { title: 'Paiement échoué', data: { payment_id: payment.id } },
      );
    }
    return true;
  }
}

function toPaymentDto(p: Payment): PaymentDto {
  return {
    id: p.id,
    booking_id: p.bookingId,
    amount_fcfa: p.amountFcfa,
    method: p.method,
    status: p.status,
    reference: p.reference,
    phone_number: p.phoneNumber,
    failure_reason: p.failureReason,
    completed_at: p.completedAt?.toISOString() ?? null,
    created_at: p.createdAt.toISOString(),
  };
}
