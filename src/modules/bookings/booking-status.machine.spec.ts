import { ConflictException, ForbiddenException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { assertBookingTransition, BookingRole } from './booking-status.machine';

describe('assertBookingTransition', () => {
  const ok: Array<[BookingStatus, BookingStatus, BookingRole]> = [
    ['pending', 'confirmed', 'provider'],
    ['pending', 'cancelled', 'client'],
    ['pending', 'cancelled', 'provider'],
    ['confirmed', 'in_progress', 'provider'],
    ['confirmed', 'cancelled', 'client'],
    ['confirmed', 'cancelled', 'provider'],
    ['in_progress', 'completed', 'provider'],
  ];
  it.each(ok)('autorise %s → %s pour %s', (from, to, role) => {
    expect(() => assertBookingTransition(from, to, role)).not.toThrow();
  });

  const wrongRole: Array<[BookingStatus, BookingStatus, BookingRole]> = [
    ['pending', 'confirmed', 'client'],
    ['confirmed', 'in_progress', 'client'],
    ['in_progress', 'completed', 'client'],
  ];
  it.each(wrongRole)('refuse %s → %s pour %s (403)', (from, to, role) => {
    expect(() => assertBookingTransition(from, to, role)).toThrow(
      ForbiddenException,
    );
  });

  const illegal: Array<[BookingStatus, BookingStatus]> = [
    ['pending', 'in_progress'],
    ['pending', 'completed'],
    ['confirmed', 'completed'],
    ['in_progress', 'cancelled'],
    ['in_progress', 'confirmed'],
    ['completed', 'cancelled'],
    ['completed', 'pending'],
    ['cancelled', 'confirmed'],
    ['cancelled', 'completed'],
  ];
  it.each(illegal)(
    'rejette %s → %s (409), quel que soit le rôle',
    (from, to) => {
      expect(() => assertBookingTransition(from, to, 'provider')).toThrow(
        ConflictException,
      );
      expect(() => assertBookingTransition(from, to, 'client')).toThrow(
        ConflictException,
      );
    },
  );
});
