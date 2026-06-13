import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server } from 'socket.io';
import { DomainEvent, RealtimeMessage } from './events/enums/domain-event.enum';
import type {
  BookingUpdatedEvent,
  MessageCreatedEvent,
  NotificationCreatedEvent,
  SupportMessageCreatedEvent,
} from './events/realtime-events';
import { RealtimeRoom } from './realtime.rooms';
import type { AuthSocket } from './ws-jwt.guard';
import { WsJwtGuard } from './ws-jwt.guard';

/**
 * Passerelle temps réel Socket.IO.
 *
 * - À la connexion : authentifie le handshake (JWT, même secret que l'HTTP).
 *   Échec → `disconnect`. Succès → join de la room privée `user:{userId}`.
 * - `conversation:subscribe` / `support:subscribe` : join des rooms de fil
 *   (`conversation:{id}` / `ticket:{id}`) pour recevoir les messages en direct.
 * - Écoute les événements domaine (@OnEvent) et émet vers les bonnes rooms.
 *
 * `cors: true` : l'app mobile et le web peuvent se connecter (pas de préfixe
 * `/v1` sur les WebSockets — contrat HTTP REST inchangé).
 */
@WebSocketGateway({ cors: true })
export class RealtimeGateway implements OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  private readonly server!: Server;

  constructor(private readonly wsJwtGuard: WsJwtGuard) {}

  /** Authentifie la connexion ; rejoint `user:{userId}` ou déconnecte. */
  async handleConnection(client: AuthSocket): Promise<void> {
    let userId: string;
    try {
      userId = await this.wsJwtGuard.authenticate(client);
    } catch {
      client.disconnect(true);
      return;
    }
    client.data.userId = userId;
    await client.join(RealtimeRoom.user(userId));
    this.logger.debug(`Socket ${client.id} connecté (user ${userId}).`);
  }

  /** Abonnement au fil d'une conversation pour la recevoir en direct. */
  @SubscribeMessage('conversation:subscribe')
  async subscribeConversation(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() body: { conversation_id?: string } | string,
  ): Promise<{ ok: boolean }> {
    const conversationId = readId(body, 'conversation_id');
    if (!conversationId) return { ok: false };
    await client.join(RealtimeRoom.conversation(conversationId));
    return { ok: true };
  }

  /** Abonnement au fil d'un ticket support pour le recevoir en direct. */
  @SubscribeMessage('support:subscribe')
  async subscribeSupport(
    @ConnectedSocket() client: AuthSocket,
    @MessageBody() body: { ticket_id?: string } | string,
  ): Promise<{ ok: boolean }> {
    const ticketId = readId(body, 'ticket_id');
    if (!ticketId) return { ok: false };
    await client.join(RealtimeRoom.ticket(ticketId));
    return { ok: true };
  }

  // --- Émission depuis les événements domaine -----------------------------
  // À cette étape aucun service n'émet ces événements : le gateway est prêt à
  // les relayer dès que les services les publieront via EventEmitter2.

  @OnEvent(DomainEvent.MESSAGE_CREATED)
  emitMessageCreated(event: MessageCreatedEvent): void {
    // Abonnés actifs au fil + chaque destinataire (badge/liste).
    this.server
      .to(RealtimeRoom.conversation(event.conversation_id))
      .emit(RealtimeMessage.MESSAGE_CREATED, event);
    this.emitToUsers(event.recipients, RealtimeMessage.MESSAGE_CREATED, event);
  }

  @OnEvent(DomainEvent.SUPPORT_MESSAGE_CREATED)
  emitSupportMessageCreated(event: SupportMessageCreatedEvent): void {
    this.server
      .to(RealtimeRoom.ticket(event.ticket_id))
      .emit(RealtimeMessage.SUPPORT_MESSAGE_CREATED, event);
    this.emitToUsers(
      event.recipients,
      RealtimeMessage.SUPPORT_MESSAGE_CREATED,
      event,
    );
  }

  @OnEvent(DomainEvent.NOTIFICATION_CREATED)
  emitNotificationCreated(event: NotificationCreatedEvent): void {
    this.emitToUsers(
      event.recipients,
      RealtimeMessage.NOTIFICATION_CREATED,
      event,
    );
  }

  @OnEvent(DomainEvent.BOOKING_UPDATED)
  emitBookingUpdated(event: BookingUpdatedEvent): void {
    this.emitToUsers(event.recipients, RealtimeMessage.BOOKING_UPDATED, event);
  }

  /** Émet un événement vers les rooms privées d'une liste d'utilisateurs. */
  private emitToUsers(
    userIds: string[],
    message: RealtimeMessage,
    payload: unknown,
  ): void {
    for (const userId of userIds) {
      this.server.to(RealtimeRoom.user(userId)).emit(message, payload);
    }
  }
}

/** Lit un id depuis un body objet ({ key: id }) ou string brut. */
function readId(
  body: Record<string, unknown> | string,
  key: string,
): string | null {
  if (typeof body === 'string') return body.length > 0 ? body : null;
  const value = body?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}
