# DJOSSI API

Backend NestJS de **DJOSSI** — « les talents de ton quartier » : mise en relation
entre habitants d'Abidjan et prestataires de services informels (soudeur,
plombier, coiffeuse…). Ce backend honore le contrat attendu par l'app Flutter
(`djossi-app/lib/core/constants/api_constants.dart`).

## Stack

- **NestJS 11** (Express 5) + TypeScript strict
- **Prisma 6** + PostgreSQL **Neon** (URL poolée en runtime, URL directe pour les migrations)
- Auth **OTP SMS + JWT** (access 15 min, refresh 30 j avec rotation et détection de réutilisation)
- **Swagger** sur [`/docs`](http://localhost:3000/docs)
- Intégrations derrière des **ports DI** avec adapters de dev :

| Port | Adapter dev | Prod (à brancher) |
|---|---|---|
| `SmsPort` | code OTP loggé en console | Twilio |
| `StoragePort` | disque local servi sur `/uploads` | Cloudinary |
| `PaymentGatewayPort` | mock + webhook simulé | Wave / Orange / MTN |
| `PushPort` | no-op (log) | Firebase FCM |

## Démarrage

```bash
pnpm install
cp .env.example .env        # renseigner DATABASE_URL + DIRECT_URL (Neon)
pnpm prisma migrate dev     # crée le schéma (16 tables)
pnpm prisma db seed         # données fidèles aux mocks de l'app (p1..p5)
pnpm start:dev              # http://localhost:3000/v1 — Swagger sur /docs
```

Vérification rapide : `./scripts/smoke.sh` (flux complet en 17 étapes, curl + jq).

## Comptes de test (seed)

| Compte | Téléphone | Rôle |
|---|---|---|
| Kouame Aya | `0707070707` | client (le compte mock de l'app) |
| Kouame Yao (p1) | `0701000001` | soudeur, 4.8★, vérifié + Pro |
| Aminata Toure (p2) | `0701000002` | couturière, 4.9★ |
| Diallo Souleyman (p3) | `0701000003` | plombier, 4.7★ |
| Fatou Konate (p4) | `0701000004` | coiffeuse, 4.6★ |
| Ibrahim Doumbia (p5) | `0701000005` | électricien, 4.5★, Pro |

**Code OTP de dev : `123456`** (accepté quand `OTP_ACCEPT_DEV_CODE=true` — c'est
le code que l'app Flutter mockée utilise déjà).

## Flux d'authentification

1. `POST /v1/auth/otp/send {phone}` — envoie le code (console en dev)
2. `POST /v1/auth/otp/verify {phone, code}` —
   - compte existant → `{user, access_token, refresh_token}`
   - numéro inconnu → `{user: null, registration_token}` (JWT 10 min lié au téléphone)
3. `POST /v1/auth/register {full_name, phone, email?, quarter?}` avec le
   `registration_token` en Bearer → `{user, access_token, refresh_token}`
4. `POST /v1/auth/refresh {refresh_token}` — rotation ; rejouer un ancien token
   révoque toutes les sessions (anti-vol)

Toutes les routes sont protégées par JWT sauf : auth, `/services*`,
`/payments/callback`, `/health`.

## Endpoints (préfixe `/v1`, JSON snake_case)

| Domaine | Routes |
|---|---|
| Auth | `POST /auth/otp/send`, `/auth/otp/verify`, `/auth/register`, `/auth/refresh`, `/auth/logout` |
| Profil | `GET/PUT /users/me`, `POST /users/me/avatar` (multipart) |
| Profil prestataire | `GET/POST/PUT /users/me/provider`, `POST /users/me/provider/portfolio`, `DELETE …/portfolio/:photoId` |
| Catalogue | `GET /services/categories` (12), `GET /services?category=` |
| Prestataires | `GET /providers`, `GET /providers/:id`, `GET /search/providers?query&category&quarter&limit&offset` |
| Réservations | `POST/GET /bookings`, `GET /bookings/:id(/status)`, `PATCH /bookings/:id/status` |
| Messagerie | `POST/GET /messages/conversations`, `GET/POST /messages/conversations/:id/messages` |
| Avis | `POST /reviews`, `GET /providers/:id/reviews` |
| Paiements | `POST /payments/init`, `POST /payments/callback` (webhook signé), `GET /payments` |
| Signalements | `POST /reports` |
| Notifications | `GET /notifications`, `PATCH /notifications/:id/read`, `POST /notifications/read-all`, `POST /notifications/devices` |

Listes paginées : `{items, total, limit, offset, has_more}`.
Erreurs : `{statusCode, message}` avec `message` **toujours en string** (contrat app).

## Règles métier clés

- **Réservations** — machine d'états : `pending → confirmed|cancelled`,
  `confirmed → in_progress|cancelled`, `in_progress → completed` (prestataire
  seul pour confirm/start/complete). `completed` incrémente `missions_done`.
- **Avis** — 1 par réservation, mission `completed` uniquement, tags parmi les 7
  de l'app ; `rating_avg/rating_count` recalculés en transaction.
- **Paiement mock** — `cash` → `completed` direct ; mobile money → `pending`
  puis webhook simulé après `PAYMENT_MOCK_AUTOCOMPLETE_MS` (numéro finissant
  par `00` → échec « Solde insuffisant »). Webhook signé par `x-webhook-secret`,
  idempotent.
- **Auto-modération** — 2 reporters distincts → compte `warned`, 3 →
  `suspended` : écritures bloquées (403), lecture conservée, exclu de la recherche.
- **Distance** — haversine si coordonnées connues, sinon heuristique par
  quartier (même quartier ~250 m, même commune ~1,2 km) avec jitter déterministe.
- **Notifications** — créées après les transactions métier (jamais bloquantes),
  fan-out depuis bookings/messages/reviews/payments/reports + push (no-op en dev).

## Tests

```bash
pnpm test        # 62 tests unitaires (machine d'états, OTP, tokens, distance, modération…)
pnpm test:e2e    # 38 tests e2e (auth, flux cœur, modération) — ⚠️ truncate + reseed la base
./scripts/smoke.sh
```

Les e2e tournent sur la base du `.env` : chaque suite **vide puis re-seed** la
base. Utiliser une branche Neon dédiée pour isoler si besoin.

## Hors périmètre v1 (phase 2)

Questions communautaires « Quelqu'un le connait ? », bouton urgence SOS,
endpoints admin/modération manuelle + validation CNI, score de confiance des
docs, WebSocket temps réel, vrais adapters Twilio/Cloudinary/Mobile
Money/FCM. Côté app Flutter : écrire les datasources réels et pointer
`ApiConstants.baseUrl` sur `http://localhost:3000/v1`.
