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

/**
 * Quartiers de référence d'Abidjan (source de vérité côté backend).
 *
 * Repris de l'app Flutter (`lib/shared/models/quarters.dart`) : les communes
 * principales puis leurs quartiers, à plat. Liste statique — pas de table
 * Prisma : ce sont des données de référence stables, servies en cache.
 */
const ABIDJAN_QUARTER_NAMES: readonly string[] = [
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
];

/** Slug stable, minuscule et sans accents, dérivé du nom du quartier. */
function quarterSlug(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // retire les accents (diacritiques NFD)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-') // espaces/ponctuation → tirets
    .replace(/^-+|-+$/g, '');
}

/** Liste de référence figée { slug, name }, triée par nom (calculée une fois). */
const ABIDJAN_QUARTERS: readonly QuarterDto[] = ABIDJAN_QUARTER_NAMES.map(
  (name) => ({ slug: quarterSlug(name), name }),
).sort((a, b) => a.name.localeCompare(b.name, 'fr'));

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Quartiers de référence d'Abidjan (source de vérité de l'app).
   * Liste statique servie telle quelle ; mise en cache côté contrôleur.
   */
  quarters(): QuarterDto[] {
    return ABIDJAN_QUARTERS as QuarterDto[];
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
