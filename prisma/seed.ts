/**
 * Seed DJOSSI — fidèle aux mocks de l'app Flutter (MockProviders, compte test).
 * 100 % idempotent : uniquement des upserts à ids fixes, dates constantes.
 *
 *   pnpm prisma db seed
 */
import { PrismaClient, ServiceCategory } from '@prisma/client';

// ---------- Référentiel catégories (labels/emojis = category_icon.dart) ----------

const CATEGORIES: Array<{
  slug: ServiceCategory;
  label: string;
  emoji: string;
}> = [
  { slug: 'soudeur', label: 'Soudeur', emoji: '🔨' },
  { slug: 'plombier', label: 'Plombier', emoji: '🔧' },
  { slug: 'electricien', label: 'Électricien', emoji: '⚡' },
  { slug: 'couturiere', label: 'Couturière', emoji: '✂️' },
  { slug: 'commercant', label: 'Commercant', emoji: '🛒' },
  { slug: 'coiffeuse', label: 'Coiffeuse', emoji: '💇' },
  { slug: 'mecanicien', label: 'Mécanicien', emoji: '🔩' },
  { slug: 'tacheron', label: 'Tâcheron', emoji: '🛠️' },
  { slug: 'macon', label: 'Maçon', emoji: '🧱' },
  { slug: 'peintre', label: 'Peintre', emoji: '🎨' },
  { slug: 'menuisier', label: 'Menuisier', emoji: '🪚' },
  { slug: 'chauffeur', label: 'Chauffeur', emoji: '🚗' },
];

const SERVICE_CATALOG: Record<ServiceCategory, string[]> = {
  soudeur: ['Portails', 'Grilles de fenêtres', 'Rampes d’escalier', 'Réparations métalliques'],
  plombier: ['Fuites d’eau', 'Installation sanitaire', 'Débouchage', 'Chauffe-eau'],
  electricien: ['Installation électrique', 'Dépannage', 'Compteurs', 'Ventilateurs & climatisation'],
  couturiere: ['Tenues sur mesure', 'Retouches', 'Pagne traditionnel', 'Uniformes'],
  commercant: ['Livraison de courses', 'Vente en gros', 'Dépôt de gaz'],
  coiffeuse: ['Tresses', 'Tissages', 'Coupe homme', 'Soins capillaires'],
  mecanicien: ['Vidange', 'Freins', 'Diagnostic', 'Pneus'],
  tacheron: ['Petits travaux', 'Démolition', 'Manutention'],
  macon: ['Construction', 'Carrelage', 'Crépissage', 'Fondations'],
  peintre: ['Peinture intérieure', 'Peinture extérieure', 'Décoration'],
  menuisier: ['Meubles sur mesure', 'Portes & fenêtres', 'Réparations bois'],
  chauffeur: ['Courses en ville', 'Déménagement', 'Livraison'],
};

// ---------- Position de référence : Yopougon (client test) ----------
// Décalages en latitude calibrés pour ~200/350/480/620/850 m (haversine).

const CLIENT_LAT = 5.3364;
const CLIENT_LNG = -4.0892;
const M_PER_DEG_LAT = 111_320;
const latAt = (meters: number) => CLIENT_LAT + meters / M_PER_DEG_LAT;

// ---------- Les 5 prestataires du mock (provider_summary.dart) ----------

interface ProviderSeed {
  id: string;
  userId: string;
  phone: string;
  fullName: string;
  category: ServiceCategory;
  trade: string;
  tradeDescription: string;
  bio: string;
  quarter: string;
  distanceM: number;
  missionsDone: number;
  isVerified: boolean;
  isPro: boolean;
  hourlyRateMin: number;
  hourlyRateMax: number;
  services: string[];
  /** Notes dont la moyenne tombe exactement sur le rating mocké. */
  ratings: number[];
}

const PROVIDERS: ProviderSeed[] = [
  {
    id: 'p1',
    userId: 'u-provider-1',
    phone: '0701000001',
    fullName: 'Kouame Yao',
    category: 'soudeur',
    trade: 'Soudure',
    tradeDescription: 'Portails, grilles, rampes et toutes réparations métalliques.',
    bio: 'Soudeur à Yopougon Selmer depuis 12 ans. Travail propre et garanti.',
    quarter: 'Yopougon Selmer',
    distanceM: 200,
    missionsDone: 89,
    isVerified: true,
    isPro: true,
    hourlyRateMin: 5000,
    hourlyRateMax: 10000,
    services: ['Portails', 'Grilles de fenêtres', 'Rampes d’escalier'],
    ratings: [5, 5, 5, 4, 5], // 4.8
  },
  {
    id: 'p2',
    userId: 'u-provider-2',
    phone: '0701000002',
    fullName: 'Aminata Toure',
    category: 'couturiere',
    trade: 'Couture',
    tradeDescription: 'Tenues sur mesure, retouches et pagnes traditionnels.',
    bio: 'Couturière passionnée, atelier à Yopougon. Délais respectés.',
    quarter: 'Yopougon',
    distanceM: 350,
    missionsDone: 142,
    isVerified: true,
    isPro: false,
    hourlyRateMin: 2000,
    hourlyRateMax: 15000,
    services: ['Tenues sur mesure', 'Retouches', 'Pagne traditionnel'],
    ratings: [5, 5, 5, 5, 5, 5, 5, 5, 5, 4], // 4.9
  },
  {
    id: 'p3',
    userId: 'u-provider-3',
    phone: '0701000003',
    fullName: 'Diallo Souleyman',
    category: 'plombier',
    trade: 'Plomberie',
    tradeDescription: 'Fuites, installations sanitaires et débouchage.',
    bio: 'Plombier sérieux, intervention rapide à Wassakara et environs.',
    quarter: 'Yopougon Wassakara',
    distanceM: 480,
    missionsDone: 56,
    isVerified: true,
    isPro: false,
    hourlyRateMin: 3000,
    hourlyRateMax: 12000,
    services: ['Fuites d’eau', 'Installation sanitaire', 'Débouchage'],
    ratings: [5, 5, 5, 5, 5, 5, 5, 4, 4, 4], // 4.7
  },
  {
    id: 'p4',
    userId: 'u-provider-4',
    phone: '0701000004',
    fullName: 'Fatou Konate',
    category: 'coiffeuse',
    trade: 'Coiffure',
    tradeDescription: 'Tresses, tissages et soins, à domicile ou au salon.',
    bio: 'Coiffeuse à Niangon. Douceur et style garantis.',
    quarter: 'Yopougon Niangon',
    distanceM: 620,
    missionsDone: 73,
    isVerified: false,
    isPro: false,
    hourlyRateMin: 1500,
    hourlyRateMax: 8000,
    services: ['Tresses', 'Tissages', 'Soins capillaires'],
    ratings: [5, 4, 5, 4, 5], // 4.6
  },
  {
    id: 'p5',
    userId: 'u-provider-5',
    phone: '0701000005',
    fullName: 'Ibrahim Doumbia',
    category: 'electricien',
    trade: 'Électricité',
    tradeDescription: 'Installations, dépannages et climatisation.',
    bio: 'Électricien certifié, devis gratuit sur Yopougon.',
    quarter: 'Yopougon',
    distanceM: 850,
    missionsDone: 38,
    isVerified: false,
    isPro: true,
    hourlyRateMin: 4000,
    hourlyRateMax: 14000,
    services: ['Installation électrique', 'Dépannage', 'Ventilateurs & climatisation'],
    ratings: [5, 4, 5, 4], // 4.5
  },
];

/** Clients de seed qui portent les avis (3 comptes tournants). */
const SEED_CLIENTS = [
  { id: 'u-seed-c1', phone: '0705000001', fullName: 'Adjoua Brou', quarter: 'Yopougon' },
  { id: 'u-seed-c2', phone: '0705000002', fullName: 'Mariam Cisse', quarter: 'Yopougon Selmer' },
  { id: 'u-seed-c3', phone: '0705000003', fullName: 'Jean-Marc Koffi', quarter: 'Yopougon Niangon' },
];

const REVIEW_COMMENTS = [
  'Très bon travail, je recommande.',
  'Ponctuel et efficace.',
  'Travail propre, rien à redire.',
  'Bon rapport qualité-prix.',
  'Sérieux, je referai appel à lui.',
];
const REVIEW_TAG_SETS = [
  ['Ponctuel', 'Travail propre'],
  ['Pro', 'Bon prix'],
  ['Sympa', 'Communicatif'],
  ['Travail propre', 'Materiel apporte'],
  ['Ponctuel', 'Pro'],
];

const DAY_MS = 24 * 60 * 60 * 1000;
/** Base temporelle fixe des données historiques. */
const BASE = new Date('2026-05-01T10:00:00.000Z').getTime();

/** Seed complet — réutilisé par `prisma db seed` et par les tests e2e. */
export async function seedDatabase(prisma: PrismaClient): Promise<void> {
  // 1. Catégories + catalogue de services
  for (const [index, category] of CATEGORIES.entries()) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      create: {
        slug: category.slug,
        labelFr: category.label,
        emoji: category.emoji,
        sortOrder: index,
      },
      update: { labelFr: category.label, emoji: category.emoji, sortOrder: index },
    });
    for (const [order, label] of SERVICE_CATALOG[category.slug].entries()) {
      await prisma.service.upsert({
        where: {
          categorySlug_label: { categorySlug: category.slug, label },
        },
        create: { categorySlug: category.slug, label, sortOrder: order },
        update: { sortOrder: order },
      });
    }
  }

  // 2. Compte client de test (le mock de l'app : 0707070707 / Kouame Aya)
  await prisma.user.upsert({
    where: { id: 'u-client-test' },
    create: {
      id: 'u-client-test',
      phone: '0707070707',
      fullName: 'Kouame Aya',
      email: 'aya@djossi.ci',
      quarter: 'Yopougon',
      lat: CLIENT_LAT,
      lng: CLIENT_LNG,
      createdAt: new Date('2026-01-15T00:00:00.000Z'),
    },
    update: { fullName: 'Kouame Aya', quarter: 'Yopougon' },
  });

  for (const client of SEED_CLIENTS) {
    await prisma.user.upsert({
      where: { id: client.id },
      create: { ...client, createdAt: new Date('2026-02-01T00:00:00.000Z') },
      update: { fullName: client.fullName },
    });
  }

  // 3. Prestataires p1..p5
  for (const p of PROVIDERS) {
    await prisma.user.upsert({
      where: { id: p.userId },
      create: {
        id: p.userId,
        phone: p.phone,
        fullName: p.fullName,
        quarter: p.quarter,
        lat: latAt(p.distanceM),
        lng: CLIENT_LNG,
        createdAt: new Date('2026-02-15T00:00:00.000Z'),
      },
      update: { fullName: p.fullName, quarter: p.quarter },
    });

    await prisma.provider.upsert({
      where: { id: p.id },
      create: {
        id: p.id,
        userId: p.userId,
        category: p.category,
        trade: p.trade,
        tradeDescription: p.tradeDescription,
        bio: p.bio,
        workQuarter: p.quarter,
        workRadius: '1km',
        hourlyRateMin: p.hourlyRateMin,
        hourlyRateMax: p.hourlyRateMax,
        mobileMoneyNumber: p.phone,
        kycSelfieDone: p.isVerified,
        kycCniDone: p.isVerified,
        isVerified: p.isVerified,
        isPro: p.isPro,
        missionsDone: p.missionsDone,
        lat: latAt(p.distanceM),
        lng: CLIENT_LNG,
        createdAt: new Date('2026-02-15T00:00:00.000Z'),
      },
      update: {
        trade: p.trade,
        workQuarter: p.quarter,
        isVerified: p.isVerified,
        isPro: p.isPro,
        missionsDone: p.missionsDone,
      },
    });

    for (const [order, label] of p.services.entries()) {
      await prisma.providerService.upsert({
        where: { providerId_label: { providerId: p.id, label } },
        create: { providerId: p.id, label, sortOrder: order },
        update: { sortOrder: order },
      });
    }
  }

  // 4. Bookings terminés + avis (moyennes exactes : 4.8 / 4.9 / 4.7 / 4.6 / 4.5)
  for (const p of PROVIDERS) {
    for (const [i, rating] of p.ratings.entries()) {
      // Le premier avis de p1 vient du compte test (sa mission terminée de démo).
      const isDemoBooking = p.id === 'p1' && i === 0;
      const clientId = isDemoBooking
        ? 'u-client-test'
        : SEED_CLIENTS[i % SEED_CLIENTS.length].id;
      const bookingId = isDemoBooking ? 'b-demo-completed' : `b-${p.id}-${i}`;
      const when = new Date(BASE - (i + 3) * DAY_MS);

      await prisma.booking.upsert({
        where: { id: bookingId },
        create: {
          id: bookingId,
          clientId,
          providerId: p.id,
          serviceCategory: p.category,
          scheduledAt: when,
          notes: isDemoBooking ? 'Soudure portail entrée, prévoir échelle.' : null,
          status: 'completed',
          amountFcfa: isDemoBooking ? 8000 : null,
          completedAt: new Date(when.getTime() + 2 * 60 * 60 * 1000),
          createdAt: new Date(when.getTime() - DAY_MS),
        },
        update: { status: 'completed' },
      });

      await prisma.review.upsert({
        where: { bookingId },
        create: {
          id: `r-${p.id}-${i}`,
          bookingId,
          clientId,
          providerId: p.id,
          rating,
          tags: REVIEW_TAG_SETS[i % REVIEW_TAG_SETS.length],
          comment: isDemoBooking
            ? 'Très satisfait, travail soigné !'
            : REVIEW_COMMENTS[i % REVIEW_COMMENTS.length],
          createdAt: new Date(when.getTime() + 3 * 60 * 60 * 1000),
        },
        update: { rating },
      });
    }
  }

  // Agrégats recalculés depuis la table reviews (source de vérité)
  for (const p of PROVIDERS) {
    const aggregate = await prisma.review.aggregate({
      where: { providerId: p.id },
      _avg: { rating: true },
      _count: { _all: true },
    });
    await prisma.provider.update({
      where: { id: p.id },
      data: {
        ratingAvg: aggregate._avg.rating ?? 0,
        ratingCount: aggregate._count._all,
      },
    });
  }

  // 5. Démo pour le compte test : booking à venir, conversation, paiement, notifs
  await prisma.booking.upsert({
    where: { id: 'b-demo-pending' },
    create: {
      id: 'b-demo-pending',
      clientId: 'u-client-test',
      providerId: 'p2',
      serviceCategory: 'couturiere',
      scheduledAt: new Date('2027-01-15T10:00:00.000Z'),
      notes: 'Robe en pagne pour mariage, taille 40.',
      status: 'pending',
      amountFcfa: 12000,
      createdAt: new Date(BASE),
    },
    update: {},
  });

  await prisma.conversation.upsert({
    where: {
      clientId_providerId: { clientId: 'u-client-test', providerId: 'p1' },
    },
    create: {
      id: 'conv-demo-1',
      clientId: 'u-client-test',
      providerId: 'p1',
      lastMessage: 'Tu peux apporter des photos ?',
      lastMessageAt: new Date(BASE + 32 * 60 * 1000),
      createdAt: new Date(BASE),
    },
    update: {},
  });
  const demoMessages = [
    {
      id: 'm-demo-1',
      senderId: 'u-client-test',
      text: 'Bonjour, je peux passer demain pour le portail ?',
      minutes: 30,
      read: true,
    },
    {
      id: 'm-demo-2',
      senderId: 'u-provider-1',
      text: 'Oui bien sûr, à partir de 9h.',
      minutes: 31,
      read: true,
    },
    {
      id: 'm-demo-3',
      senderId: 'u-provider-1',
      text: 'Tu peux apporter des photos ?',
      minutes: 32,
      read: false,
    },
  ];
  for (const m of demoMessages) {
    await prisma.message.upsert({
      where: { id: m.id },
      create: {
        id: m.id,
        conversationId: 'conv-demo-1',
        senderId: m.senderId,
        text: m.text,
        createdAt: new Date(BASE + m.minutes * 60 * 1000),
        readAt: m.read ? new Date(BASE + 40 * 60 * 1000) : null,
      },
      update: {},
    });
  }

  await prisma.payment.upsert({
    where: { reference: 'PAY-SEED-0001' },
    create: {
      id: 'pay-demo-1',
      bookingId: 'b-demo-completed',
      payerId: 'u-client-test',
      amountFcfa: 8000,
      method: 'wave',
      status: 'completed',
      reference: 'PAY-SEED-0001',
      phoneNumber: '0707070707',
      completedAt: new Date(BASE - 2 * DAY_MS),
      createdAt: new Date(BASE - 2 * DAY_MS),
    },
    update: {},
  });

  const demoNotifications = [
    {
      id: 'n-demo-1',
      type: 'booking' as const,
      title: 'Mission terminée',
      message: 'Mission terminée — laisse un avis à Kouame Yao.',
      isRead: true,
      offsetDays: 3,
    },
    {
      id: 'n-demo-2',
      type: 'payment' as const,
      title: 'Paiement confirmé',
      message: 'Paiement de 8 000 FCFA effectué.',
      isRead: false,
      offsetDays: 2,
    },
    {
      id: 'n-demo-3',
      type: 'message' as const,
      title: 'Nouveau message',
      message: 'Kouame Yao : Tu peux apporter des photos ?',
      isRead: false,
      offsetDays: 0,
    },
  ];
  for (const n of demoNotifications) {
    await prisma.notification.upsert({
      where: { id: n.id },
      create: {
        id: n.id,
        userId: 'u-client-test',
        type: n.type,
        title: n.title,
        message: n.message,
        isRead: n.isRead,
        createdAt: new Date(BASE - n.offsetDays * DAY_MS),
      },
      update: {},
    });
  }

  const counts = {
    categories: await prisma.category.count(),
    services: await prisma.service.count(),
    users: await prisma.user.count(),
    providers: await prisma.provider.count(),
    bookings: await prisma.booking.count(),
    reviews: await prisma.review.count(),
  };
  console.log('Seed OK :', counts);
}

// Exécution CLI : pnpm prisma db seed
if (require.main === module) {
  const prisma = new PrismaClient();
  seedDatabase(prisma)
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
