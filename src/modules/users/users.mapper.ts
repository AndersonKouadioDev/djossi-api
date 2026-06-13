import { User } from '@prisma/client';
import { UserDto } from './dto/user.dto';

type UserWithProviderId = User & { provider?: { id: string } | null };

export function toUserDto(user: UserWithProviderId): UserDto {
  return {
    id: user.id,
    phone: user.phone,
    full_name: user.fullName,
    email: user.email,
    avatar_url: user.avatarUrl,
    quarter: user.quarter,
    created_at: user.createdAt.toISOString(),
    is_provider: user.provider != null,
    provider_id: user.provider?.id ?? null,
  };
}
