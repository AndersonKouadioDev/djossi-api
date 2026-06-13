/**
 * Catalogue centralisé des événements domaine temps réel.
 *
 * Ces clés servent à la fois à l'émission (`EventEmitter2.emit`) et à l'écoute
 * (`@OnEvent`) côté gateway. On garde des chaînes namespacées ("domaine.action")
 * pour rester lisibles dans les logs et compatibles avec les wildcards
 * éventuels d'EventEmitter2.
 */
export enum DomainEvent {
  /** Un message de conversation (messagerie 1-1) vient d'être créé. */
  MESSAGE_CREATED = 'message.created',
  /** Un message de ticket support vient d'être créé. */
  SUPPORT_MESSAGE_CREATED = 'support.message.created',
  /** Une notification in-app vient d'être créée pour un utilisateur. */
  NOTIFICATION_CREATED = 'notification.created',
  /** Une réservation a changé d'état (création ou transition de statut). */
  BOOKING_UPDATED = 'booking.updated',
}

/**
 * Noms des événements WebSocket émis vers le client (canal Socket.IO).
 * Stables : l'app Flutter s'abonnera à ces noms exacts.
 */
export enum RealtimeMessage {
  MESSAGE_CREATED = 'message:created',
  SUPPORT_MESSAGE_CREATED = 'support:message:created',
  NOTIFICATION_CREATED = 'notification:created',
  BOOKING_UPDATED = 'booking:updated',
}
