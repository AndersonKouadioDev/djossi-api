import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { buildPage, Page } from '../../common/dto/page';
import { PrismaService } from '../../core/prisma/prisma.service';
import { DomainEvent } from '../../realtime/events/enums/domain-event.enum';
import type { MessageCreatedEvent } from '../../realtime/events/realtime-events';
import { NotificationsService } from '../notifications/notifications.service';
import { ConversationDto, MessageDto } from './dto/messaging.dtos';

const CONVERSATION_INCLUDE = {
  client: { select: { id: true, fullName: true, avatarUrl: true } },
  provider: {
    select: {
      id: true,
      userId: true,
      user: { select: { fullName: true, avatarUrl: true } },
    },
  },
} satisfies Prisma.ConversationInclude;

type ConversationRow = Prisma.ConversationGetPayload<{
  include: typeof CONVERSATION_INCLUDE;
}>;

@Injectable()
export class MessagingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly events: EventEmitter2,
  ) {}

  /** Crée (ou retrouve, idempotent) la conversation avec un prestataire. */
  async createConversation(
    user: AuthUser,
    providerId: string,
  ): Promise<ConversationDto> {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
      select: { id: true, userId: true },
    });
    if (!provider) throw new NotFoundException('Prestataire introuvable.');
    if (provider.userId === user.id) {
      throw new BadRequestException(
        'Tu ne peux pas démarrer une conversation avec toi-même.',
      );
    }

    const conversation = await this.prisma.conversation.upsert({
      where: {
        clientId_providerId: { clientId: user.id, providerId: provider.id },
      },
      create: { clientId: user.id, providerId: provider.id },
      update: {},
      include: CONVERSATION_INCLUDE,
    });
    return this.toDto(conversation, 0);
  }

  async listConversations(user: AuthUser): Promise<ConversationDto[]> {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        OR: [{ clientId: user.id }, { provider: { userId: user.id } }],
      },
      include: CONVERSATION_INCLUDE,
      orderBy: [{ lastMessageAt: { sort: 'desc', nulls: 'last' } }],
    });
    if (!conversations.length) return [];

    const unread = await this.prisma.message.groupBy({
      by: ['conversationId'],
      where: {
        conversationId: { in: conversations.map((c) => c.id) },
        readAt: null,
        senderId: { not: user.id },
      },
      _count: { _all: true },
    });
    const unreadByConversation = new Map(
      unread.map((u) => [u.conversationId, u._count._all]),
    );

    return conversations.map((c) =>
      this.toDto(c, unreadByConversation.get(c.id) ?? 0),
    );
  }

  /** Messages (ordre chronologique) — marque les entrants comme lus. */
  async listMessages(
    user: AuthUser,
    conversationId: string,
    limit: number,
    offset: number,
  ): Promise<Page<MessageDto>> {
    await this.findParticipating(user, conversationId);

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.message.count({ where: { conversationId } }),
    ]);

    await this.prisma.message.updateMany({
      where: { conversationId, readAt: null, senderId: { not: user.id } },
      data: { readAt: new Date() },
    });

    return buildPage(rows.map(toMessageDto), total, limit, offset);
  }

  async sendMessage(
    user: AuthUser,
    conversationId: string,
    text: string,
  ): Promise<MessageDto> {
    const conversation = await this.findParticipating(user, conversationId);

    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: { conversationId, senderId: user.id, text },
      }),
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessage: text, lastMessageAt: new Date() },
      }),
    ]);

    const recipientId =
      conversation.clientId === user.id
        ? conversation.provider.userId
        : conversation.clientId;
    this.events.emit(DomainEvent.MESSAGE_CREATED, {
      message_id: message.id,
      conversation_id: conversationId,
      sender_id: user.id,
      recipients: [recipientId],
    } satisfies MessageCreatedEvent);
    await this.notifications.notify(
      recipientId,
      'message',
      `${user.fullName} : ${text.length > 80 ? `${text.slice(0, 77)}…` : text}`,
      { title: 'Nouveau message', data: { conversation_id: conversationId } },
    );

    return toMessageDto(message);
  }

  private async findParticipating(
    user: AuthUser,
    conversationId: string,
  ): Promise<ConversationRow> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: CONVERSATION_INCLUDE,
    });
    if (
      !conversation ||
      (conversation.clientId !== user.id &&
        conversation.provider.userId !== user.id)
    ) {
      throw new NotFoundException('Conversation introuvable.');
    }
    return conversation;
  }

  private toDto(c: ConversationRow, unreadCount: number): ConversationDto {
    return {
      id: c.id,
      provider_id: c.providerId,
      provider_name: c.provider.user.fullName,
      provider_avatar_url: c.provider.user.avatarUrl,
      client_id: c.clientId,
      client_name: c.client.fullName,
      client_avatar_url: c.client.avatarUrl,
      last_message: c.lastMessage,
      last_message_at: c.lastMessageAt?.toISOString() ?? null,
      unread_count: unreadCount,
      created_at: c.createdAt.toISOString(),
    };
  }
}

function toMessageDto(m: {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  createdAt: Date;
  readAt: Date | null;
}): MessageDto {
  return {
    id: m.id,
    conversation_id: m.conversationId,
    sender_id: m.senderId,
    text: m.text,
    sent_at: m.createdAt.toISOString(),
    read_at: m.readAt?.toISOString() ?? null,
  };
}
