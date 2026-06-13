import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { bearer, createTestApp, login, resetDatabase } from './e2e-utils';

describe('Modération automatique des signalements (e2e)', () => {
  let app: NestExpressApplication;
  let http: ReturnType<NestExpressApplication['getHttpServer']>;
  let reporter1: string;
  let reporter2: string;
  let reporter3: string;
  let targetToken: string; // Fatou Konate (p4 / u-provider-4)

  beforeAll(async () => {
    await resetDatabase();
    app = await createTestApp();
    http = app.getHttpServer();
    reporter1 = await login(app, '0705000001');
    reporter2 = await login(app, '0705000002');
    reporter3 = await login(app, '0705000003');
    targetToken = await login(app, '0701000004');
  });

  afterAll(async () => {
    await app.close();
  });

  it('1er signalement (via provider_id) → enregistré, compte intact', async () => {
    const res = await request(http)
      .post('/v1/reports')
      .set(bearer(reporter1))
      .send({ provider_id: 'p4', reason: 'no_show' })
      .expect(201);
    expect(res.body.target_user_id).toBe('u-provider-4');

    // La cible peut toujours écrire.
    await request(http)
      .post('/v1/messages/conversations')
      .set(bearer(targetToken))
      .send({ provider_id: 'p1' })
      .expect(201);
  });

  it('doublon du même reporter → 409', async () => {
    await request(http)
      .post('/v1/reports')
      .set(bearer(reporter1))
      .send({ provider_id: 'p4', reason: 'no_show' })
      .expect(409);
  });

  it('auto-signalement → 400', async () => {
    await request(http)
      .post('/v1/reports')
      .set(bearer(targetToken))
      .send({ provider_id: 'p4', reason: 'other' })
      .expect(400);
  });

  it('2e reporter distinct → avertissement (notification système)', async () => {
    await request(http)
      .post('/v1/reports')
      .set(bearer(reporter2))
      .send({ provider_id: 'p4', reason: 'bad_quality' })
      .expect(201);

    const notifs = await request(http)
      .get('/v1/notifications')
      .set(bearer(targetToken))
      .expect(200);
    expect(
      notifs.body.items.some(
        (n: { type: string; message: string }) =>
          n.type === 'system' && n.message.includes('Avertissement'),
      ),
    ).toBe(true);
  });

  it('3e reporter distinct → suspension', async () => {
    const res = await request(http)
      .post('/v1/reports')
      .set(bearer(reporter3))
      .send({ provider_id: 'p4', reason: 'fake_profile' })
      .expect(201);
    expect(res.body.message).toContain('suspendu');
  });

  it('le compte suspendu ne peut plus écrire (403) mais peut encore lire', async () => {
    await request(http)
      .post('/v1/bookings')
      .set(bearer(targetToken))
      .send({ provider_id: 'p1', scheduled_at: '2027-03-01T09:00:00.000Z' })
      .expect(403);
    await request(http)
      .post('/v1/messages/conversations')
      .set(bearer(targetToken))
      .send({ provider_id: 'p2' })
      .expect(403);

    await request(http)
      .get('/v1/users/me')
      .set(bearer(targetToken))
      .expect(200);
  });

  it('le prestataire suspendu disparaît de la recherche', async () => {
    const res = await request(http)
      .get('/v1/search/providers')
      .set(bearer(reporter1))
      .expect(200);
    expect(res.body.total).toBe(4);
    expect(res.body.items.map((p: { id: string }) => p.id)).not.toContain('p4');
  });
});
