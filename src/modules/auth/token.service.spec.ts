import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { sha256 } from '../../common/utils/hash.util';
import { PrismaService } from '../../core/prisma/prisma.service';
import { TokenService } from './token.service';

type Mock = jest.Mock;

interface Mocks {
  prisma: {
    refreshToken: {
      create: Mock;
      findUnique: Mock;
      update: Mock;
      updateMany: Mock;
    };
  };
  jwt: { signAsync: Mock; verifyAsync: Mock };
}

async function makeService(): Promise<{
  service: TokenService;
  mocks: Mocks;
}> {
  const mocks: Mocks = {
    prisma: {
      refreshToken: {
        create: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    },
    jwt: {
      signAsync: jest.fn().mockResolvedValue('signed-jwt'),
      verifyAsync: jest.fn(),
    },
  };
  const env: Record<string, unknown> = {
    REFRESH_TTL_DAYS: 30,
    REGISTRATION_TOKEN_TTL: '10m',
  };
  const moduleRef = await Test.createTestingModule({
    providers: [
      TokenService,
      { provide: PrismaService, useValue: mocks.prisma },
      { provide: JwtService, useValue: mocks.jwt },
      {
        provide: ConfigService,
        useValue: { get: jest.fn((key: string) => env[key]) },
      },
    ],
  }).compile();
  return { service: moduleRef.get(TokenService), mocks };
}

const user = { id: 'u1', phone: '0707070707' };

describe('TokenService.issuePair', () => {
  it('émet un access JWT et stocke le refresh hashé (jamais en clair)', async () => {
    const { service, mocks } = await makeService();
    const pair = await service.issuePair(user);

    expect(pair.access_token).toBe('signed-jwt');
    expect(pair.refresh_token.length).toBeGreaterThanOrEqual(60);

    const [createArg] = mocks.prisma.refreshToken.create.mock.calls[0] as [
      { data: { tokenHash: string } },
    ];
    expect(createArg.data.tokenHash).toBe(sha256(pair.refresh_token));
    expect(createArg.data.tokenHash).not.toBe(pair.refresh_token);
  });
});

describe('TokenService.rotate', () => {
  it('révoque l’ancien token et émet une nouvelle paire', async () => {
    const { service, mocks } = await makeService();
    mocks.prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt1',
      userId: 'u1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      user,
    });
    const pair = await service.rotate('old-refresh-token-value');
    expect(mocks.prisma.refreshToken.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'rt1' } }),
    );
    expect(pair.access_token).toBe('signed-jwt');
  });

  it('token inconnu → 401', async () => {
    const { service } = await makeService();
    await expect(service.rotate('unknown')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('réutilisation d’un token révoqué → révocation de toutes les sessions + 401', async () => {
    const { service, mocks } = await makeService();
    mocks.prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt1',
      userId: 'u1',
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
      user,
    });
    await expect(service.rotate('reused')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(mocks.prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'u1', revokedAt: null },
      }),
    );
  });

  it('token expiré → 401', async () => {
    const { service, mocks } = await makeService();
    mocks.prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'rt1',
      userId: 'u1',
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1000),
      user,
    });
    await expect(service.rotate('expired')).rejects.toThrow(
      UnauthorizedException,
    );
  });
});

describe('TokenService — registration token', () => {
  it('signe avec le scope registration', async () => {
    const { service, mocks } = await makeService();
    await service.signRegistrationToken('0707070707');
    expect(mocks.jwt.signAsync).toHaveBeenCalledWith(
      { sub: '0707070707', scope: 'registration' },
      { expiresIn: '10m' },
    );
  });

  it('retourne le téléphone d’un token valide', async () => {
    const { service, mocks } = await makeService();
    mocks.jwt.verifyAsync.mockResolvedValue({
      sub: '0707070707',
      scope: 'registration',
    });
    await expect(service.verifyRegistrationToken('t')).resolves.toBe(
      '0707070707',
    );
  });

  it('rejette un access token classique (mauvais scope)', async () => {
    const { service, mocks } = await makeService();
    mocks.jwt.verifyAsync.mockResolvedValue({ sub: 'u1', phone: 'x' });
    await expect(service.verifyRegistrationToken('t')).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
