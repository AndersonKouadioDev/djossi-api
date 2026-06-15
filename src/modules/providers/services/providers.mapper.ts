import { Provider, ProviderPhoto, ProviderService, User } from '@prisma/client';
import { estimateDistanceMeters } from '../../../common/utils/distance.util';
import { round1 } from '../../users/services/provider-profile.mapper';
import {
  ProviderDetailDto,
  ProviderSummaryDto,
} from '../dto/provider-response.dtos';

export interface Viewer {
  quarter?: string | null;
  lat?: number | null;
  lng?: number | null;
}

export type ProviderWithUser = Provider & {
  user: Pick<User, 'fullName' | 'avatarUrl'>;
};

export type ProviderFull = ProviderWithUser & {
  serviceLabels: ProviderService[];
  photos: ProviderPhoto[];
};

export function toProviderSummary(
  provider: ProviderWithUser,
  viewer: Viewer,
): ProviderSummaryDto {
  return {
    id: provider.id,
    full_name: provider.user.fullName,
    category: provider.category,
    distance_meters: estimateDistanceMeters({
      viewer: {
        lat: viewer.lat ?? undefined,
        lng: viewer.lng ?? undefined,
        quarter: viewer.quarter,
      },
      provider: {
        lat: provider.lat ?? undefined,
        lng: provider.lng ?? undefined,
        quarter: provider.workQuarter,
      },
      providerId: provider.id,
    }),
    rating: round1(provider.ratingAvg),
    missions_done: provider.missionsDone,
    is_verified: provider.isVerified,
    is_pro: provider.isPro,
    photo_url: provider.user.avatarUrl,
    quarter: provider.workQuarter,
    latitude: provider.latitude,
    longitude: provider.longitude,
  };
}

export function toProviderDetail(
  provider: ProviderFull,
  viewer: Viewer,
): ProviderDetailDto {
  return {
    ...toProviderSummary(provider, viewer),
    trade: provider.trade,
    trade_description: provider.tradeDescription,
    bio: provider.bio,
    work_radius: provider.workRadius,
    services: provider.serviceLabels.map((s) => s.label),
    reviews_count: provider.ratingCount,
    portfolio_urls: provider.photos.map((p) => p.url),
    hourly_rate_min: provider.hourlyRateMin,
    hourly_rate_max: provider.hourlyRateMax,
    member_since: provider.createdAt.toISOString(),
  };
}
