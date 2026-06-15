import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { StoragePort } from '../../../integrations/storage/storage.port';
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
}
