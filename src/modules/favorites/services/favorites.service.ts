import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuthUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { ProviderSummaryDto } from '../../providers/dto/provider-response.dtos';
import { toProviderSummary } from '../../providers/services/providers.mapper';

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Mes prestataires favoris (plus récents d'abord), au format provider summary. */
  async list(user: AuthUser): Promise<ProviderSummaryDto[]> {
    const favorites = await this.prisma.favorite.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        provider: {
          include: { user: { select: { fullName: true, avatarUrl: true } } },
        },
      },
    });
    return favorites.map((f) => toProviderSummary(f.provider, user));
  }

  /** Ajoute un prestataire aux favoris (idempotent grâce à @@unique). */
  async add(user: AuthUser, providerId: string): Promise<ProviderSummaryDto> {
    const provider = await this.prisma.provider.findUnique({
      where: { id: providerId },
      include: { user: { select: { fullName: true, avatarUrl: true } } },
    });
    if (!provider) throw new NotFoundException('Prestataire introuvable.');

    await this.prisma.favorite.upsert({
      where: {
        userId_providerId: { userId: user.id, providerId },
      },
      create: { userId: user.id, providerId },
      update: {},
    });

    return toProviderSummary(provider, user);
  }

  /** Retire un prestataire des favoris (sans erreur s'il n'y était pas). */
  async remove(user: AuthUser, providerId: string): Promise<void> {
    await this.prisma.favorite.deleteMany({
      where: { userId: user.id, providerId },
    });
  }
}
