import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BookingStatus, Prisma } from '@prisma/client';
import { AuthUser } from '../../../common/decorators/current-user.decorator';
import { buildPage, Page } from '../../../common/dto/page';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { DomainEvent } from '../../../realtime/events/enums/domain-event.enum';
import type { BookingUpdatedEvent } from '../../../realtime/events/realtime-events';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { assertBookingTransition, BookingRole } from './booking-status.machine';
import {
  BookingDto,
  CreateBookingDto,
  ListBookingsQuery,
  UpdateBookingStatusDto,
} from '../dto/booking.dtos';

const BOOKING_INCLUDE = {
  client: { select: { id: true, fullName: true } },
  provider: {
    select: {
      id: true,
      category: true,
      userId: true,
      user: { select: { fullName: true } },
    },
  },
} satisfies Prisma.BookingInclude;

type BookingRow = Prisma.BookingGetPayload<{ include: typeof BOOKING_INCLUDE }>;

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly events: EventEmitter2,
  ) {}

  async create(user: AuthUser, dto: CreateBookingDto): Promise<BookingDto> {
    const provider = await this.prisma.provider.findUnique({
      where: { id: dto.provider_id },
      select: { id: true, userId: true, category: true },
    });
    if (!provider) throw new NotFoundException('Prestataire introuvable.');
    if (provider.userId === user.id) {
      throw new BadRequestException(
        'Tu ne peux pas réserver ton propre profil.',
      );
    }
    const scheduledAt = new Date(dto.scheduled_at);
    if (scheduledAt.getTime() <= Date.now()) {
      throw new BadRequestException('scheduled_at doit être dans le futur.');
    }

    const booking = await this.prisma.booking.create({
      data: {
        clientId: user.id,
        providerId: provider.id,
        serviceCategory: dto.service_category ?? provider.category,
        scheduledAt,
        notes: dto.notes ?? null,
        amountFcfa: dto.amount_fcfa ?? null,
      },
      include: BOOKING_INCLUDE,
    });

    await this.notifications.notify(
      provider.userId,
      'booking',
      `Nouvelle demande de réservation de ${user.fullName}.`,
      { title: 'Nouvelle demande', data: { booking_id: booking.id } },
    );
    this.events.emit(DomainEvent.BOOKING_UPDATED, {
      booking_id: booking.id,
      status: booking.status,
      recipients: [provider.userId, user.id],
    } satisfies BookingUpdatedEvent);
    return toBookingDto(booking);
  }

  async list(
    user: AuthUser,
    query: ListBookingsQuery,
  ): Promise<Page<BookingDto>> {
    const role = query.role ?? 'client';
    let where: Prisma.BookingWhereInput;
    if (role === 'provider') {
      if (!user.providerId) {
        throw new ForbiddenException(
          'Pas de profil prestataire sur ce compte.',
        );
      }
      where = { providerId: user.providerId };
    } else {
      where = { clientId: user.id };
    }
    if (query.status) where = { ...where, status: query.status };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where,
        include: BOOKING_INCLUDE,
        orderBy: { createdAt: 'desc' },
        take: query.limit,
        skip: query.offset,
      }),
      this.prisma.booking.count({ where }),
    ]);
    return buildPage(rows.map(toBookingDto), total, query.limit, query.offset);
  }

  async detail(user: AuthUser, id: string): Promise<BookingDto> {
    return toBookingDto(await this.findOwned(user, id));
  }

  async status(
    user: AuthUser,
    id: string,
  ): Promise<{ id: string; status: BookingStatus }> {
    const booking = await this.findOwned(user, id);
    return { id: booking.id, status: booking.status };
  }

  async updateStatus(
    user: AuthUser,
    id: string,
    dto: UpdateBookingStatusDto,
  ): Promise<BookingDto> {
    const booking = await this.findOwned(user, id);
    const role: BookingRole =
      booking.provider.userId === user.id ? 'provider' : 'client';
    assertBookingTransition(booking.status, dto.status, role);

    let updated: BookingRow;
    if (dto.status === 'completed') {
      [updated] = await this.prisma.$transaction([
        this.prisma.booking.update({
          where: { id },
          data: { status: 'completed', completedAt: new Date() },
          include: BOOKING_INCLUDE,
        }),
        this.prisma.provider.update({
          where: { id: booking.providerId },
          data: { missionsDone: { increment: 1 } },
        }),
      ]);
    } else {
      updated = await this.prisma.booking.update({
        where: { id },
        data: {
          status: dto.status,
          cancelReason:
            dto.status === 'cancelled' ? (dto.reason ?? null) : null,
        },
        include: BOOKING_INCLUDE,
      });
    }

    await this.notifyTransition(updated, role);
    this.events.emit(DomainEvent.BOOKING_UPDATED, {
      booking_id: updated.id,
      status: updated.status,
      recipients: [updated.clientId, updated.provider.userId],
    } satisfies BookingUpdatedEvent);
    return toBookingDto(updated);
  }

  /** Réservation visible uniquement par son client ou son prestataire (sinon 404). */
  private async findOwned(user: AuthUser, id: string): Promise<BookingRow> {
    const booking = await this.prisma.booking.findUnique({
      where: { id },
      include: BOOKING_INCLUDE,
    });
    if (
      !booking ||
      (booking.clientId !== user.id && booking.provider.userId !== user.id)
    ) {
      throw new NotFoundException('Réservation introuvable.');
    }
    return booking;
  }

  private async notifyTransition(
    booking: BookingRow,
    actor: BookingRole,
  ): Promise<void> {
    const providerName = booking.provider.user.fullName;
    const data = { booking_id: booking.id };

    switch (booking.status) {
      case 'confirmed':
        return this.notifications.notify(
          booking.clientId,
          'booking',
          `Ta réservation avec ${providerName} est confirmée.`,
          { title: 'Réservation confirmée', data },
        );
      case 'in_progress':
        return this.notifications.notify(
          booking.clientId,
          'booking',
          `${providerName} a démarré la mission.`,
          { title: 'Mission en cours', data },
        );
      case 'completed':
        return this.notifications.notify(
          booking.clientId,
          'booking',
          `Mission terminée — laisse un avis à ${providerName}.`,
          { title: 'Mission terminée', data },
        );
      case 'cancelled': {
        const recipient =
          actor === 'client' ? booking.provider.userId : booking.clientId;
        return this.notifications.notify(
          recipient,
          'booking',
          `La réservation du ${booking.scheduledAt.toLocaleDateString('fr-FR')} a été annulée.`,
          { title: 'Réservation annulée', data },
        );
      }
      default:
        return;
    }
  }
}

function toBookingDto(b: BookingRow): BookingDto {
  return {
    id: b.id,
    provider_id: b.providerId,
    provider_name: b.provider.user.fullName,
    provider_category: b.provider.category,
    client_id: b.clientId,
    client_name: b.client.fullName,
    service_category: b.serviceCategory,
    scheduled_at: b.scheduledAt.toISOString(),
    notes: b.notes,
    status: b.status,
    amount_fcfa: b.amountFcfa,
    cancel_reason: b.cancelReason,
    completed_at: b.completedAt?.toISOString() ?? null,
    created_at: b.createdAt.toISOString(),
  };
}
