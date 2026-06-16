import { Injectable } from '@nestjs/common';
import { ServiceCategory } from '@prisma/client';
import { PrismaService } from '../../../core/prisma/prisma.service';

export interface CategoryDto {
  slug: ServiceCategory;
  label: string;
  emoji: string;
  sort_order: number;
}

export interface ServiceItemDto {
  id: string;
  category: ServiceCategory;
  label: string;
}

export interface QuarterDto {
  slug: string;
  name: string;
}

export interface TradeDto {
  slug: string;
  label: string;
  category: ServiceCategory;
  sort_order: number;
}

export interface CityDto {
  slug: string;
  name: string;
}

/** Slug stable, minuscule et sans accents, dérivé d'un libellé. */
function toSlug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // retire les accents (diacritiques NFD)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-') // espaces/ponctuation → tirets
    .replace(/^-+|-+$/g, '');
}

// ---------------------------------------------------------------------------
// Catalogue de métiers (Tâche 1) — données statiques.
//
// Les 12 premiers métiers = les catégories elles-mêmes (label = libellé de la
// catégorie). Viennent ensuite des métiers ivoiriens plus spécifiques, chacun
// rattaché à une des 12 catégories. `sort_order` croissant : catégories d'abord
// (0..11), puis les métiers spécialisés (12+). Liste figée — pas de table
// Prisma : référentiel stable servi en cache.
// ---------------------------------------------------------------------------

/** Libellés des 12 catégories (identiques au seed / category_icon.dart). */
const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  soudeur: 'Soudeur',
  plombier: 'Plombier',
  electricien: 'Électricien',
  couturiere: 'Couturière',
  commercant: 'Commerçant',
  coiffeuse: 'Coiffeuse',
  mecanicien: 'Mécanicien',
  tacheron: 'Tâcheron',
  macon: 'Maçon',
  peintre: 'Peintre',
  menuisier: 'Menuisier',
  chauffeur: 'Chauffeur',
};

/** Ordre des 12 catégories (= enum ServiceCategory). */
const CATEGORY_ORDER: readonly ServiceCategory[] = [
  'soudeur',
  'plombier',
  'electricien',
  'couturiere',
  'commercant',
  'coiffeuse',
  'mecanicien',
  'tacheron',
  'macon',
  'peintre',
  'menuisier',
  'chauffeur',
];

/**
 * Métiers spécialisés par catégorie (en plus de la catégorie elle-même).
 * ~38 métiers ivoiriens réalistes répartis sous les 12 catégories.
 */
const SPECIALISED_TRADES: Record<ServiceCategory, readonly string[]> = {
  soudeur: ['Ferronnier', 'Métallier', 'Forgeron'],
  plombier: ['Installateur sanitaire', 'Pompiste forage'],
  electricien: [
    'Électricien bâtiment',
    'Électricien auto',
    'Frigoriste',
    'Antenniste',
  ],
  couturiere: ['Tailleur', 'Brodeur', 'Styliste'],
  commercant: ['Grossiste', 'Revendeur'],
  coiffeuse: ['Coiffeur barbier', 'Tresseuse', 'Esthéticienne'],
  mecanicien: ['Mécanicien auto', 'Mécanicien moto', 'Tôlier', 'Vulcanisateur'],
  tacheron: [
    'Manœuvre',
    'Jardinier',
    "Agent d'entretien",
    'Déménageur',
    'Démolisseur',
  ],
  macon: ['Carreleur', 'Ferrailleur', 'Coffreur'],
  peintre: ['Peintre bâtiment', 'Peintre décorateur', 'Staffeur'],
  menuisier: ['Menuisier bois', 'Ébéniste', 'Menuisier alu', 'Vitrier'],
  chauffeur: [
    'Chauffeur taxi',
    'Chauffeur VTC',
    'Chauffeur poids lourd',
    'Livreur',
  ],
};

/** Catalogue figé { slug, label, category, sort_order } (calculé une fois). */
const TRADES: readonly TradeDto[] = (() => {
  const list: TradeDto[] = [];
  let order = 0;

  // 1) Les 12 catégories, dans l'ordre de l'enum (sort_order 0..11).
  for (const category of CATEGORY_ORDER) {
    const label = CATEGORY_LABELS[category];
    list.push({ slug: toSlug(label), label, category, sort_order: order++ });
  }

  // 2) Les métiers spécialisés, groupés par catégorie (sort_order 12+).
  for (const category of CATEGORY_ORDER) {
    for (const label of SPECIALISED_TRADES[category]) {
      list.push({ slug: toSlug(label), label, category, sort_order: order++ });
    }
  }

  return list;
})();

// ---------------------------------------------------------------------------
// Villes & quartiers (Tâche 2) — données statiques.
//
// Villes principales de Côte d'Ivoire (Abidjan en premier). Pour chaque ville,
// la liste de ses quartiers/communes réels. L'endpoint quartiers est dépendant
// de la ville (paramètre `city`, défaut `abidjan` pour rétro-compatibilité).
// ---------------------------------------------------------------------------

/** Villes principales (l'ordre de saisie est conservé ; Abidjan en premier). */
const CITY_NAMES: readonly string[] = [
  'Abidjan',
  'Bouaké',
  'Yamoussoukro',
  'San-Pédro',
  'Korhogo',
  'Daloa',
  'Man',
  'Gagnoa',
  'Abengourou',
  'Divo',
  'Anyama',
  'Grand-Bassam',
  'Bingerville',
  'Soubré',
  'Bondoukou',
];

/** Liste de référence figée { slug, name } des villes (ordre conservé). */
const CITIES: readonly CityDto[] = CITY_NAMES.map((name) => ({
  slug: toSlug(name),
  name,
}));

/**
 * Quartiers de référence par ville (clé = slug de la ville).
 *
 * Abidjan : liste existante conservée à l'identique (communes principales puis
 * quartiers détaillés). Autres villes : quartiers/communes plausibles.
 */
const QUARTER_NAMES_BY_CITY: Record<string, readonly string[]> = {
  abidjan: [
    // Communes principales d'Abidjan (chefs-lieux).
    'Abobo',
    'Adjamé',
    'Anyama',
    'Attécoubé',
    'Bingerville',
    'Cocody',
    'Koumassi',
    'Marcory',
    'Plateau',
    'Port-Bouët',
    'Treichville',
    'Yopougon',
    // Quartiers détaillés (groupés par commune dans l'app).
    'Abobo Anonkoua',
    'Abobo Avocatier',
    'Abobo Belleville',
    'Abobo Centre',
    'Abobo Plaque',
    'Abobo Sagbé',
    'Abobo Samaké',
    'Adjamé 220 Logements',
    'Adjamé Bracodi',
    'Adjamé Centre',
    'Adjamé Liberté',
    'Adjamé Mosquée',
    'Adjamé Pont',
    'Adjamé Williamsville',
    'Anyama Adjamé',
    'Anyama Ahouabo',
    'Anyama Centre',
    'Attécoubé Boribana',
    'Attécoubé Centre',
    'Attécoubé Locodjro',
    'Attécoubé Mossikro',
    'Attécoubé Santé',
    'Cocody 2 Plateaux',
    'Cocody Angré',
    'Cocody Centre',
    'Cocody Danga',
    'Cocody Riviera 1',
    'Cocody Riviera 2',
    'Cocody Riviera 3',
    'Cocody Riviera 4',
    'Cocody Riviera Bonoumin',
    'Cocody Riviera Palmeraie',
    'Cocody Saint-Jean',
    'Cocody Vallons',
    'Koumassi Campement',
    'Koumassi Centre',
    'Koumassi Grand Marché',
    'Koumassi Inié',
    'Koumassi Prodomo',
    'Koumassi Remblais',
    'Koumassi Sicogi',
    'Marcory Anoumabo',
    'Marcory Centre',
    'Marcory Konankro',
    'Marcory Résidentiel',
    'Marcory Sicogi',
    'Marcory Zone 4',
    'Plateau Centre',
    'Plateau Dokui',
    'Plateau Indenié',
    'Port-Bouët Aéroport',
    'Port-Bouët Adjouffou',
    'Port-Bouët Centre',
    'Port-Bouët Phare',
    'Port-Bouët Vridi',
    'Treichville Arras',
    'Treichville Belleville',
    'Treichville Centre',
    'Treichville Marché',
    'Treichville Zone 3',
    'Yopougon Andokoi',
    'Yopougon Ananeraie',
    'Yopougon Banco',
    'Yopougon Centre',
    'Yopougon Maroc',
    'Yopougon Niangon Sud',
    'Yopougon Niangon Nord',
    'Yopougon Selmer',
    'Yopougon Sicogi',
    'Yopougon Sideci',
    'Yopougon Wassakara',
  ],
  bouake: [
    'Air France',
    'Belleville',
    'Dar-Es-Salam',
    'Koko',
    "N'Gattakro",
    'Ahougnansou',
    'Broukro',
    'Commerce',
    'Kennedy',
    'Liberté',
    'Nimbo',
    'Sokoura',
    'Zone Industrielle',
  ],
  yamoussoukro: [
    'Habitat',
    'Millionnaire',
    'Dioulakro',
    "N'Zuessy",
    'Assabou',
    'Kokrenou',
    'Morofé',
    'Riviera',
    '220 Logements',
    'Quartier Administratif',
  ],
  'san-pedro': [
    'Bardot',
    'Balmer',
    'Cité',
    'Lac',
    'Séwéké',
    'Zone Portuaire',
    'Château',
    'Poro',
  ],
  korhogo: [
    'Petit Paris',
    'Soba',
    'Koko',
    'Banaforo',
    'Résidentiel',
    'Sinistré',
    'Tchémé',
    'Cocody',
  ],
  daloa: [
    'Tazibouo',
    'Lobia',
    'Gbeufla',
    'Kennedy',
    'Commerce',
    'Orly',
    'Sapia',
    'Marais',
  ],
  man: [
    'Libreville',
    'Domoraud',
    'Grand Gbapleu',
    'Belleville',
    'Kennedy',
    'Doyaguédé',
    'Air France',
    'Zadépleu',
  ],
  gagnoa: [
    'Dioulabougou',
    'Garahio',
    'Commerce',
    'Babré',
    'Bayota',
    'Dahiépa',
  ],
  abengourou: [
    'Lycée',
    'Commerce',
    'Agnikro',
    'Dioulakro',
    'Hôpital',
    'Ehuasso',
  ],
  divo: ['Bringakro', 'Commerce', 'Dioulabougou', 'Lycée', 'Hiré', 'Sucrivoire'],
  anyama: ['Anyama Centre', 'Anyama Adjamé', 'Anyama Ahouabo', 'Ebimpé', 'Mafou'],
  'grand-bassam': [
    'France',
    'Quartier France',
    'Impérial',
    'Phare',
    'Moossou',
    'Petit Paris',
    'Oddos',
  ],
  bingerville: [
    'Bingerville Centre',
    'Cité',
    'Adjamé Bingerville',
    'Akouédo',
    'Santé',
    'Gbagba',
  ],
  soubre: ['Commerce', 'Dioulabougou', 'Petit Paris', 'Liberté', 'Scierie'],
  bondoukou: [
    'Commerce',
    'Camp',
    'Donzosso',
    'Hamdallaye',
    'Lycée',
    'Zanzan',
  ],
};

/** Ville par défaut (rétro-compatibilité : `GET /services/quarters` sans `city`). */
const DEFAULT_CITY_SLUG = 'abidjan';

/** Quartiers figés { slug, name } par ville, triés par nom (calculés une fois). */
const QUARTERS_BY_CITY: Record<string, readonly QuarterDto[]> = Object.entries(
  QUARTER_NAMES_BY_CITY,
).reduce<Record<string, readonly QuarterDto[]>>((acc, [citySlug, names]) => {
  acc[citySlug] = names
    .map((name) => ({ slug: toSlug(name), name }))
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  return acc;
}, {});

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Catalogue de métiers ivoiriens (Tâche 1).
   * Liste statique servie telle quelle ; mise en cache côté contrôleur.
   */
  trades(): TradeDto[] {
    return TRADES as TradeDto[];
  }

  /**
   * Villes principales de Côte d'Ivoire (Tâche 2), Abidjan en premier.
   * Liste statique ; mise en cache côté contrôleur.
   */
  cities(): CityDto[] {
    return CITIES as CityDto[];
  }

  /**
   * Quartiers de référence d'une ville (source de vérité de l'app).
   *
   * `city` est le slug de la ville (ex. `abidjan`, `bouake`). Optionnel :
   * sans valeur (ou ville inconnue), on retombe sur Abidjan — rétro-compatible
   * avec l'appel historique `GET /services/quarters` sans paramètre.
   */
  quarters(city?: string): QuarterDto[] {
    const slug = city ? toSlug(city) : DEFAULT_CITY_SLUG;
    const quarters =
      QUARTERS_BY_CITY[slug] ?? QUARTERS_BY_CITY[DEFAULT_CITY_SLUG];
    return quarters as QuarterDto[];
  }

  async categories(): Promise<CategoryDto[]> {
    const rows = await this.prisma.category.findMany({
      orderBy: { sortOrder: 'asc' },
    });
    return rows.map((c) => ({
      slug: c.slug,
      label: c.labelFr,
      emoji: c.emoji,
      sort_order: c.sortOrder,
    }));
  }

  async services(category?: ServiceCategory): Promise<ServiceItemDto[]> {
    const rows = await this.prisma.service.findMany({
      where: category ? { categorySlug: category } : undefined,
      orderBy: [{ categorySlug: 'asc' }, { sortOrder: 'asc' }],
    });
    return rows.map((s) => ({
      id: s.id,
      category: s.categorySlug,
      label: s.label,
    }));
  }
}
