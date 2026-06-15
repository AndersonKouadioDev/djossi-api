import { ConflictException, ForbiddenException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';

export type BookingRole = 'client' | 'provider';

/** status → { statut atteignable → rôles autorisés }. */
const TRANSITIONS: Record<
  BookingStatus,
  Partial<Record<BookingStatus, BookingRole[]>>
> = {
  pending: {
    confirmed: ['provider'],
    cancelled: ['client', 'provider'],
  },
  confirmed: {
    in_progress: ['provider'],
    cancelled: ['client', 'provider'],
  },
  in_progress: {
    completed: ['provider'],
  },
  completed: {},
  cancelled: {},
};

/**
 * Valide une transition de statut de réservation.
 * Transition inconnue → 409 ; transition connue mais mauvais rôle → 403.
 */
export function assertBookingTransition(
  from: BookingStatus,
  to: BookingStatus,
  role: BookingRole,
): void {
  const allowedRoles = TRANSITIONS[from][to];
  if (!allowedRoles) {
    throw new ConflictException(`Transition ${from} → ${to} non autorisée.`);
  }
  if (!allowedRoles.includes(role)) {
    throw new ForbiddenException(
      `Seul le ${allowedRoles.join(' ou le ')} peut passer une réservation de ${from} à ${to}.`,
    );
  }
}
