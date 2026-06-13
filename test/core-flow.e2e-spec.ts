import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { bearer, createTestApp, login, resetDatabase } from './e2e-utils';

describe('Flux cœur : recherche → booking → avis → paiement → messagerie (e2e)', () => {
  let app: NestExpressApplication;
  let http: ReturnType<NestExpressApplication['getHttpServer']>;
  let clientToken: string; // Kouame Aya (0707070707)
  let providerToken: string; // Kouame Yao, user de p1 (0701000001)
  let bookingId: string;

  beforeAll(async () => {
    await resetDatabase();
    app = await createTestApp();
    http = app.getHttpServer();
    clientToken = await login(app, '0707070707');
    providerToken = await login(app, '0701000001');
  });

  afterAll(async () => {
    await app.close();
  });

  // ---------- Catalogue & recherche ----------

  it('GET /services/categories → 12 catégories publiques', async () => {
    const res = await request(http).get('/v1/services/categories').expect(200);
    expect(res.body).toHaveLength(12);
    expect(res.body[0]).toMatchObject({ slug: 'soudeur', label: 'Soudeur' });
  });

  it('search?query=soud → p1 en snake_case avec distance ~200 m', async () => {
    const res = await request(http)
      .get('/v1/search/providers?query=soud')
      .set(bearer(clientToken))
      .expect(200);
    expect(res.body.total).toBe(1);
    const p1 = res.body.items[0];
    expect(p1).toMatchObject({
      id: 'p1',
      full_name: 'Kouame Yao',
      category: 'soudeur',
      rating: 4.8,
      missions_done: 89,
      is_verified: true,
      is_pro: true,
      quarter: 'Yopougon Selmer',
    });
    expect(p1.distance_meters).toBeGreaterThanOrEqual(195);
    expect(p1.distance_meters).toBeLessThanOrEqual(205);
  });

  it('filtres catégorie + quartier + pagination', async () => {
    const byCategory = await request(http)
      .get('/v1/search/providers?category=plombier')
      .set(bearer(clientToken))
      .expect(200);
    expect(byCategory.body.items.map((p: { id: string }) => p.id)).toEqual([
      'p3',
    ]);

    const byQuarter = await request(http)
      .get('/v1/search/providers?quarter=Yopougon')
      .set(bearer(clientToken))
      .expect(200);
    expect(byQuarter.body.total).toBe(5);
    // Tri : les Pro d'abord (p1, p5), puis par note (p2 4.9, p3 4.7, p4 4.6).
    expect(byQuarter.body.items.map((p: { id: string }) => p.id)).toEqual([
      'p1',
      'p5',
      'p2',
      'p3',
      'p4',
    ]);

    const page = await request(http)
      .get('/v1/search/providers?limit=2&offset=4')
      .set(bearer(clientToken))
      .expect(200);
    expect(page.body.items).toHaveLength(1);
    expect(page.body.has_more).toBe(false);
  });

  it('GET /providers/p1 → fiche détaillée', async () => {
    const res = await request(http)
      .get('/v1/providers/p1')
      .set(bearer(clientToken))
      .expect(200);
    expect(res.body).toMatchObject({
      rating: 4.8,
      reviews_count: 5,
      missions_done: 89,
      hourly_rate_min: 5000,
      hourly_rate_max: 10000,
      work_radius: '1km',
    });
    expect(res.body.services).toContain('Portails');
  });

  // ---------- Cycle de réservation ----------

  it('client crée une réservation → pending + notification prestataire', async () => {
    const res = await request(http)
      .post('/v1/bookings')
      .set(bearer(clientToken))
      .send({
        provider_id: 'p1',
        scheduled_at: '2027-03-01T09:00:00.000Z',
        notes: 'Grille de fenêtre à réparer',
        amount_fcfa: 6000,
      })
      .expect(201);
    expect(res.body.status).toBe('pending');
    expect(res.body.provider_name).toBe('Kouame Yao');
    bookingId = res.body.id as string;

    const notifs = await request(http)
      .get('/v1/notifications')
      .set(bearer(providerToken))
      .expect(200);
    expect(
      notifs.body.items.some(
        (n: { type: string; message: string }) =>
          n.type === 'booking' && n.message.includes('Kouame Aya'),
      ),
    ).toBe(true);
  });

  it('date passée ou auto-réservation → 400', async () => {
    await request(http)
      .post('/v1/bookings')
      .set(bearer(clientToken))
      .send({ provider_id: 'p1', scheduled_at: '2020-01-01T09:00:00.000Z' })
      .expect(400);
    await request(http)
      .post('/v1/bookings')
      .set(bearer(providerToken))
      .send({ provider_id: 'p1', scheduled_at: '2027-03-01T09:00:00.000Z' })
      .expect(400);
  });

  it('un tiers ne voit pas la réservation → 404', async () => {
    const strangerToken = await login(app, '0705000001');
    await request(http)
      .get(`/v1/bookings/${bookingId}`)
      .set(bearer(strangerToken))
      .expect(404);
  });

  it('transitions illégales et mauvais rôle → 409 / 403', async () => {
    // pending → completed : transition inexistante → 409
    await request(http)
      .patch(`/v1/bookings/${bookingId}/status`)
      .set(bearer(providerToken))
      .send({ status: 'completed' })
      .expect(409);
    // pending → confirmed par le client → 403
    await request(http)
      .patch(`/v1/bookings/${bookingId}/status`)
      .set(bearer(clientToken))
      .send({ status: 'confirmed' })
      .expect(403);
  });

  it('cycle complet : confirmed → in_progress → completed (+1 mission)', async () => {
    for (const status of ['confirmed', 'in_progress', 'completed']) {
      const res = await request(http)
        .patch(`/v1/bookings/${bookingId}/status`)
        .set(bearer(providerToken))
        .send({ status })
        .expect(200);
      expect(res.body.status).toBe(status);
    }
    const detail = await request(http)
      .get('/v1/providers/p1')
      .set(bearer(clientToken))
      .expect(200);
    expect(detail.body.missions_done).toBe(90);
  });

  // ---------- Avis ----------

  it('avis sur mission terminée → rating recalculé', async () => {
    await request(http)
      .post('/v1/reviews')
      .set(bearer(clientToken))
      .send({
        booking_id: bookingId,
        rating: 5,
        tags: ['Ponctuel', 'Pro'],
        comment: 'Impeccable.',
      })
      .expect(201);

    // [5,5,5,4,5] + 5 → moyenne 4.833 → arrondie 4.8
    const reviews = await request(http)
      .get('/v1/providers/p1/reviews')
      .set(bearer(clientToken))
      .expect(200);
    expect(reviews.body.total).toBe(6);
    expect(reviews.body.average_rating).toBe(4.8);
  });

  it('avis en double → 409 ; tag inconnu → 400 ; booking non terminé → 422', async () => {
    await request(http)
      .post('/v1/reviews')
      .set(bearer(clientToken))
      .send({ booking_id: bookingId, rating: 4 })
      .expect(409);

    await request(http)
      .post('/v1/reviews')
      .set(bearer(clientToken))
      .send({ booking_id: bookingId, rating: 4, tags: ['Génial'] })
      .expect(400);

    await request(http)
      .post('/v1/reviews')
      .set(bearer(clientToken))
      .send({ booking_id: 'b-demo-pending', rating: 5 })
      .expect(422);
  });

  // ---------- Paiements ----------

  it('paiement wave → completed via webhook simulé (synchrone en test)', async () => {
    const res = await request(http)
      .post('/v1/payments/init')
      .set(bearer(clientToken))
      .send({
        booking_id: bookingId,
        method: 'wave',
        phone_number: '0707070707',
      })
      .expect(201);
    expect(res.body.amount_fcfa).toBe(6000);
    expect(res.body.status).toBe('completed');
  });

  it('numéro finissant par 00 → échec « Solde insuffisant »', async () => {
    const res = await request(http)
      .post('/v1/payments/init')
      .set(bearer(clientToken))
      .send({
        booking_id: bookingId,
        method: 'orange_money',
        phone_number: '0707070700',
      })
      .expect(201);
    expect(res.body.status).toBe('failed');
    expect(res.body.failure_reason).toBe('Solde insuffisant');
  });

  it('webhook : mauvais secret → 401 ; référence déjà traitée → already processed', async () => {
    await request(http)
      .post('/v1/payments/callback')
      .set('x-webhook-secret', 'wrong')
      .send({ reference: 'PAY-SEED-0001', status: 'completed' })
      .expect(401);

    const replay = await request(http)
      .post('/v1/payments/callback')
      .set('x-webhook-secret', process.env.WEBHOOK_SECRET ?? '')
      .send({ reference: 'PAY-SEED-0001', status: 'completed' })
      .expect(200);
    expect(replay.body.message).toBe('already processed');
  });

  it('paiement cash → completed direct + historique', async () => {
    const res = await request(http)
      .post('/v1/payments/init')
      .set(bearer(clientToken))
      .send({ booking_id: bookingId, method: 'cash' })
      .expect(201);
    expect(res.body.status).toBe('completed');

    const history = await request(http)
      .get('/v1/payments')
      .set(bearer(clientToken))
      .expect(200);
    // Seed (1) + wave + orange échoué + cash = 4
    expect(history.body.total).toBe(4);
  });

  // ---------- Messagerie ----------

  it('conversation idempotente + unread + mark-read', async () => {
    // La conversation avec p1 existe déjà dans le seed → même id.
    const conv = await request(http)
      .post('/v1/messages/conversations')
      .set(bearer(clientToken))
      .send({ provider_id: 'p1' })
      .expect(201);
    expect(conv.body.id).toBe('conv-demo-1');

    const before = await request(http)
      .get('/v1/messages/conversations')
      .set(bearer(clientToken))
      .expect(200);
    const demoConv = before.body.find(
      (c: { id: string }) => c.id === 'conv-demo-1',
    );
    expect(demoConv.unread_count).toBe(1);
    expect(demoConv.provider_name).toBe('Kouame Yao');

    // Lire les messages marque les entrants comme lus.
    const messages = await request(http)
      .get('/v1/messages/conversations/conv-demo-1/messages')
      .set(bearer(clientToken))
      .expect(200);
    expect(messages.body.total).toBe(3);
    expect(messages.body.items[0].sender_id).toBe('u-client-test');

    const after = await request(http)
      .get('/v1/messages/conversations')
      .set(bearer(clientToken))
      .expect(200);
    expect(
      after.body.find((c: { id: string }) => c.id === 'conv-demo-1')
        .unread_count,
    ).toBe(0);
  });

  it('envoi de message → notif + unread chez le destinataire', async () => {
    await request(http)
      .post('/v1/messages/conversations/conv-demo-1/messages')
      .set(bearer(clientToken))
      .send({ text: 'Voici les photos du portail.' })
      .expect(201);

    const providerSide = await request(http)
      .get('/v1/messages/conversations')
      .set(bearer(providerToken))
      .expect(200);
    const conv = providerSide.body.find(
      (c: { id: string }) => c.id === 'conv-demo-1',
    );
    expect(conv.last_message).toBe('Voici les photos du portail.');
    expect(conv.unread_count).toBe(1); // le nouveau message (m-demo-1 déjà lu dans le seed)
  });

  it('un tiers n’accède pas à la conversation → 404', async () => {
    const strangerToken = await login(app, '0705000002');
    await request(http)
      .get('/v1/messages/conversations/conv-demo-1/messages')
      .set(bearer(strangerToken))
      .expect(404);
  });
});
