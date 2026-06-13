/**
 * Payloads typés des événements domaine temps réel.
 *
 * Convention :
 * - chaque payload porte les `ids` utiles (ressource concernée) ;
 * - `recipients` liste les user ids destinataires → le gateway pousse vers
 *   les rooms `user:{id}` correspondantes ;
 * - `roomId` (optionnel) cible une room partagée (`conversation:{id}`,
 *   `ticket:{id}`) pour les abonnés actifs au fil.
 *
 * À cette étape AUCUN service n'émet ces événements : on définit seulement le
 * contrat. Les payloads restent volontairement minces (ids only) pour rester
 * découplés des DTOs HTTP — le client rafraîchit ou complète via REST.
 */

/** Un message de conversation a été créé. */
export interface MessageCreatedEvent {
  /** Id du message créé. */
  message_id: string;
  /** Id de la conversation. */
  conversation_id: string;
  /** User id de l'expéditeur. */
  sender_id: string;
  /** User ids à notifier (destinataire(s) hors expéditeur). */
  recipients: string[];
}

/** Un message de ticket support a été créé. */
export interface SupportMessageCreatedEvent {
  /** Id du message support créé. */
  message_id: string;
  /** Id du ticket. */
  ticket_id: string;
  /** User ids à notifier. */
  recipients: string[];
}

/** Une notification in-app a été créée. */
export interface NotificationCreatedEvent {
  /** Id de la notification créée. */
  notification_id: string;
  /** User id propriétaire de la notification. */
  recipients: string[];
}

/** Une réservation a été créée ou a changé de statut. */
export interface BookingUpdatedEvent {
  /** Id de la réservation. */
  booking_id: string;
  /** Nouveau statut de la réservation. */
  status: string;
  /** User ids concernés (client et/ou prestataire). */
  recipients: string[];
}

/** Association clé d'événement → type de payload, pour l'émission typée. */
import { DomainEvent } from './enums/domain-event.enum';

export interface DomainEventPayloads {
  [DomainEvent.MESSAGE_CREATED]: MessageCreatedEvent;
  [DomainEvent.SUPPORT_MESSAGE_CREATED]: SupportMessageCreatedEvent;
  [DomainEvent.NOTIFICATION_CREATED]: NotificationCreatedEvent;
  [DomainEvent.BOOKING_UPDATED]: BookingUpdatedEvent;
}
