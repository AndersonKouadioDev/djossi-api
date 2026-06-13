import { z } from 'zod';

/** "true"/"false" depuis l'environnement → boolean (z.coerce.boolean serait toujours true). */
const boolFromString = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');

export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  PUBLIC_BASE_URL: z.string().default('http://localhost:3000'),
  CORS_ORIGINS: z.string().default('*'),

  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().min(1).optional(),

  JWT_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default('15m'),
  REGISTRATION_TOKEN_TTL: z.string().default('10m'),
  REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),

  OTP_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
  OTP_ACCEPT_DEV_CODE: boolFromString,
  OTP_THROTTLE_DISABLED: boolFromString,

  WEBHOOK_SECRET: z.string().min(1),
  PAYMENT_MOCK_AUTOCOMPLETE_MS: z.coerce.number().int().min(0).default(3000),
  UPLOAD_DIR: z.string().default('./uploads'),

  // Stockage des fichiers (avatars, portfolio). "local" par défaut : disque
  // local servi sur /uploads. "s3" active l'adaptateur S3-compatible
  // (nécessite les variables S3_* ci-dessous).
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  S3_ENDPOINT: z.string().url().optional(),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET: z.string().optional(),

  THROTTLE_LIMIT: z.coerce.number().int().positive().default(100),

  // Paiement — Wave Checkout. "mock" par défaut : aucun appel réseau, aucun
  // paiement réel. "wave" active l'adaptateur Wave (nécessite WAVE_API_KEY).
  PAYMENT_GATEWAY: z.enum(['mock', 'wave']).default('mock'),
  // Acompte fixe (FCFA) payé via Wave pour confirmer une réservation.
  BOOKING_DEPOSIT_FCFA: z.coerce.number().int().positive().default(2000),
  WAVE_API_KEY: z.string().optional(),
  WAVE_WEBHOOK_SECRET: z.string().optional(),
  WAVE_SUCCESS_URL: z.string().url().default('https://djossi.ci/payment/success'),
  WAVE_ERROR_URL: z.string().url().default('https://djossi.ci/payment/error'),
})
  // Garde-fou : si la passerelle est "wave", la clé doit être présente.
  .refine((e) => e.PAYMENT_GATEWAY !== 'wave' || !!e.WAVE_API_KEY, {
    message: 'WAVE_API_KEY requis lorsque PAYMENT_GATEWAY=wave',
    path: ['WAVE_API_KEY'],
  })
  // Garde-fou : si le stockage est "s3", les variables S3 doivent être présentes.
  .refine(
    (e) =>
      e.STORAGE_DRIVER !== 's3' ||
      !!(
        e.S3_ENDPOINT &&
        e.S3_BUCKET &&
        e.S3_REGION &&
        e.S3_ACCESS_KEY &&
        e.S3_SECRET
      ),
    {
      message:
        'S3_ENDPOINT, S3_BUCKET, S3_REGION, S3_ACCESS_KEY et S3_SECRET requis lorsque STORAGE_DRIVER=s3',
      path: ['STORAGE_DRIVER'],
    },
  );

export type Env = z.infer<typeof envSchema>;

/** Validation au boot — l'app refuse de démarrer si l'environnement est invalide. */
export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const details = result.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('\n  ');
    throw new Error(`Configuration invalide :\n  ${details}`);
  }
  return result.data;
}
