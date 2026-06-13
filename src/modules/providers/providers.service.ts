import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { buildPage, Page } from '../../common/dto/page';
import { PrismaService } from '../../core/prisma/prisma.service';
import {
  ProviderDetailDto,
  ProviderSummaryDto,
} from './dto/provider-response.dtos';
import { SearchProvidersQuery } from './dto/search-providers.query';
import {
  toProviderDetail,
  toProviderSummary,
  Viewer,
} from './providers.mapper';

@Injectable()
export class ProvidersService {
  constructor(private readonly prisma: PrismaService) {}

  async detail(id: string, viewer: Viewer): Promise<ProviderDetailDto> {
    const provider = await this.prisma.provider.findUnique({
      where: { id },
      include: {
        user: { select: { fullName: true, avatarUrl: true } },
        serviceLabels: { orderBy: { sortOrder: 'asc' } },
        photos: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!provider) throw new NotFoundException('Prestataire introuvable.');
    return toProviderDetail(provider, viewer);
  }

  async search(
    query: SearchProvidersQuery,
    viewer: Viewer,
  ): Promise<Page<ProviderSummaryDto>> {
    const text = query.query?.trim();
    const where: Prisma.ProviderWhereInput = {
      user: { status: { not: 'suspended' } },
      ...(query.category ? { category: query.category } : {}),
      ...(query.quarter
        ? {
            workQuarter: { contains: query.quarter, mode: 'insensitive' },
          }
        : {}),
      ...(text
        ? {
            OR: [
              { user: { fullName: { contains: text, mode: 'insensitive' } } },
              { trade: { contains: text, mode: 'insensitive' } },
              { tradeDescription: { contains: text, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const effectiveViewer: Viewer = {
      lat: query.lat ?? viewer.lat,
      lng: query.lng ?? viewer.lng,
      quarter: viewer.quarter,
    };

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.provider.findMany({
        where,
        include: { user: { select: { fullName: true, avatarUrl: true } } },
        orderBy: [
          { isPro: 'desc' },
          { ratingAvg: 'desc' },
          { missionsDone: 'desc' },
        ],
        take: query.limit,
        skip: query.offset,
      }),
      this.prisma.provider.count({ where }),
    ]);

    return buildPage(
      rows.map((p) => toProviderSummary(p, effectiveViewer)),
      total,
      query.limit,
      query.offset,
    );
  }
}
