import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuthUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { ReportsService } from './reports.service';

type Mock = jest.Mock;

interface Mocks {
  prisma: {
    user: { findUnique: Mock; update: Mock };
    provider: { findUnique: Mock };
    report: { findFirst: Mock; create: Mock; findMany: Mock };
  };
  notifications: { notify: Mock };
}

async function makeService(): Promise<{
  service: ReportsService;
  mocks: Mocks;
}> {
  const mocks: Mocks = {
    prisma: {
      user: {
        // Écho de l'id demandé (comme une vraie DB), statut actif par défaut.
        findUnique: jest
          .fn()
          .mockImplementation(({ where }: { where: { id: string } }) =>
            Promise.resolve({ id: where.id, status: 'active' }),
          ),
        update: jest.fn().mockResolvedValue({}),
      },
      provider: { findUnique: jest.fn().mockResolvedValue(null) },
      report: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'rep1',
          reason: 'no_show',
          status: 'pending',
          createdAt: new Date('2026-06-01T00:00:00Z'),
        }),
        findMany: jest.fn().mockResolvedValue([{ reporterId: 'a' }]),
      },
    },
    notifications: { notify: jest.fn().mockResolvedValue(undefined) },
  };
  const moduleRef = await Test.createTestingModule({
    providers: [
      ReportsService,
      { provide: PrismaService, useValue: mocks.prisma },
      { provide: NotificationsService, useValue: mocks.notifications },
    ],
  }).compile();
  return { service: moduleRef.get(ReportsService), mocks };
}

const reporter = { id: 'reporter-1', fullName: 'Test' } as AuthUser;
const dto = { target_user_id: 'target', reason: 'no_show' };

describe('ReportsService.create', () => {
  it('résout provider_id vers le user du prestataire', async () => {
    const { service, mocks } = await makeService();
    mocks.prisma.provider.findUnique.mockResolvedValue({ userId: 'target' });
    const report = await service.create(reporter, {
      provider_id: 'p1',
      reason: 'no_show',
    });
    expect(report.target_user_id).toBe('target');
  });

  it('refuse l’auto-signalement', async () => {
    const { service } = await makeService();
    await expect(
      service.create(reporter, {
        target_user_id: 'reporter-1',
        reason: 'no_show',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('refuse sans cible', async () => {
    const { service } = await makeService();
    await expect(
      service.create(reporter, { reason: 'no_show' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('refuse le doublon (même reporter, même cible)', async () => {
    const { service, mocks } = await makeService();
    mocks.prisma.report.findFirst.mockResolvedValue({ id: 'existing' });
    await expect(service.create(reporter, dto)).rejects.toThrow(
      ConflictException,
    );
  });

  it('1 reporter : aucun changement de statut', async () => {
    const { service, mocks } = await makeService();
    await service.create(reporter, dto);
    expect(mocks.prisma.user.update).not.toHaveBeenCalled();
  });

  it('2 reporters distincts : compte averti + notification', async () => {
    const { service, mocks } = await makeService();
    mocks.prisma.report.findMany.mockResolvedValue([
      { reporterId: 'a' },
      { reporterId: 'b' },
    ]);
    await service.create(reporter, dto);
    expect(mocks.prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'warned' } }),
    );
    expect(mocks.notifications.notify).toHaveBeenCalledWith(
      'target',
      'system',
      expect.stringContaining('Avertissement'),
      expect.anything(),
    );
  });

  it('3 reporters distincts : compte suspendu', async () => {
    const { service, mocks } = await makeService();
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: 'target',
      status: 'warned',
    });
    mocks.prisma.report.findMany.mockResolvedValue([
      { reporterId: 'a' },
      { reporterId: 'b' },
      { reporterId: 'c' },
    ]);
    const report = await service.create(reporter, dto);
    expect(mocks.prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'suspended' } }),
    );
    expect(report.message).toContain('suspendu');
  });

  it('ne re-suspend pas un compte déjà suspendu', async () => {
    const { service, mocks } = await makeService();
    mocks.prisma.user.findUnique.mockResolvedValue({
      id: 'target',
      status: 'suspended',
    });
    mocks.prisma.report.findMany.mockResolvedValue([
      { reporterId: 'a' },
      { reporterId: 'b' },
      { reporterId: 'c' },
      { reporterId: 'd' },
    ]);
    await service.create(reporter, dto);
    expect(mocks.prisma.user.update).not.toHaveBeenCalled();
  });
});
