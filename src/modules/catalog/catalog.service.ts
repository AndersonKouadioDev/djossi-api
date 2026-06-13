import { Injectable } from '@nestjs/common';
import { ServiceCategory } from '@prisma/client';
import { PrismaService } from '../../core/prisma/prisma.service';

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

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

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
