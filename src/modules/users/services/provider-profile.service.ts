import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { StoragePort } from '../../../integrations/storage/storage.port';
import {
  ProviderProfileDto,
  UpsertProviderProfileDto,
} from '../dto/provider-profile.dtos';
import { toProviderProfileDto } from './provider-profile.mapper';

const MAX_PORTFOLIO_PHOTOS = 12;

const PROFILE_INCLUDE = {
  serviceLabels: { orderBy: { sortOrder: 'asc' } },
  photos: { orderBy: { sortOrder: 'asc' } },
} satisfies Prisma.ProviderInclude;

@Injectable()
export class ProviderProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StoragePort,
  ) {}

  async getMine(userId: string): Promise<ProviderProfileDto> {
    const provider = await this.prisma.provider.findUnique({
      where: { userId },
      include: PROFILE_INCLUDE,
    });
    if (!provider) {
      throw new NotFoundException('Pas encore de profil prestataire.');
    }
    return toProviderProfileDto(provider);
  }

  async create(
    userId: string,
    dto: UpsertProviderProfileDto,
  ): Promise<ProviderProfileDto> {
    const existing = await this.prisma.provider.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        'Un profil prestataire existe déjà. Utilise PUT pour le modifier.',
      );
    }

    // Le prestataire démarre avec l'identité du compte client (User), puis
    // pourra la modifier sans toucher au compte. Si le client ne fournit pas
    // ces champs à l'onboarding, on copie les valeurs par défaut du User.
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { fullName: true, avatarUrl: true, phone: true },
    });
    if (!user) {
      throw new NotFoundException('Compte introuvable.');
    }

    const provider = await this.prisma.provider.create({
      data: {
        userId,
        category: dto.category,
        trade: dto.trade,
        tradeDescription: dto.trade_description ?? null,
        displayName: dto.display_name ?? user.fullName,
        avatarUrl: user.avatarUrl,
        contactPhone: dto.contact_phone ?? user.phone,
        city: dto.city ?? null,
        bio: dto.bio ?? null,
        workQuarter: dto.work_quarter ?? null,
        workRadius: dto.work_radius ?? '1km',
        hourlyRateMin: dto.hourly_rate_min ?? null,
        hourlyRateMax: dto.hourly_rate_max ?? null,
        mobileMoneyNumber: dto.mobile_money_number ?? null,
        kycSelfieDone: dto.kyc_selfie_done ?? false,
        kycCniDone: dto.kyc_cni_done ?? false,
        isAvailable: dto.is_available ?? true,
        isVerified:
          (dto.kyc_selfie_done ?? false) && (dto.kyc_cni_done ?? false),
        serviceLabels: {
          create: (dto.services ?? []).map((label, index) => ({
            label,
            sortOrder: index,
          })),
        },
      },
      include: PROFILE_INCLUDE,
    });
    return toProviderProfileDto(provider);
  }

  async update(
    userId: string,
    dto: UpsertProviderProfileDto,
  ): Promise<ProviderProfileDto> {
    const current = await this.prisma.provider.findUnique({
      where: { userId },
      select: { id: true, kycSelfieDone: true, kycCniDone: true },
    });
    if (!current) {
      throw new NotFoundException(
        'Pas encore de profil prestataire. Utilise POST pour le créer.',
      );
    }

    const kycSelfieDone = dto.kyc_selfie_done ?? current.kycSelfieDone;
    const kycCniDone = dto.kyc_cni_done ?? current.kycCniDone;

    const provider = await this.prisma.$transaction(async (tx) => {
      if (dto.services) {
        await tx.providerService.deleteMany({
          where: { providerId: current.id },
        });
        await tx.providerService.createMany({
          data: dto.services.map((label, index) => ({
            providerId: current.id,
            label,
            sortOrder: index,
          })),
        });
      }
      return tx.provider.update({
        where: { id: current.id },
        data: {
          category: dto.category,
          trade: dto.trade,
          tradeDescription: dto.trade_description,
          // Identité propre au prestataire : ces écritures ne touchent QUE le
          // Provider, jamais le compte client (User).
          displayName: dto.display_name,
          contactPhone: dto.contact_phone,
          city: dto.city,
          bio: dto.bio,
          workQuarter: dto.work_quarter,
          workRadius: dto.work_radius,
          hourlyRateMin: dto.hourly_rate_min,
          hourlyRateMax: dto.hourly_rate_max,
          mobileMoneyNumber: dto.mobile_money_number,
          isAvailable: dto.is_available,
          kycSelfieDone,
          kycCniDone,
          isVerified: kycSelfieDone && kycCniDone,
        },
        include: PROFILE_INCLUDE,
      });
    });
    return toProviderProfileDto(provider);
  }

  /**
   * Upload l'avatar PROPRE du prestataire (même mécanisme que l'avatar client :
   * stockage local sur /uploads/avatars). N'écrit que `provider.avatarUrl`,
   * jamais `user.avatarUrl`.
   */
  async setAvatar(
    userId: string,
    file: Express.Multer.File,
  ): Promise<ProviderProfileDto> {
    const current = await this.prisma.provider.findUnique({
      where: { userId },
      select: { id: true, avatarUrl: true },
    });
    if (!current) {
      throw new NotFoundException('Pas encore de profil prestataire.');
    }

    const { url } = await this.storage.save(file.buffer, {
      folder: 'avatars',
      mime: file.mimetype,
    });
    await this.prisma.provider.update({
      where: { id: current.id },
      data: { avatarUrl: url },
    });
    if (current.avatarUrl) {
      await this.storage.delete(current.avatarUrl);
    }
    return this.getMine(userId);
  }

  async addPortfolioPhotos(
    userId: string,
    files: Express.Multer.File[],
  ): Promise<ProviderProfileDto> {
    if (!files.length) {
      throw new BadRequestException('Aucun fichier reçu (champ "files").');
    }
    const provider = await this.prisma.provider.findUnique({
      where: { userId },
      include: { photos: { orderBy: { sortOrder: 'desc' }, take: 1 } },
    });
    if (!provider) {
      throw new NotFoundException('Pas encore de profil prestataire.');
    }

    const photoCount = await this.prisma.providerPhoto.count({
      where: { providerId: provider.id },
    });
    if (photoCount + files.length > MAX_PORTFOLIO_PHOTOS) {
      throw new BadRequestException(
        `Maximum ${MAX_PORTFOLIO_PHOTOS} photos de réalisations.`,
      );
    }

    let sortOrder = (provider.photos[0]?.sortOrder ?? -1) + 1;
    for (const file of files) {
      const { url } = await this.storage.save(file.buffer, {
        folder: 'portfolio',
        mime: file.mimetype,
      });
      await this.prisma.providerPhoto.create({
        data: { providerId: provider.id, url, sortOrder: sortOrder++ },
      });
    }
    return this.getMine(userId);
  }

  async removePortfolioPhoto(userId: string, photoId: string): Promise<void> {
    const photo = await this.prisma.providerPhoto.findUnique({
      where: { id: photoId },
      include: { provider: { select: { userId: true } } },
    });
    if (!photo || photo.provider.userId !== userId) {
      throw new NotFoundException('Photo introuvable.');
    }
    await this.prisma.providerPhoto.delete({ where: { id: photoId } });
    await this.storage.delete(photo.url);
  }
}
