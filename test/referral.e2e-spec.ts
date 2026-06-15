import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { bearer, createTestApp, login, resetDatabase } from './e2e-utils';

/** GET /users/me/referral — code déterministe, message de partage, compteur. */
describe('Referral (e2e)', () => {
  let app: NestExpressApplication;
  let http: ReturnType<NestExpressApplication['getHttpServer']>;

  // Numéros mobiles ivoiriens valides (^0[157]\d{8}$) et uniques par appel,
  // pour ne jamais entrer en collision entre tests ni avec le seed.
  let phoneSeq = Date.now() % 90_000_000;
  const uniquePhone = (): string =>
    `01${(phoneSeq++ % 90_000_000).toString().padStart(8, '0')}`;

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

  it('avec token → code DJ + message + invited_count', async () => {
    const token = await login(app, '0707070707');
    const res = await request(http)
      .get('/v1/users/me/referral')
      .set(bearer(token))
      .expect(200);

    expect(res.body).toEqual({
      code: expect.stringMatching(/^DJ[A-Z0-9]{1,8}$/),
      share_message: expect.stringContaining(res.body.code),
      invited_count: expect.any(Number),
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

  it('invited_count augmente quand un filleul s’inscrit avec le code', async () => {
    const token = await login(app, '0707070707');
    const before = await request(http)
      .get('/v1/users/me/referral')
      .set(bearer(token))
      .expect(200);
    const code = before.body.code as string;
    const baseline = before.body.invited_count as number;

    // Un nouveau numéro s'inscrit en passant le code de parrainage du parrain.
    const phone = uniquePhone();
    const verify = await request(http)
      .post('/v1/auth/otp/verify')
      .send({ phone, code: '123456' })
      .expect(200);
    const registrationToken = verify.body.registration_token as string;
    expect(registrationToken).toBeDefined();

    await request(http)
      .post('/v1/auth/register')
      .set(bearer(registrationToken))
      .send({ full_name: 'Filleul Test', phone, referral_code: code })
      .expect(201);

    // Le compteur du parrain reflète le nouveau filleul.
    const after = await request(http)
      .get('/v1/users/me/referral')
      .set(bearer(token))
      .expect(200);
    expect(after.body.invited_count).toBe(baseline + 1);
  });

  it('s’inscrire sans code de parrainage n’incrémente personne', async () => {
    const token = await login(app, '0707070707');
    const before = await request(http)
      .get('/v1/users/me/referral')
      .set(bearer(token))
      .expect(200);
    const baseline = before.body.invited_count as number;

    const phone = uniquePhone();
    const verify = await request(http)
      .post('/v1/auth/otp/verify')
      .send({ phone, code: '123456' })
      .expect(200);

    await request(http)
      .post('/v1/auth/register')
      .set(bearer(verify.body.registration_token as string))
      .send({ full_name: 'Sans Parrain', phone })
      .expect(201);

    const after = await request(http)
      .get('/v1/users/me/referral')
      .set(bearer(token))
      .expect(200);
    expect(after.body.invited_count).toBe(baseline);
  });
});
