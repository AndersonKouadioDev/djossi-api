import { Provider, ProviderPhoto, ProviderService } from '@prisma/client';
import { ProviderProfileDto } from '../dto/provider-profile.dtos';

export type ProviderWithRelations = Provider & {
  serviceLabels: ProviderService[];
  photos: ProviderPhoto[];
};

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function toProviderProfileDto(
  provider: ProviderWithRelations,
): ProviderProfileDto {
  return {
    id: provider.id,
    user_id: provider.userId,
    category: provider.category,
    trade: provider.trade,
    trade_description: provider.tradeDescription,
    bio: provider.bio,
    work_quarter: provider.workQuarter,
    work_radius: provider.workRadius,
    hourly_rate_min: provider.hourlyRateMin,
    hourly_rate_max: provider.hourlyRateMax,
    mobile_money_number: provider.mobileMoneyNumber,
    kyc_selfie_done: provider.kycSelfieDone,
    kyc_cni_done: provider.kycCniDone,
    is_verified: provider.isVerified,
    is_pro: provider.isPro,
    rating: round1(provider.ratingAvg),
    reviews_count: provider.ratingCount,
    missions_done: provider.missionsDone,
    services: provider.serviceLabels.map((s) => s.label),
    portfolio_urls: provider.photos.map((p) => p.url),
    created_at: provider.createdAt.toISOString(),
  };
}
