import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthUser } from '../../../common/decorators/current-user.decorator';
import { buildPage, Page } from '../../../common/dto/page';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { CreateReviewDto, ReviewDto } from '../dto/review.dtos';

const REVIEW_INCLUDE = {
  client: { select: { fullName: true, avatarUrl: true } },
} satisfies Prisma.ReviewInclude;

type ReviewRow = Prisma.ReviewGetPayload<{ include: typeof REVIEW_INCLUDE }>;

export type ProviderReviewsPage = Page<ReviewDto> & { average_rating: number };

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(user: AuthUser, dto: CreateReviewDto): Promise<ReviewDto> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: dto.booking_id },
      include: {
        review: { select: { id: true } },
        provider: { select: { id: true, userId: true } },
      },
    });
    if (!booking) throw new NotFoundException('Réservation introuvable.');
    if (booking.clientId !== user.id) {
      throw new ForbiddenException(
        'Seul le client de la réservation peut laisser un avis.',
      );
    }
    if (booking.status !== 'completed') {
      throw new UnprocessableEntityException(
        'L’avis n’est possible qu’après une mission terminée.',
      );
    }
    if (booking.review) {
      throw new ConflictException(
        'Un avis existe déjà pour cette réservation.',
      );
    }
    if (dto.provider_id && dto.provider_id !== booking.providerId) {
      throw new BadRequestException(
        'provider_id ne correspond pas à la réservation.',
      );
    }

    const review = await this.prisma.$transaction(async (tx) => {
      const created = await tx.review.create({
        data: {
          bookingId: booking.id,
          clientId: user.id,
          providerId: booking.providerId,
          rating: dto.rating,
          tags: dto.tags ?? [],
          comment: dto.comment ?? null,
        },
        include: REVIEW_INCLUDE,
      });
      // Recalcul complet (et non incrémental) : toujours exact.
      const aggregate = await tx.review.aggregate({
        where: { providerId: booking.providerId },
        _avg: { rating: true },
        _count: { _all: true },
      });
      await tx.provider.update({
        where: { id: booking.providerId },
        data: {
          ratingAvg: aggregate._avg.rating ?? 0,
          ratingCount: aggregate._count._all,
        },
      });
      return created;
    });

    await this.notifications.notify(
      booking.provider.userId,
      'review',
      `${user.fullName} a laissé un avis ${dto.rating}/5.`,
      { title: 'Nouvel avis', data: { booking_id: booking.id } },
    );

    return toReviewDto(review);
  }

  async listForProvider(
    providerId: string,
    limit: number,
    offset: number,
  ): Promise<ProviderReviewsPage> {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
      select: { ratingAvg: true },
    });
    if (!provider) throw new NotFoundException('Prestataire introuvable.');

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where: { providerId },
        include: REVIEW_INCLUDE,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.review.count({ where: { providerId } }),
    ]);

    return {
      ...buildPage(rows.map(toReviewDto), total, limit, offset),
      average_rating: Math.round(provider.ratingAvg * 10) / 10,
    };
  }
}

function toReviewDto(r: ReviewRow): ReviewDto {
  return {
    id: r.id,
    booking_id: r.bookingId,
    provider_id: r.providerId,
    client_name: r.client.fullName,
    client_avatar_url: r.client.avatarUrl,
    rating: r.rating,
    tags: r.tags,
    comment: r.comment,
    created_at: r.createdAt.toISOString(),
  };
}
