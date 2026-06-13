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
  });

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
