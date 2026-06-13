import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { bearer, createTestApp, resetDatabase } from './e2e-utils';

const NEW_PHONE = '0151234567';

describe('Auth (e2e)', () => {
  let app: NestExpressApplication;
  let http: ReturnType<NestExpressApplication['getHttpServer']>;
  let registrationToken: string;
  let accessToken: string;
  let refreshToken: string;

  beforeAll(async () => {
    await resetDatabase();
    app = await createTestApp();
    http = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /auth/otp/send → 200 avec expiration', async () => {
    const res = await request(http)
      .post('/v1/auth/otp/send')
      .send({ phone: NEW_PHONE })
      .expect(200);
    expect(res.body).toMatchObject({ expires_in: 300 });
  });

  it('téléphone invalide → 400 avec message string', async () => {
    const res = await request(http)
      .post('/v1/auth/otp/send')
      .send({ phone: '123' })
      .expect(400);
    expect(typeof res.body.message).toBe('string');
  });

  it('verify numéro inconnu → user null + registration_token', async () => {
    const res = await request(http)
      .post('/v1/auth/otp/verify')
      .send({ phone: NEW_PHONE, code: '123456' })
      .expect(200);
    expect(res.body.user).toBeNull();
    expect(res.body.registration_token).toBeDefined();
    expect(res.body.access_token).toBeUndefined();
    registrationToken = res.body.registration_token as string;
  });

  it('mauvais code OTP → 401', async () => {
    await request(http)
      .post('/v1/auth/otp/verify')
      .send({ phone: NEW_PHONE, code: '999999' })
      .expect(401);
  });

  it('register sans registration_token → 401', async () => {
    await request(http)
      .post('/v1/auth/register')
      .send({ full_name: 'Test E2E', phone: NEW_PHONE })
      .expect(401);
  });

  it('register avec un autre téléphone que celui du token → 401', async () => {
    await request(http)
      .post('/v1/auth/register')
      .set(bearer(registrationToken))
      .send({ full_name: 'Test E2E', phone: '0150000000' })
      .expect(401);
  });

  it('register OK → user snake_case + tokens', async () => {
    const res = await request(http)
      .post('/v1/auth/register')
      .set(bearer(registrationToken))
      .send({ full_name: 'Test E2E', phone: NEW_PHONE, quarter: 'Cocody' })
      .expect(201);
    expect(res.body.user).toMatchObject({
      full_name: 'Test E2E',
      phone: NEW_PHONE,
      quarter: 'Cocody',
      is_provider: false,
    });
    expect(res.body.user.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    accessToken = res.body.access_token as string;
    refreshToken = res.body.refresh_token as string;
    expect(accessToken).toBeDefined();
    expect(refreshToken).toBeDefined();
  });

  it('le registration_token ne donne pas accès à l’API', async () => {
    await request(http)
      .get('/v1/users/me')
      .set(bearer(registrationToken))
      .expect(401);
  });

  it('register en double (token rejoué) → 409', async () => {
    await request(http)
      .post('/v1/auth/register')
      .set(bearer(registrationToken))
      .send({ full_name: 'Doublon', phone: NEW_PHONE })
      .expect(409);
  });

  it('GET /users/me avec access token → 200 ; sans → 401', async () => {
    const res = await request(http)
      .get('/v1/users/me')
      .set(bearer(accessToken))
      .expect(200);
    expect(res.body.full_name).toBe('Test E2E');
    await request(http).get('/v1/users/me').expect(401);
  });

  it('verify sur compte existant → session directe', async () => {
    const res = await request(http)
      .post('/v1/auth/otp/verify')
      .send({ phone: NEW_PHONE, code: '123456' })
      .expect(200);
    expect(res.body.user.full_name).toBe('Test E2E');
    expect(res.body.access_token).toBeDefined();
    expect(res.body.registration_token).toBeUndefined();
  });

  it('refresh : rotation puis détection de réutilisation', async () => {
    const rotated = await request(http)
      .post('/v1/auth/refresh')
      .send({ refresh_token: refreshToken })
      .expect(200);
    const newRefresh = rotated.body.refresh_token as string;
    expect(newRefresh).not.toBe(refreshToken);

    // Rejouer l'ancien → 401 + révocation de toutes les sessions du user.
    await request(http)
      .post('/v1/auth/refresh')
      .send({ refresh_token: refreshToken })
      .expect(401);
    await request(http)
      .post('/v1/auth/refresh')
      .send({ refresh_token: newRefresh })
      .expect(401);
  });

  it('logout → 204', async () => {
    await request(http)
      .post('/v1/auth/logout')
      .set(bearer(accessToken))
      .send({})
      .expect(204);
  });
});
