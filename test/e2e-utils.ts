// Environnement de test : webhook synchrone, throttle large, code OTP dev.
// Défini AVANT la compilation du module Nest (ConfigModule lit process.env).
process.env.PAYMENT_MOCK_AUTOCOMPLETE_MS = '0';
process.env.THROTTLE_LIMIT = '10000';
process.env.OTP_ACCEPT_DEV_CODE = 'true';
process.env.OTP_THROTTLE_DISABLED = 'true';

import { INestApplication } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { seedDatabase } from '../prisma/seed';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

/** Ordre sans importance : TRUNCATE ... CASCADE. `_prisma_migrations` est préservée. */
const TABLES = [
  'devices',
  'notifications',
  'reports',
  'payments',
  'reviews',
  'messages',
  'conversations',
  'bookings',
  'provider_services',
  'provider_photos',
  'providers',
  'services',
  'categories',
  'refresh_tokens',
  'otp_codes',
  'users',
];

/** Remet la base à l'état seed (idempotent, ~quelques secondes sur Neon). */
export async function resetDatabase(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    await prisma.$executeRawUnsafe(
      `TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(', ')} CASCADE`,
    );
    await seedDatabase(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

export async function createTestApp(): Promise<NestExpressApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.init();
  return app;
}

/** Connexion par OTP dev (123456). Retourne l'access token. */
export async function login(
  app: INestApplication,
  phone: string,
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/v1/auth/otp/verify')
    .send({ phone, code: '123456' })
    .expect(200);
  const body = res.body as { access_token?: string };
  if (!body.access_token) {
    throw new Error(`Pas de compte pour ${phone} (registration attendue ?)`);
  }
  return body.access_token;
}

export const bearer = (token: string): Record<string, string> => ({
  Authorization: `Bearer ${token}`,
});
