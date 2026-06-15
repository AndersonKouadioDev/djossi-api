import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { bearer, createTestApp, login, resetDatabase } from './e2e-utils';

/** GET /users/me/referral — code déterministe, message de partage, compteur. */
describe('Referral (e2e)', () => {
  let app: NestExpressApplication;
  let http: ReturnType<NestExpressApplication['getHttpServer']>;

  beforeAll(async () => {
    await resetDatabase();
    app = await createTestApp();
    http = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  it('sans token → 401', async () => {
    await request(http).get('/v1/users/me/referral').expect(401);
  });

  it('avec token → code DJ + message + invited_count 0', async () => {
    const token = await login(app, '0707070707');
    const res = await request(http)
      .get('/v1/users/me/referral')
      .set(bearer(token))
      .expect(200);

    expect(res.body).toEqual({
      code: expect.stringMatching(/^DJ[A-Z0-9]{1,8}$/),
      share_message: expect.stringContaining(res.body.code),
      invited_count: 0,
    });
    expect(res.body.share_message).toContain('DJOSSI');
  });

  it('le code est déterministe (stable entre deux appels)', async () => {
    const token = await login(app, '0707070707');
    const first = await request(http)
      .get('/v1/users/me/referral')
      .set(bearer(token))
      .expect(200);
    const second = await request(http)
      .get('/v1/users/me/referral')
      .set(bearer(token))
      .expect(200);

    expect(second.body.code).toBe(first.body.code);
  });
});
