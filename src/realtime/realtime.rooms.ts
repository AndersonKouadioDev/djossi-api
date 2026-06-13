/** Conventions de nommage des rooms Socket.IO (centralisées). */
export const RealtimeRoom = {
  /** Room privée d'un utilisateur (tous ses sockets). */
  user: (userId: string): string => `user:${userId}`,
  /** Room d'une conversation de messagerie (abonnés actifs au fil). */
  conversation: (conversationId: string): string =>
    `conversation:${conversationId}`,
  /** Room d'un ticket support (abonnés actifs au fil). */
  ticket: (ticketId: string): string => `ticket:${ticketId}`,
} as const;
