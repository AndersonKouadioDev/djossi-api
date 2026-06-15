import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../core/prisma/prisma.service';
import { NotificationsService } from '../notifications/services/notifications.service';
import { CreateReportDto, ReportDto } from './dto/report.dtos';

/** Auto-modération (specs DJOSSI) : 2 signalements → avertissement, 3 → suspension. */
const WARN_THRESHOLD = 2;
const SUSPEND_THRESHOLD = 3;

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(user: AuthUser, dto: CreateReportDto): Promise<ReportDto> {
    const targetUserId = await this.resolveTarget(dto);
    if (targetUserId === user.id) {
      throw new BadRequestException('Tu ne peux pas te signaler toi-même.');
    }

    const existing = await this.prisma.report.findFirst({
      where: {
        reporterId: user.id,
        targetUserId,
        bookingId: dto.booking_id ?? null,
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('Tu as déjà signalé cet utilisateur.');
    }

    const report = await this.prisma.report.create({
      data: {
        reporterId: user.id,
        targetUserId,
        bookingId: dto.booking_id ?? null,
        reason: dto.reason,
        description: dto.description ?? null,
      },
    });

    const newStatus = await this.applyAutoModeration(targetUserId);

    return {
      id: report.id,
      target_user_id: targetUserId,
      reason: report.reason,
      status: report.status,
      created_at: report.createdAt.toISOString(),
      message:
        newStatus === 'suspended'
          ? 'Signalement enregistré. Le compte a été suspendu par la modération automatique.'
          : 'Signalement enregistré. Merci de contribuer à la confiance du quartier.',
    };
  }

  private async resolveTarget(dto: CreateReportDto): Promise<string> {
    if (dto.target_user_id) {
      const target = await this.prisma.user.findUnique({
        where: { id: dto.target_user_id },
        select: { id: true },
      });
      if (!target) throw new NotFoundException('Utilisateur introuvable.');
      return target.id;
    }
    if (dto.provider_id) {
      const provider = await this.prisma.provider.findUnique({
        where: { id: dto.provider_id },
        select: { userId: true },
      });
      if (!provider) throw new NotFoundException('Prestataire introuvable.');
      return provider.userId;
    }
    throw new BadRequestException('target_user_id ou provider_id est requis.');
  }

  /** Compte les signalements de reporters distincts et applique warned/suspended. */
  private async applyAutoModeration(
    targetUserId: string,
  ): Promise<UserStatus | null> {
    const reporters = await this.prisma.report.findMany({
      where: { targetUserId, status: { not: 'dismissed' } },
      select: { reporterId: true },
      distinct: ['reporterId'],
    });
    const count = reporters.length;

    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { status: true },
    });
    if (!target) return null;

    if (count >= SUSPEND_THRESHOLD && target.status !== 'suspended') {
      await this.prisma.user.update({
        where: { id: targetUserId },
        data: { status: 'suspended' },
      });
      await this.notifications.notify(
        targetUserId,
        'system',
        'Ton compte est suspendu suite à plusieurs signalements. Contacte le support DJOSSI.',
        { title: 'Compte suspendu' },
      );
      return 'suspended';
    }

    if (count === WARN_THRESHOLD && target.status === 'active') {
      await this.prisma.user.update({
        where: { id: targetUserId },
        data: { status: 'warned' },
      });
      await this.notifications.notify(
        targetUserId,
        'system',
        'Avertissement : ton compte a reçu plusieurs signalements. Un de plus et il sera suspendu.',
        { title: 'Avertissement' },
      );
      return 'warned';
    }

    return null;
  }
}
