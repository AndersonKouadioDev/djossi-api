import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { StoragePort } from '../../../integrations/storage/storage.port';
import { ReferralDto } from '../dto/referral.dto';
import { UpdateMeDto } from '../dto/update-me.dto';
import { UserDto } from '../dto/user.dto';
import { toUserDto } from './users.mapper';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StoragePort,
  ) {}

  async me(userId: string): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { provider: { select: { id: true } } },
    });
    if (!user) throw new NotFoundException('Compte introuvable.');
    return toUserDto(user);
  }

  async updateMe(userId: string, dto: UpdateMeDto): Promise<UserDto> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: {
        fullName: dto.full_name,
        email: dto.email,
        quarter: dto.quarter,
        lat: dto.lat,
        lng: dto.lng,
      },
      include: { provider: { select: { id: true } } },
    });
    return toUserDto(user);
  }

  async setAvatar(
    userId: string,
    file: Express.Multer.File,
  ): Promise<{ avatar_url: string }> {
    const { url } = await this.storage.save(file.buffer, {
      folder: 'avatars',
      mime: file.mimetype,
    });

    const previous = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });
    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: url },
    });
    if (previous?.avatarUrl) {
      await this.storage.delete(previous.avatarUrl);
    }
    return { avatar_url: url };
  }

  /**
   * Parrainage de l'utilisateur connecté.
   *
   * Le code est dérivé de façon DÉTERMINISTE de l'id user : on garde les
   * caractères alphanumériques, on prend les 8 premiers en MAJUSCULES et on
   * préfixe « DJ ». Même user → même code, sans migration ni colonne dédiée.
   *
   * NOTE PRODUIT : `invited_count` est figé à 0. Le suivi des filleuls
   * (colonne `referred_by`, attribution, récompenses) est une évolution
   * produit à venir — pas de migration ici.
   */
  async referral(userId: string): Promise<ReferralDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('Compte introuvable.');

    const code = buildReferralCode(user.id);
    return {
      code,
      share_message: `Rejoins-moi sur DJOSSI, les talents de ton quartier ! Utilise mon code ${code}.`,
      invited_count: 0,
    };
  }
}

/** Code de parrainage stable et lisible dérivé de l'id user (préfixe « DJ »). */
function buildReferralCode(userId: string): string {
  const alphanumeric = userId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return `DJ${alphanumeric.slice(0, 8)}`;
}
