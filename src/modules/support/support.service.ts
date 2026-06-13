import { Injectable, NotFoundException } from '@nestjs/common';
import { SupportSender } from '@prisma/client';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../core/prisma/prisma.service';
import {
  SupportMessageDto,
  SupportTicketDetailDto,
  SupportTicketDto,
} from './dto/support.dtos';

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  /** Crée un ticket avec son premier message (sender=user). */
  async createTicket(
    user: AuthUser,
    subject: string,
    message: string,
  ): Promise<SupportTicketDetailDto> {
    const ticket = await this.prisma.supportTicket.create({
      data: {
        userId: user.id,
        subject,
        messages: { create: { sender: SupportSender.user, body: message } },
      },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    return {
      ...toTicketDto(ticket, ticket.messages.at(-1) ?? null),
      messages: ticket.messages.map(toMessageDto),
    };
  }

  /** Mes tickets, plus récents d'abord, avec le dernier message. */
  async listTickets(user: AuthUser): Promise<SupportTicketDto[]> {
    const tickets = await this.prisma.supportTicket.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    return tickets.map((t) => toTicketDto(t, t.messages[0] ?? null));
  }

  /** Détail d'un ticket (à moi) + tous ses messages. */
  async getTicket(
    user: AuthUser,
    ticketId: string,
  ): Promise<SupportTicketDetailDto> {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!ticket || ticket.userId !== user.id) {
      throw new NotFoundException('Ticket introuvable.');
    }
    return {
      ...toTicketDto(ticket, ticket.messages.at(-1) ?? null),
      messages: ticket.messages.map(toMessageDto),
    };
  }

  /** Ajoute un message (sender=user) et rouvre le ticket si besoin. */
  async reply(
    user: AuthUser,
    ticketId: string,
    body: string,
  ): Promise<SupportMessageDto> {
    const ticket = await this.prisma.supportTicket.findUnique({
      where: { id: ticketId },
      select: { id: true, userId: true, status: true },
    });
    if (!ticket || ticket.userId !== user.id) {
      throw new NotFoundException('Ticket introuvable.');
    }

    const [message] = await this.prisma.$transaction([
      this.prisma.supportMessage.create({
        data: { ticketId, sender: SupportSender.user, body },
      }),
      this.prisma.supportTicket.update({
        where: { id: ticketId },
        data: {
          // Une réponse client rouvre un ticket résolu/clôturé ; sinon updatedAt suffit.
          status:
            ticket.status === 'resolved' || ticket.status === 'closed'
              ? 'open'
              : ticket.status,
        },
      }),
    ]);

    return toMessageDto(message);
  }
}

function toTicketDto(
  t: {
    id: string;
    userId: string;
    subject: string;
    status: SupportTicketDto['status'];
    createdAt: Date;
    updatedAt: Date;
  },
  lastMessage: Parameters<typeof toMessageDto>[0] | null,
): SupportTicketDto {
  return {
    id: t.id,
    user_id: t.userId,
    subject: t.subject,
    status: t.status,
    created_at: t.createdAt.toISOString(),
    updated_at: t.updatedAt.toISOString(),
    last_message: lastMessage ? toMessageDto(lastMessage) : null,
  };
}

function toMessageDto(m: {
  id: string;
  ticketId: string;
  sender: SupportSender;
  body: string;
  createdAt: Date;
}): SupportMessageDto {
  return {
    id: m.id,
    ticket_id: m.ticketId,
    sender: m.sender,
    body: m.body,
    created_at: m.createdAt.toISOString(),
  };
}
