export interface GeoPoint {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6_371_000;

/** Distance haversine en mètres, arrondie. */
export function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return Math.round(2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h)));
}

/** Jitter déterministe 0..399 m dérivé d'un id (stable entre appels). */
export function stableJitter(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 400;
}

/** Première partie du quartier ("Yopougon Selmer" → "yopougon") pour comparer les communes. */
function communeOf(quarter: string): string {
  return quarter.trim().split(/\s+/)[0].toLowerCase();
}

/**
 * Distance estimée entre un observateur et un prestataire.
 * Haversine si les deux ont des coordonnées, sinon heuristique par quartier
 * (même quartier ~250 m, même commune ~1200 m, sinon ~5000 m) + jitter stable.
 */
export function estimateDistanceMeters(params: {
  viewer: Partial<GeoPoint> & { quarter?: string | null };
  provider: Partial<GeoPoint> & { quarter?: string | null };
  providerId: string;
}): number {
  const { viewer, provider, providerId } = params;
  if (
    viewer.lat != null &&
    viewer.lng != null &&
    provider.lat != null &&
    provider.lng != null
  ) {
    return haversineMeters(
      { lat: viewer.lat, lng: viewer.lng },
      { lat: provider.lat, lng: provider.lng },
    );
  }

  const jitter = stableJitter(providerId);
  const viewerQuarter = viewer.quarter?.trim().toLowerCase();
  const providerQuarter = provider.quarter?.trim().toLowerCase();
  if (!viewerQuarter || !providerQuarter) return 5000 + jitter;
  if (viewerQuarter === providerQuarter) return 250 + jitter;
  if (communeOf(viewerQuarter) === communeOf(providerQuarter))
    return 1200 + jitter;
  return 5000 + jitter;
}
