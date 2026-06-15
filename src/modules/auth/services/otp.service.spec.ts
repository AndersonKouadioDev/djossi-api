import { HttpException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { sha256 } from '../../../common/utils/hash.util';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { SmsPort } from '../../../integrations/sms/sms.port';
import { OtpService } from './otp.service';

type Mock = jest.Mock;

interface Mocks {
  prisma: {
    otpCode: {
      count: Mock;
      create: Mock;
      update: Mock;
      updateMany: Mock;
      findFirst: Mock;
    };
    $transaction: Mock;
  };
  sms: { sendOtp: Mock };
}

async function makeService(
  envOverrides: Record<string, unknown> = {},
): Promise<{ service: OtpService; mocks: Mocks }> {
  const env: Record<string, unknown> = {
    OTP_TTL_SECONDS: 300,
    OTP_MAX_ATTEMPTS: 5,
    OTP_ACCEPT_DEV_CODE: false,
    OTP_THROTTLE_DISABLED: true,
    ...envOverrides,
  };
  const mocks: Mocks = {
    prisma: {
      otpCode: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      $transaction: jest.fn().mockResolvedValue([]),
    },
    sms: { sendOtp: jest.fn().mockResolvedValue(undefined) },
  };

  const moduleRef = await Test.createTestingModule({
    providers: [
      OtpService,
      { provide: PrismaService, useValue: mocks.prisma },
      { provide: SmsPort, useValue: mocks.sms },
      {
        provide: ConfigService,
        useValue: { get: jest.fn((key: string) => env[key]) },
      },
    ],
  }).compile();

  return { service: moduleRef.get(OtpService), mocks };
}

const activeOtp = (code: string, overrides: Record<string, unknown> = {}) => ({
  id: 'otp-1',
  phone: '0707070707',
  codeHash: sha256(code),
  expiresAt: new Date(Date.now() + 60_000),
  attempts: 0,
  consumedAt: null,
  ...overrides,
});

describe('OtpService.send', () => {
  it('génère un code à 6 chiffres et l’envoie par SMS', async () => {
    const { service, mocks } = await makeService();
    await service.send('0707070707');
    expect(mocks.prisma.$transaction).toHaveBeenCalled();
    const [phone, code] = mocks.sms.sendOtp.mock.calls[0] as [string, string];
    expect(phone).toBe('0707070707');
    expect(code).toMatch(/^\d{6}$/);
  });

  it('refuse au-delà de 3 demandes/heure quand le throttle est actif', async () => {
    const { service, mocks } = await makeService({
      OTP_THROTTLE_DISABLED: false,
    });
    mocks.prisma.otpCode.count.mockResolvedValue(3);
    await expect(service.send('0707070707')).rejects.toThrow(HttpException);
    expect(mocks.sms.sendOtp).not.toHaveBeenCalled();
  });
});

describe('OtpService.verify', () => {
  it('accepte le code dev 123456 quand le flag est actif', async () => {
    const { service, mocks } = await makeService({
      OTP_ACCEPT_DEV_CODE: true,
    });
    await expect(
      service.verify('0707070707', '123456'),
    ).resolves.toBeUndefined();
    expect(mocks.prisma.otpCode.updateMany).toHaveBeenCalled();
  });

  it('refuse le code dev quand le flag est inactif', async () => {
    const { service } = await makeService();
    await expect(service.verify('0707070707', '123456')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('consomme le bon code', async () => {
    const { service, mocks } = await makeService();
    mocks.prisma.otpCode.findFirst.mockResolvedValue(activeOtp('654321'));
    await service.verify('0707070707', '654321');
    expect(mocks.prisma.otpCode.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { consumedAt: expect.any(Date) as Date },
      }),
    );
  });

  it('rejette un code expiré', async () => {
    const { service, mocks } = await makeService();
    mocks.prisma.otpCode.findFirst.mockResolvedValue(
      activeOtp('654321', { expiresAt: new Date(Date.now() - 1000) }),
    );
    await expect(service.verify('0707070707', '654321')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('incrémente attempts sur mauvais code', async () => {
    const { service, mocks } = await makeService();
    mocks.prisma.otpCode.findFirst.mockResolvedValue(activeOtp('654321'));
    await expect(service.verify('0707070707', '000000')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(mocks.prisma.otpCode.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { attempts: { increment: 1 } },
      }),
    );
  });

  it('bloque après le nombre max de tentatives (429)', async () => {
    const { service, mocks } = await makeService();
    mocks.prisma.otpCode.findFirst.mockResolvedValue(
      activeOtp('654321', { attempts: 5 }),
    );
    await expect(service.verify('0707070707', '654321')).rejects.toThrow(
      HttpException,
    );
  });
});
