import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { buildPage, Page } from '../../common/dto/page';
import { PrismaService } from '../../core/prisma/prisma.service';
import { PushPort } from '../../integrations/push/push.port';
import { NotificationDto } from './dto/notification.dtos';

export interface NotifyOptions {
  title?: string;
  data?: Record<string, unknown>;
}

export type NotificationPage = Page<NotificationDto> & {
  unread_count: number;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushPort,
  ) {}

  /**
   * Crée la notification in-app + push. À appeler APRÈS la transaction
   * métier : un échec ici ne doit jamais faire échouer l'action d'origine.
   */
  async notify(
    userId: string,
    type: NotificationType,
    message: string,
    options: NotifyOptions = {},
  ): Promise<void> {
    try {
      await this.prisma.notification.create({
        data: {
          userId,
          type,
          message,
          title: options.title ?? null,
          data: (options.data ?? undefined) as
            | Prisma.InputJsonValue
            | undefined,
        },
      });
      await this.push.sendToUser(userId, {
        title: options.title,
        body: message,
        data: options.data,
      });
    } catch (error) {
      this.logger.error(`Notification ${type} → ${userId} en échec`, error);
    }
  }

  async list(
    userId: string,
    limit: number,
    offset: number,
    unreadOnly: boolean,
  ): Promise<NotificationPage> {
    const where = { userId, ...(unreadOnly ? { isRead: false } : {}) };
    const [rows, total, unreadCount] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, isRead: false } }),
    ]);

    return {
      ...buildPage(rows.map(toNotificationDto), total, limit, offset),
      unread_count: unreadCount,
    };
  }

  async markRead(userId: string, id: string): Promise<NotificationDto> {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });
    if (!notification || notification.userId !== userId) {
      throw new NotFoundException('Notification introuvable.');
    }
    const updated = await this.prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
    return toNotificationDto(updated);
  }

  async markAllRead(userId: string): Promise<{ count: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { count: result.count };
  }

  /**
   * Enregistre/rafraîchit le device d'un utilisateur. On se contente de
   * stocker le token : l'envoi FCM réel se fera plus tard via le PushPort
   * (cf. `notify()` → `push.sendToUser`), dont l'adapter prod résoudra les
   * Devices de l'utilisateur pour pousser le message.
   */
  async registerDevice(
    userId: string,
    fcmToken: string,
    platform?: string,
  ): Promise<{ id: string }> {
    // Un token FCM peut changer de propriétaire (réinstallation) : upsert.
    const device = await this.prisma.device.upsert({
      where: { fcmToken },
      create: { userId, fcmToken, platform: platform ?? null },
      update: { userId, platform: platform ?? null, lastSeenAt: new Date() },
    });
    return { id: device.id };
  }

  /**
   * Désenregistre un device (déconnexion / révocation du token).
   * Idempotent et borné à l'utilisateur courant : on n'efface jamais le
   * token d'un autre compte, et un token déjà absent ne lève pas d'erreur.
   */
  async unregisterDevice(userId: string, fcmToken: string): Promise<void> {
    await this.prisma.device.deleteMany({ where: { userId, fcmToken } });
  }
}

function toNotificationDto(n: {
  id: string;
  type: NotificationType;
  title: string | null;
  message: string;
  data: Prisma.JsonValue | null;
  isRead: boolean;
  createdAt: Date;
}): NotificationDto {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    data: (n.data ?? null) as Record<string, unknown> | null,
    is_read: n.isRead,
    created_at: n.createdAt.toISOString(),
  };
}
